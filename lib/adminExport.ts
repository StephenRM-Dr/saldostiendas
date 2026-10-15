import type { DayLedger } from './movements';
import type { Balance } from './balance';

export interface ExportRow {
  tienda: string;
  fecha: string;
  concepto: string;
  tipo: string;
  montoUsd: number;
  montoVes: number;
  montoCop: number;
  observacion: string;
}

export interface RowFilter {
  saldoInicial: boolean;
  ingreso: boolean;
  egreso: boolean;
  saldoFinal: boolean;
}

function buildSaldoRow(storeName: string, date: string, concepto: string, balance: Balance): ExportRow {
  return {
    tienda: storeName,
    fecha: date,
    concepto,
    tipo: '',
    montoUsd: balance.usdCents / 100,
    montoVes: balance.vesCents / 100,
    montoCop: balance.copCents / 100,
    observacion: '',
  };
}

function buildDayMovementRows(storeName: string, day: DayLedger, filter: RowFilter): ExportRow[] {
  return day.movements
    .filter((m) => (m.type === 'ingreso' ? filter.ingreso : filter.egreso))
    .map((movement) => ({
      tienda: storeName,
      fecha: movement.date,
      concepto: movement.concept,
      tipo: movement.type === 'ingreso' ? 'Ingreso' : 'Gasto',
      montoUsd: Number(movement.amount_usd),
      montoVes: Number(movement.amount_ves),
      montoCop: Number(movement.amount_cop),
      observacion: movement.observacion,
    }));
}

export function buildStoreRows(storeName: string, days: DayLedger[], filter: RowFilter): ExportRow[] {
  const rows: ExportRow[] = [];

  for (const day of days) {
    if (filter.saldoInicial) {
      rows.push(buildSaldoRow(storeName, day.date, 'Saldo inicial del día', day.saldoInicial));
    }
    rows.push(...buildDayMovementRows(storeName, day, filter));
    if (filter.saldoFinal) {
      rows.push(buildSaldoRow(storeName, day.date, 'Saldo final del día', day.saldoFinal));
    }
  }

  return rows;
}
