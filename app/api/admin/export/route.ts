import { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { listStores } from '@/lib/stores';
import { getRangeLedger } from '@/lib/movements';
import { buildStoreRows, type RowFilter } from '@/lib/adminExport';
import { isAuthorized } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

function isValidDate(value: string | null): value is string {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseRowFilter(values: string[]): RowFilter {
  return {
    saldoInicial: values.includes('saldoInicial'),
    ingreso: values.includes('ingreso'),
    egreso: values.includes('egreso'),
    saldoFinal: values.includes('saldoFinal'),
  };
}

function isEmptyFilter(filter: RowFilter): boolean {
  return !filter.saldoInicial && !filter.ingreso && !filter.egreso && !filter.saldoFinal;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request.headers.get('authorization'))) {
    return new Response('Autenticacion requerida.', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin", charset="UTF-8"', 'Cache-Control': 'no-store' },
    });
  }

  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');

  if (!isValidDate(from) || !isValidDate(to) || from > to) {
    return new Response('Rango de fechas invalido: verifica que "desde" y "hasta" esten presentes y que "desde" no sea posterior a "hasta".', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const rowFilter = parseRowFilter(request.nextUrl.searchParams.getAll('rows'));

  if (isEmptyFilter(rowFilter)) {
    return new Response('Debes seleccionar al menos un tipo de fila para exportar.', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const stores = await listStores();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Movimientos');
  sheet.columns = [
    { header: 'Tienda', key: 'tienda', width: 20 },
    { header: 'Fecha', key: 'fecha', width: 14 },
    { header: 'Concepto', key: 'concepto', width: 30 },
    { header: 'Tipo', key: 'tipo', width: 12 },
    { header: 'Monto USD', key: 'montoUsd', width: 14 },
    { header: 'Monto VES', key: 'montoVes', width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };

  let buffer: ExcelJS.Buffer;
  try {
    for (const store of stores) {
      const ledger = await getRangeLedger(store.id, from, to);
      const rows = buildStoreRows(store.name, from, to, ledger, rowFilter);
      sheet.addRows(rows);
    }

    buffer = await workbook.xlsx.writeBuffer();
  } catch {
    return new Response('No se pudo generar el archivo. Verifica que las fechas sean validas e intenta de nuevo.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="movimientos_${from}_a_${to}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
