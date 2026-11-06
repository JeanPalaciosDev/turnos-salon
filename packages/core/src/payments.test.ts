import { describe, it, expect } from 'vitest';
import { validatePayment, sumCollectedInBaseCurrency } from './payments';

describe('validatePayment', () => {
  it('acepta un pago en la moneda base sin tipo de cambio', () => {
    expect(
      validatePayment({ amount: 4500, method: 'cash', currency: 'ARS' }, 'ARS')
    ).toEqual([]);
  });

  it('rechaza monto no entero, cero o negativo', () => {
    expect(
      validatePayment({ amount: 0, method: 'cash', currency: 'ARS' }, 'ARS')
    ).toContain('El monto debe ser un entero mayor a 0 en la unidad mínima');
    expect(
      validatePayment({ amount: -100, method: 'cash', currency: 'ARS' }, 'ARS')
    ).toContain('El monto debe ser un entero mayor a 0 en la unidad mínima');
    expect(
      validatePayment({ amount: 45.5, method: 'cash', currency: 'ARS' }, 'ARS')
    ).toContain('El monto debe ser un entero mayor a 0 en la unidad mínima');
  });

  it('rechaza monto ausente', () => {
    expect(validatePayment({ method: 'cash', currency: 'ARS' }, 'ARS')).toContain(
      'El monto debe ser un entero mayor a 0 en la unidad mínima'
    );
  });

  it('rechaza método inválido o ausente', () => {
    expect(
      validatePayment({ amount: 4500, method: 'crypto', currency: 'ARS' }, 'ARS')
    ).toContain('El método de pago debe ser efectivo, tarjeta, transferencia u otro');
    expect(validatePayment({ amount: 4500, currency: 'ARS' }, 'ARS')).toContain(
      'El método de pago debe ser efectivo, tarjeta, transferencia u otro'
    );
  });

  it('acepta los cuatro métodos válidos', () => {
    for (const method of ['cash', 'card', 'transfer', 'other'] as const) {
      expect(validatePayment({ amount: 4500, method, currency: 'ARS' }, 'ARS')).toEqual([]);
    }
  });

  it('rechaza moneda con formato no ISO de 3 letras', () => {
    expect(
      validatePayment({ amount: 4500, method: 'cash', currency: 'PES' }, 'PES')
    ).toEqual([]);
    expect(
      validatePayment({ amount: 4500, method: 'cash', currency: 'US' }, 'ARS')
    ).toContain('La moneda debe usar un código ISO de tres letras, por ejemplo ARS');
  });

  it('exige tipo de cambio y moneda base cuando la moneda del pago difiere de la base', () => {
    const errors = validatePayment(
      { amount: 4500, method: 'cash', currency: 'USD' },
      'ARS'
    );
    expect(errors).toContain(
      'Un pago en moneda distinta a la base necesita un tipo de cambio mayor a 0'
    );
    expect(errors).toContain(
      'Un pago en moneda distinta a la base necesita la moneda base del tipo de cambio'
    );
  });

  it('acepta un pago en otra moneda con tipo de cambio y moneda base válidos', () => {
    expect(
      validatePayment(
        {
          amount: 4500,
          method: 'card',
          currency: 'USD',
          exchange_rate: 1200,
          exchange_base_currency: 'ARS',
        },
        'ARS'
      )
    ).toEqual([]);
  });

  it('rechaza tipo de cambio cero o negativo en moneda distinta a la base', () => {
    expect(
      validatePayment(
        {
          amount: 4500,
          method: 'card',
          currency: 'USD',
          exchange_rate: 0,
          exchange_base_currency: 'ARS',
        },
        'ARS'
      )
    ).toContain('Un pago en moneda distinta a la base necesita un tipo de cambio mayor a 0');
  });

  it('no exige tipo de cambio cuando la moneda del pago coincide con la base (distinto casing)', () => {
    expect(
      validatePayment({ amount: 4500, method: 'cash', currency: 'ars' }, 'ARS')
    ).toEqual([]);
  });
});

describe('sumCollectedInBaseCurrency', () => {
  it('suma pagos en la moneda base tal cual', () => {
    expect(
      sumCollectedInBaseCurrency(
        [
          { amount: 3000, currency: 'ARS' },
          { amount: 1500, currency: 'ARS' },
        ],
        'ARS'
      )
    ).toBe(4500);
  });

  it('convierte pagos en otra moneda con su tipo de cambio congelado', () => {
    expect(
      sumCollectedInBaseCurrency(
        [
          { amount: 1000, currency: 'ARS' },
          { amount: 10, currency: 'USD', exchange_rate: 1200 },
        ],
        'ARS'
      )
    ).toBe(1000 + 12000);
  });

  it('ignora pagos anulados (is_deleted)', () => {
    expect(
      sumCollectedInBaseCurrency(
        [
          { amount: 3000, currency: 'ARS' },
          { amount: 5000, currency: 'ARS', is_deleted: true },
        ],
        'ARS'
      )
    ).toBe(3000);
  });

  it('un pago en otra moneda sin tipo de cambio aporta 0 (dato informativo, no validación)', () => {
    expect(
      sumCollectedInBaseCurrency([{ amount: 10, currency: 'USD' }], 'ARS')
    ).toBe(0);
  });

  it('devuelve 0 para un turno sin pagos', () => {
    expect(sumCollectedInBaseCurrency([], 'ARS')).toBe(0);
  });

  it('redondea la conversión a entero de la unidad mínima', () => {
    expect(
      sumCollectedInBaseCurrency([{ amount: 100, currency: 'USD', exchange_rate: 1.5 }], 'ARS')
    ).toBe(150);
    expect(
      sumCollectedInBaseCurrency([{ amount: 3, currency: 'USD', exchange_rate: 1.5 }], 'ARS')
    ).toBe(5);
  });
});
