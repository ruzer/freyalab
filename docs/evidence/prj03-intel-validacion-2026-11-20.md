# PRJ-03 · Validación Intel y coste de los oráculos

Addendum de fases reales, 2026-11-20. Los informes ARM de `32f531b` se conservan sin reescribir. La [sonda Intel 44686573913](https://github.com/ruzer/freyalab/actions/runs/44686573913), head `46926de`, terminó con ocho partes Verify aprobadas y CSV fallida; Gate quedó omitido. No califica la nueva composición `ad20345` ni el candidato posterior. El ajuste de oráculos se calificó localmente en ARM sobre `b074450`; la nueva fase Intel y la CI final siguen separadas y pendientes.

## Resultado de Intel

CSV rápidas: **386/386 aprobadas**, 45,1 min, sin omisiones ni retries. Perf/solo: **66 identidades: 64 aprobadas ordinarias + 1 flaky + 1 fallida**, 68 intentos y dos retries existentes, 17,7 min. En los siete casos de 1 GB pasaron seis; la muestra exportada PRJ-03 agotó 90 s en ambos intentos. Paquete Intel pasó 114 + 1 omitida y shell/md 344 + 7 omitidas, en sus fases separadas.

El ZIP del job CSV (`14613105083`, 33.929.767 bytes) coincide con SHA256 `e47f1ce72e2c1512cc8e052debd1c8d9ce3f2e9ac5f7f908ceb04417370cf259`. El [proof compacto](prj03-intel-validacion-2026-11-20/proof.json) conserva hashes de los JSON y las dos trazas, identidades de fase y recuentos. Los logs y trazas brutos permanecen privados.

## Medidas persistidas: ARM e Intel

Misma fuente sintética de **1.000.000.008 bytes / 1.000.000 registros**; SHA256 antes y después: `ad5e0f81fd1c132ed1347c7e717b14286aa7594294a9cd99df5d0bee756b4540`. Cada operación abre una app nueva; el hash de fixture calienta la fuente. La memoria es working set observado cada 50 ms, no una traza de syscalls ni una promesa de latencia. Son máquinas y fases distintas, sin repetirlas para esta documentación.

| Operación | ARM `32f531b` | Intel `46926de` | Pico CSV ARM / Intel (KiB) | Suma app ARM / Intel (KiB) |
| --- | --- | --- | --- | --- |
| Exportar filtro mitad | 20,347 s | 56,914 s | 277648 / 234012 | 852512 / 621860 |
| Cancelar exportación a mitad | 9,493 s | 31,759 s | 636864 / 607412 | 1185904 / 981600 |

Filtro: salida **500.000.008 bytes**, huella real y esperada `aa807009d987bc4d22f9a97d892edc5a43d6fe4cb38cd86574b5d6dbd863e81f` en ambas fases. Cancelar: outcome cancelado, sin salida ni resultado de manifiesto; la petición se hace con 503.316.480 bytes leídos y 498.000 registros examinados. Los originales [ARM filtro](prj03-exportar-conjuntos-2026-11-19/arm-filter-32f.json), [ARM cancelación](prj03-exportar-conjuntos-2026-11-19/arm-cancel-32f.json) y [ARM muestra](prj03-exportar-conjuntos-2026-11-19/arm-random-32f.json) mantienen su identidad y contexto. El informe ARM de muestra no se atribuye a Intel.

## Muestra Intel: tiempos de traza, sin informe de benchmark

En ambas tentativas, el await real de exportación de la línea 208 resolvió sin error: **47,042506 s / 63,150410 s de espera observada**. La fila de resultado aparece y se obtiene su metadata. Las **30.000 expectativas** de los tres checks de cada una de las diez mil filas terminaron todas sin error, ocupando **46,932830 s / 48,461320 s**. También pasan los oráculos de las líneas 222–225. After Hooks comienza antes de 227–229; `page.evaluate` en 229 encuentra la app cerrada durante el teardown, y el finally260 vuelve a fallar.

No se llega a escribir `prj03-export-random.json` ni a iniciar C15. Esos tiempos son del límite IPC observado y del bucle de oráculos, **no duraciones persistidas de un benchmark de muestra**, ni prueba de C15. No se observó un fallo de valores del CSV; el caso agotó su presupuesto después de la exportación y de las comprobaciones por fila.

`71729359` sustituye solo esos tres matchers por `assert.ok`, `assert.ok` y `assert.equal` de Node estricto. Conserva las diez mil filas, sus tres comprobaciones, todos los demás oráculos de bytes/hash/cobertura/C15, los otros bucles y los plazos. No modifica producto, motor ni dependencias. El mismo ajuste, con un comentario explicativo, se calificó localmente sobre `b074450` como se indica abajo. La calificación Intel continúa pendiente; no se elimina ni se convierte en verde el fallo anterior de `46926de`.

## Nueva fase ARM: oráculos de Node y C15 completados

Raíz calificó `b074450084636f0a2fb5c6258776357a9f79c9ad`, descendiente de `ad20345`: sin cambios de producto y con los tres checks por fila intactos, más un comentario sobre los eventos de traza. **1/1 aprobado**, sin retries, flaky u omisiones; **23,391019 s de reporte / 23,664 s de proceso**. Esta fase ARM es nueva y no reemplaza los informes ARM originales de `32f531b` ni el fallo Intel de `46926de`.

| Comprobación local sobre `b074450` | Resultado |
| --- | --- |
| Tipos | 0 errores y 0 advertencias; 9,029 s de proceso |
| Unitarias completas | 3065 aprobadas + 2 omitidas; 173 archivos aprobados + 1 omitido; 17,01 s de Vitest / 17,352 s de proceso; Pandoc real 3.12.1 |
| Build | Exit 0; 1,875 s de proceso |
| Exportación de muestra, JSON persistido | 18,165311250 s; 10.000 registros / 10.000 identificadores únicos; 10.000.008 bytes |
| Memoria durante esa exportación | Pico CSV 763664 KiB; suma app 1335712 KiB; muestras cada 50 ms |
| C15, JSON independiente | Añadir como fuente → Información completa en 650,000333 ms; 10.000 filas y columnas ID/Nota |

Los dos JSON sí se escribieron en esta nueva fase. La fuente conserva la huella `ad5e0f81…b4540`; la salida y su alta como fuente conservan `eeac7c2e8c861bf11dcbb1accbebafaf13b2119017db0c19d080ae22ef9deb3e`, con procedencia intacta. El proof registra las huellas completas de fuente, salida y ambos informes. C15 y la medición de exportación se mantienen separados. La duración de 18,165 s describe la exportación; 23,391 s es el caso con sus demás comprobaciones. No se presenta esta diferencia entre fases como una medición aislada de aceleración ni como un resultado Intel.

## macOS: fallo de CI y control local separados

En la [CI 44700465178, job macOS 136167390372](https://github.com/ruzer/freyalab/actions/runs/44700465178/job/136167390372), head `ad20345`, rápidas terminó con **220 aprobadas, 4 fallidas, 7 omitidas y 515 no ejecutadas**, con cuatro retries. Perf/solo terminó con **0 aprobadas, 3 fallos de lanzamiento y 63 no ejecutadas**, con tres retries. El snapshot archivado todavía tenía la corrida general en curso; estos recuentos son de ese job macOS, no de los otros sistemas.

El primer fallo fue el clic Negrita de `markdown-toolbar.spec.ts:151`: el botón se resolvía visible/habilitado/estable, pero el clic no terminaba antes de 30 s. Después hubo beforeEach de 90 s y lanzamientos de Electron de 60 s agotados. **Causa desconocida**: no se atribuyen a infraestructura ni se presentan como resueltos por cambiar las aserciones de la muestra. La fase de 1 GB no llegó a ejecutarse en ese job; es distinta del fallo Intel de `46926de`.

Raíz ejecutó aparte los dos archivos completos, Markdown toolbar y errores Mermaid, sobre `b074450` con dos workers y depuración de navegador privada: **41/41 aprobados en 32,067411 s de reporte** (32,1 s redondeado), sin retries ni omisiones. Ese control local no reprodujo los fallos; no demuestra su causa ni transfiere su cero de retries a CI. El proof solo incorpora hashes y contadores: no copia logs brutos de depuración, variables de entorno ni rutas privadas.

## Flaky de rangos y estados pendientes

`ui.spec.ts:428` falló en el oráculo de clipboard450: esperaba dos filas `00077\t00077\n00077\t00077\n`, recibió una. Click, Shift+ArrowDown, Shift+ArrowRight y ControlOrMeta+C terminaron sin error de API. El retry1 pasó. Su artifact no tiene traza DOM ni snapshot de selección/foco: **causa abierta, sin corrección aplicada**.

Raíz retiró el trigger temporal en `44f5`; verificó el diff vacío frente a `59d9077` y su push. La [CI 44700465178 de `ad20345`](https://github.com/ruzer/freyalab/actions/runs/44700465178) conserva el fallo macOS descrito; su corrida general estaba en curso en el snapshot archivado y no hereda el verde de `59d9077`. La calificación local del candidato ya está registrada; la nueva sonda Intel y la CI del head final se registrarán cuando existan, sin transferir aprobaciones de otro SHA. No hay rerun, GUI, prueba nueva, cambio de fuente ni modificación de CI por esta tarea documental.
