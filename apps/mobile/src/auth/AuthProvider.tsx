import type { Session } from '@supabase/supabase-js';
import type { UserProfile } from '@turnos/core';
import { AppState, type AppStateStatus } from 'react-native';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { clearLocalDatabaseForSignOut, prepareLocalDatabaseForUser } from '../database';
import { synchronizeWithServer } from '../database/sync';
import {
  getSupabaseClient,
  supabase,
  supabaseConfigurationError,
  syncEndpoint,
} from '../lib/supabase';
import {
  bootstrapOwnerBusiness,
  fetchOwnProfile,
  type OwnerBootstrapInput,
} from './profile';

export type AuthStatus =
  | 'loading'
  | 'configuration-error'
  | 'signed-out'
  | 'needs-bootstrap'
  | 'ready'
  | 'error';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

type AuthState = {
  status: AuthStatus;
  session: Session | null;
  profile: UserProfile | null;
  errorMessage: string | null;
};

type SignUpResult = {
  requiresEmailConfirmation: boolean;
};

type AuthContextValue = AuthState & {
  syncStatus: SyncStatus;
  syncErrorMessage: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  completeOwnerBootstrap: (input: OwnerBootstrapInput) => Promise<void>;
  syncNow: () => Promise<void>;
  retry: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [authState, setAuthState] = useState<AuthState>({
    status: supabase ? 'loading' : 'configuration-error',
    session: null,
    profile: null,
    errorMessage: supabaseConfigurationError,
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);
  const resolutionVersion = useRef(0);

  const resolveSession = useCallback(async (nextSession: Session | null): Promise<void> => {
    const currentVersion = ++resolutionVersion.current;

    if (!nextSession) {
      setAuthState({
        status: 'signed-out',
        session: null,
        profile: null,
        errorMessage: null,
      });
      setSyncStatus('idle');
      setSyncErrorMessage(null);
      return;
    }

    setAuthState((current) => ({
      status:
        current.status === 'ready' && current.profile?.id === nextSession.user.id
          ? 'ready'
          : 'loading',
      session: nextSession,
      profile: current.profile?.id === nextSession.user.id ? current.profile : null,
      errorMessage: null,
    }));

    try {
      const profile = await fetchOwnProfile(nextSession.user.id);

      if (currentVersion !== resolutionVersion.current) {
        return;
      }

      if (!profile) {
        setAuthState({
          status: 'needs-bootstrap',
          session: nextSession,
          profile: null,
          errorMessage: null,
        });
        return;
      }

      await prepareLocalDatabaseForUser(profile);

      if (currentVersion !== resolutionVersion.current) {
        return;
      }

      setAuthState({
        status: 'ready',
        session: nextSession,
        profile,
        errorMessage: null,
      });
    } catch (error) {
      if (currentVersion !== resolutionVersion.current) {
        return;
      }

      setAuthState({
        status: 'error',
        session: nextSession,
        profile: null,
        errorMessage: getErrorMessage(error, 'No se pudo restaurar la sesión.'),
      });
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const client = getSupabaseClient();
    const { data: authSubscription } = client.auth.onAuthStateChange((_event, nextSession) => {
      // Supabase recomienda no ejecutar otras llamadas del cliente dentro del callback.
      setTimeout(() => {
        void resolveSession(nextSession);
      }, 0);
    });

    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          setAuthState({
            status: 'error',
            session: null,
            profile: null,
            errorMessage: `No se pudo restaurar la sesión: ${error.message}`,
          });
          return;
        }

        return resolveSession(data.session);
      })
      .catch((error: unknown) => {
        setAuthState({
          status: 'error',
          session: null,
          profile: null,
          errorMessage: getErrorMessage(error, 'No se pudo restaurar la sesión.'),
        });
      });

    return () => {
      authSubscription.subscription.unsubscribe();
    };
  }, [resolveSession]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const client = getSupabaseClient();
    const updateAutoRefresh = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        client.auth.startAutoRefresh();
      } else {
        client.auth.stopAutoRefresh();
      }
    };

    client.auth.startAutoRefresh();
    const appStateSubscription = AppState.addEventListener('change', updateAutoRefresh);

    return () => {
      appStateSubscription.remove();
      client.auth.stopAutoRefresh();
    };
  }, []);

  const syncNow = useCallback(async (): Promise<void> => {
    const session = authState.session;
    const profile = authState.profile;

    if (!session || !profile) {
      return;
    }

    if (!syncEndpoint) {
      setSyncStatus('error');
      setSyncErrorMessage('No se pudo determinar la URL de la Edge Function de sincronización.');
      return;
    }

    setSyncStatus('syncing');
    setSyncErrorMessage(null);

    try {
      const refreshedProfile = await fetchOwnProfile(session.user.id);

      if (!refreshedProfile) {
        throw new Error('La cuenta ya no pertenece a un negocio.');
      }

      await prepareLocalDatabaseForUser(refreshedProfile);

      const scopeChanged =
        refreshedProfile.id !== profile.id ||
        refreshedProfile.business_id !== profile.business_id ||
        refreshedProfile.role !== profile.role ||
        (refreshedProfile.worker_id ?? null) !== (profile.worker_id ?? null);

      if (scopeChanged) {
        setAuthState((current) =>
          current.session?.user.id === session.user.id
            ? {
                ...current,
                profile: refreshedProfile,
              }
            : current
        );
      }

      await synchronizeWithServer({
        endpoint: syncEndpoint,
        accessToken: session.access_token,
      });
      setSyncStatus('synced');
    } catch (error) {
      setSyncStatus('error');
      setSyncErrorMessage(getErrorMessage(error, 'No se pudo sincronizar la base local.'));
    }
  }, [authState.profile, authState.session]);

  useEffect(() => {
    if (authState.status === 'ready') {
      void syncNow();
    }
  }, [authState.status, syncNow]);

  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    const { error } = await getSupabaseClient().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      throw new Error(error.message);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<SignUpResult> => {
    const { data, error } = await getSupabaseClient().auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { requiresEmailConfirmation: data.session === null };
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    const { error } = await getSupabaseClient().auth.signOut();

    if (error) {
      throw new Error(error.message);
    }

    await clearLocalDatabaseForSignOut();
    setSyncStatus('idle');
    setSyncErrorMessage(null);
  }, []);

  const completeOwnerBootstrap = useCallback(
    async (input: OwnerBootstrapInput): Promise<void> => {
      await bootstrapOwnerBusiness(input);
      const { data, error } = await getSupabaseClient().auth.getSession();

      if (error) {
        throw new Error(`El salón se creó, pero no se pudo refrescar la sesión: ${error.message}`);
      }

      await resolveSession(data.session);
    },
    [resolveSession]
  );

  const retry = useCallback(async (): Promise<void> => {
    if (!supabase) {
      return;
    }

    const { data, error } = await getSupabaseClient().auth.getSession();

    if (error) {
      setAuthState({
        status: 'error',
        session: null,
        profile: null,
        errorMessage: `No se pudo restaurar la sesión: ${error.message}`,
      });
      return;
    }

    await resolveSession(data.session);
  }, [resolveSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...authState,
      syncStatus,
      syncErrorMessage,
      signIn,
      signUp,
      signOut,
      completeOwnerBootstrap,
      syncNow,
      retry,
    }),
    [
      authState,
      completeOwnerBootstrap,
      retry,
      signIn,
      signOut,
      signUp,
      syncErrorMessage,
      syncNow,
      syncStatus,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider.');
  }

  return context;
}
