import { canManageWorkers, type UserProfile } from '@turnos/core';

import { getSupabaseClient } from '../lib/supabase';

export type InviteCodeResult = {
  code: string;
  expiresAt: string;
  workerId: string;
};

/**
 * Genera un código numérico de 6 dígitos para que el worker se vincule sin
 * necesitar una invitación por email. El código tiene TTL definido en la RPC;
 * el hash nunca se almacena en texto plano en la base.
 */
export async function generateInviteCode(
  profile: UserProfile,
  workerId: string
): Promise<InviteCodeResult> {
  if (!canManageWorkers(profile)) {
    throw new Error('Solo la cuenta owner puede generar códigos de invitación');
  }

  const { data, error } = await getSupabaseClient().rpc(
    'generate_worker_invite_code',
    { p_worker_id: workerId }
  );

  if (error) throw new Error(error.message);
  if (!data) throw new Error('No se recibió respuesta del servidor');

  return {
    code: data.code,
    expiresAt: data.expires_at,
    workerId: data.worker_id,
  };
}
