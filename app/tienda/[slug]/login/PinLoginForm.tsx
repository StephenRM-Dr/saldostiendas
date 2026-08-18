'use client';

import { useActionState } from 'react';
import { verifyPinAction, type PinActionState } from './actions';

const initialState: PinActionState = { error: null };

export default function PinLoginForm({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState(verifyPinAction, initialState);

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input
        type="text"
        name="pin"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        required
        autoFocus
        className="w-full rounded border p-2 text-center text-2xl tracking-[0.5em]"
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? 'Verificando...' : 'Entrar'}
      </button>
    </form>
  );
}
