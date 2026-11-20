import { describe, it, expect } from 'vitest';
import {
  apportionAmount,
  areCommissionsEnabled,
  buildDashboardSummary,
  calculateWorkerCommission,
  isFixedCommissionCurrencyConsistent,
  resolveCommissionRule,
  validateCommissionRule,
  type CommissionableAppointment,
  type WorkerCommission,
  type WorkerCommissionConfig,
} from './commissions';

const pct = (value: number): WorkerCommissionConfig['default_rule'] => ({
  commission_type: 'percentage',
  commission_value: value,
});

const fixed = (value: number, currency = 'ARS'): WorkerCommissionConfig['default_rule'] => ({
  commission_type: 'fixed_per_service',
  commission_value: value,
  commission_currency: currency,
});

/** Turno de un solo servicio, el caso más común. */
function singleService(
  id: string,
  collected: number,
  serviceId = 's1',
  price = collected
): CommissionableAppointment {
  return {
    appointment_id: id,
    collected_in_base: collected,
    services: [{ service_id: serviceId, price_in_base: price }],
  };
}

describe('areCommissionsEnabled', () => {
  it('es true cuando el negocio tiene el flag activado', () => {
    expect(areCommissionsEnabled({ commissions_enabled: true })).toBe(true);
  });

  it('es false cuando el flag está apagado', () => {
    expect(areCommissionsEnabled({ commissions_enabled: false })).toBe(false);
  });
});

describe('apportionAmount', () => {
  it('reparte en proporción a los pesos', () => {
    expect(apportionAmount(10000, [6000, 4000])).toEqual([6000, 4000]);
  });

  it('la suma de las partes es siempre el total, aun con restos', () => {
    const parts = apportionAmount(100, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(parts).toEqual([34, 33, 33]);
  });

  it('divide en partes iguales si todos los pesos son cero', () => {
    expect(apportionAmount(900, [0, 0, 0])).toEqual([300, 300, 300]);
  });

  it('devuelve arreglo vacío sin servicios', () => {
    expect(apportionAmount(500, [])).toEqual([]);
  });

  it('un solo servicio se lleva todo', () => {
    expect(apportionAmount(4500, [999])).toEqual([4500]);
  });
});

describe('calculateWorkerCommission', () => {
  it('calcula comisión por porcentaje sobre lo recaudado de cada turno', () => {
    const result = calculateWorkerCommission(
      { worker_id: 'w1', default_rule: pct(40) },
      [singleService('a1', 10000), singleService('a2', 5000)]
    );
    expect(result.lines[0].commission).toBe(4000);
    expect(result.lines[1].commission).toBe(2000);
    expect(result.total_commission).toBe(6000);
    expect(result.total_collected_in_base).toBe(15000);
  });

  it('calcula comisión fija por cantidad de servicios del turno', () => {
    const appts: CommissionableAppointment[] = [
      {
        appointment_id: 'a1',
        collected_in_base: 10000,
        services: [
          { service_id: 's1', price_in_base: 6000 },
          { service_id: 's2', price_in_base: 4000 },
        ],
      },
    ];
    const result = calculateWorkerCommission(
      { worker_id: 'w2', default_rule: fixed(1500) },
      appts
    );
    expect(result.total_commission).toBe(3000);
  });

  it('la comisión fija es independiente de lo recaudado', () => {
    const result = calculateWorkerCommission({ worker_id: 'w2', default_rule: fixed(1000) }, [
      {
        appointment_id: 'a1',
        collected_in_base: 0,
        services: [
          { service_id: 's1', price_in_base: 100 },
          { service_id: 's2', price_in_base: 100 },
          { service_id: 's3', price_in_base: 100 },
        ],
      },
    ]);
    expect(result.total_commission).toBe(3000);
  });

  it('aplica la excepción por servicio en lugar de la regla por defecto', () => {
    const result = calculateWorkerCommission(
      {
        worker_id: 'w1',
        default_rule: pct(40),
        overrides: { s2: pct(50) },
      },
      [
        {
          appointment_id: 'a1',
          collected_in_base: 10000,
          services: [
            { service_id: 's1', price_in_base: 6000 },
            { service_id: 's2', price_in_base: 4000 },
          ],
        },
      ]
    );
    // 6000 al 40% = 2400, 4000 al 50% = 2000.
    expect(result.total_commission).toBe(4400);
    expect(result.overridden_service_count).toBe(1);
  });

  it('permite combinar porcentaje por defecto con una excepción de monto fijo', () => {
    const result = calculateWorkerCommission(
      {
        worker_id: 'w1',
        default_rule: pct(40),
        overrides: { s2: fixed(500) },
      },
      [
        {
          appointment_id: 'a1',
          collected_in_base: 10000,
          services: [
            { service_id: 's1', price_in_base: 6000 },
            { service_id: 's2', price_in_base: 4000 },
          ],
        },
      ]
    );
    // 6000 al 40% = 2400, mas 500 fijos del servicio con excepción.
    expect(result.total_commission).toBe(2900);
  });

  it('sin excepciones da el mismo total que aplicar el porcentaje al recaudado', () => {
    const appt: CommissionableAppointment = {
      appointment_id: 'a1',
      collected_in_base: 9999,
      services: [
        { service_id: 's1', price_in_base: 3333 },
        { service_id: 's2', price_in_base: 3333 },
        { service_id: 's3', price_in_base: 3333 },
      ],
    };
    const result = calculateWorkerCommission(
      { worker_id: 'w1', default_rule: pct(33) },
      [appt]
    );
    expect(result.total_commission).toBe(Math.round((9999 * 33) / 100));
  });

  it('un turno sin servicios registrados aporta el porcentaje por defecto', () => {
    const result = calculateWorkerCommission(
      { worker_id: 'w1', default_rule: pct(40) },
      [{ appointment_id: 'a1', collected_in_base: 10000, services: [] }]
    );
    expect(result.total_commission).toBe(4000);
    expect(result.lines[0].service_count).toBe(0);
  });

  it('un turno sin servicios no aporta nada en el modelo de monto fijo', () => {
    const result = calculateWorkerCommission(
      { worker_id: 'w2', default_rule: fixed(1500) },
      [{ appointment_id: 'a1', collected_in_base: 10000, services: [] }]
    );
    expect(result.total_commission).toBe(0);
  });

  it('devuelve totales en cero y sin líneas para un trabajador sin turnos', () => {
    const result = calculateWorkerCommission({ worker_id: 'w1', default_rule: pct(50) }, []);
    expect(result.total_commission).toBe(0);
    expect(result.total_collected_in_base).toBe(0);
    expect(result.lines).toEqual([]);
  });

  it('porcentaje de un turno sin recaudado aporta 0', () => {
    const result = calculateWorkerCommission({ worker_id: 'w1', default_rule: pct(40) }, [
      singleService('a1', 0, 's1', 5000),
    ]);
    expect(result.total_commission).toBe(0);
  });
});

describe('resolveCommissionRule', () => {
  const config: WorkerCommissionConfig = {
    worker_id: 'w1',
    default_rule: pct(40),
    overrides: { s2: pct(60) },
  };

  it('usa la excepción cuando el servicio la tiene', () => {
    expect(resolveCommissionRule(config, 's2').commission_value).toBe(60);
  });

  it('cae a la regla por defecto cuando el servicio no tiene excepción', () => {
    expect(resolveCommissionRule(config, 's1').commission_value).toBe(40);
  });
});

describe('validateCommissionRule', () => {
  it('acepta un porcentaje válido', () => {
    expect(validateCommissionRule({ commission_type: 'percentage', commission_value: 40 })).toEqual(
      []
    );
  });

  it('rechaza un porcentaje mayor a 100', () => {
    expect(
      validateCommissionRule({ commission_type: 'percentage', commission_value: 120 })
    ).toContain('El porcentaje de comisión no puede superar 100');
  });

  it('rechaza valores negativos o no enteros', () => {
    expect(
      validateCommissionRule({ commission_type: 'percentage', commission_value: -1 })
    ).toContain('El valor de comisión debe ser un número entero de 0 o mayor');
    expect(
      validateCommissionRule({ commission_type: 'percentage', commission_value: 10.5 })
    ).toContain('El valor de comisión debe ser un número entero de 0 o mayor');
  });

  it('exige moneda ISO en el monto fijo', () => {
    expect(
      validateCommissionRule({ commission_type: 'fixed_per_service', commission_value: 1500 })
    ).toContain(
      'La comisión fija necesita una moneda con código ISO de tres letras, por ejemplo ARS'
    );
    expect(
      validateCommissionRule({
        commission_type: 'fixed_per_service',
        commission_value: 1500,
        commission_currency: 'ARS',
      })
    ).toEqual([]);
  });

  it('rechaza un tipo desconocido', () => {
    expect(validateCommissionRule({ commission_type: 'otro', commission_value: 1 })).toContain(
      'El tipo de comisión debe ser "percentage" o "fixed_per_service"'
    );
  });
});

describe('isFixedCommissionCurrencyConsistent', () => {
  it('percentage siempre es consistente', () => {
    expect(isFixedCommissionCurrencyConsistent({ default_rule: pct(40) }, 'ARS')).toBe(true);
  });

  it('monto fijo en la moneda base es consistente', () => {
    expect(isFixedCommissionCurrencyConsistent({ default_rule: fixed(1500, 'ARS') }, 'ARS')).toBe(
      true
    );
  });

  it('monto fijo en otra moneda no es consistente', () => {
    expect(isFixedCommissionCurrencyConsistent({ default_rule: fixed(1500, 'USD') }, 'ARS')).toBe(
      false
    );
  });

  it('detecta una excepción fija en otra moneda', () => {
    expect(
      isFixedCommissionCurrencyConsistent(
        { default_rule: pct(40), overrides: { s2: fixed(10, 'USD') } },
        'ARS'
      )
    ).toBe(false);
  });

  it('compara monedas ignorando el casing', () => {
    expect(isFixedCommissionCurrencyConsistent({ default_rule: fixed(1500, 'ars') }, 'ARS')).toBe(
      true
    );
  });
});

describe('buildDashboardSummary', () => {
  it('agrega recaudado, comisiones y neto de todos los trabajadores', () => {
    const perWorker: WorkerCommission[] = [
      {
        worker_id: 'w1',
        commission_type: 'percentage',
        commission_value: 40,
        overridden_service_count: 0,
        total_collected_in_base: 10000,
        total_commission: 4000,
        lines: [
          { appointment_id: 'a1', collected_in_base: 10000, service_count: 1, commission: 4000 },
        ],
      },
      {
        worker_id: 'w2',
        commission_type: 'fixed_per_service',
        commission_value: 1500,
        overridden_service_count: 0,
        total_collected_in_base: 6000,
        total_commission: 3000,
        lines: [
          { appointment_id: 'a2', collected_in_base: 6000, service_count: 2, commission: 3000 },
        ],
      },
    ];
    const summary = buildDashboardSummary(perWorker);
    expect(summary.completed_appointments).toBe(2);
    expect(summary.total_collected_in_base).toBe(16000);
    expect(summary.total_commissions).toBe(7000);
    expect(summary.net_in_base).toBe(9000);
  });

  it('devuelve ceros para un período sin trabajadores con turnos', () => {
    const summary = buildDashboardSummary([]);
    expect(summary.completed_appointments).toBe(0);
    expect(summary.net_in_base).toBe(0);
    expect(summary.per_worker).toEqual([]);
  });
});
