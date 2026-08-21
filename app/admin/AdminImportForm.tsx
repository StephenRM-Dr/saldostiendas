'use client';

import { useRef, useState } from 'react';
import { importMovementsAction, type ImportActionResult } from './actions';

export default function AdminImportForm() {
  const [result, setResult] = useState<ImportActionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setResult(null);
    setSubmitting(true);
    const response = await importMovementsAction(formData);
    setSubmitting(false);
    setResult(response);
    if (response.ok) {
      formRef.current?.reset();
    }
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-900">Importar Excel</h2>
      <p className="text-sm text-slate-500">
        Acepta cualquier fecha, incluyendo días ya cerrados — úsalo para cargar historial.
      </p>
      <div>
        <label htmlFor="admin-file" className="mb-1 block text-sm text-slate-600">
          Archivo (.xlsx)
        </label>
        <input
          id="admin-file"
          type="file"
          name="file"
          accept=".xlsx"
          required
          className="w-full rounded-lg border border-slate-300 p-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? 'Importando...' : 'Importar'}
      </button>

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
