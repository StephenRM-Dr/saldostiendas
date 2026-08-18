# Vista Admin — Exportar Excel Consolidado — Diseño

**Fecha:** 2026-08-17
**Estado:** Aprobado, pendiente de plan de implementación
**Relacionado:** [2026-08-17-telegram-report-design.md](2026-08-17-telegram-report-design.md), [2026-08-17-telegram-report-image-design.md](2026-08-17-telegram-report-image-design.md) — sub-proyecto hermano de la misma conversación, pero independiente: este no usa Telegram ni la generación de imágenes de esos specs.

## Contexto

El spec original de "Cuadro de Cierre de Tiendas" excluyó explícitamente
una "vista consolidada de las 7 tiendas" y "exportar el informe". Esta
extensión reintroduce ambas cosas juntas, pero acotadas a un caso de uso
específico: un administrador necesita un archivo Excel con los
movimientos de las 7 tiendas en un rango de fechas, para uso contable
(ej. cierre mensual) — no para el reporte diario que ya se envía por
Telegram, que sigue siendo por tienda.

## Objetivo

Una vista `/admin`, protegida con una contraseña simple, donde se elige
un rango de fechas (desde/hasta) y se descarga un archivo `.xlsx` con los
movimientos de las 7 tiendas en ese rango, en una sola hoja.

## Fuera de alcance

- Dashboard visual de saldos (no es una "vista" para mirar en pantalla,
  solo un formulario que dispara una descarga).
- Envío del Excel por Telegram (queda como descarga directa del
  navegador).
- Sistema de usuarios/roles — una sola contraseña compartida.
- Edición de movimientos desde la vista Admin (solo lectura/exportación).
- Configuración de `telegram_chat_id` u otros ajustes de tienda desde
  esta vista.

## Arquitectura

- **`middleware.ts`** (nuevo, primera vez que este proyecto usa
  middleware): protege únicamente las rutas bajo `/admin` con HTTP Basic
  Auth, verificando la contraseña contra la variable de entorno
  `ADMIN_PASSWORD`. El resto de la app (`/`, `/tienda/[slug]`,
  `/api/cron/*`) no se ve afectado.
- **`app/admin/page.tsx`**: formulario con `fecha desde` / `fecha hasta`
  y un botón "Descargar Excel" que apunta a la ruta de exportación.
- **`app/api/admin/export/route.ts`**: recibe `from`/`to` por query
  string, valida el rango, consulta los movimientos de las 7 tiendas, arma
  el workbook con `exceljs` y lo devuelve como descarga
  (`Content-Disposition: attachment`).
- **`lib/movements.ts`** gana `getRangeLedger(storeId, from, to)` —
  mismo patrón que el ya existente `getDayLedger(storeId, date)`, pero
  para un rango: saldo inicial (movimientos antes de `from`), movimientos
  dentro de `[from, to]`, saldo final (saldo inicial + cambio del rango).
  Reutiliza `computeBalance` sin cambios.
- `exceljs` se agrega como dependencia nueva del proyecto (primera
  librería de este tipo).

## Estructura del Excel

Una sola hoja, todas las tiendas juntas, en orden alfabético (mismo
orden que `listStores()`). Columnas:

| Tienda | Fecha | Concepto | Tipo | Monto USD | Monto VES |
|---|---|---|---|---|---|

Por cada tienda, en este orden:
1. Fila "Saldo inicial del rango" (fecha = `from`, sin Tipo, montos =
   saldo inicial).
2. Una fila por movimiento dentro del rango (fecha real del movimiento,
   concepto, tipo Ingreso/Gasto, montos **sin signo** — positivos tal
   como están en la base de datos, para que sea fácil sumar/filtrar por
   tipo directamente en Excel).
3. Fila "Saldo final del rango" (fecha = `to`, sin Tipo, montos = saldo
   final).

Encabezados en negrita; sin necesidad de replicar los colores amarillos
de la app (es un archivo de trabajo, no un reporte visual).

## Validaciones y manejo de errores

- Si falta `from` o `to`, o `from` es posterior a `to`: error claro en la
  página `/admin` (mismo patrón de mensajes que el resto de la app), sin
  llegar a generar el archivo.
- Sin `ADMIN_PASSWORD` configurado: el middleware debe rechazar el acceso
  (fail-closed, no fail-open) — nunca dejar pasar `/admin` sin contraseña
  configurada.

## Testing

- La lógica de "armar las filas de la tabla" para una tienda (dado su
  `getRangeLedger`, producir las filas de saldo inicial / movimientos /
  saldo final) se separa en una función pura y se prueba con Vitest —
  mismo patrón que `formatReportMessage`.
- La generación real del archivo `.xlsx` (I/O de `exceljs`) no se prueba
  con tests unitarios — se verifica descargando un archivo real desde
  `/admin` y abriéndolo, confirmando columnas, datos y que las 7 tiendas
  aparecen.
- Verificación manual del middleware: confirmar que `/admin` sin
  credenciales rechaza el acceso, y que con la contraseña correcta lo
  permite.
