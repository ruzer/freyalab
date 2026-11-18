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

La tanda ampliada terminó en verde y generó 24 capturas nuevas: reposo, menú y fuente modificada en es/en-XA, claro/oscuro, 1440×900 y 1280×720. Se verificó la dimensión real de cada PNG antes de copiarlo; no son capturas de las tandas fallidas. Las pruebas esperan por condición el tema, el ancho de la barra, las fuentes y que no haya desbordamiento horizontal o un menú fuera de la ventana.

| Estado e idioma | 1440×900 claro | 1440×900 oscuro | 1280×720 claro | 1280×720 oscuro |
|---|---|---|---|---|
| Reposo · es | [Captura](prj01c-2026-11-17/prj01c-reposo-es-light-1440x900.png) | [Captura](prj01c-2026-11-17/prj01c-reposo-es-dark-1440x900.png) | [Captura](prj01c-2026-11-17/prj01c-reposo-es-light-1280x720.png) | [Captura](prj01c-2026-11-17/prj01c-reposo-es-dark-1280x720.png) |
| Reposo · en-XA | [Captura](prj01c-2026-11-17/prj01c-reposo-en-XA-light-1440x900.png) | [Captura](prj01c-2026-11-17/prj01c-reposo-en-XA-dark-1440x900.png) | [Captura](prj01c-2026-11-17/prj01c-reposo-en-XA-light-1280x720.png) | [Captura](prj01c-2026-11-17/prj01c-reposo-en-XA-dark-1280x720.png) |
| Menú · es | [Captura](prj01c-2026-11-17/prj01c-menu-es-light-1440x900.png) | [Captura](prj01c-2026-11-17/prj01c-menu-es-dark-1440x900.png) | [Captura](prj01c-2026-11-17/prj01c-menu-es-light-1280x720.png) | [Captura](prj01c-2026-11-17/prj01c-menu-es-dark-1280x720.png) |
| Menú · en-XA | [Captura](prj01c-2026-11-17/prj01c-menu-en-XA-light-1440x900.png) | [Captura](prj01c-2026-11-17/prj01c-menu-en-XA-dark-1440x900.png) | [Captura](prj01c-2026-11-17/prj01c-menu-en-XA-light-1280x720.png) | [Captura](prj01c-2026-11-17/prj01c-menu-en-XA-dark-1280x720.png) |
| Fuente modificada · es | [Captura](prj01c-2026-11-17/prj01c-cambiada-es-light-1440x900.png) | [Captura](prj01c-2026-11-17/prj01c-cambiada-es-dark-1440x900.png) | [Captura](prj01c-2026-11-17/prj01c-cambiada-es-light-1280x720.png) | [Captura](prj01c-2026-11-17/prj01c-cambiada-es-dark-1280x720.png) |
| Fuente modificada · en-XA | [Captura](prj01c-2026-11-17/prj01c-cambiada-en-XA-light-1440x900.png) | [Captura](prj01c-2026-11-17/prj01c-cambiada-en-XA-dark-1440x900.png) | [Captura](prj01c-2026-11-17/prj01c-cambiada-en-XA-light-1280x720.png) | [Captura](prj01c-2026-11-17/prj01c-cambiada-en-XA-dark-1280x720.png) |

## Entorno, alcance de CI y pendientes

- Local: macOS 27.0.1, arm64, Node 24.22.1, Electron 44.9.2. Los datos son sintéticos.
- El mapa de áreas existente ya exige shell, md, csv y paquete para este diff transversal. No se cambian workflows, reintentos, plazos, dependencias ni límites.
- Pendiente la validación integral sobre el head final congelado: sus comandos, resultados y la CI de las tres plataformas se publican en el PR, sin trasladar verdes anteriores a ese SHA. No se promete una sonda Intel adicional para esta tarea de interfaz.
- La detección en vivo de cambios de la fuente reutiliza la vigilancia que existe al abrirla, como en `project-source.spec.ts`. No se añade un watcher para fuentes cerradas; su comprobación al volver a abrir o registrar conserva la ruta existente.
- No se ha verificado manualmente Finder/Explorer ni la instalación de un paquete en este bloque. La llamada a Shell está simulada. No se midió ni se promete rendimiento de archivos de GB en esta tarea de interfaz.
- No se fusiona, no se publica release y no se actualiza la app instalada. El PR se entrega en borrador.
