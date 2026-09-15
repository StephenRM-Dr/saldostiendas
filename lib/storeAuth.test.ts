import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  storeSessionCookieName,
  signStoreSession,
  verifyStoreSession,
  checkStoreSession,
} from './storeAuth';

const now = new Date('2026-08-18T12:00:00.000Z');
const ORIGINAL_SECRET = process.env.SESSION_SECRET;
const SESSION_ID = 'session-abc-123';

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
  it('verifies a freshly signed session for the same slug and session id', () => {
    const cookie = signStoreSession('barinas', SESSION_ID, now);
    expect(verifyStoreSession(cookie, 'barinas', SESSION_ID, now)).toBe(true);
  });

  it('rejects a session signed for a different slug', () => {
    const cookie = signStoreSession('barinas', SESSION_ID, now);
    expect(verifyStoreSession(cookie, 'maracaibo', SESSION_ID, now)).toBe(false);
  });

  it('rejects a tampered signature', () => {
    const cookie = signStoreSession('barinas', SESSION_ID, now);
    const tampered = cookie.slice(0, -1) + (cookie.endsWith('a') ? 'b' : 'a');
    expect(verifyStoreSession(tampered, 'barinas', SESSION_ID, now)).toBe(false);
  });

  it('rejects an expired session', () => {
    const cookie = signStoreSession('barinas', SESSION_ID, now);
    const justAfterExpiry = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
    expect(verifyStoreSession(cookie, 'barinas', SESSION_ID, justAfterExpiry)).toBe(false);
  });

  it('accepts a session checked just before expiry', () => {
    const cookie = signStoreSession('barinas', SESSION_ID, now);
    const justBeforeExpiry = new Date(now.getTime() + 29 * 24 * 60 * 60 * 1000);
    expect(verifyStoreSession(cookie, 'barinas', SESSION_ID, justBeforeExpiry)).toBe(true);
  });

  it('rejects a missing cookie value', () => {
    expect(verifyStoreSession(undefined, 'barinas', SESSION_ID, now)).toBe(false);
  });

  it('rejects a malformed cookie value', () => {
    expect(verifyStoreSession('not-a-valid-cookie', 'barinas', SESSION_ID, now)).toBe(false);
  });

  it('fails closed when SESSION_SECRET is not configured', () => {
    const cookie = signStoreSession('barinas', SESSION_ID, now);
    delete process.env.SESSION_SECRET;
    expect(verifyStoreSession(cookie, 'barinas', SESSION_ID, now)).toBe(false);
  });

  it('rejects a valid, correctly signed cookie whose session id was replaced by a newer login', () => {
    const cookie = signStoreSession('barinas', SESSION_ID, now);
    expect(verifyStoreSession(cookie, 'barinas', 'a-newer-session-id', now)).toBe(false);
  });

  it('rejects a cookie when the store has no active session (e.g. after logout)', () => {
    const cookie = signStoreSession('barinas', SESSION_ID, now);
    expect(verifyStoreSession(cookie, 'barinas', null, now)).toBe(false);
  });
});

describe('checkStoreSession', () => {
  it('returns "valid" when the cookie matches the current session id', () => {
    const cookie = signStoreSession('barinas', SESSION_ID, now);
    expect(checkStoreSession(cookie, 'barinas', SESSION_ID, now)).toBe('valid');
  });

  it('returns "replaced" when a well-signed cookie lost to a newer login', () => {
    const cookie = signStoreSession('barinas', SESSION_ID, now);
    expect(checkStoreSession(cookie, 'barinas', 'a-newer-session-id', now)).toBe('replaced');
  });

  it('returns "none" instead of "replaced" when the store has no active session', () => {
    const cookie = signStoreSession('barinas', SESSION_ID, now);
    expect(checkStoreSession(cookie, 'barinas', null, now)).toBe('none');
  });

  it('returns "none" for a missing cookie', () => {
    expect(checkStoreSession(undefined, 'barinas', SESSION_ID, now)).toBe('none');
  });

  it('returns "none" for a tampered cookie even if a session is active', () => {
    const cookie = signStoreSession('barinas', SESSION_ID, now);
    const tampered = cookie.slice(0, -1) + (cookie.endsWith('a') ? 'b' : 'a');
    expect(checkStoreSession(tampered, 'barinas', SESSION_ID, now)).toBe('none');
  });

  it('returns "none" for an expired cookie even if the session id still matches', () => {
    const cookie = signStoreSession('barinas', SESSION_ID, now);
    const justAfterExpiry = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
    expect(checkStoreSession(cookie, 'barinas', SESSION_ID, justAfterExpiry)).toBe('none');
  });
});
