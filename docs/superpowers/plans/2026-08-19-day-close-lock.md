# Cierre de Día (Bloqueo de Edición) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Once a calendar day (Venezuela time) ends, its movements become permanently uneditable — no new movements can be added to it, and existing ones can't be edited or deleted. Today stays fully editable all 24 hours.

**Architecture:** A pure function `isDateClosed(date, now?)` in `lib/date.ts` compares a date string against `todayISOCaracas()` — no database state, nothing scheduled, purely computed on every request. The three movement Server Actions call it and reject the operation before touching the database. The page hides edit controls and the add-movement form when viewing a closed day, as a UX layer on top of the server-side check.

**Tech Stack:** Next.js 16.3.1 (Server Actions), TypeScript, Vitest.

**Spec:** [docs/superpowers/specs/2026-08-19-day-close-lock-design.md](../specs/2026-08-19-day-close-lock-design.md)

## Global Constraints

- The lock is calendar-day based (Venezuela/Caracas time), not hour-based — today is editable all 24 hours; only days strictly before today are closed. There is no 5pm cutoff for editing (5pm is only when the existing Telegram cron sends its report — unrelated, unchanged).
- No exceptions anywhere in the app, including `/admin` — a closed day cannot be edited from any UI. Corrections to a closed day happen by hand in the database, outside the app.
- Future dates are never blocked — the lock only looks backward.
- No new database column or table — the open/closed state is 100% computed from the current date, never stored.
- Server Actions are the source of truth for the block; hiding UI controls is a UX nicety on top, not a substitute for it.

---

## Task 1: Pure date-closing logic

**Files:**
- Modify: `lib/date.ts`
- Test: `lib/date.test.ts` (new)

**Interfaces:**
- Produces: `todayISOCaracas(now?: Date): string` (gains an optional `now` parameter; existing callers that pass no argument are unaffected), `isDateClosed(date: string, now?: Date): boolean`. Task 2 and Task 3 both import `isDateClosed`.

- [ ] **Step 1: Write the failing tests**

Create `lib/date.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { todayISOCaracas, isDateClosed } from './date';

describe('todayISOCaracas', () => {
  it('converts a UTC instant to the Caracas-local calendar date (UTC-4)', () => {
    // 2026-08-19T02:00:00Z is 2026-08-18T22:00:00 in Caracas (UTC-4) — still the previous day
    expect(todayISOCaracas(new Date('2026-08-19T02:00:00Z'))).toBe('2026-08-18');
  });

  it('rolls over at Caracas midnight, not UTC midnight', () => {
    // 2026-08-19T04:00:00Z is exactly 2026-08-19T00:00:00 in Caracas
    expect(todayISOCaracas(new Date('2026-08-19T04:00:00Z'))).toBe('2026-08-19');
    // one second earlier is still 2026-08-18 in Caracas
    expect(todayISOCaracas(new Date('2026-08-19T03:59:59Z'))).toBe('2026-08-18');
  });
});

describe('isDateClosed', () => {
  const now = new Date('2026-08-19T12:00:00Z'); // 2026-08-19T08:00:00 in Caracas

  it('is true for yesterday', () => {
    expect(isDateClosed('2026-08-18', now)).toBe(true);
  });

  it('is false for today', () => {
    expect(isDateClosed('2026-08-19', now)).toBe(false);
  });

  it('is false for a future date', () => {
    expect(isDateClosed('2026-08-20', now)).toBe(false);
  });

  it('is false for any time of day today, including late evening', () => {
    const lateEvening = new Date('2026-08-20T02:30:00Z'); // 2026-08-19T22:30:00 in Caracas
    expect(isDateClosed('2026-08-19', lateEvening)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/date.test.ts`
Expected: FAIL — `lib/date` has no export named `isDateClosed`, and `todayISOCaracas` ignores its argument (ts type error on the extra arg, or wrong dates returned).

- [ ] **Step 3: Implement `lib/date.ts`**

Replace the full file with:

```ts
export function todayISOCaracas(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(now);
}

export function isDateClosed(date: string, now: Date = new Date()): boolean {
  return date < todayISOCaracas(now);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/date.test.ts`
Expected: PASS, all 7 tests.

- [ ] **Step 5: Run the full suite and type-check**

Run: `npx vitest run`
Expected: all test files pass (existing call sites of `todayISOCaracas()` pass no argument, so they keep working unchanged).

Run: `npm run build`
Expected: compiles successfully.

- [ ] **Step 6: Commit**

```bash
git add lib/date.ts lib/date.test.ts
git commit -m "Add isDateClosed for the calendar-day edit lock"
```

---

## Task 2: Block writes to closed days in the Server Actions

**Files:**
- Modify: `app/tienda/[slug]/actions.ts`
- Modify: `app/tienda/[slug]/MovementRow.tsx`

**Interfaces:**
- Consumes: `isDateClosed(date, now?)` from `@/lib/date` (Task 1).

- [ ] **Step 1: Import `isDateClosed` and guard the three actions**

In `app/tienda/[slug]/actions.ts`, add to the imports at the top:

```ts
import { isDateClosed } from '@/lib/date';
```

Replace `addMovementAction`:

```ts
export async function addMovementAction(formData: FormData) {
  const storeId = Number(formData.get('storeId'));
  const slug = String(formData.get('slug'));
  const { concept, type, amountUsd, amountVes, date } = parseAndValidate(formData);

  if (isDateClosed(date)) {
    throw new Error('No se pueden modificar movimientos de un día ya cerrado.');
  }

  await createMovement({ storeId, date, concept, type, amountUsd, amountVes });
  revalidatePath(`/tienda/${slug}`);
}
```

Replace `updateMovementAction`:

```ts
export async function updateMovementAction(formData: FormData) {
  const id = Number(formData.get('id'));
  const slug = String(formData.get('slug'));
  const { concept, type, amountUsd, amountVes, date } = parseAndValidate(formData);

  if (isDateClosed(date)) {
    throw new Error('No se pueden modificar movimientos de un día ya cerrado.');
  }

  await updateMovement(id, { date, concept, type, amountUsd, amountVes });
  revalidatePath(`/tienda/${slug}`);
}
```

Replace `deleteMovementAction` (it now needs the movement's date, which it didn't receive before):

```ts
export async function deleteMovementAction(formData: FormData) {
  const id = Number(formData.get('id'));
  const slug = String(formData.get('slug'));
  const date = String(formData.get('date'));

  if (isDateClosed(date)) {
    throw new Error('No se pueden modificar movimientos de un día ya cerrado.');
  }

  await deleteMovement(id);
  revalidatePath(`/tienda/${slug}`);
}
```

- [ ] **Step 2: Send the date along when deleting**

In `app/tienda/[slug]/MovementRow.tsx`, find `handleDelete`:

```ts
  async function handleDelete() {
    if (!confirm('¿Eliminar este movimiento?')) return;
    const formData = new FormData();
    formData.set('id', String(movement.id));
    formData.set('slug', slug);
    try {
      await deleteMovementAction(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar.');
    }
  }
```

Add a `formData.set('date', movement.date);` line so it matches:

```ts
  async function handleDelete() {
    if (!confirm('¿Eliminar este movimiento?')) return;
    const formData = new FormData();
    formData.set('id', String(movement.id));
    formData.set('slug', slug);
    formData.set('date', movement.date);
    try {
      await deleteMovementAction(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar.');
    }
  }
```

- [ ] **Step 3: Type-check and build**

Run: `npm run build`
Expected: compiles successfully.

- [ ] **Step 4: Verify against the real app**

This guards real database writes, so it's verified live rather than unit-tested (matching how this project already verifies its other DB-writing Server Actions). Kill anything on ports 3000/3001, then:

Run: `npm run dev`

With the server running and logged into a real store (use one of the 7 PINs already set in the database):

1. Pick a store that already has at least one movement dated before today (query the database directly if unsure — `select store_id, id, to_char(date,'YYYY-MM-DD') as date, concept from movements where date < (now() at time zone 'America/Caracas')::date order by date desc limit 5` — this repo's database already has such movements from earlier testing). Navigate to that past date with the date picker at the top of the page.
2. Confirm the "Agregar movimiento" form and the "Editar" links are still visible for now (Task 3 hides them — this task only adds the server-side guard).
3. Try adding a movement dated that past day — expect the error "No se pueden modificar movimientos de un día ya cerrado." and no new row appearing.
4. Try editing the existing movement on that past date — expect the same error.
5. Try deleting the existing movement on that past date — expect the same error, and the row must still be there after refreshing.
6. Navigate back to today and confirm add/edit/delete all still work normally.

- [ ] **Step 5: Commit**

```bash
git add "app/tienda/[slug]/actions.ts" "app/tienda/[slug]/MovementRow.tsx"
git commit -m "Reject writes to closed-day movements in the Server Actions"
```

---

## Task 3: Hide edit controls for closed days

**Files:**
- Modify: `app/tienda/[slug]/page.tsx`
- Modify: `app/tienda/[slug]/MovementRow.tsx`

**Interfaces:**
- Consumes: `isDateClosed(date, now?)` from `@/lib/date` (Task 1).
- Produces: `MovementRow` gains a required `readOnly: boolean` prop.

- [ ] **Step 1: Make `MovementRow` accept and honor `readOnly`**

In `app/tienda/[slug]/MovementRow.tsx`, replace the function signature:

```ts
export default function MovementRow({ movement, slug }: { movement: Movement; slug: string }) {
```

with:

```ts
export default function MovementRow({
  movement,
  slug,
  readOnly,
}: {
  movement: Movement;
  slug: string;
  readOnly: boolean;
}) {
```

Then replace the non-editing `<tr>` return block:

```tsx
  if (!editing) {
    return (
      <tr className="border-b">
        <td className="p-2">{movement.concept}</td>
        <td className="p-2 text-right">{signedAmount(movement, 'amount_usd')}</td>
        <td className="p-2 text-right">{signedAmount(movement, 'amount_ves')}</td>
        <td className="p-2 text-right">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setAmountUsdInput(movement.amount_usd);
              setAmountVesInput(movement.amount_ves);
              setConceptInput(isKnownConcept(movement.concept) ? movement.concept : OTRO_LABEL);
              setCustomConceptInput(isKnownConcept(movement.concept) ? '' : movement.concept);
              setTypeInput(movement.type);
              setEditing(true);
            }}
            className="text-blue-600"
          >
            Editar
          </button>
        </td>
      </tr>
    );
  }
```

with:

```tsx
  if (!editing) {
    return (
      <tr className="border-b">
        <td className="p-2">{movement.concept}</td>
        <td className="p-2 text-right">{signedAmount(movement, 'amount_usd')}</td>
        <td className="p-2 text-right">{signedAmount(movement, 'amount_ves')}</td>
        <td className="p-2 text-right">
          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setAmountUsdInput(movement.amount_usd);
                setAmountVesInput(movement.amount_ves);
                setConceptInput(isKnownConcept(movement.concept) ? movement.concept : OTRO_LABEL);
                setCustomConceptInput(isKnownConcept(movement.concept) ? '' : movement.concept);
                setTypeInput(movement.type);
                setEditing(true);
              }}
              className="text-blue-600"
            >
              Editar
            </button>
          )}
        </td>
      </tr>
    );
  }
```

(The "Editar" button is the only way to reach the editing form, so hiding it also hides "Eliminar" — no other change needed in this file.)

- [ ] **Step 2: Compute the closed state in the page and use it**

In `app/tienda/[slug]/page.tsx`, add to the imports:

```ts
import { isDateClosed } from '@/lib/date';
```

Add this line right after `const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayISOCaracas();`:

```ts
  const closed = isDateClosed(date);
```

Replace `{movements.map((m) => (
            <MovementRow key={m.id} movement={m} slug={store.slug} />
          ))}` with:

```tsx
          {movements.map((m) => (
            <MovementRow key={m.id} movement={m} slug={store.slug} readOnly={closed} />
          ))}
```

Replace the final `<MovementForm storeId={store.id} slug={store.slug} date={date} />` line with:

```tsx
      {closed ? (
        <p className="mt-6 rounded-lg border p-4 text-sm text-gray-600">
          Este día ya cerró y no se pueden agregar ni modificar movimientos. Ve al día de hoy para
          registrar movimientos nuevos.
        </p>
      ) : (
        <MovementForm storeId={store.id} slug={store.slug} date={date} />
      )}
```

- [ ] **Step 3: Type-check and build**

Run: `npm run build`
Expected: compiles successfully.

- [ ] **Step 4: Verify against the real app**

Kill anything on ports 3000/3001, run `npm run dev`, log into a real store.

1. On today's date: confirm "Editar" links are visible on existing movements and the "Agregar movimiento" form is visible, exactly as before.
2. Navigate to yesterday's date: confirm "Editar" links are gone from every row, and the add-movement form is replaced by the "Este día ya cerró..." notice.
3. Navigate to a future date (e.g., tomorrow): confirm "Editar" links and the add-movement form are both still visible (the lock only looks backward).

- [ ] **Step 5: Commit**

```bash
git add "app/tienda/[slug]/page.tsx" "app/tienda/[slug]/MovementRow.tsx"
git commit -m "Hide edit controls and the add-movement form on closed days"
```

---

## Task 4: Final QA

**Files:** none (verification only)

- [ ] **Step 1: Full manual QA pass**

With the dev server running and logged into a real store:

1. Repeat Task 2 Step 4 and Task 3 Step 4 end to end once more as a sanity check.
2. Confirm the Telegram "Enviar a Telegram" button still works on today's date (it's a read-only action, unaffected by this feature, but worth a quick click to be sure nothing broke).
3. Confirm `/admin`'s Excel export still works for a date range that includes a closed day — the lock only applies to the store-facing edit UI and its Server Actions, not to the read-only Admin export.

- [ ] **Step 2: Run the full automated test suite one more time**

Run: `npx vitest run`
Expected: all test files pass, including the new `lib/date.test.ts`.

Run: `npm run build`
Expected: compiles successfully.

- [ ] **Step 3: Commit any fixes made during QA**

If Step 1 surfaced any bugs and they were fixed, commit those fixes now with a message describing what was found and fixed. If nothing needed fixing, skip this step (no empty commit).
