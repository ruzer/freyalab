# Edición con menús

Estas funciones se incorporan después de v0.1.0-alpha.1. No cambian los binarios de esa versión.

## Markdown

En **Editar** o **Dividido**, la barra ofrece **B**, **I**, código en línea, **Tarea**, **Tabla** y **Mermaid**. Selecciona texto antes de aplicar negrita, cursiva o código en línea. Los botones devuelven el foco al editor; cada acción se puede deshacer por separado.

**Insertar** incluye encabezado, lista con viñetas, cita, enlace y bloque de código. Tareas, tablas y Mermaid empiezan con ejemplos válidos que puedes modificar mientras ves el resultado. En un bloque de código, cambia `text` por el lenguaje, por ejemplo `python` o `javascript`, para resaltar la sintaxis. La barra ayuda a escribir Markdown y conserva el editor de texto; no es un editor visual de arrastrar elementos.

La vista previa oculta la barra. Los documentos de solo lectura desactivan sus acciones.

## CSV y TSV

Selecciona una fila pulsando su número. Ctrl/⌘ o Mayús añade o retira filas individuales; Mayús no selecciona un rango. Las casillas de encabezado seleccionan columnas.

En **Operaciones**:

- **Quitar espacios al inicio y final**, **Convertir a mayúsculas** y **Convertir a minúsculas**: actúan sobre las filas seleccionadas y las columnas marcadas. Sin columnas marcadas, actúan sobre todas las columnas de esas filas. No modifican encabezados ni celdas ausentes de filas irregulares. Sin filas seleccionadas están desactivadas.
- **Duplicar filas seleccionadas**: coloca cada copia inmediatamente después de su original en el documento. Conserva sus valores y asigna un identificador propio a cada copia. La ordenación de la vista puede situarlas de otra manera.
- **Duplicar columna seleccionada**: requiere exactamente una columna marcada. Añade la copia a su derecha, con el sufijo «(copia)». Cambiar el número de columnas, incluido deshacer/rehacer, restablece los filtros por columna, el orden y las columnas seleccionadas. La búsqueda global se conserva.

Las operaciones actúan por identidad de fila, también con filtros u ordenación activos; no modifican otras filas. Cada operación se deshace en un paso. Guardar sigue siendo una acción independiente y conserva el orden del documento. Los ceros iniciales no se convierten a números.

Cambiar mayúsculas/minúsculas usa las reglas Unicode del motor JavaScript, independientes de la configuración regional; por ejemplo `ß` pasa a `SS`. Para recuperar exactamente el original usa **Deshacer**, porque convertir después a minúsculas no revierte todos los cambios. La codificación elegida se comprueba antes de guardar y puede rechazar caracteres que no pueda representar.

Al pegar un bloque tabular, sus filas siguen el orden de la vista mostrada, también con búsqueda, filtros y ordenación. Las filas ocultas no se modifican y el orden original del documento se conserva. El bloque debe caber en las filas visibles de la vista y en las columnas existentes; si no cabe o la tabla cambió desde que se mostró, se rechaza completo, sin cambios parciales. El pegado se deshace en un paso y se incluye en la recuperación local.

Al exportar, **Documento completo** incluye todas las filas y columnas en el orden original, aunque haya búsqueda, filtros, orden o columnas marcadas. **Filas filtradas** exporta todas las columnas de las filas que coinciden, en el orden mostrado. Solo **Selección** limita la exportación a las filas y columnas marcadas; sin columnas marcadas incluye todas las columnas de esas filas. Exportar no guarda ni descarta los cambios pendientes.

Las muestras de archivos grandes siguen siendo de solo lectura. Se mantienen los límites de edición y del historial; un cambio que excede el presupuesto de deshacer se rechaza antes de aplicarse.

## Rangos de celdas CSV

Pulsa una celda y arrastra para seleccionar un rectángulo. Mayús + clic extiende desde la primera celda; Mayús + flechas permite hacerlo por teclado. Las flechas mueven el foco; Inicio/Fin van al extremo de la fila, Ctrl/⌘ + Inicio/Fin al extremo de la tabla, y Re Pág/Av Pág desplazan una pantalla. Ctrl/⌘ + A selecciona la tabla de la vista actual. La selección puede cruzar páginas virtualizadas sin cargar todo el documento en la ventana. Al arrastrar junto al borde se desplaza la tabla.

El pie indica filas, columnas y número de celdas. **Rango** y clic derecho ofrecen las mismas acciones. Mayús + F10 abre el menú desde el teclado; flechas, Inicio/Fin y Escape permiten recorrerlo y cerrarlo. La selección rectangular y la selección de filas son alcances distintos; elegir una fila o una columna termina el rectángulo. Las columnas marcadas para estadísticas se conservan al seleccionar/editar celdas, pero no restringen las operaciones del rectángulo.

| Acción | Acceso y comportamiento |
|---|---|
| Copiar | Ctrl/⌘ + C; TSV textual en el orden visible, sin encabezados |
| Cortar | Ctrl/⌘ + X; vista previa y confirmación; primero copia, después vacía; si falla la copia o se cancela antes del borrado no modifica datos |
| Pegar | Ctrl/⌘ + V o menú; vista previa. Desde una sola celda, el bloque se extiende a la derecha/abajo dentro de la vista; en un rectángulo mayor, las dimensiones deben coincidir exactamente |
| Rellenar | Ctrl/⌘ + Intro o menú; introduce texto, incluso con saltos de línea, para todas las celdas |
| Vaciar | Supr/Retroceso o menú; conserva filas/columnas y vacía solo el rectángulo |
| Limpiar / reemplazar | Quitar espacios, mayúsculas, minúsculas o reemplazo literal, con vista previa sobre el rango |

La vista previa muestra el recuento completo de cambios y hasta ocho ejemplos, abreviados a 256 caracteres; no aplica cambios. Cambiar los valores exige una vista previa nueva. **Cancelar preparación** interrumpe el cálculo en el proceso de datos y permite volver a preparar. Cancelar/Escape durante una vista previa la cierra y cancela su trabajo. Durante la aplicación solicita cancelación y espera el resultado real antes de cerrar: el cambio final es completo y, si ya se confirmó, se puede deshacer. En Cortar, cancelar mientras se copia impide el borrado posterior; la copia al portapapeles ya iniciada puede terminar. Si falla la copia, no se borra nada. Aplicar usa un solo paso de deshacer/rehacer y la recuperación CSV existente. No modifica el archivo guardado hasta pulsar Guardar. Después de aplicar o cambiar la revisión/consulta se elimina el rectángulo para evitar reutilizar coordenadas de otra vista.

Filtrar u ordenar no cambia el orden físico. El rango congela la consulta y la revisión de la vista; el motor resuelve sus filas antes de editar. Una revisión obsoleta, bloque irregular, dimensiones excedidas, valor mayor de 1 MiB o cambio superior a 20 MiB de historial se rechaza íntegramente. No añade filas/columnas al pegar automáticamente. Ceros iniciales, identificadores largos, Unicode, comillas y campos multilínea siguen siendo texto. No se evalúan fórmulas ni se alteran mediante apóstrofos automáticos.

**Copiar como Markdown** usa el rectángulo activo con encabezados. **Exportar → Selección** conserva sus columnas y orden visible en CSV/TSV; Documento completo y Filas filtradas mantienen sus alcances anteriores. Copiar filas marcadas sin rectángulo usa el orden original del documento. El portapapeles nativo admite hasta 8 MiB por copia/pegado; para más datos, exporta. Las muestras siguen siendo de solo lectura y no permiten exportar/copiar selecciones como si fueran archivos completos.

Esta entrega admite un rectángulo continuo a la vez. Las estadísticas por columna conservan su alcance explícito; no se convierten automáticamente en estadísticas del rectángulo. La paleta de comandos, rangos discontinuos y la ampliación de alcance de transformaciones quedan pendientes; dividir/combinar/mover se ofrecen en el diálogo Transformar documento, con los alcances documentados.

## Consulta avanzada CSV

**Consulta avanzada** abre un formulario de condiciones y criterios de orden. Añadir o cambiar campos no modifica la vista hasta pulsar **Aplicar consulta**. **Cancelar** o Escape descartan el borrador y devuelven el foco. Hay hasta 20 condiciones y 20 criterios; el panel se desplaza y los botones de aplicar/cancelar permanecen visibles.

- Texto: contiene, es igual, no es igual, empieza por y termina en. Por defecto no distingue mayúsculas; cada condición puede activarlo. La igualdad no quita espacios automáticamente.
- Vacíos: cadena vacía, espacios o campo ausente. «No está vacío» es su inverso.
- Números: mayor, mayor o igual, menor y menor o igual; usa punto decimal y admite exponentes. Compara con `decimal.js` conservando todos los dígitos, sin convertir el contenido ni perder ceros iniciales. Las celdas no numéricas no coinciden.
- Fechas: anterior, igual y posterior; solo AAAA-MM-DD válidas. No se adivina si `01/02/2026` es enero o febrero. Las fechas de celda con formato distinto no coinciden.
- Expresiones regulares: RE2 mediante `re2js`, sin referencias hacia atrás ni lookaround. Máximo 256 caracteres de patrón, 1,000 instrucciones compiladas y 65,536 caracteres por campo evaluado; exceder un límite rechaza la consulta, sin devolver silenciosamente un resultado incompleto.

Elige **Todas (Y)** o **Cualquier (O)** para combinar condiciones. La búsqueda global y los filtros de encabezado siguen aplicándose mediante Y. **Quitar filtros y orden** borra ambas búsquedas, condiciones y ordenaciones.

En **Orden por prioridad**, cada criterio elige columna, dirección y orden textual o **Numérico exacto**. Los no numéricos van al final en ambas direcciones. Los empates conservan el orden original del documento. También puedes usar Mayús + clic en un encabezado para añadir un criterio; un clic normal vuelve al orden de una sola columna. La casilla de la barra **Orden numérico** controla el orden simple y los criterios que añadas desde encabezados; en el formulario puedes elegir el tipo de cada criterio.

Ordenar y filtrar solo cambian la vista. Guardar conserva el orden original; exportar **Filas filtradas** respeta todos los criterios de orden. Pegado y selección mantienen la identidad de las filas mostradas, sin cambiar las ocultas. Cambiar la estructura de columnas, incluso al deshacer, restablece la consulta para no aplicarla sobre otra columna por accidente.

Una consulta inválida muestra un mensaje y conserva la última vista válida. La edición queda bloqueada hasta corregir/limpiar la consulta y cargar un resultado válido; **Reintentar consulta** permite repetirla. No se pierde el documento ni su historial. Las reglas no se guardan dentro del CSV. Las muestras siguen identificadas como parciales.

## Estadísticas por columna

El botón **Estadísticas** del CSV abre un panel de consulta con cuatro alcances:

- **Todas las columnas:** todas las filas del documento, incluidas las ocultas por búsqueda/filtros; excluye encabezados.
- **Columnas marcadas:** las columnas elegidas con sus casillas y todas las filas del documento.
- **Celdas del rango:** un único resumen del rectángulo seleccionado en la vista capturada, respetando sus filtros y orden. No incluye filas ocultas.
- **Rango por columnas:** un resumen independiente por cada columna de ese rectángulo, con las mismas filas capturadas.

En archivos parciales, el panel y cada resultado indican **Solo muestra / muestra limitada**: no son estadísticas globales. La selección de filas y columnas se fija al iniciar; la revisión y el alcance aparecen en el resultado. Cambiar la selección usada o editar datos descarta resultados y exige analizar de nuevo. Desplazar la grilla o cambiar el tema conserva un resultado válido. Si se pierde el rango o la vista queda inválida, Analizar se deshabilita sin ampliar silenciosamente el alcance.

Muestra celdas, vacíos, únicos, numéricos, suma, media, extremos, mediana, desviaciones poblacional (n) y muestral (n−1), ausentes, solo espacios y excluidos. La desviación muestral requiere dos números; para una columna constante la poblacional es cero. **—** indica datos insuficientes o no representables. La ayuda «Cómo interpretar los resultados» mantiene las aclaraciones fuera de la barra. La primera columna permanece visible al desplazar horizontalmente el resumen; el espacio del resultado del rango permanece estable para editar celdas con doble clic.

Vacíos incluye campos ausentes o con espacios; únicos compara texto exacto y agrupa un campo ausente con la cadena vacía, como el resumen anterior. Ausentes y Solo espacios son subconjuntos de Vacíos. Excluidos cuenta textos no numéricos y enteros fuera del rango numérico seguro. Los valores admiten punto decimal/notación exponencial; se conservan como texto y no se redondean identificadores grandes dentro del CSV. Los cálculos son aproximados, compartidos con el perfil de columna; no aritmética decimal exacta. Analizar incluye datos pendientes y no cambia datos, guardado, recuperación ni historial.

**Cancelar análisis** interrumpe la recogida entre bloques, descarta resultados y evita iniciar la siguiente columna. Los cálculos síncronos de la biblioteca pueden terminar antes de descartarse. Escape cierra y devuelve el foco al botón. Las consultas antiguas del pie siguen funcionando y no cancelan la petición del panel.

Límites: 100 resultados por consulta visual; Celdas del rango puede resumir más de 100 columnas en un solo resultado. Cada resumen admite hasta dos millones de celdas lógicas, incluidos campos ausentes: superar el límite se rechaza sin devolver totales parciales. El resumen no incorpora el límite de 100 000 valores distintos del explorador de frecuencias. Se mantienen los límites del editor y de sus muestras. Pivot y SQL se abren en Análisis.

## Siguientes entregas propuestas

Mover filas/columnas está incluido en la entrega de orden. Transponer tablas o selecciones y exportar informes de estadísticas permanecen pendientes. No se presenta esta entrega como equivalente a todas las operaciones de Modern CSV. Referencia funcional: [Modern CSV](https://www.moderncsv.com/).


## Explorar columnas CSV

Abre **Estadísticas → Explorar una columna: frecuencias, calidad y distribución**. Elige columna y alcance (documento completo o vista filtrada) y pulsa **Explorar columna**. Los encabezados repetidos se distinguen por número. «Volver a estadísticas generales» recupera el panel anterior; cerrar/cambiar de documento cancela la exploración.

- **Perfil:** conteos, calidad, ceros iniciales, longitudes, suma/media/mediana/extremos y desviación poblacional (divisor n) o muestral (n−1, requiere al menos dos números).
- **Frecuencias:** 50 valores por página, recuento, porcentaje sobre las filas analizadas y primera fila original sin encabezado. Los empates mantienen orden de primera aparición original. «Solo valores repetidos» limita la lista, sin cambiar los totales del perfil. Un grupo repetido tiene más de una fila; «repeticiones adicionales» excluye una fila de cada grupo.
- **Distribución:** intervalos numéricos de igual amplitud; incluye el límite inferior y excluye el superior, salvo el último, que incluye el máximo. Una columna constante tiene un intervalo. Cambiar el número de intervalos exige volver a explorar.
- **Correlación:** elige la segunda columna y vuelve a explorar. Pearson usa pares numéricos de la misma fila; muestra cuántos se excluyeron. Menos de dos pares, columnas constantes o resultados no representables muestran «—» con explicación.

Las operaciones no cambian celdas, filtros, orden, historial ni archivo. Los datos pendientes de guardar sí se incluyen. Cambiar datos/filtros/opciones borra el resultado anterior; el desplazamiento de la tabla lo conserva. Una muestra siempre se identifica, incluso al elegir todo su contenido.

Límites: 100 000 valores distintos por exploración; superar ese límite devuelve un error completo y pide filtrar, sin presentar resultados parciales como totales. Las frecuencias comparan el texto completo exacto y distinguen mayúsculas, espacios y ceros. Las vistas previas de valores largos muestran solo las primeras 256 unidades UTF-16, indicadas explícitamente. Vacíos incluye campos vacíos, ausentes o solo espacios; cero no es vacío. La lista de faltantes muestra hasta 20 números de fila original. Las longitudes se miden en unidades UTF-16 del texto sin recortar.

Los cálculos numéricos son aproximados, con punto decimal. Se excluyen texto, fechas y enteros fuera del rango numérico seguro; el perfil muestra las exclusiones y posibles ceros iniciales. Nada se convierte al guardar. Cancelar detiene la recogida entre bloques y descarta resultados tardíos; los cálculos matemáticos síncronos terminan antes de descartarse. Esta exploración no añade gráficos; SQL y tablas dinámicas tienen un panel independiente descrito abajo. Exportar estos análisis como informe y explorar claves compuestas quedan pendientes.


## Análisis SQL, agrupaciones, tablas dinámicas y cruces

Desde un CSV/TSV, **Análisis** abre DuckDB local de solo lectura. Funciona sin DuckDB instalado ni conexión a Internet. Elige **Asistentes** para agrupar, pivotar o cruzar; prepara SQL visible y pulsa **Ejecutar consulta** (Ctrl/⌘ + Enter). Preparar no ejecuta ni modifica el archivo. Escape cierra el panel y devuelve el foco. Estadísticas y Análisis comparten el espacio contextual.

- **Agrupar:** selecciona una columna y contar, sumar o promediar. Para números eliges columna y 0–12 decimales explícitos; valores no convertibles se omiten y el asistente de agrupación cuenta las omisiones. La conversión puede redondear a esos decimales; AVG usa aritmética aproximada de DuckDB. No cambia el CSV.
- **Tabla dinámica:** columna de filas, columna de categorías y hasta 20 categorías escritas, una por línea. Las demás categorías no aparecen. Elige contar/sumar/promediar. No se infieren categorías ni tipos.
- **Cruzar:** en «Archivos y nombres para SQL», marca hasta tres CSV adicionales abiertos. Elige archivo y claves, y conservar filas sin coincidencia (LEFT) o solo coincidencias (INNER). Las claves se comparan como texto exacto; las vacías/ausentes no coinciden. Repetidas pueden multiplicar filas.
- **SQL directo:** la tabla principal se llama `datos`; las adicionales, `tabla_2` a `tabla_4`, en orden de selección. Consulta el mapa de columnas: encabezados vacíos, repetidos o de más de 128 unidades UTF-16 reciben nombres SQL inequívocos. Los encabezados originales siguen intactos. Se acepta una sola consulta que pueda usarse como relación, incluidas CTE y PIVOT; no comandos de escritura, configuración ni extensiones.

Para documentos editables analiza todos los registros, incluidos cambios pendientes, sin aplicar los filtros ni la ordenación de la tabla. Todas las columnas entran como texto; `00123`, identificadores largos, fechas y fórmulas siguen siendo texto. Campo ausente es NULL, celda vacía es `''`. Los resultados muestran tipo SQL y valores exactos convertidos por DuckDB a texto; no se redondean BIGINT/DECIMAL mediante JavaScript.

Si el editor muestra una **muestra**, Análisis vuelve a leer el archivo completo en segundo plano, con la codificación/delimitador/encabezados elegidos. Verifica estructura y cambios externos; ante error no entrega un resultado parcial como completo. El editor sigue mostrando su muestra de 200 registros y no se habilita el guardado. Los resultados identifican cada fuente, revisión, filas completas y lectura desde disco.

Límites iniciales: hasta cuatro fuentes; 256 MiB físicos y de texto decodificado por fuente; dos millones de filas, 200 columnas y registros de 1 MiB; ocho millones de celdas entre todas las fuentes. Se rechazan límites o estructura incompatibles, sin truncar la fuente. Resultado: primeras 10 000 filas, hasta 200 columnas y 8 MiB de texto; páginas de 100. La marca «Vista parcial del resultado» se refiere solo al resultado conservado. Añade ORDER BY si necesitas un orden reproducible.

Cancelar o cerrar destruye el proceso de consulta; el límite de tiempo es de dos minutos. Una edición/cambio de fuentes invalida los resultados; hay que volver a ejecutar. El borrador SQL y las fuentes elegidas se conservan durante la sesión al cerrar/reabrir el panel, sin guardarse como archivo. Una fuente cerrada exige revisar la selección; no se sustituye por otro archivo.

No hay acceso SQL a archivos arbitrarios, red ni extensiones. Si la app se inicia con `--no-sandbox`, SQL se rechaza; no desactives las protecciones para usarlo. DuckDB se ejecuta en WebAssembly en una ventana Chromium aislada, sin Node ni el puente de FreyaLab. Se limita su gestor de memoria a 384 MB; esto **no** limita la RAM total de Electron. No hay análisis de GB ni exportación del resultado SQL en esta entrega. [Arquitectura, mediciones y comprobaciones](evidence/duckdb-wasm-2026-10-21.md).


## Gráficos CSV

La entrega de desarrollo añade **Gráficos** junto a Análisis/Estadísticas. Incluye histogramas, barras, líneas, dispersión, mapa de calor y cajas con selectores, tabla accesible y exportación. Consulta [métodos, alcance y límites](CHARTS.md); no se presenta como función publicada en alpha.1.


## Transformar el documento CSV

**Operaciones → Transformar documento…**, menú contextual del rango o Ctrl/⌘ + Mayús + T desde la tabla. Divide/combina columnas conservando originales, elimina duplicados por claves compuestas, normaliza Unicode/encabezados, mueve filas/columnas y fija el orden de la vista en el documento. Los movimientos usan destinos originales; tras aplicar limpian filtros/orden de vista. Guardar sigue siendo independiente. [Alcance completo, vista previa, cancelación, límites y deshacer](TRANSFORMS.md). Entrega de desarrollo; no función publicada en alpha.1.
