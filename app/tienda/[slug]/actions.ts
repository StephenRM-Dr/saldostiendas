'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createMovement, updateMovement, deleteMovement, getDayLedger } from '@/lib/movements';
import { getStoreBySlug } from '@/lib/stores';
import { formatReportMessage, sendTelegramPhoto } from '@/lib/telegram';
import { generateReportImageBuffer } from '@/lib/reportImage';
import { storeSessionCookieName } from '@/lib/storeAuth';

function parseAndValidate(formData: FormData) {
  const concept = String(formData.get('concept') ?? '').trim();
  const type = formData.get('type') === 'gasto' ? 'gasto' : 'ingreso';
  const amountUsd = Number(formData.get('amountUsd') || 0);
  const amountVes = Number(formData.get('amountVes') || 0);
  const date = String(formData.get('date') ?? '');

  if (!concept) {
    throw new Error('El concepto es obligatorio.');
  }
  if (amountUsd <= 0 && amountVes <= 0) {
    throw new Error('Debe indicar un monto en USD o en Bs mayor a cero.');
  }

  return { concept, type: type as 'ingreso' | 'gasto', amountUsd, amountVes, date };
}

export async function addMovementAction(formData: FormData) {
  const storeId = Number(formData.get('storeId'));
  const slug = String(formData.get('slug'));
  const { concept, type, amountUsd, amountVes, date } = parseAndValidate(formData);

  await createMovement({ storeId, date, concept, type, amountUsd, amountVes });
  revalidatePath(`/tienda/${slug}`);
}

export async function updateMovementAction(formData: FormData) {
  const id = Number(formData.get('id'));
  const slug = String(formData.get('slug'));
  const { concept, type, amountUsd, amountVes, date } = parseAndValidate(formData);

  await updateMovement(id, { date, concept, type, amountUsd, amountVes });
  revalidatePath(`/tienda/${slug}`);
}

export async function deleteMovementAction(formData: FormData) {
  const id = Number(formData.get('id'));
  const slug = String(formData.get('slug'));
  await deleteMovement(id);
  revalidatePath(`/tienda/${slug}`);
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
