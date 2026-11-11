# AN-1b · Alcance y reutilización

Base de alpha.4 `fb2c73c493842b1985647b63f6b6d4114471f910`. La historia AN-1 tiene SHA-256 `c38bf3d0f1b2983924ec328d1de5ef54ae31aa433650d3857cb3c960a2825d75`.

Se elimina el panel lateral y la vista «Resumen y gráfico» del documento CSV. Los accesos existentes abren la pestaña de análisis de AN-1a, en su sección correspondiente. La vista de tabla compartida conserva filtros, orden, marcas y rango. Los componentes de resultados y sus exportaciones se reutilizan.

Las pruebas observan las interfaces fijadas en la historia. El recorrido de Electron comprueba navegación, foco, permisos de edición, cancelación y resultados. Las unitarias conservan los contratos de pestañas y estado compartido. El inventario previo y posterior identifica cada caso por proyecto, archivo, suites y título.

La retirada prevista comprende 19 E2E de la disposición antigua y 16 unitarias de su ancho. Se reescriben cuatro casos de navegación y se añade uno de compatibilidad con perfiles anteriores. Las comprobaciones de datos se conservan. El propietario autoriza adaptar navegación e interfaz retirada en csv-summary, chart-fields, ui-u0, large-file y chart-review mediante el ayudante común, conservando las comprobaciones de datos, guardado, seguridad y límites. Los otros diez archivos de datos permanecen intactos. Ocho requieren aclarar accesos directos y aserciones de navegación retirada; search y commands se mantienen mediante el ayudante común.

El análisis solicitado desde CSV Texto utiliza el diálogo de cambio ya existente, antes de abrir la pestaña. La paleta de ese modo reutiliza CsvCommands y habilita únicamente el comando nativo de paleta, sin habilitar las demás operaciones de Tabla ni añadir canales. Los accesos por botón, paleta y pestaña comparten esa confirmación. Cancelar conserva el texto y no crea análisis.

## Siete respuestas del ADR 0021

El ADR original se encuentra en LAB, `docs/adr/0021-reuse-before-build.md`, decisión 3. Las preguntas se conservan en su idioma original.

1. **Does a tool already do this?** La pestaña, el almacén de vista y los componentes de AN-1a ya resuelven el análisis. Se conectan los accesos existentes.
2. **Is there a skill we can reuse?** Ponytail limita el cambio a la integración que falta. TDD utiliza los recorridos acordados en la historia. Las guías de accesibilidad y E2E se aplican al foco, las etiquetas y las esperas por estado.
3. **Can it be integrated through CLI, API, or MCP?** Los componentes reciben la vista compartida y ejecutan las operaciones ya tipadas del puente. Las herramientas de desarrollo se mantienen fuera de la aplicación.
4. **How mature, secure, and maintained is it (release cadence, maintainers, license)?** Se conservan las dependencias y licencias fijadas. Se mantienen el aislamiento de análisis y las validaciones actuales del proceso principal.
5. **What maintenance cost does it add?** Se retiran el panel, el estado persistente de su disposición y sus pruebas específicas. Se mantiene un único conjunto de componentes de análisis.
6. **What is the minimum glue LAB must write?** En FreyaLab basta dirigir cada comando a la sección y alcance existentes, conectar la exportación del resultado y adaptar los puntos de entrada de las pruebas.
7. **Does writing our own code add value?** La integración permite editar el CSV sin iniciar análisis y consultar los resultados en una pestaña a petición. No se añade un motor.

## Límites

AN-2, las recetas de proyecto y las funciones posteriores permanecen en sus historias. La retirada de la vista acoplada elimina la presentación simultánea de tabla y resultados, como declara AN-1. La comprobación de un perfil antiguo debe demostrar que se ignora su disposición sin perder preferencias ajenas.
