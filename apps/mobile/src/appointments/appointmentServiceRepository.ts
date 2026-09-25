import { Q } from '@nozbe/watermelondb';
import type { UserProfile } from '@turnos/core';
import { TABLES } from '@turnos/models';

import { generateUuidV7 } from '../auth/uuid';
import { database } from '../database';
import { AppointmentServiceModel, ServiceModel } from '../database/models';

function getBridgeCollection() {
  return database.get<AppointmentServiceModel>(TABLES.APPOINTMENT_SERVICES);
}

function getServicesCollection() {
  return database.get<ServiceModel>(TABLES.SERVICES);
}

/** Observa los servicios (filas puente activas) de un turno. */
export function observeAppointmentServices(profile: UserProfile, appointmentId: string) {
  return getBridgeCollection()
    .query(
      Q.where('business_id', profile.business_id),
      Q.where('appointment_id', appointmentId),
      Q.where('is_deleted', false)
    )
    .observe();
}

/** Lee las filas puente de un turno (una sola vez). */
export async function getAppointmentServices(
  profile: UserProfile,
  appointmentId: string
): Promise<AppointmentServiceModel[]> {
  return getBridgeCollection()
    .query(
      Q.where('business_id', profile.business_id),
      Q.where('appointment_id', appointmentId),
      Q.where('is_deleted', false)
    )
    .fetch();
}

/**
 * Reemplaza el conjunto de servicios de un turno: da de baja lógica los que ya
 * no están y crea los nuevos, tomando un snapshot de duración/precio del servicio
 * al momento. Devuelve la duración total (suma de duraciones) para derivar el
 * end_time del turno.
 */
export async function setAppointmentServices(
  profile: UserProfile,
  appointmentId: string,
  serviceIds: string[]
): Promise<{ totalDurationMinutes: number }> {
  const services = await getServicesCollection()
    .query(Q.where('business_id', profile.business_id), Q.where('is_deleted', false))
    .fetch();
  const byId = new Map(services.map((s) => [s.id, s]));

  const existing = await getAppointmentServices(profile, appointmentId);
  const existingByServiceId = new Map(existing.map((row) => [row.serviceId, row]));

  const desired = new Set(serviceIds);
  let totalDurationMinutes = 0;

  await database.write(async () => {
    // Baja lógica de los que ya no están.
    for (const row of existing) {
      if (!desired.has(row.serviceId)) {
        await row.update((r) => {
          r.isDeleted = true;
          r.updatedAt = Date.now();
        });
      }
    }

    // Alta de los nuevos (los ya presentes se conservan).
    for (const serviceId of serviceIds) {
      const service = byId.get(serviceId);
      if (service) totalDurationMinutes += service.durationMinutes;

      if (existingByServiceId.has(serviceId)) continue;

      const id = generateUuidV7();
      await getBridgeCollection().create((row) => {
        row._raw.id = id;
        row.businessId = profile.business_id;
        row.appointmentId = appointmentId;
        row.serviceId = serviceId;
        row.durationMinutes = service?.durationMinutes;
        row.priceAmount = service?.defaultPriceAmount;
        row.priceCurrency = service?.defaultPriceCurrency;
        row.isDeleted = false;
        row.updatedAt = Date.now();
        row.syncVersion = 0;
      });
    }
  });

  return { totalDurationMinutes };
}
