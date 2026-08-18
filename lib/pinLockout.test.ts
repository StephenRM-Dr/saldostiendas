import { describe, it, expect } from 'vitest';
import {
  isLocked,
  lockoutMinutesRemaining,
  recordFailedAttempt,
  resetLockout,
  MAX_FAILED_ATTEMPTS,
} from './pinLockout';

const now = new Date('2026-08-18T12:00:00.000Z');

describe('isLocked', () => {
  it('returns false when lockedUntil is null', () => {
    expect(isLocked({ failedAttempts: 0, lockedUntil: null }, now)).toBe(false);
  });

  it('returns true when lockedUntil is in the future', () => {
    const lockedUntil = new Date(now.getTime() + 60_000).toISOString();
    expect(isLocked({ failedAttempts: 0, lockedUntil }, now)).toBe(true);
  });

  it('returns false when lockedUntil is in the past', () => {
    const lockedUntil = new Date(now.getTime() - 60_000).toISOString();
    expect(isLocked({ failedAttempts: 0, lockedUntil }, now)).toBe(false);
  });
});

describe('lockoutMinutesRemaining', () => {
  it('returns 0 when not locked', () => {
    expect(lockoutMinutesRemaining({ failedAttempts: 0, lockedUntil: null }, now)).toBe(0);
  });

  it('rounds up the remaining minutes', () => {
    const lockedUntil = new Date(now.getTime() + 90_000).toISOString(); // 1.5 min
    expect(lockoutMinutesRemaining({ failedAttempts: 0, lockedUntil }, now)).toBe(2);
  });

  it('returns 0 when lockedUntil already passed', () => {
    const lockedUntil = new Date(now.getTime() - 60_000).toISOString();
    expect(lockoutMinutesRemaining({ failedAttempts: 0, lockedUntil }, now)).toBe(0);
  });
});

describe('recordFailedAttempt', () => {
  it('increments failedAttempts without locking below the threshold', () => {
    const result = recordFailedAttempt({ failedAttempts: 2, lockedUntil: null }, now);
    expect(result).toEqual({ failedAttempts: 3, lockedUntil: null });
  });

  it('locks and resets the counter once the threshold is reached', () => {
    const result = recordFailedAttempt({ failedAttempts: MAX_FAILED_ATTEMPTS - 1, lockedUntil: null }, now);
    expect(result.failedAttempts).toBe(0);
    expect(result.lockedUntil).not.toBeNull();
    expect(new Date(result.lockedUntil as string).getTime()).toBe(now.getTime() + 15 * 60_000);
  });
});

describe('resetLockout', () => {
  it('returns a clean state', () => {
    expect(resetLockout()).toEqual({ failedAttempts: 0, lockedUntil: null });
  });
});
