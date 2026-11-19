# SIM-1b · Alcance y ADR 0021

Base: `main 23121eda41fb9380c533a25ef86723046b6d7639`, rama independiente `codex/sim-1b-barra-tabla`, worktree privado. La historia completa ya está en `docs/stories/historia-sim1-simplificar-flujos-diseno-para-codex.md`, copiada sin cambios en SIM-1g (SHA-256 `767ade59a0c705f37eab2d8e3ad805a402f44250dfe999a83d1f139e3e4dc446`).

## Cambio mínimo completo

Solo SIM-1b: hacer reconocibles los menús de la barra CSV y reunir allí las limpiezas ya disponibles. «Limpiar» y «Filas y columnas» conservan sus iconos y muestran texto; la adaptación al espacio oculta primero Filtrar, después Limpiar y por último Filas y columnas. La barra sigue en una fila a 1280 px, con sus nombres accesibles conservados cuando se oculta el texto.

Las seis limpiezas de columna se ofrecen al principio de Limpiar, en el orden de la historia, y nombran la columna de la celda activa. Sin celda activa se deshabilitan y explican «Elige una celda de la columna que quieres limpiar.». No se toma silenciosamente una columna marcada en el encabezado como sustituto de una celda activa. Se reutilizan los comandos, vistas previas, diálogos, confirmaciones, motivos de bloqueo y mutaciones actuales; no se añade otra implementación de limpieza.

Después se conservan las tres operaciones sobre filas marcadas, con exactamente su alcance actual: filas marcadas por número y columnas marcadas, o todas si no hay columnas marcadas. Transformar documento se coloca al final. Ir a la fila conserva nombre accesible y atajo, con el icono #; Buscar acción muestra el atajo de la plataforma en el botón y su título. Se reutiliza el contrato de atajos de la aplicación, no se detecta el sistema mediante un detector nuevo.

Fuera de alcance: SIM-1a y las otras partes de SIM-1, estructura del menú de columna, motor CSV, semántica de operaciones, guardado, exportación, límites, contratos IPC, ajustes, dependencias, CI y plazos. No se apila sobre SIM-1a; la publicación de esta entrega espera a que su PR esté abierto, según la coordinación autorizada. No se fusiona ni se actualiza la app instalada.

## Siete respuestas del ADR 0021

El ADR original es `docs/adr/0021-reuse-before-build.md` de LAB, decisión 3; se aplica su puerta de reutilización sin incorporar herramientas de desarrollo al producto.

1. **Does a tool already do this?** Sí. CsvTable ya tiene el registro de comandos, los menús de barra, los diálogos de limpieza y `controlHint`. Icon usa los recursos locales; el registro de comandos de Electron ya conoce los atajos de cada plataforma. No hace falta una biblioteca.
2. **Is there a skill we can reuse?** Sí. Se reutilizan el flujo TDD y la revisión de accesibilidad disponibles, y Ponytail para limitar el cambio a presentación y adaptación del destino de los comandos existentes. La prueba roja será sobre la interfaz real, no sobre una copia de sus funciones.
3. **Can it be integrated through CLI, API, or MCP?** Mediante las interfaces internas ya existentes del componente y sus comandos. No se añade CLI, IPC, MCP, acceso al sistema ni capacidad de red al producto.
4. **How mature, secure, and maintained is it (release cadence, maintainers, license)?** Se mantienen Svelte, los componentes y las dependencias fijadas del repositorio, con sus licencias actuales. No hay adopción nueva que requiera investigar mantenimiento externo. No cambia la interpretación de documentos ni la frontera de confianza.
5. **What maintenance cost does it add?** Etiquetas traducibles y una adaptación pequeña del destino de columna, compartiendo la ejecución de las acciones. Las pruebas conservan el alcance, las guardas y las aserciones de integridad existentes; no se crean registros duplicados ni detectores de plataforma.
6. **What is the minimum glue LAB must write?** En FreyaLab: texto visible, agrupación de las acciones actuales, destino explícito de columna activa y adaptación al espacio. Las pruebas nuevas comprueban comportamiento y geometría; las consumidoras solo cambian los nombres de navegación que esta entrega modifica.
7. **Does writing our own code add value?** Sí, esa adaptación conecta la barra con los comandos que ya funcionan y reduce el vocabulario oculto tras iconos. Sustituir menús, motor o componentes añadiría más código y riesgo sin resolver mejor este alcance.

## Pruebas y consumidores revisados

- `compact-toolbar.spec.ts`: una fila, acciones principales, menús y espacio ganado para filas. Se conserva esa conducta; «Limpiar datos» pasa a «Limpiar» y se amplía la comprobación del menú, sin borrar aserciones de datos.
- `panel.ts`, `ordering.spec.ts`, `structure.spec.ts`, `ui.spec.ts` y `large-search.spec.ts`: usan el nombre de Limpiar para navegar. Solo se ajustará ese nombre donde corresponda; se conservan las comprobaciones de transformaciones, guardado, muestra y límites.
- `commands.spec.ts` y `large-file.spec.ts`: ya cubren Buscar acción, Ir a la fila, teclado y foco. Se conservan y se añade la comprobación de la presentación del atajo de la plataforma.
- Las seis operaciones de columna se contrastarán con sus diálogos actuales y sus guardas. Las tres de filas se comprueban con una selección que deje filas y columnas fuera, para demostrar que no cambia su alcance.
- El rojo y las ocho capturas de antes se obtienen antes de cambiar la interfaz: es/en-XA, claro/oscuro, 1440×900 y 1280×720. La geometría espera el estado real del tema, las fuentes y el tamaño; no usa una pausa fija como sustituto.

Este documento registra preparación y alcance, no resultados: aún no se ejecutó el rojo de SIM-1b ni se modificó la interfaz. El informe final separará pruebas locales, CI y lo que quede pendiente.
