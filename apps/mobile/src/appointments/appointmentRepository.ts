import { Q } from '@nozbe/watermelondb';
import {
  type Appointment,
  type AppointmentStatus,
  canCancelAppointment,
  canCreateAppointment,
  canEditAppointment,
  type UserProfile,
  validateNoOverlap,
} from '@turnos/core';
import { TABLES } from '@turnos/models';

import { generateUuidV7 } from '../auth/uuid';
import { database } from '../database';
import { AppointmentModel, ServiceModel } from '../database/models';
import { validateSlotEndpoint } from '../lib/supabase';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Datos que la UI envía para crear o editar un turno. La hora de fin se deriva
 * de la duración del servicio (no se pide al usuario) para respetar el CHECK
 * start<end del servidor y mantener coherencia con la duración real.
 */
export type AppointmentDraft = {
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm"
  serviceId: string;
  workerId: string;
  clientId: string;
  notes?: string;
};

export class AppointmentValidationError extends Error {
  constructor(readonly messages: string[]) {
    super(messages.join('\n'));
    this.name = 'AppointmentValidationError';
  }
}

/**
 * Se lanza cuando el turno se solapa con otro del mismo worker. Se detecta
 * localmente antes de escribir; el servidor revalida vía exclusión GiST al push.
 */
export class AppointmentOverlapError extends Error {
  constructor(readonly conflicts: Pick<Appointment, 'id' | 'start_time' | 'end_time'>[]) {
    super('El horario se superpone con otra cita del mismo profesional.');
    this.name = 'AppointmentOverlapError';
  }
}

function getAppointmentsCollection() {
  return database.get<AppointmentModel>(TABLES.APPOINTMENTS);
}

function getServicesCollection() {
  return database.get<ServiceModel>(TABLES.SERVICES);
}

function assertCanCreate(profile: UserProfile): void {
  if (!canCreateAppointment(profile)) {
    throw new Error('Solo la cuenta owner puede crear turnos.');
  }
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Deriva la hora de fin sumando la duración del servicio a la de inicio.
 * Rechaza si cruza medianoche (el modelo no soporta turnos que cambian de día).
 */
function deriveEndTime(startTime: string, durationMinutes: number): string {
  const end = toMinutes(startTime) + durationMinutes;

  if (end >= 24 * 60) {
    throw new AppointmentValidationError([
      'El turno no puede terminar después de la medianoche. Elegí una hora más temprana.',
    ]);
  }

  return minutesToTime(end);
}

type NormalizedDraft = {
  date: string;
  startTime: string;
  endTime: string;
  serviceId: string;
  workerId: string;
  clientId: string;
  notes?: string;
};

async function normalizeDraft(
  profile: UserProfile,
  draft: AppointmentDraft
): Promise<NormalizedDraft> {
  const date = draft.date.trim();
  const startTime = draft.startTime.trim();
  const notes = draft.notes?.trim();
  const errors: string[] = [];

  if (!DATE_PATTERN.test(date)) {
    errors.push('La fecha debe tener el formato AAAA-MM-DD.');
  }

  if (!TIME_PATTERN.test(startTime)) {
    errors.push('La hora de inicio debe tener el formato HH:mm (00:00 a 23:59).');
  }

  if (!draft.serviceId) {
    errors.push('Elegí un servicio.');
  }

  if (!draft.workerId) {
    errors.push('Elegí un profesional.');
  }

  if (!draft.clientId) {
    errors.push('Elegí un cliente.');
  }

  if (errors.length > 0) {
    throw new AppointmentValidationError([...new Set(errors)]);
  }

  const service = await getServicesCollection().find(draft.serviceId);

  if (service.businessId !== profile.business_id || service.isDeleted) {
    throw new AppointmentValidationError([
      'El servicio no existe o no pertenece al negocio actual.',
    ]);
  }

  const endTime = deriveEndTime(startTime, service.durationMinutes);

  return {
    date,
    startTime,
    endTime,
    serviceId: draft.serviceId,
    workerId: draft.workerId,
    clientId: draft.clientId,
    notes: notes && notes.length > 0 ? notes : undefined,
  };
}

function toOverlapShape(
  record: AppointmentModel
): Pick<Appointment, 'id' | 'start_time' | 'end_time' | 'status'> {
  return {
    id: record.id,
    start_time: record.startTime,
    end_time: record.endTime,
    status: record.status,
  };
}

/**
 * Validación local de solapamiento (R8.1) con los turnos del mismo worker en la
 * misma fecha. Ignora cancelados y el propio turno al editar (excludeId). El
 * servidor revalida transaccionalmente al push; esta comprobación es UX temprana.
 */
async function assertNoLocalOverlap(
  profile: UserProfile,
  normalized: NormalizedDraft,
  excludeId?: string
): Promise<void> {
  const sameWorkerSameDay = await getAppointmentsCollection()
    .query(
      Q.where('business_id', profile.business_id),
      Q.where('worker_id', normalized.workerId),
      Q.where('date', normalized.date),
      Q.where('is_deleted', false)
    )
    .fetch();

  const conflicts = validateNoOverlap(
    sameWorkerSameDay.map(toOverlapShape),
    { start_time: normalized.startTime, end_time: normalized.endTime },
    excludeId
  );

  if (conflicts.length > 0) {
    throw new AppointmentOverlapError(
      conflicts.map((conflict) => ({
        id: conflict.id,
        start_time: conflict.start_time,
        end_time: conflict.end_time,
      }))
    );
  }
}

function assertAppointmentBelongsToProfile(
  appointment: AppointmentModel,
  profile: UserProfile
): void {
  if (appointment.businessId !== profile.business_id || appointment.isDeleted) {
    throw new Error('El turno no existe o no pertenece al negocio actual.');
  }
}

/**
 * Observa los turnos activos del negocio para una fecha, ordenados por hora de
 * inicio. Un worker solo ve los suyos (el pull remoto ya filtra, y acá se refuerza).
 */
export function observeAppointmentsForDay(profile: UserProfile, date: string) {
  const clauses = [
    Q.where('business_id', profile.business_id),
    Q.where('date', date),
    Q.where('is_deleted', false),
    Q.sortBy('start_time', Q.asc),
  ];

  if (profile.role === 'worker' && profile.worker_id) {
    clauses.splice(2, 0, Q.where('worker_id', profile.worker_id));
  }

  return getAppointmentsCollection().query(...clauses).observe();
}

export async function getAppointment(
  profile: UserProfile,
  appointmentId: string
): Promise<AppointmentModel> {
  const appointment = await getAppointmentsCollection().find(appointmentId);
  assertAppointmentBelongsToProfile(appointment, profile);

  if (profile.role === 'worker' && appointment.workerId !== profile.worker_id) {
    throw new Error('El turno no existe o no pertenece al negocio actual.');
  }

  return appointment;
}

export async function createAppointment(
  profile: UserProfile,
  draft: AppointmentDraft
): Promise<AppointmentModel> {
  assertCanCreate(profile);
  const normalized = await normalizeDraft(profile, draft);
  await assertNoLocalOverlap(profile, normalized);
  const id = generateUuidV7();

  return database.write(async () =>
    getAppointmentsCollection().create((appointment) => {
      // Watermelon debe usar el mismo UUID que PostgreSQL; el alta viaja en `created`.
      appointment._raw.id = id;
      appointment.businessId = profile.business_id;
      appointment.date = normalized.date;
      appointment.startTime = normalized.startTime;
      appointment.endTime = normalized.endTime;
      appointment.status = 'scheduled';
      appointment.serviceId = normalized.serviceId;
      appointment.workerId = normalized.workerId;
      appointment.clientId = normalized.clientId;
      appointment.notes = normalized.notes;
      appointment.isDeleted = false;
      appointment.updatedAt = Date.now();
      // El servidor reemplaza este valor por su cursor autoritativo en el primer pull.
      appointment.syncVersion = 0;
    })
  );
}

export async function updateAppointment(
  profile: UserProfile,
  appointmentId: string,
  draft: AppointmentDraft
): Promise<AppointmentModel> {
  const appointment = await getAppointment(profile, appointmentId);

  if (!canEditAppointment(profile, toAppointment(appointment))) {
    throw new Error('Solo la cuenta owner puede editar turnos.');
  }

  const normalized = await normalizeDraft(profile, draft);
  await assertNoLocalOverlap(profile, normalized, appointmentId);

  return database.write(async () =>
    appointment.update((record) => {
      assertAppointmentBelongsToProfile(record, profile);
      record.date = normalized.date;
      record.startTime = normalized.startTime;
      record.endTime = normalized.endTime;
      record.serviceId = normalized.serviceId;
      record.workerId = normalized.workerId;
      record.clientId = normalized.clientId;
      record.notes = normalized.notes;
      record.updatedAt = Date.now();
    })
  );
}

/**
 * Cancelar es una transición de estado (status='cancelled'), NO un soft delete.
 * Conserva el turno visible (tachado) en la agenda y libera el slot en la
 * exclusión GiST del servidor (el índice ignora status='cancelled').
 */
export async function cancelAppointment(
  profile: UserProfile,
  appointmentId: string
): Promise<AppointmentModel> {
  const appointment = await getAppointment(profile, appointmentId);

  if (!canCancelAppointment(profile, toAppointment(appointment))) {
    throw new Error('Solo la cuenta owner puede cancelar turnos.');
  }

  return database.write(async () =>
    appointment.update((record) => {
      assertAppointmentBelongsToProfile(record, profile);
      record.status = 'cancelled';
      record.updatedAt = Date.now();
    })
  );
}

/** Adapta un modelo local al tipo de dominio de @turnos/core (para permisos). */
function toAppointment(record: AppointmentModel): Appointment {
  return {
    id: record.id,
    business_id: record.businessId,
    date: record.date,
    start_time: record.startTime,
    end_time: record.endTime,
    status: record.status,
    service_id: record.serviceId,
    worker_id: record.workerId,
    client_id: record.clientId,
    notes: record.notes,
    updated_at: record.updatedAt,
    sync_version: record.syncVersion,
    is_deleted: record.isDeleted,
  };
}

export type SlotConflict = {
  id: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
};

export type SlotPreflightResult = {
  valid: boolean;
  conflicts: SlotConflict[];
};

/**
 * Preflight ONLINE opcional contra la Edge Function `validate-slot` (usa el
 * token del usuario, sin service role). Es un chequeo de conveniencia: la app
 * es offline-first, así que si falla la red se devuelve null y la validación
 * autoritativa queda en el push. No sustituye assertNoLocalOverlap.
 */
export async function preflightSlot(
  accessToken: string,
  input: {
    workerId: string;
    date: string;
    startTime: string;
    endTime: string;
    excludeId?: string | null;
  }
): Promise<SlotPreflightResult | null> {
  if (!validateSlotEndpoint) {
    return null;
  }

  try {
    const response = await fetch(validateSlotEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        worker_id: input.workerId,
        date: input.date,
        start_time: input.startTime,
        end_time: input.endTime,
        exclude_id: input.excludeId ?? null,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as SlotPreflightResult;
    return data;
  } catch {
    // Sin red o error de servidor: la operación offline continúa igual.
    return null;
  }
}
