# SIM-3a · Ordenar números como números

Base: `main@f227eba6d428f332fb80d61c4bb4acf70c54f2d9`, que incluye SIM-1h (#209). Rama y worktree independientes. La historia completa se conserva en [SIM-3](historia-sim3-resultados-correctos-diseno-para-codex.md), SHA-256 `5cb91ab53325d41d911668b9bb2bf3bcdc0740c6f1ca12ea17435f7f2b16c0a9`.

## «Hoy» comprobado antes del cambio

`CsvTable.svelte` conserva `numeric=false`, la casilla global en Filtrar y un único `sortBy` para encabezado, menú de columna y Filas y columnas. El perfil existente de Información clasifica números, identificadores con ceros iniciales, encabezados de identificador y enteros inseguros en `table-analysis.ts`. `profileOnly:true` reutiliza esa regla sin construir frecuencias ni calcular estadísticas. No se inicia al abrir el CSV.

## Cambio mínimo completo

Al pedir un orden, consultar únicamente el perfil de esa columna, con la revisión actual, mediante `analyzeColumn(...,profileOnly:true)` del puente existente. Usar el orden numérico existente solo para `kind=number`: la misma clasificación ya descarta los códigos con ceros iniciales y los enteros inseguros. No crear detector ni comparador nuevos. Aplicar las intenciones en su orden y descartar el trabajo de una revisión/documento que ya no siga vigente; cerrar el documento conserva la cancelación existente.

Retirar la casilla global y su estado. Conservar Numérico exacto en Consulta avanzada y las recetas de Proyecto. Archivos grandes conservan su rechazo actual sin solicitar perfiles. No cambiar valores, CSV, guardado, historial, motor, exportaciones, dependencias, límites, reintentos, workers ni CI.

El comparador numérico actual coloca vacíos y valores no numéricos al final tanto en ascendente como descendente, antes de aplicar el signo de dirección. Se conservará y verificará con datos reales. Solo cambia la elección del tipo en los controles sencillos.

## Siete respuestas del ADR 0021

1. **¿Una herramienta ya lo hace?** Sí: el perfil de `table-analysis.ts`, `analyzeColumn` con `profileOnly:true` y el comparador numérico exacto de las consultas ya existen. Se conectan, sin motor ni dependencia nuevos.
2. **¿Hay una skill reutilizable?** Se aplica el cambio mínimo completo y TDD con reproducción real. Son herramientas de desarrollo; ninguna entra en FreyaLab ni es necesaria para usarlo.
3. **¿CLI, API o MCP?** La API interna existente devuelve el perfil de una columna por id/revisión. No se añade IPC, servicio, CLI ni servidor. La UI llama al mismo `sortBy` desde sus tres entradas.
4. **¿Madurez, seguridad y mantenimiento?** Se mantienen las versiones, licencias y validaciones instaladas. El proceso tabular valida columna, revisión y solicitud; el perfil no convierte ni escribe el documento. No se añaden red, permisos o ejecución de datos.
5. **¿Coste de mantenimiento?** Se elimina el estado/casilla global. La clasificación conserva una única fuente y la consulta avanzada su decisión explícita. Se adaptan los consumidores del control retirado con los mismos datos y oráculos.
6. **¿Pegamento mínimo?** El adaptador asíncrono de `sortBy`, protección de respuesta obsoleta/cierre, textos explicativos y retirada del control. Reutilizar cancelación y consultas; no crear una capa analítica nueva ni analizar todas las columnas.
7. **¿Aporta valor código propio?** Evita que 100 se presente antes que 9 al pedir un orden de números y mantiene los códigos textuales. El código solo une capacidades ya probadas y explica lo que hace.

## Rojo y aceptación

- CSV pequeño: 100/18/9 ascienden a 9/18/100 y descienden a 100/18/9; vacíos al final; tipos del perfil existente.
- Códigos con ceros iniciales conservan orden textual y sus bytes. Incluir anchos distintos para distinguir ambos órdenes.
- Abrir no analiza; ordenar solicita únicamente la columna elegida y no construye frecuencias. Tres entradas usan la misma regla.
- La casilla global desaparece; la elección avanzada permanece y los archivos grandes no cambian.
- Respuestas tardías, revisión nueva, doble activación y cierre no aplican un orden a otro estado.
- Toda aserción de datos, guardado, selección, seguridad, precisión, estabilidad e historial continúa. Solo se retira la preparación del control desaparecido donde el orden automático sea equivalente; los casos que requieren forzar un identificador como número pasan a Consulta avanzada.
- Textos nuevos es/en/en-XA, teclado y capturas claro/oscuro a 1440×900 y 1280×720. Pruebas rojas antes de implementación; resultados y límites reales en la entrega.

PR en borrador con base main. SIM-3b y SIM-3e esperan las fusiones previas del propietario; no se fusiona, publica ni actualiza la app instalada.
