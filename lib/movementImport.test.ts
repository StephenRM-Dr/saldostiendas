import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { parseMovementWorkbook } from './movementImport';

async function buildWorkbook(headers: string[], rows: unknown[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Movimientos');
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

const FULL_HEADERS = ['Tienda', 'Fecha', 'Concepto', 'Tipo', 'Monto USD', 'Monto VES', 'Observación'];

describe('parseMovementWorkbook', () => {
  it('parses valid rows with all columns present', async () => {
    const buffer = await buildWorkbook(FULL_HEADERS, [
      ['Barinas', '2026-08-15', 'Ingreso Ventas Diarias', 'Ingreso', 100, 0, 'Cierre de caja'],
      ['Barinas', '2026-08-16', 'Cambio Zelle', 'Gasto', 30, 0, 'Pago a proveedor'],
    ]);

    const result = await parseMovementWorkbook(buffer);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toEqual([
      {
        row: 2,
        storeName: 'Barinas',
        date: '2026-08-15',
        concept: 'Ingreso Ventas Diarias',
        type: 'ingreso',
        amountUsd: 100,
        amountVes: 0,
        observacion: 'Cierre de caja',
      },
      {
        row: 3,
        storeName: 'Barinas',
        date: '2026-08-16',
        concept: 'Cambio Zelle',
        type: 'gasto',
        amountUsd: 30,
        amountVes: 0,
        observacion: 'Pago a proveedor',
      },
    ]);
  });

  it('treats the Tienda column as optional and reports storeName null when absent', async () => {
    const headersWithoutStore = ['Fecha', 'Concepto', 'Tipo', 'Monto USD', 'Monto VES', 'Observación'];
    const buffer = await buildWorkbook(headersWithoutStore, [
      ['2026-08-15', 'Ingreso Ventas Diarias', 'Ingreso', 100, 0, 'Cierre de caja'],
    ]);

    const result = await parseMovementWorkbook(buffer);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].storeName).toBeNull();
  });

  it('skips fully empty rows without producing an error', async () => {
    const buffer = await buildWorkbook(FULL_HEADERS, [
      ['Barinas', '2026-08-15', 'Ingreso Ventas Diarias', 'Ingreso', 100, 0, 'Cierre de caja'],
      [],
      ['Barinas', '2026-08-16', 'Cambio Zelle', 'Gasto', 30, 0, 'Pago a proveedor'],
    ]);

    const result = await parseMovementWorkbook(buffer);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it('reports a row error for an invalid date instead of failing the whole file', async () => {
    const buffer = await buildWorkbook(FULL_HEADERS, [
      ['Barinas', 'ayer', 'Ingreso Ventas Diarias', 'Ingreso', 100, 0, 'Cierre de caja'],
      ['Barinas', '2026-08-16', 'Cambio Zelle', 'Gasto', 30, 0, 'Pago a proveedor'],
    ]);

    const result = await parseMovementWorkbook(buffer);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toEqual([{ row: 2, reason: expect.stringContaining('Fecha inválida') }]);
  });

  it('reports a row error for an unrecognized tipo', async () => {
    const buffer = await buildWorkbook(FULL_HEADERS, [
      ['Barinas', '2026-08-15', 'Ingreso Ventas Diarias', 'Venta', 100, 0, 'Cierre de caja'],
    ]);

    const result = await parseMovementWorkbook(buffer);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0].reason).toContain('Tipo desconocido');
  });

  it('reports a row error when both amounts are zero', async () => {
    const buffer = await buildWorkbook(FULL_HEADERS, [
      ['Barinas', '2026-08-15', 'Ingreso Ventas Diarias', 'Ingreso', 0, 0, 'Cierre de caja'],
    ]);

    const result = await parseMovementWorkbook(buffer);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.errors[0].reason).toContain('monto');
  });

  it('reports a row error when observacion is missing', async () => {
    const buffer = await buildWorkbook(FULL_HEADERS, [
      ['Barinas', '2026-08-15', 'Ingreso Ventas Diarias', 'Ingreso', 100, 0, ''],
    ]);

    const result = await parseMovementWorkbook(buffer);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.errors[0].reason).toContain('observación');
  });

  it('accepts comma decimals in amount columns', async () => {
    const buffer = await buildWorkbook(FULL_HEADERS, [
      ['Barinas', '2026-08-15', 'Ingreso Ventas Diarias', 'Ingreso', '43,50', 0, 'Cierre de caja'],
    ]);

    const result = await parseMovementWorkbook(buffer);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].amountUsd).toBe(43.5);
  });

  it('fails the whole file when a required column is missing', async () => {
    const buffer = await buildWorkbook(
      ['Tienda', 'Fecha', 'Concepto', 'Tipo', 'Monto USD'],
      [['Barinas', '2026-08-15', 'Ingreso Ventas Diarias', 'Ingreso', 100]]
    );

    const result = await parseMovementWorkbook(buffer);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('monto ves');
  });
});
