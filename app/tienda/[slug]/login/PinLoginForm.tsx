'use client';

import { useActionState } from 'react';
import { verifyPinAction, type PinActionState } from './actions';

const initialState: PinActionState = { error: null };

export default function PinLoginForm({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState(verifyPinAction, initialState);

  return (
    <form action={formAction} className="mt-5 space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input
        type="text"
        name="pin"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        required
        autoFocus
        className="w-full rounded-lg border border-slate-300 p-3 text-center text-2xl tracking-[0.5em] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
      />
      {state.error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? 'Verificando...' : 'Entrar'}
      </button>
    </form>
  );
}
