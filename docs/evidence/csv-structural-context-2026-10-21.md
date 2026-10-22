# Menús contextuales estructurales CSV

Entrega de desarrollo del 21 de octubre de 2026 (México). No publica una versión nueva ni cierra A–D.

## Alcance y reutilización

El menú existente se amplía a números de fila y encabezados de columna, por clic derecho o Mayús + F10. Comparte registro de acciones, disponibilidad y funciones con Comandos y botones; conserva marcas múltiples si se abre dentro de ellas y sustituye por el elemento indicado si se abre fuera. La selección rectangular pasa a selección estructural, sin cambiar datos. El menú de celdas mantiene su comportamiento de rango. Escape restaura foco al origen o a Comandos si ese control desapareció al virtualizar/desplazarse.

Incluye inserción relativa, duplicar/eliminar, limpieza de filas, copiar Markdown, asistente Transformar e historial. Orden ascendente/descendente de columna sustituye los criterios de vista, con el tipo elegido por Orden numérico; no fija el orden del documento. Muestras bloquean edición/copia y conservan sus operaciones de vista. Los filtros y entradas de encabezado no se interceptan como menús estructurales.

Para insertar antes de una fila se amplía insertRow con beforeId, alternativo a afterId. IPC y motor rechazan ambas referencias simultáneas; antes se valida como texto no vacío. El motor busca la identidad de la fila en el documento, no la posición filtrada/ordenada. Reutiliza presupuesto de celdas, mismas acciones de historial/recuperación, serialización y guardado; no añade formatos o dependencias. Izquierda/derecha usa insertColumn existente. Las nuevas acciones se ofrecen también en la paleta con sus condiciones de selección única.

## Pruebas

- 125 unitarias pasaron, incluidas dos nuevas: inserción bajo vista filtrada/ordenada, antes de primera/después de última, snapshot/restauración/deshacer, originales y cadenas con ceros/identificadores largos; rechazo de referencias ambiguas/vacías/inexistentes sin cambio de estado.
- Tipos/Svelte sin errores ni advertencias. La cabecera con interacción es enfocada por sus controles y conserva tabindex −1 en el contenedor, sin añadir un paso extra de Tab.
- Cuatro regresiones Electron: filas con filtro/orden y marcas múltiples; columnas con teclado, inserción a ambos lados, orden de vista, valores y marcas; muestras/temas/foco; origen desmontado por virtualización y validación IPC. Comparan los originales y no convierten valores.
- Regresión completa local: 78 pruebas Electron pasaron sin reintentos, incluida compilación de producción (2,5 minutos observados en este equipo; no garantía universal). CI, paquete e instalación del commit exacto se registran por separado en el PR. La CI incorpora los cuatro casos al recorrido de paquetes.
- Capturas de los menús en claro 1440×900 y oscuro 1280×800, para revisar distribución y bloqueos.

## Precondición de la prueba de teclado de la paleta

En Windows del paquete del PR anterior (#25, commit 6b94281), una prueba pasó al reintentar tras fallar el foco de Mayúsculas en el rango después de ArrowDown. La prueba esperaba que existiera un resultado, pero no que estuviera habilitado; la paleta excluye los comandos deshabilitados durante una carga. El registro no captura busy/disabled en el instante de pulsar; esa temporización es una inferencia, no una observación del trace. El paso ahora espera disponibilidad y dirige la tecla al buscador antes de comprobar el foco. No aumenta tiempos ni elimina la aserción de foco. Cinco repeticiones locales pasaron sin reintentos; la nueva CI se evalúa por separado.

## Límites

Inserciones relativas requieren una sola fila o columna marcada; duplicar/eliminar filas conserva alcance múltiple. Las filas nuevas vacías pueden no aparecer con un filtro activo. No se añade reordenación gráfica por arrastre; mover sigue en Transformar con sus alcances. El guardado es independiente; un cambio de anchura restablece filtros por columna/orden como antes. No se acredita lector de pantalla ni instalación manual fuera de macOS ARM.
