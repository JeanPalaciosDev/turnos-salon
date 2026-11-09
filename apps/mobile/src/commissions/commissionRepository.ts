import { Q } from '@nozbe/watermelondb';
import {
  areCommissionsEnabled,
  buildDashboardSummary,
  calculateWorkerCommission,
  canViewCommissions,
  canViewDashboard,
  type CommissionableAppointment,
  type DashboardSummary,
  sumCollectedInBaseCurrency,
  type UserProfile,
  type WorkerCommission,
} from '@turnos/core';
import { TABLES } from '@turnos/models';

import { database } from '../database';
import {
  AppointmentModel,
  AppointmentServiceModel,
  BusinessConfigModel,
  PaymentModel,
  WorkerModel,
} from '../database/models';
import { getBusinessBaseCurrency } from '../services/serviceRepository';
import { getSupabaseClient } from '../lib/supabase';

/** Comisión de un trabajador del período, con su nombre para la UI. */
export type WorkerCommissionView = WorkerCommission & {
  worker_name: string;
};

/** Resumen del dashboard del período con los nombres de trabajadores resueltos. */
export type CommissionPeriodView = Omit<DashboardSummary, 'per_worker'> & {
  base_currency: string;
  per_worker: WorkerCommissionView[];
};

function assertCanView(profile: UserProfile): void {
  if (!canViewCommissions(profile) || !canViewDashboard(profile)) {
    throw new Error('Solo la cuenta owner puede ver las comisiones.');
  }
}

/** Lee el flag de comisiones del negocio (una vez). Apagado por defecto. */
export async function getCommissionsEnabled(profile: UserProfile): Promise<boolean> {
  try {
    const business = await database
      .get<BusinessConfigModel>(TABLES.BUSINESS_CONFIG)
      .find(profile.business_id);
    return business._getRaw('commissions_enabled') === true;
  } catch {
    return false;
  }
}

/**
 * Activa o desactiva el sistema de comisiones del negocio. business_config no es
 * mutable por el push genérico, así que el cambio va por la RPC dedicada
 * set_commissions_enabled (owner-only, SECURITY DEFINER), con update local
 * optimista. El pull confirma el valor autoritativo. Requiere conexión.
 */
export async function setCommissionsEnabled(
  profile: UserProfile,
  enabled: boolean
): Promise<void> {
  assertCanView(profile);

  const { error } = await getSupabaseClient().rpc('set_commissions_enabled', {
    p_enabled: enabled,
  });

  if (error) {
    throw new Error(`No se pudo guardar la configuración de comisiones: ${error.message}`);
  }

  const business = await database
    .get<BusinessConfigModel>(TABLES.BUSINESS_CONFIG)
    .find(profile.business_id);

  await database.write(async () =>
    business.update((record) => {
      record._setRaw('commissions_enabled', enabled);
      record._setRaw('updated_at', Date.now());
    })
  );
}

/**
 * Calcula las comisiones del período para el owner. Un período es un rango de
 * fechas ISO "YYYY-MM-DD" inclusivo. Solo cuentan los turnos finalizados (done)
 * con trabajador asignado. Para cada turno se arma un CommissionableAppointment:
 * el recaudado en moneda base (sumCollectedInBaseCurrency sobre sus cobros) y la
 * cantidad de servicios (filas activas de la tabla puente). El cálculo de la
 * comisión por trabajador y la agregación del dashboard viven en @turnos/core.
 *
 * Lectura puntual (no reactiva): cruza turnos + cobros + tabla puente y filtra
 * por rango, fuera del alcance de una query observable simple.
 */
export async function getCommissionsForPeriod(
  profile: UserProfile,
  startIso: string,
  endIso: string
): Promise<CommissionPeriodView> {
  assertCanView(profile);

  const baseCurrency = await getBusinessBaseCurrency(profile);

  const [appointments, workers] = await Promise.all([
    database
      .get<AppointmentModel>(TABLES.APPOINTMENTS)
      .query(
        Q.where('business_id', profile.business_id),
        Q.where('is_deleted', false),
        Q.where('status', 'done'),
        Q.where('date', Q.gte(startIso)),
        Q.where('date', Q.lte(endIso))
      )
      .fetch(),
    database
      .get<WorkerModel>(TABLES.WORKERS)
      .query(Q.where('business_id', profile.business_id), Q.where('is_deleted', false))
      .fetch(),
  ]);

  const assigned = appointments.filter((a) => a.workerId);
  const appointmentIds = assigned.map((a) => a.id);

  const [payments, bridges] = await Promise.all([
    appointmentIds.length > 0
      ? database
          .get<PaymentModel>(TABLES.PAYMENTS)
          .query(
            Q.where('business_id', profile.business_id),
            Q.where('is_deleted', false),
            Q.where('appointment_id', Q.oneOf(appointmentIds))
          )
          .fetch()
      : Promise.resolve([] as PaymentModel[]),
    appointmentIds.length > 0
      ? database
          .get<AppointmentServiceModel>(TABLES.APPOINTMENT_SERVICES)
          .query(
            Q.where('business_id', profile.business_id),
            Q.where('is_deleted', false),
            Q.where('appointment_id', Q.oneOf(appointmentIds))
          )
          .fetch()
      : Promise.resolve([] as AppointmentServiceModel[]),
  ]);

  const paymentsByAppointment = new Map<string, PaymentModel[]>();
  for (const payment of payments) {
    const list = paymentsByAppointment.get(payment.appointmentId) ?? [];
    list.push(payment);
    paymentsByAppointment.set(payment.appointmentId, list);
  }

  const serviceCountByAppointment = new Map<string, number>();
  for (const bridge of bridges) {
    serviceCountByAppointment.set(
      bridge.appointmentId,
      (serviceCountByAppointment.get(bridge.appointmentId) ?? 0) + 1
    );
  }

  const commissionablesByWorker = new Map<string, CommissionableAppointment[]>();
  for (const appointment of assigned) {
    const workerId = appointment.workerId as string;
    const appointmentPayments = paymentsByAppointment.get(appointment.id) ?? [];
    const collected = sumCollectedInBaseCurrency(
      appointmentPayments.map((p) => ({
        amount: p.amount,
        currency: p.currency,
        exchange_rate: p.exchangeRate,
        is_deleted: p.isDeleted,
      })),
      baseCurrency
    );

    const entry: CommissionableAppointment = {
      appointment_id: appointment.id,
      collected_in_base: collected,
      service_count: serviceCountByAppointment.get(appointment.id) ?? 0,
    };

    const list = commissionablesByWorker.get(workerId) ?? [];
    list.push(entry);
    commissionablesByWorker.set(workerId, list);
  }

  const perWorker: WorkerCommissionView[] = [];
  for (const worker of workers) {
    const commissionables = commissionablesByWorker.get(worker.id);
    if (!commissionables || commissionables.length === 0) {
      continue;
    }
    const commission = calculateWorkerCommission(
      {
        id: worker.id,
        commission_type: worker.commissionType,
        commission_value: worker.commissionValue,
      },
      commissionables
    );
    perWorker.push({ ...commission, worker_name: worker.name });
  }

  const summary = buildDashboardSummary(perWorker);

  return {
    completed_appointments: summary.completed_appointments,
    total_collected_in_base: summary.total_collected_in_base,
    total_commissions: summary.total_commissions,
    net_in_base: summary.net_in_base,
    base_currency: baseCurrency,
    per_worker: perWorker,
  };
}

/** Reexport de la guarda de dominio para consumo directo desde la UI. */
export { areCommissionsEnabled };
