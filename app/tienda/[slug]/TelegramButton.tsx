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
    <div className="mt-2">
      <button
        type="button"
        onClick={handleSend}
        disabled={status === 'sending'}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {status === 'sending' ? 'Enviando...' : 'Enviar a Telegram'}
      </button>
      {status === 'sent' && <p className="mt-1 text-sm text-green-700">Reporte enviado.</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
