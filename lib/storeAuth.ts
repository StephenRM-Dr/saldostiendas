import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function storeSessionCookieName(slug: string): string {
  return `store_session_${slug}`;
}

export function generateSessionId(): string {
  return randomBytes(16).toString('hex');
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function signStoreSession(slug: string, sessionId: string, now: Date = new Date()): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET no esta configurado en el servidor.');
  }
  const expires = now.getTime() + THIRTY_DAYS_MS;
  const payload = `${slug}.${sessionId}.${expires}`;
  return `${payload}.${sign(payload, secret)}`;
}

export type StoreSessionStatus = 'valid' | 'none' | 'replaced';

/**
 * Checks a session cookie against the store's currently active session id
 * (persisted in `stores.session_id`, overwritten on every successful PIN
 * login). Only one session id is valid per store at a time, so logging in
 * from a new device invalidates every other browser's cookie.
 *
 * 'replaced' is only returned for a structurally valid, correctly signed
 * cookie whose session id lost to a newer login — it lets the login page
 * explain why the visitor got bounced, instead of looking like they were
 * never logged in.
 */
export function checkStoreSession(
  cookieValue: string | undefined,
  slug: string,
  currentSessionId: string | null,
  now: Date = new Date()
): StoreSessionStatus {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !cookieValue) return 'none';

  const parts = cookieValue.split('.');
  if (parts.length !== 4) return 'none';
  const [cookieSlug, cookieSessionId, expiresStr, signature] = parts;
  if (cookieSlug !== slug) return 'none';

  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || expires < now.getTime()) return 'none';

  const expectedSignature = sign(`${cookieSlug}.${cookieSessionId}.${expiresStr}`, secret);
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  const actualBuffer = Buffer.from(signature, 'hex');
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return 'none';
  }

  if (cookieSessionId === currentSessionId) return 'valid';
  return currentSessionId !== null ? 'replaced' : 'none';
}

export function verifyStoreSession(
  cookieValue: string | undefined,
  slug: string,
  currentSessionId: string | null,
  now: Date = new Date()
): boolean {
  return checkStoreSession(cookieValue, slug, currentSessionId, now) === 'valid';
}
