import type { AppointmentStatus } from '@turnos/core';

import { colors, type StatusKey } from '../theme';

/**
 * Mapea el estado de dominio (AppointmentStatus, 6 estados del rediseño) a la
 * clave de color del tema (StatusKey).
 */
const STATUS_TO_COLOR: Record<AppointmentStatus, StatusKey> = {
  created: 'active',
  pending: 'pending',
  in_progress: 'active',
  done: 'done',
  no_show: 'noshow',
  cancelled: 'cancelled',
};

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  created: 'Creado',
  pending: 'Pendiente',
  in_progress: 'En curso',
  done: 'Finalizado',
  no_show: 'Ausente',
  cancelled: 'Cancelado',
};

/** Ícono textual para no depender solo del color (accesibilidad, daltonismo). */
const STATUS_ICON: Record<AppointmentStatus, string> = {
  created: '⏱',
  pending: '⏱',
  in_progress: '●',
  done: '✓',
  no_show: '⃠',
  cancelled: '✕',
};

export function statusColors(status: AppointmentStatus): { border: string; bg: string } {
  return colors.status[STATUS_TO_COLOR[status]];
}

export function statusLabel(status: AppointmentStatus): string {
  return STATUS_LABEL[status];
}

export function statusIcon(status: AppointmentStatus): string {
  return STATUS_ICON[status];
}
