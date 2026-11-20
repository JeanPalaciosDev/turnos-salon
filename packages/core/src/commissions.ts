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
 * Regla de comisión: un porcentaje de lo recaudado o un monto fijo por servicio
 * prestado. Es la misma forma tanto para la regla por defecto del trabajador
 * como para una excepción por servicio.
 */
export type CommissionRule = {
  commission_type: Worker['commission_type'];
  /** Porcentaje (0–100) o monto fijo entero en la unidad mínima. */
  commission_value: number;
  /** Solo para fixed_per_service: moneda ISO del monto fijo. */
  commission_currency?: string;
};

/**
 * Configuración de comisión de un trabajador: una regla por defecto y, opcional,
 * excepciones por servicio. La regla más específica gana: si el servicio tiene
 * excepción se usa esa, si no la regla por defecto.
 */
export type WorkerCommissionConfig = {
  worker_id: string;
  default_rule: CommissionRule;
  /** Excepciones indexadas por service_id. */
  overrides?: Record<string, CommissionRule>;
};

/** Servicio prestado en un turno, con su precio snapshot de la tabla puente. */
export type CommissionableServiceLine = {
  service_id: string;
  /** Precio snapshot en moneda base y unidad mínima. Pondera el reparto. */
  price_in_base: number;
};

/**
 * Turno finalizado de un trabajador, ya enriquecido con los datos que el cálculo
 * de comisión necesita. El repositorio de la app arma esta forma leyendo el turno,
 * su recaudado (sumCollectedInBaseCurrency sobre los pagos) y los servicios de la
 * tabla puente appointment_services. El cálculo es puro: no accede a la base ni
 * resuelve agregaciones por sí mismo.
 */
export type CommissionableAppointment = {
  appointment_id: string;
  /** Lo recaudado del turno convertido a la moneda base (entero, unidad mínima). */
  collected_in_base: number;
  /** Servicios del turno. Vacío si el turno no tiene filas puente. */
  services: CommissionableServiceLine[];
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
  /** Cantidad de servicios del período con una excepción aplicada. */
  overridden_service_count: number;
  /** Suma recaudada de los turnos del período, en moneda base (entero). */
  total_collected_in_base: number;
  /** Comisión total del período, en moneda base (entero, unidad mínima). */
  total_commission: number;
  lines: CommissionLine[];
};

/**
 * Reparte un monto entero entre varios pesos sin perder ni inventar unidades:
 * la suma de las partes es siempre exactamente `total`. Reparte por el método
 * del resto mayor, y si todos los pesos son 0 (o no hay precios snapshot)
 * divide en partes iguales.
 */
export function apportionAmount(total: number, weights: number[]): number[] {
  if (weights.length === 0) {
    return [];
  }

  const weightSum = weights.reduce((sum, w) => sum + Math.max(w, 0), 0);
  const safeWeights =
    weightSum > 0 ? weights.map((w) => Math.max(w, 0)) : weights.map(() => 1);
  const safeSum = weightSum > 0 ? weightSum : weights.length;

  const parts = safeWeights.map((w) => Math.floor((total * w) / safeSum));
  let remainder = total - parts.reduce((sum, p) => sum + p, 0);

  // El resto se reparte de a una unidad, empezando por los pesos más grandes,
  // para que la suma cierre exactamente contra el total.
  const order = safeWeights
    .map((w, index) => ({ w, index }))
    .sort((a, b) => b.w - a.w || a.index - b.index);

  let cursor = 0;
  while (remainder > 0 && order.length > 0) {
    parts[order[cursor % order.length].index] += 1;
    remainder -= 1;
    cursor += 1;
  }

  return parts;
}

/** Devuelve la regla que aplica a un servicio: la excepción si existe, si no la por defecto. */
export function resolveCommissionRule(
  config: WorkerCommissionConfig,
  serviceId: string
): CommissionRule {
  return config.overrides?.[serviceId] ?? config.default_rule;
}

/**
 * Calcula la comisión de un trabajador sobre sus turnos finalizados del período,
 * aplicando por cada servicio la regla que le corresponde (excepción por servicio
 * si existe, si no la regla por defecto del trabajador).
 *
 *  - percentage: porcentaje de lo recaudado. Cuando el turno tiene varios
 *    servicios, lo recaudado se reparte entre ellos en proporción a su precio
 *    snapshot (apportionAmount) y cada parte se multiplica por su propio
 *    porcentaje. Así un turno puede combinar porcentajes distintos.
 *  - fixed_per_service: monto fijo por cada servicio prestado, sin importar lo
 *    recaudado.
 *
 * Los porcentajes se acumulan como numerador entero y se redondean UNA vez por
 * turno, así no se acumula error de redondeo servicio por servicio. Sin
 * excepciones y con una sola regla, el resultado es idéntico al de aplicar el
 * porcentaje directamente sobre el total recaudado.
 *
 * Un turno sin filas puente (sin servicios registrados) aporta el porcentaje de
 * la regla por defecto sobre lo recaudado, y nada en el modelo de monto fijo.
 */
export function calculateWorkerCommission(
  config: WorkerCommissionConfig,
  appointments: CommissionableAppointment[]
): WorkerCommission {
  let overriddenServiceCount = 0;

  const lines: CommissionLine[] = appointments.map((appt) => {
    let percentageNumerator = 0;
    let fixedTotal = 0;

    if (appt.services.length === 0) {
      if (config.default_rule.commission_type === 'percentage') {
        percentageNumerator += appt.collected_in_base * config.default_rule.commission_value;
      }
    } else {
      const shares = apportionAmount(
        appt.collected_in_base,
        appt.services.map((s) => s.price_in_base)
      );

      appt.services.forEach((service, index) => {
        const override = config.overrides?.[service.service_id];
        if (override) {
          overriddenServiceCount += 1;
        }
        const rule = override ?? config.default_rule;

        if (rule.commission_type === 'percentage') {
          percentageNumerator += shares[index] * rule.commission_value;
        } else {
          fixedTotal += rule.commission_value;
        }
      });
    }

    return {
      appointment_id: appt.appointment_id,
      collected_in_base: appt.collected_in_base,
      service_count: appt.services.length,
      commission: Math.round(percentageNumerator / 100) + fixedTotal,
    };
  });

  const total_commission = lines.reduce((sum, line) => sum + line.commission, 0);
  const total_collected_in_base = appointments.reduce(
    (sum, appt) => sum + appt.collected_in_base,
    0
  );

  return {
    worker_id: config.worker_id,
    commission_type: config.default_rule.commission_type,
    commission_value: config.default_rule.commission_value,
    overridden_service_count: overriddenServiceCount,
    total_collected_in_base,
    total_commission,
    lines,
  };
}

/**
 * Valida una regla de comisión de forma intrínseca: valor entero no negativo,
 * porcentaje que no supere 100 y, para monto fijo, moneda ISO de tres letras.
 * Mismas reglas que validateWorker, reutilizables para las excepciones por
 * servicio.
 */
export function validateCommissionRule(rule: {
  commission_type?: string;
  commission_value?: number;
  commission_currency?: string;
}): string[] {
  const errors: string[] = [];

  if (
    !rule.commission_type ||
    !['percentage', 'fixed_per_service'].includes(rule.commission_type)
  ) {
    errors.push('El tipo de comisión debe ser "percentage" o "fixed_per_service"');
  }

  if (
    rule.commission_value == null ||
    !Number.isSafeInteger(rule.commission_value) ||
    rule.commission_value < 0
  ) {
    errors.push('El valor de comisión debe ser un número entero de 0 o mayor');
  }

  if (
    rule.commission_type === 'percentage' &&
    rule.commission_value != null &&
    rule.commission_value > 100
  ) {
    errors.push('El porcentaje de comisión no puede superar 100');
  }

  if (rule.commission_type === 'fixed_per_service') {
    const currency = rule.commission_currency?.trim().toUpperCase();
    if (!currency || !/^[A-Z]{3}$/.test(currency)) {
      errors.push(
        'La comisión fija necesita una moneda con código ISO de tres letras, por ejemplo ARS'
      );
    }
  }

  return errors;
}

/**
 * Verifica que todas las reglas de monto fijo de un trabajador (la por defecto y
 * sus excepciones) estén expresadas en la moneda base del negocio, para poder
 * sumarlas sin ambigüedad. Las reglas de porcentaje siempre son consistentes
 * porque heredan la moneda del recaudado. Si una regla fija está en otra moneda,
 * el llamador debe resolver el tipo de cambio antes de agregar en vez de sumar
 * monedas distintas como si fueran iguales.
 */
export function isFixedCommissionCurrencyConsistent(
  config: Pick<WorkerCommissionConfig, 'default_rule' | 'overrides'>,
  baseCurrency: string
): boolean {
  const base = baseCurrency.trim().toUpperCase();
  const rules = [config.default_rule, ...Object.values(config.overrides ?? {})];

  return rules.every((rule) => {
    if (rule.commission_type === 'percentage') {
      return true;
    }
    const currency = rule.commission_currency?.trim().toUpperCase();
    return Boolean(currency && currency === base);
  });
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
