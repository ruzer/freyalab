# PRJ-01b · Comparación exacta tras cancelar la huella

Base: `a8dfc7f8b27871f3a7288cc8b3f536a583859c8e` (main con #164). Rama aislada `codex/fix-project-sources-sync`, código en **482a77565b565cfc6c2323b9c8c5b082e9144a02**. El cambio funcional es una comparación y su comentario en un solo test. No se modifica el producto, el plazo de 5 segundos, las aserciones de cancelación, el fixture, los workflows, las dependencias ni el checkout del propietario.

La consulta inicial de PR abiertos devolvió `[]`; la corrección no duplica un PR de código existente en ese momento. La documentación que se preparó después por coordinación tiene otro alcance.

## Fallo observado y límite de la atribución

La [CI de main 43072455026](https://github.com/ruzer/freyalab/actions/runs/43072455026), job [130703633458](https://github.com/ruzer/freyalab/actions/runs/43072455026/job/130703633458), falló en `npm test`. `project-sources.test.ts:37`, «cancela la huella al primer bloque y conserva el archivo», tardó **5.799 ms (5,799 s)** y agotó el plazo existente de **5.000 ms (5 s)**. No falló una comparación de datos ni se agotó el tiempo global del job. La suite Intel terminó con 2.678 aprobadas, 1 fallida y 10 omitidas en 255,06 s.

Se conservan el [log completo](fix-project-sources-2026-11-11/main-intel-130703633458.log) y [los metadatos originales del job](fix-project-sources-2026-11-11/main-intel-job.json). Runner etiquetado macos-15-intel; macOS 15.7.9, build 24G830, imagen macos-15 20260824.0482.1, Node 24.19.0 x64. El log no midió núcleos ni memoria de ese runner: no se inventan esos datos.

El test conserva un CSV de **400.000 bytes**, espera AbortError, exige un solo evento de progreso anterior al final y vuelve a comparar todo el archivo con su original. Su `toEqual(Buffer)` enumera los índices del búfer en JavaScript. La instrumentación local, con el mismo camino real de lectura/cancelación, muestra que esa comparación consume casi todo el tiempo.

Esto demuestra localmente un mecanismo reproducible que agota el mismo caso y su mismo plazo; el runner Intel original no fue perfilado por fases, así que no se le atribuyen los tiempos locales ni se afirma que reprodujimos su hardware.

## Medición y rojo → verde

Equipo local: **Apple M2 Max, ARM64, 12 núcleos lógicos, 32 GiB**, Darwin 27.0.0, Node 24.22.1. La información está en [byte-controls.json](fix-project-sources-2026-11-11/byte-controls.json).

| Montaje | Escritura | Hasta primer bloque | Aborto/cierre | Comparación de bytes | Total del cuerpo |
| --- | --- | --- | --- | --- | --- |
| Original, sin control externo | 0,676 ms | 1,696 ms | 3,182 ms | **814,707 ms (0,815 s)** | 820,264 ms |
| Original, control CPU | 1,841 ms | 2,685 ms | 3,530 ms | **18.788,094 ms (18,788 s)** | 18.796,153 ms |
| Nativo, mismo control CPU | 1,753 ms | 101,539 ms | 100,744 ms | **1,030 ms (0,00103 s)** | 205,078 ms |

Los JSON crudos conservan los números de `performance.now()` en **milisegundos** con punto decimal. Por ejemplo, `compareMs: 18788.094291999998` significa **18,788 segundos**, no 18,788 milisegundos.

El control externo usa SIGSTOP/SIGCONT exclusivamente en el grupo creado para esa invocación de Node: ciclo de 100 ms con objetivo de admisión 0,08. No añade esperas al test ni satura los otros núcleos. La CPU observada del grupo/tiempo real fue 10,43 % en rojo y 9,83 % en verde; el ciclo no se presenta como una cuota exacta de CPU. El watchdog externo de 45 s protege solo el diagnóstico y **no actuó**; no altera el plazo de 5 s de Vitest.

- [Rojo controlado](fix-project-sources-2026-11-11/controlled-red.log): el caso real tarda 19.099 ms y Vitest emite `Test timed out in 5000ms`, en la misma línea 37; exit 1. El arranque global no es el error y no se mató el proceso para provocar el rojo.
- [Verde instrumentado](fix-project-sources-2026-11-11/controlled-green.log): el mismo caso, fixture y ciclo pasa en 210 ms; exit 0. Se conserva el evento `[65536]` y AbortError.
- [Verde del archivo final sin instrumentación](fix-project-sources-2026-11-11/controlled-final-clean-repeat.log): pasa en 418 ms con el mismo ciclo y plazo; exit 0, watchdog inactivo. El arranque/importación del proceso puede durar más que el caso: no se confunden esos tiempos.

La instrumentación temporal está preservada como [parche diagnóstico](fix-project-sources-2026-11-11/instrumentation.patch) y fue retirada de `tests/`. [El controlador](fix-project-sources-2026-11-11/cpu-control.py.txt) es un artefacto de diagnóstico fuera del producto y de la CI, no un comando nuevo de la aplicación.

Una ejecución adicional del archivo final ya había aprobado el test en 324 ms, pero su controlador encontró EPERM al señalar un grupo de proceso ya terminado. No se usa como resultado completo del control. Se corrigió únicamente la limpieza del diagnóstico —ignorar ese error solo si el hijo ya había terminado— y la ejecución final de 418 ms sí registró su salida y metadatos completos. No se ocultó un fallo del caso ni se cambió el producto.

## Integridad conservada

El cambio usa `Buffer.equals`, que compara longitud y todos los bytes en nativo. No sustituye la comparación por tamaño, prefijo, muestra, hash ni texto decodificado. Se mantienen literalmente los 400.000 bytes, AbortError, un evento y `events[0] < original.length`.

El [control negativo](fix-project-sources-2026-11-11/byte-controls.mjs.txt) ejecutó **12 comprobaciones**: dos copias exactas aceptadas y diez alteraciones rechazadas, en el original y en una copia con BOM UTF-8. Incluye un byte de inicio/BOM, uno del centro, el último, truncado y un byte añadido. [Resultados completos](fix-project-sources-2026-11-11/byte-controls.json). No se cambian las demás comparaciones del repositorio sin medición.

## Comandos y resultados del código final

```sh
npx vitest run tests/project-sources.test.ts --testNamePattern='cancela la huella al primer bloque' --reporter=verbose
python3 /private/tmp/freyalab-project-sources-evidence/cpu-control.py controlled-red 0.08
python3 /private/tmp/freyalab-project-sources-evidence/cpu-control.py controlled-green 0.08
python3 /private/tmp/freyalab-project-sources-evidence/cpu-control.py controlled-final-clean-repeat 0.08
node /private/tmp/freyalab-project-sources-evidence/byte-controls.mjs
npx vitest run tests/project-sources.test.ts tests/files.test.ts --reporter=verbose
npm run check
npm test
npm run build
```

Los controles rojo/verde se ejecutaron antes de retirar la instrumentación y la fuente final se volvió a comprobar sin ella. Todos usaron Node 24.22.1; las rutas temporales son las reales del diagnóstico, no una promesa de portabilidad del controlador a Windows.

| Comprobación | Resultado real |
| --- | --- |
| Unitarias enfocadas project-sources/files | **13/13 aprobadas**, 475 ms; el caso de cancelación pasa en 6 ms sin control externo |
| `npm run check` | **0 errores y 0 avisos** |
| `npm test` completo | **2.688 aprobadas y 1 omitida**, 143 archivos, 15,31 s |
| `npm run build` | Completado sobre el código 482a775 |
| Controles negativos de bytes | **12/12** |
| Instrumentación residual en el test | Ninguna |

La única omisión unitaria local es la prueba exclusiva de Windows en package-smoke.test.ts:18. Pandoc 3.12.1 local ejecuta sus nueve pruebas; su aviso sobre falta de soporte HTTP no es una omisión de Vitest.

## No verificado

- El código final todavía no tiene CI propia: el rojo original pertenece a main a8df, no al fix.
- No se ejecutaron E2E locales ni se abrió GUI: cambia solo una aserción de unitarias, sin cambios de interfaz o del producto. La CI del futuro PR ejecutará los checks requeridos.
- No se ejecutó el caso final en un Mac Intel físico; el contraste controlado en ARM no se presenta como esa plataforma.
- No se modificaron producto, CSV originales de usuario, plazos, workers, omisiones, configuración ni dependencias. No se abrió PR, hizo push, fusionó o actualizó la app instalada desde este bloque.
