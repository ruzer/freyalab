# C5 · evidencia de observación del contexto Electron

**No se ha reproducido localmente el fallo de C5 ni se propone un arreglo de producto.** Esta entrega conserva mejor el contexto de un próximo fallo. Base `056d28f3ad1177a1fd2bf393f27e7ac77e82af8d`; SHA de publicación y CI de la entrega pendientes. [Alcance y siete respuestas ADR 0021](../stories/ci-c5-observabilidad-alcance-adr-0021.md).

## Fallo real y captura anterior

En [main CI 44650561529, ARM](https://github.com/ruzer/freyalab/actions/runs/44650561529/job/136004086587), C5 `project-tree.spec.ts:243` agotó los 90 segundos en ambos intentos. El observer inicial resolvió y comprobó fuente propietaria, un progreso, `status/polite` y Cancelar. La última expectativa en :266 pedía cero progresos y quedó pendiente hasta el cierre. El error contiene `Expected: 0` y contexto cerrado, no un recuento final recibido; no demuestra que el progreso siguiera visible al final.

Los dos ZIP conservados tienen `test.trace`, dos fuentes y adjuntos, **sin traza DOM/browser ni screenshots** del contexto Electron. El segundo error de integridad en el teardown se conserva: después del cambio deliberado del CSV, esa lectura aún no coincidía con los bytes originales. No se infiere corrupción ni se determina cuándo terminó su restauración.

El paso fast terminó exit1 en 67 minutos: 721 identidades, 711 esperadas, una inesperada C5, dos flaky y siete omitidas. Hubo tres retry #1: C5 volvió a fallar; TEN-1 y gráficos visuales pasaron. Después, perf/solo completó 42 casos antes de cancelarse, sin reporte final de los 63 seleccionados. La anotación de GitHub confirma el máximo del job de 75 minutos: no fue solamente una cancelación de infraestructura que permita ignorar el fallo anterior. No hay un intervalo de bloqueo de 26 minutos observado en el reporte; eso no instrumenta ni descarta un problema interno del motor.

## Calibración privada de la captura

Raíz ejecutó el mismo cuerpo C5 contra el bundle preservado `b1fd4f2190b6e71feb5c3fe022432d2276a59fa60b1308fb6fc0d91d9731f95c`. Coincide con el baseline del primer rojo PRJ-03; los árboles de producto y configuraciones de main614, checkpoint401 y main056 son idénticos. Los commits completos y la CI no se equiparan.

| Ejecución privada | Resultado | Proceso | CPU renderer solicitada |
|---|---:|---:|---:|
| Una instancia | 1/1 | 2.589 s | Sin reducción |
| Dos Electron concurrentes | 2/2 | 2.184 s | Sin reducción |
| Dos Electron concurrentes, CDP | 2/2 | 2.809 s | Factor 4 |

Cero retries. Son cinco controles de una misma identidad, no cinco nuevas pruebas públicas. Cada uno conserva las siete expectativas originales. Sus cinco ZIP manuales contienen 60 o 66 snapshots DOM, entre 38 y 60 fotogramas y tres fuentes: **rojo→verde de observación**, no de un defecto de C5.

Ambos IPC terminaron en los cinco controles: reregister entre 1.100 y 14.695 ms, Cancelar entre 0.193 y 0.212 ms. En tres registros Cancelar ganó; en los dos con CDP el registro terminó antes, posibilidad admitida por el caso original. El adjunto inicial comprobó un progreso y la expectativa posterior de cero pasó en 3.296–31.028 ms. Esa duración no es la hora exacta de retirada: el muestreo privado de 100 ms solo captó cero y pudo perder la transición.

El comando CDP se esperaba antes de continuar, pero no se midió una ralentización efectiva de cuatro veces; main y utility no se ralentizaron con ese comando. Las muestras DOM indican foco y visibilidad; no se midió foco nativo. Traza, logs y sondeo privados añaden carga y no reproducen por sí mismos el entorno ARM de CI.

## Cambio actual y calificación

El parche público reutiliza `traceElectronFailure` únicamente para C5, captura stdout/stderr y tiempos de dos IPC, y termina antes del cierre. El ayudante conserva el ZIP al fallar y lo descarta al pasar. No incorpora los timers, pings ni la capa de la sonda privada. Ninguna prueba se borra o debilita; producto, dependencias, grupos, plazos, retries y workflows tienen diff cero.

| Comprobación sobre el parche actual | Resultado |
|---|---|
| `npm run check` | Exit0, cero errores/advertencias; 9.577 s proceso |
| `node node_modules/vitest/vitest.mjs run tests/electron-trace.test.ts` | 8/8; 101 ms Vitest, 0.387 s proceso |
| C5 con los nuevos hooks | 4/4 en 3,295 s, dos workers, repeat-each=2 y cero retries: dos controles del C5 de progreso y dos del fallo del explorador. Los cinco controles anteriores pertenecen a la sonda privada. |
| `npm run build` | Exit0; 1,887 s, bundle nuevo de la misma fuente de producto |
| CI del futuro head | Pendiente; ningún verde se transfiere del baseline |
| `npm test` completo | 3005 aprobadas, 3 fallidas y 2 omitidas; 200.13 s Vitest / 202.044 s de proceso. Fallaron ci-int (listado), sql-source (millón) y detección real de Pandoc; no es verde. |
| Repetición enfocada de los tres archivos fallidos | 23/23 aprobadas; 9.24 s Vitest / 9.515 s proceso, sin modificar código, plazos ni retries. No sustituye a una suite completa verde. |
| Revalidación completa posterior con el mismo parche | 3008 aprobadas + 2 omisiones preexistentes; 19,67 s Vitest / 19,982 s proceso. Pandoc real 3.12.1. No borra el primer intento fallido ni demuestra su causa. |
| Paquete | No ejecutado en este bloque |

El [proof saneado](ci-c5-observabilidad-2026-11-19/proof.json) contiene hashes de fuentes, logs y artefactos, sin rutas locales ni URLs temporales. Los brutos permanecen privados. El registro de energía no muestra Sleep en la ventana de las tres fallas unitarias; su causa sigue sin demostrarse y no se atribuye a suspensión. No hay cambio de interfaz ni nuevas capturas de diseño; los fotogramas citados son evidencia de tracing de fixtures sintéticos. Publicación, revisión y merge corresponden al propietario.

Los dos controles públicos de progreso conservaron sus expectativas originales y registraron comienzo/fin de ambos IPC. Registrar terminó en 1,478 y 1,669 ms; Cancelar, en 0,221 y 0,224 ms. No se reprodujo el defecto histórico. Se añade observación para el próximo fallo real, sin afirmar una corrección. La suite E2E completa, el paquete y otras plataformas no se ejecutaron localmente en este bloque.
