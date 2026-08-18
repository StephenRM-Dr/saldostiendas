import { describe, it, expect } from 'vitest';
import { buildStoreRows } from './adminExport';

describe('buildStoreRows', () => {
  it('produces saldo inicial, movement, and saldo final rows for a store', () => {
    const rows = buildStoreRows('Barinas', '2026-08-01', '2026-08-31', {
      movements: [
        {
          id: 1,
          store_id: 1,
          date: '2026-08-15',
          concept: 'Ingreso Ventas Diarias',
          type: 'ingreso',
          amount_usd: '100.00',
          amount_ves: '0',
        },
        {
          id: 2,
          store_id: 1,
          date: '2026-08-16',
          concept: 'Cambio Zelle',
          type: 'gasto',
          amount_usd: '30.00',
          amount_ves: '0',
        },
      ],
      saldoInicial: { usdCents: 5000, vesCents: 0 },
      saldoFinal: { usdCents: 12000, vesCents: 0 },
    });

    expect(rows).toEqual([
      {
        tienda: 'Barinas',
        fecha: '2026-08-01',
        concepto: 'Saldo inicial del rango',
        tipo: '',
        montoUsd: 50,
        montoVes: 0,
      },
      {
        tienda: 'Barinas',
        fecha: '2026-08-15',
        concepto: 'Ingreso Ventas Diarias',
        tipo: 'Ingreso',
        montoUsd: 100,
        montoVes: 0,
      },
      {
        tienda: 'Barinas',
        fecha: '2026-08-16',
        concepto: 'Cambio Zelle',
        tipo: 'Gasto',
        montoUsd: 30,
        montoVes: 0,
      },
      {
        tienda: 'Barinas',
        fecha: '2026-08-31',
        concepto: 'Saldo final del rango',
        tipo: '',
        montoUsd: 120,
        montoVes: 0,
      },
    ]);
  });

  it('produces just the two saldo rows when there are no movements in range', () => {
    const rows = buildStoreRows('Barinas', '2026-08-01', '2026-08-31', {
      movements: [],
      saldoInicial: { usdCents: 5000, vesCents: 0 },
      saldoFinal: { usdCents: 5000, vesCents: 0 },
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].concepto).toBe('Saldo inicial del rango');
    expect(rows[1].concepto).toBe('Saldo final del rango');
  });
});
