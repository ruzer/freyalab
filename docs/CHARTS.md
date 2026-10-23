# Gráficos del editor CSV

Entrega de desarrollo sobre los PR #13/#14; no es una función publicada en alpha.1. Abre un CSV y pulsa **Gráficos**. El panel empieza con **Barras → Conteo de filas**. Elige **Agrupar por** para la categoría del eje X y pulsa **Generar gráfico**. Para calcular sobre una columna, elige el cálculo y **Valor**, indicando **Número para calcular** cuando corresponda. No necesitas escribir SQL. La consulta reproducible está en «Consulta y precisión del gráfico».

El panel reutiliza DuckDB-Wasm y el puente de análisis existentes; no incorpora otro modelo de edición ni permisos de archivos. Apache ECharts **6.1.0**, Apache-2.0, dibuja con SVG y carga al abrir el panel mediante importación diferida. Se registran solo las series/componentes utilizados, con avisos en `THIRD_PARTY_NOTICES.txt`.

## Datos, alcance y límites

- Elige **Documento completo** (incluye cambios pendientes y filas ocultas por filtros) o **Vista filtrada actual** (búsqueda/filtros combinados sobre todas las coincidencias, no solo la página visible). El orden se elige en el gráfico; no se hereda el de la tabla. Una muestra solo permite analizar el archivo completo desde disco; su vista filtrada se rechaza, sin presentar una muestra como total.
- Se mantienen los límites del análisis: 256 MiB por fuente, dos millones de filas, 200 columnas y ocho millones de celdas. No promete archivos de GB.
- Las agregaciones se calculan antes de limitar los elementos dibujados. Barras: primeras 100 categorías o combinaciones categoría/serie; cajas: primeras 100 categorías; mapa: primeros 400 pares; líneas sin agrupar/dispersión: primeras 2 000 observaciones; líneas temporales: primeros 2 000 pares periodo/serie, incluyendo huecos de calendario. No es muestreo aleatorio. La vista parcial se identifica tanto en el panel como dentro de SVG/PNG/PDF. Histograma: de 1 a 30 intervalos.
- El motor transfiere solamente el resultado acotado, paginado de 100 en 100, a la interfaz. La tabla alternativa muestra páginas de 50; tiene todos los elementos dibujados y valores originales de categoría, incluso si las etiquetas del eje se abrevian.
- Números aproximados con punto decimal y exponente opcional. Se excluyen vacíos, texto no numérico, infinitos y magnitudes superiores a 9 007 199 254 740 991. Las conversiones afectan exclusivamente al análisis. Por ejemplo `0005` puede ser una medida numérica si el usuario elige esa columna; su contenido CSV sigue siendo `0005`. Los identificadores grandes permanecen como texto en el editor.
- Las categorías se agrupan por texto completo exacto; vacío y campo ausente son distintos. Su índice en el eje evita confundir categorías con etiquetas visualmente parecidas.

## Los seis tipos

| Tipo | Cálculo y orden |
|---|---|
| Histograma | Intervalos de igual amplitud `[desde, hasta)`, último cerrado; recuentos incluyen todos los numéricos utilizables. Una constante produce un intervalo. |
| Barras | Categoría elegida; conteo de filas, valores únicos, suma, promedio, mínimo, máximo o mediana. Texto/identificador solo admite los dos primeros; los demás requieren una medida declarada numérica. Valores únicos incluye cadena vacía y excluye campos ausentes. Orden explícito ascendente/descendente por resultado, empate por categoría. Las categorías sin medida utilizable conservan NULL; no se inventa un cero. |
| Líneas | Sin agrupar fechas: X e Y explícitamente numéricas, orden X ascendente/descendente y orden relativo de la fuente analizada en empates. X inválidas se omiten; Y inválidas dejan un hueco (`connectNulls: false`). No infiere fechas. Con agrupación temporal se aplica DW-02b, descrito abajo. |
| Dispersión | Pares numéricos de la misma fila; orden X y fila original, con recuentos de exclusión y límite de puntos explícitos. |
| Mapa de calor | Conteo de cada par de categorías exactas. Las combinaciones ausentes quedan sin celda; no se imputan ceros. Escala visible y tabla alternativa. |
| Caja | Por categoría: cuartiles `quantile_cont` (Hyndman–Fan tipo 7); bigotes hasta observaciones dentro de 1,5 × RIC; conteo exacto de atípicos. Dibuja hasta los primeros 20 atípicos por categoría, orden numérico, y lo informa. |

## Interacción y exportación

Los selectores, botones de tamaño, exportación y tabla alternativa admiten teclado. Escape desde el panel lo cierra y devuelve el foco a **Gráficos**. La región ampliada se puede desplazar con teclado. El tamaño responde al panel y el tema cambia sin recalcular los datos. La descripción accesible se complementa con la tabla; no se ha certificado con lectores de pantalla.

**Exportar gráfico SVG/PNG/PDF** reutiliza la exportación aislada y saneada existente, con escritura segura y rechazo de destinos que sean documentos abiertos. Exporta el dibujo actual y sus recuentos/límites; no exporta el CSV ni guarda cambios pendientes. El SVG incorpora las fuentes locales Inter y JetBrains Mono; PNG y PDF usan ese mismo dibujo para conservar la tipografía. La imagen también puede exportarse cuando el editor abre el CSV como muestra: el gráfico se calcula sobre la fuente completa, dentro de los límites de análisis. La muestra de la tabla no se convierte en un documento completo; Guardar y exportar el CSV/TSV siguen bloqueados. Una vista limitada de puntos o categorías mantiene su aviso dentro de la imagen.

La exportación guarda una instantánea del dibujo mostrado; no vuelve a leer el CSV ni recalcula el análisis. Si la revisión de la sesión cambia mientras se elige el destino o se genera el archivo, se rechaza la exportación y se pide generar de nuevo el gráfico.

Cambiar columnas/opciones, editar el documento o cambiar los filtros de un gráfico de vista filtrada invalida el resultado. Desplazar/paginar visualmente la tabla no invalida por sí solo sus datos. Un cambio externo en disco también lo invalida. Cancelar destruye el proceso SQL y descarta respuestas antiguas; cerrar el panel cancela su solicitud y libera el dibujo y observadores. Se conserva el límite de dos minutos y las protecciones de DuckDB: sin red/disco mediante SQL, extensiones ni configuración modificable. Los atípicos usan funciones del núcleo; no se habilita la extensión JSON.

Las etiquetas del archivo no se insertan como HTML. ECharts usa SVG y tooltips de texto (`richText`); la tabla usa texto escapado de Svelte. Las imágenes exportadas pasan por el saneador SVG y ventana aislada existentes.

## Verificación

- `tests/charts.test.ts`: opciones/identificadores, recuentos, vacío frente a muestra limitada, huecos en líneas, series de caja, datos ausentes de mapa y tooltip sin HTML.
- `tests/e2e/charts.spec.ts`: seis consultas reales DuckDB con resultados conocidos; seis SVG en la interfaz, temas, teclado, PNG con píxeles de dibujo y PDF, invalidación por edición, cancelación, datos vacíos/constantes, etiquetas hostiles, paginación/límite de puntos y un millón de filas con muestra de 200 en el editor. Comprueba que el CSV original permanece intacto.
- `tests/graphic-export.test.ts`: el guardián original de muestras sigue rechazando todos los formatos del documento; la operación gráfica no serializa la tabla y protege revisión, tipo de fuente, cancelación y destinos.
- La suite E2E añade un CSV válido mayor de 50 MiB con 2 400 filas: exporta tres formatos, conserva un gráfico parcial de 2 000 puntos, rechaza peticiones tabulares/HTML/revisiones antiguas y comprueba SHA-256 y estado del original.
- La CI ejecuta la suite y después vuelve a ejecutar SQL/gráficos desde la app empaquetada en macOS ARM/Intel, Windows y Ubuntu. No equivale a probar instaladores manualmente.

Referencias: [importaciones modulares ECharts](https://echarts.apache.org/handbook/en/basics/import/), [accesibilidad ECharts](https://echarts.apache.org/handbook/en/best-practices/aria/), [cuantiles DuckDB](https://duckdb.org/docs/stable/sql/functions/aggregates.html#quantile_contx-pos).

## DW-01 y evolución

El título y los ejes explican, por ejemplo, **Suma de Total MXN por Ciudad**. El alcance aparece tanto en pantalla como en las imágenes exportadas. El modo avanzado conserva la consulta reproducible; no es necesario usarlo para crear gráficos. Si no hay valores numéricos utilizables, se pide cambiar de columna o contar filas/valores únicos. No se modifica el archivo original ni su historial.

Consulta [evidencia de DW-01](evidence/visual-chart-builder-2026-10-22.md) y el [objetivo actualizado DW-01 a DW-10](WORKSPACE-EVOLUTION.md). Las series categóricas llegan en DW-02a, descritas abajo. La agrupación temporal llega en DW-02b, descrita abajo. Los filtros propios llegan en DW-02c, descritos abajo. Persistencia, exportación tabular agregada y sugerencias locales siguen pendientes.

Al cambiar una medida ya elegida, se restablece Texto/identificador y conteo: el tipo no se hereda a otra columna. Si cambia la lista de encabezados, el constructor se reinicia y cancela su cálculo anterior. No intenta reutilizar una configuración por índice sobre otras columnas.


## DW-02a — separar por color

En Barras, Líneas o Dispersión, **Separar por color** permite elegir una columna categórica o dejar **Sin series**. Por ejemplo: «Suma de Total por Ciudad, separado por Producto». Se usa texto exacto; `001`, `1`, un identificador largo, vacío y ausente siguen siendo categorías distintas. Los números del CSV no se modifican.

- Barras: cada combinación categoría/serie tiene su propio cálculo (los siete cálculos existentes). Las combinaciones sin observaciones quedan sin barra, sin imputar cero. Con series, el orden se elige por categoría textual A–Z/Z–A; dentro de cada categoría, series en orden textual. Sin series se conserva el orden por resultado.
- Líneas y dispersión: una serie por categoría, sin agrupar ni agregar observaciones. X numérica y orden de la fuente para empates; los huecos de Y en líneas se conservan. Este es el modo sin agrupar fechas; DW-02b agrega el modo temporal descrito debajo.
- Máximo ocho categorías de serie en la fuente analizada, contando vacío y ausente. Si se supera, se rechaza el gráfico con ayuda para elegir otra columna o limitar la vista filtrada. No se eligen automáticamente ocho ni se descartan las demás.
- Los límites totales de dibujo se conservan: 100 pares en barras y 2 000 observaciones en líneas/dispersión, no por serie. El panel informa cuántas series aparecen respecto al total. Un gráfico parcial puede dejar series sin representar: mantiene el aviso parcial y todos los agregados se calculan antes del límite.
- La leyenda nativa de ECharts muestra/oculta series. «Series visibles · controles de teclado» ofrece casillas sincronizadas. Ocultar un color solo cambia el dibujo; no filtra la fuente, no recalcula totales y no elimina filas de la tabla accesible. La imagen exportada incluye un aviso cuando hay series ocultas.
- Cambiar opciones, encabezados, datos o filtros del alcance filtrado invalida el resultado y restablece la visibilidad. Cambiar de tema conserva la visibilidad actual; cambiar a un tipo que no admite series elimina esa elección.

Reutiliza la [leyenda](https://apache.github.io/echarts-handbook/en/concepts/legend/) y los [eventos](https://apache.github.io/echarts-handbook/en/concepts/event/) de ECharts. Sin dependencias, IPC ni motores adicionales. [Evidencia de DW-02a](evidence/chart-category-series-2026-10-22.md).


## DW-02b — agrupar por día, mes o año

En **Barras** o **Líneas**, elige **Agrupar fechas → Día / Mes / Año**, la columna de fecha y el cálculo. **Sin agrupar fechas** conserva el comportamiento anterior. La descripción muestra, por ejemplo, «Suma de Total por mes de Fecha, separado por Tipo». Los siete cálculos y el tipo explícito Texto/identificador o Número se reutilizan también para líneas temporales. Conteo no requiere elegir una medida numérica.

- Fechas de calendario `AAAA-MM-DD`, de `0001-01-01` a `9999-12-31`. Se ignoran espacios exteriores; no se adivina día/mes ni se recortan horas o zonas horarias. Fechas imposibles, vacías, ausentes, año cero, timestamps y otros formatos se omiten y cuentan explícitamente.
- DuckDB usa `TRY_CAST(... AS DATE)`, `date_trunc` y `strftime`. Los periodos son etiquetas ISO, sin conversiones de zona horaria del navegador. El CSV conserva sus textos, filas irregulares, codificación y delimitador.
- Barras muestra los periodos con registros. Líneas construye los intervalos regulares entre el primero y el último periodo de la fuente elegida. Un intervalo o combinación sin observaciones tiene `NULL`, sin inventar un cero. Los agregados sin medidas utilizables también conservan `NULL`; el conteo de únicos puede ser cero cuando solo hay valores ausentes.
- Los huecos cortan la línea (`connectNulls: false`). Por eso dos puntos separados por un mes sin observaciones aparecen separados, sin un segmento que invente continuidad. La tabla accesible incluye esos periodos como «—».
- Orden explícito del periodo más antiguo o más reciente primero. El alcance completo/filtrado, series categóricas (máximo ocho), invalidación y cancelación son los existentes.
- El total de elementos de una línea es el número de periodos del rango multiplicado por las series, incluyendo huecos; no representa filas del CSV. Se dibujan como máximo 2 000 elementos totales. El calendario intermedio genera como máximo 2 001 periodos y nueve categorías candidatas; el recuento real de categorías decide el rechazo al superar ocho. No se materializan millones de días ni su cruce con miles de categorías para mostrar el error.
- Un rango truncado mantiene aviso de vista parcial y recuento de elementos, tanto en pantalla como en la imagen. Los agregados se calculan antes del límite. Elegir el orden más reciente permite explorar el otro extremo; la vista filtrada puede reducir el rango.
- La ausencia de fechas válidas tiene un mensaje propio y no habilita exportar un gráfico vacío como resultado correcto. Fechas descartadas aparecen también en la descripción accesible y SVG/PNG/PDF.

Sin nuevas dependencias, motor ni cambios del guardado/recuperación. Reutiliza las [funciones de fecha de DuckDB](https://duckdb.org/docs/current/sql/functions/date) y el renderer ECharts existente. [Evidencia de DW-02b](evidence/chart-time-groups-2026-10-22.md).


## DW-02c — filtros propios del gráfico

**Filtros del gráfico** abre el mismo editor de condiciones de la tabla, sin los controles de orden. Elige columna, operador y valor; combina mediante **Todas (Y)** o **Cualquier (O)** y pulsa **Aplicar filtros del gráfico**. Texto, números, fechas y regex conservan la semántica y los límites del motor tabular existente. No necesitas SQL. **Quitar filtros del gráfico** elimina solo este grupo.

- El alcance se elige primero: documento completo o vista filtrada de la tabla. Después se aplica el grupo propio, antes del cálculo/agrupación en DuckDB. Si ambos grupos usan O, el resultado es `(grupo de tabla) Y (grupo de gráfico)`, sin mezclar todas las condiciones en un solo O.
- No modifica búsqueda, filtros, orden, selección, historial ni archivo original de la tabla. Los recuentos del gráfico corresponden a las coincidencias de su fuente, no al total original.
- Abrir/editar un borrador no altera un gráfico válido; Cancelar o Escape lo descarta. Aplicar/quitar filtros invalida el resultado y requiere generar de nuevo. Escape cierra solo el editor activo y devuelve foco al botón de filtros; otro Escape desde el gráfico conserva el comportamiento de cerrar el panel.
- Los nombres accesibles del editor reutilizado son únicos por instancia. La tabla puede tener abierta su consulta avanzada sin que el editor del gráfico la cierre o confunda encabezados.
- El panel muestra cantidad/modo de condiciones y un detalle legible de las reglas. SVG/PNG/PDF y la descripción accesible incluyen el alcance y la cantidad/modo de filtros propios. El informe SQL conserva las condiciones adicionales estructuradas/descritas cuando su fuente las tiene.
- Un CSV abierto como muestra permite aplicar filtros propios sobre **el archivo original completo leído desde disco**, dentro del presupuesto vigente. Esto no filtra solamente las 200 filas de la muestra ni habilita guardarla/exportarla como CSV completo. La vista filtrada de la tabla de muestra sigue rechazada.
- El filtrado reutiliza `compileTableQuery` en el proceso tabular antes de enviar coincidencias por Arrow. DuckDB sigue haciendo agregaciones/estadísticas; no hay otro motor ni SQL construido con los valores del formulario.
- Toda fila leída se valida y cuenta para los límites antes de descartarla: estructura, 1 MiB por registro, 256 MiB decodificados, dos millones de filas y ocho millones de celdas por fuente. Filtrar todo no permite eludir límites ni ocultar registros malformados. El recorrido cede el control para cancelar aunque no haya coincidencias.
- Máximo veinte condiciones propias, además del grupo existente de tabla. Comparaciones numéricas explícitas usan el decimal del motor tabular; texto sigue siendo texto (por ejemplo `001` y `1`). Fechas de filtro ISO y expresiones RE2 con los límites existentes. Errores no vuelven silenciosamente al documento sin filtros.

Los filtros son de filas de origen, no condiciones sobre un agregado ya calculado. Todavía no se guardan configuraciones al cerrar el panel/cambiar de archivo (DW-03); un cambio de encabezados reinicia el constructor para evitar aplicar índices a otras columnas. [Evidencia de DW-02c](evidence/chart-local-filters-2026-10-22.md).


## DW-03a — configuraciones reutilizables

Abre **Configuraciones guardadas**, escribe un nombre y pulsa **Guardar configuración**. Para recuperarla, elígela y pulsa **Aplicar configuración**; después **Generar gráfico** calcula sobre los datos actuales. Los controles admiten clics y teclado. La biblioteca permanece entre reinicios y puede reutilizarse en otros documentos con las mismas columnas.

- Guarda tipo, ejes, medida, cálculo, intervalos, orden, series, agrupación temporal y filtros propios. No guarda filas, resultados ni cambios del CSV.
- Si guardas **Vista filtrada actual**, captura la búsqueda y los filtros de tabla. Al recuperar aparece **Filtros de tabla guardados**, con sus condiciones consultables. Cambiar los filtros actuales del editor no sustituye esa captura ni modifica el gráfico recuperado; puedes elegir explícitamente **Documento completo** o **Vista filtrada actual** para cambiar el alcance.
- La página visible y el orden de la tabla no forman parte de la captura; las agregaciones usan todas las coincidencias y el orden elegido en el gráfico.
- Los nombres, posiciones y cantidad de encabezados deben coincidir exactamente. Una columna renombrada, movida o eliminada bloquea Aplicar, conservando la configuración original. Encabezados vacíos o duplicados requieren reconocer expresamente que sus posiciones corresponden; no se remapean automáticamente.
- Las configuraciones de vista filtrada no pueden aplicarse a muestras. Las del documento completo pueden analizar desde disco, manteniendo todos los límites y avisos existentes. Aplicar no inicia consultas ni cambia los filtros de la tabla.
- Biblioteca local `chart-presets.json`, dentro de los datos de usuario de Electron, separada del CSV. Contiene encabezados y valores de filtros: conserva este archivo como información local propia. Sin sincronización ni cuenta.
- Hasta 50 configuraciones, nombres de 80 caracteres y biblioteca de 8 MiB. Un nombre existente se rechaza para conservar ambos análisis; guarda los cambios con otro nombre. **Eliminar configuración elegida** elimina solamente esa entrada.
- Escrituras serializadas mediante el guardado atómico existente, con comprobación de hash al reemplazar. Esquema versionado, validación de opciones/columnas/condiciones y tres operaciones limitadas del puente; no se exponen rutas de archivos. Una biblioteca dañada, ilegible o de versión futura produce un mensaje y se conserva sin sobrescribir.

La exportación de resultados agregados CSV/JSON/Markdown es la siguiente subentrega DW-03b; SVG/PNG/PDF siguen disponibles. No hay nuevas dependencias ni cambios del modelo textual, historial o recuperación de CSV.
