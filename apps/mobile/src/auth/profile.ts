import type { UserProfile, UserRole } from '@turnos/core';

import { secureStore } from '../lib/secureStore';
import { getSupabaseClient } from '../lib/supabase';
import { generateUuidV7 } from './uuid';

type ProfileRow = {
  id: string;
  business_id: string;
  role: UserRole;
  worker_id: string | null;
  email: string;
  updated_at: number;
  sync_version: number;
};

export type OwnerBootstrapInput = {
  name: string;
  baseCurrency: string;
  timezone: string;
};

function isUserRole(value: unknown): value is UserRole {
  return value === 'owner' || value === 'worker';
}

function toUserProfile(row: ProfileRow): UserProfile {
  if (!isUserRole(row.role)) {
    throw new Error('El perfil remoto contiene un rol inválido.');
  }

  if (typeof row.updated_at !== 'number' || typeof row.sync_version !== 'number') {
    throw new Error('El perfil remoto contiene metadatos de sincronización inválidos.');
  }

  return {
    id: row.id,
    business_id: row.business_id,
    role: row.role,
    worker_id: row.worker_id ?? undefined,
    email: row.email,
    updated_at: row.updated_at,
    sync_version: row.sync_version,
  };
}

const PROFILE_FETCH_TIMEOUT_MS = 6000;

const profileCacheKey = (userId: string) => `turnos.profile.${userId}`;

async function readCachedProfile(userId: string): Promise<UserProfile | null> {
  try {
    const raw = await secureStore.getItem(profileCacheKey(userId));
    if (!raw) return null;
    const row = JSON.parse(raw) as ProfileRow;
    return row.id === userId ? toUserProfile(row) : null;
  } catch {
    return null;
  }
}

async function writeCachedProfile(userId: string, profile: UserProfile | null): Promise<void> {
  try {
    if (profile) {
      await secureStore.setItem(profileCacheKey(userId), JSON.stringify(profile));
    } else {
      await secureStore.removeItem(profileCacheKey(userId));
    }
  } catch {
    // El caché es una optimización offline; un fallo no debe bloquear la sesión.
  }
}

/** Borra el perfil cacheado de la cuenta (al cerrar sesión). */
export async function clearCachedProfile(userId: string): Promise<void> {
  await writeCachedProfile(userId, null);
}

/**
 * Carga el perfil del usuario. Sin conexión (o si el servidor no responde en
 * unos segundos) usa el último perfil guardado en el dispositivo, para que la
 * app abra offline. Los errores del servidor (permisos, etc.) sí se propagan.
 */
export async function fetchOwnProfile(userId: string): Promise<UserProfile | null> {
  const query = getSupabaseClient()
    .from('user_profiles')
    .select('id, business_id, role, worker_id, email, updated_at, sync_version')
    .eq('id', userId)
    .maybeSingle();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), PROFILE_FETCH_TIMEOUT_MS);
  });

  let result: Awaited<typeof query> | 'timeout';
  try {
    result = await Promise.race([query, timeout]);
  } catch {
    result = 'timeout';
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (result === 'timeout' || (!!result.error && !(result.error as { code?: string }).code)) {
    const cached = await readCachedProfile(userId);
    if (cached) return cached;
    throw new Error('Sin conexión y sin datos guardados. Conéctate a internet para iniciar.');
  }

  const { data, error } = result as Exclude<typeof result, 'timeout'>;

  if (error) {
    throw new Error(`No se pudo cargar el perfil: ${error.message}`);
  }

  const profile = data ? toUserProfile(data as ProfileRow) : null;
  await writeCachedProfile(userId, profile);
  return profile;
}

function normalizeBusinessName(value: string): string {
  const name = value.trim();

  if (!name) {
    throw new Error('Ingresa el nombre del salón.');
  }

  return name;
}

function normalizeCurrency(value: string): string {
  const currency = value.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error('La moneda base debe usar un código ISO de tres letras, por ejemplo ARS.');
  }

  return currency;
}

function normalizeTimezone(value: string): string {
  const timezone = value.trim();

  if (!timezone) {
    throw new Error('Ingresa una zona horaria IANA, por ejemplo America/Argentina/Buenos_Aires.');
  }

  return timezone;
}

export async function bootstrapOwnerBusiness(input: OwnerBootstrapInput): Promise<void> {
  const { error } = await getSupabaseClient().rpc('bootstrap_owner_business', {
    p_business_id: generateUuidV7(),
    p_name: normalizeBusinessName(input.name),
    p_base_currency: normalizeCurrency(input.baseCurrency),
    p_timezone: normalizeTimezone(input.timezone),
  });

  if (error) {
    throw new Error(`No se pudo crear el salón: ${error.message}`);
  }
}
