# Login por Tienda con PIN Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect each of the 7 `/tienda/[slug]` pages behind its own 4-digit PIN, with a 30-day session cookie, a "Cerrar sesión" button, and a per-store lockout after repeated wrong PINs.

**Architecture:** A new `lib/storeAuth.ts` signs/verifies an HMAC-signed session cookie (Node's built-in `crypto`, no DB hit needed to verify). A new `lib/pinLockout.ts` holds the pure lockout state machine. `lib/stores.ts` gains `attemptStorePinLogin` to orchestrate a login attempt against the DB. A new `/tienda/[slug]/login` route collects the PIN via a React 19 `useActionState` form. `proxy.ts` gates `/tienda/:path*` (except the login page itself) on the signed cookie, redirecting to login when missing/invalid. `page.tsx` re-checks the cookie itself (defense in depth) and gains a logout button.

**Tech Stack:** Next.js 16.3.1 (App Router, Server Actions, Proxy on Node.js runtime), React 19 (`useActionState`), Neon Postgres (`@neondatabase/serverless`), Vitest.

**Spec:** [docs/superpowers/specs/2026-08-18-store-pin-login-design.md](../specs/2026-08-18-store-pin-login-design.md)

## Global Constraints

- Next.js 16 renamed `middleware.ts` to `proxy.ts` (exported function must be named `proxy`) — this project already has `proxy.ts` at the root; extend it, don't create `middleware.ts`.
- Proxy defaults to the **Node.js runtime** in Next 16 (confirmed in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`), so `proxy.ts` can use Node's `crypto` module directly — no need for edge-only Web Crypto. This is a deliberate refinement of the design spec, which assumed `crypto.subtle`; using sync Node `crypto` is simpler and behaves identically for this app's single deployment target.
- `cookies()` from `next/headers` is **async** in Next 16 — always `await cookies()`. Setting/deleting a cookie only works inside a Server Function or Route Handler, never during Server Component rendering.
- Neon: always call `sql.query(text, params)`, never bare `sql(text, params)`.
- The Neon driver parses Postgres `timestamptz`/`date` columns into JS `Date` objects at runtime even though the DB driver's TS types claim `string` (this bit the base app once already — see `lib/movements.ts`'s `to_char(...)` usage). To sidestep this entirely for the new lockout column, `pin_locked_until` is declared as plain `text` holding an ISO string, not `timestamptz` — nothing in SQL ever compares it, all lockout math happens in JS.
- PIN comparison uses plain `===` (matches the project's existing, explicitly-accepted posture for `ADMIN_PASSWORD` in `lib/adminAuth.ts` — non-constant-time comparison was reviewed and ruled acceptable for this app's threat model). The HMAC signature comparison in `lib/storeAuth.ts` **does** use `timingSafeEqual`, because forged-signature timing attacks are a distinct, well-known concern for MAC verification specifically.
- Before starting any local dev server, kill whatever already holds ports 3000/3001, then confirm the actually-bound port from the startup log before testing against it.
- Any throwaway verification script goes in the scratchpad temp directory, never committed to the repo.
- Windows/PowerShell environment — use forward slashes and the project's existing `npm run db:migrate` / `npm run db:verify` scripts for schema work, not ad-hoc SQL clients.

---

## Task 1: Schema + Store model

**Files:**
- Modify: `db/schema.sql`
- Modify: `lib/stores.ts`
- Modify: `.env.local.example`
- Modify: `.env.local` (not committed)

**Interfaces:**
- Produces: `Store` interface gains `pin: string | null`, `pin_failed_attempts: number`, `pin_locked_until: string | null`. `listStores()` and `getStoreBySlug()` keep their existing signatures but now return these fields too.

- [ ] **Step 1: Add the migration statements**

Append to `db/schema.sql` (after the existing `telegram_chat_id` line, before the `insert into stores` block):

```sql
alter table stores add column if not exists pin text;
alter table stores add column if not exists pin_failed_attempts integer not null default 0;
alter table stores add column if not exists pin_locked_until text;
```

- [ ] **Step 2: Run the migration against the real database**

Run: `npm run db:migrate`
Expected: Each `alter table` statement prints as "Executed: ..." with no errors.

- [ ] **Step 3: Verify the columns exist**

Run: `node --env-file=.env.local -e "const {neon}=require('@neondatabase/serverless'); const sql=neon(process.env.DATABASE_URL); sql.query('select slug, pin, pin_failed_attempts, pin_locked_until from stores order by slug').then(r=>console.log(r))"`
Expected: 7 rows, each with `pin: null`, `pin_failed_attempts: 0`, `pin_locked_until: null`.

- [ ] **Step 4: Update the Store interface and both queries**

Replace `lib/stores.ts` with:

```ts
import { sql } from './db';

export interface Store {
  id: number;
  slug: string;
  name: string;
  telegram_chat_id: string | null;
  pin: string | null;
  pin_failed_attempts: number;
  pin_locked_until: string | null;
}

export async function listStores(): Promise<Store[]> {
  return (await sql.query(
    'select id, slug, name, telegram_chat_id, pin, pin_failed_attempts, pin_locked_until from stores order by name'
  )) as Store[];
}

export async function getStoreBySlug(slug: string): Promise<Store | null> {
  const rows = (await sql.query(
    'select id, slug, name, telegram_chat_id, pin, pin_failed_attempts, pin_locked_until from stores where slug = $1',
    [slug]
  )) as Store[];
  return rows[0] ?? null;
}
```

- [ ] **Step 5: Add SESSION_SECRET to the env files**

Append to `.env.local.example`:

```
SESSION_SECRET=a-long-random-string-used-to-sign-store-session-cookies
```

Generate a real secret and append the same variable to `.env.local` (not committed):

Run: `node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))" >> .env.local`
Expected: `.env.local` now has a `SESSION_SECRET=<64 hex chars>` line.

- [ ] **Step 6: Type-check and build**

Run: `npm run build`
Expected: Compiles successfully, no type errors.

- [ ] **Step 7: Commit**

```bash
git add db/schema.sql lib/stores.ts .env.local.example
git commit -m "Add pin, pin_failed_attempts, pin_locked_until columns to stores"
```

---

## Task 2: Pure lockout logic

**Files:**
- Create: `lib/pinLockout.ts`
- Test: `lib/pinLockout.test.ts`

**Interfaces:**
- Consumes: nothing (pure, no dependencies on other new files).
- Produces: `LockoutState { failedAttempts: number; lockedUntil: string | null }`, `MAX_FAILED_ATTEMPTS = 5`, `LOCKOUT_MINUTES = 15`, `isLocked(state, now): boolean`, `lockoutMinutesRemaining(state, now): number`, `recordFailedAttempt(state, now): LockoutState`, `resetLockout(): LockoutState`. Task 4 imports all of these.

- [ ] **Step 1: Write the failing tests**

Create `lib/pinLockout.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/pinLockout.test.ts`
Expected: FAIL — `lib/pinLockout` module not found.

- [ ] **Step 3: Implement `lib/pinLockout.ts`**

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/pinLockout.test.ts`
Expected: PASS, all 8 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/pinLockout.ts lib/pinLockout.test.ts
git commit -m "Add pure per-store PIN lockout state machine"
```

---

## Task 3: Session cookie signing

**Files:**
- Create: `lib/storeAuth.ts`
- Test: `lib/storeAuth.test.ts`

**Interfaces:**
- Consumes: `process.env.SESSION_SECRET`.
- Produces: `storeSessionCookieName(slug): string`, `signStoreSession(slug, now?): string`, `verifyStoreSession(cookieValue, slug, now?): boolean`. Task 5 and Task 6 import all three.

- [ ] **Step 1: Write the failing tests**

Create `lib/storeAuth.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/storeAuth.test.ts`
Expected: FAIL — `lib/storeAuth` module not found.

- [ ] **Step 3: Implement `lib/storeAuth.ts`**

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/storeAuth.test.ts`
Expected: PASS, all 8 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/storeAuth.ts lib/storeAuth.test.ts
git commit -m "Add HMAC-signed per-store session cookie helpers"
```

---

## Task 4: PIN attempt orchestration

**Files:**
- Modify: `lib/stores.ts`

**Interfaces:**
- Consumes: `getStoreBySlug` (same file), `isLocked`, `lockoutMinutesRemaining`, `recordFailedAttempt`, `resetLockout`, `LockoutState` from `./pinLockout` (Task 2).
- Produces: `PinAttemptResult { success: boolean; locked: boolean; minutesRemaining: number; pinNotConfigured: boolean }`, `attemptStorePinLogin(slug, pin, now?): Promise<PinAttemptResult>`. Task 5's login action calls this.

- [ ] **Step 1: Add the import and the new function**

In `lib/stores.ts`, add this import directly below the existing `import { sql } from './db';` line:

```ts
import {
  isLocked,
  lockoutMinutesRemaining,
  recordFailedAttempt,
  resetLockout,
  type LockoutState,
} from './pinLockout';
```

Append to `lib/stores.ts`:

```ts
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
```

- [ ] **Step 2: Type-check and build**

Run: `npm run build`
Expected: Compiles successfully.

- [ ] **Step 3: Set a temporary test PIN for live verification in Task 5**

`attemptStorePinLogin` touches the real database, so — matching how this project already verifies its other DB-orchestration functions (e.g. `createMovement`, `getDayLedger` in `lib/movements.ts`: no mocked-`sql` unit tests, live verification instead) — it's exercised through the real HTTP login flow in Task 5, not through a standalone script here. Set San Cristóbal's PIN now so Task 5 has a real value to log in with:

Run: `node --env-file=.env.local -e "const {neon}=require('@neondatabase/serverless'); const sql=neon(process.env.DATABASE_URL); sql.query(\"update stores set pin='1234', pin_failed_attempts=0, pin_locked_until=null where slug='san-cristobal'\").then(()=>console.log('done'))"`
Expected: `done` printed.

When reporting this task complete, note explicitly that `attemptStorePinLogin` is implemented and type-checked here, but its live behavior (wrong PIN x5 → lockout, correct PIN → success) is verified in Task 5 Step 5, not in this task.

- [ ] **Step 4: Commit**

```bash
git add lib/stores.ts
git commit -m "Add attemptStorePinLogin to orchestrate PIN checks with lockout"
```

---

## Task 5: Login page

**Files:**
- Create: `app/tienda/[slug]/login/page.tsx`
- Create: `app/tienda/[slug]/login/PinLoginForm.tsx`
- Create: `app/tienda/[slug]/login/actions.ts`

**Interfaces:**
- Consumes: `getStoreBySlug` from `@/lib/stores` (existing), `attemptStorePinLogin` from `@/lib/stores` (Task 4), `signStoreSession`, `storeSessionCookieName` from `@/lib/storeAuth` (Task 3).
- Produces: the `/tienda/[slug]/login` route. Task 6's `proxy.ts` redirects here; nothing else depends on this task's exports directly.

- [ ] **Step 1: Implement the Server Action**

Create `app/tienda/[slug]/login/actions.ts`:

```ts
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
```

- [ ] **Step 2: Implement the form component**

Create `app/tienda/[slug]/login/PinLoginForm.tsx`:

```tsx
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
```

- [ ] **Step 3: Implement the page**

Create `app/tienda/[slug]/login/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { getStoreBySlug } from '@/lib/stores';
import PinLoginForm from './PinLoginForm';

export const dynamic = 'force-dynamic';

export default async function StoreLoginPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) notFound();

  return (
    <main className="mx-auto max-w-sm p-4">
      <h1 className="text-xl font-semibold">{store.name}</h1>
      <p className="mt-1 text-sm text-gray-600">Ingresa el PIN de la tienda para continuar.</p>
      <PinLoginForm slug={store.slug} />
    </main>
  );
}
```

- [ ] **Step 4: Type-check and build**

Run: `npm run build`
Expected: Compiles successfully. Note the new route `/tienda/[slug]/login` in the build output.

- [ ] **Step 5: Manual verification — real login flow**

Kill anything already bound to ports 3000/3001, then start the dev server and confirm the bound port from the log:

Run: `npm run dev`

The San Cristóbal store already has PIN `1234` set from Task 4's verification step. With the server running:

1. Visit `http://localhost:3000/tienda/san-cristobal/login` in a real browser (proxy.ts doesn't gate this route yet, so it's reachable directly).
2. Enter `0000` (wrong) — expect "PIN incorrecto." with no navigation.
3. Repeat wrong PIN 4 more times (5 total) — the 5th attempt should show "Tienda bloqueada temporalmente. Intenta de nuevo en 15 minuto(s)."
4. Enter the correct PIN `1234` while still locked — expect the lockout message again (correct PIN does not bypass an active lock).
5. Clear the lock directly in the DB to continue testing: `node --env-file=.env.local -e "const {neon}=require('@neondatabase/serverless'); const sql=neon(process.env.DATABASE_URL); sql.query(\"update stores set pin_failed_attempts=0, pin_locked_until=null where slug='san-cristobal'\").then(()=>console.log('done'))"`
6. Enter the correct PIN `1234` — expect a redirect to `/tienda/san-cristobal` (the page itself doesn't check the cookie yet until Task 6, so it should just load normally) and a `store_session_san-cristobal` cookie set (check DevTools → Application → Cookies).
7. Confirm a store with no PIN configured (any other slug, e.g. `maracaibo`) shows "Esta tienda no tiene PIN configurado todavia." on any PIN attempt.

- [ ] **Step 6: Commit**

```bash
git add app/tienda/\[slug\]/login
git commit -m "Add per-store PIN login page"
```

---

## Task 6: Wire the proxy gate and logout

**Files:**
- Modify: `proxy.ts`
- Modify: `app/tienda/[slug]/page.tsx`
- Modify: `app/tienda/[slug]/actions.ts`

**Interfaces:**
- Consumes: `verifyStoreSession`, `storeSessionCookieName` from `@/lib/storeAuth` (Task 3).

**Important:** once this task lands, every one of the 7 stores requires a valid PIN to access — and right now only `san-cristobal` has one set (`1234`, from Task 4/5's verification). Before considering this feature done, the other 6 stores need real PINs set via SQL (covered in Task 7).

- [ ] **Step 1: Replace `proxy.ts`**

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAuthorized } from '@/lib/adminAuth';
import { verifyStoreSession, storeSessionCookieName } from '@/lib/storeAuth';

function handleAdmin(request: NextRequest): Response {
  if (!process.env.ADMIN_PASSWORD) {
    return new Response('ADMIN_PASSWORD no esta configurado en el servidor.', { status: 500 });
  }
  if (!isAuthorized(request.headers.get('authorization'))) {
    return new Response('Autenticacion requerida.', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin", charset="UTF-8"' },
    });
  }
  return NextResponse.next();
}

function handleTienda(request: NextRequest): Response {
  const { pathname } = request.nextUrl;
  if (pathname.endsWith('/login')) {
    return NextResponse.next();
  }

  const slug = pathname.split('/')[2];
  if (!slug) {
    return NextResponse.next();
  }

  if (!process.env.SESSION_SECRET) {
    return new Response('SESSION_SECRET no esta configurado en el servidor.', { status: 500 });
  }

  const sessionCookie = request.cookies.get(storeSessionCookieName(slug))?.value;
  if (!verifyStoreSession(sessionCookie, slug)) {
    return NextResponse.redirect(new URL(`/tienda/${slug}/login`, request.url));
  }
  return NextResponse.next();
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    return handleAdmin(request);
  }

  if (pathname.startsWith('/tienda/')) {
    return handleTienda(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/tienda/:path*'],
};
```

- [ ] **Step 2: Add the defense-in-depth check and logout button to the store page**

In `app/tienda/[slug]/page.tsx`, replace the first import line:

```ts
import { notFound } from 'next/navigation';
```

with:

```ts
import { notFound, redirect } from 'next/navigation';
```

Then add these new imports directly below the existing `import { getStoreBySlug } from '@/lib/stores';` line:

```ts
import { cookies } from 'next/headers';
import { verifyStoreSession, storeSessionCookieName } from '@/lib/storeAuth';
import { logoutAction } from './actions';
```

Add this check right after `if (!store) notFound();`:

```ts
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(storeSessionCookieName(store.slug))?.value;
  if (!verifyStoreSession(sessionCookie, store.slug)) {
    redirect(`/tienda/${store.slug}/login`);
  }
```

Replace the existing `<h1 className="text-xl font-semibold">{store.name}</h1>` line with:

```tsx
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{store.name}</h1>
        <form action={logoutAction}>
          <input type="hidden" name="slug" value={store.slug} />
          <button type="submit" className="text-sm text-blue-600 underline">
            Cerrar sesion
          </button>
        </form>
      </div>
```

- [ ] **Step 3: Add the logout action**

Add to `app/tienda/[slug]/actions.ts`, alongside the existing imports:

```ts
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { storeSessionCookieName } from '@/lib/storeAuth';
```

Append:

```ts
export async function logoutAction(formData: FormData) {
  const slug = String(formData.get('slug'));
  const cookieStore = await cookies();
  cookieStore.delete(storeSessionCookieName(slug));
  redirect(`/tienda/${slug}/login`);
}
```

- [ ] **Step 4: Type-check and build**

Run: `npm run build`
Expected: Compiles successfully.

- [ ] **Step 5: Manual verification — real gate + logout**

Kill anything on ports 3000/3001, start `npm run dev`, confirm the bound port.

1. In a fresh browser context (or clear cookies for localhost), visit `http://localhost:3000/tienda/san-cristobal` directly — expect an immediate redirect to `/tienda/san-cristobal/login`.
2. Log in with PIN `1234` — expect landing on `/tienda/san-cristobal` with the ledger visible and a "Cerrar sesion" link next to the store name.
3. Reload the page — expect it to stay logged in (cookie persists).
4. Click "Cerrar sesion" — expect a redirect back to `/tienda/san-cristobal/login`, and visiting `/tienda/san-cristobal` again redirects to login (cookie is gone).
5. Log back in, then visit `http://localhost:3000/tienda/maracaibo` in the same browser — expect it to redirect to `/tienda/maracaibo/login` (the San Cristóbal cookie does not unlock Maracaibo).
6. Visit `http://localhost:3000/` — expect the home page store list to still load without requiring login (only `/tienda/[slug]` itself is gated).
7. Confirm the fail-closed behavior when `SESSION_SECRET` is missing: comment out (or temporarily rename) the `SESSION_SECRET` line in `.env.local`, restart `npm run dev`, and visit `http://localhost:3000/tienda/san-cristobal` — expect a `500` response with "SESSION_SECRET no esta configurado en el servidor." (not a silent pass-through). Restore the `SESSION_SECRET` line exactly as it was, restart the dev server, and confirm login works again before moving on.

- [ ] **Step 6: Commit**

```bash
git add proxy.ts app/tienda/\[slug\]/page.tsx app/tienda/\[slug\]/actions.ts
git commit -m "Gate /tienda/[slug] behind the per-store PIN session"
```

---

## Task 7: Final QA and real PIN rollout

**Files:** none (verification and data only)

- [ ] **Step 1: Full manual QA pass**

Re-run the full flow from Task 6 Step 5 once more end to end as a sanity check, plus:

- Confirm `/admin` still works with its existing Basic Auth (unrelated mechanism, shouldn't have regressed).
- Confirm the Telegram "Enviar a Telegram" button still works once logged into a store (it's a same-page Server Action, already covered by the proxy gate, but click it once to be sure nothing broke).

- [ ] **Step 2: Run the full automated test suite one more time**

Run: `npx vitest run`
Expected: All test files pass, including the new `lib/pinLockout.test.ts` and `lib/storeAuth.test.ts`.

Run: `npm run build`
Expected: Compiles successfully.

- [ ] **Step 3: Set real PINs for all 7 stores**

Every store except `san-cristobal` still has `pin = null`, meaning nobody can log into them. Replace `1111`, `2222`, etc. below with real 4-digit PINs before running (ask the user for the real values if they haven't been decided yet — do not deploy with placeholder PINs):

```sql
update stores set pin = '1111', pin_failed_attempts = 0, pin_locked_until = null where slug = 'san-cristobal';
update stores set pin = '2222', pin_failed_attempts = 0, pin_locked_until = null where slug = 'merida';
update stores set pin = '3333', pin_failed_attempts = 0, pin_locked_until = null where slug = 'barinas';
update stores set pin = '4444', pin_failed_attempts = 0, pin_locked_until = null where slug = 'caracas';
update stores set pin = '5555', pin_failed_attempts = 0, pin_locked_until = null where slug = 'concordia';
update stores set pin = '6666', pin_failed_attempts = 0, pin_locked_until = null where slug = 'valencia';
update stores set pin = '7777', pin_failed_attempts = 0, pin_locked_until = null where slug = 'maracaibo';
```

Run each statement via: `node --env-file=.env.local -e "const {neon}=require('@neondatabase/serverless'); const sql=neon(process.env.DATABASE_URL); sql.query(\"<statement>\").then(()=>console.log('done'))"`

Expected: 7 "done" outputs, one per store.

- [ ] **Step 4: Commit any fixes made during QA**

If Step 1 surfaced any bugs and they were fixed, commit those fixes now with a message describing what was found and fixed. If nothing needed fixing, skip this step (no empty commit).
