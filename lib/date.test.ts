import { describe, it, expect } from 'vitest';
import { todayISOCaracas, isDateClosed } from './date';

describe('todayISOCaracas', () => {
  it('converts a UTC instant to the Caracas-local calendar date (UTC-4)', () => {
    // 2026-08-19T02:00:00Z is 2026-08-18T22:00:00 in Caracas (UTC-4) — still the previous day
    expect(todayISOCaracas(new Date('2026-08-19T02:00:00Z'))).toBe('2026-08-18');
  });

  it('rolls over at Caracas midnight, not UTC midnight', () => {
    // 2026-08-19T04:00:00Z is exactly 2026-08-19T00:00:00 in Caracas
    expect(todayISOCaracas(new Date('2026-08-19T04:00:00Z'))).toBe('2026-08-19');
    // one second earlier is still 2026-08-18 in Caracas
    expect(todayISOCaracas(new Date('2026-08-19T03:59:59Z'))).toBe('2026-08-18');
  });
});

describe('isDateClosed', () => {
  const now = new Date('2026-08-19T12:00:00Z'); // 2026-08-19T08:00:00 in Caracas

  it('is true for yesterday', () => {
    expect(isDateClosed('2026-08-18', now)).toBe(true);
  });

  it('is false for today', () => {
    expect(isDateClosed('2026-08-19', now)).toBe(false);
  });

  it('is false for a future date', () => {
    expect(isDateClosed('2026-08-20', now)).toBe(false);
  });

  it('is false for any time of day today, including late evening', () => {
    const lateEvening = new Date('2026-08-20T02:30:00Z'); // 2026-08-19T22:30:00 in Caracas
    expect(isDateClosed('2026-08-19', lateEvening)).toBe(false);
  });
});
