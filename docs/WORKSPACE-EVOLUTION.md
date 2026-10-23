# Evolución de FreyaLab — objetivo actualizado

Objetivo autorizado el 22 de octubre de 2026: un espacio de trabajo local, abierto y multiplataforma para documentos, datos y diagramas. La facilidad de uso para estudiantes y profesionales es el criterio principal de producto. Las capacidades técnicas deben poder usarse mediante clics y teclado, sin exigir SQL o programación.

Este objetivo sustituye el seguimiento general A–D como roadmap activo, conservando su [evidencia y cobertura histórica](ANALYTICS-DELIVERY.md). La alfa publicada conserva su alcance original: una función de desarrollo no pasa a formar parte de sus instaladores por aparecer aquí.

## Decisiones conservadas

Electron, Svelte 5/TypeScript, CodeMirror 6, TanStack Table/Virtual, csv-parse/csv-stringify, DuckDB-Wasm/Arrow, Simple Statistics, ECharts y Mermaid. El motor textual conserva el documento; consultas y gráficos consumen representaciones controladas de solo lectura. No se incorpora otro motor, framework ni dependencia en DW-01.

La evaluación del ecosistema del [PR #27](https://github.com/ruzer/freyalab/pull/27) está aprobada como referencia. Graphic Walker, Perspective, Tabulator, Arquero y Polars siguen siendo alternativas evaluadas, sin adopción autorizada. No repetir la auditoría salvo cambios materiales de requisitos o evidencia.

## Fases y progreso verificable

| Fase | Resultado | Cobertura y siguiente comprobación |
|---|---|---|
| DW-01 | Constructor: ejes, medidas, cálculos y alcance | Integrado en main mediante PR #28: nombres reales, siete cálculos para barras, tipo numérico explícito, documento/vista filtrada, ayuda, descripción y alcance en imágenes. Comprobaciones en [evidencia](evidence/visual-chart-builder-2026-10-22.md); integración y CI corresponden al PR del mismo commit |
| DW-02 | Series, agrupaciones temporales y filtros propios | DW-02a en PR #29 sobre main: series categóricas en barras/líneas/dispersión, límite de ocho, leyenda/teclado y cálculo en DuckDB. [Evidencia](evidence/chart-category-series-2026-10-22.md). DW-02b en `codex/chart-time-groups`, dependiente del #29: día/mes/año con fechas ISO, siete cálculos, calendario acotado y huecos sin ceros. [Evidencia](evidence/chart-time-groups-2026-10-22.md). DW-02c en `codex/chart-local-filters`, dependiente del #30: editor de condiciones reutilizado, grupos Y/O independientes y filtrado completo desde disco sin modificar la tabla. [Evidencia](evidence/chart-local-filters-2026-10-22.md). Persistencia de configuraciones sigue en DW-03 |
| DW-03 | Configuraciones y resultados agregados | DW-03a en `codex/chart-presets`, dependiente del #31: biblioteca local validada, filtros capturados, recuperación tras reinicio y protección frente a columnas incompatibles. [Evidencia](evidence/chart-presets-2026-10-22.md). DW-03b en `codex/chart-result-exports`, dependiente del #32: resultados hasta 10 000 elementos mediante DuckDB, CSV + contexto JSON (elección del usuario), JSON y Markdown, alcance/revisión, fórmulas explícitas y cancelación. [Evidencia](evidence/chart-result-exports-2026-10-22.md). SVG/PNG/PDF ya existen |
| DW-04 | Explorador automático de columnas/calidad | DW-04a en `codex/column-profile-types`, sobre el #33: tipo probable explicable y calidad disjunta en el perfil y su informe, sin conversiones ni nuevo motor. [Reglas y límites](COLUMN-PROFILES.md) y [verificación](evidence/column-profile-types-2026-10-22.md). Perfiles, frecuencias, duplicados y Pearson continúan bajo demanda. Pendientes vista conjunta de columnas, moda/varianza/percentiles y navegación |
| DW-05 | Sugerencias locales explicables | Pendiente. Reglas deterministas sobre el perfil existente; no IA ni conversiones del documento. Política de aceptación debajo |
| DW-06 | Edición CSV y transformaciones restantes | Rangos, filtros combinados, orden múltiple, movimientos, duplicación, limpieza y transformaciones reversibles ya tienen entregas previas. Localizar brechas concretas, formatos compatibles e importación antes de escribir nuevas operaciones |
| DW-07 | Pivot y constructor visual de consultas | Ya hay asistentes de agrupación/pivot/cruces. Ampliar lo que falte sin otro SQL engine, con límites, cancelación y validación existentes |
| DW-08 | Integración con Markdown | Informes estadísticos/SQL y copiar tabla Markdown ya existen. Revisar inserción de gráficos y procedencia/exportación de resultados sin alterar fuentes |
| DW-09 | Markdown y Mermaid | Conservar editores, barra/menú de inserción, preview y exportación existentes. Verificar brechas de tablas/imágenes/callouts/plantillas/asistentes antes de implementar |
| DW-10 | Rendimiento, accesibilidad y plataformas | Validación continua por entrega; no una fase que posponga seguridad. Conservar límites hasta medir mejoras; separar compilación, ejecución del paquete e instalación manual |

Completar DW-01 no completa este objetivo general. Cada fase se divide en mejoras pequeñas, ramas y PR independientes; sin fusión ni publicación automática.

## Sugerencias locales — política para DW-05

Reutilizar el perfil de columnas y su contrato cancelable. La inferencia es una sugerencia sobre datos observados, nunca un cambio del tipo del CSV. Antes de implementar, comprobar cobertura, coste de recorrer columnas y si se analizó el documento completo o una muestra.

| Evidencia | Sugerencia | Explicación visible |
|---|---|---|
| Categoría + número utilizable | Barras | «Puedes comparar la suma de Total por Ciudad» |
| Fecha ISO válida + número | Evolución temporal | «Puedes ver Total por mes»; requiere DW-02 y reglas temporales implementadas |
| Una variable numérica | Histograma | «Puedes ver cómo se distribuyen los valores de Total» |
| Dos variables numéricas | Dispersión/correlación | «Puedes explorar cómo se relacionan Cantidad y Precio» |
| Dos categorías | Frecuencias/mapa de calor | «Puedes contar combinaciones de Ciudad y Categoría» |
| Vacíos/ausentes | Calidad | «Esta columna contiene campos vacíos o ausentes»; mostrar los recuentos por separado |

Los ceros iniciales, enteros fuera del rango seguro y nombres indicativos de código/ID son señales para proponer identificador y **no elegirlo automáticamente como medida**. Una señal no es una certeza: la persona puede cambiar la propuesta y elegir un tratamiento numérico explícito para el análisis. No inferir fechas ambiguas ni zonas horarias. No ejecutar análisis costosos automáticamente al abrir si exceden el presupuesto; ofrecer «Explorar columnas» con progreso/cancelación.

La primera implementación debe incluir fixtures de identificadores largos, ceros iniciales, texto numérico, fechas inválidas, encabezados duplicados, columnas mixtas y muestras; sugerencias modificables mediante clics y teclado. No se declara implementada en DW-01.

## Propuesta de bases analíticas por versión

La [evaluación de extractos](ANALYSIS-DATASETS.md) contrasta tres consultas actuales con una base congelada reutilizada. Incluye prueba aislada, integridad y mediciones de 3 000/100 000 filas; no cambia arquitectura ni dependencias. La captura experimental pierde en el caso de 100 000 filas. Una adopción requiere demostrar una transferencia interna eficiente, cancelación y versionado; proyectos persistentes y migración a Python siguen sin implementarse ni aprobarse por esta evaluación.

## Requisitos transversales

- Modelo canónico textual; distinguir ausente/vacío y conservar filas irregulares, Unicode, multilinea, BOM, codificación, delimitador y orden. Solo las ediciones explícitas cambian el documento, con preview/deshacer cuando corresponde.
- Procesamiento local, sin cuentas obligatorias ni telemetría; IPC validado, sandbox, acceso restringido a archivos/red y exportación saneada.
- Mantener límites de edición/análisis, cancelación y control de memoria/tiempo. No presentar muestras como totales ni prometer GB.
- Mostrar qué datos se incluyen y qué operación se realizará. Nombres de columnas, ayuda contextual, errores comprensibles y opciones avanzadas progresivas.
- Exactitud comprobada con cálculos independientes, no solo con un gráfico visible. Flujos de guardado, recuperación y exportación conservados.
- Probar tareas con estudiantes y profesionales antes de afirmar facilidad de uso validada. Los controles accesibles por teclado y las capturas visuales no sustituyen ese estudio ni una prueba con lector de pantalla.

Referencias: [arquitectura](ARCHITECTURE.md), [alcance CSV](CSV-ADVANCED-ROADMAP.md), [gráficos](CHARTS.md), [menús](EDITOR-MENUS.md), [distribución](DISTRIBUTION.md).
