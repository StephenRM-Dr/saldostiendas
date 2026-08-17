import { describe, it, expect } from 'vitest';
import { toCents, formatMoney } from './money';

describe('toCents', () => {
  it('converts a decimal string to integer cents', () => {
    expect(toCents('43.00')).toBe(4300);
  });

  it('converts a decimal number to integer cents', () => {
    expect(toCents(1.5)).toBe(150);
  });

  it('treats missing/zero amounts as zero', () => {
    expect(toCents('0')).toBe(0);
    expect(toCents(0)).toBe(0);
  });
});

describe('formatMoney', () => {
  it('formats positive cents as a 2-decimal string', () => {
    expect(formatMoney(12700)).toBe('127.00');
  });

  it('formats negative cents with a leading minus', () => {
    expect(formatMoney(-50000)).toBe('-500.00');
  });
});
