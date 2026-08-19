import { describe, it, expect } from 'vitest';
import { todayISOCaracas, isDateClosed, isValidISODate } from './date';

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

  it('is true for a malformed date string regardless of now (fail closed)', () => {
    expect(isDateClosed('2026-8-18', now)).toBe(true);
    expect(isDateClosed('yesterday', now)).toBe(true);
  });

  it('flips from false to true exactly as now crosses Caracas midnight', () => {
    // 2026-08-20T03:59:59Z is still 2026-08-19T23:59:59 in Caracas — today, not closed
    expect(isDateClosed('2026-08-19', new Date('2026-08-20T03:59:59Z'))).toBe(false);
    // 2026-08-20T04:00:00Z is exactly 2026-08-20T00:00:00 in Caracas — now yesterday, closed
    expect(isDateClosed('2026-08-19', new Date('2026-08-20T04:00:00Z'))).toBe(true);
  });
});

describe('isValidISODate', () => {
  it('is true for a well-formed calendar date', () => {
    expect(isValidISODate('2026-08-19')).toBe(true);
  });

  it('is false for malformed formats', () => {
    expect(isValidISODate('2026-8-18')).toBe(false);
    expect(isValidISODate('yesterday')).toBe(false);
    expect(isValidISODate('999-08-18')).toBe(false);
  });

  it('is false for a calendar-invalid date', () => {
    expect(isValidISODate('2026-02-30')).toBe(false);
  });
});
