# Reporte como Imagen en Telegram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain-text Telegram report (manual button + automatic daily cron) with a photo of the cuadro de cierre — same visual layout as the on-screen table — with the existing text as the photo's caption.

**Architecture:** `next/og`'s `ImageResponse` (Satori + Resvg, built into Next.js) renders a JSX table into PNG bytes server-side, no headless browser needed. A new `sendTelegramPhoto` replaces `sendTelegramMessage` in both the manual Server Action and the cron route; `formatReportMessage`'s existing output becomes the photo's caption unchanged.

**Tech Stack:** `next/og` (`ImageResponse`), Telegram Bot API `sendPhoto` (multipart via native `fetch`/`FormData`/`Blob`), Vitest.

**Spec:** [docs/superpowers/specs/2026-08-17-telegram-report-image-design.md](../specs/2026-08-17-telegram-report-image-design.md)

## Global Constraints

- Imagen: ancho fijo 800px, alto calculado según cantidad de movimientos (título + encabezado + saldo inicial + filas de movimientos + saldo final).
- Colores: encabezado y saldo final `#fde047`, saldo inicial `#fef9c3`, movimientos fondo blanco — igual que la tabla en pantalla.
- El caption de la foto reusa `formatReportMessage` sin cambios; Telegram trunca automáticamente si excede 1024 caracteres (limitación aceptada).
- `sendTelegramMessage` (solo texto) se elimina — ya no la usa nadie después de este plan.
- No hay botón de descarga — solo se envía por Telegram (manual + automático).
- Node.js >= 20.6 (constraint heredada del proyecto base; `FormData`/`Blob` nativos disponibles).

---

### Task 1: Extract shared signedAmount helper

**Files:**
- Create: `lib/movementDisplay.ts`
- Modify: `app/tienda/[slug]/MovementRow.tsx`

**Interfaces:**
- Consumes: `Movement` from `lib/movements.ts`; `toCents`, `formatMoney` from `lib/money.ts`.
- Produces: `signedAmount(movement: Movement, field: 'amount_usd' | 'amount_ves'): string` — blank string if the amount is zero, otherwise the signed formatted amount (negative for `gasto`), no currency prefix.

This extracts `MovementRow.tsx`'s existing private `signedAmount` helper so `lib/reportImage.tsx` (Task 2) can reuse the exact same on-screen amount-formatting logic instead of duplicating it.

- [ ] **Step 1: Create the shared helper**

Create `lib/movementDisplay.ts`:

```ts
import { toCents, formatMoney } from './money';
import type { Movement } from './movements';

export function signedAmount(movement: Movement, field: 'amount_usd' | 'amount_ves'): string {
  const cents = toCents(movement[field]);
  if (cents === 0) return '';
  const signed = movement.type === 'gasto' ? -cents : cents;
  return formatMoney(signed);
}
```

- [ ] **Step 2: Use it from MovementRow.tsx instead of the local copy**

Edit `app/tienda/[slug]/MovementRow.tsx`. Replace:

```tsx
'use client';

import { useState } from 'react';
import { formatMoney, toCents } from '@/lib/money';
import { updateMovementAction, deleteMovementAction } from './actions';
import { CONCEPTS, OTRO_LABEL } from '@/lib/concepts';
import type { Movement } from '@/lib/movements';

function signedAmount(movement: Movement, field: 'amount_usd' | 'amount_ves'): string {
  const cents = toCents(movement[field]);
  if (cents === 0) return '';
  const signed = movement.type === 'gasto' ? -cents : cents;
  return formatMoney(signed);
}
```

with:

```tsx
'use client';

import { useState } from 'react';
import { updateMovementAction, deleteMovementAction } from './actions';
import { CONCEPTS, OTRO_LABEL } from '@/lib/concepts';
import { signedAmount } from '@/lib/movementDisplay';
import type { Movement } from '@/lib/movements';
```

The two call sites (`signedAmount(movement, 'amount_usd')` and `signedAmount(movement, 'amount_ves')`) stay exactly as they are — only the import changes, not the usage.

- [ ] **Step 3: Verify with tests and build**

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected: all pass, no behavior change (pure extraction).

- [ ] **Step 4: Commit**

```bash
git add lib/movementDisplay.ts app/tienda/\[slug\]/MovementRow.tsx
git commit -m "Extract signedAmount into a shared helper"
```

---

### Task 2: Report image generation (lib/reportImage.tsx)

**Files:**
- Create: `lib/reportImage.tsx`
- Create: `lib/reportImage.test.ts`

**Interfaces:**
- Consumes: `Movement` from `lib/movements.ts`; `Balance` from `lib/balance.ts`; `formatMoney` from `lib/money.ts`; `signedAmount` from `lib/movementDisplay.ts` (Task 1); `ImageResponse` from `next/og`.
- Produces:
  - `calculateImageHeight(movementCount: number): number`
  - `generateReportImageBuffer(storeName: string, date: string, ledger: { movements: Movement[]; saldoInicial: Balance; saldoFinal: Balance }): Promise<Buffer>`

- [ ] **Step 1: Write the failing test for `calculateImageHeight`**

Create `lib/reportImage.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { calculateImageHeight } from './reportImage';

describe('calculateImageHeight', () => {
  it('reserves one row for "Sin movimientos hoy." when there are no movements', () => {
    expect(calculateImageHeight(0)).toBe(310);
  });

  it('uses one row per movement when there is at least one', () => {
    expect(calculateImageHeight(1)).toBe(310);
    expect(calculateImageHeight(3)).toBe(400);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run lib/reportImage.test.ts
```

Expected: FAIL — `lib/reportImage.tsx` does not exist yet.

- [ ] **Step 3: Implement `lib/reportImage.tsx`**

Create `lib/reportImage.tsx`:

```tsx
import { ImageResponse } from 'next/og';
import { formatMoney } from './money';
import { signedAmount } from './movementDisplay';
import type { Movement } from './movements';
import type { Balance } from './balance';

const IMAGE_WIDTH = 800;
const TITLE_HEIGHT = 90;
const ROW_HEIGHT = 45;
const VERTICAL_PADDING = 40;
const YELLOW = '#fde047';
const YELLOW_LIGHT = '#fef9c3';
const WHITE = '#ffffff';

export function calculateImageHeight(movementCount: number): number {
  const dataRows = Math.max(movementCount, 1);
  const totalRows = dataRows + 3; // header + saldo inicial + data rows + saldo final
  return TITLE_HEIGHT + VERTICAL_PADDING + totalRows * ROW_HEIGHT;
}

function formatDateDMY(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function Row({
  concept,
  usd,
  ves,
  background,
  bold,
}: {
  concept: string;
  usd: string;
  ves: string;
  background: string;
  bold?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: `${ROW_HEIGHT}px`,
        backgroundColor: background,
        fontWeight: bold ? 700 : 400,
        fontSize: 20,
        borderBottom: '1px solid #d1d5db',
      }}
    >
      <div style={{ display: 'flex', width: '400px', alignItems: 'center', padding: '0 12px' }}>
        {concept}
      </div>
      <div
        style={{
          display: 'flex',
          width: '200px',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 12px',
        }}
      >
        {usd}
      </div>
      <div
        style={{
          display: 'flex',
          width: '200px',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 12px',
        }}
      >
        {ves}
      </div>
    </div>
  );
}

export function buildReportImageElement(
  storeName: string,
  date: string,
  ledger: { movements: Movement[]; saldoInicial: Balance; saldoFinal: Balance }
) {
  const { movements, saldoInicial, saldoFinal } = ledger;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: `${IMAGE_WIDTH}px`,
        backgroundColor: WHITE,
        fontFamily: 'sans-serif',
        color: '#111827',
      }}
    >
      <div
        style={{
          display: 'flex',
          height: `${TITLE_HEIGHT}px`,
          alignItems: 'center',
          padding: '0 12px',
          fontSize: 28,
          fontWeight: 700,
        }}
      >
        {`${storeName} — Cierre ${formatDateDMY(date)}`}
      </div>
      <Row concept="Concepto" usd="Dólares" ves="Bolívares" background={YELLOW} bold />
      <Row
        concept="Saldo al inicio del día"
        usd={formatMoney(saldoInicial.usdCents)}
        ves={formatMoney(saldoInicial.vesCents)}
        background={YELLOW_LIGHT}
        bold
      />
      {movements.length === 0 ? (
        <Row concept="Sin movimientos hoy." usd="" ves="" background={WHITE} />
      ) : (
        movements.map((m) => (
          <Row
            key={m.id}
            concept={m.concept}
            usd={signedAmount(m, 'amount_usd')}
            ves={signedAmount(m, 'amount_ves')}
            background={WHITE}
          />
        ))
      )}
      <Row
        concept="Saldo al Final del día"
        usd={formatMoney(saldoFinal.usdCents)}
        ves={formatMoney(saldoFinal.vesCents)}
        background={YELLOW}
        bold
      />
    </div>
  );
}

export async function generateReportImageBuffer(
  storeName: string,
  date: string,
  ledger: { movements: Movement[]; saldoInicial: Balance; saldoFinal: Balance }
): Promise<Buffer> {
  const height = calculateImageHeight(ledger.movements.length);
  const imageResponse = new ImageResponse(buildReportImageElement(storeName, date, ledger), {
    width: IMAGE_WIDTH,
    height,
  });
  const arrayBuffer = await imageResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run lib/reportImage.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Generate a real image and look at it**

This is the highest-risk step in this task — `ImageResponse`/Satori has real constraints (flexbox-only CSS, specific font handling) that no unit test catches. Verify it actually works by generating a real PNG through the running app and viewing it, in isolation from the Telegram-sending code (Tasks 3-4) — so a rendering problem here isn't confused with a Telegram API problem later. Plain `node -e` can't import a `.tsx` file directly (no loader configured in this project), so use a temporary Route Handler instead:

Create `app/api/debug-report-image/route.ts`:

```ts
import { generateReportImageBuffer } from '@/lib/reportImage';

export async function GET() {
  const buffer = await generateReportImageBuffer('San Cristóbal', '2026-08-17', {
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
    saldoFinal: { usdCents: 10800, vesCents: 188000 },
  });
  return new Response(buffer, { headers: { 'Content-Type': 'image/png' } });
}
```

Run it and fetch the image:

```bash
npm run dev &
timeout 30 bash -c 'until curl -sf http://localhost:3000 >/dev/null; do sleep 1; done'
curl -s http://localhost:3000/api/debug-report-image -o /tmp/report-preview.png
```

View `/tmp/report-preview.png` (e.g. with the Read tool, if available) and confirm: the table renders with the right colors and column alignment, both movement rows show the correct signed amounts, and — importantly — the accented characters ("Cristóbal", "día") render correctly with Satori's default font rather than as boxes or missing glyphs. If accents don't render correctly, note it as a concern; the fix (bundling a custom font via `ImageResponse`'s `fonts` option) is out of scope for this step but must be flagged, not silently ignored.

Stop the dev server, then **delete** `app/api/debug-report-image/route.ts` — it was only scaffolding for this check, not part of the shipped feature.

- [ ] **Step 6: Run the full suite**

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add lib/reportImage.tsx lib/reportImage.test.ts
git commit -m "Add report image generation"
```

---

### Task 3: sendTelegramPhoto

**Files:**
- Modify: `lib/telegram.ts`

**Interfaces:**
- Produces: `sendTelegramPhoto(chatId: string, imageBuffer: Buffer, caption: string): Promise<void>`. Removes: `sendTelegramMessage` (no longer used by anything after Task 4).

- [ ] **Step 1: Replace sendTelegramMessage with sendTelegramPhoto**

Edit `lib/telegram.ts`. Replace the `sendTelegramMessage` function:

```ts
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

with:

```ts
export async function sendTelegramPhoto(
  chatId: string,
  imageBuffer: Buffer,
  caption: string
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set');
  }

  const formData = new FormData();
  formData.set('chat_id', chatId);
  formData.set('caption', caption);
  formData.set('parse_mode', 'Markdown');
  formData.set('photo', new Blob([imageBuffer], { type: 'image/png' }), 'reporte.png');

  const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API error (${response.status}): ${body}`);
  }
}
```

`formatReportMessage` above it is untouched — its output becomes the `caption` argument passed in by the callers in Task 4.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: this will show errors in `app/tienda/[slug]/actions.ts` and `app/api/cron/send-reports/route.ts`, since they still import and call the now-removed `sendTelegramMessage`. That's expected — Task 4 fixes both call sites. Confirm the errors are exactly those two `sendTelegramMessage` references and nothing else.

- [ ] **Step 3: Run the existing telegram tests**

```bash
npx vitest run lib/telegram.test.ts
```

Expected: PASS (3 tests — these cover `formatReportMessage`, which is unchanged).

- [ ] **Step 4: Commit**

```bash
git add lib/telegram.ts
git commit -m "Replace sendTelegramMessage with sendTelegramPhoto"
```

(The two known `tsc` errors from Step 2 are expected to exist at this commit — they're fixed in the very next task, which is why this plan runs them in this order rather than batching. Do not skip committing here.)

---

### Task 4: Wire the photo send into the manual action and cron route

**Files:**
- Modify: `app/tienda/[slug]/actions.ts`
- Modify: `app/api/cron/send-reports/route.ts`

**Interfaces:**
- Consumes: `sendTelegramPhoto` (Task 3); `generateReportImageBuffer` (Task 2); `formatReportMessage` (unchanged, existing).

- [ ] **Step 1: Update the manual Server Action**

Edit `app/tienda/[slug]/actions.ts`. Replace the import line:

```ts
import { formatReportMessage, sendTelegramMessage } from '@/lib/telegram';
```

with:

```ts
import { formatReportMessage, sendTelegramPhoto } from '@/lib/telegram';
import { generateReportImageBuffer } from '@/lib/reportImage';
```

Then replace the body of `sendReportAction`:

```ts
  const ledger = await getDayLedger(store.id, date);
  const message = formatReportMessage(store.name, date, ledger);
  await sendTelegramMessage(store.telegram_chat_id, message);
```

with:

```ts
  const ledger = await getDayLedger(store.id, date);
  const caption = formatReportMessage(store.name, date, ledger);
  const imageBuffer = await generateReportImageBuffer(store.name, date, ledger);
  await sendTelegramPhoto(store.telegram_chat_id, imageBuffer, caption);
```

- [ ] **Step 2: Update the cron route**

Edit `app/api/cron/send-reports/route.ts`. Replace the import line:

```ts
import { formatReportMessage, sendTelegramMessage } from '@/lib/telegram';
```

with:

```ts
import { formatReportMessage, sendTelegramPhoto } from '@/lib/telegram';
import { generateReportImageBuffer } from '@/lib/reportImage';
```

Then replace the inner try block:

```ts
    try {
      const ledger = await getDayLedger(store.id, date);
      const message = formatReportMessage(store.name, date, ledger);
      await sendTelegramMessage(store.telegram_chat_id, message);
      results.push({ slug: store.slug, status: 'sent' });
    } catch (err) {
```

with:

```ts
    try {
      const ledger = await getDayLedger(store.id, date);
      const caption = formatReportMessage(store.name, date, ledger);
      const imageBuffer = await generateReportImageBuffer(store.name, date, ledger);
      await sendTelegramPhoto(store.telegram_chat_id, imageBuffer, caption);
      results.push({ slug: store.slug, status: 'sent' });
    } catch (err) {
```

- [ ] **Step 3: Type-check and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: no type errors (the two errors from Task 3 Step 2 are now resolved); build succeeds.

- [ ] **Step 4: Manual verification — real photo delivery**

With `TELEGRAM_BOT_TOKEN` in `.env.local` and at least one store's `telegram_chat_id` configured (already set up from the previous plan):

```bash
npm run dev
```

If a browser is available, use it directly (Playwright via `npx playwright` if no interactive browser is available — see the previous plan's Task 6 for the exact driver-script pattern used earlier in this project). Open the configured store's page, click "Enviar a Telegram", and confirm:
1. The button shows "Enviando..." then "Reporte enviado." with no console errors.
2. A real **photo** (not a text message) arrives in the Telegram group, with the caption text visible below it.
3. The image itself matches the design: yellow header/saldo rows, correct amounts, correct accents.

Also re-trigger the cron endpoint (`curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/send-reports`) and confirm the configured store now sends a photo too, with the same `{"status":"sent"}` response shape as before.

- [ ] **Step 5: Commit**

```bash
git add app/tienda/\[slug\]/actions.ts app/api/cron/send-reports/route.ts
git commit -m "Send Telegram reports as a photo instead of plain text"
```

---

### Task 5: End-to-end QA

**Files:** none (verification only)

**Interfaces:** none — this task consumes the whole feature built in Tasks 1-4.

- [ ] **Step 1: Full manual QA pass**

With `npm run dev` running and at least one store configured with a real `telegram_chat_id`:

1. A day with movements in both USD and VES: confirm the photo shows every movement with correctly signed amounts in both columns, and the caption text matches.
2. A day with zero movements: confirm the photo shows "Sin movimientos hoy." and the caption does too.
3. Click "Enviar a Telegram" twice in a row: confirm it sends twice without any warning (per design).
4. A store with no `telegram_chat_id`: confirm the inline error "Esta tienda no tiene Telegram configurado." still appears, and no request reaches Telegram.
5. Trigger the cron endpoint and confirm every configured store receives a photo, unconfigured ones are `skipped`, and the JSON response shape is unchanged from before.

Fix any issue found before proceeding; re-run the affected steps after fixing.

- [ ] **Step 2: Run the full automated test suite one more time**

```bash
npm test && npx tsc --noEmit && npm run build
```

Expected: all pass.

- [ ] **Step 3: Commit any fixes made during QA**

```bash
git add -A
git commit -m "Fix issues found during report-image QA"
```

(Skip this commit if QA found nothing to fix.)
