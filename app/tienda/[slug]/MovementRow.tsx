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
  const [saving, setSaving] = useState(false);
  const [amountUsdInput, setAmountUsdInput] = useState(movement.amount_usd);
  const [amountVesInput, setAmountVesInput] = useState(movement.amount_ves);
  const [conceptInput, setConceptInput] = useState(
    isKnownConcept(movement.concept) ? movement.concept : OTRO_LABEL
  );
  const [customConceptInput, setCustomConceptInput] = useState(
    isKnownConcept(movement.concept) ? '' : movement.concept
  );
  const [typeInput, setTypeInput] = useState<'ingreso' | 'gasto'>(movement.type);
  const [observacionInput, setObservacionInput] = useState(movement.observacion);

  if (!editing) {
    const amountColor = movement.type === 'gasto' ? 'text-rose-600' : 'text-emerald-600';
    return (
      <tr className="border-b border-slate-100 hover:bg-slate-50">
        <td className="p-3">
          <span className="text-slate-800">{movement.concept}</span>
          <span
            className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
              movement.type === 'gasto'
                ? 'bg-rose-50 text-rose-600'
                : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            {movement.type === 'gasto' ? 'Gasto' : 'Ingreso'}
          </span>
          <p className="mt-0.5 text-xs text-slate-500">{movement.observacion}</p>
        </td>
        <td className={`p-3 text-right font-medium ${amountColor}`}>
          {signedAmount(movement, 'amount_usd')}
        </td>
        <td className={`p-3 text-right font-medium ${amountColor}`}>
          {signedAmount(movement, 'amount_ves')}
        </td>
        <td className="p-3 text-right">
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
                setObservacionInput(movement.observacion);
                setEditing(true);
              }}
              className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
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
    if (!observacionInput.trim()) {
      setError('La observación es obligatoria.');
      return;
    }

    formData.set('id', String(movement.id));
    formData.set('slug', slug);
    formData.set('date', movement.date);
    formData.set('concept', concept);
    formData.set('type', typeInput);
    formData.set('observacion', observacionInput.trim());

    setSaving(true);
    const result = await updateMovementAction(formData);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar este movimiento?')) return;
    const formData = new FormData();
    formData.set('id', String(movement.id));
    formData.set('slug', slug);
    setSaving(true);
    const result = await deleteMovementAction(formData);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
    }
  }

  return (
    <tr className="border-b border-slate-100 bg-slate-50">
      <td colSpan={4} className="p-3">
        <form action={handleUpdate} className="space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <select
              name="concept"
              value={conceptInput}
              onChange={(e) => setConceptInput(e.target.value)}
              className="col-span-2 rounded-md border border-slate-300 bg-white p-2 text-sm sm:col-span-1"
            >
              {CONCEPTS.map((c) => (
                <option key={c.label} value={c.label}>
                  {c.label}
                </option>
              ))}
              <option value={OTRO_LABEL}>{OTRO_LABEL}</option>
            </select>
            {conceptInput === OTRO_LABEL && (
              <input
                type="text"
                name="customConcept"
                value={customConceptInput}
                onChange={(e) => setCustomConceptInput(e.target.value)}
                placeholder="Concepto libre"
                className="col-span-2 rounded-md border border-slate-300 bg-white p-2 text-sm sm:col-span-1"
              />
            )}
            <select
              name="type"
              value={typeInput}
              onChange={(e) => setTypeInput(e.target.value as 'ingreso' | 'gasto')}
              className="rounded-md border border-slate-300 bg-white p-2 text-sm"
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
              placeholder="Monto USD"
              className="rounded-md border border-slate-300 bg-white p-2 text-sm"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              name="amountVes"
              value={amountVesInput}
              onChange={(e) => setAmountVesInput(e.target.value)}
              placeholder="Monto Bs"
              className="rounded-md border border-slate-300 bg-white p-2 text-sm"
            />
            <textarea
              name="observacion"
              value={observacionInput}
              onChange={(e) => setObservacionInput(e.target.value)}
              placeholder="Observación"
              rows={2}
              className="col-span-2 rounded-md border border-slate-300 bg-white p-2 text-sm sm:col-span-4"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setEditing(false);
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="ml-auto rounded-md border border-rose-200 px-3 py-2 text-sm text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
            >
              Eliminar
            </button>
          </div>
        </form>
        {error && (
          <p className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </td>
    </tr>
  );
}
