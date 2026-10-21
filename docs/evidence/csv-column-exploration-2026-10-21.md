# Exploración de columnas CSV — 21 de octubre de 2026

Implementación de desarrollo en `codex/csv-column-exploration`, sobre la integración del PR #11. No prueba los binarios publicados de alpha.1 ni cierra el objetivo A–D.

## Alcance y reutilización

El panel de Estadísticas conserva su vista básica y abre una exploración contextual de una columna. Se reutilizan el mismo documento/revisión, consulta paginada, proceso tabular, validación IPC y temas. No se añade otro modelo de edición. Biblioteca incorporada: [`simple-statistics` 7.12.1](https://www.npmjs.com/package/simple-statistics/v/7.12.1), licencia ISC, sin dependencias transitivas nuevas; fuente y licencia inspeccionadas en el paquete fijado. Se usa para suma/media/extremos/mediana/desviaciones/Pearson/intervalos, en el proceso de datos. Avisos de 302 instalaciones de dependencias de producción generados.

Los resultados de solo lectura incluyen documento completo o vista filtrada, revisión y marca de muestra. El perfil diferencia vacíos, campos ausentes, solo espacios, valores numéricos utilizables, exclusiones y ceros iniciales. Frecuencias exactas y grupos repetidos; distribución tabular en intervalos de igual amplitud; Pearson entre dos columnas con pares/omisiones. No hay inferencia ni conversión de celdas.

## Verificación

- `npm run check`: cero errores y advertencias con Node 24.22.0.
- `npm test`: **53 pruebas**, siete archivos. Seis casos nuevos cubren datos estadísticos conocidos, valores originales, orden/filtros/encabezados, texto largo con prefijos iguales, vacíos/espacios/ausentes, constantes, muestras, fórmulas como texto, cancelación, revisiones obsoletas y límite de cardinalidad.
- `npm run test:e2e`: **35 pruebas** en Electron 44.9.2/macOS ARM, **44,4 s**, incluidos los flujos previos de guardado/recuperación/exportación/seguridad. Tras ajustar rótulos de muestra y estabilizar capturas se repitieron los dos casos nuevos; también se verificó que una celda con aspecto de SVG/evento se presenta como texto, sin insertar nodos SVG ni ejecutar su contenido.
- `npm run build`: ejecutado por la suite E2E; no equivale a empaquetar o instalar.
- `npm run licenses`: avisos generados con textos de licencia incluidos.

Una primera ejecución encontró que recargar una página virtual invalidaba la exploración. Se corrigió el origen: solo datos, filtros u opciones invalidan; el estado transitorio de carga visual no forma parte del alcance. Se verificaron paginación de frecuencias, cancelación, muestra rotulada, rechazo de IPC inválido, conservación del estado de guardado y escape con retorno del foco.

Capturas inspeccionadas en claro/oscuro a 1440×900 y claro a 1280×800. Se desactivan las transiciones solo al capturar, para evitar mezclar colores de dos temas:

- [Oscuro](csv-column-exploration-dark-1440x900.png).
- [Claro](csv-column-exploration-light-1440x900.png).
- [Claro 1280×800](csv-column-exploration-light-1280x800.png).

## Medición sintética local

[Datos y entorno completos](csv-column-profile-2026-10-21.json). Apple M2 Max, 12 núcleos lógicos, 32 GiB RAM, macOS ARM, Electron 44.9.2/Node 24.22.0. Una ejecución por tamaño, en máquina compartida, con archivos de **una columna**, hasta 1 000 valores distintos repetidos. No son percentiles ni garantías universales; el primer caso también paga inicialización del proceso CSV.

| Filas × columnas | Apertura | Exploración completa |
|---|---:|---:|
| 100 × 1 | 116,9 ms | 3,3 ms |
| 3 000 × 1 | 21,1 ms | 3,7 ms |
| 100 000 × 1 | 75,7 ms | 23,7 ms |
| 1 000 000 × 1 | 517,1 ms | 192,0 ms |

Se verificaron recuentos, distintos, totales de intervalos y documento sin modificaciones. Para reproducir los datos: columna `Valor`, valores 0–99 en el caso de 100 filas y secuencia 0–999 repetida hasta alcanzar los otros tamaños; sin filtros ni segunda columna. Los tiempos incluyen IPC y retorno de los agregados; no el dibujo completo del panel. En el caso de un millón, temporizador de 20 ms en el renderer: nueve intervalos, separación máxima 21,3 ms. La memoria registrada es el conjunto de trabajo **después de cerrar** cada documento, sin forzar recolección ni medir el pico: proceso CSV de aproximadamente 74,7 a 345,3 MiB. No representa el consumo total de la aplicación ni prueba archivos arbitrarios o un millón de filas con cuatro columnas (ese caso corresponde al motor analítico pendiente).

## Límites y trabajo pendiente

- Máximo **100 000 valores distintos** por exploración, con error explícito al superarlo; no se publican totales parciales. Frecuencias: 50 valores por página, vistas previas de 256 unidades UTF-16 indicadas; la comparación usa el valor completo.
- Hasta 20 filas originales con vacíos enumeradas. Duplicados por una columna de texto exacto, incluidos vacíos; no claves compuestas ni eliminación automática.
- Descriptivas aproximadas. Enteros fuera del rango seguro excluidos. Longitudes en unidades UTF-16. Pearson sin coeficiente cuando faltan pares, hay columnas constantes o problemas de representación numérica.
- Cancelación cooperativa entre bloques; operaciones matemáticas/sort síncronas no se interrumpen a mitad. Sus resultados se descartan si cambian datos o solicitud. La memoria de agregación no se comparte con la interfaz.
- La exploración de una muestra describe solo sus registros leídos. Se conservan los límites generales de 50 MiB/dos millones de celdas; esta medición no los amplía.
- Pendientes: informe exportable, alcance por rango, navegación completa de faltantes, claves compuestas, motor DuckDB, pivots y gráficos ECharts. No se han añadido herramientas CLI al producto.
- La evidencia local no sustituye la CI del PR/commit de `main`. Paquetes, instalación, lectores de pantalla y mediciones de pico/p95 en otros sistemas pendientes para esta entrega. No se fusiona ni publica automáticamente.
