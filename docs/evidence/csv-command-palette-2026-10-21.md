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
- Capturas del diálogo revisadas en claro 1440×900 y oscuro 1280×800. La regresión completa conserva además los recorridos previos de botones, clic derecho, rangos, transformaciones, guardado y recuperación.

## Límites

No hay lenguaje natural, búsqueda difusa, rangos discontinuos ni operaciones nuevas del motor. La paleta descubre los asistentes existentes; no ejecuta automáticamente una transformación o consulta al escribir su nombre. La lectura con tecnologías de asistencia e instalación manual fuera de macOS ARM no se acreditan. El estado de cada PR y sus comprobaciones se verifica por commit; no se hereda CI de entregas anteriores.
