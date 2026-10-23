# Pruebas exploratorias de la auditoría UX/UI

Scripts de Playwright para Electron que recorren la interfaz **real** de FreyaLab y registran lo que ocurre. Respaldan el informe [UX-UI-CONTINUOUS-IMPROVEMENT.md](../UX-UI-CONTINUOUS-IMPROVEMENT.md). **No forman parte de la suite del producto** (`npm run test:e2e` no los ejecuta), no modifican `src/` y no añaden dependencias: reutilizan `@playwright/test` y `electron` ya instalados.

## Qué versión se auditó

Se ejecutaron el 23 de octubre de 2026 sobre `d19e068` (punta de `codex/descriptive-percentiles`), no sobre `main` (`e62a535`). Los componentes de la carcasa, la tabla, Markdown y Mermaid (`App`, `CsvTable`, `Preview`, `Diagram`, `Editor`) son idénticos o casi idénticos en ambas; los scripts de panorámica de columnas, agrupación por fechas, filtros propios y percentiles solo funcionan en la pila. Ver §1 del informe.

## Uso

```sh
npm ci && npm run build                      # desde la raíz, sobre el commit a auditar
node docs/audit/exploration/gen-data.mjs     # CSV sintéticos en ./data (añade --big para grande.csv, ~57 MiB)
node docs/audit/exploration/04-flowA.mjs     # un flujo concreto
AUDIT_SHOTS=/ruta/capturas node docs/audit/exploration/16-six.mjs
```

Cada script usa un perfil, una carpeta de exportación y copias temporales de los CSV: **nunca datos del usuario**, nunca la aplicación instalada. Las capturas van a `./out` (ignorada) o a `AUDIT_SHOTS`. Se ejecutan desde la raíz del repo porque lanzan `out/main/index.js`.

## Qué comprueba cada script

| Script | Flujo / tema | Qué registra |
|---|---|---|
| `01-first` | Primera impresión | Pantalla de bienvenida en claro/oscuro y cuatro tamaños |
| `02-csv-open`, `03-aria` | CSV abierto | Controles visibles, árbol de accesibilidad, controles sin nombre |
| `04-flowA` | A. CSV básico | Editar, guardar, deshacer tras guardar, diferencia byte a byte |
| `05-edit`, `25-keys` | Edición | Teclado, rangos, menús contextuales, paleta, copiar/pegar, búsqueda |
| `26-sort` | Orden | Texto frente a orden numérico |
| `07-stats2`, `08-overview` | C. Análisis | Estadísticas por columna y vista conjunta |
| `10-transform`, `11-flowB2` | B. Limpieza | Menú Operaciones, transformar, vista previa, aplicar, deshacer |
| `12-charts` … `17-flowD3` | D. Visualización | Controles, geometría del panel, seis tipos, agregación, filtros, exportación |
| `19-md-insert`, `20-md-preview`, `21-md-image` | E. Markdown | Inserciones dentro de bloques, vista previa, imagen rota |
| `22-flowF`, `23-flowF2` | F. Mermaid | Diagrama nuevo, error, zoom, exportación SVG/PNG/PDF |
| `24-menu` | Ventana | Menú nativo y tamaño mínimo |
| `27-responsive` | Resoluciones | Cromo, filas visibles y desbordes en ocho tamaños |
| `37-chart-vs-table` | Gráficos frente a tabla | Filas de tabla visibles con cada panel abierto en seis tamaños |
| `34-overlap` | Ventana mínima | Solape entre botones y altura visible de la tabla con cada panel abierto |
| `28-a11y` | Accesibilidad | Contraste, tamaños de texto y de objetivos (medición automática aproximada) |
| `29-big` | Límites | Muestra de un CSV de ~57 MiB |
| `30-analysis`, `32-query`, `35-sql`, `36-menus` | Paneles avanzados | Carpeta, Análisis SQL (consulta y asistentes), Consulta avanzada, menús de fila/celda y operaciones de transformar |
| `31-roundtrip` | Integridad | Ida y vuelta con filas irregulares, BOM, CRLF, punto y coma y multilínea |
| `ref-shot.cjs` | Render aprobado | Captura `docs/design/reference.html` con Electron plano (`OUT` y `REF` como variables de entorno) |

## Límites

- Los diálogos nativos de abrir/guardar no son manejables con Playwright: se abre con `FREYALAB_TEST_OPEN` y se exporta con `FREYALAB_TEST_EXPORT_DIR`. Esa parte queda **no verificada** en la interfaz.
- La medición de contraste es un cálculo propio sobre estilos calculados; confirmar con una herramienta dedicada antes de corregir.
- Los tiempos son de un equipo (macOS ARM, Node v26.11.1 aunque `.nvmrc` indica 24) y no son un benchmark.
