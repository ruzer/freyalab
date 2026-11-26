# CI · Equilibrar serial en Ubuntu e Intel (2026-11-25)

Base: `865fc2c85bbae41b0c0b19d108b64553a19525af`, con #220 integrado por el propietario. Rama: `codex/ci-equilibrar-serial`. Ajuste anterior al experimento C y al lanzamiento manual Intel; no se inicia ninguno durante esta implementación.

## Reparto autorizado

Perf/solo pasa a `shell-md` en Ubuntu PR/push e Intel nocturno/manual. Windows y ARM conservan su ubicación. Se ejecuta una sola vez, con un worker, después de rápidas; se conserva ante fallo de rápidas y se detiene al cancelar. Las rápidas siguen divididas por proyecto, sin trasladar identidades.

Ubuntu pasa a 60 minutos por parte. Windows conserva 60, ARM 75 e Intel 90. No cambian las matrices, Gate, dependencias, producto, specs E2E, reintentos ni plazos de Playwright.

Un PR puede requerir paquete Linux sin seleccionar rápidas CSV. Antes, perf en CSV construía localmente; tras moverlo a otra máquina ya no puede proporcionar ese build. En ese caso preciso se construye antes de empaquetar: Linux `csv-package`, PR con paquete, rápidas omitidas, selector aprobado y su intersección rápida vacía. Se exige éxito previo y ausencia de cancelación. No se duplica el build si las rápidas CSV ya ejecutaron.

## Rojo → verde local

Entorno: macOS ARM, Node 24.22.1, dependencias existentes del lockfile.

| Comando | Resultado real |
| --- | --- |
| `npm test -- --run tests/ci-int.test.ts tests/ci-arm-package.test.ts tests/ci-windows-package.test.ts`, antes del YAML | 10 fallidas, 39 aprobadas; 9,62 s; checkpoint `05550718` |
| El mismo comando, tras el ajuste | 49 aprobadas; 14,65 s |
| `npm run check` | Código 0; 0 errores y 0 avisos Svelte; TypeScript aprobado |
| `npm test` completo, incluido CSV | Código 0; 3.317 aprobadas, 2 omisiones existentes; 182 archivos aprobados y 1 omitido; 23,20 s |
| `npm run build` | Código 0 |

La prueba compara las identidades completas de Playwright y su unión fast Shell/Markdown + fast CSV + serial completa. También evalúa los guards reales del YAML para PR/push/nocturna/manual: serial una vez en SMD, CSV y paquete excluidos; cancelación, fallo rápido, selector inválido y build Linux independiente. Gate y las regresiones Windows/ARM conservan sus comprobaciones. No se añaden omisiones.

## Medición y aceptación

El propietario aportó los cortes repetidos: Ubuntu CSV-package a 45 minutos e Intel CSV a 90. Las estimaciones autorizadas son Ubuntu ~23/~38 e Intel ~60/~57 minutos. Son estimaciones, no resultados de este cambio.

Como referencia anterior, [push main 865fc2c, corrida 45716356371](https://github.com/ruzer/freyalab/actions/runs/45716356371) ya solicita exactamente tres trabajos macOS y no incluye Intel. A las 23:15:52 UTC, varias partes seguían en curso; no se les atribuye aquí un resultado final.

Los tiempos de la CI del PR se registrarán en su descripción, sobre el head congelado, con duración, límite y margen por parte. Se requiere verde y al menos 15 minutos entre duración y límite en **cada** parte; estar verde por sí solo no cumple ese criterio.

Después de la integración del propietario se lanzará CI manual sobre main con el nuevo reparto y se comprobarán las tres partes Intel, su SHA y su margen. No se lanza Intel sobre la base anterior ni se sustituye esa comprobación por el verde del PR.

Pendiente al escribir esta evidencia: CI del PR, corrida manual real de main, márgenes medidos y experimento C. La suite gráfica completa no se ejecutó localmente: el cambio es de distribución de CI y su ejecución real corresponde al PR y al manual de main. No se publican versiones, no se fusiona y no se modifica la app instalada.
