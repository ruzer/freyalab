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
| DW-04 | Explorador automático de columnas/calidad | Antecedente DW-04a en `codex/column-profile-types`, sobre el #33: tipo probable explicable y calidad disjunta en perfil e informe; [evidencia histórica](evidence/column-profile-types-2026-10-22.md). DW-04b en `codex/column-overview`: lista conjunta con selección/alcance, búsqueda, páginas de 50, explicación y detalle por posición, informe íntegro y cobertura parcial explícita. Reutiliza el análisis individual sin backend, IPC, dependencias ni datasets nuevos. DW-04c en implementación en `codex/descriptive-percentiles`, basada en el PR #37: varianzas y P10/P25/P75/P90 compartidos, UI progresiva e informes completos; comprobaciones finales pendientes. [Reglas, límites y pendientes](COLUMN-PROFILES.md). DW-04 sigue abierto: moda y verificaciones de coste/cobertura pendientes |
| DW-05 | Sugerencias locales explicables | Pendiente. Reglas deterministas sobre el perfil existente; no IA ni conversiones del documento. Política de aceptación debajo |
| DW-06 | Edición CSV y transformaciones restantes | Rangos, filtros combinados, orden múltiple, movimientos, duplicación, limpieza y transformaciones reversibles ya tienen entregas previas. Localizar brechas concretas, formatos compatibles e importación antes de escribir nuevas operaciones |
| DW-07 | Pivot y constructor visual de consultas | Ya hay asistentes de agrupación/pivot/cruces. Ampliar lo que falte sin otro SQL engine, con límites, cancelación y validación existentes |
| DW-08 | Integración con Markdown | Informes estadísticos/SQL y copiar tabla Markdown ya existen. Revisar inserción de gráficos y procedencia/exportación de resultados sin alterar fuentes |
| DW-09 | Markdown y Mermaid | Conservar editores, barra/menú de inserción, preview y exportación existentes. Verificar brechas de tablas/imágenes/callouts/plantillas/asistentes antes de implementar |
| DW-10 | Rendimiento, accesibilidad y plataformas | Validación continua por entrega; no una fase que posponga seguridad. Conservar límites hasta medir mejoras; separar compilación, ejecución del paquete e instalación manual |

Completar DW-01 no completa este objetivo general. Cada fase se divide en mejoras pequeñas, ramas y PR independientes; sin fusión ni publicación automática.

## Vista conjunta de columnas — antecedente conservado DW-04b

**Estadísticas → Comprender todas las columnas** añade una entrada bajo demanda al explorador existente. Permite analizar todas las columnas o las marcadas al iniciar, sobre documento completo o vista filtrada. En modo muestra, ambas opciones y los resultados se identifican como muestra. Se muestran recuentos compactos disjuntos, tipo probable y razón desplegable accesible; buscar nombres/posiciones y paginar de 50 en 50 solo cambia la lista visible. El detalle conserva posición y alcance, incluso con encabezados duplicados o vacíos.

El informe Markdown incluye todas las columnas solicitadas, sin limitarse a la página/búsqueda, con procedencia, revisión, filtros y cambios pendientes. Un exceso de **100 000 valores distintos en una columna** se indica como no disponible y permite continuar; informe y lista declaran la cobertura parcial sin sustituir errores por ceros. Hasta **2 000 columnas** y **dos millones de posiciones de celdas** por solicitud, con progreso y cancelación cooperativa. Tras dos minutos, la interfaz abandona la exploración y solicita cancelación; no garantiza una duración máxima del motor: la comprobación inicial no es cancelable y los cálculos síncronos en curso terminan antes de descartarse. Un cambio de datos, vista o alcance invalida los resultados; cerrar o cancelar descarta la exploración provisional y las respuestas antiguas.

Esta entrega conserva el motor textual, la API de análisis individual y las reglas de calidad de DW-04a. No incorpora nuevos IPC, backend, dependencias ni datasets, ni adopta la propuesta de extractos versionados. Los perfiles/frecuencias/duplicados/Pearson siguen disponibles bajo demanda. **Registro histórico de DW-04b:** DW-04 permanecía abierto para moda, varianza, percentiles y verificaciones pendientes; DW-05 no estaba implementado por esa entrega. La evidencia de DW-04a es histórica y no sustituye la de DW-04b ni la de las ampliaciones posteriores.

## Varianza y percentiles — alcance de DW-04c

Implementación en `codex/descriptive-percentiles`, basada en el [PR #37](https://github.com/ruzer/freyalab/pull/37), sin afirmar aún resultados finales de comprobaciones, integración o distribución. El helper descriptivo existente añade varianza poblacional (`n`), varianza muestral (`n−1`) y P10/P25/P75/P90 a columnas, selección/rangos y perfiles individuales, conservando sus alcances y exclusiones. Reutiliza Simple Statistics **7.12.1** fijada: la fuente instalada de `quantile`/`quantileSorted` confirma interpolación lineal **tipo 7**, posición `(n−1)×p`; P50 coincide con la mediana. La documentación web que aún describe 7.8.7 no sustituye esa comprobación de versión.

La casilla **Varianza y percentiles** añade seis columnas a la tabla general sin recalcular; el perfil individual las ofrece en una sección desplegable con ayuda. Los informes generales y de perfil incluyen las seis medidas siempre, aunque estuvieran ocultas en la interfaz. El panorama compacto y las otras vistas conservan su alcance.

Sin valores numéricos utilizables se devuelve `null`, presentado como **—**. Con un número, la varianza poblacional es cero y la muestral no está definida; se necesita `n≥2` para esta última. Se conserva el tratamiento de valores excluidos y resultados no representables. La precisión es aproximada, sin convertir IDs ni reescribir datos originales; las muestras siguen identificadas como tales. No se añaden dependencias, motores, IPC ni datasets. **Moda continúa pendiente**, incluidos sus empates: **DW-04 no está completo y DW-05 sigue pendiente**.

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

## Requisitos transversales

- Modelo canónico textual; distinguir ausente/vacío y conservar filas irregulares, Unicode, multilinea, BOM, codificación, delimitador y orden. Solo las ediciones explícitas cambian el documento, con preview/deshacer cuando corresponde.
- Procesamiento local, sin cuentas obligatorias ni telemetría; IPC validado, sandbox, acceso restringido a archivos/red y exportación saneada.
- Mantener límites de edición/análisis, cancelación y control de memoria/tiempo. No presentar muestras como totales ni prometer GB.
- Mostrar qué datos se incluyen y qué operación se realizará. Nombres de columnas, ayuda contextual, errores comprensibles y opciones avanzadas progresivas.
- Exactitud comprobada con cálculos independientes, no solo con un gráfico visible. Flujos de guardado, recuperación y exportación conservados.
- Probar tareas con estudiantes y profesionales antes de afirmar facilidad de uso validada. Los controles accesibles por teclado y las capturas visuales no sustituyen ese estudio ni una prueba con lector de pantalla.

Referencias: [arquitectura](ARCHITECTURE.md), [alcance CSV](CSV-ADVANCED-ROADMAP.md), [gráficos](CHARTS.md), [menús](EDITOR-MENUS.md), [distribución](DISTRIBUTION.md).
