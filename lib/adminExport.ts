import type { Movement } from './movements';
import type { Balance } from './balance';

export interface ExportRow {
  tienda: string;
  fecha: string;
  concepto: string;
  tipo: string;
  montoUsd: number;
  montoVes: number;
}

export function buildStoreRows(
  storeName: string,
  from: string,
  to: string,
  ledger: { movements: Movement[]; saldoInicial: Balance; saldoFinal: Balance }
): ExportRow[] {
  const rows: ExportRow[] = [];

  rows.push({
    tienda: storeName,
    fecha: from,
    concepto: 'Saldo inicial del rango',
    tipo: '',
    montoUsd: ledger.saldoInicial.usdCents / 100,
    montoVes: ledger.saldoInicial.vesCents / 100,
  });

  for (const movement of ledger.movements) {
    rows.push({
      tienda: storeName,
      fecha: movement.date,
      concepto: movement.concept,
      tipo: movement.type === 'ingreso' ? 'Ingreso' : 'Gasto',
      montoUsd: Number(movement.amount_usd),
      montoVes: Number(movement.amount_ves),
    });
  }

  rows.push({
    tienda: storeName,
    fecha: to,
    concepto: 'Saldo final del rango',
    tipo: '',
    montoUsd: ledger.saldoFinal.usdCents / 100,
    montoVes: ledger.saldoFinal.vesCents / 100,
  });

  return rows;
}
