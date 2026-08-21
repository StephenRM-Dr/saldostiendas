'use server';

import { createMovement } from '@/lib/movements';
import { listStores } from '@/lib/stores';
import { parseMovementWorkbook, type ImportRowError } from '@/lib/movementImport';

export type ImportActionResult =
  | { ok: true; imported: number; errors: ImportRowError[] }
  | { ok: false; error: string };

export async function importMovementsAction(formData: FormData): Promise<ImportActionResult> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Selecciona un archivo Excel (.xlsx).' };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseMovementWorkbook(buffer);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const stores = await listStores();
  const storeByName = new Map(stores.map((s) => [s.name, s]));

  const errors: ImportRowError[] = [...parsed.errors];
  let imported = 0;

  for (const row of parsed.rows) {
    const store = row.storeName ? storeByName.get(row.storeName) : undefined;
    if (!store) {
      errors.push({ row: row.row, reason: `Tienda no encontrada: "${row.storeName ?? ''}".` });
      continue;
    }

    await createMovement({
      storeId: store.id,
      date: row.date,
      concept: row.concept,
      type: row.type,
      amountUsd: row.amountUsd,
      amountVes: row.amountVes,
      observacion: row.observacion,
    });
    imported++;
  }

  return { ok: true, imported, errors };
}
