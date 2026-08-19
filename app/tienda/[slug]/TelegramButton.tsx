'use client';

import { useState } from 'react';
import { sendReportAction } from './actions';

export default function TelegramButton({ slug, date }: { slug: string; date: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setStatus('sending');
    setError(null);

    const formData = new FormData();
    formData.set('slug', slug);
    formData.set('date', date);

    try {
      await sendReportAction(formData);
      setStatus('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar el reporte.');
      setStatus('idle');
    }
  }

  return (
    <div className="mt-2 border-t border-slate-100 pt-2">
      <button
        type="button"
        onClick={handleSend}
        disabled={status === 'sending'}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
      >
        {status === 'sending' ? 'Enviando...' : 'Enviar reporte a Telegram'}
      </button>
      {status === 'sent' && (
        <p className="mt-1 text-sm text-emerald-700">Reporte enviado correctamente.</p>
      )}
      {error && (
        <p className="mt-1 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
