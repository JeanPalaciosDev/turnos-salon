import type { Appointment } from './types';

/**
 * Verifica que dos turnos no se solapen para el mismo trabajador.
 * Retorna true si hay conflicto (overlap).
 */
export function hasTimeOverlap(
  existing: Pick<Appointment, 'start_time' | 'end_time'>,
  incoming: Pick<Appointment, 'start_time' | 'end_time'>
): boolean {
  // Convertir "HH:mm" a minutos desde medianoche para comparar
  const toMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const existingStart = toMinutes(existing.start_time);
  const existingEnd = toMinutes(existing.end_time);
  const incomingStart = toMinutes(incoming.start_time);
  const incomingEnd = toMinutes(incoming.end_time);

  // Overlap: incomingStart < existingEnd AND incomingEnd > existingStart
  return incomingStart < existingEnd && incomingEnd > existingStart;
}

/**
 * Valida que no haya solapamiento del nuevo turno con los existentes del mismo worker.
 * Retorna lista de appointments que generan conflicto.
 */
export function validateNoOverlap(
  workerAppointments: Pick<Appointment, 'id' | 'start_time' | 'end_time' | 'status'>[],
  incoming: Pick<Appointment, 'start_time' | 'end_time'>,
  excludeId?: string
): Pick<Appointment, 'id' | 'start_time' | 'end_time' | 'status'>[] {
  return workerAppointments.filter(
    (appt) =>
      appt.id !== excludeId &&
      appt.status !== 'cancelled' &&
      hasTimeOverlap(appt, incoming)
  );
}

/**
 * Valida campos requeridos de un servicio.
 */
export function validateService(data: {
  name?: string;
  duration_minutes?: number;
  default_price_amount?: number;
}): string[] {
  const errors: string[] = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('El nombre del servicio es requerido');
  }
  if (data.duration_minutes == null || data.duration_minutes <= 0) {
    errors.push('La duración debe ser mayor a 0 minutos');
  }
  if (data.default_price_amount == null || data.default_price_amount <= 0) {
    errors.push('El precio debe ser mayor a 0');
  }

  return errors;
}

/**
 * Valida campos requeridos de un cliente.
 */
export function validateClient(data: {
  name?: string;
}): string[] {
  const errors: string[] = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('El nombre del cliente es requerido');
  }

  return errors;
}

/**
 * Valida campos requeridos de un trabajador.
 */
export function validateWorker(data: {
  name?: string;
  commission_type?: string;
  commission_value?: number;
}): string[] {
  const errors: string[] = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('El nombre del trabajador es requerido');
  }
  if (!data.commission_type || !['percentage', 'fixed_per_service'].includes(data.commission_type)) {
    errors.push('El tipo de comisión debe ser "percentage" o "fixed_per_service"');
  }
  if (data.commission_value == null || data.commission_value < 0) {
    errors.push('El valor de comisión debe ser 0 o mayor');
  }
  if (data.commission_type === 'percentage' && data.commission_value != null && data.commission_value > 100) {
    errors.push('El porcentaje de comisión no puede superar 100');
  }

  return errors;
}
