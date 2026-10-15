import { describe, it, expect } from 'vitest';
import { buildStoreRows, type RowFilter } from './adminExport';
import type { DayLedger } from './movements';

const allRows: RowFilter = { saldoInicial: true, ingreso: true, egreso: true, saldoFinal: true };

const ingresoMovement = {
  id: 1,
  store_id: 1,
  date: '2026-08-15',
  concept: 'Ingreso Ventas Diarias',
  type: 'ingreso' as const,
  amount_usd: '100.00',
  amount_ves: '0',
  amount_cop: '0',
  observacion: 'Cierre de caja del turno',
};

const gastoMovement = {
  id: 2,
  store_id: 1,
  date: '2026-08-16',
  concept: 'Cambio Zelle',
  type: 'gasto' as const,
  amount_usd: '30.00',
  amount_ves: '0',
  amount_cop: '0',
  observacion: 'Pago a proveedor',
};

const threeDays: DayLedger[] = [
  {
    date: '2026-08-15',
    movements: [ingresoMovement],
    saldoInicial: { usdCents: 5000, vesCents: 0, copCents: 0 },
    saldoFinal: { usdCents: 15000, vesCents: 0, copCents: 0 },
  },
  {
    date: '2026-08-16',
    movements: [gastoMovement],
    saldoInicial: { usdCents: 15000, vesCents: 0, copCents: 0 },
    saldoFinal: { usdCents: 12000, vesCents: 0, copCents: 0 },
  },
  {
    date: '2026-08-17',
    movements: [],
    saldoInicial: { usdCents: 12000, vesCents: 0, copCents: 0 },
    saldoFinal: { usdCents: 12000, vesCents: 0, copCents: 0 },
  },
];

describe('buildStoreRows', () => {
  it('produces a saldo inicial / movement(s) / saldo final block for each day, in order', () => {
    const rows = buildStoreRows('Barinas', threeDays, allRows);

    expect(rows).toEqual([
      {
        tienda: 'Barinas',
        fecha: '2026-08-15',
        concepto: 'Saldo inicial del día',
        tipo: '',
        montoUsd: 50,
        montoVes: 0,
        montoCop: 0,
        observacion: '',
      },
      {
        tienda: 'Barinas',
        fecha: '2026-08-15',
        concepto: 'Ingreso Ventas Diarias',
        tipo: 'Ingreso',
        montoUsd: 100,
        montoVes: 0,
        montoCop: 0,
        observacion: 'Cierre de caja del turno',
      },
      {
        tienda: 'Barinas',
        fecha: '2026-08-15',
        concepto: 'Saldo final del día',
        tipo: '',
        montoUsd: 150,
        montoVes: 0,
        montoCop: 0,
        observacion: '',
      },
      {
        tienda: 'Barinas',
        fecha: '2026-08-16',
        concepto: 'Saldo inicial del día',
        tipo: '',
        montoUsd: 150,
        montoVes: 0,
        montoCop: 0,
        observacion: '',
      },
      {
        tienda: 'Barinas',
        fecha: '2026-08-16',
        concepto: 'Cambio Zelle',
        tipo: 'Gasto',
        montoUsd: 30,
        montoVes: 0,
        montoCop: 0,
        observacion: 'Pago a proveedor',
      },
      {
        tienda: 'Barinas',
        fecha: '2026-08-16',
        concepto: 'Saldo final del día',
        tipo: '',
        montoUsd: 120,
        montoVes: 0,
        montoCop: 0,
        observacion: '',
      },
      {
        tienda: 'Barinas',
        fecha: '2026-08-17',
        concepto: 'Saldo inicial del día',
        tipo: '',
        montoUsd: 120,
        montoVes: 0,
        montoCop: 0,
        observacion: '',
      },
      {
        tienda: 'Barinas',
        fecha: '2026-08-17',
        concepto: 'Saldo final del día',
        tipo: '',
        montoUsd: 120,
        montoVes: 0,
        montoCop: 0,
        observacion: '',
      },
    ]);
  });

  it('still produces a saldo inicial/final pair for a day with no movements', () => {
    const emptyDay: DayLedger[] = [
      {
        date: '2026-08-20',
        movements: [],
        saldoInicial: { usdCents: 5000, vesCents: 0, copCents: 0 },
        saldoFinal: { usdCents: 5000, vesCents: 0, copCents: 0 },
      },
    ];

    const rows = buildStoreRows('Barinas', emptyDay, allRows);

    expect(rows).toHaveLength(2);
    expect(rows[0].concepto).toBe('Saldo inicial del día');
    expect(rows[1].concepto).toBe('Saldo final del día');
  });

  it('omits every saldo inicial row when filter.saldoInicial is false', () => {
    const rows = buildStoreRows('Barinas', threeDays, { ...allRows, saldoInicial: false });

    expect(rows.some((r) => r.concepto === 'Saldo inicial del día')).toBe(false);
    expect(rows.filter((r) => r.concepto === 'Saldo final del día')).toHaveLength(3);
  });

  it('omits every saldo final row when filter.saldoFinal is false', () => {
    const rows = buildStoreRows('Barinas', threeDays, { ...allRows, saldoFinal: false });

    expect(rows.some((r) => r.concepto === 'Saldo final del día')).toBe(false);
    expect(rows.filter((r) => r.concepto === 'Saldo inicial del día')).toHaveLength(3);
  });

  it('excludes ingreso movements when filter.ingreso is false', () => {
    const rows = buildStoreRows('Barinas', threeDays, { ...allRows, ingreso: false });

    expect(rows.some((r) => r.tipo === 'Ingreso')).toBe(false);
    expect(rows.some((r) => r.tipo === 'Gasto')).toBe(true);
  });

  it('excludes gasto movements when filter.egreso is false', () => {
    const rows = buildStoreRows('Barinas', threeDays, { ...allRows, egreso: false });

    expect(rows.some((r) => r.tipo === 'Gasto')).toBe(false);
    expect(rows.some((r) => r.tipo === 'Ingreso')).toBe(true);
  });

  it('produces only movement rows when both saldo filters are false', () => {
    const rows = buildStoreRows('Barinas', threeDays, {
      saldoInicial: false,
      ingreso: true,
      egreso: true,
      saldoFinal: false,
    });

    expect(rows).toHaveLength(2);
    expect(
      rows.every((r) => r.concepto !== 'Saldo inicial del día' && r.concepto !== 'Saldo final del día')
    ).toBe(true);
  });

  it('includes montoCop for a store using Colombian pesos', () => {
    const day: DayLedger[] = [
      {
        date: '2026-08-15',
        movements: [
          {
            id: 3,
            store_id: 1,
            date: '2026-08-15',
            concept: 'Ingreso Ventas Diarias',
            type: 'ingreso' as const,
            amount_usd: '0',
            amount_ves: '0',
            amount_cop: '50000.00',
            observacion: 'Venta en pesos colombianos',
          },
        ],
        saldoInicial: { usdCents: 0, vesCents: 0, copCents: 0 },
        saldoFinal: { usdCents: 0, vesCents: 0, copCents: 5000000 },
      },
    ];

    const rows = buildStoreRows('San Cristóbal', day, {
      saldoInicial: false,
      ingreso: true,
      egreso: true,
      saldoFinal: false,
    });

    expect(rows).toEqual([
      {
        tienda: 'San Cristóbal',
        fecha: '2026-08-15',
        concepto: 'Ingreso Ventas Diarias',
        tipo: 'Ingreso',
        montoUsd: 0,
        montoVes: 0,
        montoCop: 50000,
        observacion: 'Venta en pesos colombianos',
      },
    ]);
  });
});
