import { createHmac, timingSafeEqual } from 'node:crypto';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function storeSessionCookieName(slug: string): string {
  return `store_session_${slug}`;
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function signStoreSession(slug: string, now: Date = new Date()): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET no esta configurado en el servidor.');
  }
  const expires = now.getTime() + THIRTY_DAYS_MS;
  const payload = `${slug}.${expires}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyStoreSession(
  cookieValue: string | undefined,
  slug: string,
  now: Date = new Date()
): boolean {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !cookieValue) return false;

  const parts = cookieValue.split('.');
  if (parts.length !== 3) return false;
  const [cookieSlug, expiresStr, signature] = parts;
  if (cookieSlug !== slug) return false;

  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || expires < now.getTime()) return false;

  const expectedSignature = sign(`${cookieSlug}.${expiresStr}`, secret);
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  const actualBuffer = Buffer.from(signature, 'hex');
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}
