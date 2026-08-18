'use client';

import { useState, type FormEvent } from 'react';

export default function AdminExportForm() {
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const from = String(formData.get('from') ?? '');
    const to = String(formData.get('to') ?? '');
    setError(null);

    if (!from || !to) {
      event.preventDefault();
      setError('Debe indicar ambas fechas.');
      return;
    }
    if (from > to) {
      event.preventDefault();
      setError('La fecha "desde" no puede ser posterior a "hasta".');
      return;
    }
    // Valid: let the native GET form submission proceed — the browser
    // navigates to /api/admin/export?from=...&to=... and downloads the file.
  }

  return (
    <form action="/api/admin/export" method="get" onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm">Desde</label>
        <input type="date" name="from" required className="w-full rounded border p-2" />
      </div>
      <div>
        <label className="block text-sm">Hasta</label>
        <input type="date" name="to" required className="w-full rounded border p-2" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
        Descargar Excel
      </button>
    </form>
  );
}
