'use client';

import { useState } from 'react';
import { updateMovementAction, deleteMovementAction } from './actions';
import { CONCEPTS, OTRO_LABEL } from '@/lib/concepts';
import { signedAmount } from '@/lib/movementDisplay';
import type { Movement } from '@/lib/movements';

function isKnownConcept(concept: string): boolean {
  return CONCEPTS.some((c) => c.label === concept);
}

export default function MovementRow({
  movement,
  slug,
  readOnly,
}: {
  movement: Movement;
  slug: string;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountUsdInput, setAmountUsdInput] = useState(movement.amount_usd);
  const [amountVesInput, setAmountVesInput] = useState(movement.amount_ves);
  const [conceptInput, setConceptInput] = useState(
    isKnownConcept(movement.concept) ? movement.concept : OTRO_LABEL
  );
  const [customConceptInput, setCustomConceptInput] = useState(
    isKnownConcept(movement.concept) ? '' : movement.concept
  );
  const [typeInput, setTypeInput] = useState<'ingreso' | 'gasto'>(movement.type);

  if (!editing) {
    return (
      <tr className="border-b">
        <td className="p-2">{movement.concept}</td>
        <td className="p-2 text-right">{signedAmount(movement, 'amount_usd')}</td>
        <td className="p-2 text-right">{signedAmount(movement, 'amount_ves')}</td>
        <td className="p-2 text-right">
          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setAmountUsdInput(movement.amount_usd);
                setAmountVesInput(movement.amount_ves);
                setConceptInput(isKnownConcept(movement.concept) ? movement.concept : OTRO_LABEL);
                setCustomConceptInput(isKnownConcept(movement.concept) ? '' : movement.concept);
                setTypeInput(movement.type);
                setEditing(true);
              }}
              className="text-blue-600"
            >
              Editar
            </button>
          )}
        </td>
      </tr>
    );
  }

  async function handleUpdate(formData: FormData) {
    setError(null);
    const concept = conceptInput === OTRO_LABEL ? customConceptInput.trim() : conceptInput;
    const amountUsd = Number(amountUsdInput || 0);
    const amountVes = Number(amountVesInput || 0);

    if (!concept) {
      setError('Indica el concepto.');
      return;
    }
    if (amountUsd <= 0 && amountVes <= 0) {
      setError('Debe indicar un monto en USD o en Bs mayor a cero.');
      return;
    }

    formData.set('id', String(movement.id));
    formData.set('slug', slug);
    formData.set('date', movement.date);
    formData.set('concept', concept);
    formData.set('type', typeInput);

    try {
      await updateMovementAction(formData);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar.');
    }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar este movimiento?')) return;
    const formData = new FormData();
    formData.set('id', String(movement.id));
    formData.set('slug', slug);
    try {
      await deleteMovementAction(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar.');
    }
  }

  return (
    <tr className="border-b bg-gray-50">
      <td colSpan={4} className="p-2">
        <form action={handleUpdate} className="flex flex-wrap items-center gap-2">
          <select
            name="concept"
            value={conceptInput}
            onChange={(e) => setConceptInput(e.target.value)}
            className="rounded border p-1"
          >
            {CONCEPTS.map((c) => (
              <option key={c.label} value={c.label}>
                {c.label}
              </option>
            ))}
            <option value={OTRO_LABEL}>{OTRO_LABEL}</option>
          </select>
          <input
            type="text"
            name="customConcept"
            value={customConceptInput}
            onChange={(e) => setCustomConceptInput(e.target.value)}
            placeholder="Concepto libre"
            className="rounded border p-1"
          />
          <select
            name="type"
            value={typeInput}
            onChange={(e) => setTypeInput(e.target.value as 'ingreso' | 'gasto')}
            className="rounded border p-1"
          >
            <option value="ingreso">Ingreso</option>
            <option value="gasto">Gasto</option>
          </select>
          <input
            type="number"
            step="0.01"
            min="0"
            name="amountUsd"
            value={amountUsdInput}
            onChange={(e) => setAmountUsdInput(e.target.value)}
            className="w-24 rounded border p-1"
          />
          <input
            type="number"
            step="0.01"
            min="0"
            name="amountVes"
            value={amountVesInput}
            onChange={(e) => setAmountVesInput(e.target.value)}
            className="w-24 rounded border p-1"
          />
          <button type="submit" className="rounded bg-blue-600 px-2 py-1 text-white">
            Guardar
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setEditing(false);
            }}
            className="rounded border px-2 py-1"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded border border-red-600 px-2 py-1 text-red-600"
          >
            Eliminar
          </button>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </td>
    </tr>
  );
}
