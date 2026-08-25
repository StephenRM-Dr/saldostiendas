# Formato del Excel para importar movimientos

Este es el formato que debe tener el archivo `.xlsx` para poder importarlo desde
la pantalla de cada tienda (botón **"Importar Excel"**).

## Columnas

La primera fila del archivo debe tener estos encabezados (no importa si usan
mayúsculas o tildes distintas, el sistema las normaliza):

| Columna       | Obligatoria | Descripción                                                                 |
|---------------|:-----------:|------------------------------------------------------------------------------|
| Fecha         | Sí          | Formato `AAAA-MM-DD` (ej. `2026-08-22`). Solo se importan filas de **hoy**. |
| Concepto      | Sí          | Texto libre, ej. `Ingreso Ventas Diarias`.                                  |
| Tipo          | Sí          | `Ingreso` o `Gasto` (no distingue mayúsculas/minúsculas).                   |
| Monto USD     | Sí          | Número. Usa `0` si el movimiento no tiene monto en dólares.                 |
| Monto VES     | Sí          | Número. Usa `0` si el movimiento no tiene monto en bolívares.               |
| Monto COP     | No          | Número. Solo aplica a la tienda **San Cristóbal**. Si no aplica, se omite o se deja en `0`. |
| Observación   | Sí          | Texto libre, obligatorio para justificar el movimiento.                    |
| Tienda        | No          | Se ignora al importar — cada tienda solo importa sus propios movimientos.   |

Cada fila del archivo (a partir de la fila 2) es un movimiento. Las filas
completamente vacías se ignoran.

## Reglas de validación

- **Fecha**: debe ser exactamente la fecha de hoy. Movimientos de otros días se
  rechazan (aparecen como error, sin detener el resto de la importación).
- **Tipo**: solo se acepta `Ingreso` o `Gasto`.
- **Montos**: se acepta coma o punto como separador decimal (`43,50` o `43.50`).
  Al menos uno de Monto USD / Monto VES / Monto COP debe ser mayor a cero.
- **Observación**: no puede quedar vacía.
- Si falta alguna columna obligatoria en el encabezado, se rechaza el archivo
  completo con un mensaje indicando qué columna falta.
- Si una fila individual tiene un error (fecha inválida, tipo desconocido,
  montos en cero, observación vacía), esa fila se reporta como error y el
  resto del archivo se importa igual.

## Ejemplo

| Fecha      | Concepto                 | Tipo    | Monto USD | Monto VES | Monto COP | Observación          |
|------------|---------------------------|---------|-----------|-----------|-----------|------------------------|
| 2026-08-22 | Ingreso Ventas Diarias    | Ingreso | 100       | 0         | 0         | Cierre de caja del turno |
| 2026-08-22 | Compra Cinta de Embalar   | Gasto   | 0         | 3150      | 0         | Compra de insumo        |

## Forma más fácil de armar el archivo

La forma más segura de tener el formato correcto es usar el botón
**"Exportar Excel"** (en `/admin`) primero — descarga un archivo con estas
mismas columnas ya armadas — y luego reemplazar/agregar las filas con los
movimientos nuevos antes de importarlos desde la tienda.

También hay una plantilla en blanco lista para usar en
[`plantilla-importacion-excel.xlsx`](./plantilla-importacion-excel.xlsx).
