import { describe, it, expect } from 'vitest';
import {
  areCommissionsEnabled,
  calculateWorkerCommission,
  isFixedCommissionCurrencyConsistent,
  buildDashboardSummary,
  type CommissionableAppointment,
  type WorkerCommission,
} from './commissions';

describe('areCommissionsEnabled', () => {
  it('es true cuando el negocio tiene el flag activado', () => {
    expect(areCommissionsEnabled({ commissions_enabled: true })).toBe(true);
  });

  it('es false cuando el flag está apagado', () => {
    expect(areCommissionsEnabled({ commissions_enabled: false })).toBe(false);
  });
});

describe('calculateWorkerCommission', () => {
  it('calcula comisión por porcentaje sobre lo recaudado de cada turno', () => {
    const appts: CommissionableAppointment[] = [
      { appointment_id: 'a1', collected_in_base: 10000, service_count: 1 },
      { appointment_id: 'a2', collected_in_base: 5000, service_count: 2 },
    ];
    const result = calculateWorkerCommission(
      { id: 'w1', commission_type: 'percentage', commission_value: 40 },
      appts
    );
    expect(result.lines[0].commission).toBe(4000);
    expect(result.lines[1].commission).toBe(2000);
    expect(result.total_commission).toBe(6000);
    expect(result.total_collected_in_base).toBe(15000);
  });

  it('redondea la comisión por porcentaje a entero de la unidad mínima', () => {
    const result = calculateWorkerCommission(
      { id: 'w1', commission_type: 'percentage', commission_value: 33 },
      [{ appointment_id: 'a1', collected_in_base: 101, service_count: 1 }]
    );
    expect(result.total_commission).toBe(33);
  });

  it('calcula comisión fija por cantidad de servicios de cada turno', () => {
    const appts: CommissionableAppointment[] = [
      { appointment_id: 'a1', collected_in_base: 10000, service_count: 2 },
      { appointment_id: 'a2', collected_in_base: 0, service_count: 1 },
    ];
    const result = calculateWorkerCommission(
      { id: 'w2', commission_type: 'fixed_per_service', commission_value: 1500 },
      appts
    );
    expect(result.lines[0].commission).toBe(3000);
    expect(result.lines[1].commission).toBe(1500);
    expect(result.total_commission).toBe(4500);
  });

  it('la comisión fija es independiente de lo recaudado', () => {
    const result = calculateWorkerCommission(
      { id: 'w2', commission_type: 'fixed_per_service', commission_value: 1000 },
      [{ appointment_id: 'a1', collected_in_base: 0, service_count: 3 }]
    );
    expect(result.total_commission).toBe(3000);
  });

  it('devuelve totales en cero y sin líneas para un trabajador sin turnos', () => {
    const result = calculateWorkerCommission(
      { id: 'w1', commission_type: 'percentage', commission_value: 50 },
      []
    );
    expect(result.total_commission).toBe(0);
    expect(result.total_collected_in_base).toBe(0);
    expect(result.lines).toEqual([]);
  });

  it('porcentaje de un turno sin recaudado aporta 0', () => {
    const result = calculateWorkerCommission(
      { id: 'w1', commission_type: 'percentage', commission_value: 40 },
      [{ appointment_id: 'a1', collected_in_base: 0, service_count: 1 }]
    );
    expect(result.total_commission).toBe(0);
  });
});

describe('isFixedCommissionCurrencyConsistent', () => {
  it('percentage siempre es consistente', () => {
    expect(
      isFixedCommissionCurrencyConsistent(
        { commission_type: 'percentage', commission_currency: undefined },
        'ARS'
      )
    ).toBe(true);
  });

  it('fixed_per_service con moneda igual a la base es consistente', () => {
    expect(
      isFixedCommissionCurrencyConsistent(
        { commission_type: 'fixed_per_service', commission_currency: 'ARS' },
        'ARS'
      )
    ).toBe(true);
  });

  it('fixed_per_service con moneda distinta a la base no es consistente', () => {
    expect(
      isFixedCommissionCurrencyConsistent(
        { commission_type: 'fixed_per_service', commission_currency: 'USD' },
        'ARS'
      )
    ).toBe(false);
  });

  it('fixed_per_service sin moneda declarada no es consistente', () => {
    expect(
      isFixedCommissionCurrencyConsistent(
        { commission_type: 'fixed_per_service', commission_currency: undefined },
        'ARS'
      )
    ).toBe(false);
  });

  it('compara monedas ignorando el casing', () => {
    expect(
      isFixedCommissionCurrencyConsistent(
        { commission_type: 'fixed_per_service', commission_currency: 'ars' },
        'ARS'
      )
    ).toBe(true);
  });
});

describe('buildDashboardSummary', () => {
  it('agrega recaudado, comisiones y neto de todos los trabajadores', () => {
    const perWorker: WorkerCommission[] = [
      {
        worker_id: 'w1',
        commission_type: 'percentage',
        commission_value: 40,
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
    expect(summary.per_worker).toHaveLength(2);
  });

  it('devuelve ceros para un período sin trabajadores con turnos', () => {
    const summary = buildDashboardSummary([]);
    expect(summary.completed_appointments).toBe(0);
    expect(summary.total_collected_in_base).toBe(0);
    expect(summary.total_commissions).toBe(0);
    expect(summary.net_in_base).toBe(0);
    expect(summary.per_worker).toEqual([]);
  });
});
