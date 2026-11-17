# PRJ-02a · Conjuntos: implementación y evidencia local

Fecha: 2026-11-16. Repositorio: `ruzer/freyalab`. Rama de trabajo: `codex/prj-02a-conjuntos`, worktree independiente `/private/tmp/freyalab-prj02a`.

**Estado al corte:** implementación local completada; suite unitaria completa con 2.838 casos aprobados y una omisión de plataforma, 25 E2E enfocadas aprobadas y tres mediciones de 1 GB en ARM aprobadas. Después de esos resultados se corrigió un conflicto de borrador restaurado; su nueva corrida de **26 casos aprobó sin reintentos (3,6 min)**, incluida la confirmación y Cancelar sin escrituras. La suite E2E completa anterior se interrumpió voluntariamente para validar el nuevo cambio y se repetirá. CI del cambio, medición Intel y corrida Intel completa sin reintentos siguen pendientes. No se presenta esta entrega como integrada ni publicada.

## Identidad del código

| Punto | SHA / estado |
|---|---|
| Base de producto | `a30988ea4dff4e23891b219ba468ce6e9aa1d569` |
| Contrato y semántica registrados antes del código | `7080b1056f001d5eb8948a095e39a763932bd441` |
| Implementación y E2E enfocadas de interfaz | `76d80dca95eceeb0825a22e04b6462f4621b05b2` |
| Separación de códigos internos y mensajes traducibles | `1affd5a058a52e10b3efa5e448d25cb047f7e4bc` |
| Conservación de bytes del fixture entre plataformas | `9e20cc7f0c363ee10a02efb91e2e710c422d634c` |
| Medición ARM final y recaptura de cadena | **`44cd46d6d14e62ffb2b9780f1ba7676112accfc9`** |
| Defensa del borrador restaurado y E2E 26/26 | `5c67e93a38cbb6c69130527d9f24a115b4370a56` |

Cada resultado se atribuye abajo al código que se ejecutó. Los JSON de rendimiento final registran ese último SHA y `sourceModified:false`. El commit que añada esta evidencia no cambia el producto, pero necesita la calificación remota correspondiente; el verde de otro SHA no se transfiere. Los resultados posteriores de la CI y del cierre E2E se registrarán en el PR, sin crear commits solo para cambiar su estado, conforme a CONTRIBUTING.

## Alcance y decisiones

PRJ-02a cubre guardar, editar, renombrar, eliminar, encadenar y probar conjuntos, con los criterios 1–12, 14 y 15. No conecta conjuntos al análisis: eso corresponde a PRJ-02b. Tampoco exporta conjuntos ni crea resultados, cachés o archivos intermedios.

Se reutilizan el manifiesto y su escritura atómica, la detección de conflictos de PRJ-01, la autorización de fuentes, el proceso de datos existente, el scanner de registros de I0, su decodificación/parser estricto, las condiciones y el comparador numérico Decimal. Las condiciones y selección de columnas de E1 se comparten con el panel nuevo. No se añadieron dependencias ni un motor SQL.

La interfaz guarda `filter → order → sample → select`. Una definición manual conserva sus pasos y el orden escrito; el panel no editable no los normaliza. Las referencias conservan `{position,name}` de la fuente raíz después de proyectar o encadenar.

Decisiones expresas del propietario:

1. `first N` puede detener la lectura en el prefijo. Ese resultado es parcial y no afirma haber verificado la SHA-256 completa.
2. Se rechazan antes de abrir el flujo los planes que necesiten materializar un orden completo no acotado; no se cambia la muestra conmutando operaciones.
3. Un proyecto futuro se conserva sin escribir. Solo se ejecutan cadenas reconocidas y validadas íntegramente como semántica 1; no se rebaja una semántica desconocida.
4. El orden textual de conjuntos es Unicode ordinal fijo, independiente del idioma/equipo; el orden del CSV interactivo no cambia.
5. Los conjuntos se pueden probar dentro de Proyecto sin abrir la fuente como tabla ni crear un índice previo; la ejecución usa directamente la fuente autorizada.

## Motor e integridad

- Una sola pasada del ejecutor sobre la versión en disco, sin indexar previamente la fuente ni abrirla como documento para poder probarla desde Proyecto.
- Depósito de N filas con SplitMix64 y Algorithm R, rechazo de sesgo y salida por orden de llegada. Porcentaje con umbral racional exacto y hash de semilla/ordinal físico de la raíz; no se redondea a una cantidad fija.
- Orden no acotado resuelto con selección de los N primeros cuando viene `first N`, o las 100 primeras filas para la vista previa final. El recuento conserva todas las filas que correspondan.
- Un depósito/first previo acota los pasos posteriores. Filtros, depósitos y ordenaciones posteriores ceden control para atender cancelación; el orden estable adapta el merge sort cooperativo existente.
- Vista previa de hasta 100 filas; valores siempre textuales. `null` representa un campo ausente y `''` un campo presente vacío. Sin `select` se conservan también campos extra de filas irregulares; `select` solo proyecta las referencias elegidas.
- La validación de referencias y del plan ocurre antes de abrir el flujo. El encabezado se analiza por separado antes de analizar filas de datos; nombres o ancho distintos se rechazan.
- Se conservan ceros iniciales, identificadores mayores que el entero seguro, Unicode, campos multilínea, codificación y BOM. Probar no escribe ni normaliza la fuente.
- Una ejecución completa calcula y compara SHA-256 durante el mismo recorrido; una huella diferente descarta el resultado. Una ejecución parcial o cancelada no publica esa huella ni un total global inventado.
- `bytesRead` cuenta bytes físicos realmente leídos por el ejecutor, incluyendo lectura adelantada. En lecturas UTF-16 impares puede haber bytes físicamente releídos: cuentan en la métrica, pero no se duplican en el hash.

## Seguridad y revisión cruzada

El renderer solicita identificadores; no proporciona rutas a la ejecución. Main valida los mensajes con zod, resuelve la fuente autorizada y entrega al proceso de datos un descriptor cerrado. El puente mantiene métodos explícitos y la comprobación de emisor existente.

La revisión cruzada reprodujo y corrigió estos límites:

- Un conjunto guardado con `semantics:2` podía reconstruirse indebidamente como semántica 1 al probarlo: ahora se rechaza. En un proyecto futuro, probar exige una definición guardada reconocida sin cambiar sus pasos/base; no admite un ensayo nuevo arbitrario.
- Entre la comprobación rápida y el proceso de datos podía reemplazarse el archivo por otro inode con igual tamaño/mtime. La comprobación rápida ahora devuelve el stamp del mismo handle; el descriptor transporta `dev/ino` y el ejecutor rechaza ese reemplazo. La misma sonda real que devolvía el valor sintético cambiado pasó tras la defensa.
- Una respuesta completa tardía tras Cancelar no se muestra como completa; se conserva como cancelación parcial sin preview/huella final. El snapshot del proyecto impide aceptar resultados después de cerrar/reabrir otro contexto con el mismo id/ruta.
- Un error tardío de una fuente del proyecto anterior no marca la fuente del proyecto recién abierto.
- Publicar un proyecto vuelve a comprobar la generación después de esperar la cancelación, antes de cambiar las protecciones de documentos.
- Los errores de comprobación rápida se presentan con mensajes de tarea; no se filtran rutas completas de errores crudos. Los errores del motor son codificados y se traducen en main.
- El esquema completo se publica una sola vez por fuente, evitando multiplicarlo por cada conjunto.
- Un borrador restaurado conserva la identidad de la definición sobre la que se editó. Si la definición guardada cambió externamente, muestra un aviso y exige confirmar el reemplazo con el diálogo existente antes de guardar. Cancelar conserva tanto el borrador como la definición externa; no se añadió ningún IPC ni una ruta nueva de escritura.

Se mantienen guardas explícitas de solo lectura en todas las mutaciones: disponer de una proyección conocida de un manifiesto futuro no autoriza guardarlo.

El esquema físico exige posiciones consecutivas desde 1 antes de entrar a la interfaz: rechaza, entre otros, `[1000000000]`, `[1,3]` y `[2,1]`, evitando reservar arrays por un índice arbitrario. No introduce un límite artificial de columnas. Su rojo→verde se conserva en `schema-bounds-*.log` y quedó cubierto por la suite completa.

## Rojo → verde real

Los recuentos de cada fila son los de su ejecución enfocada; se solapan y **no se suman**. Los logs citados se conservan en [logs/](prj02a-conjuntos-2026-11-16/logs/). Solo se copiaron textos: se sustituyeron prefijos de rutas locales por `<WORKTREE>`, `<HOME>` o `<TMP>` se quitaron espacios finales y líneas vacías de borde, y se revisaron patrones de tokens. No se copiaron trazas binarias ni perfiles de usuario.

| Bloque | Evidencia roja | Evidencia verde |
|---|---|---|
| Resolver fuente raíz/cadena/columnas | [domain/red-01-resolve.log](prj02a-conjuntos-2026-11-16/logs/domain/red-01-resolve.log): 1 caso falla | [domain/green-01-resolve.log](prj02a-conjuntos-2026-11-16/logs/domain/green-01-resolve.log): 1 pasa |
| Dependientes transitivos y edición canónica | [domain/red-02-dependents-editor.log](prj02a-conjuntos-2026-11-16/logs/domain/red-02-dependents-editor.log): 2 fallan, 3 pasan | [domain/green-02-dependents-editor.log](prj02a-conjuntos-2026-11-16/logs/domain/green-02-dependents-editor.log): 5 pasan |
| Crear/editar identidad y metadatos del conjunto | [domain/red-03-save.log](prj02a-conjuntos-2026-11-16/logs/domain/red-03-save.log): 1 falla | [domain/green-03-save.log](prj02a-conjuntos-2026-11-16/logs/domain/green-03-save.log): 1 pasa |
| Renombrar/eliminar, fuente en uso y borrador cerrado | [domain/red-04-crud-boundary.log](prj02a-conjuntos-2026-11-16/logs/domain/red-04-crud-boundary.log): 4 fallan, 6 pasan | [domain/green-04-crud-boundary.log](prj02a-conjuntos-2026-11-16/logs/domain/green-04-crud-boundary.log): 10 pasan |
| Proyección futura solo lectura y vistas | [domain/red-05-future-views.log](prj02a-conjuntos-2026-11-16/logs/domain/red-05-future-views.log): 2 fallan, 4 pasan | [domain/green-05-future-views.log](prj02a-conjuntos-2026-11-16/logs/domain/green-05-future-views.log): 6 pasan |
| Fixture de filtro/orden/proyección | [engine/01-fixture-functional-red.log](prj02a-conjuntos-2026-11-16/logs/engine/01-fixture-functional-red.log): suite falla por módulo nuevo inexistente, sin casos recogidos | [engine/01-fixture-green.log](prj02a-conjuntos-2026-11-16/logs/engine/01-fixture-green.log): 1 pasa |
| Depósito seed 7, vector previo `[2,3,6]` | [engine/02-reservoir-red.log](prj02a-conjuntos-2026-11-16/logs/engine/02-reservoir-red.log): 1 falla, 1 pasa | [engine/02-reservoir-green.log](prj02a-conjuntos-2026-11-16/logs/engine/02-reservoir-green.log): 2 pasan |
| Porcentaje, 100 % y ordinal raíz | [engine/03-percent-red.log](prj02a-conjuntos-2026-11-16/logs/engine/03-percent-red.log): 3 fallan, 2 pasan | [engine/03-percent-green.log](prj02a-conjuntos-2026-11-16/logs/engine/03-percent-green.log): 5 pasan |
| Prefijo parcial y orden→select→first | [engine/04-first-topn-red.log](prj02a-conjuntos-2026-11-16/logs/engine/04-first-topn-red.log): 3 fallan, 5 pasan | [engine/04-first-topn-green.log](prj02a-conjuntos-2026-11-16/logs/engine/04-first-topn-green.log): 8 pasan |
| Campos extra sin select | [engine/05-irregular-red.log](prj02a-conjuntos-2026-11-16/logs/engine/05-irregular-red.log): 1 falla, 8 pasan | [engine/05-irregular-green.log](prj02a-conjuntos-2026-11-16/logs/engine/05-irregular-green.log): 9 pasan |
| Encabezado antes de datos malformados | [engine/07-header-first-red.log](prj02a-conjuntos-2026-11-16/logs/engine/07-header-first-red.log): 1 falla, 18 pasan | [engine/07-header-first-green.log](prj02a-conjuntos-2026-11-16/logs/engine/07-header-first-green.log): 19 pasan |
| Ancho del encabezado y cancelación posterior al depósito | [engine/08-header-width-bounded-cancel-red.log](prj02a-conjuntos-2026-11-16/logs/engine/08-header-width-bounded-cancel-red.log): 2 fallan, 20 pasan | [engine/08-header-width-bounded-cancel-green.log](prj02a-conjuntos-2026-11-16/logs/engine/08-header-width-bounded-cancel-green.log): 22 pasan |
| UTF-16 impar/hash y UTF-8 inválido | [engine/09-encoding-red.log](prj02a-conjuntos-2026-11-16/logs/engine/09-encoding-red.log): 2 fallan, 22 pasan | [engine/09-encoding-green.log](prj02a-conjuntos-2026-11-16/logs/engine/09-encoding-green.log): 24 pasan |
| Autorización/coordinación con proceso de datos | [coordinator-red.log](prj02a-conjuntos-2026-11-16/logs/coordinator-red.log): suite falla por módulo nuevo inexistente | [coordinator-green.log](prj02a-conjuntos-2026-11-16/logs/coordinator-green.log): 6 pasan |
| Registro/autorización de fuente | [registry-red.log](prj02a-conjuntos-2026-11-16/logs/registry-red.log): 1 falla; 8 omitidos por filtro de ejecución | [registry-green.log](prj02a-conjuntos-2026-11-16/logs/registry-green.log): los 9 pasan, sin omisiones |
| Marcar fuente al fallar su identidad | [identity-red.log](prj02a-conjuntos-2026-11-16/logs/identity-red.log): 1 falla, 4 pasan | [identity-green.log](prj02a-conjuntos-2026-11-16/logs/identity-green.log): 14 pasan en 2 archivos |
| No degradar semántica ni inventar ensayo futuro | [future-trial-red.log](prj02a-conjuntos-2026-11-16/logs/future-trial-red.log): 2 fallan, 6 pasan | [future-trial-green.log](prj02a-conjuntos-2026-11-16/logs/future-trial-green.log): 8 pasan |
| Reemplazo de inode entre quick y worker | [identity-race-red.log](prj02a-conjuntos-2026-11-16/logs/identity-race-red.log): 1 falla; sonda real independiente también falla en [engine/review-descriptor-race-red.log](prj02a-conjuntos-2026-11-16/logs/engine/review-descriptor-race-red.log) | [identity-race-green.log](prj02a-conjuntos-2026-11-16/logs/identity-race-green.log): 18 pasan en 3 archivos; misma sonda real pasa en [engine/review-descriptor-race-green.log](prj02a-conjuntos-2026-11-16/logs/engine/review-descriptor-race-green.log) |
| Cancelación/respuesta tardía y cambio de snapshot | [stale-result-red.log](prj02a-conjuntos-2026-11-16/logs/stale-result-red.log): 2 fallan, 8 pasan | [stale-result-green.log](prj02a-conjuntos-2026-11-16/logs/stale-result-green.log): 10 pasan |
| Error de proyecto anterior no contamina el actual | [stale-error-red.log](prj02a-conjuntos-2026-11-16/logs/stale-error-red.log): 1 falla, 10 pasan | [stale-error-green.log](prj02a-conjuntos-2026-11-16/logs/stale-error-green.log): 11 pasan |
| No repetir el esquema de fuente por conjunto | [schema-transfer-red.log](prj02a-conjuntos-2026-11-16/logs/schema-transfer-red.log): 1 falla, 8 pasan | [schema-transfer-green.log](prj02a-conjuntos-2026-11-16/logs/schema-transfer-green.log): 16 pasan en 2 archivos |
| Esquema físico con posiciones consecutivas | [schema-bounds-red.log](prj02a-conjuntos-2026-11-16/logs/schema-bounds-red.log): 4 fallan, 16 pasan | [schema-bounds-green.log](prj02a-conjuntos-2026-11-16/logs/schema-bounds-green.log): 39 pasan en 4 archivos |
| Códigos internos sin falsas cadenas de interfaz | [unit-full-76d80dc.log](prj02a-conjuntos-2026-11-16/logs/unit-full-76d80dc.log): 1 falla en i18n-pending, 2.837 pasan y 1 se omite | [i18n-code-builder-green.log](prj02a-conjuntos-2026-11-16/logs/i18n-code-builder-green.log): 48 pasan; suite completa posterior 2.838 pasan y 1 se omite |
| Fixture estable con checkout CRLF | [fixture-checkout-red.log](prj02a-conjuntos-2026-11-16/logs/fixture-checkout-red.log): simulación autocrlf produce 220 B y SHA distinto | [fixture-checkout-green.log](prj02a-conjuntos-2026-11-16/logs/fixture-checkout-green.log): misma simulación conserva 211 B y SHA de referencia |
| Tres niveles de cadena encuadrados | [capture-chain-red.log](prj02a-conjuntos-2026-11-16/logs/capture-chain-red.log): padre queda fuera del viewport en en-XA | [capture-chain-green.log](prj02a-conjuntos-2026-11-16/logs/capture-chain-green.log): 2 E2E pasan, es/en-XA, con ancho lateral 420 y ocho capturas renovadas |
| Borrador restaurado frente a definición externa nueva | [draft-conflict-red.log](prj02a-conjuntos-2026-11-16/logs/draft-conflict-red.log): 1 E2E falla; no aparecía la confirmación | [ui-26-draft-conflict-green.log](prj02a-conjuntos-2026-11-16/logs/ui-26-draft-conflict-green.log): **26/26 aprobadas**, sin reintentos, 3,6 min |

[engine/06-integrity-regression.log](prj02a-conjuntos-2026-11-16/logs/engine/06-integrity-regression.log) y [engine/10-manual-negative-regression.log](prj02a-conjuntos-2026-11-16/logs/engine/10-manual-negative-regression.log) son regresiones que ya pasaban al añadirse: no se inventa un rojo. El último registra 30 casos de motor, incluyendo cadenas manuales repetidas, semilla negativa, CRLF/CR, UTF-16/BOM, win1252, números exactos y valores ausentes. Los vectores de semilla 0/7 están documentados antes del motor; la referencia negativa separada se conserva en `engine/negative-reference.py/.txt` y no importa el producto. La referencia independiente de semilla 7 y su desarrollo matemático están en `docs/stories/prj02-semantica-1*.md` y `experiments/prj02-reference/`.

El intento inicial `engine/01-fixture-red.log` solo falló porque aún no estaba disponible Vitest: **no cuenta como rojo funcional**. El rojo funcional inicial utilizó Vitest 5.0.5 y una configuración temporal mínima; los verdes usaron la instalación de la rama. La instalación posterior fue `npm ci --ignore-scripts`; no cambió package/lockfile.

## Comprobaciones ejecutadas

Entorno local: macOS Apple silicon, Node de ejecución de comandos 24.22.1. No se ampliaron plazos, no se añadieron dependencias ni se eliminaron aserciones. Los recuentos enfocados se solapan con la suite completa.

| Comando / ámbito | SHA y resultado real | Evidencia |
|---|---|---|
| `npm test` completo | `9e20cc7`: **156 archivos aprobados; 2.838 casos aprobados y 1 omitido**, 16,90 s | [unit-full-9e20cc7.log](prj02a-conjuntos-2026-11-16/logs/unit-full-9e20cc7.log) |
| `node node_modules/vitest/vitest.mjs run tests/projects.test.ts tests/project-recipes.test.ts tests/project-subsets.test.ts tests/project-sources.test.ts tests/recipe-identity.test.ts tests/recipe-operation.test.ts tests/subset-summary.test.ts` — enfocada previa | 7 archivos, **69/69**, 1,27 s | [focused-final-backend.log](prj02a-conjuntos-2026-11-16/logs/focused-final-backend.log) |
| `npm test -- --run tests/recipe-operation.test.ts tests/operations.test.ts tests/operations-search.test.ts tests/large-table.test.ts tests/large-search-records.test.ts tests/large-search-parity-mixed.test.ts` — consumidores de I0/scanner | 6 archivos, **103/103**, 799 ms | [engine/11-consumers-green.log](prj02a-conjuntos-2026-11-16/logs/engine/11-consumers-green.log) |
| `npm run check` | `44cd46d`: **0 errores y 0 avisos** de Svelte; TypeScript sin errores | [check-44cd46d.log](prj02a-conjuntos-2026-11-16/logs/check-44cd46d.log) |
| `npm run build` | `44cd46d`: finalizado correctamente | [build-perf-final.log](prj02a-conjuntos-2026-11-16/logs/build-perf-final.log) |
| `node node_modules/playwright/cli.js test tests/e2e/project-subsets.spec.ts --project=csv --workers=1 --retries=0` | `76d80dc`: **25/25**, 33,6 s, sin `retry #1` | [ui-25-76d80dc.log](prj02a-conjuntos-2026-11-16/logs/ui-25-76d80dc.log) |
| Recaptura enfocada de cadena, es/en-XA | App de `9e20cc7` con ajuste solo del test, posteriormente commit `44cd46d`: **2/2**, 4,1 s | [capture-chain-green.log](prj02a-conjuntos-2026-11-16/logs/capture-chain-green.log) |
| `node node_modules/playwright/cli.js test tests/e2e/project-subsets-perf.spec.ts --project=csv --workers=1 --retries=0` | `44cd46d`: **3/3**, 33,9 s, sin `retry #1` | [perf-arm-final.log](prj02a-conjuntos-2026-11-16/logs/perf-arm-final.log) |
| Check tras el ajuste de borrador restaurado | 0 errores y 0 avisos de Svelte; TypeScript no informa errores | [check-draft-conflict.log](prj02a-conjuntos-2026-11-16/logs/check-draft-conflict.log) |
| Build tras el ajuste de borrador restaurado | Finalizado correctamente | [build-draft-conflict.log](prj02a-conjuntos-2026-11-16/logs/build-draft-conflict.log) |
| Suite E2E completa anterior, `44cd46d` | Interrumpida voluntariamente: **106 aprobadas, 1 omitida, 588 sin ejecutar y 1 interrumpida**; no constituye un fallo confirmado del producto ni una suite verde | [e2e-full-44cd46d.log](prj02a-conjuntos-2026-11-16/logs/e2e-full-44cd46d.log) |

La única omisión de la suite unitaria local corresponde al caso exclusivo de Windows de `tests/package-smoke.test.ts`, condicionado por plataforma. No se añadió ninguna omisión para PRJ-02a. Pandoc real 3.12.1 estuvo disponible; el log advierte que ese binario no tiene soporte HTTP: no se atribuye a esta corrida una comprobación de eficacia del aislamiento HTTP con un binario que sí lo tenga.

El primer intento integral de interfaz tuvo 17 aprobadas y cuatro fallos: tres selectores de cierre ambiguos y un defecto real en el plural singular que mostraba `{n}`. Se conservaron las aserciones y se corrigieron el selector y los parámetros; la ejecución posterior de 25 casos pasa. Las nuevas rojas también cubrieron protección de una fuente al pasar a proyecto futuro, columna eliminada que queda pendiente y persistencia del borrador tras reelegir una columna.

La primera suite unitaria completa detectó que el guard de i18n interpretaba los códigos cerrados del ejecutor como texto visible. Se separó el constructor de errores internos de las salidas traducibles; no se amplió la lista de archivos pendientes ni se debilitó el guard. La enfocada posterior dio 48 aprobadas y la suite completa posterior pasó.

### Fixture portable: simulación CRLF, no Windows real

La simulación local de checkout con `core.autocrlf=true` cambió inicialmente el fixture de 211 a 220 bytes y su huella a `54510d0b8ba4f44f6b4cc3b969cdb8f3282292fc5699dfd6274597068f88a6a3`. En `9e20cc7`, `.gitattributes` declara `tests/fixtures/prj02-censo.csv -text` y los archivos textuales de la referencia con LF. La misma simulación conserva **211 bytes** y SHA-256 **`bde31aec296f4b09823b940e59f4cf1cdf4cddf66882578d3128d3fff2aa8bb8`**. No se presenta esa simulación como CI ejecutada en Windows.

## Capturas de interfaz

Se conservan 20 PNG en [la carpeta de evidencia](prj02a-conjuntos-2026-11-16/):

- Panel Conjunto: 12 capturas, es/en/en-XA × claro/oscuro × 1440×900/1280×720. Proceden de las 25 E2E aprobadas.
- Proyecto con cadena de tres niveles: ocho capturas, es/en-XA × claro/oscuro × ambos tamaños. **Ya se recapturaron con barra lateral de 420 px**. El test comprueba los tres nombres completamente dentro del viewport; no se conserva la captura anterior que cortaba la base como evidencia final.

Ejemplos: [Conjunto, español claro, 1280×720](prj02a-conjuntos-2026-11-16/prj02a-subset-es-light-1280x720.png), [Conjunto, en-XA oscuro, 1440×900](prj02a-conjuntos-2026-11-16/prj02a-subset-en-XA-dark-1440x900.png), [cadena, español claro, 1440×900](prj02a-conjuntos-2026-11-16/prj02a-project-chain-es-light-1440x900.png) y [cadena, en-XA oscuro, 1280×720](prj02a-conjuntos-2026-11-16/prj02a-project-chain-en-XA-dark-1280x720.png).

## Medición final local de 1 GB en ARM

SHA medido: **`44cd46d6d14e62ffb2b9780f1ba7676112accfc9`**, `sourceModified:false` para código/pruebas/scripts/dependencias. Fuente sintética: **1.000.000.008 bytes**, un millón de registros de 1.000 bytes y encabezado de 8 bytes; SHA-256 `ad5e0f81fd1c132ed1347c7e717b14286aa7594294a9cd99df5d0bee756b4540`.

Equipo: Apple M2 Max, 12 CPU lógicas, 32 GiB RAM, Darwin 27.0.0; Node del runner 24.22.1; Electron 44.9.2 con Node interno 24.22.0. Es la app de desarrollo construida, no un instalador ni la app instalada del propietario. Los campos de versión/canal del runtime en los JSON no prueban una publicación estable de FreyaLab.

| Caso | Duración total del request | Bytes leídos por el ejecutor | Resultado | Memoria FreyaLab CSV, KiB |
|---|---:|---:|---|---:|
| Primeras 2 | **132,043 ms** | **4.194.304** | 2 examinadas/finales; parcial; sin SHA completo | observado/informado **93.712** |
| Depósito 10.000, semilla 7 | **17.980,381 ms** | **1.000.000.008** | millón examinado; 10.000 finales; 100 en preview; completo y SHA correcto | observado **276.224**, informado **280.336** |
| Cancelación a mitad | **9.121,883 ms** | **507.510.784** | 502.000 examinadas; 10.000 en depósito parcial; cancelado; sin SHA completo | observado/informado **284.592** |

Datos originales: [first](prj02a-conjuntos-2026-11-16/perf-arm-final/prj02-first.json), [random](prj02a-conjuntos-2026-11-16/perf-arm-final/prj02-random.json), [cancel](prj02a-conjuntos-2026-11-16/perf-arm-final/prj02-cancel.json). Los tres JSON registran app nueva, fuente no abierta como documento, caché del sistema precalentada por el hash del fixture y comprobaciones de integridad fuera del intervalo medido.

Se pidió cancelar en el progreso con **500.000 examinados / 503.316.480 bytes leídos**. Terminó con 502.000 examinados y cobertura parcial; no creó archivos ni modificó la fuente/manifiesto. Los 9,122 s son duración total del request, **no** una medición aislada de latencia desde Cancelar. El ensayo inicial que cancelaba en el primer progreso no se utiliza para demostrar cancelación a mitad.

Memoria muestreada con `app.getAppMetrics` cada 50 ms, con 4/353/180 muestras en first/random/cancel. Para el depósito, el máximo de la suma de utilities fue 324.992 KiB y el máximo de la suma de toda la app 824.048 KiB. Son métricas distintas del pico del proceso CSV y no deben confundirse ni sumarse entre momentos. El muestreo no garantiza observar todos los máximos instantáneos.

La coincidencia entre `bytesRead` y tamaño en la ejecución completa, junto con no abrir/indexar la fuente, evidencia una pasada del ejecutor. No es una traza de todas las syscalls de Electron: la comprobación rápida lee extremos adicionales y el test relee el archivo para demostrar integridad. Los 4 MiB del prefijo incluyen lectura adelantada real. No son garantías universales de velocidad o memoria ni una medición de disco frío. Falta Intel con el mismo producto y montaje.

## Main e Intel: condición previa, no resultado de esta función

La nocturna [43915128539](https://github.com/ruzer/freyalab/actions/runs/43915128539), sobre la base `a30988e`, terminó SUCCESS en sus tres partes Intel. Según la revisión del coordinador: paquete y shell/md sin reintento; csv pasó con un reintento heredado de `@solo ui:428`. No repitió los tres fallos de gráficos empaquetados que motivaban la prioridad inicial.

Esto habilita continuar el desarrollo; **no cumple la aceptación de una corrida Intel completa sin `retry #1` sobre el código PRJ-02a**, ni es CI verde de la feature. No hay todavía enlaces de CI por plataforma del PR de implementación.

## Pendiente / no verificado

1. Repetir la suite E2E completa de integración sobre el producto congelado y registrar después en el PR su resultado real. La enfocada posterior ya pasó 26/26 sin reintentos. La ejecución de `44cd46d` se detuvo voluntariamente, no terminó en verde y no demuestra un fallo genuino. Registrar el resultado posterior en el PR.
2. CI de las tres plataformas del PR sobre el head final. No existe todavía un resultado atribuido a PRJ-02a; no transferir verdes del main previo ni de otros SHA.
3. Medición de 1 GB en Intel y comparación con ARM; corrida Intel completa del producto final sin `retry #1`. El requisito sigue abierto.
4. Empaquetado y compatibilidad de esta función en Windows/Linux/Intel: no demostrados por los comandos locales anteriores. La simulación CRLF no sustituye Windows real.
5. No se ejecutó una auditoría completa de seguridad ni traza de syscalls; no se midió un pico continuo entre muestras o disco frío, ni latencia independiente desde Cancelar.
6. PRJ-02b, análisis/exportación del conjunto y resultados físicos permanecen fuera de alcance. Esta entrega no fusiona, publica ni actualiza la app instalada.

Los logs y capturas demuestran los casos locales indicados. La validación pendiente impide declarar cumplidos todos los criterios multiplataforma de PRJ-02a. Las comprobaciones unitarias, E2E y de rendimiento anteriores conservan el SHA atribuido: no se trasladan en silencio al ajuste posterior de borrador. Los resultados posteriores se consignarán en el PR sin modificar este documento solo para actualizar estados.

## Última comprobación antes de congelar el PR

La corrección `5c67e93` pasó los 26 recorridos de `project-subsets.spec.ts`, sin reintentos: [ui-26-draft-conflict-green.log](prj02a-conjuntos-2026-11-16/logs/ui-26-draft-conflict-green.log). Dos cierres usaron la terminación de respaldo existente del ayudante tras cinco segundos; las aserciones terminaron aprobadas. Check y build posteriores están arriba. La repetición unitaria completa posterior también aprobó: **156 archivos, 2.838 aprobadas y una omisión heredada, 137,16 s**, sobre la fuente incorporada en `5c67e93`: [unit-full-draft-conflict.log](prj02a-conjuntos-2026-11-16/logs/unit-full-draft-conflict.log). La suite E2E completa se repetirá sobre el head congelado; su resultado real se registrará en el PR.
