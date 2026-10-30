# Plazo funcional de búsqueda · excepción autorizada

El propietario autorizó el 2026-10-29 ampliar **únicamente** el caso `1 rangos reales, lote 1` de 30 a 60 segundos, con evidencia real por plataforma. La espera interna pasa de 29 a 59 s, conservando un segundo para cerrar hilos. Este commit propio parte de `main` (`832207b`); no pertenece a la implementación ED-01.

## Cambio cerrado

Dos líneas de tests/large-search-runtime.test.ts. Se mantienen las 13.500 filas, cuatro consultas y oráculos, lectura de todas las páginas y comprobación del archivo original. Los otros 11 casos conservan30/29 s. No se cambian configuración, workflows, workers, fuentes, dependencias ni aserciones. Memoria de 1 GiB, cancelación de 1 s y límite real de Markdown de 2 s permanecen intactos. El plazo detecta que una comprobación funcional no termina; no es un compromiso de velocidad del producto.

## Rojo real y comparación

Los archivos del caso y los motores son idénticos en las ejecuciones comparadas. El caso falló al agotar 29 s en Intel: CI249/9310576(29.017ms), CI250/9dbf342(29.034ms), CI252/27df250(29.014ms). No falló una aserción de valores en esos intentos; al abortarse no se conoce su tiempo de finalización.

Antes del cambio, main (`832207b`) pasó el caso en 23.572 ms y CI246/head929 en 16.343 ms. CI251/56d7f60 también aprobó las unitariasIntel sin cambiar plazos; no se transfiere ese verde a otra rama. Los datos demuestran variación entre ejecuciones, **no identifican la causa**. Los otros ocho fallosIntel de CI250 no reciben ninguna excepción mediante este commit.

- CI249: https://github.com/ruzer/freyalab/actions/runs/40992549768
- CI250: https://github.com/ruzer/freyalab/actions/runs/40997401254
- CI252: https://github.com/ruzer/freyalab/actions/runs/40998269294

## Comprobación local real

Mac Apple silicon (arm64), macOS 27.0.1, Node 24.22.1, Vitest 5.0.5, ejecución exclusiva sin Electron ni otras tareas pesadas. Comando: `node node_modules/vitest/vitest.mjs run tests/large-search-runtime.test.ts -t '^1 rangos reales, lote 1:' --reporter=verbose`.

Resultado: código0, **1 caso pasado en 1.330 ms**,11 casos no seleccionados por el filtro, 1,55 s de ejecución total. No es la suite completa ni acredita los otros 11 casos. El log original se conserva junto a la propuesta en la evidencia local. `git diff --check` dio0. La fuente del producto, package.json, lockfile y CI tienen diff vacío respecto a main (`832207b`).

## Tiempos del caso con el nuevo plazo

| Plataforma | Evidencia | Estado |
|---|---|---|
| macOS Apple silicon local | Foco con 13.500 filas y todas las aserciones: 1.330 ms | Comprobado localmente |
| macOS Intel remoto | Nuevo head con este commit | Pendiente |
| Windows remoto | Nuevo head con este commit | Pendiente |
| Ubuntu remoto | Nuevo head con este commit | Pendiente |
| macOS Apple silicon remoto | Nuevo head con este commit | Pendiente |

Los números remotos se añadirán al cuerpo de los PR sin commits de estado, una vez que sus jobs terminen y permitan descargar los logs. No se declara aprobado un caso no ejecutado.

## Seguimiento de rendimiento

Se conservan las mediciones S0/producto L4a y experiments/large-search-product/bench.ts, además de las comprobaciones permanentes de cancelación <1 s. **No se encontró un @perf automatizado de throughput de este recorrido LargeViews.** Los E2E de búsqueda/filtros utilizan fixtures de 2–3 mil registros con umbral de archivo grande forzado; el @perf de búsqueda sobre más de 50 MiB sólo comprueba una muestra de 200 registros. No se presenta como medición integral. Queda pendiente diseñar ese @perf específico; no se incorpora fuera del alcance de este ajuste de plazo.

## Límites

Aún no se han ejecutado aquí check, unidad completa, E2E completo ni build para este commit de pruebas. No se repite una suite de interfaz para obtener un verde artificial: este cambio no modifica la fuente del producto. Las ramas de integración mantendrán su evidencia local de fuente y deberán obtener CI de las cuatro plataformas y prueba del paquete sobre sus heads finales que incorporen el ajuste. Ninguna instalación, publicación o fusión de PR forma parte de este cambio.
