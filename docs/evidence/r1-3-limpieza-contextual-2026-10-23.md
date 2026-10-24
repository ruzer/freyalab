# R1-3 — limpieza contextual desde la cabecera de columna

Rama `codex/r1-3-column-menu`, sobre `main` en `799cb70` (independiente de #52, #53 y #54). Iteración R1-3 de la hoja de ruta del rediseño UX/UI («UX-03 · Limpieza contextual» del encargo; resuelve el hallazgo UX-11 de la auditoría: *limpiar una columna entera exige seleccionar un rango, 5 clics + desplazamiento*).

## Qué cambia

Cada cabecera de columna tiene un botón **▾** siempre visible (`Acciones de la columna <nombre>`). Abre el menú de columnas que ya existía con el clic derecho (`Acciones de columnas`), ahora agrupado y con acciones nuevas que actúan sobre **esa** columna:

| Sección | Acciones |
|---|---|
| Vista de la tabla | Ordenar ascendente / descendente (vista) · **Filtrar esta columna** (muestra los filtros y lleva el foco al de la columna) · **Estadísticas de la columna** (abre el panel Resumen con esa columna marcada) |
| Limpiar la columna · con vista previa | **Mayúsculas / Minúsculas / Quitar espacios en la columna…** · **Quitar filas duplicadas de la columna…** |
| Estructura | Insertar a la izquierda/derecha · duplicar · eliminar columna |
| Más | Transformar documento… · Copiar como Markdown · Deshacer · Rehacer |

## Cómo cumple «no cambiar nada en silencio»

No se escribió una vista previa nueva: las acciones de limpieza abren los diálogos que ya existen.

- **Mayúsculas / minúsculas / espacios:** `CsvRangePreview` sobre un rango que es la columna completa de la **vista actual**. Muestra el **alcance** («columna «ciudad» · 45 000 filas de la vista actual; N filas ocultas por búsqueda o filtros no se modifican; los encabezados se conservan»), calcula sola la **vista previa** («45 000 de 45 000 celdas cambiarán»), enseña hasta ocho ejemplos **antes → después**, solo permite **Aplicar cambio** si algo cambia (0 cambios = botón deshabilitado) y deja **un paso de deshacer**.
- **Duplicados:** `CsvTransform` abre ya con «Eliminar filas duplicadas» y la columna elegida; su vista previa muestra las filas afectadas y no toca nada hasta aplicar.
- El archivo en disco no cambia hasta guardar (las pruebas lo comprueban).

## Medido (CSV real de 10 MiB del usuario, 45 000 filas × 21 columnas, 1440×900)

| | Resultado |
|---|---|
| Interacciones para pasar una columna a mayúsculas | **3** (▾ → «Mayúsculas en la columna…» → «Aplicar cambio»); antes: marcar todas las filas y la columna, abrir Operaciones, elegir la acción (≥ 5 más desplazamiento, hallazgo UX-11) |
| Vista previa de 45 000 celdas | 58–60 ms |
| Aplicar 45 000 celdas | ~100 ms |
| Deshacer | ~50 ms; el documento vuelve a «sin cambios» |

Capturas: `r1-3-menu-columna.png`, `r1-3-vista-previa-columna.png`.

## Pruebas

- `tests/e2e/column-menu.spec.ts` (9 casos que **fallaban en `main`**): menú visible sin pasar el ratón; teclado (Enter abre, flechas, Escape devuelve el foco); mayúsculas con alcance, recuento, antes → después, confirmación y un paso de deshacer sin tocar el archivo; quitar espacios y minúsculas encadenados sin tocar otras columnas ni los ceros a la izquierda; con una búsqueda activa solo cambian las filas visibles y el diálogo avisa de las ocultas; 0 cambios deshabilita la confirmación; filtrar, estadísticas y duplicados.
- `structural-context.spec.ts`: el primer elemento enfocado del menú pasó de «Insertar columna a la izquierda» a «Ordenar columna ascendente (vista)» porque el menú ahora empieza por la vista; el resto de aserciones no cambió.

## Límites declarados

- Las acciones actúan sobre **una** columna a la vez (la de la cabecera o la única marcada); con varias columnas marcadas se habilitan solo las de siempre.
- El rango es la columna de la **vista actual** (respeta búsqueda, filtros y orden); las filas ocultas no se modifican y el diálogo lo dice.
- «Gráficos sugeridos» de la cabecera queda para R1-4 (necesita las reglas locales de sugerencia).
- En una muestra de solo lectura las acciones de limpieza quedan deshabilitadas (`locked`); no hay prueba E2E propia porque exige un archivo de más de 50 MiB.
- El menú de columnas sigue siendo el de F2 (`role="menu"` posicionado con `position:fixed`); no se ha medido con lector de pantalla (R1-6).
