import ExcelJS from 'exceljs';
import { isValidISODate } from './date';

export interface ParsedImportRow {
  row: number;
  storeName: string | null;
  date: string;
  concept: string;
  type: 'ingreso' | 'gasto';
  amountUsd: number;
  amountVes: number;
  observacion: string;
}

export interface ImportRowError {
  row: number;
  reason: string;
}

export type ParseResult =
  | { ok: true; rows: ParsedImportRow[]; errors: ImportRowError[] }
  | { ok: false; error: string };

const REQUIRED_HEADERS = ['fecha', 'concepto', 'tipo', 'monto usd', 'monto ves', 'observacion'];

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((t) => t.text).join('');
    }
    if ('result' in value) return cellToString(value.result as ExcelJS.CellValue);
    if ('text' in value) return String((value as { text: unknown }).text);
  }
  return String(value).trim();
}

function cellToNumber(value: ExcelJS.CellValue): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const str = cellToString(value).replace(',', '.');
  const n = Number(str);
  return Number.isFinite(n) ? n : NaN;
}

function isRowEmpty(row: ExcelJS.Row, columnCount: number): boolean {
  for (let i = 1; i <= columnCount; i++) {
    if (cellToString(row.getCell(i).value) !== '') return false;
  }
  return true;
}

function parseRow(
  row: ExcelJS.Row,
  columnOf: Record<string, number>,
  tiendaCol: number | null
): { ok: true; data: Omit<ParsedImportRow, 'row'> } | { ok: false; reason: string } {
  const storeName = tiendaCol ? cellToString(row.getCell(tiendaCol).value) || null : null;
  const dateRaw = cellToString(row.getCell(columnOf['fecha']).value);
  const concept = cellToString(row.getCell(columnOf['concepto']).value);
  const typeRaw = cellToString(row.getCell(columnOf['tipo']).value).toLowerCase();
  const amountUsd = cellToNumber(row.getCell(columnOf['monto usd']).value);
  const amountVes = cellToNumber(row.getCell(columnOf['monto ves']).value);
  const observacion = cellToString(row.getCell(columnOf['observacion']).value);

  if (!isValidISODate(dateRaw)) {
    return { ok: false, reason: `Fecha inválida ("${dateRaw}"), usa el formato AAAA-MM-DD.` };
  }
  if (!concept) {
    return { ok: false, reason: 'El concepto está vacío.' };
  }
  if (typeRaw !== 'ingreso' && typeRaw !== 'gasto') {
    return { ok: false, reason: `Tipo desconocido ("${typeRaw}"), debe ser "Ingreso" o "Gasto".` };
  }
  if (Number.isNaN(amountUsd) || Number.isNaN(amountVes)) {
    return { ok: false, reason: 'El monto USD o VES no es un número válido.' };
  }
  if (amountUsd <= 0 && amountVes <= 0) {
    return { ok: false, reason: 'Debe indicar un monto en USD o en VES mayor a cero.' };
  }
  if (!observacion) {
    return { ok: false, reason: 'La observación está vacía.' };
  }

  return {
    ok: true,
    data: { storeName, date: dateRaw, concept, type: typeRaw, amountUsd, amountVes, observacion },
  };
}

export async function parseMovementWorkbook(buffer: Buffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs ships a broken `declare interface Buffer extends ArrayBuffer {}`
    // that's incompatible with @types/node's generic Buffer — cast around it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);
  } catch {
    return { ok: false, error: 'No se pudo leer el archivo. Verifica que sea un Excel (.xlsx) válido.' };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { ok: false, error: 'El archivo no tiene ninguna hoja.' };
  }

  const headerRow = sheet.getRow(1);
  const columnOf: Record<string, number> = {};
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    columnOf[normalizeHeader(cellToString(cell.value))] = colNumber;
  });

  const missing = REQUIRED_HEADERS.filter((h) => !(h in columnOf));
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Faltan columnas en el archivo: ${missing.join(', ')}. Usa el mismo formato que el Excel exportado.`,
    };
  }

  const columnCount = Object.values(columnOf).reduce((max, c) => Math.max(max, c), 0);
  const tiendaCol = columnOf['tienda'] ?? null;

  const rows: ParsedImportRow[] = [];
  const errors: ImportRowError[] = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    if (isRowEmpty(row, columnCount)) continue;

    const parsed = parseRow(row, columnOf, tiendaCol);
    if (!parsed.ok) {
      errors.push({ row: rowNumber, reason: parsed.reason });
      continue;
    }
    rows.push({ row: rowNumber, ...parsed.data });
  }

  return { ok: true, rows, errors };
}
