'use client';

import { useRef, useState } from 'react';
import { importStoreMovementsAction, type ImportActionResult } from './actions';

export default function ImportForm({ storeId, slug }: { storeId: number; slug: string }) {
  const [result, setResult] = useState<ImportActionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setResult(null);
    formData.set('storeId', String(storeId));
    formData.set('slug', slug);
    setSubmitting(true);
    const response = await importStoreMovementsAction(formData);
    setSubmitting(false);
    setResult(response);
    if (response.ok) {
      formRef.current?.reset();
    }
  }

  return (
    <form ref={formRef} action={handleSubmit} className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-900">Importar Excel</h2>
      <p className="text-sm text-slate-500">Solo se importan filas fechadas hoy.</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          name="file"
          accept=".xlsx"
          required
          className="flex-1 rounded-lg border border-slate-300 p-2 text-sm"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
        >
          {submitting ? 'Importando...' : 'Importar'}
        </button>
      </div>

      {result && !result.ok && (
        <p className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{result.error}</p>
      )}
      {result && result.ok && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="font-medium text-slate-800">
            {result.imported} importados, {result.errors.length} con error.
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-slate-600">
              {result.errors.map((e) => (
                <li key={e.row}>
                  Fila {e.row}: {e.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
