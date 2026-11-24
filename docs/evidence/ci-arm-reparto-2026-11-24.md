# CI · Reparto de macOS ARM · 24 de noviembre de 2026

Base: `main` `e1dca57c70f05f05614c08fbe9d39aa60d93cee8`. Rama independiente `codex/ci-arm-shell-md-csv`. El propietario autorizó dividir el job ARM sin subir sus 75 minutos, retirar pruebas ni cambiar el paquete.

## Problema comprobado

- [PR #215, CI 45352619880](https://github.com/ruzer/freyalab/actions/runs/45352619880), `5954d46d`: fast pasó 850 casos y omitió 7, sin reintentos, en 70 min 29 s; el job cortó perf/solo después de 16/74 resultados.
- [Main, CI 45414369073](https://github.com/ruzer/freyalab/actions/runs/45414369073), `e1dca57c`: fast 62 min 25 s y serial 9 min 34 s; completó 833 + 7 omitidas y 68/68, sin fallos ni reintentos. Se canceló por el máximo de 75 minutos durante la finalización, después de subir las evidencias.
- El paquete ARM de esa corrida fue una incidencia independiente: GitHub no le asignó ejecutor por falta de capacidad. El reparto no promete corregir las colas del servicio.

## Cambio mínimo

Las tres listas de PR con paquete, PR sin paquete y push sustituyen el ARM de desarrollo por `shell-md` y `csv`; el paquete existente se conserva. Shell/Markdown ejecuta tipos, todas las unitarias, sus rápidas y la fase serial completa. CSV ejecuta solo sus rápidas. La nocturna conserva exclusivamente las tres partes Intel.

En PR se reutiliza el selector de proyectos: intersecta el plan de áreas con cada parte. Una parte sin proyectos omite E2E y su job termina aprobado. Perf/solo se ejecuta una sola vez en shell-md, con todos los proyectos del plan. Gate exige `macos_shell_md` y `macos_csv`, además del éxito global de Verify; el paquete no puede sustituir una confirmación de desarrollo.

Se mantienen los 75 minutos, dos workers rápidos ARM, un worker serial, retries, permisos, acciones y cachés. No cambia código de aplicación, ningún spec E2E, grupos, configuración Playwright, dependencias, otros workflows ni las partes de Windows/Ubuntu/Intel.

## Rojo → verde real

Node 24.22.1, macOS ARM. Las pruebas nuevas se ejecutaron contra el YAML original antes de modificarlo. Checkpoint rojo: `226680f7`. Los fallos verifican la matriz, selección y confirmaciones nuevas; no se cuentan errores de preparación como rojo.

| Comando ejecutado desde el worktree | Resultado |
| --- | --- |
| `node node_modules/vitest/vitest.mjs run tests/ci-arm-package.test.ts tests/ci-windows-package.test.ts tests/ci-int.test.ts` antes del workflow | 17 fallos, 23 aprobadas; 8,03 s |
| Mismo comando con el workflow propuesto | 40/40 aprobadas; 6,73 s |
| `npm run check` | 0 errores y 0 avisos |
| `npm test` completo, incluido CSV | 3.201 aprobadas, 2 omisiones existentes; 19,87 s |
| `npm run build` | aprobado |

Se comprobó también el `if` real del selector: ambas partes ARM de PR lo ejecutan y paquete/push lo omiten. Su simulación no fabrica outputs de un paso que no se ejecuta. CI-INT permanece sin modificar. Las advertencias heredadas de Vite no se ocultaron.

## Cobertura conservada

La enumeración de la fuente de main conserva **908 identidades completas**: **373 rápidas shell/md + 467 rápidas CSV + 68 seriales**. Su unión no pierde, añade ni duplica casos. Identidad: proyecto, archivo, suites y título. Las omisiones condicionales se incluyen en el listado; listar no equivale a ejecutar.

Se ejecutaron las cuatro variantes de `node node_modules/@playwright/test/cli.js test --list --reporter=json`: sin filtros; `--grep-invert '@perf|@solo' --project=shell --project=md`; el mismo filtro con `--project=csv`; y `--grep '@perf|@solo'`. El control de unión es además una prueba existente de CI-INT que pasó antes y después. [Conteos y hashes de los logs y listados](ci-arm-reparto-2026-11-24.json).

Los 931 casos de la propuesta previa pertenecían a la rama #215, que tiene funciones todavía no fusionadas. Este PR parte de main con #216: no se comparan cifras de SHA diferentes como si se hubieran retirado pruebas. No se cambió ninguna prueba de aplicación; solo las dos unitarias de orquestación que fijaban el reparto y Gate anteriores.

## CI real y aceptación pendiente

El PR registrará su SHA y los tiempos reales de `Verify macos-15 (shell-md)` y `Verify macos-15 (csv)` sin añadir commits para cambiar el estado de la evidencia. Después de la fusión que realice el propietario deberá verificarse una corrida de main con ambas partes verdes. No se acredita una corrida de main antes de esa fusión ni se fusiona automáticamente.

No se ejecutó otra suite E2E local de la aplicación por este cambio exclusivo de orquestación. La ejecución real en Actions del PR, paquete y main sigue siendo obligatoria; las pruebas locales y la enumeración no demuestran tiempos, asignación de ejecutor, instalador ni CI remota. Añadir otro job ARM puede aumentar preparación y cola; no se estima como tiempo medido del nuevo reparto.

## ADR 0021 · siete respuestas

1. Reutilizar matriz, selector de áreas y paquete separado existentes.
2. Validar condiciones reales con rojo→verde y unión de identidades ya utilizada en CI-INT.
3. Únicamente comandos npm/Playwright actuales; sin CLI, IPC ni capacidad nueva de producto.
4. Mismas acciones, permisos, dependencias y licencias; ninguna descarga ejecutable nueva.
5. Coste: un job ARM adicional y su preparación; capacidad y colas siguen dependiendo de GitHub.
6. Pegamento mínimo: un workflow y dos unitarias necesarias; ningún motor ni spec de aplicación nuevo.
7. Beneficio: reducir el camino crítico y exigir explícitamente el éxito de ambas partes, manteniendo el límite y la cobertura.
