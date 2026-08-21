import { describe, it, expect } from 'vitest';
import { buildStoreRows, type RowFilter } from './adminExport';

const allRows: RowFilter = { saldoInicial: true, ingreso: true, egreso: true, saldoFinal: true };

const twoMovements = [
  {
    id: 1,
    store_id: 1,
    date: '2026-08-15',
    concept: 'Ingreso Ventas Diarias',
    type: 'ingreso' as const,
    amount_usd: '100.00',
    amount_ves: '0',
    observacion: 'Cierre de caja del turno',
  },
  {
    id: 2,
    store_id: 1,
    date: '2026-08-16',
    concept: 'Cambio Zelle',
    type: 'gasto' as const,
    amount_usd: '30.00',
    amount_ves: '0',
    observacion: 'Pago a proveedor',
  },
];

describe('buildStoreRows', () => {
  it('produces saldo inicial, movement, and saldo final rows for a store', () => {
    const rows = buildStoreRows(
      'Barinas',
      '2026-08-01',
      '2026-08-31',
      {
        movements: twoMovements,
        saldoInicial: { usdCents: 5000, vesCents: 0 },
        saldoFinal: { usdCents: 12000, vesCents: 0 },
      },
      allRows
    );

    expect(rows).toEqual([
      {
        tienda: 'Barinas',
        fecha: '2026-08-01',
        concepto: 'Saldo inicial del rango',
        tipo: '',
        montoUsd: 50,
        montoVes: 0,
        observacion: '',
      },
      {
        tienda: 'Barinas',
        fecha: '2026-08-15',
        concepto: 'Ingreso Ventas Diarias',
        tipo: 'Ingreso',
        montoUsd: 100,
        montoVes: 0,
        observacion: 'Cierre de caja del turno',
      },
      {
        tienda: 'Barinas',
        fecha: '2026-08-16',
        concepto: 'Cambio Zelle',
        tipo: 'Gasto',
        montoUsd: 30,
        montoVes: 0,
        observacion: 'Pago a proveedor',
      },
      {
        tienda: 'Barinas',
        fecha: '2026-08-31',
        concepto: 'Saldo final del rango',
        tipo: '',
        montoUsd: 120,
        montoVes: 0,
        observacion: '',
      },
    ]);
  });

  it('produces just the two saldo rows when there are no movements in range', () => {
    const rows = buildStoreRows(
      'Barinas',
      '2026-08-01',
      '2026-08-31',
      {
        movements: [],
        saldoInicial: { usdCents: 5000, vesCents: 0 },
        saldoFinal: { usdCents: 5000, vesCents: 0 },
      },
      allRows
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].concepto).toBe('Saldo inicial del rango');
    expect(rows[1].concepto).toBe('Saldo final del rango');
  });

  it('omits the saldo inicial row when filter.saldoInicial is false', () => {
    const rows = buildStoreRows(
      'Barinas',
      '2026-08-01',
      '2026-08-31',
      { movements: twoMovements, saldoInicial: { usdCents: 5000, vesCents: 0 }, saldoFinal: { usdCents: 12000, vesCents: 0 } },
      { ...allRows, saldoInicial: false }
    );

    expect(rows.some((r) => r.concepto === 'Saldo inicial del rango')).toBe(false);
    expect(rows).toHaveLength(3);
  });

  it('omits the saldo final row when filter.saldoFinal is false', () => {
    const rows = buildStoreRows(
      'Barinas',
      '2026-08-01',
      '2026-08-31',
      { movements: twoMovements, saldoInicial: { usdCents: 5000, vesCents: 0 }, saldoFinal: { usdCents: 12000, vesCents: 0 } },
      { ...allRows, saldoFinal: false }
    );

    expect(rows.some((r) => r.concepto === 'Saldo final del rango')).toBe(false);
    expect(rows).toHaveLength(3);
  });

  it('excludes ingreso movements when filter.ingreso is false', () => {
    const rows = buildStoreRows(
      'Barinas',
      '2026-08-01',
      '2026-08-31',
      { movements: twoMovements, saldoInicial: { usdCents: 5000, vesCents: 0 }, saldoFinal: { usdCents: 12000, vesCents: 0 } },
      { ...allRows, ingreso: false }
    );

    expect(rows.some((r) => r.tipo === 'Ingreso')).toBe(false);
    expect(rows.some((r) => r.tipo === 'Gasto')).toBe(true);
  });

  it('excludes gasto movements when filter.egreso is false', () => {
    const rows = buildStoreRows(
      'Barinas',
      '2026-08-01',
      '2026-08-31',
      { movements: twoMovements, saldoInicial: { usdCents: 5000, vesCents: 0 }, saldoFinal: { usdCents: 12000, vesCents: 0 } },
      { ...allRows, egreso: false }
    );

    expect(rows.some((r) => r.tipo === 'Gasto')).toBe(false);
    expect(rows.some((r) => r.tipo === 'Ingreso')).toBe(true);
  });

  it('produces only movement rows when both saldo filters are false', () => {
    const rows = buildStoreRows(
      'Barinas',
      '2026-08-01',
      '2026-08-31',
      { movements: twoMovements, saldoInicial: { usdCents: 5000, vesCents: 0 }, saldoFinal: { usdCents: 12000, vesCents: 0 } },
      { saldoInicial: false, ingreso: true, egreso: true, saldoFinal: false }
    );

    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.concepto !== 'Saldo inicial del rango' && r.concepto !== 'Saldo final del rango')).toBe(true);
  });
});
