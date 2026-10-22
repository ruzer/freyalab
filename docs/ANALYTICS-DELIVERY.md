# Evolución analítica de FreyaLab — seguimiento del objetivo

Estado al 21 de octubre de 2026. Las entregas A/B de los PR #11/#12 ya están en `main`; el PR #6 se cerró como resuelto, con su corrección y auditoría preservadas. El PR #13 llegó a `main`; #14 y #15 se fusionaron en sus ramas base y sus cambios se incluyen en `codex/csv-transformations` para un PR dirigido a `main`. Este documento mantiene el objetivo completo A–D; una entrega parcial no lo cierra. Complementa la [auditoría y roadmap CSV](CSV-ADVANCED-ROADMAP.md), sin repetirlos. «Implementado en rama» significa código y pruebas de desarrollo, pendiente de revisión e integración; no capacidad del instalador alpha.1.

## A. Edición avanzada

| Requisito | Estado verificable | Pendiente / aceptación |
|---|---|---|
| Selección de rangos | Implementado en `codex/csv-range-editing`: un rectángulo por ratón/teclado, navegación virtual y alcance por consulta/revisión | Probar rendimiento con rangos más amplios y accesibilidad con lector de pantalla; rangos discontinuos no implementados |
| Edición masiva | Rellenar/vaciar/cortar/pegar rangos, vista previa, confirmación y un paso de deshacer; rechazos íntegros | `codex/csv-range-cancellation` añade preparación cancelable, progreso y cierre con confirmación del resultado; corta solo después de una copia correcta y no cancelada. Mediciones amplias y lector de pantalla pendientes |
| Filtros avanzados | Implementado en `codex/csv-advanced-editing`: Y/O, texto, vacíos, números exactos, fechas ISO y RE2 | Ver [guía](EDITOR-MENUS.md) y [evidencia](evidence/csv-query-2026-10-21.md); consultas inválidas no habilitan edición sobre una vista antigua |
| Ordenamiento múltiple | Implementado en la misma rama; tipos explícitos por criterio, empates estables | Es orden de vista; guardar mantiene orden original. `codex/csv-ordering` añade fijación explícita sin filtros, con vista previa y un paso de deshacer |
| Transformaciones | Limpieza/reemplazo por rango existentes; `codex/csv-transformations` añade dividir/combinar conservando originales, NFC, encabezados únicos y eliminación de duplicados por clave compuesta. Vista previa, progreso, cancelación y un paso de deshacer; [guía](TRANSFORMS.md) | `codex/csv-ordering` añade mover filas/columnas y fijar orden; ampliar alcance de las cinco operaciones iniciales más allá del documento completo |
| Buscar/reemplazar | Búsqueda global, filtros, reemplazo literal global/columna y por rango con vista previa | Resaltado de coincidencias y búsqueda avanzada contextual pendientes |
| Herramientas contextuales | Menú de clic derecho/rango y atajos comparten acciones; barra Operaciones existente | Paleta y operaciones estructurales contextuales pendientes |

## B. Estadísticas y exploración

La rama `codex/csv-column-exploration` añade una exploración de solo lectura dentro del panel existente. [Uso](EDITOR-MENUS.md) y [evidencia](evidence/csv-column-exploration-2026-10-21.md). Reutiliza `simple-statistics` 7.12.1 (ISC) en el proceso tabular; no incorpora otro motor de edición.

| Requisito | Estado verificable en rama | Pendiente / aceptación |
|---|---|---|
| Estadísticas descriptivas | Conteos, suma, media, mediana, mínimo, máximo, desviación poblacional (n) y muestral (n−1) | `codex/csv-selection-statistics` añade resumen de celdas y por columnas de un rango capturado, mediana/desviaciones en el panel, campos ausentes y cancelación real. Informes Markdown editables y exportables a PDF/HTML en `codex/csv-statistics-reports`; cálculos aproximados y exclusiones visibles |
| Distribuciones | Tabla de intervalos de igual amplitud, de 1 a 30, con extremos y recuentos | Gráfico ECharts en D; otros criterios de agrupación no implementados |
| Frecuencias | Conteos exactos de texto, porcentajes y primera fila original; páginas de 50 | Informe Markdown de la página cargada con aviso de parcialidad. Límite explícito de 100 000 valores distintos; vistas previas de 256 unidades UTF-16 marcadas |
| Valores faltantes | Vacíos, espacios y campos ausentes diferenciados; primeras 20 filas originales identificadas | Navegación completa y acción para localizar cada fila; no se interpreta cero como vacío |
| Duplicados | Grupos por valor exacto de una columna, filas participantes y repeticiones adicionales; filtro de frecuencias repetidas | Claves compuestas para análisis de frecuencias todavía pendientes; eliminación asistida por clave compuesta con vista previa/deshacer en A (`codex/csv-transformations`) |
| Correlaciones | Pearson entre dos columnas explícitas, pares de la misma fila y omisiones visibles; constantes o menos de dos pares sin coeficiente | Matriz de varias columnas y otros métodos no implementados |
| Análisis de columnas | Perfil numérico/textual, longitudes, ceros iniciales y calidad; encabezados duplicados identificados por índice | No se convierten tipos ni se realizan inferencias automáticas destructivas |

Los resultados incluyen revisión, alcance documento/vista filtrada y marca de muestra. Los cambios de datos, filtros u opciones invalidan los resultados; desplazar o recargar visualmente la tabla no los borra. Cancelar interrumpe la recogida entre bloques y descarta respuestas antiguas. Los cálculos síncronos de la biblioteca terminan antes de descartar su resultado.

Las estadísticas siguen siendo aproximadas. Los enteros fuera del rango seguro se excluyen; las celdas se conservan como texto. Las frecuencias sí comparan el texto completo exacto, sin mezclar dos valores cuya vista previa coincida. Las cifras de la [medición sintética](evidence/csv-column-profile-2026-10-21.json) no amplían los límites generales del editor ni prueban un conjunto arbitrario de un millón de filas.

## C. DuckDB — implementación de desarrollo

`codex/csv-duckdb-analysis` integra DuckDB-Wasm en sandbox, sin sustituir el editor. [Guía](EDITOR-MENUS.md#análisis-sql-agrupaciones-tablas-dinámicas-y-cruces), [evidencia y límites](evidence/duckdb-wasm-2026-10-21.md). No requiere Homebrew ni servidores; no pertenece a los binarios alpha.1.

| Requisito | Estado en rama | Pendiente / aceptación |
|---|---|---|
| SQL | Una consulta relacional de solo lectura, recursos locales, aislamiento de Chromium, configuración bloqueada y validación IPC; cancelación destruye el proceso | CI y pruebas del paquete de #13 verificadas en los cuatro entornos; copia de desarrollo comprobada en macOS ARM. Instalación manual fuera de ese equipo pendiente |
| Agrupaciones | Asistente contar/sumar/promediar, tipos decimales explícitos; SQL visible sobre la misma revisión y cambios pendientes | Más dimensiones/medidas; informe completo de las filas conservadas en `codex/sql-markdown-reports`, editable y exportable a PDF/HTML. CSV/JSON directo pendiente |
| Tablas dinámicas | Asistente filas/categorías/medida, hasta 20 categorías explícitas, contar/sumar/promediar | Categorías dinámicas y múltiples medidas no forman parte de esta entrega |
| Cruces | Hasta cuatro fuentes abiertas; asistente LEFT/INNER con claves textuales exactas y aviso de duplicados | Herramientas visuales adicionales de diagnóstico; no se cruzan rutas arbitrarias |
| Conjuntos grandes | Fuentes completas de 100/3 000/100 000/1 000 000 filas × cuatro columnas medidas en Electron macOS ARM; muestra del editor independiente | Límites: 256 MiB por fuente, dos millones de filas/200 columnas, ocho millones de celdas en conjunto. No análisis integral de GB |

La variante fijada es `@duckdb/duckdb-wasm` **1.33.1-dev57.0** (prerelease MIT), motor observado **v1.5.4**, y Arrow 17.0.0 (Apache-2.0). El prototipo nativo anterior queda como evidencia histórica, sin dependencia nativa incorporada. La configuración limita el gestor de memoria a 384 MB, no toda la RAM del proceso. Resultado máximo: 10 000 filas/200 columnas/8 MiB, paginado y rotulado si se limita. Datos originales, guardado y recuperación no se alteran.

## D. Apache ECharts — implementación de desarrollo

`codex/csv-echarts` incorpora los seis tipos (PR #15, fusionado en su rama base; promoción a `main` incluida en la entrega de transformaciones) mediante ECharts 6.1.0 (Apache-2.0), con consultas agregadas en DuckDB y carga diferida del dibujo. [Uso, métodos y límites](CHARTS.md). Datos fuente, guardado y recuperación no se alteran. No pertenece al instalador alpha.1 publicado.

| Gráfico | Estado y aceptación |
|---|---|
| Histograma | Intervalos iguales, constantes, vacíos y recuentos completos contrastados con fixture; diez intervalos sobre un millón de filas medidos |
| Barras | Categoría y contar/sumar/promediar explícitos; orden por resultado y categoría; tabla alternativa |
| Líneas | Ejes numéricos y orden X explícitos, empates por fila; Y ausentes generan huecos; no infiere fechas |
| Dispersión | Pares de la misma fila, exclusiones visibles; hasta 2 000 puntos, límite rotulado |
| Mapa de calor | Conteos por dos categorías; no imputa combinaciones ausentes como cero; escala y tabla |
| Cajas | Cuartiles tipo 7 y bigotes 1,5 × RIC; cuenta todos los atípicos y dibuja hasta 20 por categoría, con método visible |

Incluye teclado mediante controles/tabla alternativa, temas, tamaño adaptable y exportación SVG/PNG/PDF a través del exportador existente. Cada exportación identifica vistas parciales. `codex/csv-derived-chart-export` permite exportar las imágenes de esos gráficos mediante una operación limitada a SVG/PNG/PDF, conservando el guardián original que impide guardar/exportar el CSV parcial. Sus gráficos usan la fuente completa y las vistas limitadas se rotulan. Lectores de pantalla e instalación manual fuera de macOS ARM siguen pendientes. La CI vuelve a comprobar los gráficos desde los paquetes de los cuatro entornos; consultar evidencia del commit y PR antes de declarar compatibilidad.

## Orden de las siguientes entregas

1. Consulta avanzada, rangos y exploración integrados mediante #11/#12 por el usuario; #6 cerrado como resuelto. No fusionar automáticamente las siguientes entregas.
2. Revisar [rangos y edición masiva](evidence/csv-range-2026-10-21.md) y las [cinco transformaciones nuevas](TRANSFORMS.md), con preparación cancelable e historial existente; verificar movimientos/fijación de orden en `codex/csv-ordering` y cancelación de rangos en `codex/csv-range-cancellation`. El riesgo principal sigue siendo aplicar cambios sobre otro alcance.
3. Revisar la exploración de columnas, frecuencias, duplicados, descriptivas y Pearson; revisar el alcance por rango de `codex/csv-selection-statistics` y los informes Markdown de `codex/csv-statistics-reports`; completar localización de filas. Reutilizar el proceso de datos y paneles, sin mutaciones.
4. Revisar DuckDB-Wasm aislado y sus comprobaciones multiplataforma. Complejidad alta; preservar el editor y sus límites. La integración nativa se descartó para esta entrega por aislamiento.
5. Asistentes de agrupación, pivot y cruce incluidos en la rama SQL; revisar categorías, conversiones explícitas y cambios pendientes antes de integrar.
6. Revisar los seis gráficos ECharts de `codex/csv-echarts`, sus tablas accesibles, exportaciones y pruebas sobre fuentes completas. Revisar la exportación de imágenes desde muestras en `codex/csv-derived-chart-export`, sin debilitar el guardián de originales.
7. Medir y comprobar los flujos completos, paquetes e instalación antes de publicar otra versión.

Cada entrega requiere pruebas específicas más regresión apropiada, PR revisable y evidencia del mismo commit. Compilar, ejecutar con Electron, ejecutar un paquete e instalar son comprobaciones distintas. El objetivo A–D permanece abierto hasta cubrir todos sus requisitos; no se declara equivalente a Modern CSV por añadir un panel.

## Referencias técnicas

- [DuckDB-Wasm](https://github.com/duckdb/duckdb-wasm) y [seguridad de DuckDB](https://duckdb.org/docs/current/operations_manual/securing_duckdb/overview): variante WASM incorporada en la rama de análisis, con aislamiento adicional de Chromium.
- [Importaciones de ECharts](https://echarts.apache.org/handbook/en/basics/import/): integración modular con carga diferida en la rama de gráficos.
- [Modern CSV](https://www.moderncsv.com/documentation/): referencia funcional; su interfaz y código no se copian.

## Informes de análisis — entrega de desarrollo

`codex/csv-statistics-reports` abre los resultados completados como documentos Markdown normales, sin motor, dependencia o API de disco nueva. Comparte etiquetas con los paneles, conserva procedencia/revisión/alcance y marca muestras y páginas de frecuencias parciales. Reutiliza recuperación, guardado, PDF y HTML. La navegación a filas faltantes sigue pendiente. `codex/sql-markdown-reports` añade informes SQL sobre todas las filas conservadas y con procedencia, tipos y marcas de parcialidad; reutiliza el mismo flujo de documentos. [Uso y límites](EDITOR-MENUS.md#informes-de-estadísticas-en-markdown).

Validación de esta entrega: [evidencia local](evidence/csv-statistics-reports-2026-10-21.md); consultar el PR para el paquete y la CI de su commit. La generación del informe, su ejecución empaquetada, la copia instalada y las comprobaciones de CI son evidencias distintas; no sustituye una prueba manual de instalación en Windows/Linux/Intel.

## Informes SQL — entrega de desarrollo

`codex/sql-markdown-reports` reúne las páginas del resultado mediante el contrato existente, valida las fuentes entre páginas y abre una instantánea Markdown con consulta, fuentes, tipos, nulos y valores textuales preservados. No hay dependencias, IPC o formato de recuperación nuevos. La preparación se puede cancelar; resultados limitados se rotulan dentro del informe. [Uso y límites](EDITOR-MENUS.md#informes-de-resultados-sql-en-markdown). Evidencia y estado de CI/instalación se registran en el PR del mismo commit; esta entrega no cierra A–D.
