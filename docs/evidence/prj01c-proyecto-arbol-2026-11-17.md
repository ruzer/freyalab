# PRJ-01c · Proyecto como árbol

Fecha: 2026-11-17. Base: `main d17cc81cd279f3e8a0938077d0b8d55294f05e83`, con PRJ-02b fusionado. Rama: `codex/prj-01c-proyecto-arbol`. Trabajo en un worktree independiente: no se modifica el checkout del propietario ni LAB.

Esta evidencia registra pruebas locales ya ejecutadas durante el desarrollo, incluido el código `d632a15`. No atribuye el resultado al head final que también incorpora esta documentación. La validación integral y la CI de ese head se registrarán en el PR: su verde no se transfiere a otro SHA.

## Alcance realizado

- Árbol único Fuente → Conjunto → Conjunto hijo, con el estilo `.tree-item`, sangría de 16 px y nombres/detalles elididos con título completo.
- Dos botones de acción en reposo: «Acciones del proyecto» y «Añadir fuente…». Las catorce acciones existentes se mantienen; revelar el manifiesto añade la decimoquinta.
- Menús compartidos con CsvFileMenu: posición dentro de la ventana, teclado, cierre y devolución del foco. No se añade un segundo sistema de comandos.
- Menú por botón, clic derecho, Mayús+F10 y tecla de menú; recorrido del árbol con un punto de tabulación, flechas, Inicio y Fin. Las acciones con `aria-disabled` siguen siendo enfocables y explican su motivo.
- Renombrado en fila, guardado con Intro, cancelación con Escape o al salir, errores junto al campo. Si la operación existente rechaza sobrescribir un manifiesto cambiado fuera de la app, conserva el borrador.
- Los problemas y el progreso se muestran junto a su fuente; el estado normal no repite «Listo» o «Verificada». Se mantienen protección, confirmaciones, operaciones existentes y versiones futuras de solo lectura.

Decisión del propietario: mostrar una sola vez la línea «🔒 Protegida · FreyaLab no modifica las fuentes.». La historia original se conserva sin editar; esta decisión consta también en [el alcance y ADR 0021](../stories/prj01c-alcance-adr-0021.md).

La historia se copió íntegra en el primer commit `a203776`: [diseño PRJ-01c](../stories/historia-prj01c-proyecto-arbol-diseno-para-codex.md), SHA-256 `4f0b9cd935469b80069014360cfcce3773822578f44c4302a044873d723d8e24`. No se añaden dependencias, persistencia de expansión, búsqueda, selección múltiple ni arrastre. PRJ-03 queda fuera.

## Único IPC nuevo

`projectShow(id)` usa la operación fija `project:show` del canal existente. Main conserva la validación de sender/frame y valida una tupla de un solo texto no vacío, con el mismo límite de 32.768 caracteres de `project:close`. Exige igualdad estricta con el id del proyecto activo.

Ese argumento no se interpreta como ruta: main revela exclusivamente `join(project.path, projectFile)` a partir del proyecto activo. No se devuelve una ruta al renderer. También funciona con proyectos futuros de solo lectura: su id puede ser no UUID o, si no existe un id válido, la identidad de respaldo que ya usa `readProject()` es la ruta del proyecto. La reproducción roja adicional cubre ese respaldo con más de cien caracteres. El commit del bloque IPC es `ffe9bac`.

Las pruebas cargan el handler público real y ProjectStore, con Electron Shell simulado; no abren Finder ni otros exploradores reales.

## Rojo → verde

Los registros se conservan en [prj01c-2026-11-17](prj01c-2026-11-17/). Se sustituyen las rutas locales del worktree, de evidencias y del ejecutable local de Pandoc por marcadores; no se copian trazas ZIP privadas.

| Bloque | Prueba roja anterior al arreglo | Verde observado |
|---|---|---|
| C1: dos acciones en reposo | Esperaba 2 botones; encontró 24 en la interfaz anterior. [Salida roja](prj01c-2026-11-17/tree-red.log). | [2/2 iniciales](prj01c-2026-11-17/tree-green-inicial.log) y [61/61 de integración](prj01c-2026-11-17/proyectos-61-verde.log), sin reintentos. |
| C9: todas las acciones | No existía el botón «Acciones del proyecto» ni su menú. Misma salida roja: 2 pruebas fallidas. | La integración pasa, incluidas las quince acciones y sus motivos; Enter no activa las deshabilitadas. |
| IPC `project:show` | Faltaban el método del puente y la operación: 12 fallos y 1 éxito del control de origen existente. [Salida roja](prj01c-2026-11-17/ipc-red.log). | 13/13 inicialmente; la regresión posterior con el caso de respaldo pasó 14/14. |
| Identidad de respaldo de versión futura | El límite inicial de cien caracteres rechazaba una identidad válida. [Rojo enfocado](prj01c-2026-11-17/ipc-future-fallback-red.log). Los 11 casos no seleccionados se indican como omitidos por el filtro `-t`, no por un `skip` añadido. | [14/14, dos archivos](prj01c-2026-11-17/ipc-green.log), 533 ms. |
| Renombrado rechazado y anuncio del error | La prueba detectó que desaparecía el borrador tras rechazar la sobrescritura externa; otra no encontraba un aviso con rol `alert` junto a la fuente. [Dos fallos rojos](prj01c-2026-11-17/review-red.log). | Ambas pasan en la integración de 61 pruebas, sin reintentos. El borrador y el manifiesto externo se conservan. |
| Limpieza de textos retirados | Búsqueda de todos los callers: cinco claves ya sin uso tras retirar su presentación. | [70/70 unitarias i18n](prj01c-2026-11-17/i18n-green.log), cuatro archivos, 686 ms. Solo se eliminan esas cinco claves en es/en; la familia dinámica de estados se conserva. |

Comandos ejecutados con Node 24:

```text
npm test -- tests/project-preload.test.ts tests/project-show-ipc.test.ts
npm test -- tests/project-show-ipc.test.ts -t 'ruta de respaldo'
npm test -- tests/i18n.test.ts tests/i18n-audit.test.ts tests/i18n-pending.test.ts tests/subset-i18n.test.ts
npx playwright test tests/e2e/project-tree.spec.ts --workers=1 --retries=0
npx playwright test tests/e2e/project.spec.ts tests/e2e/project-source.spec.ts tests/e2e/project-subsets.spec.ts tests/e2e/project-subset-analysis.spec.ts tests/e2e/project-tree.spec.ts --workers=1 --retries=0
```

También se ejecutó una regresión IPC de ocho archivos: 62/62 antes de añadir el caso adicional de respaldo. No reemplaza las 14 pruebas del contrato final ni la suite completa. Un `npm run check` intermedio pasó con cero errores y cero advertencias de Svelte, antes del último ajuste del árbol: [registro enfocado](prj01c-2026-11-17/check-enfocado.log). El build intermedio `build-tree-3` terminó correctamente; no se presenta como el build del head final.

### Comprobaciones de cierre sobre el código `d632a15`

| Comando | Resultado local real |
|---|---|
| `npm run check` | [Salida 0](prj01c-2026-11-17/check-codigo.log), cero errores y cero advertencias de Svelte. |
| `npm test` completo, incluido CSV | [164 archivos en verde, 2.947 pruebas pasadas y 1 omitida por entorno](prj01c-2026-11-17/unitarias-completas.log), 18,20 s. Pandoc 3.12.1 local no dispone de soporte HTTP: no se verificó la eficacia de ese sandbox HTTP con otro binario. No se añadió ningún `skip` en esta tarea. |

El cambio posterior de documentación no se presenta como una nueva ejecución de esas comprobaciones. El PR registrará el cierre integral sobre su head final.

## Preservación de las pruebas existentes

| Spec | Antes | Después de migrar |
|---|---:|---:|
| `project.spec.ts` | 5 | 5 |
| `project-source.spec.ts` | 7 | 7 |
| `project-subsets.spec.ts` | 26 | 26 |
| `project-subset-analysis.spec.ts` | 13 | 13 |
| **Cuatro specs existentes** | **51** | **51** |

Las identidades se compararon nombre por nombre, incluyendo proyecto y archivo: [antes](prj01c-2026-11-17/identidades-antes.json) y [después](prj01c-2026-11-17/identidades-despues.json). Las diez pruebas nuevas de `project-tree.spec.ts` elevan el grupo enfocado a 61: **61/61 pasaron, sin reintentos, en 1,6 min**. El [registro real](prj01c-2026-11-17/proyectos-61-verde.log) incluye las cuatro specs existentes, navegación, menús, renombrado, anchuras, progreso y capturas nuevas.

El [inventario estático](prj01c-2026-11-17/inventario-estatico.json) cuenta 401 llamadas a matcher antes y 428 después: 376 permanecen literalmente iguales y 25 migran al observable equivalente de la interfaz nueva. No son recuentos de aserciones ejecutadas, porque los helpers y bucles las repiten. [Cada migración con archivo, línea, antes, después y motivo](prj01c-2026-11-17/migraciones-aserciones.md). Los 89 matchers de `project-subset-analysis.spec.ts` permanecen intactos. El fixture `prj02-censo.csv` conserva el SHA-256 `bde31aec296f4b09823b940e59f4cf1cdf4cddf66882578d3128d3fff2aa8bb8`.

Se conserva la comprobación de datos, filas, columnas, semilla, SQL, hashes, bytes de fuente/manifiesto, protección, cancelación y límites. «Verificada/Listo» se sustituye por ausencia de problemas y Abrir habilitado; la prohibición de renombrar futuros se comprueba mediante el elemento de menú deshabilitado y su motivo; la versión distinta de la fuente queda en el título según el diseño.

La primera integración de las cinco specs dio 52/53: un locator buscaba el título informativo en el treeitem y todavía se publicaba únicamente en el nombre. Se corrigió la ubicación del título según la historia y esa prueba enfocada pasó. El fallo no se presenta como una tanda verde.

## Capturas

La tanda ampliada inicial terminó en verde y generó 24 capturas. Los enlaces de esta sección se actualizaron con las 24 capturas de la nueva tanda enfocada de ajustes (10/10 en 15,5 s, sin reintentos), después de corregir la altura de la fila durante el renombrado: reposo, menú y fuente modificada en es/en-XA, claro/oscuro, 1440×900 y 1280×720. Se verificó la dimensión real de cada PNG antes de copiarlo; no son capturas de las tandas fallidas. Las pruebas esperan por condición el tema, el ancho de la barra, las fuentes y que no haya desbordamiento horizontal o un menú fuera de la ventana.

| Estado e idioma | 1440×900 claro | 1440×900 oscuro | 1280×720 claro | 1280×720 oscuro |
|---|---|---|---|---|
| Reposo · es | [Captura](prj01c-2026-11-17/prj01c-reposo-es-light-1440x900.png) | [Captura](prj01c-2026-11-17/prj01c-reposo-es-dark-1440x900.png) | [Captura](prj01c-2026-11-17/prj01c-reposo-es-light-1280x720.png) | [Captura](prj01c-2026-11-17/prj01c-reposo-es-dark-1280x720.png) |
| Reposo · en-XA | [Captura](prj01c-2026-11-17/prj01c-reposo-en-XA-light-1440x900.png) | [Captura](prj01c-2026-11-17/prj01c-reposo-en-XA-dark-1440x900.png) | [Captura](prj01c-2026-11-17/prj01c-reposo-en-XA-light-1280x720.png) | [Captura](prj01c-2026-11-17/prj01c-reposo-en-XA-dark-1280x720.png) |
| Menú · es | [Captura](prj01c-2026-11-17/prj01c-menu-es-light-1440x900.png) | [Captura](prj01c-2026-11-17/prj01c-menu-es-dark-1440x900.png) | [Captura](prj01c-2026-11-17/prj01c-menu-es-light-1280x720.png) | [Captura](prj01c-2026-11-17/prj01c-menu-es-dark-1280x720.png) |
| Menú · en-XA | [Captura](prj01c-2026-11-17/prj01c-menu-en-XA-light-1440x900.png) | [Captura](prj01c-2026-11-17/prj01c-menu-en-XA-dark-1440x900.png) | [Captura](prj01c-2026-11-17/prj01c-menu-en-XA-light-1280x720.png) | [Captura](prj01c-2026-11-17/prj01c-menu-en-XA-dark-1280x720.png) |
| Fuente modificada · es | [Captura](prj01c-2026-11-17/prj01c-cambiada-es-light-1440x900.png) | [Captura](prj01c-2026-11-17/prj01c-cambiada-es-dark-1440x900.png) | [Captura](prj01c-2026-11-17/prj01c-cambiada-es-light-1280x720.png) | [Captura](prj01c-2026-11-17/prj01c-cambiada-es-dark-1280x720.png) |
| Fuente modificada · en-XA | [Captura](prj01c-2026-11-17/prj01c-cambiada-en-XA-light-1440x900.png) | [Captura](prj01c-2026-11-17/prj01c-cambiada-en-XA-dark-1440x900.png) | [Captura](prj01c-2026-11-17/prj01c-cambiada-en-XA-light-1280x720.png) | [Captura](prj01c-2026-11-17/prj01c-cambiada-en-XA-dark-1280x720.png) |

## Ajustes tras la primera validación integral (2026-11-18)

La primera ejecución completa en el código `a14079b` **no terminó en verde**: `npm run test:e2e -- --workers=1 --retries=0 --output=../prj01c-evidence/final-e2e` registró **708 pasadas, 6 fallidas y 7 omitidas en 27,7 min**. Se conserva la [salida real saneada](prj01c-2026-11-17/integral-a14079b-rojo.log). No se añadieron omisiones ni reintentos. Los resultados enfocados siguientes no sustituyen esa ejecución completa.

### Dos llamadores adicionales de la interfaz anterior

- `tests/e2e/empty-values.spec.ts:197–198`: todavía buscaba «Verificada · 🔒 Protegida» y un botón Abrir en línea. Esos elementos se retiraron a propósito en PRJ-01c. Ahora comprueba ausencia de problemas, nota de protección única y visible y Abrir habilitado; lo activa mediante el ayudante común del menú.
- `tests/e2e/project-subsets-perf.spec.ts:122–123`: todavía buscaba Analizar dentro de `.actions` y el motivo del límite como texto permanente de la fila. Ahora exige el mismo bloqueo y el motivo exacto como descripción accesible del menuitem, y cierra el menú con Escape antes de continuar.

La [migración adicional por archivo y línea](prj01c-2026-11-17/migraciones-llamadores-adicionales.md) y su [comparación JSON](prj01c-2026-11-17/inventario-llamadores-adicionales.json) se añaden al inventario anterior, sin modificar las 25 migraciones de las cuatro specs originales. Estos dos archivos adicionales conservan **24→24 identidades exactas**. Sus llamadas estáticas a matcher pasan de **175 a 179**: **172 intactas literalmente**, **3 migraciones exclusivamente de interfaz** y **7 llamadas equivalentes o adicionales**. No son números de aserciones ejecutadas.

El verde enfocado real pasó **los dos casos afectados, 2/2 en 4,5 s**, sin reintentos: [registro](prj01c-2026-11-17/llamadores-adicionales-green.log). Las comprobaciones de datos, protección, rechazo del puente, digest del original, límite de `256 MiB`, ausencia de documentos/proceso CSV y mtime permanecen literalmente iguales. No se afirma que esa tanda haya ejecutado las 24 identidades completas de ambos archivos.

### Renombrado contenido en su fila

La nueva comprobación geométrica produjo **1 fallo real** antes del ajuste: con una barra lateral de 240 px, la fila empezaba en `y=240` y terminaba en `284`, pero el campo comenzaba en `237,75` y el detalle terminaba en `286,25`. La altura fija de 44 px no contenía el campo y su detalle; el detalle invadía la fila siguiente. [Salida roja](prj01c-2026-11-17/rename-layout-red.log) y [cajas rojas](prj01c-2026-11-17/rename-layout-red-boxes.json).

El ajuste sustituye la altura fija por una altura mínima de 44 px: conserva la altura en reposo y permite crecer a la fila al renombrar o mostrar un error. Las pruebas miden campo, detalle, error y fila siguiente a 240 y 420 px. Los valores de la [captura geométrica verde](prj01c-2026-11-17/rename-layout-green-boxes.json) son:

| Barra | Estado | Alto de fila | Final de fila | Final del detalle | Inicio de la fila siguiente |
|---|---|---:|---:|---:|---:|
| 240 px | Campo, sin error | 56,5 | 296,5 | 292,5 | 296,5 |
| 240 px | Campo con error | 114 | 354 | 350 | 354 |
| 420 px | Campo, sin error | 56,5 | 296,5 | 292,5 | 296,5 |
| 420 px | Campo con error | 81 | 321 | 317 | 321 |

La [tanda enfocada del árbol](prj01c-2026-11-17/layout-tree-green.log) pasó **10/10 en 15,5 s**, sin reintentos, incluidos renombrado, captura de errores, teclado, anchos, progreso y las 24 capturas. El filtro de esa tanda no seleccionó los dos llamadores anteriores: por eso se informan por separado y no como una tanda de doce casos.

### Cuatro incidencias fuera de esos ajustes: diagnóstico pendiente

La misma ejecución integral registró también estos fallos. Se describe solamente lo observado; aún no se ha atribuido su causa ni se han cambiado estas pruebas:

| Caso | Observable del fallo |
|---|---|
| `application-close.spec.ts:37`, `quit` en inglés, texto de más de 10 MiB | No apareció el aviso con rol `alert` que debía contener «10 MiB». |
| `application-close.spec.ts:53`, S4 `quit` en inglés | Tras deshacer el texto rechazado y pedir cerrar la ventana, `page.isClosed()` no llegó a `true` durante la espera por condición de 15 s. |
| `mermaid-export-theme.spec.ts:184`, más de 64 diagramas | `electron.launch` falló al conectar el depurador de la ventana: `WebSocket error: socket hang up`. El cuerpo de la prueba no se ejecutó. |
| `analysis-describe.spec.ts:196`, cardinalidad textual no disponible | Se esperaba el resumen parcial y se observó «Analizando columnas: 0 de 2.»; el contexto se cerró durante la espera. |

La repetición enfocada de los cuatro casos sobre la base `main d17cc81` pasó **4/4 en 14,2 s**, sin reintentos: [registro de la base](prj01c-2026-11-17/baseline-cuatro-green.log). Esto demuestra que pueden pasar en esa base y en esta máquina; no establece la causa de sus fallos en la tanda integral de la rama. Quedan pendientes la comparación con la rama ajustada y el diagnóstico. No se etiquetan aquí como fallos de infraestructura, carreras o regresiones confirmadas. La [CI de `a14079b`](https://github.com/ruzer/freyalab/actions/runs/44244200453) tampoco es una validación verde de los ajustes: corresponde al código anterior.

Todavía no hay un SHA final de estos ajustes ni resultados de `check`, unitarias completas, E2E completas, build o CI sobre ese SHA. Se ejecutarán y registrarán después de crear y congelar el siguiente commit. No se traslada ningún verde de estas tandas al head futuro.

## Entorno, alcance de CI y pendientes

- Local: macOS 27.0.1, arm64, Node 24.22.1, Electron 44.9.2. Los datos son sintéticos.
- El mapa de áreas existente ya exige shell, md, csv y paquete para este diff transversal. No se cambian workflows, reintentos, plazos, dependencias ni límites.
- Pendiente la validación integral sobre el head final congelado: sus comandos, resultados y la CI de las tres plataformas se publican en el PR, sin trasladar verdes anteriores a ese SHA. No se promete una sonda Intel adicional para esta tarea de interfaz.
- La detección en vivo de cambios de la fuente reutiliza la vigilancia que existe al abrirla, como en `project-source.spec.ts`. No se añade un watcher para fuentes cerradas; su comprobación al volver a abrir o registrar conserva la ruta existente.
- No se ha verificado manualmente Finder/Explorer ni la instalación de un paquete en este bloque. La llamada a Shell está simulada. No se midió ni se promete rendimiento de archivos de GB en esta tarea de interfaz.
- No se fusiona, no se publica release y no se actualiza la app instalada. El PR se entrega en borrador.
