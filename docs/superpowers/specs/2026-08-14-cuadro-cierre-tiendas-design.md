# Cuadro de Cierre de Tiendas — Diseño

**Fecha:** 2026-08-14
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

Cada una de las 7 tiendas reporta diariamente su cierre de caja (efectivo en
USD y VES) a través de un mensaje de WhatsApp con una foto de una hoja de
Excel tipeada manualmente ("CUADRO DE CIERRE PERSONAL TIENDA [NOMBRE]"). El
formato registra: saldo inicial del día (= cierre del día anterior),
movimientos del día (ventas, cambios de Zelle, gastos, etc.) cada uno con
montos en USD y/o VES, y el saldo final del día.

El objetivo es reemplazar ese proceso manual por una aplicación web donde
cada tienda carga sus movimientos directamente, y la propia pantalla actúa
como el "informe" (equivalente visual a la tabla de Excel), sin necesidad de
transcripción manual ni Excel.

## Objetivo

Una app web (Next.js en Vercel + Neon Postgres) donde cada una de las 7
tiendas registra sus movimientos de caja diarios (USD y VES) y visualiza su
propio cuadro de cierre — saldo inicial, movimientos, saldo final — igual en
espíritu al formato de Excel que usan hoy.

## Fuera de alcance (por ahora)

- Autenticación / login por tienda (se decidió selector de tienda sin
  contraseña).
- Vista consolidada de las 7 tiendas en un solo dashboard.
- Exportar/compartir el informe como imagen, PDF o texto.
- Migración de historial de Excels anteriores (el sistema arranca limpio).
- Cierre de día formal con bloqueo de movimientos pasados (se decidió un
  ledger continuo, siempre editable).
- Monedas adicionales a USD y VES.

Estos puntos quedan identificados como posibles extensiones futuras, no como
trabajo pendiente de este spec.

## Arquitectura

- **Next.js** (App Router) desplegado en **Vercel**.
- **Neon Postgres** como base de datos.
- Server Actions de Next.js para leer/escribir movimientos directamente
  contra Neon — sin capa de API REST separada.
- Sin autenticación: la ruta raíz (`/`) muestra un selector de las 7 tiendas,
  que lleva a `/tienda/[slug]`.
- Un solo repo y un solo deploy en Vercel sirviendo las 7 tiendas (no un
  proyecto por tienda).

## Modelo de datos

```sql
stores
  id            serial primary key
  slug          text unique not null      -- ej. 'barinas'
  name          text not null             -- ej. 'Tienda Barinas'

movements
  id            serial primary key
  store_id      integer not null references stores(id)
  date          date not null             -- día del movimiento (editable, no siempre "hoy")
  concept       text not null             -- nombre del concepto elegido, o texto libre si "Otro"
  type          text not null check (type in ('ingreso', 'gasto'))
  amount_usd    numeric(12,2) not null default 0
  amount_ves    numeric(12,2) not null default 0
  created_at    timestamptz not null default now()
```

Notas de diseño:

- **No existe tabla de "días" ni saldo inicial almacenado.** El saldo en
  cualquier punto es la suma acumulada de movimientos de esa tienda,
  sumando cuando `type = 'ingreso'` y restando cuando `type = 'gasto'`.
  - `Saldo al inicio del día` de una fecha = acumulado de todos los
    movimientos con `date <` esa fecha.
  - `Saldo al Final del día` = saldo al inicio + suma (signada) de los
    movimientos con `date =` esa fecha.
- **Arranque en limpio por tienda:** el primer movimiento histórico de cada
  tienda (ej. un "Ajuste de caja" con el efectivo que tengan el día que
  empiecen a usar el sistema) establece el punto de partida. No hace falta
  un campo de saldo inicial en `stores`.
- **Catálogo de conceptos vive en el código del formulario, no en la base de
  datos** (lista fija corta: Ingreso Ventas Diarias, Cambio Zelle, Ajuste de
  Caja, Gasto, + "Otro" con texto libre). Cada concepto predefinido tiene un
  `type` sugerido que precarga el formulario; el usuario puede cambiarlo con
  un toggle Ingreso/Gasto.
- **Sin bloqueo de fechas:** cualquier movimiento de cualquier fecha se
  puede editar o eliminar en cualquier momento.
- Las 7 tiendas se precargan como filas fijas en `stores` (seed inicial, no
  hace falta UI de administración de tiendas).

## Flujo de UI / páginas

- **`/`** — selector de las 7 tiendas (tarjetas o lista) → `/tienda/[slug]`.
- **`/tienda/[slug]`** — vista principal, por defecto el día de **hoy**:
  - Encabezado con nombre de tienda y fecha.
  - Fila "Saldo al inicio del día" (calculada, no editable).
  - Tabla de movimientos del día (concepto, monto USD, monto Bs), con
    edición/eliminación inline por fila.
  - Formulario para agregar un movimiento (concepto: lista + "Otro", toggle
    Ingreso/Gasto, monto USD, monto Bs) — diseñado para uso cómodo desde el
    celular.
  - Fila "Saldo al Final del día" (calculada).
  - Selector de fecha para navegar a días anteriores y ver/corregir esos
    movimientos (misma vista, otra fecha).
- La tabla en pantalla **es** el informe — no hay exportar/compartir en esta
  versión.

## Validaciones y manejo de errores

- Un movimiento requiere al menos uno de `amount_usd` / `amount_ves` mayor
  que 0 (no se permiten movimientos vacíos).
- Los montos se ingresan siempre en positivo; el signo real lo determina
  `type` (ingreso/gasto), para evitar errores de signo al tipear.
- `concept` no puede estar vacío (si es "Otro", el texto libre es
  obligatorio).
- Montos como `numeric(12,2)` en Postgres, nunca floats, para evitar
  errores de redondeo en dinero.
- No se valida fecha futura ni rangos — se mantiene simple dado que no hay
  bloqueo de días.

## Testing

- Test unitario para la función pura que calcula el saldo acumulado dado un
  conjunto de movimientos — es la lógica con mayor riesgo de bug silencioso.
- Verificación manual del flujo completo en navegador (agregar, editar,
  eliminar movimiento; navegar entre fechas) antes de dar por cerrada la
  implementación.
- Sin tests end-to-end automatizados por ahora.
