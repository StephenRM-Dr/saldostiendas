'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  createMovement,
  updateMovement,
  deleteMovement,
  getDayLedger,
  getMovementDate,
} from '@/lib/movements';
import { getStoreBySlug } from '@/lib/stores';
import { sendTelegramPhoto } from '@/lib/telegram';
import { generateReportImageBuffer } from '@/lib/reportImage';
import { storeSessionCookieName } from '@/lib/storeAuth';
import { isDateClosed, isValidISODate, todayISOCaracas } from '@/lib/date';
import { parseMovementWorkbook, type ImportRowError } from '@/lib/movementImport';

type ActionResult = { ok: true } | { ok: false; error: string };

export type ImportActionResult =
  | { ok: true; imported: number; errors: ImportRowError[] }
  | { ok: false; error: string };

const DAY_CLOSED_ERROR = 'No se pueden modificar movimientos de un día ya cerrado.';
const INVALID_ID_ERROR = 'Identificador inválido.';

type ParsedMovement = {
  concept: string;
  type: 'ingreso' | 'gasto';
  amountUsd: number;
  amountVes: number;
  amountCop: number;
  date: string;
  observacion: string;
};

function parseAndValidate(
  formData: FormData,
  hasCop: boolean
): { ok: true; data: ParsedMovement } | { ok: false; error: string } {
  const concept = String(formData.get('concept') ?? '').trim();
  const type = formData.get('type') === 'gasto' ? 'gasto' : 'ingreso';
  const amountUsd = Number(formData.get('amountUsd') || 0);
  const amountVes = Number(formData.get('amountVes') || 0);
  const amountCop = hasCop ? Number(formData.get('amountCop') || 0) : 0;
  const date = String(formData.get('date') ?? '');
  const observacion = String(formData.get('observacion') ?? '').trim();

  if (!concept) {
    return { ok: false, error: 'El concepto es obligatorio.' };
  }
  if (amountUsd <= 0 && amountVes <= 0 && amountCop <= 0) {
    const currencies = hasCop ? 'USD, Bs o COP' : 'USD o Bs';
    return { ok: false, error: `Debe indicar un monto en ${currencies} mayor a cero.` };
  }
  if (!isValidISODate(date)) {
    return { ok: false, error: 'La fecha del movimiento no es válida.' };
  }
  if (!observacion) {
    return { ok: false, error: 'La observación es obligatoria.' };
  }

  return {
    ok: true,
    data: {
      concept,
      type: type as 'ingreso' | 'gasto',
      amountUsd,
      amountVes,
      amountCop,
      date,
      observacion,
    },
  };
}

export async function addMovementAction(formData: FormData): Promise<ActionResult> {
  const storeId = Number(formData.get('storeId'));
  const slug = String(formData.get('slug'));

  if (!Number.isInteger(storeId)) {
    return { ok: false, error: INVALID_ID_ERROR };
  }

  const parsed = parseAndValidate(formData, slug === 'san-cristobal');
  if (!parsed.ok) {
    return parsed;
  }
  const { concept, type, amountUsd, amountVes, amountCop, date, observacion } = parsed.data;

  if (isDateClosed(date)) {
    return { ok: false, error: DAY_CLOSED_ERROR };
  }

  await createMovement({ storeId, date, concept, type, amountUsd, amountVes, amountCop, observacion });
  revalidatePath(`/tienda/${slug}`);
  return { ok: true };
}

export async function updateMovementAction(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const slug = String(formData.get('slug'));

  if (!Number.isInteger(id)) {
    return { ok: false, error: INVALID_ID_ERROR };
  }

  const parsed = parseAndValidate(formData, slug === 'san-cristobal');
  if (!parsed.ok) {
    return parsed;
  }
  const { concept, type, amountUsd, amountVes, amountCop, date, observacion } = parsed.data;

  const persistedDate = await getMovementDate(id);
  if (persistedDate === null || isDateClosed(persistedDate) || isDateClosed(date)) {
    return { ok: false, error: DAY_CLOSED_ERROR };
  }

  await updateMovement(id, { date, concept, type, amountUsd, amountVes, amountCop, observacion });
  revalidatePath(`/tienda/${slug}`);
  return { ok: true };
}

export async function deleteMovementAction(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const slug = String(formData.get('slug'));

  if (!Number.isInteger(id)) {
    return { ok: false, error: INVALID_ID_ERROR };
  }

  const persistedDate = await getMovementDate(id);
  if (persistedDate === null || isDateClosed(persistedDate)) {
    return { ok: false, error: DAY_CLOSED_ERROR };
  }

  await deleteMovement(id);
  revalidatePath(`/tienda/${slug}`);
  return { ok: true };
}

export async function sendReportAction(formData: FormData) {
  const slug = String(formData.get('slug'));
  const date = String(formData.get('date'));

  const store = await getStoreBySlug(slug);
  if (!store) {
    throw new Error('Tienda no encontrada.');
  }
  if (!store.telegram_chat_id) {
    throw new Error('Esta tienda no tiene Telegram configurado.');
  }

  const showCop = store.slug === 'san-cristobal';
  const ledger = await getDayLedger(store.id, date);
  const imageBuffer = await generateReportImageBuffer(
    store.name,
    date,
    ledger,
    'Reporte de Saldos',
    showCop
  );
  await sendTelegramPhoto(store.telegram_chat_id, imageBuffer, store.telegram_thread_id);
}

export async function importStoreMovementsAction(formData: FormData): Promise<ImportActionResult> {
  const storeId = Number(formData.get('storeId'));
  const slug = String(formData.get('slug'));

  if (!Number.isInteger(storeId)) {
    return { ok: false, error: INVALID_ID_ERROR };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Selecciona un archivo Excel (.xlsx).' };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseMovementWorkbook(buffer);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const today = todayISOCaracas();
  const errors: ImportRowError[] = [...parsed.errors];
  let imported = 0;

  for (const row of parsed.rows) {
    if (row.date !== today) {
      errors.push({ row: row.row, reason: `Solo se pueden importar movimientos de hoy (${today}).` });
      continue;
    }

    await createMovement({
      storeId,
      date: row.date,
      concept: row.concept,
      type: row.type,
      amountUsd: row.amountUsd,
      amountVes: row.amountVes,
      amountCop: row.amountCop,
      observacion: row.observacion,
    });
    imported++;
  }

  revalidatePath(`/tienda/${slug}`);
  return { ok: true, imported, errors };
}

export async function logoutAction(formData: FormData) {
  const slug = String(formData.get('slug'));
  const cookieStore = await cookies();
  cookieStore.delete(storeSessionCookieName(slug));
  redirect(`/tienda/${slug}/login`);
}
