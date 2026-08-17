# Reporte como Imagen en Telegram — Diseño

**Fecha:** 2026-08-17
**Estado:** Aprobado, pendiente de plan de implementación
**Extiende:** [2026-08-17-telegram-report-design.md](2026-08-17-telegram-report-design.md)

## Contexto

El envío de reporte a Telegram (ya implementado) manda el cuadro de cierre
como texto plano. El proceso manual que reemplaza esta app enviaba una
**foto** de la hoja de Excel por WhatsApp — el usuario quiere recuperar
esa experiencia visual: una imagen del cuadro, igual a como se ve en
pantalla, en vez de (o además de) texto plano.

Esta es una de dos extensiones pedidas en la misma conversación; la otra
(una vista "Admin" consolidada de las 7 tiendas) es un sub-proyecto
independiente con su propio ciclo de diseño, fuera de este spec.

## Objetivo

Reemplazar el mensaje de texto plano de Telegram (tanto el envío manual
por botón como el automático diario) por una **foto** del cuadro de
cierre — mismo diseño visual que la tabla en `/tienda/[slug]` — con el
texto que hoy se manda como mensaje ahora sirviendo de **caption** de esa
foto.

## Fuera de alcance

- Botón de descarga de la imagen desde la página (solo se envía por
  Telegram).
- Replicar el formato exacto del Excel manual original (título "CUADRO DE
  CIERRE PERSONAL TIENDA...", bordes tipo Excel) — se usa el mismo diseño
  que ya existe en pantalla.
- Manejo especial para captions que excedan el límite de 1024 caracteres
  de Telegram (Telegram los trunca automáticamente; aceptado como
  limitación conocida dado el volumen típico de movimientos por tienda).
- La vista Admin de las 7 tiendas (sub-proyecto separado).

## Arquitectura

- **`next/og`'s `ImageResponse`** (Satori + Resvg, integrado en Next.js —
  no requiere instalar `@vercel/og` por separado) genera un PNG a partir
  de JSX/CSS, sin necesitar un navegador headless. Solo soporta flexbox y
  un subconjunto de CSS (sin `<table>` real ni `display: grid`) — la
  cuadrícula se arma con divs anidados.
- `lib/reportImage.tsx` (nuevo): construye el JSX de la tabla y produce
  los bytes PNG.
- `lib/telegram.ts`: gana `sendTelegramPhoto(chatId, imageBuffer, caption)`
  (usa el endpoint `sendPhoto` de la API de Telegram, subiendo la imagen
  vía `multipart/form-data`). `sendTelegramMessage` (solo texto) se
  elimina — nada la usa después de este cambio.
- `sendReportAction` (manual) y la ruta de cron (automático) cambian de
  `formatReportMessage` + `sendTelegramMessage` a
  `generateReportImageBuffer` + `sendTelegramPhoto`. `formatReportMessage`
  no cambia — su salida se reusa tal cual como el caption de la foto.
- Límite de 1024 caracteres en el caption: la imagen siempre muestra el
  cuadro completo; solo el texto de abajo podría recortarse en un día con
  muchísimos movimientos. Aceptado como limitación conocida.

## Diseño visual de la imagen

- Ancho fijo: 800px. Alto: calculado según la cantidad de movimientos del
  día (título + encabezado + saldo inicial + una fila por movimiento +
  saldo final).
- Título: nombre de tienda + fecha, ej. `San Cristóbal — Cierre
  17/08/2026`.
- Fila de encabezado: fondo `#fde047` (amarillo), columnas Concepto /
  Dólares / Bolívares — igual que la tabla en pantalla.
- Fila "Saldo al inicio del día": fondo `#fef9c3` (amarillo claro).
- Filas de movimientos: fondo blanco, monto con signo (+/−), misma lógica
  que `MovementRow.tsx`'s `signedAmount` (vía `toCents`/`formatMoney`).
- Fila "Saldo al Final del día": fondo `#fde047`.
- Día sin movimientos: una fila que dice "Sin movimientos hoy." (mismo
  texto que ya usa `formatReportMessage`).

## Archivos afectados

**Nuevos:**
- `lib/reportImage.tsx` — `calculateImageHeight(movementCount: number):
  number` (función pura); componente JSX de la tabla;
  `generateReportImageBuffer(storeName, date, ledger): Promise<Buffer>`.
- `lib/reportImage.test.ts` — test de `calculateImageHeight`.

**Modificados:**
- `lib/telegram.ts` — agrega `sendTelegramPhoto`, elimina
  `sendTelegramMessage`.
- `app/tienda/[slug]/actions.ts` — `sendReportAction` usa
  `generateReportImageBuffer` + `sendTelegramPhoto`.
- `app/api/cron/send-reports/route.ts` — mismo cambio.

## Validaciones y manejo de errores

- Mismas validaciones que el envío de texto (tienda sin `telegram_chat_id`
  configurado → error claro en el botón manual, se salta en el cron).
- Si `sendTelegramPhoto` falla (imagen mal formada, error de red, error de
  Telegram), se propaga igual que antes: error inline en el botón manual,
  log en consola en el cron (sin detener las demás tiendas).

## Testing

- Test unitario para `calculateImageHeight` (función pura): casos con 0,
  1 y varios movimientos.
- El renderizado visual no se puede verificar con comparación de strings
  — se confirma generando una imagen real y revisándola visualmente
  (incluyendo que los acentos como "ó" e "í" se vean correctamente con la
  fuente por defecto de Satori), igual que se hizo con el botón de
  Telegram en la iteración anterior.
- Verificación manual: enviar un reporte real (botón manual) y confirmar
  que la foto llega al grupo de Telegram configurado, con el caption
  correcto, antes de dar por cerrada la implementación.
