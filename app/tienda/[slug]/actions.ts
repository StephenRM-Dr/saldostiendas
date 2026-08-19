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
import { formatReportMessage, sendTelegramPhoto } from '@/lib/telegram';
import { generateReportImageBuffer } from '@/lib/reportImage';
import { storeSessionCookieName } from '@/lib/storeAuth';
import { isDateClosed, isValidISODate } from '@/lib/date';

type ActionResult = { ok: true } | { ok: false; error: string };

const DAY_CLOSED_ERROR = 'No se pueden modificar movimientos de un día ya cerrado.';
const INVALID_ID_ERROR = 'Identificador inválido.';

type ParsedMovement = {
  concept: string;
  type: 'ingreso' | 'gasto';
  amountUsd: number;
  amountVes: number;
  date: string;
};

function parseAndValidate(
  formData: FormData
): { ok: true; data: ParsedMovement } | { ok: false; error: string } {
  const concept = String(formData.get('concept') ?? '').trim();
  const type = formData.get('type') === 'gasto' ? 'gasto' : 'ingreso';
  const amountUsd = Number(formData.get('amountUsd') || 0);
  const amountVes = Number(formData.get('amountVes') || 0);
  const date = String(formData.get('date') ?? '');

  if (!concept) {
    return { ok: false, error: 'El concepto es obligatorio.' };
  }
  if (amountUsd <= 0 && amountVes <= 0) {
    return { ok: false, error: 'Debe indicar un monto en USD o en Bs mayor a cero.' };
  }
  if (!isValidISODate(date)) {
    return { ok: false, error: 'La fecha del movimiento no es válida.' };
  }

  return { ok: true, data: { concept, type: type as 'ingreso' | 'gasto', amountUsd, amountVes, date } };
}

export async function addMovementAction(formData: FormData): Promise<ActionResult> {
  const storeId = Number(formData.get('storeId'));
  const slug = String(formData.get('slug'));

  if (!Number.isInteger(storeId)) {
    return { ok: false, error: INVALID_ID_ERROR };
  }

  const parsed = parseAndValidate(formData);
  if (!parsed.ok) {
    return parsed;
  }
  const { concept, type, amountUsd, amountVes, date } = parsed.data;

  if (isDateClosed(date)) {
    return { ok: false, error: DAY_CLOSED_ERROR };
  }

  await createMovement({ storeId, date, concept, type, amountUsd, amountVes });
  revalidatePath(`/tienda/${slug}`);
  return { ok: true };
}

export async function updateMovementAction(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get('id'));
  const slug = String(formData.get('slug'));

  if (!Number.isInteger(id)) {
    return { ok: false, error: INVALID_ID_ERROR };
  }

  const parsed = parseAndValidate(formData);
  if (!parsed.ok) {
    return parsed;
  }
  const { concept, type, amountUsd, amountVes, date } = parsed.data;

  const persistedDate = await getMovementDate(id);
  if (persistedDate === null || isDateClosed(persistedDate) || isDateClosed(date)) {
    return { ok: false, error: DAY_CLOSED_ERROR };
  }

  await updateMovement(id, { date, concept, type, amountUsd, amountVes });
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

  const ledger = await getDayLedger(store.id, date);
  const caption = formatReportMessage(store.name, date, ledger, 'Reporte de Saldos');
  const imageBuffer = await generateReportImageBuffer(store.name, date, ledger, 'Reporte de Saldos');
  await sendTelegramPhoto(store.telegram_chat_id, imageBuffer, caption);
}

export async function logoutAction(formData: FormData) {
  const slug = String(formData.get('slug'));
  const cookieStore = await cookies();
  cookieStore.delete(storeSessionCookieName(slug));
  redirect(`/tienda/${slug}/login`);
}
