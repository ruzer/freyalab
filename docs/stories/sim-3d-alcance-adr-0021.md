# SIM‑3d · Cifras y textos para estudiantes · Alcance y ADR 0021

Base de preparación `f227`, rama `codex/sim-3d-cifras-textos`. Se aplica únicamente [SIM‑3d y las reglas comunes](historia-sim3-resultados-correctos-diseno-para-codex.md). Este documento precede a las nuevas pruebas y a los cambios de interfaz. No acredita todavía rojo, verde, capturas o CI de esta entrega.

## Comportamiento y reutilización

En Más estadísticas se sustituirá el formato local de doce cifras significativas por `formatNumber(value,{maximumFractionDigits:2})`, el mismo que ya usa `CsvStatistics`. Son **hasta dos decimales**, con punto decimal, sin redondear el resultado almacenado ni los valores originales. Perfil, Frecuencias y Distribución conservarán el valor completo calculado en `title` mediante `String(value)`; null seguirá como «—». Correlación comparte hoy el mismo formateador: se propone mantener también allí la regla común de dos decimales, conservando su valor completo. El cálculo, las peticiones y los informes no cambian. «Completo» significa la representación del resultado numérico existente, no precisión matemática infinita.

La línea de alcance mostrará nombre, ámbito y filas, sin «revisión» ni ordinal innecesario. Los índices que desambiguan las opciones de columna y las revisiones internas permanecen. La frase breve será «Solo lectura: tu archivo no cambia.»; la explicación actual de vacíos, límites, precisión y cancelación pasa a un `details` nativo «Cómo se calcula», cerrado inicialmente. Los avisos reales de error, muestra o cobertura parcial permanecen visibles.

Se catalogará «Unificar letras con acento (NFC)» sin cambiar la operación `normalize` ni su algoritmo. Las claves `charts.trend.memory`, `sql.ui.memory` y `sql.ui.sourceMemory` perderán la revisión visible, conservando nombre y filas donde existen. Esto se resuelve en catálogos: no cambia la revisión enviada, las invalidaciones, el motor, los informes ni las ramas de disco/memoria/muestra/conjunto.

`empty.error.undoLimit` explicará que el cambio era demasiado grande para poder deshacerlo, no se aplicó y el documento no cambió. La lectura actual de `table-engine.ts` confirma que `emptyPlan` rechaza el presupuesto antes de que `edit` llegue a `commitChange`. La unitaria funcional existente de `tests/table-empty.test.ts`, «rechaza valores, registros escapados, codificación e historial que no caben, antes de modificar», comprueba rechazo de la vista previa por `undoLimit` y snapshot intacto. Es comprobable en el runner nativo de unitarias; **no se ejecutó aquí ni se atribuye un nuevo verde**. El rechazo de aplicación puede comprobarse por la misma ruta sin modificar el límite ni el motor.

## Copia exacta: decisión pendiente

No existe copia exacta por valor en `CsvColumnAnalysis` ni en `CsvStatistics`: este último conserva el valor en `title`, pero la selección de texto renderizado se copia literalmente mediante Edición→Copiar o el atajo nativo. Tras redondear, esa ruta copiaría el texto redondeado. Title e informe completo no prueban el requisito «al copiar».

La consulta asíncrona al propietario sigue pendiente. No se implementará ninguna parte dependiente de esa respuesta. La propuesta acotada es conservar la ruta nativa y decidir si una selección completa de un solo valor numérico debe copiar `String(resultado)` mediante el evento local `copy`; las selecciones parciales, múltiples y porcentajes necesitan una regla explícita. No se añade API genérica, IPC, botón, permiso de portapapeles ni interceptación global. Tampoco se presenta la copia redondeada como cumplimiento del contrato exacto. La decisión y su prueba real se incorporarán antes de desarrollar ese bloque.

## Motivos conocidos y coordinación de archivos

Limpiar ▾ **ya** muestra `charts.toolbar.columnRequired` cuando falta la celda de columna; se reutiliza esa razón de B y sus guardas. No se añade el comportamiento fuera de alcance de tomar una columna marcada por casilla. Las acciones de filas que necesitan marcas recibirán el motivo concreto correspondiente; el fallback será «Esta acción no está disponible con la selección actual.». Readonly, protección y ocupado conservan prioridad.

`CsvTable.svelte` no se editará en este carril hasta que SIM‑3a y SIM‑3c estén fusionados y se incorpore main normalmente. La propuesta privada de motivos utiliza únicamente `CsvCommand.disabledReason`, que ya existe, y el patrón de descripción accesible de sus otros consumidores. No duplica selección, operaciones ni validación. Se coordinará además con la serie 3a→3b→3e.

Fuente propia prevista: `CsvColumnAnalysis.svelte`, el texto puntual de `CsvTransform.svelte`, catálogos es/en y, si conserva una frase contradictoria de «contexto», el estado de `CsvCommands.svelte`. `CsvStatistics` se toma como referencia. App, Tree y style pertenecen a 3c y quedan fuera. Las claves compartidas se integrarán por bloque para no pisar el trabajo de otras partes. En‑XA se genera del inglés existente; no hay tercer catálogo.

No se retira una ruta de `pending-files.json` por cambiar unas frases. ColumnAnalysis, Transform y Commands conservan textos heredados; sus helpers también tienen explicaciones anteriores. Solo se retirará un archivo si su migración completa queda demostrada por inventario y guard. No se amplía este alcance a traducir motores o informes para justificar esa retirada.

## Pruebas primero y límites

La roja de formato debe alcanzar el componente real: Perfil con fracciones visibles, Frecuencias con porcentaje fraccionario y Distribución con límites fraccionarios. Después comprobará como máximo dos decimales, `title` completo, datos y disco intactos. Una prueba pura de `formatNumber` fija el contrato del helper, pero ya puede pasar en la base y **no sustituye** la roja del wiring. Se reutilizan fixtures y helpers existentes antes de crear otro CSV.

`descriptive-percentiles.spec.ts` contiene expectativas del formato anterior en Perfil: se adaptará solo esa presentación conservando los mismos valores, datos crudos, informe y archivo original. Las pruebas de informes conservan `String(value)` y ausencia de mutación. Ninguna prueba se propone borrar en esta preparación.

Los textos nuevos se comprobarán en es, en y en‑XA; habrá teclado para el detalle nativo, ámbitos reales y prueba de revisión interna conservada. El rechazo undoLimit y los motivos conocidos tendrán oráculos del estado sin modificación. La prueba de copia usará la ruta nativa y el portapapeles real únicamente tras resolver su semántica; no un mock que esconda el valor copiado.

Raíz ejecuta la GUI y conserva rojo antes de producto. Se requieren capturas claro/oscuro, es/en‑XA y 1440×900/1280×720. Después se comprobarán consumidores y las suites correspondientes; al cierre de integración, tipos, unitarias completas, E2E completa y build según CONTRIBUTING. El PR documentará el SHA, omisiones, reintentos y límites reales, y la CI de tres plataformas con duración de ambas partes Windows. Sin dependencias nuevas, cambios de plazos/retries, mezcla de verdes entre SHAs, fusiones o actualización de la app instalada.

## Siete respuestas del ADR 0021 · decisión 3

1. **Does a tool already do this?** Sí: `formatNumber`/Intl, `t`/plural, title, `details`/`summary`, `CsvCommand.disabledReason` y los informes existentes. Se reutilizan y configuran esas piezas; no se crea otro formato ni un sistema de menús o cifras.
2. **Is there a skill we can reuse?** Se reutilizan el flujo rojo→cambio mínimo→verde y los helpers de Playwright/Electron para teclado, datos y geometría. Las herramientas de desarrollo no entran en el producto ni se vuelven dependencias de ejecución.
3. **Can it be integrated through CLI, API, or MCP?** Bastan los datos, callbacks y elementos DOM actuales. No hace falta otro IPC, CLI, API o MCP. La copia pendiente, si se aprueba, se limita a la interacción nativa y al componente, sin acceso genérico al sistema.
4. **How mature, secure, and maintained is it (release cadence, maintainers, license)?** Se usan Intl y DOM estándar, componentes internos MIT y dependencias ya fijadas. Sin cargas remotas, bibliotecas nuevas ni datos privados. Se conservan el aislamiento renderer/main y los contratos de CSV.
5. **What maintenance cost does it add?** Texto catalogado, atributos y condiciones de presentación, más sus consumidores. No hay caché, persistencia, timer, detector o segundo modelo numérico. El coste de copia se acota mediante la decisión pendiente antes de escribirla.
6. **What is the minimum glue LAB must write?** Conectar el formateador y title existentes, plegar la explicación, ajustar las claves señaladas y aprovechar metadatos de motivos ya disponibles. LAB no cambia; tampoco cálculo, SQL, historial, original, informes o exportación.
7. **Does writing our own code add value?** El pegamento limitado hace legibles las cifras y explica qué hacer sin ocultar el valor completo ni los rechazos. Reimplementar formato, cálculo o clipboard global no aporta valor y queda fuera del alcance.
