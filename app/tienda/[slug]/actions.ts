'use server';

import { revalidatePath } from 'next/cache';
import { createMovement, updateMovement, deleteMovement } from '@/lib/movements';

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
