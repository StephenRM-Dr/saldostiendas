# Cierre de Día (Bloqueo de Edición) — Diseño

**Fecha:** 2026-08-19
**Estado:** Aprobado, pendiente de plan de implementación
**Relacionado:** [2026-08-14-cuadro-cierre-tiendas-design.md](2026-08-14-cuadro-cierre-tiendas-design.md) — agrega una restricción nueva sobre el flujo de edición de movimientos ya existente, sin tocar el modelo de datos base.

## Contexto

Hoy cualquier movimiento, de cualquier fecha (pasada, presente o futura),
se puede editar o borrar libremente desde `/tienda/[slug]`. Se necesita
que, una vez que un día calendario termina, sus movimientos queden fijos
— para que el cuadro de cierre de un día ya cerrado no pueda alterarse
después, ni por error ni a propósito.

## Objetivo

Un día calendario (hora Venezuela) es editable mientras sea el día
actual. En cuanto cambia la fecha (medianoche), todos los movimientos de
los días anteriores quedan bloqueados: no se pueden agregar movimientos
nuevos con esa fecha, ni editar ni borrar los que ya existen. El día de
hoy es editable las 24 horas, sin importar la hora.

## Fuera de alcance

- Cualquier forma de excepción o desbloqueo, incluso desde `/admin` — si
  hace falta corregir un día ya cerrado, se hace directo en la base de
  datos, fuera de la app.
- Restringir fechas futuras — se puede seguir navegando y, si se quiere,
  agregando movimientos a una fecha futura (comportamiento actual, sin
  cambios); el bloqueo es solo hacia atrás.
- Un botón manual de "cerrar día" — el bloqueo es puramente automático,
  calculado por la fecha, sin ninguna acción humana ni estado guardado
  en la base de datos.
- Cambios al cron de envío de Telegram (`app/api/cron/send-reports`) o
  al botón manual de envío — siguen funcionando exactamente igual que
  hoy; son de solo lectura, no interactúan con este bloqueo.

## Arquitectura

- **`lib/date.ts`** gana `isDateClosed(date: string, now?: Date):
  boolean` — función pura, sin dependencias externas. Compara `date`
  contra `todayISOCaracas(now)` (que gana un parámetro `now` opcional
  para poder probarla con una fecha fija): `date < todayISOCaracas(now)`.
  No hay ninguna lógica de hora — solo comparación de fechas calendario.
- **`app/tienda/[slug]/actions.ts`**: `addMovementAction`,
  `updateMovementAction` y `deleteMovementAction` llaman `isDateClosed`
  sobre la fecha relevante (la fecha que se está guardando/editando, o
  la fecha del movimiento que se quiere borrar) y lanzan un `Error` con
  un mensaje claro si el día ya cerró, antes de tocar la base de datos.
  `deleteMovementAction` hoy no recibe la fecha del movimiento — gana un
  campo `date` más en el `FormData` que le manda `MovementRow.tsx`
  (igual patrón que ya usa `updateMovementAction`).
- **`app/tienda/[slug]/page.tsx`**: calcula `isDateClosed(date)` para la
  fecha que se está viendo y pasa un booleano `readOnly` a
  `MovementRow` (para ocultar "Editar"/"Eliminar") y decide si renderiza
  `MovementForm` o, en su lugar, un aviso de que ese día ya cerró.
- Sin cambios de esquema de base de datos — el bloqueo es 100% calculado
  en el momento, no se guarda ningún estado de "cerrado".

## Validaciones y manejo de errores

- Mensaje de error consistente en las tres Server Actions: "No se
  pueden modificar movimientos de un día ya cerrado."
- El chequeo del lado del servidor (Server Actions) es la fuente de
  verdad — la UI (ocultar botones/formulario) es solo para que el
  usuario no intente algo que va a fallar, no reemplaza la validación en
  el servidor.

## Testing

- `isDateClosed` y el nuevo parámetro `now` de `todayISOCaracas` se
  prueban con Vitest: fecha de ayer bloqueada, fecha de hoy no
  bloqueada, fecha de mañana no bloqueada, comportamiento en el límite
  exacto de medianoche.
- Las tres Server Actions modificadas se verifican en vivo (navegador
  real): intentar agregar/editar/borrar un movimiento en una fecha de
  ayer debe fallar con el mensaje de error; hacerlo en la fecha de hoy
  debe seguir funcionando igual que antes.
- Verificación visual: al navegar a un día anterior con `DateNav`, los
  botones "Editar"/"Eliminar" desaparecen y el formulario de "Agregar
  movimiento" se reemplaza por el aviso de día cerrado.
