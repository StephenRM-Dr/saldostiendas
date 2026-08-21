import type { Movement } from './movements';
import type { Balance } from './balance';

export interface ExportRow {
  tienda: string;
  fecha: string;
  concepto: string;
  tipo: string;
  montoUsd: number;
  montoVes: number;
  observacion: string;
}

export interface RowFilter {
  saldoInicial: boolean;
  ingreso: boolean;
  egreso: boolean;
  saldoFinal: boolean;
}

export function buildStoreRows(
  storeName: string,
  from: string,
  to: string,
  ledger: { movements: Movement[]; saldoInicial: Balance; saldoFinal: Balance },
  filter: RowFilter
): ExportRow[] {
  const rows: ExportRow[] = [];

  if (filter.saldoInicial) {
    rows.push({
      tienda: storeName,
      fecha: from,
      concepto: 'Saldo inicial del rango',
      tipo: '',
      montoUsd: ledger.saldoInicial.usdCents / 100,
      montoVes: ledger.saldoInicial.vesCents / 100,
      observacion: '',
    });
  }

  for (const movement of ledger.movements) {
    if (movement.type === 'ingreso' && !filter.ingreso) continue;
    if (movement.type === 'gasto' && !filter.egreso) continue;

    rows.push({
      tienda: storeName,
      fecha: movement.date,
      concepto: movement.concept,
      tipo: movement.type === 'ingreso' ? 'Ingreso' : 'Gasto',
      montoUsd: Number(movement.amount_usd),
      montoVes: Number(movement.amount_ves),
      observacion: movement.observacion,
    });
  }

  if (filter.saldoFinal) {
    rows.push({
      tienda: storeName,
      fecha: to,
      concepto: 'Saldo final del rango',
      tipo: '',
      montoUsd: ledger.saldoFinal.usdCents / 100,
      montoVes: ledger.saldoFinal.vesCents / 100,
      observacion: '',
    });
  }

  return rows;
}
