# CSV · Reinterpretación sin recarga doble

Evidencia local de macOS, 2026-11-19, Node 24.22.1. Seguimiento de estabilidad de Vacíos, separado de SIM-1e/PR193. [Alcance y siete ADR](../stories/csv-reinterpretacion-estabilidad-alcance-adr-0021.md).

## Resultado y límite

Al reinterpretar un CSV, la lectura explícita de `options()` y la programada por el cambio de revisión podían solaparse. La reproducción con respuestas reales mostró que la segunda deshabilitaba Vacíos entre su comprobación habilitada y Enter. El candidato espera `tick()` después de actualizar el documento, cancela esa recarga programada y conserva `await load(0)`. Mantiene la limpieza del effect y los otros doce callers de `load`. Solo cambia `CsvTable.svelte`; backend, IPC y rechazos permanecen intactos. No añade dependencias, capacidades, plazos ni reintentos.

En CI de main `44479652308`, Windows, `empty-values.spec.ts:367` en-XA, pasó el guard habilitado y Enter no abrió el diálogo; el reintento pasó. **No hubo pérdida de datos demostrada y no se ha probado la causa de aquel fallo histórico.** Su traza no registra la transición observada localmente. El A/B siguiente valida el mecanismo reproducido; no demuestra por sí solo la estabilidad final en Windows.

## Identidades

| Elemento | Identidad |
| --- | --- |
| Main de partida | `39c2000936f1b03c00daee45bc0a257132fb26ab` |
| Alcance previo al producto | `1f97cbe096ef7b960a36c6a811ace7a03ed9c895` |
| Pruebas rojas y baseline de capturas anteriores | `4008f3c0fbf0dbe973a22fd019e24b490bdaf15d` |
| Producto, verificaciones y capturas posteriores | `3e6547c85f372808edbf373cf0daad6866c58f2f` |
| Spec nuevo SHA-256, idéntico en rojo y verde | `d7afc90caa2bf0697944c3fa4a05b243059f0968af27be4fa7a57691b5d5d314` |
| Fixture existente `empty-values.csv` SHA-256 | `6fb73de2f8356d0ac1db7793bf87d326ffac23b29c76f8fa184762e4e8f5ecad` |

El rojo público se ejecutó con la fuente de `1f97cbe` y el spec final que después se incorporó en `4008f3c`; ese commit de prueba no cambia `src`. El [manifest público](csv-reinterpretacion-recarga-2026-11-19/manifest.json) identifica fuente, logs y las 16 imágenes mediante hashes; no contiene rutas privadas. En `3e6547c` y `a858057`, `empty-values.spec.ts` conservaba exactamente los bytes de main39c: SHA-256 `9939db20c24b91c37e9bf9892d074ecef8756b652260e6e615ee6865e49d630b`. No se borraron pruebas ni se cambiaron sus títulos, datos, aserciones o plazos.

## Rojo y verde

Primero, una sonda privada sobre main39c conservó el guard habilitado y el campo original: dejó terminar la primera página real, avanzó 150 ms y retuvo solo la entrega de la segunda respuesta real. Enter fue ignorado durante la carga. Tras liberarla, la paleta siguió abierta y faltó el campo. Esa ejecución falló; el adjunto confirma dos consultas iguales salvo `requestId`, ambas en revisión 1. El adjunto bruto permanece privado.

Después fallaron las dos pruebas públicas nuevas, es y en-XA, en el foco del campo de Rellenar vacíos. Usan `empty-values.csv`, `openCsvCommands` y un observer del handler real: nunca fabrican respuestas y liberan la retención antes de cerrar Electron incluso en rojo. No esperan una segunda página incondicionalmente, pues el arreglo debe eliminarla. Los adjuntos propios solo contienen escalares.

| Escalar por idioma | Rojo | Verde |
| --- | ---: | ---: |
| Llamadas `options` | 1 | 1 |
| Páginas de la misma consulta, excluyendo `requestId` | 2 | 1 |
| Acción habilitada antes del timer | Sí | Sí |
| Acción deshabilitada después del timer | Sí | No |
| Paleta visible tras Enter | Sí | No |
| Diálogos de Rellenar tras liberar | 0 | 1 |
| Páginas de búsqueda `b` | 0: tramo no alcanzado | 1 |

En verde, las dos páginas totales corresponden a una reinterpretación y una búsqueda genuina. Ambos casos abren Rellenar con el campo enfocado; después de cerrar el diálogo, buscar `b` obtiene una página real y exactamente cinco celdas: `b`, `20`, `2`, `2026-03-04`, `x`. Los bytes del archivo permanecen iguales. Los escalares verdes no registran la revisión; no se reconstruye ese dato ausente.

## Comprobaciones sobre `3e6547c`

| Comprobación | Resultado | Duración |
| --- | --- | --- |
| `npm run check` | Exit 0; 0 errores, 0 advertencias | 8.66 s de proceso |
| `npm run build` | Exit 0 | 1.84 s de proceso |
| `npm test` completo, Pandoc real 3.12.1 | Exit 0; 167 archivos, 2972 aprobadas y 1 omitida | 16.47 s Vitest; 16.77 s de proceso |
| Dos E2E nuevas | 2/2, 0 reintentos | 3.8 s de reporte; 4.37 s de proceso |
| Consumidores existentes, seis specs | 72/72, 0 reintentos | 1.8 min de reporte; 110.10 s de proceso |
| Capturas posteriores privadas | 2/2 ejecuciones, ocho imágenes | 4.8 s de reporte; 5.53 s de proceso |

Las dos tandas públicas cubren **74 identidades distintas: 2 nuevas y 72 existentes**. No hubo una corrida única 74/74. Las ejecuciones privadas para capturas no se suman como pruebas públicas nuevas.

La omisión local es el caso exclusivo de Windows de `tests/package-smoke.test.ts` sobre un proceso hijo sobreviviente. Su condición no cambia; no se presenta como comprobado en macOS.

Comandos E2E ejecutados con build de la misma fuente:

```sh
npx playwright test tests/e2e/csv-format-load.spec.ts --project=csv --workers=1 --retries=0
npx playwright test tests/e2e/csv-file-format.spec.ts tests/e2e/csv-text.spec.ts tests/e2e/empty-values.spec.ts tests/e2e/structural-context.spec.ts tests/e2e/search.spec.ts tests/e2e/structure.spec.ts --project=csv --workers=1 --retries=0
```

## Capturas

Se copiaron y verificaron las 16 imágenes: SHA-256 de destino igual al original y dimensiones PNG exactas. Las ocho anteriores se tomaron **antes** de fallar las dos comprobaciones del campo ausente; esas ejecuciones continuaron rojas y no usaron `test.fail`. Las ocho posteriores muestran el estado tras el mismo Enter. Se usó una copia privada temporal, ya retirada, sin reactivar la acción ni añadir una opción de captura pública.

| Idioma, tema y tamaño | Antes: `4008f3c` | Después: `3e6547c` |
| --- | --- | --- |
| es, claro, 1440×900 | [PNG](csv-reinterpretacion-recarga-2026-11-19/before-es-light-1440x900.png) | [PNG](csv-reinterpretacion-recarga-2026-11-19/after-es-light-1440x900.png) |
| es, claro, 1280×720 | [PNG](csv-reinterpretacion-recarga-2026-11-19/before-es-light-1280x720.png) | [PNG](csv-reinterpretacion-recarga-2026-11-19/after-es-light-1280x720.png) |
| es, oscuro, 1440×900 | [PNG](csv-reinterpretacion-recarga-2026-11-19/before-es-dark-1440x900.png) | [PNG](csv-reinterpretacion-recarga-2026-11-19/after-es-dark-1440x900.png) |
| es, oscuro, 1280×720 | [PNG](csv-reinterpretacion-recarga-2026-11-19/before-es-dark-1280x720.png) | [PNG](csv-reinterpretacion-recarga-2026-11-19/after-es-dark-1280x720.png) |
| en-XA, claro, 1440×900 | [PNG](csv-reinterpretacion-recarga-2026-11-19/before-en-XA-light-1440x900.png) | [PNG](csv-reinterpretacion-recarga-2026-11-19/after-en-XA-light-1440x900.png) |
| en-XA, claro, 1280×720 | [PNG](csv-reinterpretacion-recarga-2026-11-19/before-en-XA-light-1280x720.png) | [PNG](csv-reinterpretacion-recarga-2026-11-19/after-en-XA-light-1280x720.png) |
| en-XA, oscuro, 1440×900 | [PNG](csv-reinterpretacion-recarga-2026-11-19/before-en-XA-dark-1440x900.png) | [PNG](csv-reinterpretacion-recarga-2026-11-19/after-en-XA-dark-1440x900.png) |
| en-XA, oscuro, 1280×720 | [PNG](csv-reinterpretacion-recarga-2026-11-19/before-en-XA-dark-1280x720.png) | [PNG](csv-reinterpretacion-recarga-2026-11-19/after-en-XA-dark-1280x720.png) |

## Pendiente

El [PR194](https://github.com/ruzer/freyalab/pull/194) publicó primero `a858057`; su CI fallida y el seguimiento se detallan abajo. El plan calculado sobre `3e6547c` selecciona `checks=true`, `unit=true`, `e2e=[shell,csv]`, `full=false`, `package=false`, `specs=[csv-format-load.spec.ts]`, `docsOnly=false`. El PR no activa pruebas del paquete ni de macOS Intel. La CI de un main posterior corresponderá a otro SHA; no se transfiere evidencia del paquete de PR193.

Estas comprobaciones locales no se presentan como resultado de CI ni como confirmación del comportamiento del paquete o instalador. No se ha ejecutado aquí una suite E2E completa adicional. La comparación con main39c conserva backend, preload, shared, package, lock y workflows sin diferencias. El seguimiento siguiente añade una sola espera por fila al spec antiguo de Vacíos.

## Segundo CSV: esperar su primera fila antes de abrir Vacíos

La CI `44495118702`, head `a85805755e8252fa6e3ff0eeba567c2e843bd3e4`, terminó fallida y Gate falló. En Windows, `empty-values.spec.ts:104` (en) falló tanto en el primer intento como en el reintento: faltó Preview después de abrir `una-fila.csv`. El clic quedó junto al timer inicial de 150 ms, sin una espera a la fila del segundo documento. macOS terminó con una intermitencia previa en `project-tree.spec.ts:243` C5: la espera tras Cancelar terminó al cerrar el contexto y el retry pasó. La traza no muestra el estado posterior del progreso; la comprobación desigual de bytes del teardown precedió a la restauración del fixture deliberadamente modificado. No prueba corrupción del producto ni se atribuye a este mecanismo. Ubuntu pasó sin reintentos. Duraciones de job: Windows FAILURE 38:45, Ubuntu SUCCESS 30:07 y macOS SUCCESS 41:57. Los dos casos nuevos y el original367 pasaron a la primera en los tres sistemas. [Corrida original conservada](https://github.com/ruzer/freyalab/actions/runs/44495118702).

Raíz reprodujo localmente el mismo oracle ausente con una sonda privada sobre esa fuente: pointerdown real con la acción habilitada, avance de 150 ms, primera página REAL del segundo documento retenida, acción deshabilitada y pointerup ignorado. Tras liberar, había una fila y cero diálogos; Preview siguió ausente. Rojo: exit 1, 32.896 s de proceso. El adjunto registra una página real, `enabledBeforeDown=true`, `disabledBeforeUp=true`, `dialogAfterUp=0` y `rowsAfterRelease=1`. No se fabricaron respuestas ni comandos. Esto reproduce el mecanismo, sin demostrar por sí solo la causa histórica de la CI.

La corrección pública añade únicamente `await expect(...locator('.csv-row')).toHaveCount(1)` entre el segundo open y `headerAction`. La tabla anterior tiene siete filas, de modo que la espera comprueba la respuesta de una fila del nuevo fixture. Todo el resto del archivo conserva sus bytes: 156 llamadas de aserción originales, más una nueva; las 94 acciones UI, datos, títulos y plazos permanecen iguales. No cambia producto, `options()`, configuración, dependencias, retries ni workflows. Spec corregido SHA-256 `c4fb4bcd9fa66f383c478a566fbcf6f99b6d04c67a98181c0ccd83cabe658ddd`; proof y hashes de logs en [first-page-proof.json](csv-reinterpretacion-recarga-2026-11-19/first-page-proof.json).

El control privado libera la respuesta antes de esa espera y del clic normal, sin depender del clic para liberar: 1/1 verde, 1.8 s de reporte / 2.265 s de proceso, sin reintentos. Los specs públicos originales `empty-values` y `csv-format-load` pasaron 22/22 en 28.6 s de reporte / 29.052 s de proceso, sin reintentos. El control privado no es una nueva prueba pública ni se suma a esas 22 identidades.

Sobre producto idéntico a `3e6547c` y el spec corregido `c4fb4bcd…`, las 20 repeticiones públicas (es/en × 10) pasaron sin reintentos en 35.2 s de reporte / 35.741 s de proceso. Reutilizan dos identidades incluidas en la tanda anterior de 22. Tipos: 0 errores y 0 advertencias, 8.583 s de proceso. Unitarias completas: 167 archivos, 2972 aprobadas y una omitida exclusiva de Windows, Pandoc real 3.12.1, 15.83 s Vitest / 16.157 s de proceso. Build: exit 0, 1.767 s de proceso. La sonda temporal se retiró antes de estas comprobaciones.

Los comandos, hashes de logs y vínculo entre base y spec corregido están en [first-page-proof.json](csv-reinterpretacion-recarga-2026-11-19/first-page-proof.json), sin rutas privadas. Los archivos brutos permanecen privados. No se crearon pruebas duplicadas ni se sumaron ejecuciones privadas como nuevas identidades públicas. No se repitió otra suite E2E local completa ni el paquete.

```sh
npx playwright test tests/e2e/empty-values.spec.ts tests/e2e/csv-format-load.spec.ts --project=csv --workers=1 --retries=0
npx playwright test tests/e2e/empty-values.spec.ts --project=csv --grep 'vista previa concuerda' --repeat-each=10 --workers=1 --retries=0
npm run check
npm test
npm run build
```

La CI de este ajuste sigue pendiente y se registra sobre su head en el PR194. La corrida anterior fallida y la observación macOS inconclusa se conservan como resultados históricos separados.
