import { sql } from './db';
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
}

const COP_ENABLED_SLUGS = new Set(['san-cristobal', 'concordia']);

export function storeUsesCop(slug: string): boolean {
  return COP_ENABLED_SLUGS.has(slug);
}

export async function listStores(): Promise<Store[]> {
  return (await sql.query(
    'select id, slug, name, telegram_chat_id, telegram_thread_id, pin, pin_failed_attempts, pin_locked_until from stores order by name'
  )) as Store[];
}

export async function getStoreBySlug(slug: string): Promise<Store | null> {
  const rows = (await sql.query(
    'select id, slug, name, telegram_chat_id, telegram_thread_id, pin, pin_failed_attempts, pin_locked_until from stores where slug = $1',
    [slug]
  )) as Store[];
  return rows[0] ?? null;
}

export interface PinAttemptResult {
  success: boolean;
  locked: boolean;
  minutesRemaining: number;
  pinNotConfigured: boolean;
}

export async function attemptStorePinLogin(
  slug: string,
  pin: string,
  now: Date = new Date()
): Promise<PinAttemptResult> {
  const store = await getStoreBySlug(slug);
  if (!store) {
    return { success: false, locked: false, minutesRemaining: 0, pinNotConfigured: false };
  }
  if (!store.pin) {
    return { success: false, locked: false, minutesRemaining: 0, pinNotConfigured: true };
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
    };
  }

  if (pin === store.pin) {
    await updateStorePinLockout(store.id, resetLockout());
    return { success: true, locked: false, minutesRemaining: 0, pinNotConfigured: false };
  }

  const nextState = recordFailedAttempt(state, now);
  await updateStorePinLockout(store.id, nextState);
  return {
    success: false,
    locked: isLocked(nextState, now),
    minutesRemaining: lockoutMinutesRemaining(nextState, now),
    pinNotConfigured: false,
  };
}

async function updateStorePinLockout(storeId: number, state: LockoutState): Promise<void> {
  await sql.query('update stores set pin_failed_attempts = $2, pin_locked_until = $3 where id = $1', [
    storeId,
    state.failedAttempts,
    state.lockedUntil,
  ]);
}
