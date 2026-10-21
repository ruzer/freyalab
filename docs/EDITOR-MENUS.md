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
| Cortar | Ctrl/⌘ + X; vista previa y confirmación; primero copia, después vacía; si falla la copia no modifica datos |
| Pegar | Ctrl/⌘ + V o menú; vista previa. Desde una sola celda, el bloque se extiende a la derecha/abajo dentro de la vista; en un rectángulo mayor, las dimensiones deben coincidir exactamente |
| Rellenar | Ctrl/⌘ + Intro o menú; introduce texto, incluso con saltos de línea, para todas las celdas |
| Vaciar | Supr/Retroceso o menú; conserva filas/columnas y vacía solo el rectángulo |
| Limpiar / reemplazar | Quitar espacios, mayúsculas, minúsculas o reemplazo literal, con vista previa sobre el rango |

La vista previa muestra el recuento completo de cambios y hasta ocho ejemplos, abreviados a 256 caracteres; no aplica cambios. Cambiar los valores exige una vista previa nueva. Cancelar o Escape cierra sin modificar el documento. El cálculo ya iniciado puede terminar en segundo plano; sus resultados se descartan. Aplicar usa un solo paso de deshacer/rehacer y la recuperación CSV existente. No modifica el archivo guardado hasta pulsar Guardar. Después de aplicar o cambiar la revisión/consulta se elimina el rectángulo para evitar reutilizar coordenadas de otra vista.

Filtrar u ordenar no cambia el orden físico. El rango congela la consulta y la revisión de la vista; el motor resuelve sus filas antes de editar. Una revisión obsoleta, bloque irregular, dimensiones excedidas, valor mayor de 1 MiB o cambio superior a 20 MiB de historial se rechaza íntegramente. No añade filas/columnas al pegar automáticamente. Ceros iniciales, identificadores largos, Unicode, comillas y campos multilínea siguen siendo texto. No se evalúan fórmulas ni se alteran mediante apóstrofos automáticos.

**Copiar como Markdown** usa el rectángulo activo con encabezados. **Exportar → Selección** conserva sus columnas y orden visible en CSV/TSV; Documento completo y Filas filtradas mantienen sus alcances anteriores. Copiar filas marcadas sin rectángulo usa el orden original del documento. El portapapeles nativo admite hasta 8 MiB por copia/pegado; para más datos, exporta. Las muestras siguen siendo de solo lectura y no permiten exportar/copiar selecciones como si fueran archivos completos.

Esta entrega admite un rectángulo continuo a la vez. Las estadísticas por columna conservan su alcance explícito; no se convierten automáticamente en estadísticas del rectángulo. La paleta de comandos, rangos discontinuos y las transformaciones de dividir/combinar/mover quedan pendientes.

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

El botón **Estadísticas** del CSV abre un panel de consulta. Elige **Todas las columnas** o **Columnas marcadas** y pulsa **Analizar**. Incluye todas las filas del documento, también las ocultas por búsqueda/filtros, y excluye encabezados. En archivos parciales, el panel indica **Solo muestra**: no son estadísticas globales.

Cada columna se identifica por número y nombre. Muestra celdas, vacíos, únicos, numéricos, suma, media, mínimo y máximo. Vacíos incluye espacios o campos ausentes; únicos distingue el texto exacto e incluye la cadena vacía. Los valores numéricos admiten punto decimal y notación exponencial; los enteros fuera del rango seguro de Number se excluyen del cálculo, conservándose como texto. Las agregaciones son aproximadas, no aritmética decimal exacta. Analizar no modifica datos, estado de guardado ni historial, e incluye cambios pendientes.

Un cambio del documento descarta resultados antiguos. El alcance y las columnas se fijan al iniciar; cambiar la selección requiere volver a analizar. **Cancelar análisis** descarta resultados y evita iniciar más columnas; la columna en curso puede terminar en segundo plano. Escape cierra el panel y devuelve foco al botón. El límite inicial es de 100 columnas por consulta, con rechazo explícito si se supera. Mediana, desviación, frecuencias, pivot y SQL siguen pendientes.

## Siguientes entregas propuestas

Mover filas/columnas y transponer tablas o selecciones se mantienen pendientes. No se presenta esta entrega como equivalente a todas las operaciones de Modern CSV. Referencia funcional: [Modern CSV](https://www.moderncsv.com/).
