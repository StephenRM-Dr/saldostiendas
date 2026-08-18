import { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { listStores } from '@/lib/stores';
import { getRangeLedger } from '@/lib/movements';
import { buildStoreRows } from '@/lib/adminExport';

export const dynamic = 'force-dynamic';

function isValidDate(value: string | null): value is string {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');

  if (!isValidDate(from) || !isValidDate(to) || from > to) {
    return new Response('Rango de fechas invalido: verifica que "desde" y "hasta" esten presentes y que "desde" no sea posterior a "hasta".', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
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

  for (const store of stores) {
    const ledger = await getRangeLedger(store.id, from, to);
    const rows = buildStoreRows(store.name, from, to, ledger);
    sheet.addRows(rows);
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="movimientos_${from}_a_${to}.xlsx"`,
    },
  });
}
