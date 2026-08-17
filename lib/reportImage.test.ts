import { describe, it, expect } from 'vitest';
import { calculateImageHeight } from './reportImage';

describe('calculateImageHeight', () => {
  it('reserves one row for "Sin movimientos hoy." when there are no movements', () => {
    expect(calculateImageHeight(0)).toBe(310);
  });

  it('uses one row per movement when there is at least one', () => {
    expect(calculateImageHeight(1)).toBe(310);
    expect(calculateImageHeight(3)).toBe(400);
  });
});
