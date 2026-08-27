import {describe, expect, it} from 'vitest';
import {validateClient, validateService, validateWorker,} from './validators';

describe('validateService', () => {
  it('acepta un servicio válido', () => {
    expect(
      validateService({name: 'Corte', duration_minutes: 30, default_price_amount: 5000})
    ).toEqual([]);
  });

  it('rechaza nombre vacío o solo espacios', () => {
    expect(validateService({name: '', duration_minutes: 30, default_price_amount: 5000})).toContain(
      'El nombre del servicio es requerido'
    );
    expect(
      validateService({name: '   ', duration_minutes: 30, default_price_amount: 5000})
    ).toContain('El nombre del servicio es requerido');
  });

  it('rechaza duración no positiva o ausente', () => {
    expect(
      validateService({name: 'Corte', duration_minutes: 0, default_price_amount: 5000})
    ).toContain('La duración debe ser mayor a 0 minutos');
    expect(validateService({name: 'Corte', default_price_amount: 5000})).toContain(
      'La duración debe ser mayor a 0 minutos'
    );
  });

  it('rechaza precio no positivo o ausente', () => {
    expect(
      validateService({name: 'Corte', duration_minutes: 30, default_price_amount: 0})
    ).toContain('El precio debe ser mayor a 0');
    expect(validateService({name: 'Corte', duration_minutes: 30})).toContain(
      'El precio debe ser mayor a 0'
    );
  });

  it('acumula todos los errores cuando faltan varios campos', () => {
    expect(validateService({})).toHaveLength(3);
  });
});

describe('validateClient', () => {
  it('acepta un cliente con nombre', () => {
    expect(validateClient({name: 'Ana'})).toEqual([]);
  });

  it('rechaza nombre vacío', () => {
    expect(validateClient({name: ''})).toContain('El nombre del cliente es requerido');
    expect(validateClient({})).toContain('El nombre del cliente es requerido');
  });
});

describe('validateWorker', () => {
  it('acepta comisión por porcentaje válida', () => {
    expect(
      validateWorker({name: 'Luis', commission_type: 'percentage', commission_value: 40})
    ).toEqual([]);
  });

  it('acepta comisión fija válida', () => {
    expect(
      validateWorker({name: 'Luis', commission_type: 'fixed_per_service', commission_value: 1500})
    ).toEqual([]);
  });

  it('rechaza nombre vacío', () => {
    expect(
      validateWorker({name: '', commission_type: 'percentage', commission_value: 40})
    ).toContain('El nombre del trabajador es requerido');
  });

  it('rechaza tipo de comisión inválido o ausente', () => {
    expect(
      validateWorker({name: 'Luis', commission_type: 'weird', commission_value: 40})
    ).toContain('El tipo de comisión debe ser "percentage" o "fixed_per_service"');
    expect(validateWorker({name: 'Luis', commission_value: 40})).toContain(
      'El tipo de comisión debe ser "percentage" o "fixed_per_service"'
    );
  });

  it('rechaza valor de comisión negativo', () => {
    expect(
      validateWorker({name: 'Luis', commission_type: 'percentage', commission_value: -1})
    ).toContain('El valor de comisión debe ser 0 o mayor');
  });

  it('rechaza porcentaje mayor a 100', () => {
    expect(
      validateWorker({name: 'Luis', commission_type: 'percentage', commission_value: 101})
    ).toContain('El porcentaje de comisión no puede superar 100');
  });

  it('permite un monto fijo mayor a 100 (no es porcentaje)', () => {
    expect(
      validateWorker({name: 'Luis', commission_type: 'fixed_per_service', commission_value: 5000})
    ).toEqual([]);
  });

  it('acepta comisión en cero', () => {
    expect(
      validateWorker({name: 'Luis', commission_type: 'percentage', commission_value: 0})
    ).toEqual([]);
  });
});
