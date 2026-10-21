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

## Estadísticas por columna

El botón **Estadísticas** del CSV abre un panel de consulta. Elige **Todas las columnas** o **Columnas marcadas** y pulsa **Analizar**. Incluye todas las filas del documento, también las ocultas por búsqueda/filtros, y excluye encabezados. En archivos parciales, el panel indica **Solo muestra**: no son estadísticas globales.

Cada columna se identifica por número y nombre. Muestra celdas, vacíos, únicos, numéricos, suma, media, mínimo y máximo. Vacíos incluye espacios o campos ausentes; únicos distingue el texto exacto e incluye la cadena vacía. Los valores numéricos admiten punto decimal y notación exponencial; los enteros fuera del rango seguro de Number se excluyen del cálculo, conservándose como texto. Las agregaciones son aproximadas, no aritmética decimal exacta. Analizar no modifica datos, estado de guardado ni historial, e incluye cambios pendientes.

Un cambio del documento descarta resultados antiguos. El alcance y las columnas se fijan al iniciar; cambiar la selección requiere volver a analizar. **Cancelar análisis** descarta resultados y evita iniciar más columnas; la columna en curso puede terminar en segundo plano. Escape cierra el panel y devuelve foco al botón. El límite inicial es de 100 columnas por consulta, con rechazo explícito si se supera. Mediana, desviación, frecuencias, pivot y SQL siguen pendientes.

## Siguientes entregas propuestas

Mover filas/columnas y transponer tablas o selecciones se mantienen pendientes. No se presenta esta entrega como equivalente a todas las operaciones de Modern CSV. Referencia funcional: [Modern CSV](https://www.moderncsv.com/).
