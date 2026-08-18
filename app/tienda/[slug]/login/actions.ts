'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { attemptStorePinLogin } from '@/lib/stores';
import { signStoreSession, storeSessionCookieName } from '@/lib/storeAuth';

export interface PinActionState {
  error: string | null;
}

export async function verifyPinAction(
  _prevState: PinActionState,
  formData: FormData
): Promise<PinActionState> {
  const slug = String(formData.get('slug') ?? '');
  const pin = String(formData.get('pin') ?? '');

  const result = await attemptStorePinLogin(slug, pin);

  if (result.pinNotConfigured) {
    return { error: 'Esta tienda no tiene PIN configurado todavia.' };
  }
  if (result.locked) {
    return {
      error: `Tienda bloqueada temporalmente. Intenta de nuevo en ${result.minutesRemaining} minuto(s).`,
    };
  }
  if (!result.success) {
    return { error: 'PIN incorrecto.' };
  }

  const cookieStore = await cookies();
  cookieStore.set(storeSessionCookieName(slug), signStoreSession(slug), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  });

  redirect(`/tienda/${slug}`);
}
