# Evolución analítica de FreyaLab — seguimiento del objetivo

Estado al 21 de octubre de 2026. Este documento mantiene el objetivo completo A–D; una entrega parcial no lo cierra. Complementa la [auditoría y roadmap CSV](CSV-ADVANCED-ROADMAP.md), sin repetirlos. «Implementado en rama» significa código y pruebas de desarrollo, pendiente de revisión e integración; no capacidad del instalador alpha.1.

## A. Edición avanzada

| Requisito | Estado verificable | Pendiente / aceptación |
|---|---|---|
| Selección de rangos | Implementado en `codex/csv-range-editing`: un rectángulo por ratón/teclado, navegación virtual y alcance por consulta/revisión | Probar rendimiento con rangos más amplios y accesibilidad con lector de pantalla; rangos discontinuos no implementados |
| Edición masiva | Rellenar/vaciar/cortar/pegar rangos, vista previa, confirmación y un paso de deshacer; rechazos íntegros | Cancelación del cálculo en curso y mediciones amplias pendientes; cerrar la vista previa descarta resultados |
| Filtros avanzados | Implementado en `codex/csv-advanced-editing`: Y/O, texto, vacíos, números exactos, fechas ISO y RE2 | Ver [guía](EDITOR-MENUS.md) y [evidencia](evidence/csv-query-2026-10-21.md); consultas inválidas no habilitan edición sobre una vista antigua |
| Ordenamiento múltiple | Implementado en la misma rama; tipos explícitos por criterio, empates estables | Es orden de vista; guardar mantiene orden original. No hay reordenación permanente asistida |
| Transformaciones | Limpieza y reemplazo con vista previa por rango; duplicación de filas/columnas existente | Dividir/combinar, normalizar, eliminar duplicados, mover filas/columnas; progreso y cancelación según coste |
| Buscar/reemplazar | Búsqueda global, filtros, reemplazo literal global/columna y por rango con vista previa | Resaltado de coincidencias y búsqueda avanzada contextual pendientes |
| Herramientas contextuales | Menú de clic derecho/rango y atajos comparten acciones; barra Operaciones existente | Paleta y operaciones estructurales contextuales pendientes |

## B. Estadísticas y exploración

La rama `codex/csv-column-exploration` añade una exploración de solo lectura dentro del panel existente. [Uso](EDITOR-MENUS.md) y [evidencia](evidence/csv-column-exploration-2026-10-21.md). Reutiliza `simple-statistics` 7.12.1 (ISC) en el proceso tabular; no incorpora otro motor de edición.

| Requisito | Estado verificable en rama | Pendiente / aceptación |
|---|---|---|
| Estadísticas descriptivas | Conteos, suma, media, mediana, mínimo, máximo, desviación poblacional (n) y muestral (n−1) | Selección de celdas como alcance del nuevo panel; informe exportable. Cálculos aproximados, exclusiones visibles |
| Distribuciones | Tabla de intervalos de igual amplitud, de 1 a 30, con extremos y recuentos | Gráfico ECharts en D; otros criterios de agrupación no implementados |
| Frecuencias | Conteos exactos de texto, porcentajes y primera fila original; páginas de 50 | Exportación del resultado. Límite explícito de 100 000 valores distintos; vistas previas de 256 unidades UTF-16 marcadas |
| Valores faltantes | Vacíos, espacios y campos ausentes diferenciados; primeras 20 filas originales identificadas | Navegación completa y acción para localizar cada fila; no se interpreta cero como vacío |
| Duplicados | Grupos por valor exacto de una columna, filas participantes y repeticiones adicionales; filtro de frecuencias repetidas | Claves compuestas y eliminación asistida, con vista previa/deshacer, en A |
| Correlaciones | Pearson entre dos columnas explícitas, pares de la misma fila y omisiones visibles; constantes o menos de dos pares sin coeficiente | Matriz de varias columnas y otros métodos no implementados |
| Análisis de columnas | Perfil numérico/textual, longitudes, ceros iniciales y calidad; encabezados duplicados identificados por índice | No se convierten tipos ni se realizan inferencias automáticas destructivas |

Los resultados incluyen revisión, alcance documento/vista filtrada y marca de muestra. Los cambios de datos, filtros u opciones invalidan los resultados; desplazar o recargar visualmente la tabla no los borra. Cancelar interrumpe la recogida entre bloques y descarta respuestas antiguas. Los cálculos síncronos de la biblioteca terminan antes de descartar su resultado.

Las estadísticas siguen siendo aproximadas. Los enteros fuera del rango seguro se excluyen; las celdas se conservan como texto. Las frecuencias sí comparan el texto completo exacto, sin mezclar dos valores cuya vista previa coincida. Las cifras de la [medición sintética](evidence/csv-column-profile-2026-10-21.json) no amplían los límites generales del editor ni prueban un conjunto arbitrario de un millón de filas.

## C. DuckDB — integración pendiente

| Requisito | Aceptación necesaria |
|---|---|
| Consultas SQL | [Prototipo local en Electron ARM comprobado](evidence/duckdb-probe-2026-10-21.md); faltan otras plataformas, aislamiento y empaquetado antes de añadir el motor al producto. Consultas de solo lectura, sin extensiones, red ni acceso arbitrario a disco; cancelación y límites de memoria/resultados |
| Agrupaciones | Asistente visual y SQL sobre el mismo conjunto/revisión; texto original para ID/fechas y tipos numéricos elegidos explícitamente |
| Tablas dinámicas | Filas/columnas/medidas y agregación configurables, resultados paginados, sin modificar el CSV |
| Cruces entre archivos | Solo documentos autorizados, claves y tipo de unión explícitos, duplicados/faltantes visibles; nombres de tabla/columna citados de forma segura |
| Conjuntos grandes | Análisis completo de al menos el caso sintético de un millón × cuatro columnas, además de muestras editoriales. Medir lectura, memoria, consulta, cancelación y resultados; no ampliar silenciosamente el editor de 50 MiB/dos millones de celdas |

La instalación de DuckDB en este Mac no es una dependencia distribuible. Deben comprobarse integración y empaquetado en macOS ARM/Intel, Windows x64 y Linux x64. Deben incluirse cambios pendientes del editor en una proyección consistente; leer solo el archivo guardado produciría resultados obsoletos. Esta evolución es posterior a la alfa y no cambia sus compromisos.

## D. Apache ECharts — pendiente completo

| Gráfico | Datos y aceptación mínima |
|---|---|
| Histograma | Intervalos numéricos y recuentos visibles y reproducibles |
| Barras | Categorías y agregación elegidas; etiquetas/tabla alternativa |
| Líneas | Eje y orden explícitos, sin inferir fechas ni conectar faltantes silenciosamente |
| Dispersión | Pares numéricos, observaciones omitidas y límite de puntos documentados |
| Mapa de calor | Matriz y escala legibles; faltantes diferenciados de cero |
| Cajas | Cuartiles, bigotes y valores atípicos con método documentado y fixture conocido |

Reutilizar ECharts con importaciones modulares y agregados del motor, sin un segundo modelo de edición. Cada gráfico requiere interacción por teclado, temas claro/oscuro, tamaño adaptable, resumen accesible, exportación y prueba de datos reales. Etiquetas/tooltips no deben interpretar HTML del CSV. No se ha añadido ECharts todavía.

## Orden de las siguientes entregas

1. Cerrar revisión de consulta avanzada y correcciones de exportación/pegado, sin fusionar automáticamente.
2. Revisar [rangos y edición masiva](evidence/csv-range-2026-10-21.md), implementados sobre el motor existente; completar transformaciones y cancelación. El riesgo principal sigue siendo aplicar cambios sobre otro alcance.
3. Revisar la exploración de columnas, frecuencias, duplicados, descriptivas y Pearson; completar exportación de informes, alcance por rango y localización de filas. Reutilizar el proceso de datos y paneles, sin mutaciones.
4. Prototipo de DuckDB aislado; integración solo después de demostrar seguridad, cancelación y compatibilidad. Complejidad alta; no sustituir el editor ni usar instalaciones del equipo del desarrollador como requisito del usuario.
5. Agrupaciones, pivots y cruces visuales sobre ese motor. Complejidad alta; conservar texto y cambios pendientes.
6. Los seis gráficos ECharts, gradualmente, con tablas accesibles y exportación. Complejidad media/alta; cantidades/resultados contrastados con fixtures.
7. Medir y comprobar los flujos completos, paquetes e instalación antes de publicar otra versión.

Cada entrega requiere pruebas específicas más regresión apropiada, PR revisable y evidencia del mismo commit. Compilar, ejecutar con Electron, ejecutar un paquete e instalar son comprobaciones distintas. El objetivo A–D permanece abierto hasta cubrir todos sus requisitos; no se declara equivalente a Modern CSV por añadir un panel.

## Referencias técnicas

- [DuckDB Node Neo](https://duckdb.org/docs/current/clients/node_neo/overview) y [seguridad de DuckDB](https://duckdb.org/docs/current/operations_manual/securing_duckdb/overview): candidatos por verificar dentro de la aplicación.
- [Importaciones de ECharts](https://echarts.apache.org/handbook/en/basics/import/): integración modular prevista, aún no implementada.
- [Modern CSV](https://www.moderncsv.com/documentation/): referencia funcional; su interfaz y código no se copian.
