import type { BusinessConfig, Worker } from './types';

/**
 * Indica si el negocio usa el sistema de comisiones. La feature es opcional y
 * está apagada por defecto; cuando está apagada, el llamador debe omitir el
 * cálculo de comisiones y no mostrar la vista de comisiones ni el dashboard.
 */
export function areCommissionsEnabled(
  config: Pick<BusinessConfig, 'commissions_enabled'>
): boolean {
  return config.commissions_enabled === true;
}

/**
 * Turno finalizado de un trabajador, ya enriquecido con los datos que el cálculo
 * de comisión necesita. El repositorio de la app arma esta forma leyendo el turno,
 * su recaudado (sumCollectedInBaseCurrency sobre los pagos) y la cantidad de
 * servicios de la tabla puente appointment_services. El cálculo es puro: no accede
 * a la base ni resuelve agregaciones por sí mismo.
 */
export type CommissionableAppointment = {
  appointment_id: string;
  /** Lo recaudado del turno convertido a la moneda base (entero, unidad mínima). */
  collected_in_base: number;
  /** Cantidad de servicios del turno (filas activas de la tabla puente). */
  service_count: number;
};

/** Parte de comisión de un turno individual dentro del total del período. */
export type CommissionLine = {
  appointment_id: string;
  collected_in_base: number;
  service_count: number;
  /** Comisión del turno en la moneda base (entero, unidad mínima). */
  commission: number;
};

/** Comisión de un trabajador en un período. */
export type WorkerCommission = {
  worker_id: string;
  commission_type: Worker['commission_type'];
  commission_value: number;
  /** Suma recaudada de los turnos del período, en moneda base (entero). */
  total_collected_in_base: number;
  /** Comisión total del período, en moneda base (entero, unidad mínima). */
  total_commission: number;
  lines: CommissionLine[];
};

/**
 * Calcula la comisión de un trabajador sobre sus turnos finalizados del período.
 * Dos modelos:
 *
 *  - percentage: la comisión de cada turno es un porcentaje de lo recaudado
 *    (collected_in_base * value / 100), redondeado a entero de la unidad mínima.
 *    El porcentaje se aplica sobre lo efectivamente cobrado, no sobre un precio
 *    de lista.
 *
 *  - fixed_per_service: la comisión de cada turno es el monto fijo del trabajador
 *    multiplicado por la cantidad de servicios del turno (value * service_count),
 *    independiente de lo recaudado.
 *
 * Los montos son enteros en la unidad mínima (nunca flotantes). Precondición de
 * fixed_per_service: commission_value y collected_in_base ya están expresados en
 * la moneda base del negocio; si el trabajador cobra la comisión fija en otra
 * moneda, la conversión debe resolverse antes (ver isFixedCommissionCurrencyConsistent).
 */
export function calculateWorkerCommission(
  worker: Pick<Worker, 'id' | 'commission_type' | 'commission_value'>,
  appointments: CommissionableAppointment[]
): WorkerCommission {
  const lines: CommissionLine[] = appointments.map((appt) => {
    const commission =
      worker.commission_type === 'percentage'
        ? Math.round((appt.collected_in_base * worker.commission_value) / 100)
        : worker.commission_value * appt.service_count;

    return {
      appointment_id: appt.appointment_id,
      collected_in_base: appt.collected_in_base,
      service_count: appt.service_count,
      commission,
    };
  });

  const total_commission = lines.reduce((sum, line) => sum + line.commission, 0);
  const total_collected_in_base = appointments.reduce(
    (sum, appt) => sum + appt.collected_in_base,
    0
  );

  return {
    worker_id: worker.id,
    commission_type: worker.commission_type,
    commission_value: worker.commission_value,
    total_collected_in_base,
    total_commission,
    lines,
  };
}

/**
 * Verifica que la comisión fija de un trabajador se pueda sumar en la moneda base
 * sin ambigüedad. Para percentage siempre es consistente (la comisión hereda la
 * moneda del recaudado base). Para fixed_per_service la moneda fija del trabajador
 * debe coincidir con la base del negocio; si no, el llamador debe resolver el tipo
 * de cambio antes de agregar, y mientras tanto señalar el caso en vez de sumar
 * monedas distintas como si fueran iguales.
 */
export function isFixedCommissionCurrencyConsistent(
  worker: Pick<Worker, 'commission_type' | 'commission_currency'>,
  baseCurrency: string
): boolean {
  if (worker.commission_type === 'percentage') {
    return true;
  }
  const workerCurrency = worker.commission_currency?.trim().toUpperCase();
  const base = baseCurrency.trim().toUpperCase();
  return Boolean(workerCurrency && workerCurrency === base);
}

/** Resumen del dashboard del owner para un período. */
export type DashboardSummary = {
  /** Turnos finalizados considerados en el período. */
  completed_appointments: number;
  /** Total recaudado en el período, en moneda base (entero, unidad mínima). */
  total_collected_in_base: number;
  /** Total de comisiones del período, en moneda base (entero, unidad mínima). */
  total_commissions: number;
  /** Recaudado menos comisiones, en moneda base (entero, unidad mínima). */
  net_in_base: number;
  /** Comisión por trabajador del período. */
  per_worker: WorkerCommission[];
};

/**
 * Agrega las comisiones de todos los trabajadores del período en un resumen para
 * el dashboard del owner. Suma informativa: recaudado, comisiones y neto, todo en
 * la moneda base y en enteros de la unidad mínima.
 */
export function buildDashboardSummary(
  perWorker: WorkerCommission[]
): DashboardSummary {
  const total_collected_in_base = perWorker.reduce(
    (sum, w) => sum + w.total_collected_in_base,
    0
  );
  const total_commissions = perWorker.reduce((sum, w) => sum + w.total_commission, 0);
  const completed_appointments = perWorker.reduce((sum, w) => sum + w.lines.length, 0);

  return {
    completed_appointments,
    total_collected_in_base,
    total_commissions,
    net_in_base: total_collected_in_base - total_commissions,
    per_worker: perWorker,
  };
}
