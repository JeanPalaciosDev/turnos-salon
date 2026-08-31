import type { AppointmentStatus } from '@turnos/core';

import { colors, type StatusKey } from '../theme';

/**
 * Mapea el estado de dominio (AppointmentStatus) a la clave de color del tema.
 * El modelo de datos usa 'scheduled' como estado inicial; el diseño lo representa
 * como "Pendiente" (terracota) hasta que se confirme/complete. 'confirmed' y
 * 'active' no existen aún como estados del modelo, pero el tema los prevé.
 */
const STATUS_TO_COLOR: Record<AppointmentStatus, StatusKey> = {
  scheduled: 'pending',
  completed: 'done',
  cancelled: 'cancelled',
  no_show: 'noshow',
};

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: 'Pendiente',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No-show',
};

/** Ícono textual para no depender solo del color (accesibilidad, daltonismo). */
const STATUS_ICON: Record<AppointmentStatus, string> = {
  scheduled: '⏱',
  completed: '✓',
  cancelled: '✕',
  no_show: '⃠',
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
