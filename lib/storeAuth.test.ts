import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { storeSessionCookieName, signStoreSession, verifyStoreSession } from './storeAuth';

const now = new Date('2026-08-18T12:00:00.000Z');
const ORIGINAL_SECRET = process.env.SESSION_SECRET;

beforeEach(() => {
  process.env.SESSION_SECRET = 'test-secret-value';
});

afterEach(() => {
  process.env.SESSION_SECRET = ORIGINAL_SECRET;
});

describe('storeSessionCookieName', () => {
  it('namespaces the cookie by slug', () => {
    expect(storeSessionCookieName('barinas')).toBe('store_session_barinas');
  });
});

describe('signStoreSession / verifyStoreSession', () => {
  it('verifies a freshly signed session for the same slug', () => {
    const cookie = signStoreSession('barinas', now);
    expect(verifyStoreSession(cookie, 'barinas', now)).toBe(true);
  });

  it('rejects a session signed for a different slug', () => {
    const cookie = signStoreSession('barinas', now);
    expect(verifyStoreSession(cookie, 'maracaibo', now)).toBe(false);
  });

  it('rejects a tampered signature', () => {
    const cookie = signStoreSession('barinas', now);
    const tampered = cookie.slice(0, -1) + (cookie.endsWith('a') ? 'b' : 'a');
    expect(verifyStoreSession(tampered, 'barinas', now)).toBe(false);
  });

  it('rejects an expired session', () => {
    const cookie = signStoreSession('barinas', now);
    const justAfterExpiry = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
    expect(verifyStoreSession(cookie, 'barinas', justAfterExpiry)).toBe(false);
  });

  it('accepts a session checked just before expiry', () => {
    const cookie = signStoreSession('barinas', now);
    const justBeforeExpiry = new Date(now.getTime() + 29 * 24 * 60 * 60 * 1000);
    expect(verifyStoreSession(cookie, 'barinas', justBeforeExpiry)).toBe(true);
  });

  it('rejects a missing cookie value', () => {
    expect(verifyStoreSession(undefined, 'barinas', now)).toBe(false);
  });

  it('rejects a malformed cookie value', () => {
    expect(verifyStoreSession('not-a-valid-cookie', 'barinas', now)).toBe(false);
  });

  it('fails closed when SESSION_SECRET is not configured', () => {
    const cookie = signStoreSession('barinas', now);
    delete process.env.SESSION_SECRET;
    expect(verifyStoreSession(cookie, 'barinas', now)).toBe(false);
  });
});
