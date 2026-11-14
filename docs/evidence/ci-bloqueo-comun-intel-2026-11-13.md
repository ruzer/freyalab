# Regla común de bloqueo y diagnóstico E2E Intel — 2026-11-13

Base: `4c8b86a59611f6aa33628654e0080120032fbc1b` (`main`, #174 fusionado). Rama independiente y PR en borrador; no se modifica el checkout del propietario.

## Problema y regla

La unitaria `cancela preview de fillEmpty después de cien mil filas, con progreso e historial intactos` agotó 12 s en [43505212244](https://github.com/ruzer/freyalab/actions/runs/43505212244/job/132160965141). El registro de 12.586 ms está censurado por el corte; la suite completa duró 266,51 s frente a 261,15 s en la sonda anterior. No demuestra lentitud general del runner. Las seis pruebas ajustadas en #174 pasaron.

Se sustituye el ajuste individual por una sola regla: **120 s como detector de bloqueo por prueba y hook**, independiente de plataforma y de CI/local. No es un objetivo de rendimiento, ni espera obligatoria, ni una extrapolación del último tiempo observado. Una prueba rápida sigue terminando de inmediato. El valor común queda en `tests/helpers/blocking-timeout.ts` y Vitest lo aplica a todos los casos actuales y futuros que no lo sobrescriban. CONTRIBUTING exige conservar esta política y diagnosticar los bloqueos en lugar de añadir excepciones.

Se eliminan los 20 argumentos particulares en 16 archivos y sus constantes históricas; se alinean también los deadlines funcionales de búsqueda, asignación de rangos y enumeración de pruebas. El polling limitado a 300 intentos de las vistas se reemplaza por el helper existente con deadline común. Se conserva un segundo para disponer recursos. No cambian fixtures, filas, consultas, orden, paginación, aserciones ni configuración de concurrencia. Las 29 llamadas existentes a `vi.waitFor` en siete archivos de compuertas, IPC y E/S conservan su espera nativa de 1 s: no se amplían sin una reproducción que aclare su contrato. La regla común sustituye los watchdogs de prueba/hook y los deadlines de operaciones pesadas; no cambia todos los temporizadores ni esperas de aserción de la suite.

Se mantienen explícitamente los contratos de producto: cancelar/cerrar en menos de 1 s, máximo de memoria, tiempo de red menor de 11 s, temporizadores simulados, timeout de Pandoc y corte deliberado del proceso de la prueba de limpieza de Windows. No se modifica `src/`, Playwright, workers, reintentos, límites del producto, paquetes ni workflows de la entrega.

## Rojo → verde

Dos pruebas nuevas ejercen la configuración real de Vitest, sin dormir 120 s: `TestContext.task.timeout` de un caso normal y `resolveConfig()` del archivo real para `testTimeout` y `hookTimeout`.

| Comprobación | Rojo en main | Después |
| --- | --- | --- |
| Plazo efectivo heredado por una prueba | 5.000 ms, esperado 120.000 | 120.000 ms |
| Configuración efectiva de prueba/hook | 5.000 / 10.000 ms, esperado 120.000 ambos | 120.000 / 120.000 ms |
| Unitarias completas locales | La corrida Intel original contiene el rojo funcional de fillEmpty | 146 archivos; 2.741 aprobadas, 1 omisión Windows existente; 17,78 s |

Rojo de la política: `npm test -- tests/test-timeout-policy.test.ts`, dos fallos en 213 ms sobre el código anterior a la configuración. La primera compilación de la prueba detectó que faltaba importar la ampliación de tipos de `vitest/config`; se corrigió sin casts. Una primera ejecución local sin permisos para abrir puertos falló con `listen EPERM` en las pruebas existentes de actualizaciones/Pandoc; la repetición autorizada ejecutó el conjunto completo sin omitirlas.

Validación local: macOS ARM, Node 24.22.1. `npm run check`: aprobado, cero errores/advertencias. `npm test`: resultado anterior. `npm run build`: aprobado. `git diff --check`: aprobado. Comparación AST de los 17 archivos de unitarias modificados: expresiones `expect` anteriores idénticas y en el mismo orden. Los dos casos nuevos amplían el recuento de 2.740 a 2.742; no se borra ningún caso.

## E2E: qué demuestran las trazas de 43477798498

Logs y artefactos de [Intel CSV](https://github.com/ruzer/freyalab/actions/runs/43477798498/job/132066110181) y [Intel paquete](https://github.com/ruzer/freyalab/actions/runs/43477798498/job/132066110215), SHA `2f6b58c`. Las trazas contienen eventos del test y contexto de error; no una captura de navegador/red con marcas internas de WASM.

| Caso | Evidencia de ambos intentos | Interpretación y límite |
| --- | --- | --- |
| F2b, 200 campos | Tras 15,009 / 15,011 s falta la sugerencia; visible «Leyendo los tipos de campo…» | La interfaz aún procesa perfiles de columnas en serie. No es una espera de DuckDB. |
| TEN-1, 300.000 filas | Espera 30,011 / 30,009 s y no aparece la tendencia | Trabajo de análisis aún pendiente. Sin marcas por fase no se separan carga, consulta y dibujo. |
| Constructor explícito | El caso total agota 90 s; la última espera duró solo 8,823 / 6,126 s, con «Calculando…» | El presupuesto restante del caso recorta la espera de la última consulta; no esperó otros 30 s completos. El test hace varias operaciones. |
| SQL de más de 50 MiB, paquete | «Preparando motor local» tras 30,030 / 30,018 s | El texto no identifica por sí solo inicialización: también puede cubrir la carga Arrow de los datos. |

`SqlService.openEngine` crea una ventana y un motor nuevos por consulta. Espera `loadURL` y `freyaSQL`, publicado tras `instantiate/open/connect` y configuración. Después transfiere datos mediante Arrow/base64. El mensaje solo cambia a «Leyendo…» al múltiplo de 10.000 filas; el fixture de más de 50 MiB tiene 2.400 filas anchas, por lo que puede conservar «Preparando motor local» durante toda su carga, con el motor ya preparado. No se afirma que WASM estuviera arrancando esos 30 s.

### Medición real del producto, distinta del polling

Los artefactos `duckdb-profile.json` de esa misma corrida miden desde `sqlRun` hasta resultado. Incluyen arranque, carga y consulta. **No son solo tiempos de espera del test.**

| 1.000.000 de filas × 4 columnas | CSV sin empaquetar | Aplicación empaquetada |
| --- | ---: | ---: |
| macOS Intel | 25,58 s | 34,09 s |
| macOS ARM | 8,83 s | 7,77 s |
| Ubuntu x64 | 12,25 s | 11,72 s |

Para 100 filas Intel midió 2,61 / 4,06 s; ARM 1,23 / 1,21 s; Ubuntu 1,17 / 1,09 s. Hay coste real observado por quien usa el producto en ese runner Intel. No demuestra un defecto general de x64: Ubuntu también es x64 y no son equipos/cargas equivalentes. Tampoco atribuye las cifras del millón de filas al fixture distinto de 2.400 filas anchas.

En [43505212244](https://github.com/ruzer/freyalab/actions/runs/43505212244), los cuatro casos vuelven a pasar sin reintento: F2b 200 campos 25,0 s totales; TEN-1 1,9 min totales; constructor 55,8 s sin empaquetar / 40,0 s empaquetado; SQL >50 MiB 19,8 / 15,9 s. Son duraciones del caso completo, no de una fase del motor. El paquete tuvo otro caso intermitente, `commands.spec.ts:230`, que pasó en retry #1; no se oculta ni se atribuye a esta tarea.

Conclusión: hay esperas funcionales que compiten con el presupuesto total del test y coste real de preparación/análisis en el producto. **No se cambian los plazos E2E en este PR.** Antes de un ajuste u optimización de producto faltan marcas `loadURL → motor listo → analysisStart/Next → append → seal → query`, y medir perfiles de 200 columnas por separado. Reutilizar un motor podría ahorrar arranque, pero exige revisar aislamiento, cancelación y memoria; no se implementa ni se presenta como aprobado aquí.

## Calificación del head y límites

Se registra en el PR la CI del head final y una sonda completa Intel que reproduce las tres partes actuales (`shell-md`, `csv`, `package`) sin cambiar sus pruebas, workers, reintentos ni límite de job. La sonda usa una rama/workflow separado; su definición no entra en la entrega. Los resultados se registran por SHA, sin transferir el verde de la sonda a otro commit ni generar un commit documental solo para actualizar el estado.

No se han medido en esta tarea las subfases de las solicitudes fallidas, un Mac Intel de usuario, lectores de pantalla, instaladores o la próxima nocturna. No se atribuye la variación a hardware, red o WASM sin medición específica. El límite común sigue detectando un bloqueo finito, pero puede tardar más en denunciar un cuelgue pequeño; los requisitos explícitos de rendimiento siguen vigilados por sus aserciones. No se fusiona, publica ni actualiza la app instalada.
