# Paleta de comandos CSV

Entrega de desarrollo del 21 de octubre de 2026 (México). No publica una versión ni cierra A–D.

## Implementación y alcance

Comandos, junto a Operaciones, y Ctrl/⌘ + K abren un diálogo nativo buscable. Usa Svelte y HTML existentes; no añade dependencias, IPC, motor, CLI ni formatos de recuperación. Un registro local de 30 acciones reúne funciones y disponibilidad de herramientas de vista, análisis, edición, selección y rangos. Botones, menú del rango y atajos invocan esas mismas funciones; las opciones de filas/columnas comparten también los bloqueos del registro.

La búsqueda solo compara nombres/descripciones por palabras, sin distinguir acentos ni mayúsculas. No ejecuta SQL, toca el CSV ni cambia la búsqueda tabular. Se conserva la selección; Escape/× devuelve el foco al origen o a Comandos si desapareció. Enter desde el buscador usa el primer resultado habilitado; listas vacías o totalmente deshabilitadas no ejecutan acciones. El diálogo usa controles nativos y permite flechas, Tab, Home/End en la lista y Escape, sin crear un widget ARIA propio.

Los cambios conservan vistas previas, revisión, historial y recuperación del motor. Transformar abre su asistente existente; la operación específica se elige allí. Análisis/Estadísticas/Gráficos alternan los paneles existentes. En muestras no se habilitan edición ni copia tabular; la paleta muestra el contexto. La copia Markdown también refleja en su botón las restricciones que el motor ya imponía. Cargar una página bloquea temporalmente las operaciones del rango y repara el foco si un comando se deshabilita; no bloquea abrir Transformar.

## Pruebas locales

- Tipos/Svelte sin errores ni advertencias; 123 unitarias y 74 pruebas Electron pasaron sin reintentos, incluida compilación de producción (2,4 minutos observados en este equipo, no garantía universal). CI, paquete e instalación del commit exacto se registran por separado en el PR.
- Cuatro casos nuevos de Electron: buscar sin acentos y ejecutar desde teclado sobre un rango, cancelar sin modificar y aplicar/deshacer con valores originales; acciones estructurales habilitadas por marcas de fila/columna y restauración de foco, consulta avanzada y búsqueda vacía; muestra con edición/copia bloqueadas y análisis disponible, claro/oscuro; paginación observada con MutationObserver, copia de rango deshabilitada, Transformar disponible y foco dentro del diálogo.
- La prueba de Escape desde el buscador falló inicialmente; el diálogo ahora atiende Escape explícitamente antes de la acción nativa del campo de búsqueda. Las cuatro regresiones pasan, incluido cierre desde el buscador y retorno de foco.
- Los originales CSV se comparan después de comandos/undo; permanecen sin guardar ni modificar. La fixture de muestra se amplía por truncado para forzar solo lectura, sin presentarla como evidencia de análisis completo de un CSV válido.
- Capturas finales del diálogo revisadas en claro 1440×900 y oscuro 1280×800. Se ajustó el salto de línea de las descripciones largas; una aserción de scrollWidth/clientWidth comprueba que la lista no desborde horizontalmente en ambos temas. La regresión completa conserva además los recorridos previos de botones, clic derecho, rangos, transformaciones, guardado y recuperación.

## Comprobación de disponibilidad del diálogo de relleno

En el paquete Intel de la CI del PR anterior (#24, commit cbf553f), la primera prueba de cancelación pasó al reintentar: la espera de Valor del rango agotó 30 segundos porque no apareció Rellenar rango. El fallo ocurrió antes de solicitar cancelación. El código de la tabla rechaza abrir la acción de rango mientras carga; el registro no captura el valor de busy en el instante del atajo, por lo que esa temporización es una inferencia, no un dato observado en el trace.

El helper de prueba ahora espera que Rellenar rango esté habilitado después de seleccionar, antes de pulsar el atajo. No amplía tiempos ni elimina aserciones o reintentos; hace explícita la precondición de interacción. Las comprobaciones de cancelación, originales y recuperación permanecen iguales. Cinco repeticiones locales del caso con esa precondición pasaron sin reintentos. La evidencia de la nueva CI se registra aparte, sin presentar la CI anterior como libre de reintentos.

## Límites

No hay lenguaje natural, búsqueda difusa, rangos discontinuos ni operaciones nuevas del motor. La paleta descubre los asistentes existentes; no ejecuta automáticamente una transformación o consulta al escribir su nombre. La lectura con tecnologías de asistencia e instalación manual fuera de macOS ARM no se acreditan. El estado de cada PR y sus comprobaciones se verifica por commit; no se hereda CI de entregas anteriores.
