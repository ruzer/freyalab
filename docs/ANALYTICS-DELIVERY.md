# Evolución analítica de FreyaLab — seguimiento del objetivo

Estado al 21 de octubre de 2026. Este documento mantiene el objetivo completo A–D; una entrega parcial no lo cierra. Complementa la [auditoría y roadmap CSV](CSV-ADVANCED-ROADMAP.md), sin repetirlos. «Implementado en rama» significa código y pruebas de desarrollo, pendiente de revisión e integración; no capacidad del instalador alpha.1.

## A. Edición avanzada

| Requisito | Estado verificable | Pendiente / aceptación |
|---|---|---|
| Selección de rangos | Selección de filas individuales y columnas, sin rectángulos | Rango por ratón y teclado, también entre páginas virtualizadas; identidad estable al filtrar/ordenar |
| Edición masiva | Pegar bloques tabulares por la vista; limpieza sobre filas/columnas marcadas | Rellenar/cortar/borrar un rango como una operación; vista previa y rechazo íntegro ante límites |
| Filtros avanzados | Implementado en `codex/csv-advanced-editing`: Y/O, texto, vacíos, números exactos, fechas ISO y RE2 | Ver [guía](EDITOR-MENUS.md) y [evidencia](evidence/csv-query-2026-10-21.md); consultas inválidas no habilitan edición sobre una vista antigua |
| Ordenamiento múltiple | Implementado en la misma rama; tipos explícitos por criterio, empates estables | Es orden de vista; guardar mantiene orden original. No hay reordenación permanente asistida |
| Transformaciones | Quitar espacios, mayúsculas/minúsculas, duplicación de filas/columnas con deshacer | Vista previa, dividir/combinar, normalizar, eliminar duplicados, mover filas/columnas; progreso y cancelación según coste |
| Buscar/reemplazar | Búsqueda global, filtros por encabezado y reemplazo literal existente | Resaltado, alcance de rango y vista previa del reemplazo masivo |
| Herramientas contextuales | Barra y menú Operaciones específicos de CSV | Menú de clic derecho, atajos de operaciones y paleta reutilizando las mismas acciones |

## B. Estadísticas y exploración

| Requisito | Estado verificable | Pendiente / aceptación |
|---|---|---|
| Estadísticas descriptivas | Panel de todas/columnas marcadas del PR #8: conteo, vacíos, únicos, numéricos, suma, media, mínimo y máximo | Mediana y desviación con definición explícita de población/muestra; valores no numéricos excluidos de forma visible |
| Distribuciones | Pendiente | Agrupación numérica reproducible, límites/intervalos y alcance explícitos |
| Frecuencias | Pendiente | Tabla de frecuencias exactas, total y límites de resultados; exportación sin alterar el documento |
| Valores faltantes | Conteo de vacíos por columna | Exploración/localización de filas y definición de vacío distinta de cero |
| Duplicados | Conteo de únicos existente, sin identificación de duplicados | Claves configurables, grupos y filas identificadas, sin eliminación automática |
| Correlaciones | Pendiente | Columnas numéricas explícitas, observaciones emparejadas, faltantes y columnas constantes controlados; prueba con resultados conocidos |
| Análisis de columnas | Panel básico con índices para encabezados duplicados | Perfil de tipos propuestos, longitud, ejemplos y calidad; no convertir celdas automáticamente |

Las estadísticas numéricas actuales son aproximadas. Comparación/orden numérico exactos de esta entrega no convierten las agregaciones anteriores en aritmética exacta. Los resultados deben incluir revisión del documento y alcance completo/filtrado/selección/muestra; nunca atribuir a todo el archivo un cálculo de muestra.

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
2. Rangos y edición masiva: extender selección y acciones del motor existente; probar vistas ordenadas/filtradas, deshacer y recuperación. Complejidad media/alta, riesgo principal: aplicar cambios sobre filas ocultas.
3. Perfil de columnas, frecuencias, duplicados y descriptivas restantes; después correlaciones. Reutilizar el proceso de datos y paneles. Complejidad media; alcance/revisión visibles y ninguna mutación.
4. Prototipo de DuckDB aislado; integración solo después de demostrar seguridad, cancelación y compatibilidad. Complejidad alta; no sustituir el editor ni usar instalaciones del equipo del desarrollador como requisito del usuario.
5. Agrupaciones, pivots y cruces visuales sobre ese motor. Complejidad alta; conservar texto y cambios pendientes.
6. Los seis gráficos ECharts, gradualmente, con tablas accesibles y exportación. Complejidad media/alta; cantidades/resultados contrastados con fixtures.
7. Medir y comprobar los flujos completos, paquetes e instalación antes de publicar otra versión.

Cada entrega requiere pruebas específicas más regresión apropiada, PR revisable y evidencia del mismo commit. Compilar, ejecutar con Electron, ejecutar un paquete e instalar son comprobaciones distintas. El objetivo A–D permanece abierto hasta cubrir todos sus requisitos; no se declara equivalente a Modern CSV por añadir un panel.

## Referencias técnicas

- [DuckDB Node Neo](https://duckdb.org/docs/current/clients/node_neo/overview) y [seguridad de DuckDB](https://duckdb.org/docs/current/operations_manual/securing_duckdb/overview): candidatos por verificar dentro de la aplicación.
- [Importaciones de ECharts](https://echarts.apache.org/handbook/en/basics/import/): integración modular prevista, aún no implementada.
- [Modern CSV](https://www.moderncsv.com/documentation/): referencia funcional; su interfaz y código no se copian.
