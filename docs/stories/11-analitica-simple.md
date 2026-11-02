# Historia 11 · Analítica CSV simple (estantes)

Estado: propuesta de Claude para decisión del propietario. Sin código.

## Problema
`CsvCharts.svelte` obliga a rellenar unos 12 selectores (alcance, tipo, fechas, X, Y, intervalos, tipo de medida, cálculo, color, orden, filtros) y a saber qué combinación es válida. Resumen, Gráficos y SQL son tres pestañas sin relación entre sí.

## Principio
No se cambia el motor. `ChartOptions` + `chartSQL` (DuckDB) + ECharts, sus límites, la exportación y la tabla alternativa se conservan. Solo cambia **cómo se rellena** `ChartOptions`. Cero dependencias nuevas (ADR 0021).

## Arquitectura (3 capas)
1. **Inferencia** (`src/shared/chart-suggest.ts`, función pura, sin Svelte): `suggest(columns, shelves) → {options, reason, alternatives}`.
   Reglas: fecha+número → líneas con agrupación mensual; texto+número → barras (suma); texto solo → barras con conteo; número solo → histograma; número+número → dispersión; texto+texto → mapa de calor; texto+número con >1 valor por grupo y petición «distribución» → caja. Tipo de columna: reutiliza `COLUMN-PROFILES`. Una entrada ambigua devuelve la opción más segura más `alternatives`, nunca falla en silencio.
2. **Estado de estantes** (`src/renderer/lib/shelves.ts`): `{x?, y?, color?, filtros[]}` → `ChartOptions` mediante `suggest`. Es la única fuente de verdad; guardable como preset (reutiliza `ChartPresets`).
3. **Interfaz** (`ChartShelves.svelte`): lista de columnas con insignia de tipo; zonas Eje X, Eje Y (o «Valor»), Color, Filtro. Arrastrar y soltar **y** alternativa por teclado/clic (menú «Añadir a…») — misma acción, mismo resultado. Barra «Gráfico sugerido: Barras ▾» para cambiar tipo. «Más opciones» contiene los controles actuales (intervalos, orden, tipo de medida, alcance) sin quitar ninguno.

## Fases (un PR pequeño cada una, la prueba falla primero)
- **F1 Inferencia pura** + pruebas de tabla de reglas (todas las combinaciones, vacíos, ambigüedad). Sin interfaz.
- **F2 Estantes con clic/teclado** (sin arrastrar) detrás del panel actual como modo «Simple»; el formulario actual queda como «Avanzado». E2E: cada tipo se obtiene con 1–2 acciones.
- **F3 Arrastrar y soltar** sobre las mismas acciones (Pointer Events, sin librería). E2E con teclado y con ratón.
- **F4 Unificar el dock**: «Resumen» ofrece «Graficar esta columna» y «SQL» recibe «Ver como SQL» del gráfico (transparencia, aprendizaje). Decidir con datos si se fusionan pestañas.
- **F5 Retirar «Avanzado» solo si** las métricas/uso lo permiten (decisión del propietario).

## Criterios de aceptación
- Un gráfico de barras, línea o histograma en ≤2 acciones desde un CSV recién abierto, sin abrir «Más opciones».
- Toda acción por arrastre tiene equivalente por teclado y se anuncia (aria-live): «Columna Ventas añadida al eje Y».
- El resultado es **idéntico** al del formulario actual con las mismas opciones (prueba de equivalencia sobre `chartSQL`).
- Límites, cancelación, exportación SVG/PNG/PDF, tabla alternativa y saneado sin cambios.
- Textos es/en (I18N), temas claro/oscuro, ventana estrecha.
- Nunca se envía contenido del CSV fuera del proceso; sin red.

## Fuera de alcance
Tableros guardados, nuevos tipos de gráfico, nuevo motor, edición de datos, librerías de BI (Perspective, Graphic Walker, Vega-Lite) salvo prototipo desechable aprobado.

## Riesgos
- Inferencia que sorprende → siempre mostrar el porqué y alternativas.
- Arrastrar es inaccesible → F2 garantiza la ruta sin arrastre antes de F3.
- Regresión del formulario → equivalencia probada y modo «Avanzado» hasta F5.

## Actualización aprobada: F2a «Resumen y gráfico»

El propietario sustituyó la F2 de estantes por el modelo de tabla dinámica de Excel y aprobó el boceto #105 con ajustes. El contrato vigente y sus nueve decisiones están en [Historia 11 · F2](11-analitica-excel-f2.md#decisiones-aprobadas-para-f2a--2026-11-01). F1 permanece intacta como motor de inferencia.

F2a incorpora únicamente la pestaña hermana de Tabla/Texto, disposición de resultado primero, resumen tabular, vista previa desde el formulario existente, seis tipos y motivo de suggest(). Campos/zonas y conversión son F2b; Pointer Events es F2c. Las referencias visuales no son código de la aplicación. Detenerse tras cada entrega para revisión; no fusionar automáticamente.
