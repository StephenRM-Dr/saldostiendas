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
  const [submitting, setSubmitting] = useState(false);

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

    setSubmitting(true);
    const result = await addMovementAction(formData);
    setSubmitting(false);
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
    <form action={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-900">Agregar movimiento</h2>

      <input type="hidden" name="date" value={date} />

      <div>
        <label htmlFor="concept" className="mb-1 block text-sm text-slate-600">
          Concepto
        </label>
        <select
          id="concept"
          value={conceptLabel}
          onChange={(e) => handleConceptChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
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
          <label htmlFor="customConcept" className="mb-1 block text-sm text-slate-600">
            Especifica el concepto
          </label>
          <input
            id="customConcept"
            type="text"
            value={customConcept}
            onChange={(e) => setCustomConcept(e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
        </div>
      )}

      <div>
        <span className="mb-1 block text-sm text-slate-600">Tipo</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setType('ingreso')}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
              type === 'ingreso'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : 'border-slate-300 text-slate-500 hover:bg-slate-50'
            }`}
          >
            Ingreso
          </button>
          <button
            type="button"
            onClick={() => setType('gasto')}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
              type === 'gasto'
                ? 'border-rose-300 bg-rose-50 text-rose-700'
                : 'border-slate-300 text-slate-500 hover:bg-slate-50'
            }`}
          >
            Gasto
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="amountUsd" className="mb-1 block text-sm text-slate-600">
            Monto USD
          </label>
          <div className="flex items-center rounded-lg border border-slate-300 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-200">
            <span className="pl-2.5 text-sm text-slate-400">$</span>
            <input
              id="amountUsd"
              type="number"
              step="0.01"
              min="0"
              name="amountUsd"
              value={amountUsdInput}
              onChange={(e) => setAmountUsdInput(e.target.value)}
              className="w-full rounded-lg p-2.5 text-sm outline-none"
            />
          </div>
        </div>
        <div className="flex-1">
          <label htmlFor="amountVes" className="mb-1 block text-sm text-slate-600">
            Monto Bs
          </label>
          <div className="flex items-center rounded-lg border border-slate-300 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-200">
            <span className="pl-2.5 text-sm text-slate-400">Bs</span>
            <input
              id="amountVes"
              type="number"
              step="0.01"
              min="0"
              name="amountVes"
              value={amountVesInput}
              onChange={(e) => setAmountVesInput(e.target.value)}
              className="w-full rounded-lg p-2.5 text-sm outline-none"
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
      >
        {submitting ? 'Agregando...' : 'Agregar'}
      </button>
    </form>
  );
}
