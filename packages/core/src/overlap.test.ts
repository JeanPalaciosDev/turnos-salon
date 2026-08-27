import { describe, it, expect } from 'vitest';
import { hasTimeOverlap, validateNoOverlap } from './validators';

describe('hasTimeOverlap', () => {
  it('detecta solapamiento parcial (incoming empieza dentro de existing)', () => {
    expect(
      hasTimeOverlap({ start_time: '10:00', end_time: '11:00' }, { start_time: '10:30', end_time: '11:30' })
    ).toBe(true);
  });

  it('detecta solapamiento cuando incoming contiene a existing', () => {
    expect(
      hasTimeOverlap({ start_time: '10:00', end_time: '11:00' }, { start_time: '09:30', end_time: '11:30' })
    ).toBe(true);
  });

  it('detecta solapamiento cuando existing contiene a incoming', () => {
    expect(
      hasTimeOverlap({ start_time: '10:00', end_time: '12:00' }, { start_time: '10:30', end_time: '11:00' })
    ).toBe(true);
  });

  it('no detecta solapamiento cuando incoming empieza justo al terminar existing (adyacente)', () => {
    expect(
      hasTimeOverlap({ start_time: '10:00', end_time: '11:00' }, { start_time: '11:00', end_time: '12:00' })
    ).toBe(false);
  });

  it('no detecta solapamiento cuando incoming termina justo al empezar existing (adyacente)', () => {
    expect(
      hasTimeOverlap({ start_time: '11:00', end_time: '12:00' }, { start_time: '10:00', end_time: '11:00' })
    ).toBe(false);
  });

  it('no detecta solapamiento cuando están completamente separados', () => {
    expect(
      hasTimeOverlap({ start_time: '09:00', end_time: '10:00' }, { start_time: '14:00', end_time: '15:00' })
    ).toBe(false);
  });

  it('detecta solapamiento cuando comparten exactamente el mismo intervalo', () => {
    expect(
      hasTimeOverlap({ start_time: '10:00', end_time: '11:00' }, { start_time: '10:00', end_time: '11:00' })
    ).toBe(true);
  });
});

describe('validateNoOverlap', () => {
  const base = [
    { id: 'a', start_time: '09:00', end_time: '10:00', status: 'scheduled' as const },
    { id: 'b', start_time: '11:00', end_time: '12:00', status: 'scheduled' as const },
  ];

  it('retorna vacío cuando no hay conflictos', () => {
    expect(validateNoOverlap(base, { start_time: '10:00', end_time: '11:00' })).toEqual([]);
  });

  it('retorna el appointment en conflicto', () => {
    const result = validateNoOverlap(base, { start_time: '09:30', end_time: '10:30' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('ignora appointments cancelados', () => {
    const withCancelled = [
      ...base,
      { id: 'c', start_time: '13:00', end_time: '14:00', status: 'cancelled' as const },
    ];
    expect(validateNoOverlap(withCancelled, { start_time: '13:00', end_time: '14:00' })).toEqual([]);
  });

  it('excluye el appointment indicado por excludeId (edición del propio turno)', () => {
    expect(
      validateNoOverlap(base, { start_time: '09:00', end_time: '10:00' }, 'a')
    ).toEqual([]);
  });

  it('detecta múltiples conflictos', () => {
    const packed = [
      { id: 'x', start_time: '10:00', end_time: '11:00', status: 'scheduled' as const },
      { id: 'y', start_time: '10:45', end_time: '11:45', status: 'completed' as const },
    ];
    const result = validateNoOverlap(packed, { start_time: '10:30', end_time: '11:15' });
    expect(result.map((r) => r.id).sort()).toEqual(['x', 'y']);
  });
});
