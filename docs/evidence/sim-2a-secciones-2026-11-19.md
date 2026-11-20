# SIM-2a · Secciones y exportación del análisis

Fecha: 2026-11-19. **Calificación local completada; CI pendiente sobre el SHA de la continuación de código.** El PR [#198](https://github.com/ruzer/freyalab/pull/198) incorporó únicamente la historia completa y el alcance/ADR; no publicó esta implementación. Las ejecuciones de esta evidencia observaron la continuación de código todavía sin commit, sobre el HEAD de apoyo `9d17a7c680f12e4b4fdec901b99cfb68d8dce712`.

[Historia completa](../stories/historia-sim2-analisis-graficos-diseno-para-codex.md) · [Alcance y siete respuestas ADR 0021](../stories/sim-2a-alcance-adr-0021.md) · [Prueba verificable, hashes y fases](sim-2a-secciones-2026-11-19/prueba.json).

## Resultado y límites

Las cuatro secciones usan tablist/tab/tabpanel, un único punto de tabulación y flechas/Inicio/Fin. El h2 contiene el origen y mantiene el foco al abrir o llegar desde una acción externa; las flechas conservan el foco en la pestaña. Un solo Exportar abre ContextMenu con los informes e imágenes/datos de la sección. Las acciones no disponibles conservan foco, motivo traducido y guarda. CSV mantiene su confirmación, protección de fórmulas, contexto/hash y cancelación.

Los handlers y serializadores originales permanecen en sus componentes. Estadísticas dirige el informe Markdown al resumen o explorador visible y conserva el informe detallado separado. No se cambian cálculos, datos, límites, seguridad, guardado, main/preload/IPC ni dependencias. Tampoco se implementan SIM-2b/c/d/g.

La invalidación provisional de la exploración al remontar CsvTable sigue existiendo: queryValid puede pasar por false y descartar el resultado. Este cambio no retiene datos obsoletos ni modifica esa política. Correlación muestra su motivo específico cuando aún no hay una correlación calculada. La revisión encontró y corrigió, con una novena prueba roja real, que un alcance de rango heredado bloqueaba el informe de una exploración válida.

La revisión de capturas detectó que la regla común border-color ganaba sobre las reglas locales de las pestañas. Un [rojo de color real](sim-2a-secciones-2026-11-19/logs/tab-line-red.log) confirmó el gris en activas/inactivas. Raíz añadió la comprobación de [color activo igual al lateral e inactivo transparente](../../tests/e2e/analysis-sections.spec.ts#L108) y reforzó únicamente los dos selectores locales de [AnalysisWorkspace.svelte:95](../../src/renderer/components/AnalysisWorkspace.svelte#L95), sin modificar style.css. Los nueve casos y las capturas finales pasaron después.

## Rojo, verde y fases verificadas

Todas las ejecuciones GUI fueron realizadas por raíz, con un worker y cero retry. Los logs sanitizados mantienen los fallos observados.

| Fase | Resultado real | Alcance de la evidencia |
| --- | --- | --- |
| [Rojo original](sim-2a-secciones-2026-11-19/logs/first-red.log) sobre build `10ae1f3` | 8 fallos esperados; 209.732 s de proceso | Roles, origen y Exportar ausentes; ningún fallo de preparación. Entrada del build idéntica antes/después. |
| [Primera implementación](sim-2a-secciones-2026-11-19/logs/first-green.log) | 7 aprobados y 1 fallo | Motivo genérico frente al motivo específico de correlación. |
| [Tras corregir el motivo](sim-2a-secciones-2026-11-19/logs/qualified-eight.log) | 8/8 aprobados; 16.949 s de proceso | Ocho casos originales, antes del ajuste de rango heredado. |
| [Rango → Exploración](sim-2a-secciones-2026-11-19/logs/range-explorer-red.log) | Noveno caso rojo válido; 16.768 s | Informe bloqueado pese a una exploración con resultado válido. |
| [Nueve casos tras ajustar la guarda, con suspensión observada](sim-2a-secciones-2026-11-19/logs/final-nine.log) | 8 aprobados y 1 fallo; 583.010 s en Playwright y 19.172 s en el reloj monotónico de la envoltura | Se conserva como fallo, no se transforma en verde. Véase la ventana de energía. |
| [Nueve casos con equipo despierto](sim-2a-secciones-2026-11-19/logs/awake-nine.log) | 9/9 aprobados; 19.680 s en Playwright y 20.198 s de pared | Fuente con la guarda del rango corregida, antes de la corrección visual CSS. |
| [18 consumidores fast](sim-2a-secciones-2026-11-19/logs/consumers-fast.log) | 160/160 aprobados; 477.306 s de proceso | Ejecución anterior a la última guarda del rango; no se atribuye como ejecución nueva de la fuente posterior. |
| [18 consumidores perf/solo](sim-2a-secciones-2026-11-19/logs/consumers-perf.log) | 18/18 aprobados; 54.338 s en Playwright y 54.639 s de pared | Fuente con guarda corregida; sin omisiones, flaky ni fallos. |
| [Paridad visual: rojo](sim-2a-secciones-2026-11-19/logs/tab-line-red.log) | 1 fallo esperado; 15.859 s de proceso | Oráculo nuevo de color, con las mismas nueve identidades. |
| [Nueve casos finales tras CSS](sim-2a-secciones-2026-11-19/logs/css-nine.log) | 9/9 aprobados; 19.172 s en Playwright y 19.468 s de pared | Colores, foco, relaciones, informes y exportaciones; cero skips, fallos o flaky. |

La ejecución interrumpida coincide con eventos reales del sistema: Idle Sleep a las 19:33:26, DarkWake a las 19:33:39, Maintenance Sleep a las 19:33:47 y DarkWake a las 19:43:10, UTC−06:00. El reporte de 583.010 s y el reloj monotónico de 19.172 s se conservan por separado. La repetición con el equipo despierto pasó sin cambiar plazos, retries ni aserciones. Los eventos completos están en prueba.json.

## Validación sin GUI

Node 24.22.1 y Pandoc real 3.12.1. Después del ajuste del rango:

- [Tipos de la fuente final](sim-2a-secciones-2026-11-19/logs/css-check.log): 0 errores y 0 avisos; 9.068 s. [Build final](sim-2a-secciones-2026-11-19/logs/css-build.log) de raíz: aprobado, 1.944 s.
- [Unitarias completas de la fase previa al CSS](sim-2a-secciones-2026-11-19/logs/unit-full-attempt03-final-range.log): 3008 aprobadas, 0 fallos y 2 omisiones preexistentes; 3010 casos en 170 archivos. Pandoc real: 9/9 aprobados. La corrección posterior añadió únicamente dos prefijos de selectores; se verificó que revertir esos prefijos recupera exactamente el SHA anterior del componente. Su script y el resto del runtime no cambiaron. No se presenta esta suite como una ejecución nueva de otro SHA.
- Las dos omisiones son la prueba nativa exclusiva de Windows y la prueba que requiere el ejecutable empaquetado. No acreditan Windows ni paquete.
- El [primer intento](sim-2a-secciones-2026-11-19/logs/unit-full-attempt01.log) falló por listen EPERM en localhost: 26 casos HTTP y el hook de Pandoc. Se conserva. El [segundo](sim-2a-secciones-2026-11-19/logs/unit-full-attempt02-localhost.log) y el tercero usaron permiso para los servidores locales; no se modificaron pruebas.
- Tipos aislados de los 18 consumidores, panel.ts y el spec público: aprobados. diff --check: aprobado.

El fingerprint de producto de la fase de tipos/unitarias fue `3585be0b7ac8bfa860680426a825f2eb9dfe76df97736b1c4be6b955f822a14b`, idéntico antes y después de ambas comprobaciones. El fingerprint final, tras los dos prefijos CSS, es `0dc93e85a7b337695df359a04290ffab807436b743f998354dd1d91143a6daed`. Solo cambió AnalysisWorkspace; prueba.json conserva las dos fases y los hashes por archivo. Los verdes no se reasignan a otro SHA.

## Inventario: enumeración, no ejecución completa

Identidad: proyecto + archivo + todas las suites anidadas + título. Comparación con la base `10ae1f351a803e966523b570ab093ec7788b5bc4`:

| Selección | Antes | Después | Cambio |
| --- | ---: | ---: | --- |
| [Completo antes](sim-2a-secciones-2026-11-19/before-full-identities.json) / [después](sim-2a-secciones-2026-11-19/after-nine-full-identities.json) | 784 | 793 | +9 de analysis-sections |
| [Fast antes](sim-2a-secciones-2026-11-19/before-fast-identities.json) / [después](sim-2a-secciones-2026-11-19/after-nine-fast-identities.json) | 721 | 730 | +9 de analysis-sections |
| [Perf/solo antes](sim-2a-secciones-2026-11-19/before-perf-solo-identities.json) / [después](sim-2a-secciones-2026-11-19/after-nine-perf-solo-identities.json) | 63 | 63 | Sin cambio |

Cero casos borrados, pérdidas, duplicados o traslados entre proyectos. Fast y perf/solo son disjuntos y su unión coincide con el completo. Enumerar 793 casos no significa haber ejecutado 793 E2E.

## Consumidores adaptados: 18 archivos

Las líneas siguientes corresponden a cambios reales de navegación/exportación. Se conservan títulos, fixtures y oráculos de cifras, precisión, bytes, seguridad, filtros, límites, cancelación y guardado.

| Archivo y línea | Antes | Después y motivo |
| --- | --- | --- |
| [analysis-auto-info.spec.ts:13](../../tests/e2e/analysis-auto-info.spec.ts#L13) | Informe local ausente/habilitado | Menú con aria-disabled; conserva cancelación, informe de 62 columnas y límite. |
| [analysis-describe.spec.ts:168](../../tests/e2e/analysis-describe.spec.ts#L168) | Botones Markdown de resumen/Información | Menú describe.report/info.report; conserva pandas, precisión, muestras y vacíos. |
| [analysis-dock.spec.ts:23](../../tests/e2e/analysis-dock.spec.ts#L23) | Group, aria-pressed y Tab entre secciones | Tablist, aria-selected y flecha; conserva entradas por columna/rango, gráfico y SQL. |
| [analysis-tab.spec.ts:16](../../tests/e2e/analysis-tab.spec.ts#L16) | Botones de sección, título repetido y details | Tabs, foco en origen y botón fijo; conserva cálculo a petición, permisos y cancelación. |
| [chart-fields.spec.ts:115](../../tests/e2e/chart-fields.spec.ts#L115) | Botones SVG/PNG/PDF | Menú; conserva archivos y firmas reales. |
| [chart-single-load.spec.ts:67](../../tests/e2e/chart-single-load.spec.ts#L67) | Botón SVG local | Menú; conserva el oráculo de una sola carga. |
| [chart-trend.spec.ts:70](../../tests/e2e/chart-trend.spec.ts#L70) | Botones de imagen y selector genérico | Menú por formato y confirmación CSV; conserva regresión, SVG, precisión, datos completos y preset. |
| [charts.spec.ts:59](../../tests/e2e/charts.spec.ts#L59) | Botones de imagen/details/selector de datos | Menú y panel CSV; conserva límites, series, filtros, contexto/hash, fórmulas, revisión y cancelación. |
| [columns-overview.spec.ts:22](../../tests/e2e/columns-overview.spec.ts#L22) | Informe local y título Estadísticas | Menú y h2 de origen; conserva recuentos, cobertura parcial, muestras, errores y bytes. |
| [compact-toolbar.spec.ts:86](../../tests/e2e/compact-toolbar.spec.ts#L86) | Título Información y botón Gráficos | h2 de origen y tab Gráficos; conserva Analizar y retorno. |
| [csv-summary.spec.ts:109](../../tests/e2e/csv-summary.spec.ts#L109) | Botón Charts/aria-pressed en en y en-XA | Tab/aria-selected; conserva resultados y comprobaciones de ambos idiomas. |
| [descriptive-percentiles.spec.ts:26](../../tests/e2e/descriptive-percentiles.spec.ts#L26) | Informe local de exploración/detalle | Menú contextual/detallado; conserva varianzas, percentiles tipo 7, filtros y muestra. |
| [large-file.spec.ts:66](../../tests/e2e/large-file.spec.ts#L66) | Botón Estadísticas desactivado | Tab no disponible con el mismo motivo y límites del archivo grande. |
| [project-source.spec.ts:153](../../tests/e2e/project-source.spec.ts#L153) | Botones de sección e informes locales | Tabs y menú contextual/detallado; conserva protección, informes completos y originales. |
| [project-subset-analysis.spec.ts:71](../../tests/e2e/project-subset-analysis.spec.ts#L71) | Botones de secciones traducidas | Tabs traducidas; conserva cobertura, SQL y datos del subconjunto. |
| [sql.spec.ts:84](../../tests/e2e/sql.spec.ts#L84) | Informe local y ausencia tras cancelar | Menú SQL y aria-disabled; conserva filas, identificadores, nulidad, recuperación, seguridad y guardado. |
| [statistics-reports.spec.ts:15](../../tests/e2e/statistics-reports.spec.ts#L15) | Botones Markdown y detallado desactivado | Menú contextual/detallado; conserva PDF/HTML, recuperación, paginación, valores hostiles y CSV pendiente. |
| [ui.spec.ts:218](../../tests/e2e/ui.spec.ts#L218) | Foco en título de sección e informe local | h2 de origen y menú; conserva tipos, calidad, vacíos, contenido y bytes. |

El helper [panel.ts:41](../../tests/e2e/panel.ts#L41) selecciona por rol/aria-selected y abre los menús reales con el idioma actual. Las antiguas ausencias de botones de exportación se comprueban como elementos con aria-disabled y motivo. Solo se retiran las afirmaciones sobre presentación eliminada: group/aria-pressed, título repetido y details/selector genérico. **No se elimina ningún caso.**

## Capturas de la misma encuesta

Encuesta sintética de 240 filas × 7 columnas, reutilizada de los consumidores existentes. Los manifiestos conservan la huella de la fixture y las entradas del build. Antes: 16 PNG reales sobre el build de `10ae1f3`. Después: 16 PNG finales tras el verde CSS, [2/2 casos de captura aprobados](sim-2a-secciones-2026-11-19/logs/css-captures.log), 8.670 s. Las 32 imágenes se copiaron sin editar sus bytes.

| Idioma, tema y ventana | Antes | Después final |
| --- | --- | --- |
| es · light · 1440x900 | [Información](sim-2a-secciones-2026-11-19/before/before-es-light-1440x900-info.png) · [Gráficos](sim-2a-secciones-2026-11-19/before/before-es-light-1440x900-charts.png) | [Información](sim-2a-secciones-2026-11-19/after/after-es-light-1440x900-info.png) · [Gráficos](sim-2a-secciones-2026-11-19/after/after-es-light-1440x900-charts.png) |
| es · light · 1280x720 | [Información](sim-2a-secciones-2026-11-19/before/before-es-light-1280x720-info.png) · [Gráficos](sim-2a-secciones-2026-11-19/before/before-es-light-1280x720-charts.png) | [Información](sim-2a-secciones-2026-11-19/after/after-es-light-1280x720-info.png) · [Gráficos](sim-2a-secciones-2026-11-19/after/after-es-light-1280x720-charts.png) |
| es · dark · 1440x900 | [Información](sim-2a-secciones-2026-11-19/before/before-es-dark-1440x900-info.png) · [Gráficos](sim-2a-secciones-2026-11-19/before/before-es-dark-1440x900-charts.png) | [Información](sim-2a-secciones-2026-11-19/after/after-es-dark-1440x900-info.png) · [Gráficos](sim-2a-secciones-2026-11-19/after/after-es-dark-1440x900-charts.png) |
| es · dark · 1280x720 | [Información](sim-2a-secciones-2026-11-19/before/before-es-dark-1280x720-info.png) · [Gráficos](sim-2a-secciones-2026-11-19/before/before-es-dark-1280x720-charts.png) | [Información](sim-2a-secciones-2026-11-19/after/after-es-dark-1280x720-info.png) · [Gráficos](sim-2a-secciones-2026-11-19/after/after-es-dark-1280x720-charts.png) |
| en-XA · light · 1440x900 | [Información](sim-2a-secciones-2026-11-19/before/before-en-XA-light-1440x900-info.png) · [Gráficos](sim-2a-secciones-2026-11-19/before/before-en-XA-light-1440x900-charts.png) | [Información](sim-2a-secciones-2026-11-19/after/after-en-XA-light-1440x900-info.png) · [Gráficos](sim-2a-secciones-2026-11-19/after/after-en-XA-light-1440x900-charts.png) |
| en-XA · light · 1280x720 | [Información](sim-2a-secciones-2026-11-19/before/before-en-XA-light-1280x720-info.png) · [Gráficos](sim-2a-secciones-2026-11-19/before/before-en-XA-light-1280x720-charts.png) | [Información](sim-2a-secciones-2026-11-19/after/after-en-XA-light-1280x720-info.png) · [Gráficos](sim-2a-secciones-2026-11-19/after/after-en-XA-light-1280x720-charts.png) |
| en-XA · dark · 1440x900 | [Información](sim-2a-secciones-2026-11-19/before/before-en-XA-dark-1440x900-info.png) · [Gráficos](sim-2a-secciones-2026-11-19/before/before-en-XA-dark-1440x900-charts.png) | [Información](sim-2a-secciones-2026-11-19/after/after-en-XA-dark-1440x900-info.png) · [Gráficos](sim-2a-secciones-2026-11-19/after/after-en-XA-dark-1440x900-charts.png) |
| en-XA · dark · 1280x720 | [Información](sim-2a-secciones-2026-11-19/before/before-en-XA-dark-1280x720-info.png) · [Gráficos](sim-2a-secciones-2026-11-19/before/before-en-XA-dark-1280x720-charts.png) | [Información](sim-2a-secciones-2026-11-19/after/after-en-XA-dark-1280x720-info.png) · [Gráficos](sim-2a-secciones-2026-11-19/after/after-en-XA-dark-1280x720-charts.png) |

## CI y entrega

CI de la continuación de código: pendiente de raíz y del SHA exacto que se publique. Esta evidencia local no acredita paquete, instalador, otras plataformas ni una ejecución E2E completa. El PR documental #198 no se presenta como implementación.

Los JSON/logs públicos retiran rutas del equipo, perfiles temporales y parámetros sensibles de URL. Los PNG contienen únicamente la encuesta sintética; sus hashes permiten compararlos con los originales observados.
