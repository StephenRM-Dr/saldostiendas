export interface LockoutState {
  failedAttempts: number;
  lockedUntil: string | null;
}

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export function isLocked(state: LockoutState, now: Date): boolean {
  if (!state.lockedUntil) return false;
  return new Date(state.lockedUntil).getTime() > now.getTime();
}

export function lockoutMinutesRemaining(state: LockoutState, now: Date): number {
  if (!state.lockedUntil) return 0;
  const diffMs = new Date(state.lockedUntil).getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / 60_000));
}

export function recordFailedAttempt(state: LockoutState, now: Date): LockoutState {
  const failedAttempts = state.failedAttempts + 1;
  if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
    return {
      failedAttempts: 0,
      lockedUntil: new Date(now.getTime() + LOCKOUT_MINUTES * 60_000).toISOString(),
    };
  }
  return { failedAttempts, lockedUntil: null };
}

export function resetLockout(): LockoutState {
  return { failedAttempts: 0, lockedUntil: null };
}
