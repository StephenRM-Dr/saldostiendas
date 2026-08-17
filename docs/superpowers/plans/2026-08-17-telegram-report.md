# Envío de Reporte a Telegram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each of the 7 stores send its daily "cuadro de cierre" to its own Telegram group, either by clicking a button for the date it's viewing, or automatically every day at 17:00 Venezuela time.

**Architecture:** Two new entry points into the existing data layer (`getDayLedger`, `getStoreBySlug`, `listStores`): a Server Action for the manual button, and a Vercel Cron-triggered API route for the automatic daily send. Both share one pure formatting function and one thin Telegram API wrapper. Per-store `chat_id` lives in the `stores` table (new nullable column); the bot token is a server-only env var.

**Tech Stack:** Next.js (App Router, Route Handlers), Vercel Cron, Telegram Bot API (`fetch`, no SDK), Vitest.

**Spec:** [docs/superpowers/specs/2026-08-17-telegram-report-design.md](../specs/2026-08-17-telegram-report-design.md)

## Global Constraints

- Un grupo de Telegram por tienda: columna `telegram_chat_id` (texto, nullable) en `stores`. El usuario carga los 7 valores directamente en la base — no hay UI de administración.
- El token del bot vive en `TELEGRAM_BOT_TOKEN` (env var, servidor únicamente, nunca expuesto al cliente).
- Envío automático diario a las **21:00 UTC (17:00 hora Venezuela — sin horario de verano, offset fijo todo el año)** vía Vercel Cron, contra la ruta `/api/cron/send-reports`, protegida con `CRON_SECRET`.
- Reenvíos manuales no requieren rastreo de "ya enviado" — reenviar es válido y no muestra advertencia.
- Tiendas sin `telegram_chat_id` configurado: el cron las salta (no es error); el botón manual muestra un error claro en vez de fallar en silencio.
- Un fallo al enviar a una tienda no debe detener el envío a las demás en el cron — se registra en los logs y se continúa.
- Formato del mensaje: texto plano con Markdown básico de Telegram, mismo contenido que la tabla en pantalla (saldo inicial, movimientos, saldo final).
- Node.js >= 20.6 (constraint heredada del proyecto base).

## Prerequisites (manual)

1. Tener a mano el token del bot de Telegram (de BotFather) — ya lo tiene el usuario.
2. Después de la migración de la Tarea 1, cargar `telegram_chat_id` para al menos una tienda de prueba directamente en la base de datos, para poder verificar el envío real en las Tareas 5-7. Ejemplo:
   ```sql
   update stores set telegram_chat_id = '<chat_id real>' where slug = 'barinas';
   ```
3. Agregar `TELEGRAM_BOT_TOKEN` y un `CRON_SECRET` (cualquier string aleatorio, ej. generado con `openssl rand -hex 32`) a `.env.local` antes de la Tarea 5.

---

### Task 1: Database migration — telegram_chat_id column

**Files:**
- Modify: `db/schema.sql`

**Interfaces:**
- Produces (in the database): `stores.telegram_chat_id` — nullable `text` column.

- [ ] **Step 1: Add the migration statement**

Edit `db/schema.sql`, add after the `movements_store_date_idx` index line (before the `insert into stores` block):

```sql
alter table stores add column if not exists telegram_chat_id text;
```

- [ ] **Step 2: Run the migration against the real database**

```bash
npm run db:migrate
```

Expected: logs each executed statement including the new `alter table` statement, ends with "Schema applied successfully."

- [ ] **Step 3: Verify the column exists**

```bash
node --env-file=.env.local -e "
import('@neondatabase/serverless').then(async ({ neon }) => {
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql.query('select slug, telegram_chat_id from stores order by slug');
  console.log(rows);
});
"
```

Expected: prints the 7 stores, each with `telegram_chat_id: null` (or a value, if the Prerequisites step already set one).

- [ ] **Step 4: Commit**

```bash
git add db/schema.sql
git commit -m "Add telegram_chat_id column to stores"
```

---

### Task 2: Extend Store with telegram_chat_id

**Files:**
- Modify: `lib/stores.ts`

**Interfaces:**
- Consumes: `sql` from `lib/db.ts`.
- Produces: `Store` now includes `telegram_chat_id: string | null`; `listStores()` and `getStoreBySlug(slug)` both select it.

- [ ] **Step 1: Update the Store interface and both queries**

Edit `lib/stores.ts`, replace the whole file:

```ts
import { sql } from './db';

export interface Store {
  id: number;
  slug: string;
  name: string;
  telegram_chat_id: string | null;
}

export async function listStores(): Promise<Store[]> {
  return (await sql.query(
    'select id, slug, name, telegram_chat_id from stores order by name'
  )) as Store[];
}

export async function getStoreBySlug(slug: string): Promise<Store | null> {
  const rows = (await sql.query(
    'select id, slug, name, telegram_chat_id from stores where slug = $1',
    [slug]
  )) as Store[];
  return rows[0] ?? null;
}
```

- [ ] **Step 2: Type-check and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: no type errors; build succeeds (this exercises `listStores()` against the real database via the home page's static generation, same as it did before this change).

- [ ] **Step 3: Commit**

```bash
git add lib/stores.ts
git commit -m "Add telegram_chat_id to Store"
```

---

### Task 3: Shared "today in Caracas" helper

**Files:**
- Create: `lib/date.ts`
- Modify: `app/tienda/[slug]/page.tsx`

**Interfaces:**
- Produces: `todayISOCaracas(): string` — returns today's date as `YYYY-MM-DD` in the `America/Caracas` timezone.

This extracts `page.tsx`'s existing `todayISO()` (already fixed to use `America/Caracas` in the base app) into a shared module, since Task 7's cron route needs the identical "today" computation and must not duplicate the timezone logic that was previously the source of a real bug.

- [ ] **Step 1: Create the shared helper**

Create `lib/date.ts`:

```ts
export function todayISOCaracas(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date());
}
```

- [ ] **Step 2: Use it from page.tsx instead of the local copy**

Edit `app/tienda/[slug]/page.tsx`:

Replace:

```tsx
import { notFound } from 'next/navigation';
import { getStoreBySlug } from '@/lib/stores';
import { getDayLedger } from '@/lib/movements';
import { formatMoney } from '@/lib/money';
import MovementRow from './MovementRow';
import DateNav from './DateNav';
import MovementForm from './MovementForm';

export const dynamic = 'force-dynamic';

function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date());
}
```

with:

```tsx
import { notFound } from 'next/navigation';
import { getStoreBySlug } from '@/lib/stores';
import { getDayLedger } from '@/lib/movements';
import { formatMoney } from '@/lib/money';
import { todayISOCaracas } from '@/lib/date';
import MovementRow from './MovementRow';
import DateNav from './DateNav';
import MovementForm from './MovementForm';

export const dynamic = 'force-dynamic';
```

Then replace the one call site:

```tsx
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayISO();
```

with:

```tsx
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayISOCaracas();
```

- [ ] **Step 3: Verify with build and tests**

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected: all pass, no behavior change (this is a pure extraction — confirm by opening `http://localhost:3000/tienda/barinas` with `npm run dev` if a browser is available, and confirming the date shown still defaults to today).

- [ ] **Step 4: Commit**

```bash
git add lib/date.ts app/tienda/\[slug\]/page.tsx
git commit -m "Extract todayISOCaracas into a shared helper"
```

---

### Task 4: Report formatting and Telegram send (lib/telegram.ts)

**Files:**
- Create: `lib/telegram.ts`
- Create: `lib/telegram.test.ts`

**Interfaces:**
- Consumes: `Movement` from `lib/movements.ts`; `Balance` from `lib/balance.ts`; `toCents`, `formatMoney` from `lib/money.ts`.
- Produces:
  - `formatReportMessage(storeName: string, date: string, ledger: { movements: Movement[]; saldoInicial: Balance; saldoFinal: Balance }): string`
  - `sendTelegramMessage(chatId: string, text: string): Promise<void>`

- [ ] **Step 1: Write the failing tests for `formatReportMessage`**

Create `lib/telegram.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatReportMessage } from './telegram';

describe('formatReportMessage', () => {
  it('formats a day with movements in USD only', () => {
    const message = formatReportMessage('San Cristóbal', '2026-08-17', {
      movements: [
        {
          id: 1,
          store_id: 1,
          date: '2026-08-17',
          concept: 'Ingreso Ventas Diarias',
          type: 'ingreso',
          amount_usd: '100.00',
          amount_ves: '0',
        },
        {
          id: 2,
          store_id: 1,
          date: '2026-08-17',
          concept: 'Cambio Zelle',
          type: 'gasto',
          amount_usd: '50.00',
          amount_ves: '0',
        },
      ],
      saldoInicial: { usdCents: 15000, vesCents: 50000 },
      saldoFinal: { usdCents: 20000, vesCents: 50000 },
    });

    expect(message).toBe(
      [
        '*San Cristóbal* — Cierre 17/08/2026',
        '',
        'Saldo inicial: $150.00 / Bs 500.00',
        '',
        'Ingreso Ventas Diarias  +$100.00',
        'Cambio Zelle  -$50.00',
        '',
        'Saldo final: $200.00 / Bs 500.00',
      ].join('\n')
    );
  });

  it('shows "Sin movimientos hoy." when there are no movements', () => {
    const message = formatReportMessage('Barinas', '2026-08-17', {
      movements: [],
      saldoInicial: { usdCents: 15000, vesCents: 50000 },
      saldoFinal: { usdCents: 15000, vesCents: 50000 },
    });

    expect(message).toBe(
      [
        '*Barinas* — Cierre 17/08/2026',
        '',
        'Saldo inicial: $150.00 / Bs 500.00',
        '',
        'Sin movimientos hoy.',
        '',
        'Saldo final: $150.00 / Bs 500.00',
      ].join('\n')
    );
  });

  it('shows both currencies on the same line when both are non-zero', () => {
    const message = formatReportMessage('Barinas', '2026-08-17', {
      movements: [
        {
          id: 1,
          store_id: 1,
          date: '2026-08-17',
          concept: 'Ingreso Ventas Diarias',
          type: 'ingreso',
          amount_usd: '43.00',
          amount_ves: '1380.00',
        },
      ],
      saldoInicial: { usdCents: 0, vesCents: 0 },
      saldoFinal: { usdCents: 4300, vesCents: 138000 },
    });

    expect(message).toBe(
      [
        '*Barinas* — Cierre 17/08/2026',
        '',
        'Saldo inicial: $0.00 / Bs 0.00',
        '',
        'Ingreso Ventas Diarias  +$43.00  +Bs1380.00',
        '',
        'Saldo final: $43.00 / Bs 1380.00',
      ].join('\n')
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run lib/telegram.test.ts
```

Expected: FAIL — `lib/telegram.ts` does not exist yet.

- [ ] **Step 3: Implement `lib/telegram.ts`**

Create `lib/telegram.ts`:

```ts
import type { Movement } from './movements';
import type { Balance } from './balance';
import { toCents, formatMoney } from './money';

function formatDateDMY(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function formatSignedAmount(cents: number, prefix: string): string {
  if (cents === 0) return '';
  const sign = cents < 0 ? '-' : '+';
  return `${sign}${prefix}${formatMoney(Math.abs(cents))}`;
}

function formatMovementLine(movement: Movement): string {
  const sign = movement.type === 'gasto' ? -1 : 1;
  const usdCents = sign * toCents(movement.amount_usd);
  const vesCents = sign * toCents(movement.amount_ves);
  const amounts = [formatSignedAmount(usdCents, '$'), formatSignedAmount(vesCents, 'Bs')]
    .filter((part) => part !== '')
    .join('  ');
  return `${movement.concept}  ${amounts}`;
}

export function formatReportMessage(
  storeName: string,
  date: string,
  ledger: { movements: Movement[]; saldoInicial: Balance; saldoFinal: Balance }
): string {
  const { movements, saldoInicial, saldoFinal } = ledger;
  const movementsBlock =
    movements.length === 0 ? 'Sin movimientos hoy.' : movements.map(formatMovementLine).join('\n');

  return [
    `*${storeName}* — Cierre ${formatDateDMY(date)}`,
    '',
    `Saldo inicial: $${formatMoney(saldoInicial.usdCents)} / Bs ${formatMoney(saldoInicial.vesCents)}`,
    '',
    movementsBlock,
    '',
    `Saldo final: $${formatMoney(saldoFinal.usdCents)} / Bs ${formatMoney(saldoFinal.vesCents)}`,
  ].join('\n');
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set');
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API error (${response.status}): ${body}`);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run lib/telegram.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite**

```bash
npm test
```

Expected: PASS (12 tests total).

- [ ] **Step 6: Commit**

```bash
git add lib/telegram.ts lib/telegram.test.ts
git commit -m "Add report formatting and Telegram send"
```

---

### Task 5: Manual send Server Action

**Files:**
- Modify: `app/tienda/[slug]/actions.ts`

**Interfaces:**
- Consumes: `getStoreBySlug` (Task 2); `getDayLedger` (existing, `lib/movements.ts`); `formatReportMessage`, `sendTelegramMessage` (Task 4).
- Produces: `sendReportAction(formData: FormData): Promise<void>` — Server Action, expects `slug` and `date` fields in the FormData.

- [ ] **Step 1: Add the action**

Edit `app/tienda/[slug]/actions.ts`. Replace the import block:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { createMovement, updateMovement, deleteMovement } from '@/lib/movements';
```

with:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { createMovement, updateMovement, deleteMovement, getDayLedger } from '@/lib/movements';
import { getStoreBySlug } from '@/lib/stores';
import { formatReportMessage, sendTelegramMessage } from '@/lib/telegram';
```

Then add this function at the end of the file:

```ts
export async function sendReportAction(formData: FormData) {
  const slug = String(formData.get('slug'));
  const date = String(formData.get('date'));

  const store = await getStoreBySlug(slug);
  if (!store) {
    throw new Error('Tienda no encontrada.');
  }
  if (!store.telegram_chat_id) {
    throw new Error('Esta tienda no tiene Telegram configurado.');
  }

  const ledger = await getDayLedger(store.id, date);
  const message = formatReportMessage(store.name, date, ledger);
  await sendTelegramMessage(store.telegram_chat_id, message);
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 3: Verify the logic against the real database**

`sendReportAction` is a Server Action — it can't be invoked directly from a plain `node` script without the Next.js runtime (no TypeScript loader is configured in this project for that). Confirm correctness by reading the function against `addMovementAction` in the same file: both look up data, validate, and either throw a `Error` with a user-facing Spanish message or complete successfully — no `revalidatePath` call here, since sending a report doesn't change any movement data. The actual live call (button click → real Telegram message) is verified end-to-end in Task 6 Step 4, once there's a UI entry point to trigger it from.

- [ ] **Step 4: Commit**

```bash
git add app/tienda/\[slug\]/actions.ts
git commit -m "Add sendReportAction for manual Telegram sends"
```

---

### Task 6: "Enviar a Telegram" button

**Files:**
- Create: `app/tienda/[slug]/TelegramButton.tsx`
- Modify: `app/tienda/[slug]/page.tsx`

**Interfaces:**
- Consumes: `sendReportAction` (Task 5).
- Produces: `TelegramButton` component, takes `{ slug: string; date: string }`.

- [ ] **Step 1: Implement the button**

Create `app/tienda/[slug]/TelegramButton.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { sendReportAction } from './actions';

export default function TelegramButton({ slug, date }: { slug: string; date: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setStatus('sending');
    setError(null);

    const formData = new FormData();
    formData.set('slug', slug);
    formData.set('date', date);

    try {
      await sendReportAction(formData);
      setStatus('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar el reporte.');
      setStatus('idle');
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleSend}
        disabled={status === 'sending'}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {status === 'sending' ? 'Enviando...' : 'Enviar a Telegram'}
      </button>
      {status === 'sent' && <p className="mt-1 text-sm text-green-700">Reporte enviado.</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the page**

Edit `app/tienda/[slug]/page.tsx`. Add the import:

```tsx
import TelegramButton from './TelegramButton';
```

Then render it right after `<DateNav />`:

```tsx
      <h1 className="text-xl font-semibold">{store.name}</h1>
      <DateNav slug={store.slug} date={date} />
      <TelegramButton slug={store.slug} date={date} />

      <table className="mt-4 w-full text-sm">
```

- [ ] **Step 3: Verify with the build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Manual verification — real Telegram send**

Make sure `TELEGRAM_BOT_TOKEN` is in `.env.local` and the store you test with has `telegram_chat_id` set (Prerequisites).

```bash
npm run dev
```

If a browser is available: open `http://localhost:3000/tienda/barinas` (or whichever store has a `telegram_chat_id` configured), click "Enviar a Telegram", and confirm:
1. The button shows "Enviando..." then "Reporte enviado."
2. A real message arrives in that store's Telegram group, matching the format from Task 4 (store name bold, saldo inicial, movements or "Sin movimientos hoy.", saldo final).
3. Clicking a store with no `telegram_chat_id` configured shows the inline error "Esta tienda no tiene Telegram configurado."

If no browser is available in this environment: write a small throwaway script that imports `sendReportAction`'s underlying pieces directly —

```bash
node --env-file=.env.local -e "
(async () => {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);
  const [store] = await sql.query('select id, name, telegram_chat_id from stores where telegram_chat_id is not null limit 1');
  if (!store) { console.log('No store has telegram_chat_id set — set one per Prerequisites first.'); process.exit(1); }
  console.log('Testing with store:', store.name);

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const res = await fetch(\`https://api.telegram.org/bot\${token}/sendMessage\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: store.telegram_chat_id, text: 'Prueba de conexion desde el script de verificacion.', parse_mode: 'Markdown' }),
  });
  console.log('Telegram API response status:', res.status);
  console.log(await res.text());
})();
"
```

This confirms the bot token and chat_id are valid and Telegram actually delivers a message end-to-end, even without a browser. Note in your report which verification path you used, and if only the scripted fallback was available, flag that a real browser click-through of the button is still recommended before this ships.

- [ ] **Step 5: Commit**

```bash
git add app/tienda/\[slug\]/TelegramButton.tsx app/tienda/\[slug\]/page.tsx
git commit -m "Add Enviar a Telegram button to the daily ledger page"
```

---

### Task 7: Automatic daily send (Vercel Cron)

**Files:**
- Create: `app/api/cron/send-reports/route.ts`
- Create: `vercel.json`
- Modify: `.env.local.example`

**Interfaces:**
- Consumes: `listStores` (Task 2); `getDayLedger` (existing); `formatReportMessage`, `sendTelegramMessage` (Task 4); `todayISOCaracas` (Task 3).
- Produces: `GET /api/cron/send-reports` — protected route Vercel Cron calls daily.

- [ ] **Step 1: Implement the cron route**

Create `app/api/cron/send-reports/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { listStores } from '@/lib/stores';
import { getDayLedger } from '@/lib/movements';
import { formatReportMessage, sendTelegramMessage } from '@/lib/telegram';
import { todayISOCaracas } from '@/lib/date';

export const dynamic = 'force-dynamic';

interface SendResult {
  slug: string;
  status: 'sent' | 'skipped' | 'failed';
  error?: string;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const date = todayISOCaracas();
  const stores = await listStores();
  const results: SendResult[] = [];

  for (const store of stores) {
    if (!store.telegram_chat_id) {
      results.push({ slug: store.slug, status: 'skipped' });
      continue;
    }

    try {
      const ledger = await getDayLedger(store.id, date);
      const message = formatReportMessage(store.name, date, ledger);
      await sendTelegramMessage(store.telegram_chat_id, message);
      results.push({ slug: store.slug, status: 'sent' });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`Failed to send Telegram report for ${store.slug}:`, error);
      results.push({ slug: store.slug, status: 'failed', error });
    }
  }

  console.log('Telegram cron report results:', JSON.stringify({ date, results }));
  return NextResponse.json({ date, results });
}
```

- [ ] **Step 2: Add the Vercel Cron schedule**

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/send-reports",
      "schedule": "0 21 * * *"
    }
  ]
}
```

- [ ] **Step 3: Add the new env vars to the example file**

Edit `.env.local.example`, replace the whole file:

```
DATABASE_URL=postgres://user:password@host/dbname?sslmode=require
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
CRON_SECRET=a-random-secret-string
```

- [ ] **Step 4: Type-check and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: no type errors; build succeeds.

- [ ] **Step 5: Verify the auth guard and a real send locally**

Make sure `CRON_SECRET` is set in `.env.local` (Prerequisites) and at least one store has `telegram_chat_id` set.

```bash
npm run dev
```

In another terminal:

```bash
# Missing/wrong secret must be rejected
curl -i http://localhost:3000/api/cron/send-reports

# Correct secret must succeed and actually send to every configured store —
# only run this once you're ready for a real message to land in those groups.
curl -i -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/send-reports
```

Expected: first call returns `401 Unauthorized`. Second call returns `200` with a JSON body listing each store's `slug` and `status` (`sent`/`skipped`/`failed`), and a real Telegram message arrives in every store's group that has `telegram_chat_id` configured.

- [ ] **Step 6: Commit**

```bash
git add app/api/cron/send-reports/route.ts vercel.json .env.local.example
git commit -m "Add automatic daily Telegram send via Vercel Cron"
```

---

### Task 8: End-to-end QA and deployment

**Files:** none (verification and deployment only)

**Interfaces:** none — this task consumes the whole feature built in Tasks 1-7.

- [ ] **Step 1: Full manual QA pass**

With `npm run dev` running and at least two stores configured with real `telegram_chat_id` values:

1. Open a store with movements today, click "Enviar a Telegram". Confirm the message in the real Telegram group matches what's on screen (saldo inicial, each movement line with the correct sign, saldo final).
2. Navigate to a day with zero movements (e.g. tomorrow), click "Enviar a Telegram". Confirm the message shows "Sin movimientos hoy." and saldo inicial = saldo final.
3. Click the button twice in a row for the same day. Confirm it sends twice without any warning or error (per design — duplicates are expected and fine).
4. Open a store with no `telegram_chat_id` configured, click the button. Confirm the inline error "Esta tienda no tiene Telegram configurado." appears and no request reaches Telegram.
5. Re-run the cron endpoint verification from Task 7 Step 5 (with the real secret) and confirm every store with a `telegram_chat_id` receives a message, and the JSON response's `results` array correctly marks unconfigured stores as `skipped`.

Fix any issue found before proceeding; re-run the affected steps after fixing.

- [ ] **Step 2: Run the full automated test suite one more time**

```bash
npm test && npx tsc --noEmit && npm run build
```

Expected: all pass.

- [ ] **Step 3: Configure production environment variables and deploy**

```bash
npx vercel link
npx vercel env add TELEGRAM_BOT_TOKEN production
npx vercel env add CRON_SECRET production
npx vercel --prod
```

These are interactive commands (Vercel account login/link) — run them yourself rather than via an unattended script. `DATABASE_URL` should already be configured from the base app's deployment.

- [ ] **Step 4: Verify the production deployment**

Once deployed, click "Enviar a Telegram" on the production URL for one store and confirm the message arrives. Vercel Cron jobs only run on production deployments (not preview), so the automatic 17:00 send can only be confirmed by checking the Vercel project's Cron Jobs dashboard and function logs the next day — note this as a follow-up check for the human partner, not something to block this task on.

- [ ] **Step 5: Commit any fixes made during QA**

```bash
git add -A
git commit -m "Fix issues found during Telegram feature QA"
```

(Skip this commit if QA found nothing to fix.)
