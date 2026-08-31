import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { canManageWorkers } from '@turnos/core';

import { useAuth } from '../../../src/auth/AuthProvider';
import { WorkerModel } from '../../../src/database/models';
import { WorkerForm } from '../../../src/workers/WorkerForm';
import {
  getWorker,
  setWorkerActive,
  type WorkerDraft,
  updateWorker,
} from '../../../src/workers/workerRepository';
import { inviteWorker } from '../../../src/workers/inviteWorker';
import { colors, radius, spacing, typography } from '../../../src/theme';

export default function WorkerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, status, syncNow } = useAuth();
  const [worker, setWorker] = useState<WorkerModel | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTogglingActive, setIsTogglingActive] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const workerId = Array.isArray(id) ? id[0] : id;
  const canManage = Boolean(profile && canManageWorkers(profile));

  useEffect(() => {
    if (!profile || !canManage || !workerId) {
      return;
    }

    let isMounted = true;

    void getWorker(profile, workerId)
      .then((value) => {
        if (isMounted) {
          setWorker(value);
          setIsActive(value.isActive);
          setIsLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error ? error.message : 'No se pudo cargar el trabajador.'
          );
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [canManage, profile, workerId]);

  const initialValue = useMemo<WorkerDraft | null>(() => {
    if (!worker) {
      return null;
    }

    return {
      name: worker.name,
      commissionType: worker.commissionType,
      commissionValue: worker.commissionValue,
      commissionCurrency: worker.commissionCurrency,
    };
  }, [worker]);

  if (status !== 'ready' || !profile || !canManage || !workerId) {
    return <Redirect href="/home" />;
  }

  const handleSubmit = async (draft: WorkerDraft) => {
    await updateWorker(profile, workerId, draft);
    await syncNow();
    router.replace('/workers');
  };

  const handleToggleActive = async () => {
    if (!worker) {
      return;
    }

    setIsTogglingActive(true);

    try {
      const next = !isActive;
      await setWorkerActive(profile, worker.id, next);
      setIsActive(next);
      await syncNow();
    } catch (error) {
      Alert.alert(
        'No se pudo actualizar el estado',
        error instanceof Error ? error.message : 'Intentá nuevamente.'
      );
    } finally {
      setIsTogglingActive(false);
    }
  };

  const confirmToggleActive = () => {
    if (!worker) {
      return;
    }

    if (isActive) {
      Alert.alert(
        'Desactivar trabajador',
        `${worker.name} dejará de recibir turnos nuevos, pero se conserva su historial de comisiones.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Desactivar', style: 'destructive', onPress: () => void handleToggleActive() },
        ]
      );
      return;
    }

    void handleToggleActive();
  };

  const handleInvite = async () => {
    if (!worker) {
      return;
    }

    setIsInviting(true);

    try {
      await inviteWorker(profile, { workerId: worker.id, email: inviteEmail });
      setInviteEmail('');
      Alert.alert(
        'Invitación enviada',
        `Le enviamos a ${worker.name} un email para crear su contraseña y acceder a su agenda.`
      );
    } catch (error) {
      Alert.alert(
        'No se pudo invitar',
        error instanceof Error ? error.message : 'Intentá nuevamente.'
      );
    } finally {
      setIsInviting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brandPrimary} />
        <Text style={styles.loadingText}>Cargando trabajador…</Text>
      </View>
    );
  }

  if (errorMessage || !worker || !initialValue) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{errorMessage ?? 'El trabajador no existe.'}</Text>
        <Pressable onPress={() => router.replace('/workers')} style={styles.backButton}>
          <Text style={styles.backButtonText}>Volver a trabajadores</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <WorkerForm initialValue={initialValue} onSubmit={handleSubmit} submitLabel="Guardar cambios" />
      <View style={styles.actionArea}>
        <Text style={styles.actionLabel}>INVITAR CUENTA</Text>
        <Text style={styles.actionHint}>
          Enviá un email de invitación para que pueda iniciar sesión y ver su agenda. La cuenta se
          crea de forma segura en el servidor.
        </Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          inputMode="email"
          keyboardType="email-address"
          onChangeText={setInviteEmail}
          placeholder="email@ejemplo.com"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={inviteEmail}
        />
        <Pressable
          disabled={isInviting}
          onPress={() => void handleInvite()}
          style={({ pressed }) => [
            styles.secondaryButton,
            (pressed || isInviting) && styles.buttonPressed,
          ]}
        >
          {isInviting ? (
            <ActivityIndicator color={colors.brandPrimary} />
          ) : (
            <Text style={styles.secondaryButtonText}>Invitar cuenta</Text>
          )}
        </Pressable>

        <Pressable
          disabled={isTogglingActive}
          onPress={confirmToggleActive}
          style={({ pressed }) => [
            styles.toggleButton,
            (pressed || isTogglingActive) && styles.buttonPressed,
          ]}
        >
          {isTogglingActive ? (
            <ActivityIndicator color={colors.status.cancelled.border} />
          ) : (
            <Text style={styles.toggleText}>
              {isActive ? 'Desactivar trabajador' : 'Reactivar trabajador'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgBase,
  },
  loadingText: {
    color: colors.textSecondary,
    ...typography.body,
    fontSize: 15,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.bgBase,
  },
  errorText: {
    color: colors.status.cancelled.border,
    ...typography.body,
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
  },
  backButton: {
    borderRadius: radius.control,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButtonText: {
    color: colors.bgSurface,
    ...typography.bodyStrong,
    fontSize: 15,
  },
  actionArea: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgSurface,
    padding: spacing.lg,
  },
  actionLabel: {
    color: colors.textMuted,
    ...typography.small,
    letterSpacing: 1,
  },
  actionHint: {
    color: colors.textSecondary,
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.control,
    color: colors.textPrimary,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  secondaryButton: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    borderRadius: radius.control,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  secondaryButtonText: {
    color: colors.brandPrimary,
    ...typography.bodyStrong,
    fontSize: 15,
  },
  toggleButton: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.status.cancelled.border,
    borderRadius: radius.control,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  toggleText: {
    color: colors.status.cancelled.border,
    ...typography.bodyStrong,
    fontSize: 15,
  },
  buttonPressed: {
    opacity: 0.65,
  },
});
