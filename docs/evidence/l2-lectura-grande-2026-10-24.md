# L2 — lectura de archivos grandes por índice, con «Ir a la fila»

Rama `codex/l2-large-read`, sobre `main` en `49129ef`. Implementa **L2** de [`docs/design/LARGE-FILE-EDITOR-RFC.md`](../design/LARGE-FILE-EDITOR-RFC.md) §11: lectura de CSV/TSV grandes **de solo lectura**, sin el límite de 200 filas.

## Qué cambia

- **Modo grande** (`src/main/large-table.ts`, `TableEngine`): un CSV de más de 50 MiB (o que supera dos millones de celdas) ya no se abre como muestra de 200 filas. Se recorre **una vez en flujo** (bloques de 16 MiB, memoria constante) guardando la posición de cada 1024.º registro; las páginas se leen saltando a esa posición. Soporta UTF-8, UTF-8 con BOM, UTF-16 LE, Windows-1252, LF/CRLF/mezclados, saltos de línea y comillas dentro de campos, filas irregulares y último registro sin salto final.
- **Un registro de más de 1 MiB** (p. ej. una comilla sin cerrar) no se puede indexar: se vuelve a la muestra de siempre y el aviso dice **en qué registro y byte** está el problema.
- **Progreso y cancelación de la apertura:** la barra de estado muestra «Indexando archivo grande… N %» con un botón «Cancelar apertura».
- **«Ir a la fila N»** (botón, comando de la paleta y `Ctrl/⌘ + G`): ventana flotante con validación, centra la fila, la enfoca y la anuncia a los lectores de pantalla. Funciona también en tablas pequeñas.
- **Lo que aún no existe en archivos grandes está deshabilitado y lo dice:** búsqueda, filtros, consulta avanzada, orden, reemplazar, estadísticas de columna y edición (L3–L5). **SQL y Gráficos siguen leyendo el archivo completo** desde el disco, dentro de sus límites (2 M de filas / 8 M de celdas).
- `FREYALAB_LARGE_BYTES` (solo con `FREYALAB_TEST=1`) baja el umbral a 1 KiB para que los fixtures de CI usen el mismo camino que un archivo de GiB.

## Medido con los archivos de prueba del usuario (M2 Max, caché caliente, ventana de 1600×900)

| Archivo | Filas | Abre | Saltos comprobados |
|---|---:|---:|---|
| `ventas_1GiB.csv` | 4 587 000 | 2,3 s (64 avisos de progreso) | 11 saltos (filas 1, 100, 777, 524 287, 524 288, 1 M, 2,5 M, 4 M, 4 586 990 y **4 587 000**) caen exactamente en el `venta_id` secuencial esperado, enfocados, en 31–220 ms |
| `ventas_100MiB.csv` | 448 000 | 0,38 s | filas 1, 224 000, 300 000 y 448 000 exactas |
| `ancho_150_columnas_50MiB.csv` (150 columnas) | 46 000 | 0,28 s | filas 1, 23 000 y 46 000 exactas |

La comprobación no usa el analizador de la aplicación: el identificador de venta es secuencial, así que la fila N tiene que mostrar `V-<N>` aunque haya campos con saltos de línea entre medias. Captura: `l2-ventas-1GiB-ultima-fila.png`.

## Defecto encontrado y corregido por el camino

En tablas de millones de filas (desplazamiento escalado de #52) «ir a una fila» fallaba cerca del final de forma intermitente (la última fila quedaba fuera de la vista, o la tabla acababa a mitad de camino). Causas, todas reproducidas con una tabla sintética de 4,6 M de filas:

1. `scrollToIndex` de TanStack Virtual confunde la posición lógica con la física con escalas altas → «Ir a la fila» **escribe el desplazamiento directamente** (centrando la fila).
2. Enfocar una celda con `focus()` hace que el navegador la revele y descoloque el desplazamiento → `focus({preventScroll:true})` y `overflow-anchor:none`.
3. Una barra que al cerrarse cambia el alto de la tabla deja la posición calculada con un alto antiguo → el formulario es ahora una ventana flotante que no cambia el diseño.

Con esos tres cambios, 15 saltos seguidos en una tabla de 4,6 M de filas (incluidos varios a la última fila desde estados distintos) dejan siempre la fila a la vista.

## Pruebas

- `tests/large-table.test.ts` (18, las del motor **fallaban antes**): índice y páginas contra `csv-parse` en 4 codificaciones con trozos de 6 bytes, tope de 1 MiB con posición, cancelación entre bloques, recuento exacto, consulta vacía aceptada y búsqueda/filtros/orden rechazados con un mensaje claro, funciones que necesitan toda la tabla rechazadas, SQL que lee íntegro un CSV de un millón de filas, separador y sin encabezado, progreso y cancelación a mitad de la apertura, y que un CSV pequeño sigue en memoria y editable.
- `tests/e2e/large-file.spec.ts` (4): apertura grande con aviso y recuento exacto, «Ir a la fila» (botón, `Ctrl/⌘ + G`, validación, foco, Escape), controles deshabilitados sin cambiar el documento, y **700 000 filas** (más allá del techo de altura de Chromium) con saltos a 650 000, 524 287, 700 000 y 350 000.
- `sql-source.test.ts`: la prueba de «un millón de filas por cuatro columnas» ahora comprueba que el editor la abre como archivo grande (antes, como muestra).

## Límites declarados

- Solo lectura; sin búsqueda, filtros, orden, estadísticas de columna, exportación ni edición (L3–L5, con el índice reutilizable).
- La apertura reindexa el archivo cada vez (2,3 s para 1 GiB con caché caliente; **caché fría no medida**). El índice persistente queda para después.
- La cancelación de la apertura se comprobó en el motor (prueba unitaria) pero no con una prueba E2E: exige un archivo lo bastante grande para que haya tiempo de pulsar el botón.
- Escalas: probado hasta 4,6 M de filas (escala ≈ 10×). Con decenas de millones de filas la barra de desplazamiento pierde precisión por diseño (≈ 12 500 filas por píxel de barra a 10 M) y hay que navegar con «Ir a la fila».
- No se probó con lector de pantalla; la ventana de «Ir a la fila» es un formulario sencillo con etiqueta y mensaje `role="alert"`.

## Resolución de conflictos con main — 24 de octubre

Se incorporó `main` en `d54006a` a L2, conservando los menús de columna de #56 y la navegación y restricciones de archivos grandes de #57. Se unieron los estilos de ambos cambios. No se añadieron dependencias.

La combinación exponía «Filtrar esta columna» en modo grande. La regresión en `large-file.spec.ts` falló antes del ajuste y pasó después: comprueba que las acciones no disponibles del nuevo menú siguen deshabilitadas y que el documento y el archivo original permanecen intactos. «Estadísticas de la columna» queda igualmente bloqueado; el panel general conserva su aviso.

Validación local en macOS: `npm run check` sin errores ni advertencias; `npm test` 267/267; `npm run build` correcto; experimento de edición grande 41/41. `npm run test:e2e`: **170/171**, incluidos los nueve casos de menús de columna y los cuatro de archivos grandes. Falló el caso ya documentado de redimensionamiento (`virtual-scroll.spec.ts:100`): con altura 1200, última fila 999 979 en lugar de 1 000 000. Ese test, el módulo de desplazamiento y su efecto de cambio de escala no se modificaron en esta resolución. El fallo sigue pendiente; no se ocultó con reintentos ni se relajó la prueba.

Esta evidencia acredita la resolución y las comprobaciones locales, no una CI completamente aprobada ni la instalación del paquete.
