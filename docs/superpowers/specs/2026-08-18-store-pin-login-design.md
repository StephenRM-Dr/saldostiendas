# Login por Tienda con PIN — Diseño

**Fecha:** 2026-08-18
**Estado:** Aprobado, pendiente de plan de implementación
**Relacionado:** [2026-08-14-cuadro-cierre-tiendas-design.md](2026-08-14-cuadro-cierre-tiendas-design.md) — el spec original excluyó explícitamente "autenticación / login por tienda"; este spec reintroduce esa pieza. [2026-08-17-admin-excel-export-design.md](2026-08-17-admin-excel-export-design.md) — reutiliza el mismo patrón de gate en `proxy.ts` + verificación duplicada en el propio handler que ya se usa para `/admin`.

## Contexto

Hoy `/tienda/[slug]` es pública: cualquiera con el enlace puede ver y
editar los movimientos de cualquier tienda. Se necesita un login simple
por tienda — un PIN de 4 dígitos, uno por tienda — para que solo el
personal de cada local pueda entrar a su propio cuadro de cierre.

## Objetivo

Cada una de las 7 tiendas queda protegida por su propio PIN de 4
dígitos. El empleado entra a `/tienda/[slug]`, si no tiene sesión activa
ve una pantalla de login con un input numérico, mete el PIN, y si es
correcto queda con sesión iniciada en ese dispositivo por 30 días (con
botón de "Cerrar sesión" visible en la página).

## Fuera de alcance

- Un PIN o usuario distinto por empleado — el PIN es por tienda, no
  individual.
- Cambiar el PIN desde la app (Admin o cualquier otra vista) — se
  asigna/cambia directo en la base de datos, igual que
  `telegram_chat_id` hoy.
- Expirar o forzar cambio periódico de PIN.
- Recuperación de PIN olvidado vía la app (contactar a quien administra
  la base de datos).
- Cualquier cambio a la protección de `/admin` — sigue con HTTP Basic
  Auth tal como está, sin relación con este mecanismo.
- Rate limiting por IP — el bloqueo es por tienda (ver Seguridad), no
  por dirección IP de origen.

## Modelo de datos

`db/schema.sql` gana tres columnas nuevas en `stores`, agregadas con
`alter table ... add column if not exists` (mismo patrón que
`telegram_chat_id`):

```sql
alter table stores add column if not exists pin text;
alter table stores add column if not exists pin_failed_attempts integer not null default 0;
alter table stores add column if not exists pin_locked_until timestamptz;
```

`pin` queda `null` en las 7 tiendas después de correr la migración.
**Mientras `pin` sea `null`, nadie puede entrar a esa tienda** — no hay
un PIN "vacío" que la deje abierta. Esto es una ruptura de
disponibilidad intencional en el momento del deploy: el rollout debe
incluir, inmediatamente después de migrar, un `UPDATE` manual poniendo
el PIN real de cada una de las 7 tiendas antes de que el personal
intente entrar.

## Arquitectura

- **`lib/storeAuth.ts`** (nuevo): firma y verifica la cookie de sesión
  usando HMAC-SHA256 vía Web Crypto (`crypto.subtle`), portátil entre
  runtime Node y Edge — igual espíritu que `lib/adminAuth.ts`, pero para
  sesiones firmadas en vez de comparación directa de contraseña. Expone
  `signStoreSession(slug): Promise<string>` y
  `verifyStoreSession(cookieValue, slug): Promise<boolean>`. La firma
  usa un secreto nuevo, `SESSION_SECRET`, variable de entorno del mismo
  tipo que `ADMIN_PASSWORD`/`CRON_SECRET`.
- **`proxy.ts`**: el matcher gana `/tienda/:path*`. Para esas rutas
  (excepto la propia página de login), busca la cookie
  `store_session_<slug>`; si falta o no verifica, redirige (307) a
  `/tienda/<slug>/login` en vez de devolver 401 — es un flujo de login
  real, no una API protegida.
- **`app/tienda/[slug]/login/page.tsx`** (nuevo): muestra el nombre de
  la tienda (vía `getStoreBySlug`) y un formulario con un input de 4
  dígitos (`inputMode="numeric"`, `maxLength={4}`, `pattern="[0-9]*"`).
- **`app/tienda/[slug]/login/actions.ts`** (nuevo): `verifyPinAction`
  hace todo el trabajo de verificación (ver Seguridad), y en éxito
  llama `signStoreSession`, setea la cookie (`httpOnly`, `secure` en
  producción, `sameSite: 'lax'`, `maxAge` 30 días) y redirige a
  `/tienda/[slug]`.
- **`app/tienda/[slug]/page.tsx`**: al inicio del Server Component,
  vuelve a verificar la cookie con `verifyStoreSession` (defensa en
  profundidad, mismo patrón que `isAuthorized` se llama tanto en
  `proxy.ts` como en `app/api/admin/export/route.ts`) — si no es
  válida, redirige a `/tienda/[slug]/login` aunque el proxy ya debería
  haberlo evitado. Gana un botón "Cerrar sesión" que llama a un nuevo
  `logoutAction` (borra la cookie, redirige a login).
- Las Server Actions existentes de movimientos (`actions.ts`) no
  necesitan su propio chequeo adicional: al ser invocadas como POST a
  la misma URL `/tienda/[slug]`, ya quedan cubiertas por el matcher de
  `proxy.ts`.

## Seguridad — anti-fuerza-bruta

Un PIN de 4 dígitos tiene solo 10,000 combinaciones. `verifyPinAction`
aplica bloqueo por tienda:

1. Si `pin_locked_until` de la tienda es una fecha futura, rechaza el
   intento sin comparar el PIN, mostrando cuántos minutos faltan.
2. Si el PIN coincide con `stores.pin`: resetea
   `pin_failed_attempts` a 0 y `pin_locked_until` a `null`, firma la
   sesión y redirige.
3. Si no coincide: incrementa `pin_failed_attempts`. Al llegar a 5,
   fija `pin_locked_until = now() + interval '15 minutes'` y resetea el
   contador a 0. Responde con un mensaje genérico ("PIN incorrecto"),
   sin distinguir explícitamente "bloqueado por intentos" de "PIN
   simplemente incorrecto" en el primer error — solo se informa el
   bloqueo cuando efectivamente hay uno activo (paso 1).

El bloqueo es por tienda (columna en `stores`), no por IP ni por
dispositivo — un atacante que cambie de IP sigue bloqueado para esa
tienda, y un empleado legítimo desde otro dispositivo también queda
bloqueado hasta que pase el tiempo. Se acepta ese trade-off por
simplicidad: no hay tabla de intentos separada ni Redis, todo vive en
las columnas nuevas de `stores`.

## Validaciones y manejo de errores

- Sin `SESSION_SECRET` configurado: `proxy.ts` debe rechazar el acceso
  a `/tienda/:path*` (fail-closed, mismo principio que `ADMIN_PASSWORD`
  ausente en el spec de Admin) — nunca dejar pasar sin secreto
  configurado para firmar/verificar sesiones.
- `pin` nulo en la base de datos: `verifyPinAction` rechaza cualquier
  intento para esa tienda con un mensaje claro ("Esta tienda no tiene
  PIN configurado todavía"), en vez de comparar contra `null`.
- Cookie presente pero corrupta o con firma inválida: se trata igual
  que "sin sesión" — redirige a login, no debe lanzar una excepción sin
  manejar.

## Testing

- `lib/storeAuth.ts` (firma/verificación HMAC) y la lógica pura de
  bloqueo (dado un estado de intentos/bloqueo, ¿debe rechazar o
  permitir seguir intentando?) se separan en funciones puras y se
  prueban con Vitest — mismo patrón que `formatReportMessage` y
  `buildStoreRows`.
- Verificación manual real: entrar a una tienda sin sesión (debe
  mandar a `/login`), PIN incorrecto varias veces hasta el bloqueo,
  esperar o simular el bloqueo activo, PIN correcto (debe entrar y
  quedar con cookie), cerrar sesión (debe volver a pedir PIN),
  confirmar que el PIN de una tienda no sirve para entrar a otra.
- Confirmar que sin `SESSION_SECRET` configurado el acceso a
  `/tienda/[slug]` queda bloqueado (fail-closed), igual que se probó
  para `ADMIN_PASSWORD` en el spec de Admin.
