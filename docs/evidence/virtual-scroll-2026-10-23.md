# Desplazamiento de tablas de más de 524 286 filas

**Fecha:** 23 de octubre de 2026 · **Rama:** `codex/virtual-scroll-limit` sobre `main` (`799cb70`).

## Problema

Con un CSV de **un millón de filas y una columna** (menos de 7 MB, dentro de los límites de edición: 1 millón de celdas) la tabla **no deja llegar al final**: el desplazamiento se detiene en la fila **524 295** y las otras 475 705 filas quedan inalcanzables. Ocurre con cualquier archivo de más de unas 524 mil filas y pocas columnas (el límite de 2 millones de celdas lo permite hasta con 3 columnas).

## Causa

Medida en el Chromium de la aplicación (Electron 44): **un elemento no puede medir más de 16 777 214 px de alto** (se pidieron 30, 35, 100 y 300 millones de px y todos quedaron en 16 777 214). Con filas de 32 px más 40 de cabecera son 524 286 filas. La tabla pintaba un contenedor de `filas × 32 px`, así que a partir de ahí la barra de desplazamiento ya no representaba el contenido.

## Cambio

Desplazamiento virtual **escalado** (`src/renderer/lib/virtual-scroll.ts`, funciones puras) integrado en `CsvTable.svelte`:

- Si la altura lógica de la tabla supera **15 000 000 px** (unas 468 mil filas), el elemento desplazable mide 15 000 000 px y **cada píxel físico equivale a `escala` píxeles lógicos**, con `escala = (total − visor) / (15 000 000 − visor)` para que el final físico sea exactamente el lógico. Por debajo, **escala 1 y comportamiento idéntico al de antes**.
- El virtualizador (TanStack Virtual, ya en el proyecto) trabaja en píxeles lógicos mediante sus ganchos `observeElementOffset` y `scrollToFn`; las filas se colocan en relación con el desplazamiento actual (`rowTop`), de modo que **las vecinas siguen separadas 32 px** y ninguna posición física supera el límite.
- La biblioteca acota los desplazamientos con `scrollHeight − clientHeight` (físico), lo que cortaba la rueda y `Ctrl/⌘ + Fin`: con la barra escalada, `getMaxScrollOffset` devuelve el máximo lógico (solo en ese caso).
- Al cambiar la escala (otro número de filas por un filtro, otra altura de ventana) **se conserva la posición lógica**.
- **Rueda del ratón:** con la barra escalada, una muesca mueve filas reales (no `escala` veces más); la barra se usa para los saltos grandes. El arrastre de selección que se desplaza solo usa también píxeles lógicos.
- Sin cambios en `main`, preload, `shared`, IPC ni dependencias; sin cambios en los datos.

## Pruebas (fallaban primero)

Antes del cambio fallaban las 9 pruebas unitarias nuevas (el módulo no existía) y 5 de las 6 primeras E2E de `tests/e2e/virtual-scroll.spec.ts` (la de la rueda ya pasaba y se conserva como guarda). Ahora pasan las 8 E2E con **un millón de filas**:

| Prueba | Qué comprueba |
|---|---|
| Última fila | Al ir al final se ve la fila 1 000 000; el elemento desplazable y el contenido miden menos que el límite de Chromium; las filas visibles son contiguas |
| Ctrl/⌘ + Fin | El foco llega a la celda de la fila 1 000 000 y queda a la vista |
| Mitad del recorrido | Filas contiguas, separadas 32 px (±0,6) y primera fila visible en el 49–51 % |
| Selección | Se conserva en la fila 1 000 000 al ir al inicio y volver al final |
| Rueda | Una muesca mueve las filas que indica la rueda (±1,5), no miles |
| Filtro y orden | Buscar `99999` da el recuento exacto; ordenar descendente numérico pone 1 000 000 arriba y 1 abajo |
| Recorrido completo | En 7 posiciones (0 – 100 %) las filas son contiguas y la primera visible está donde toca (±0,2 %) |
| Altura de la ventana | Con 900, 600 y 1200 px de alto la última fila sigue alcanzable |

Unitarias (`tests/virtual-scroll.test.ts`): escala 1 por debajo del tope; el elemento nunca supera el tope hasta 100 millones de filas; la última fila es alcanzable; las vecinas conservan 32 px; ninguna fila cae fuera del contenido; lógico ↔ físico; visor de alto 0 sin división por cero.

## Límites y qué no se probó

- **E2E hasta un millón de filas** (los límites de edición actuales impiden abrir más); las pruebas unitarias llegan a 100 millones, y el comportamiento con más de 10 millones de filas dentro de la aplicación queda para los experimentos del RFC de archivos grandes.
- **Arrastre de selección con desplazamiento automático en la barra escalada:** ajustado en el código (usa píxeles lógicos) pero sin prueba E2E propia.
- **Arrastrar la barra de desplazamiento con el ratón** no se automatizó; la posición se comprobó fijando `scrollTop`, que es lo que la barra hace.
- Con la barra escalada, la resolución del desplazamiento por barra es de `escala` px lógicos por píxel (≈ 2 filas por píxel con un millón de filas); la rueda y el teclado dan precisión de fila.
- Solo macOS; Windows y Linux por la CI.

## Verificación local

Node 24, macOS: `npm run check` sin errores ni avisos; `npm test` **246** (237 + 9); `npx playwright test` **153** (145 + 8), todas pasan; `npm run licenses` sin cambios. La CI queda por verificar.
