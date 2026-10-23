# Panel lateral de análisis (F2a del espacio de trabajo flexible)

**Fecha:** 23 de octubre de 2026 · **Base:** `main` en `3028cbe` · **Rama:** `codex/analysis-dock`
**Diseño:** `docs/design/FLEXIBLE-WORKSPACE-F2.md` del [PR #46](https://github.com/ruzer/freyalab/pull/46) (F2a: contenedor y pestañas, sin divisor ni persistencia ni vista ampliada).

## Problema

Los paneles Estadísticas, Gráficos y SQL se apilaban sobre la tabla dentro de `.csv-workspace`: con Gráficos abierto la tabla pasaba de 19 a 2 filas visibles en 1440×900 y a ninguna en 1366×768 (auditoría UX-03). El gráfico generado quedaba además medio oculto bajo los controles.

## Cambio

- **`AnalysisDock.svelte`** (nuevo): panel a la derecha de la tabla con tres pestañas ARIA (**Resumen**, **Gráficos**, **SQL**) de activación manual (flechas, Inicio y Fin mueven el foco; Intro o Espacio activan; solo la pestaña activa está en la secuencia de tabulación). Cada pestaña se monta la primera vez que se visita y después sigue montada y oculta, de modo que cambiar de pestaña conserva la configuración del gráfico y el borrador SQL. Cerrar el panel desmonta todo, como antes.
- **`CsvTable.svelte`**: los tres paneles se pasan al dock como fragmentos con **las mismas props** que antes. `showCharts`, `showSql` y `showStatistics` pasan a derivarse de `dockOpen` y `dockTab`; los botones de la barra, los comandos y sus `aria-expanded` siguen igual. La tabla y su barra de selección van en `.csv-main`, y el dock a su lado; las filas de operaciones y de opciones se quedan a todo el ancho encima, para no envolverse (con ellas dentro de `.csv-main` la tabla perdía 2 filas).
- **`CsvCharts.svelte`**: al terminar un gráfico se lleva a la vista dentro del panel (`scrollIntoView({block:'nearest'})`).
- **`style.css`**: `.csv-body` (fila) y `.csv-main` (columna, mínimo 240 px ≈ una columna de 180 más la numeración de 52).

No cambian el preload, `main`, `shared`, el IPC ni las dependencias. Ninguna prueba existente se modificó.

## Medidas (aplicación real, macOS, tabla de 14 columnas con anchos por defecto)

| Ventana | Filas sin panel | Filas con el panel (antes) | Filas con el panel (ahora) | Columnas sin panel → con panel | Ancho de tabla con panel |
|---|---|---|---|---|---|
| 1920×1080 | 25 | 3 | **25** | 9 → 6 | 1159 px |
| 1440×900 | 19 | 2 | **19** | 6 → 3 | 679 px |
| 1366×768 | 15 | 0 | **15** | 5 → 3 | 605 px |
| 1280×720 | 13 | 0 | **13** | 5 → 2 | 519 px |
| 900×600 | 7 | 0 | **7** | 3 → 1 | 240 px (el panel cede a 419 px) |

«Antes» procede de la auditoría (misma serie de medición, tabla de menos columnas). El panel mide 520 px, el ancho validado para que un gráfico no se desplace en horizontal; a 1280 y 900 px de ancho la tabla queda con 2 y 1 columnas: es el límite conocido que resuelve F2c (vista ampliada cuando el área de trabajo mide menos de 1120 px).

Capturas: [claro](analysis-dock-1440x900-light.png) y [oscuro](analysis-dock-1440x900-dark.png) a 1440×900 con un gráfico generado.

## Pruebas

`tests/e2e/analysis-dock.spec.ts` (6 pruebas) **falló completa antes del cambio**: con el panel abierto la tabla tenía 2 filas en lugar de 19 (1440×900), no había pestañas, el gráfico quedaba visible 153 de 342 px, y las pestañas no conservaban la configuración. Después pasan 6/6.

| Prueba | Qué comprueba |
|---|---|
| Filas conservadas | Con cada panel abierto la tabla mantiene las filas que tenía sin panel, a 1440×900 y 1366×768 |
| Columnas | A 1366×768 con el panel abierto quedan ≥ 3 columnas y el panel no se superpone a la tabla |
| Pestañas | `tablist`, `tab`, `tabpanel`, `aria-selected`, `tabindex`, activación manual, Inicio/Fin y vuelta |
| Estado entre pestañas | Columna X del gráfico y borrador SQL se conservan al cambiar de pestaña |
| Montaje | Las no visitadas no se montan; las visitadas siguen montadas y ocultas; Escape cierra, desmonta y devuelve el foco a «Análisis» |
| Gráfico | Sin desplazamiento horizontal y totalmente visible tras «Generar gráfico» a 1366×768 |

Con Node 24 en macOS: `npm run check` sin errores; `npm test` 195; `npx playwright test`: ver el estado del PR (sobre `main` fallan además las 2 pruebas de `missing-resources` por #41 + #42, corregidas en #45).

## Decisiones tomadas al implementar (desvíos del diseño)

- **No se mueve el foco al abrir el panel.** El diseño proponía llevarlo a la pestaña activa, pero `CsvStatistics` ya enfoca su encabezado al montarse (y una prueba existente lo exige); se conserva el comportamiento actual y se revisará con F2b.
- **El dock no tiene botón de cierre propio:** se cierra con el de cada panel o con Escape, como hasta ahora.
- **El estado (abierto, pestaña) sigue siendo local a `CsvTable`** y se pierde al cambiar de documento, como hoy; pasa a un módulo compartido con la persistencia de F2b.
- **Las filas de operaciones y opciones quedan fuera de `.csv-main`** (el diseño las ponía dentro).

## Límites

Ancho fijo de 520 px (cede hasta 360 px solo si falta espacio); sin divisor, sin persistencia y sin vista ampliada (F2b y F2c). Solo macOS; Windows y Linux por la CI.
