import { getSupabaseClient } from '../lib/supabase';

export type RedeemResult = {
  status: 'linked';
  businessId: string;
  workerId: string;
};

/**
 * Canjea el código de 6 dígitos desde la sesión del worker recién registrado.
 * El servidor valida TTL, uso único y que el código no haya sido canjeado antes.
 * Errores de código inválido/expirado/ya usado se devuelven como error genérico
 * desde la RPC para evitar enumeración.
 */
export async function redeemInviteCode(code: string): Promise<RedeemResult> {
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    throw new Error('El código debe ser de 6 dígitos');
  }

  const { data, error } = await getSupabaseClient().rpc(
    'redeem_worker_invite_code',
    { p_code: trimmed }
  );

  if (error) throw new Error(error.message);
  if (!data) throw new Error('No se recibió respuesta del servidor');

  return {
    status: data.status,
    businessId: data.business_id,
    workerId: data.worker_id,
  };
}
