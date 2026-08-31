import { canManageWorkers, type UserProfile } from '@turnos/core';

import { getSupabaseClient } from '../lib/supabase';

export type InviteWorkerInput = {
  workerId: string;
  email: string;
};

export type InviteWorkerResult = {
  status: 'invited';
  workerId: string;
};

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();

  // Validación mínima de forma; el servidor (GoTrue) es la autoridad real.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Ingresá un email válido para invitar al trabajador.');
  }

  return email;
}

/**
 * Invita a la persona vinculada a un worker existente. El alta del auth.users y el
 * vínculo user_profiles ocurren SERVER-SIDE en la Edge Function `invite-worker`, que
 * usa la service-role SOLO en el servidor. El móvil solo envía el Bearer del owner:
 * la service-role NUNCA vive en el bundle.
 */
export async function inviteWorker(
  profile: UserProfile,
  input: InviteWorkerInput
): Promise<InviteWorkerResult> {
  if (!canManageWorkers(profile)) {
    throw new Error('Solo la cuenta owner puede invitar trabajadores.');
  }

  const email = normalizeEmail(input.email);

  const { data, error } = await getSupabaseClient().functions.invoke('invite-worker', {
    body: { worker_id: input.workerId, email },
  });

  if (error) {
    throw new Error(`No se pudo enviar la invitación: ${error.message}`);
  }

  const status = (data as { status?: string } | null)?.status;

  if (status !== 'invited') {
    throw new Error('La invitación no se pudo completar. Intentá nuevamente.');
  }

  return { status: 'invited', workerId: input.workerId };
}
