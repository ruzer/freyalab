# CI-1a · Tiempos y mapa de áreas · 2026-11-05

Base del mapa `ed3847976826aa174e09d4e6cfbae201b4e3b19e`. [Historia original](../stories/historia-ci1-pruebas-por-area-diseno-para-codex.md) y [ADR 0021](../stories/ci-1a-alcance-adr-0021.md).

## Muestra y método

Cinco pushes recientes de `main` y cinco corridas recientes de PR, 35 jobs en total. Se usó el intento 1 de cada corrida para comparar el costo original, con los resultados fallidos o cancelados visibles. Fechas de inicio en Ciudad de México. El SHA es `head_sha` de GitHub Actions. En PR, GitHub puede comprobar el commit de fusión sintético con la base.

| Corrida | Fecha | Evento | SHA |
|---|---|---|---|
| [#42124582417](https://github.com/ruzer/freyalab/actions/runs/42124582417/attempts/1) | 2026-11-05 16:48 | PR | `11931fe25e2fb1e8e21bfede5ffbc8d07911c128` |
| [#42117633805](https://github.com/ruzer/freyalab/actions/runs/42117633805/attempts/1) | 2026-11-05 16:00 | PR | `ca3df782e302876607ab2b57e8b180ece788d902` |
| [#42117628458](https://github.com/ruzer/freyalab/actions/runs/42117628458/attempts/1) | 2026-11-05 16:00 | PR | `63b3c8aa059235f2d7681a40261dde7658c0fe38` |
| [#42116718568](https://github.com/ruzer/freyalab/actions/runs/42116718568/attempts/1) | 2026-11-05 15:53 | main | `ed3847976826aa174e09d4e6cfbae201b4e3b19e` |
| [#42092388600](https://github.com/ruzer/freyalab/actions/runs/42092388600/attempts/1) | 2026-11-05 13:17 | PR | `c94f7e0d54cfd543dd423bce825d775b2ab3a1a7` |
| [#42079805797](https://github.com/ruzer/freyalab/actions/runs/42079805797/attempts/1) | 2026-11-05 11:58 | PR | `e9e9ac1f3a55ebe847823ce76d3fd8890799c915` |
| [#42068789811](https://github.com/ruzer/freyalab/actions/runs/42068789811/attempts/1) | 2026-11-05 10:51 | main | `97eca425563415a9282477844031a7a5c888b124` |
| [#41971176672](https://github.com/ruzer/freyalab/actions/runs/41971176672/attempts/1) | 2026-11-04 22:59 | main | `22b871fc68f81dcf10291f0281ea3a666cc5b0cc` |
| [#41807655514](https://github.com/ruzer/freyalab/actions/runs/41807655514/attempts/1) | 2026-11-04 03:27 | main | `4ae1ac64c06ee484d0ac42662b55dae67e1d62f1` |
| [#41787841663](https://github.com/ruzer/freyalab/actions/runs/41787841663/attempts/1) | 2026-11-04 00:47 | main | `aaeec8d727e950b1651c9947637f55e71fdff0a2` |

Duración de reloj en minutos y segundos por paso, de `started_at` a `completed_at`. El job incluye preparación y limpieza y excluye la cola. F indica fallo, C cancelación y — fase omitida. Los pasos fallidos y cancelados son tiempos parciales y quedan fuera de los resúmenes de pasos exitosos.

| Corrida | Runner | Tipos | Unitarias | E2E rápidas | Perf/solo | Construir paquete | E2E del paquete | Job |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| [42124582417](https://github.com/ruzer/freyalab/actions/runs/42124582417/job/127585376622) | ubuntu-24.04 | 0:12 | 0:55 | 21:41 | 3:37 | 0:20 | 6:13 | 33:26 |
| [42124582417](https://github.com/ruzer/freyalab/actions/runs/42124582417/job/127585376373) | windows-2025 | 0:18 | 1:43 | 29:52 | 4:39 | 0:42 | 8:30 | 46:42 |
| [42124582417](https://github.com/ruzer/freyalab/actions/runs/42124582417/job/127585376669) | macos-15 | 0:21 | 1:17 | 44:21 | 7:17 | 0:37 | 5:43 C | 60:33 C |
| [42117633805](https://github.com/ruzer/freyalab/actions/runs/42117633805/job/127561408493) | ubuntu-24.04 | 0:12 | 0:53 | 21:25 | 4:10 F | — | — | 27:12 F |
| [42117633805](https://github.com/ruzer/freyalab/actions/runs/42117633805/job/127561408532) | windows-2025 | 0:14 | 1:21 | 27:56 | 4:05 | 0:31 | 7:13 | 42:50 |
| [42117633805](https://github.com/ruzer/freyalab/actions/runs/42117633805/job/127561408261) | macos-15 | 0:09 | 0:46 | 16:38 | 3:40 | 0:19 | 6:28 | 28:40 |
| [42117628458](https://github.com/ruzer/freyalab/actions/runs/42117628458/job/127561392338) | ubuntu-24.04 | 0:15 | 1:05 | 23:40 | 4:22 F | — | — | 29:50 F |
| [42117628458](https://github.com/ruzer/freyalab/actions/runs/42117628458/job/127561392020) | windows-2025 | 0:13 | 1:16 | 24:59 | 3:40 | 0:30 | 6:37 | 38:22 |
| [42117628458](https://github.com/ruzer/freyalab/actions/runs/42117628458/job/127561392529) | macos-15 | 0:14 | 0:59 | 25:14 | 5:15 F | — | — | 32:20 F |
| [42116718568](https://github.com/ruzer/freyalab/actions/runs/42116718568/job/127558191769) | ubuntu-24.04 | 0:11 | 0:44 | 19:49 | 3:05 | 0:16 | 5:38 | 30:07 |
| [42116718568](https://github.com/ruzer/freyalab/actions/runs/42116718568/job/127558191751) | windows-2025 | 0:18 | 1:53 | 29:01 | 4:27 | 0:45 | 8:00 | 45:31 |
| [42116718568](https://github.com/ruzer/freyalab/actions/runs/42116718568/job/127558191896) | macos-15 | 0:19 | 1:07 | 27:00 | 5:28 | 0:38 | 9:12 | 44:42 |
| [42116718568](https://github.com/ruzer/freyalab/actions/runs/42116718568/job/127558191341) | macos-15-intel | 0:25 | 2:39 | 45:06 | 8:12 F | — | — | 57:28 F |
| [42092388600](https://github.com/ruzer/freyalab/actions/runs/42092388600/job/127473523186) | ubuntu-24.04 | 0:16 | 1:12 | 25:00 | 4:25 | 0:26 | 7:30 | 39:27 |
| [42092388600](https://github.com/ruzer/freyalab/actions/runs/42092388600/job/127473522587) | windows-2025 | 0:14 | 1:17 | 25:59 | 3:46 | 0:32 | 7:00 | 40:09 |
| [42092388600](https://github.com/ruzer/freyalab/actions/runs/42092388600/job/127473522999) | macos-15 | 0:19 | 1:16 | 27:10 | 5:43 | 0:44 | 9:45 | 45:45 |
| [42079805797](https://github.com/ruzer/freyalab/actions/runs/42079805797/job/127429582678) | ubuntu-24.04 | 0:12 | 0:53 | 21:05 | 4:11 F | — | — | 26:51 F |
| [42079805797](https://github.com/ruzer/freyalab/actions/runs/42079805797/job/127429582177) | windows-2025 | 0:18 | 1:43 | 30:35 | 4:40 | 0:41 | 8:29 | 47:36 |
| [42079805797](https://github.com/ruzer/freyalab/actions/runs/42079805797/job/127429582755) | macos-15 | 0:18 | 1:16 | 40:53 | 7:41 | 0:37 | 9:49 C | 61:30 C |
| [42068789811](https://github.com/ruzer/freyalab/actions/runs/42068789811/job/127390477908) | ubuntu-24.04 | 0:13 | 0:53 | 21:38 | 4:11 F | — | — | 27:24 F |
| [42068789811](https://github.com/ruzer/freyalab/actions/runs/42068789811/job/127390477661) | windows-2025 | 0:18 | 1:51 | 31:39 | 4:45 | 0:48 | 8:33 | 49:31 |
| [42068789811](https://github.com/ruzer/freyalab/actions/runs/42068789811/job/127390478615) | macos-15 | 0:15 | 1:21 | 45:15 | 8:54 | 0:42 | 3:13 C | 60:36 C |
| [42068789811](https://github.com/ruzer/freyalab/actions/runs/42068789811/job/127390478071) | macos-15-intel | 1:32 | 6:20 F | — | — | — | — | 10:06 F |
| [41971176672](https://github.com/ruzer/freyalab/actions/runs/41971176672/job/127059562596) | ubuntu-24.04 | 0:15 | 1:02 | 24:02 | 3:51 | 0:23 | 7:17 | 37:21 |
| [41971176672](https://github.com/ruzer/freyalab/actions/runs/41971176672/job/127059562805) | windows-2025 | 0:19 | 1:52 | 29:03 | 4:24 | 0:45 | 8:07 | 45:44 |
| [41971176672](https://github.com/ruzer/freyalab/actions/runs/41971176672/job/127059562772) | macos-15 | 0:14 | 0:52 | 24:44 | 4:44 | 0:25 | 7:09 | 38:43 |
| [41971176672](https://github.com/ruzer/freyalab/actions/runs/41971176672/job/127059562840) | macos-15-intel | 0:29 | 3:43 | 45:17 | 7:38 | 1:14 | 13:51 | 73:42 |
| [41807655514](https://github.com/ruzer/freyalab/actions/runs/41807655514/job/126498602414) | ubuntu-24.04 | 0:16 | 1:12 | 24:42 | 4:11 | 0:25 | 7:30 | 38:46 |
| [41807655514](https://github.com/ruzer/freyalab/actions/runs/41807655514/job/126498602432) | windows-2025 | 0:18 | 1:51 | 29:05 | 4:22 | 0:45 | 8:05 | 45:31 |
| [41807655514](https://github.com/ruzer/freyalab/actions/runs/41807655514/job/126498602724) | macos-15 | 0:19 | 1:19 | 30:56 | 7:59 | 0:38 | 13:18 | 55:17 |
| [41807655514](https://github.com/ruzer/freyalab/actions/runs/41807655514/job/126498602197) | macos-15-intel | 1:01 | 6:02 F | — | — | — | — | 9:03 F |
| [41787841663](https://github.com/ruzer/freyalab/actions/runs/41787841663/job/126433988582) | ubuntu-24.04 | 0:16 | 1:13 | 25:06 | 4:04 | 0:26 | 7:26 | 39:07 |
| [41787841663](https://github.com/ruzer/freyalab/actions/runs/41787841663/job/126433988445) | windows-2025 | 0:19 | 1:56 | 29:35 | 4:29 | 0:45 | 8:11 | 46:23 |
| [41787841663](https://github.com/ruzer/freyalab/actions/runs/41787841663/job/126433988631) | macos-15 | 0:12 | 0:49 | 21:27 | 4:04 | 0:24 | 7:26 | 35:08 |
| [41787841663](https://github.com/ruzer/freyalab/actions/runs/41787841663/job/126433988597) | macos-15-intel | 0:37 | 3:55 | 54:18 | 0:18 C | — | — | 60:35 C |

### E2E por proyecto y sistema

Cada celda muestra mediana de suma de tiempos por caso de Playwright, con mediana de intentos cronometrados entre paréntesis. Solo se agregan pasos exitosos. Se incluyen intentos fallidos con duración en pasos que recuperaron en un reintento. Los casos omitidos y los intentos sin duración quedan fuera. El encabezado del proyecto se toma de cada resultado del log. Los tiempos son trabajo acumulado, no tiempo de reloj ni predicción de ahorro, especialmente con dos workers en Apple silicon. «—» indica que esa fase no contiene casos de ese proyecto.

| Runner | Fase | Pasos exitosos | shell | md | csv |
|---|---|---:|---:|---:|---:|
| ubuntu-24.04 | E2E rápidas | 10 | 4:01 (102) | 6:32 (206) | 11:59 (194) |
| ubuntu-24.04 | Perf/solo | 6 | 0:46 (13) | 0:53 (20.5) | 2:14 (24) |
| ubuntu-24.04 | E2E del paquete | 6 | 1:07 (34) | — | 6:10 (58) |
| windows-2025 | E2E rápidas | 10 | 5:21 (102) | 8:58 (210) | 14:24 (194) |
| windows-2025 | Perf/solo | 10 | 0:42 (13) | 1:07 (22) | 2:29 (24) |
| windows-2025 | E2E del paquete | 10 | 1:21 (34) | — | 6:40 (58) |
| macos-15 | E2E rápidas | 10 | 9:31 (102) | 16:41 (206) | 27:16 (194) |
| macos-15 | Perf/solo | 9 | 1:03 (13) | 1:45 (22) | 2:48 (24) |
| macos-15 | E2E del paquete | 6 | 1:34 (34) | — | 6:38 (58) |
| macos-15-intel | E2E rápidas | 3 | 9:17 (102) | 13:42 (204) | 22:26 (194) |
| macos-15-intel | Perf/solo | 1 | 1:18 (13) | 2:24 (19) | 3:46 (24) |
| macos-15-intel | E2E del paquete | 1 | 2:12 (34) | — | 11:33 (58) |

Para reproducir la extracción se usan `gh api repos/ruzer/freyalab/actions/runs/<id>/attempts/1/jobs?per_page=100` y `gh run view <id> -R ruzer/freyalab --attempt 1 --log`. Se cruzan runner y marcas de tiempo con los pasos de la API. Se suman las duraciones de las líneas de caso `✓`, `✘`, `ok` y `x` con `[shell]`, `[md]` o `[csv]`, convirtiendo ms, s y min a segundos. Se excluyen líneas de resumen y de omitidos.

### Qué indican estos datos

- Los PR actuales que completaron Ubuntu (n=2) tardaron 33:26–39:27, con mediana de 36:26. Si se incluyen pushes exitosos (n=6 en total), la mediana es 38:04. La carga actual completa supera la referencia de 30 min. Eso justifica medir un PR transversal en CI-1b antes de decidir si dividir jobs en CI-1c.
- Los jobs exitosos de Apple silicon (n=6) tardaron 28:40–55:17. La duración acumulada de los casos CSV y la fase del paquete ayudan a ubicar dónde se consume tiempo. Los jobs cancelados muestran el límite alcanzado y no prueban el tiempo total que habrían necesitado.
- No hay tiempos después del cambio. El selector aún no interviene en CI. La prueba de ahorro, el umbral y cualquier cambio de gate quedan para la fase correspondiente.

## Selector y comprobación del mapa

```sh
node scripts/ci-areas.mjs src/renderer/components/MarkdownToolbar.svelte tests/e2e/csv-text.spec.ts

# En Bash, pipefail preserva un error de git diff para el consumidor.
set -o pipefail
git diff --name-only --no-renames -z main...HEAD | node scripts/ci-areas.mjs --stdin
```

El selector conserva `checks` y `unit` en true. Las rutas de producto revisadas aportan su área y `shell`. Una ruta desconocida, inválida o un conjunto vacío activa `full` y los tres proyectos. La documentación conocida por sí sola devuelve un plan sin E2E. El campo `package` indica rutas que requieren el paquete incluso en un plan por área. Un futuro consumidor deberá evaluar `full || package`.

`specs` devuelve las rutas E2E cambiadas, incluso en un plan completo o cuando el código modificado pertenece a otra área. La pertenencia de cada spec viene de `tests/e2e/groups.ts`, con el mismo grupo residual CSV que Playwright. La entrada consta de rutas y por tanto incluye también nombres borrados. En CI-1b se deberá usar la lista para conservar cobertura de los specs ejecutables, sin pasar a Playwright rutas borradas como si existieran. Con `--no-renames` se evalúan tanto el origen como el destino de un renombre. La ejecución real y sus comprobaciones quedan para CI-1b.

### Verificado en la base

- Se revisaron 66 rutas de producto de la lista explícita con referencias relativas de TypeScript, bloques de script de Svelte y las entradas de Vite. Las rutas existen. Se contrastaron aparte las cargas dinámicas, URLs de workers y condiciones de despacho que el recorrido estático no puede resolver.
- Markdown y Mermaid. `MarkdownToolbar` recibe comandos de `App.svelte`. `Editor.svelte` importa `markdown-editing`, `markdown-commands`, `markdown-paste` y módulos de diagramas. Sus comportamientos están detrás de condiciones de Markdown o Mermaid. `TextStats` sirve a Markdown y TXT desde `App.svelte`, y `TextStats.svelte` carga su worker de estadísticas. El proyecto `md` ya contiene `text-stats.spec.ts`. La ruta `PandocDialog.svelte` cubre el diálogo. La integración nativa de Pandoc y el exportador principal siguen transversales.
- CSV. `CsvTable.svelte` importa `AnalysisDock`, herramientas CSV y `virtual-scroll`, y carga `CsvCharts` con un import dinámico. `CsvCharts` usa `ChartFields` y `ChartPresets`. `Editor.svelte` usa `csv-text-model` en la rama CSV Texto. `Documents` usa `TableClient` para operaciones de tabla, este inicia `table-worker`, y el worker crea `TableEngine`. `large-view` usa el pool de búsqueda y Vite empaqueta `large-search-worker`. `SqlService` carga `analytics.html`, que arranca `analytics.ts`. Los módulos CSV de `src/main` requieren también paquete.
- Transversal. `Editor.svelte` atiende los cuatro formatos. Los informes CSV abren Markdown desde `App.svelte`, y `statistics-reports.spec.ts` y `sql.spec.ts` comprueban su HTML. Por eso `Preview.svelte` y `render.ts` quedan en completo. `remark-details`, `remark-numbering`, `remark-citations` y `report-metadata` se comparten con activos o exportación en el proceso principal. `src/shared`, IPC, i18n, configuración, scripts y ayudantes E2E también quedan en completo.
- Documentación. `scripts/licenses.mjs` lee `docs/licenses/`. `tests/word-style-evidence.test.ts` lee `docs/evidence/seg-s2e-2026-10-30/custom-style-invalid.docx`. `tests/i18n-pending.test.ts` y `tests/e2e/app.spec.ts` leen un JSON de evidencia y la imagen original del diseño. El selector los deja en completo. El filtro actual del workflow sí ignora los DOCX de evidencia. La clasificación local no puede corregir un evento que GitHub ya omitió y esa discrepancia queda para CI-1b.
- Playwright listó 569 casos en 63 specs. Se contrastaron sus nombres y proyectos con la salida del selector para cada ruta.

### Suposiciones y riesgos

- Los imports y las condiciones actuales describen los consumidores conocidos. La lista no demuestra aislamiento ante cambios semánticos, integraciones por IPC, cargas calculadas o nuevos consumidores. En particular, los módulos de editor compartido con ramas por formato se asignan por su comportamiento actual. `shell` y las unitarias siempre aportan cobertura cuando se ejecuta un plan de código.
- Se asume que las rutas de prosa y diseño expresamente reconocidas son documentación. Los binarios, licencias y otros formatos quedan completos. Un fixture futuro bajo una ruta de documentación deberá salir de la excepción antes de usarla en el workflow.
- No se midió el ahorro por área. La garantía depende del gate de CI-1b y de conservar completo en `main`. El cambio de matriz y la separación de jobs de CI-1c requieren mediciones posteriores.

## Pruebas de esta entrega

| Comando | Resultado |
|---|---|
| `npm test -- tests/ci-areas.test.ts`, antes del mapa | El módulo aún faltaba. Con una implementación inicial que siempre devolvía completo, fallaron 20 casos y pasaron 17. |
| El mismo comando, tras incorporar los consumidores cruzados al contrato | Cuatro fallos al exigir cobertura completa para `Preview`, `render` y dos módulos de remark. La revisión del mapa resolvió los cuatro. |
| `npm test -- tests/ci-areas.test.ts`, versión final | 40 casos aprobados. |
| `npx playwright test --list --reporter=list` y comparación con el selector | 569 casos en 63 specs, cada uno en un solo proyecto. 9 specs en `shell`, 25 en `md`, 29 en `csv`. |
| `node --check scripts/ci-areas.mjs` y `npm run check` | Aprobados. La comprobación de Svelte registró cero errores y advertencias. |
| `FREYALAB_PANDOC_TEST_PATH=/opt/homebrew/bin/pandoc npm test` | 126 archivos aprobados, 2.500 casos aprobados y uno omitido porque el Pandoc local carece de soporte HTTP. |

Verificación local en macOS Apple silicon con Node 24. La enumeración de Playwright comprueba la pertenencia de los specs. La ejecución E2E local y los resultados con la selección integrada al workflow quedan sin verificar en CI-1a.
