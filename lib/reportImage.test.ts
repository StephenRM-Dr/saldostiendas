import { describe, it, expect } from 'vitest';
import { calculateImageHeight } from './reportImage';

describe('calculateImageHeight', () => {
  it('reserves one row for "Sin movimientos hoy." when there are no movements', () => {
    expect(calculateImageHeight([])).toBe(310);
  });

  it('gives a short concept + observación its own row', () => {
    expect(
      calculateImageHeight([{ concept: 'Ingreso Ventas Diarias', observacion: 'Cierre de caja del turno' }])
    ).toBe(325);
  });

  it('sums one row per movement when concepts and observaciones are short', () => {
    expect(
      calculateImageHeight([
        { concept: 'a', observacion: 'a' },
        { concept: 'b', observacion: 'b' },
        { concept: 'c', observacion: 'c' },
      ])
    ).toBe(445);
  });

  it('grows the row when the observación wraps to a second line', () => {
    expect(calculateImageHeight([{ concept: 'x', observacion: 'x'.repeat(80) }])).toBe(343);
  });

  it('caps observación growth at 3 lines, truncating longer text', () => {
    expect(calculateImageHeight([{ concept: 'x', observacion: 'x'.repeat(500) }])).toBe(361);
  });

  it('grows the row when a free-typed concept (e.g. "Otro") wraps to a second line', () => {
    expect(calculateImageHeight([{ concept: 'x'.repeat(60), observacion: 'short' }])).toBe(351);
  });

  it('caps concept growth at 2 lines, truncating longer text', () => {
    expect(calculateImageHeight([{ concept: 'x'.repeat(200), observacion: 'short' }])).toBe(351);
  });
});
