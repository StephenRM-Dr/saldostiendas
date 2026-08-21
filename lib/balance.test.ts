import { describe, it, expect } from 'vitest';
import { computeBalance } from './balance';

describe('computeBalance', () => {
  it('returns zero balance for no movements', () => {
    expect(computeBalance([])).toEqual({ usdCents: 0, vesCents: 0, copCents: 0 });
  });

  it('adds ingreso amounts', () => {
    const result = computeBalance([
      { type: 'ingreso', amount_usd: '43.00', amount_ves: '1380.00', amount_cop: '0' },
    ]);
    expect(result).toEqual({ usdCents: 4300, vesCents: 138000, copCents: 0 });
  });

  it('subtracts gasto amounts', () => {
    const result = computeBalance([
      { type: 'ingreso', amount_usd: '100.00', amount_ves: '0', amount_cop: '0' },
      { type: 'gasto', amount_usd: '30.00', amount_ves: '0', amount_cop: '0' },
    ]);
    expect(result.usdCents).toBe(7000);
  });

  it('accumulates COP amounts the same way as USD and VES', () => {
    const result = computeBalance([
      { type: 'ingreso', amount_usd: '0', amount_ves: '0', amount_cop: '50000.00' },
      { type: 'gasto', amount_usd: '0', amount_ves: '0', amount_cop: '12000.00' },
    ]);
    expect(result.copCents).toBe(3800000);
  });

  it('reproduces the Barinas example day from the spec', () => {
    const saldoInicial = { usdCents: 148400, vesCents: 22000, copCents: 0 }; // 1.484,00 / 220,00
    const dayMovements = [
      { type: 'ingreso' as const, amount_usd: '43.00', amount_ves: '1380.00', amount_cop: '0' },
      { type: 'gasto' as const, amount_usd: '500.00', amount_ves: '0', amount_cop: '0' },
      { type: 'gasto' as const, amount_usd: '700.00', amount_ves: '0', amount_cop: '0' },
      { type: 'gasto' as const, amount_usd: '200.00', amount_ves: '0', amount_cop: '0' },
    ];
    const dayChange = computeBalance(dayMovements);
    const saldoFinal = {
      usdCents: saldoInicial.usdCents + dayChange.usdCents,
      vesCents: saldoInicial.vesCents + dayChange.vesCents,
      copCents: saldoInicial.copCents + dayChange.copCents,
    };
    expect(saldoFinal).toEqual({ usdCents: 12700, vesCents: 160000, copCents: 0 }); // 127,00 / 1.600,00
  });
});
