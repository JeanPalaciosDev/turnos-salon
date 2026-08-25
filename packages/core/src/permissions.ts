import type { UserProfile, Appointment } from './types';

/**
 * El owner tiene acceso total.
 * El worker solo ve su propia agenda y puede marcar completado.
 */

export function canViewAppointment(user: UserProfile, appointment: Appointment): boolean {
  if (user.role === 'owner') return true;
  // Worker solo ve sus propios turnos
  return user.worker_id === appointment.worker_id;
}

export function canCreateAppointment(user: UserProfile): boolean {
  return user.role === 'owner';
}

export function canEditAppointment(user: UserProfile, _appointment: Appointment): boolean {
  return user.role === 'owner';
}

export function canCancelAppointment(user: UserProfile, _appointment: Appointment): boolean {
  return user.role === 'owner';
}

export function canCompleteAppointment(user: UserProfile, appointment: Appointment): boolean {
  if (user.role === 'owner') return true;
  // Worker puede marcar completado solo sus propios turnos
  return user.worker_id === appointment.worker_id;
}

export function canManageServices(user: UserProfile): boolean {
  return user.role === 'owner';
}

export function canManageWorkers(user: UserProfile): boolean {
  return user.role === 'owner';
}

export function canManageClients(user: UserProfile): boolean {
  return user.role === 'owner';
}

export function canViewPayments(user: UserProfile): boolean {
  return user.role === 'owner';
}

export function canRecordPayment(user: UserProfile): boolean {
  return user.role === 'owner';
}

export function canViewCommissions(user: UserProfile): boolean {
  return user.role === 'owner';
}

export function canViewDashboard(user: UserProfile): boolean {
  return user.role === 'owner';
}
