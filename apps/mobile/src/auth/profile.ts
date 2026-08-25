import type { UserProfile, UserRole } from '@turnos/core';

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

export async function fetchOwnProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await getSupabaseClient()
    .from('user_profiles')
    .select('id, business_id, role, worker_id, email, updated_at, sync_version')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo cargar el perfil: ${error.message}`);
  }

  return data ? toUserProfile(data as ProfileRow) : null;
}

function normalizeBusinessName(value: string): string {
  const name = value.trim();

  if (!name) {
    throw new Error('Ingresá el nombre del salón.');
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
    throw new Error('Ingresá una zona horaria IANA, por ejemplo America/Argentina/Buenos_Aires.');
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
