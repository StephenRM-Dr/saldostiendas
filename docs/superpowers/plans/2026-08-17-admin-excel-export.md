# Vista Admin — Exportar Excel Consolidado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A password-protected `/admin` page where an administrator picks a date range and downloads a single `.xlsx` file with every store's movements in that range.

**Architecture:** `proxy.ts` (Next.js 16's replacement for `middleware.ts` — the old file name is deprecated in this version) gates `/admin` and `/api/admin` behind HTTP Basic Auth. A new `getRangeLedger` in `lib/movements.ts` mirrors the existing `getDayLedger` but for a date range. A pure `buildStoreRows` function turns one store's range ledger into flat spreadsheet rows; the export route calls it once per store and writes them into one `exceljs` worksheet.

**Tech Stack:** `exceljs` (new dependency — first Excel-generation library in this project), Next.js `proxy.ts` (HTTP Basic Auth), Vitest.

**Spec:** [docs/superpowers/specs/2026-08-17-admin-excel-export-design.md](../specs/2026-08-17-admin-excel-export-design.md)

## Global Constraints

- Una sola hoja, todas las tiendas juntas, orden alfabético (mismo orden que `listStores()`).
- Columnas: Tienda | Fecha | Concepto | Tipo | Monto USD | Monto VES — montos sin signo (positivos), Tipo en columna propia.
- Por tienda: fila "Saldo inicial del rango" → una fila por movimiento → fila "Saldo final del rango".
- `/admin` y `/api/admin/*` protegidos con HTTP Basic Auth vía `ADMIN_PASSWORD`; sin la variable configurada, el acceso se rechaza (fail-closed, nunca fail-open).
- Si falta una fecha o "desde" > "hasta": error claro, sin generar archivo.
- Node.js >= 20.6 (constraint heredada del proyecto base).
- **Importante:** este proyecto usa Next.js 16.3.1, donde `middleware.ts` está deprecado y renombrado a `proxy.ts` (función exportada como `proxy`, no `middleware`) — ver `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` si algo no coincide con lo que sabes de versiones anteriores de Next.js.

---

### Task 1: Range ledger data layer + row-building

**Files:**
- Modify: `lib/movements.ts`
- Create: `lib/adminExport.ts`
- Create: `lib/adminExport.test.ts`

**Interfaces:**
- Consumes: `Movement`, `getMovementsBefore` (existing) from `lib/movements.ts`; `Balance`, `computeBalance` from `lib/balance.ts`.
- Produces:
  - `getMovementsInRange(storeId: number, from: string, to: string): Promise<Movement[]>`
  - `getRangeLedger(storeId: number, from: string, to: string): Promise<{ movements: Movement[]; saldoInicial: Balance; saldoFinal: Balance }>`
  - `interface ExportRow { tienda: string; fecha: string; concepto: string; tipo: string; montoUsd: number; montoVes: number }`
  - `buildStoreRows(storeName: string, from: string, to: string, ledger: { movements: Movement[]; saldoInicial: Balance; saldoFinal: Balance }): ExportRow[]`

- [ ] **Step 1: Add the range queries to lib/movements.ts**

Edit `lib/movements.ts`. Add after the existing `getMovementsOnDate` function:

```ts
export async function getMovementsInRange(
  storeId: number,
  from: string,
  to: string
): Promise<Movement[]> {
  return (await sql.query(
    `select id, store_id, to_char(date, 'YYYY-MM-DD') as date, concept, type, amount_usd, amount_ves
     from movements where store_id = $1 and date >= $2 and date <= $3 order by date, created_at`,
    [storeId, from, to]
  )) as Movement[];
}

export async function getRangeLedger(
  storeId: number,
  from: string,
  to: string
): Promise<{ movements: Movement[]; saldoInicial: Balance; saldoFinal: Balance }> {
  const [before, inRange] = await Promise.all([
    getMovementsBefore(storeId, from),
    getMovementsInRange(storeId, from, to),
  ]);
  const saldoInicial = computeBalance(before);
  const rangeChange = computeBalance(inRange);
  const saldoFinal: Balance = {
    usdCents: saldoInicial.usdCents + rangeChange.usdCents,
    vesCents: saldoInicial.vesCents + rangeChange.vesCents,
  };
  return { movements: inRange, saldoInicial, saldoFinal };
}
```

(`getMovementsBefore` and `computeBalance` are already imported at the top of this file — no import changes needed for this step.)

- [ ] **Step 2: Write the failing test for buildStoreRows**

Create `lib/adminExport.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildStoreRows } from './adminExport';

describe('buildStoreRows', () => {
  it('produces saldo inicial, movement, and saldo final rows for a store', () => {
    const rows = buildStoreRows('Barinas', '2026-08-01', '2026-08-31', {
      movements: [
        {
          id: 1,
          store_id: 1,
          date: '2026-08-15',
          concept: 'Ingreso Ventas Diarias',
          type: 'ingreso',
          amount_usd: '100.00',
          amount_ves: '0',
        },
        {
          id: 2,
          store_id: 1,
          date: '2026-08-16',
          concept: 'Cambio Zelle',
          type: 'gasto',
          amount_usd: '30.00',
          amount_ves: '0',
        },
      ],
      saldoInicial: { usdCents: 5000, vesCents: 0 },
      saldoFinal: { usdCents: 12000, vesCents: 0 },
    });

    expect(rows).toEqual([
      {
        tienda: 'Barinas',
        fecha: '2026-08-01',
        concepto: 'Saldo inicial del rango',
        tipo: '',
        montoUsd: 50,
        montoVes: 0,
      },
      {
        tienda: 'Barinas',
        fecha: '2026-08-15',
        concepto: 'Ingreso Ventas Diarias',
        tipo: 'Ingreso',
        montoUsd: 100,
        montoVes: 0,
      },
      {
        tienda: 'Barinas',
        fecha: '2026-08-16',
        concepto: 'Cambio Zelle',
        tipo: 'Gasto',
        montoUsd: 30,
        montoVes: 0,
      },
      {
        tienda: 'Barinas',
        fecha: '2026-08-31',
        concepto: 'Saldo final del rango',
        tipo: '',
        montoUsd: 120,
        montoVes: 0,
      },
    ]);
  });

  it('produces just the two saldo rows when there are no movements in range', () => {
    const rows = buildStoreRows('Barinas', '2026-08-01', '2026-08-31', {
      movements: [],
      saldoInicial: { usdCents: 5000, vesCents: 0 },
      saldoFinal: { usdCents: 5000, vesCents: 0 },
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].concepto).toBe('Saldo inicial del rango');
    expect(rows[1].concepto).toBe('Saldo final del rango');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx vitest run lib/adminExport.test.ts
```

Expected: FAIL — `lib/adminExport.ts` does not exist yet.

- [ ] **Step 4: Implement lib/adminExport.ts**

Create `lib/adminExport.ts`:

```ts
import type { Movement } from './movements';
import type { Balance } from './balance';

export interface ExportRow {
  tienda: string;
  fecha: string;
  concepto: string;
  tipo: string;
  montoUsd: number;
  montoVes: number;
}

export function buildStoreRows(
  storeName: string,
  from: string,
  to: string,
  ledger: { movements: Movement[]; saldoInicial: Balance; saldoFinal: Balance }
): ExportRow[] {
  const rows: ExportRow[] = [];

  rows.push({
    tienda: storeName,
    fecha: from,
    concepto: 'Saldo inicial del rango',
    tipo: '',
    montoUsd: ledger.saldoInicial.usdCents / 100,
    montoVes: ledger.saldoInicial.vesCents / 100,
  });

  for (const movement of ledger.movements) {
    rows.push({
      tienda: storeName,
      fecha: movement.date,
      concepto: movement.concept,
      tipo: movement.type === 'ingreso' ? 'Ingreso' : 'Gasto',
      montoUsd: Number(movement.amount_usd),
      montoVes: Number(movement.amount_ves),
    });
  }

  rows.push({
    tienda: storeName,
    fecha: to,
    concepto: 'Saldo final del rango',
    tipo: '',
    montoUsd: ledger.saldoFinal.usdCents / 100,
    montoVes: ledger.saldoFinal.vesCents / 100,
  });

  return rows;
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run lib/adminExport.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 6: Run the full suite and type-check**

```bash
npm test
npx tsc --noEmit
```

Expected: all pass (11 tests total: 9 existing + 2 new).

- [ ] **Step 7: Commit**

```bash
git add lib/movements.ts lib/adminExport.ts lib/adminExport.test.ts
git commit -m "Add range ledger query and export row builder"
```

---

### Task 2: Excel export route

**Files:**
- Modify: `package.json` (add `exceljs` dependency)
- Create: `app/api/admin/export/route.ts`

**Interfaces:**
- Consumes: `listStores` from `lib/stores.ts`; `getRangeLedger` (Task 1); `buildStoreRows`, `ExportRow` (Task 1).
- Produces: `GET /api/admin/export?from=YYYY-MM-DD&to=YYYY-MM-DD` — returns an `.xlsx` file download, or a 400 with a plain-text error for an invalid/missing range.

- [ ] **Step 1: Install exceljs**

```bash
npm install exceljs
```

- [ ] **Step 2: Implement the export route**

Create `app/api/admin/export/route.ts`:

```ts
import { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { listStores } from '@/lib/stores';
import { getRangeLedger } from '@/lib/movements';
import { buildStoreRows } from '@/lib/adminExport';

export const dynamic = 'force-dynamic';

function isValidDate(value: string | null): value is string {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');

  if (!isValidDate(from) || !isValidDate(to) || from > to) {
    return new Response('Rango de fechas invalido: verifica que "desde" y "hasta" esten presentes y que "desde" no sea posterior a "hasta".', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const stores = await listStores();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Movimientos');
  sheet.columns = [
    { header: 'Tienda', key: 'tienda', width: 20 },
    { header: 'Fecha', key: 'fecha', width: 14 },
    { header: 'Concepto', key: 'concepto', width: 30 },
    { header: 'Tipo', key: 'tipo', width: 12 },
    { header: 'Monto USD', key: 'montoUsd', width: 14 },
    { header: 'Monto VES', key: 'montoVes', width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const store of stores) {
    const ledger = await getRangeLedger(store.id, from, to);
    const rows = buildStoreRows(store.name, from, to, ledger);
    sheet.addRows(rows);
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="movimientos_${from}_a_${to}.xlsx"`,
    },
  });
}
```

- [ ] **Step 3: Type-check and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: no type errors; build succeeds. If `workbook.xlsx.writeBuffer()`'s return type doesn't satisfy `Response`'s `BodyInit` directly (exceljs may type it as its own `Buffer`-like type), wrap it explicitly: `new Response(Buffer.from(buffer), { ... })` — `Buffer.from` on an already-`Buffer` value is a no-op copy, safe either way. Try without the wrapper first; only add it if `tsc` reports a type mismatch here.

- [ ] **Step 4: Verify with a real download**

```bash
npm run dev &
timeout 30 bash -c 'until curl -sf http://localhost:3000 >/dev/null; do sleep 1; done'
curl -s "http://localhost:3000/api/admin/export?from=2026-08-01&to=2026-08-31" -o /tmp/export-test.xlsx -w "HTTP %{http_code}, %{size_download} bytes\n"
curl -s -o /dev/null -w "invalid range status: %{http_code}\n" "http://localhost:3000/api/admin/export?from=2026-08-31&to=2026-08-01"
```

Expected: first call returns `200` with a non-trivial byte count (a real `.xlsx` is a zip archive, typically several KB even mostly empty). Second call (inverted range) returns `400`. Open `/tmp/export-test.xlsx` in Excel or LibreOffice (or unzip it and check `xl/worksheets/sheet1.xml` exists, confirming it's a valid `.xlsx` container) and confirm: one sheet named "Movimientos", bold header row, all 7 stores appear in the Tienda column, each with a "Saldo inicial del rango" and "Saldo final del rango" row.

Stop the dev server when done (`lsof -ti:3000 -sTCP:LISTEN | xargs -r kill` or the platform equivalent).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app/api/admin/export/route.ts
git commit -m "Add Excel export route for the admin date range"
```

---

### Task 3: Admin page and form

**Files:**
- Create: `app/admin/page.tsx`
- Create: `app/admin/AdminExportForm.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/export` (Task 2).
- Produces: the `/admin` route.

- [ ] **Step 1: Implement the form**

Create `app/admin/AdminExportForm.tsx`:

```tsx
'use client';

import { useState, type FormEvent } from 'react';

export default function AdminExportForm() {
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const from = String(formData.get('from') ?? '');
    const to = String(formData.get('to') ?? '');
    setError(null);

    if (!from || !to) {
      event.preventDefault();
      setError('Debe indicar ambas fechas.');
      return;
    }
    if (from > to) {
      event.preventDefault();
      setError('La fecha "desde" no puede ser posterior a "hasta".');
      return;
    }
    // Valid: let the native GET form submission proceed — the browser
    // navigates to /api/admin/export?from=...&to=... and downloads the file.
  }

  return (
    <form action="/api/admin/export" method="get" onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm">Desde</label>
        <input type="date" name="from" required className="w-full rounded border p-2" />
      </div>
      <div>
        <label className="block text-sm">Hasta</label>
        <input type="date" name="to" required className="w-full rounded border p-2" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
        Descargar Excel
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Implement the page**

Create `app/admin/page.tsx`:

```tsx
import AdminExportForm from './AdminExportForm';

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-6 text-xl font-semibold">Admin — Exportar Excel</h1>
      <AdminExportForm />
    </main>
  );
}
```

- [ ] **Step 3: Verify with the build**

```bash
npx tsc --noEmit
npm run build
```

Expected: no type errors; build succeeds; `/admin` appears in the build's route list.

- [ ] **Step 4: Commit**

```bash
git add app/admin/page.tsx app/admin/AdminExportForm.tsx
git commit -m "Add admin page with date-range export form"
```

---

### Task 4: Basic Auth protection

**Files:**
- Create: `proxy.ts` (project root — **not** `middleware.ts`, which is deprecated in this Next.js version)
- Modify: `.env.local.example`

**Interfaces:**
- Produces: HTTP Basic Auth gate on `/admin/:path*` and `/api/admin/:path*`, checked against the `ADMIN_PASSWORD` env var.

- [ ] **Step 1: Implement the proxy**

Create `proxy.ts` at the project root (same level as `app/`, `lib/`, `package.json` — **not** inside `app/`):

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return new Response('ADMIN_PASSWORD no esta configurado en el servidor.', { status: 500 });
  }

  const expected = `Basic ${Buffer.from(`admin:${password}`).toString('base64')}`;
  const authHeader = request.headers.get('authorization');

  if (authHeader !== expected) {
    return new Response('Autenticacion requerida.', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
```

- [ ] **Step 2: Add ADMIN_PASSWORD to the env example**

Edit `.env.local.example`, add a new line:

```
ADMIN_PASSWORD=change-me-to-a-real-password
```

(If this project's `.env.local.example` currently only has `DATABASE_URL`, add the new line after it — do not remove or reorder the existing line.)

- [ ] **Step 3: Set a real password locally and type-check**

Add a real value for `ADMIN_PASSWORD` to `.env.local` (not `.env.local.example`) so the next step's verification can succeed instead of hitting the fail-closed 500.

```bash
npx tsc --noEmit
npm run build
```

Expected: no type errors; build succeeds.

- [ ] **Step 4: Verify the auth gate with real requests**

```bash
npm run dev &
timeout 30 bash -c 'until curl -sf http://localhost:3000 >/dev/null; do sleep 1; done'

# No credentials: must be rejected
curl -s -o /dev/null -w "no auth: %{http_code}\n" http://localhost:3000/admin

# Wrong password: must be rejected
curl -s -o /dev/null -w "wrong password: %{http_code}\n" -u "admin:wrong-password" http://localhost:3000/admin

# Correct password: must succeed
curl -s -o /dev/null -w "correct password: %{http_code}\n" -u "admin:$(grep '^ADMIN_PASSWORD=' .env.local | cut -d= -f2)" http://localhost:3000/admin

# The export route must be protected too
curl -s -o /dev/null -w "export route, no auth: %{http_code}\n" "http://localhost:3000/api/admin/export?from=2026-08-01&to=2026-08-31"

# The rest of the app must be unaffected
curl -s -o /dev/null -w "home page, no auth: %{http_code}\n" http://localhost:3000/
```

Expected: `no auth` → 401, `wrong password` → 401, `correct password` → 200, `export route, no auth` → 401, `home page, no auth` → 200 (unaffected — `/` is not covered by the matcher).

Stop the dev server when done.

- [ ] **Step 5: Commit**

```bash
git add proxy.ts .env.local.example
git commit -m "Protect /admin and /api/admin with HTTP Basic Auth"
```

---

### Task 5: End-to-end QA

**Files:** none (verification only)

**Interfaces:** none — this task consumes the whole feature built in Tasks 1-4.

- [ ] **Step 1: Full manual QA pass**

With `npm run dev` running and `ADMIN_PASSWORD` set in `.env.local`:

1. Visit `/admin` without credentials in a browser — confirm the browser's native Basic Auth prompt appears (or, if testing via `curl`, a 401).
2. With the correct password, submit a valid date range — confirm a real `.xlsx` file downloads, and opening it shows all 7 stores with correct saldo inicial/movimientos/saldo final rows for that range.
3. Try submitting with "desde" after "hasta" — confirm the inline error appears on the page and no request reaches the export route (check the terminal running `npm run dev`: no new request logged for that attempt).
4. Try leaving a date field empty — confirm the browser's native `required` validation blocks submission (no need for a custom message here, the native one is enough).
5. Directly request `/api/admin/export` with an invalid range (`from` after `to`) while authenticated — confirm a 400 with a readable plain-text message, not a crash.
6. Confirm `/`, `/tienda/<slug>` still work without any credentials (the Basic Auth gate must not have leaked outside `/admin` and `/api/admin`).

Fix any issue found before proceeding; re-run the affected steps after fixing.

- [ ] **Step 2: Run the full automated test suite one more time**

```bash
npm test && npx tsc --noEmit && npm run build
```

Expected: all pass.

- [ ] **Step 3: Commit any fixes made during QA**

```bash
git add -A
git commit -m "Fix issues found during admin export QA"
```

(Skip this commit if QA found nothing to fix.)
