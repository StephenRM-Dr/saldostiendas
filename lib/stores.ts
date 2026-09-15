import { sql } from './db';
import { generateSessionId } from './storeAuth';
import {
  isLocked,
  lockoutMinutesRemaining,
  recordFailedAttempt,
  resetLockout,
  type LockoutState,
} from './pinLockout';

export interface Store {
  id: number;
  slug: string;
  name: string;
  telegram_chat_id: string | null;
  telegram_thread_id: number | null;
  pin: string | null;
  pin_failed_attempts: number;
  pin_locked_until: string | null;
  session_id: string | null;
}

const COP_ENABLED_SLUGS = new Set(['san-cristobal', 'concordia']);

export function storeUsesCop(slug: string): boolean {
  return COP_ENABLED_SLUGS.has(slug);
}

const STORE_COLUMNS =
  'id, slug, name, telegram_chat_id, telegram_thread_id, pin, pin_failed_attempts, pin_locked_until, session_id';

export async function listStores(): Promise<Store[]> {
  return (await sql.query(`select ${STORE_COLUMNS} from stores order by name`)) as Store[];
}

export async function getStoreBySlug(slug: string): Promise<Store | null> {
  const rows = (await sql.query(`select ${STORE_COLUMNS} from stores where slug = $1`, [
    slug,
  ])) as Store[];
  return rows[0] ?? null;
}

export interface PinAttemptResult {
  success: boolean;
  locked: boolean;
  minutesRemaining: number;
  pinNotConfigured: boolean;
  sessionId: string | null;
}

export async function attemptStorePinLogin(
  slug: string,
  pin: string,
  now: Date = new Date()
): Promise<PinAttemptResult> {
  const store = await getStoreBySlug(slug);
  if (!store) {
    return { success: false, locked: false, minutesRemaining: 0, pinNotConfigured: false, sessionId: null };
  }
  if (!store.pin) {
    return { success: false, locked: false, minutesRemaining: 0, pinNotConfigured: true, sessionId: null };
  }

  const state: LockoutState = {
    failedAttempts: store.pin_failed_attempts,
    lockedUntil: store.pin_locked_until,
  };

  if (isLocked(state, now)) {
    return {
      success: false,
      locked: true,
      minutesRemaining: lockoutMinutesRemaining(state, now),
      pinNotConfigured: false,
      sessionId: null,
    };
  }

  if (pin === store.pin) {
    await updateStorePinLockout(store.id, resetLockout());
    // A fresh session id replaces whatever was active for this store, so any
    // other device still holding the old cookie gets bounced to the login
    // screen next time it loads a page — only one active session per store.
    const sessionId = generateSessionId();
    await setStoreSessionId(store.id, sessionId);
    return { success: true, locked: false, minutesRemaining: 0, pinNotConfigured: false, sessionId };
  }

  const nextState = recordFailedAttempt(state, now);
  await updateStorePinLockout(store.id, nextState);
  return {
    success: false,
    locked: isLocked(nextState, now),
    minutesRemaining: lockoutMinutesRemaining(nextState, now),
    pinNotConfigured: false,
    sessionId: null,
  };
}

async function updateStorePinLockout(storeId: number, state: LockoutState): Promise<void> {
  await sql.query('update stores set pin_failed_attempts = $2, pin_locked_until = $3 where id = $1', [
    storeId,
    state.failedAttempts,
    state.lockedUntil,
  ]);
}

async function setStoreSessionId(storeId: number, sessionId: string): Promise<void> {
  await sql.query('update stores set session_id = $2 where id = $1', [storeId, sessionId]);
}

export async function clearStoreSession(slug: string): Promise<void> {
  await sql.query('update stores set session_id = null where slug = $1', [slug]);
}
