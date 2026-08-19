'use client';

import { useState } from 'react';
import { addMovementAction } from './actions';
import { CONCEPTS, OTRO_LABEL } from '@/lib/concepts';

export default function MovementForm({
  storeId,
  slug,
  date,
}: {
  storeId: number;
  slug: string;
  date: string;
}) {
  const [conceptLabel, setConceptLabel] = useState(CONCEPTS[0].label);
  const [customConcept, setCustomConcept] = useState('');
  const [type, setType] = useState<'ingreso' | 'gasto'>(CONCEPTS[0].type);
  const [amountUsdInput, setAmountUsdInput] = useState('0');
  const [amountVesInput, setAmountVesInput] = useState('0');
  const [error, setError] = useState<string | null>(null);

  function handleConceptChange(label: string) {
    setConceptLabel(label);
    const found = CONCEPTS.find((c) => c.label === label);
    if (found) setType(found.type);
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    const finalConcept = conceptLabel === OTRO_LABEL ? customConcept.trim() : conceptLabel;
    const amountUsd = Number(amountUsdInput || 0);
    const amountVes = Number(amountVesInput || 0);

    if (!finalConcept) {
      setError('Indica el concepto.');
      return;
    }
    if (amountUsd <= 0 && amountVes <= 0) {
      setError('Debe indicar un monto en USD o en Bs mayor a cero.');
      return;
    }

    formData.set('concept', finalConcept);
    formData.set('type', type);
    formData.set('storeId', String(storeId));
    formData.set('slug', slug);

    const result = await addMovementAction(formData);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConceptLabel(CONCEPTS[0].label);
    setType(CONCEPTS[0].type);
    setCustomConcept('');
    setAmountUsdInput('0');
    setAmountVesInput('0');
  }

  return (
    <form action={handleSubmit} className="mt-6 space-y-3 rounded-lg border p-4">
      <h2 className="font-semibold">Agregar movimiento</h2>

      <input type="hidden" name="date" value={date} />

      <div>
        <label className="block text-sm">Concepto</label>
        <select
          value={conceptLabel}
          onChange={(e) => handleConceptChange(e.target.value)}
          className="w-full rounded border p-2"
        >
          {CONCEPTS.map((c) => (
            <option key={c.label} value={c.label}>
              {c.label}
            </option>
          ))}
          <option value={OTRO_LABEL}>{OTRO_LABEL}</option>
        </select>
      </div>

      {conceptLabel === OTRO_LABEL && (
        <div>
          <label className="block text-sm">Especifica el concepto</label>
          <input
            type="text"
            value={customConcept}
            onChange={(e) => setCustomConcept(e.target.value)}
            className="w-full rounded border p-2"
          />
        </div>
      )}

      <div>
        <span className="block text-sm">Tipo</span>
        <div className="flex gap-4">
          <label className="flex items-center gap-1">
            <input type="radio" checked={type === 'ingreso'} onChange={() => setType('ingreso')} />
            Ingreso
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" checked={type === 'gasto'} onChange={() => setType('gasto')} />
            Gasto
          </label>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-sm">Monto USD</label>
          <input
            type="number"
            step="0.01"
            min="0"
            name="amountUsd"
            value={amountUsdInput}
            onChange={(e) => setAmountUsdInput(e.target.value)}
            className="w-full rounded border p-2"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm">Monto Bs</label>
          <input
            type="number"
            step="0.01"
            min="0"
            name="amountVes"
            value={amountVesInput}
            onChange={(e) => setAmountVesInput(e.target.value)}
            className="w-full rounded border p-2"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
        Agregar
      </button>
    </form>
  );
}
