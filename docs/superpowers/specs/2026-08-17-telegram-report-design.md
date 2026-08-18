# Envío de Reporte a Telegram — Diseño

**Fecha:** 2026-08-17
**Estado:** Aprobado, pendiente de plan de implementación
**Extiende:** [2026-08-14-cuadro-cierre-tiendas-design.md](2026-08-14-cuadro-cierre-tiendas-design.md)

## Contexto

El spec original de "Cuadro de Cierre de Tiendas" dejó explícitamente fuera
de alcance "exportar/compartir el informe" — hoy el cuadro solo existe como
tabla en pantalla. En la práctica, las tiendas necesitan seguir mandando el
cierre del día a un grupo de Telegram (reemplazando el envío manual por
WhatsApp que se hacía antes con la foto del Excel). Este spec agrega esa
capacidad como extensión del sistema ya construido.

## Objetivo

Cada una de las 7 tiendas puede enviar su cuadro de cierre del día a su
propio grupo de Telegram, de dos formas:

- **Manual:** un botón en `/tienda/[slug]` envía el cuadro de la fecha que
  se está viendo en ese momento.
- **Automático:** todos los días a las 17:00 hora Venezuela, el sistema
  envía el cuadro del día actual de cada tienda sin intervención humana.

## Fuera de alcance

- UI de administración para configurar los `chat_id` (se cargan
  directamente en la base de datos).
- Reintentos automáticos si un envío falla.
- Confirmación de lectura o interacción con el mensaje (no es un bot
  interactivo, solo envía).
- Reporte como imagen/captura de la tabla (se decidió texto plano
  formateado).
- Rastrear si un reporte "ya se envió" ese día — reenviar es válido y no
  requiere confirmación.

## Arquitectura

- Un **bot de Telegram** ya existente (token de BotFather, provisto por el
  usuario) — no se crea uno nuevo como parte de este trabajo.
- Nueva variable de entorno `TELEGRAM_BOT_TOKEN` (secreto compartido, nunca
  expuesto al cliente).
- Nueva columna `telegram_chat_id` en la tabla `stores` — un grupo de
  Telegram por tienda. El usuario carga los 7 valores directamente en la
  base después de la migración; no hay UI para esto.
- **Envío manual:** un Server Action (`sendReportAction`) invocado desde un
  botón en `/tienda/[slug]`, usa la fecha actualmente mostrada en la página
  (la misma que controla `DateNav`).
- **Envío automático:** una ruta de API (`/api/cron/send-reports`)
  desplegada en Vercel, disparada por **Vercel Cron** todos los días a las
  21:00 UTC (= 17:00 hora Venezuela; Venezuela no tiene horario de verano,
  así que el offset es fijo todo el año). Protegida con `CRON_SECRET`
  (Vercel agrega automáticamente `Authorization: Bearer $CRON_SECRET` en
  cada invocación programada; la ruta verifica ese header y rechaza
  cualquier otra llamada).
- La ruta automática recorre las 7 tiendas; si una falla (`chat_id`
  inválido, bot expulsado del grupo, error de red), se registra el error en
  los logs de Vercel y se continúa con las demás tiendas — un fallo no
  detiene el resto del envío.
- Tiendas sin `telegram_chat_id` configurado se saltan en el envío
  automático (no es un error, es un estado válido durante el rollout
  gradual); en el envío manual, el botón muestra un error claro en vez de
  fallar en silencio.

## Formato del mensaje

Texto plano con Markdown básico de Telegram (negrita para el nombre de la
tienda), mismo contenido que la tabla en pantalla:

```
*San Cristóbal* — Cierre 17/08/2026

Saldo inicial: $150.00 / Bs 500.00

Ingreso Ventas Diarias   +$100.00
Cambio Zelle             −$50.00

Saldo final: $200.00 / Bs 1,000.00
```

Si no hubo movimientos ese día:

```
*San Cristóbal* — Cierre 17/08/2026

Saldo inicial: $150.00 / Bs 500.00

Sin movimientos hoy.

Saldo final: $150.00 / Bs 500.00
```

## Archivos afectados

**Nuevos:**
- `lib/telegram.ts` — `formatReportMessage(store, date, ledger)` (función
  pura, sin I/O) + `sendTelegramMessage(chatId, text)` (llama a la API de
  Telegram vía `fetch`).
- `lib/telegram.test.ts` — tests de `formatReportMessage`.
- `app/api/cron/send-reports/route.ts` — handler del envío automático.
- `vercel.json` — configuración del cron (`0 21 * * *`).

**Modificados:**
- `db/schema.sql` — `alter table stores add column if not exists
  telegram_chat_id text;`.
- `lib/stores.ts` — `Store` incluye `telegram_chat_id: string | null`.
- `app/tienda/[slug]/actions.ts` — nuevo `sendReportAction`.
- `app/tienda/[slug]/page.tsx` — botón "Enviar a Telegram".
- `.env.local.example` — agrega `TELEGRAM_BOT_TOKEN` y `CRON_SECRET`.

## Validaciones y manejo de errores

- Envío manual: si `sendReportAction` falla (sin `chat_id` configurado,
  error de Telegram, error de red), se muestra un mensaje de error inline
  en la página, igual que el resto de los formularios existentes.
- Envío automático: los errores solo quedan en los logs de Vercel — nadie
  los ve en vivo, no hay notificación de fallo.
- El token del bot nunca se expone al cliente (uso exclusivo en Server
  Actions / API routes).

## Testing

- Test unitario para `formatReportMessage` (función pura): día con
  movimientos, día sin movimientos, montos negativos (gasto), múltiples
  movimientos — mismo patrón que `lib/balance.test.ts`.
- `sendTelegramMessage` no se prueba de forma automatizada (I/O externo),
  igual que el resto de las funciones de acceso a datos del proyecto.
- Verificación manual: enviar un reporte de prueba a un chat de Telegram
  real (botón manual) antes de dar por cerrada la implementación. El envío
  automático se verifica revisando que el cron corrió en los logs de
  Vercel al día siguiente de desplegar.
