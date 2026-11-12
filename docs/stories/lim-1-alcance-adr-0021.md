# LIM-1 · Alcance y reutilización

Base `main 1191c20`: AN-2, «Distintos sin vacío» (#167), la decisión de filas cortas (#168) y TEN-1 (#169) ya están fusionados por el propietario. La historia `historia-lim1-vacios-ver-y-limpiar-diseno-para-codex.md` se conserva sin editar. Un PR en borrador, sin fusión, publicación ni actualización instalada.

## Cambio mínimo completo

Información muestra cantidad y porcentaje de vacíos y ofrece ver, rellenar o eliminar. Ver aplica un filtro de vista; las otras acciones activan la pestaña del CSV y abren su vista previa. Menú de cabecera y paleta comparten las mismas acciones. Los cambios de Texto sin confirmar pasan por el diálogo existente de Guardar / Descartar / Cancelar.

Se amplían `transformPreview` y `tableEdit` con tres operaciones `structure`: `fillEmpty`, `fillPrevious` y `deleteRowsWhere`. Las columnas son posiciones validadas; no se envían listas masivas de filas. El motor recorre el documento completo, no el orden ni los filtros de la vista. Conserva revisión, progreso, cancelación y un paso de deshacer.

El rango actual rellena ausentes, pero no activa la fidelidad léxica: guardar podría normalizar comillas. Estas operaciones reutilizan las mutaciones `cell` / `rows`, la verificación del original y el serializador de bytes que ya usa la columna calculada. La vista previa no cambia el estado; la fidelidad se registra solo al aplicar con éxito. No hay parser, motor ni canal nuevos.

Completar un ausente alarga únicamente su fila y solo hasta la columna pedida; los campos intermedios quedan vacíos y se avisan. El inverso conserva la longitud original. Antes de aplicar se comprueban los límites existentes de celdas, registro, archivo e historial; la recuperación conserva el mismo formato de fidelidad.

## Siete respuestas del ADR 0021

1. **Does a tool already do this?** Los filtros de vacíos, las transformaciones, el historial y `calculatedRecordBytes` ya resuelven las partes difíciles. Falta conectarlos a acciones específicas que no sobrescriban valores con contenido.
2. **Is there a skill we can reuse?** Se aplican cambio mínimo, pruebas por comportamiento y accesibilidad. Se reutilizan componentes y patrones locales de diálogos, progreso, foco y cancelación.
3. **Can it be integrated through CLI, API, or MCP?** Sí, por las operaciones tipadas `transformPreview`, `tableEdit` y `cancelAnalysis` ya presentes. No se añade CLI, MCP ni canal a la app.
4. **How mature, secure, and maintained is it (release cadence, maintainers, license)?** Se conservan exactamente las dependencias, versiones y licencias bloqueadas. Las solicitudes siguen validadas en Main, el proceso de datos conserva la tabla y el renderer solo recibe ejemplos y recuentos. Sin red ni cambio de permisos.
5. **What maintenance cost does it add?** Un plan de vacíos y su vista previa, más controles específicos dentro del diálogo de transformación y los puntos de entrada. No duplica el guardado, el análisis, el historial o la recuperación.
6. **What is the minimum glue LAB must write?** En FreyaLab, validar las tres operaciones, preparar mutaciones y recuentos, conectar acciones de Información/menú/paleta y representar la vista previa. LAB no se modifica.
7. **Does writing our own code add value?** Sí: aplica la intención concreta «solo vacíos», explica ausentes frente a espacios y permite deshacer. Reimplementar un motor de tablas o un serializador no aporta valor.

## Interfaces de prueba y aceptación

Las interfaces ya acordadas en la historia son los métodos públicos del motor (`transformPreview`, `edit`, `page`, `serialize`, `undo`, `snapshot`/`restore`) y los flujos reales de la app por su puente validado. Se usa el fixture literal de siete filas en `tests/fixtures/empty-values.csv`; los resultados esperados proceden de la historia, no del algoritmo.

Rojo primero por bloque: Información y filtro sin edición; relleno literal / anterior / filas cortas; eliminación cualquiera / todas; bytes y deshacer; cancelación, revisión, protección y modo Texto. Se comprueban BOM, CRLF, comillas opcionales, multilínea, Unicode e identificadores; una comprobación de guardado debe examinar el contenido ya aplicado, además del original todavía intacto.

Los diálogos actúan siempre sobre todo el documento y lo dicen. «Ver filas vacías» limpia los filtros anteriores para mostrar esa condición sobre la columna elegida. No incluye valores estadísticos de relleno, recetas, centinelas ni solo filas visibles. Sin dependencias ni cambios de CI o plazos.
