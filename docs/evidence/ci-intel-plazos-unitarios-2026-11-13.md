# Intel: plazos individuales para seis pruebas pesadas — 2026-11-13

## Alcance y rojo real

El cambio conserva las pruebas en Vitest y añade margen solamente a seis casos. No modifica la aplicación, fixtures, consultas, aserciones, dependencias, concurrencia ni plazos globales. Las etiquetas `@solo`/`@perf` pertenecen a Playwright: no se añade otro carril para estas unitarias.

Base de implementación: `2f6b58caa46443a903719d69e6a7e241817ac207`. Los tres archivos de pruebas eran idénticos a los de `052984378c1c1cce7d8785bd1150b0dc6fea56bc`, SHA de las dos mediciones anteriores.

- [Push anterior, 43263234108](https://github.com/ruzer/freyalab/actions/runs/43263234108/job/131339819351): 144 archivos aprobados y uno omitido; 2.730 pruebas aprobadas y 10 omitidas; suite de 241,72 s.
- [Nocturna roja, 43452894095](https://github.com/ruzer/freyalab/actions/runs/43452894095/job/131979432232): seis fallos por plazo, 2.724 aprobadas y 10 omitidas; suite de 432,69 s. Esta ejecución constituye el rojo previo al cambio, sin rebajar artificialmente plazos en local.

Ambas usaron macOS 15.7.9, imagen 20260824.0482.1, Node 24.19.0 y npm 11.17. La variación del total fue 1,79087×. No hay telemetría de CPU/RAM histórica que demuestre la causa física: no se atribuye a un número de núcleos ni a carga medida. El tiempo de cada caso tampoco creció por un factor uniforme.

## Presupuestos

| Caso | Push anterior (ms) | Nocturna roja (ms) | Plazo anterior → nuevo | Justificación |
| --- | ---: | ---: | --- | --- |
| `fillPrevious`, preview, 110.000 filas | 1.494 | 5.390, corte | 5 → 12 s | Doble del mayor registro de cancelación (5.454 ms), redondeado. |
| `fillPrevious`, apply, 110.000 filas | 1.852 | 5.454, corte | 5 → 12 s | Mismo presupuesto para los dos modos de la operación. |
| Eliminar 110.000 filas, deshacer y recuperación | 4.159 | 5.512, corte | 5 → 15 s | 4.159 × 1,79087 × 2 ≈ 14.896 ms. |
| Tendencia: oráculo de 300.000 filas frente a 2.000 dibujadas | 1.617 | 6.840, corte | 5 → 15 s | 6.840 × 2 = 13.680 ms, redondeado. |
| Búsqueda: 1 rango, lote 3 | 18.763 | 29.053, corte interno | 30 → 75 s | 18.763 × 1,79087 × 2 ≈ 67.204 ms, redondeado. |
| Búsqueda: 2 rangos, lote 1 | 14.787 | 30.082, corte de Vitest | 30 → 75 s | Mismo margen para las dos configuraciones afectadas. |

Los tiempos rojos están censurados por un corte: no son mediciones del trabajo completo. El margen evita falsos fallos del arnés; no es una promesa de rendimiento. En búsqueda se conserva un segundo del presupuesto para cerrar hilos. El caso preexistente 1 rango/lote 1 conserva 60 s; las otras nueve combinaciones conservan 30 s. `fillEmpty` conserva sus 12 s previos; las cancelaciones de eliminación conservan su plazo anterior.

## Integridad del cambio

Revisión independiente del diff: mismos nombres y casos, tamaños, consultas, fixtures y aserciones. Se conservan Unicode, orden completo, equivalencia de páginas, archivo original, historial, cancelación, deshacer y recuperación. No cambia ningún límite del producto ni su respuesta a Cancelar.

## Validación local

macOS Apple silicon, Node 24.22.1. No es una medición Intel.

| Comando | Resultado |
| --- | --- |
| `npm run check` | Aprobado; 0 errores y 0 advertencias. |
| `npm test` | 145 archivos aprobados; 2.739 pruebas aprobadas, 1 omitida; 17,65 s. La omisión es el caso Windows ya existente de `package-smoke.test.ts`. |
| `npm run build` | Aprobado. |
| `git diff --check` | Aprobado. |

## Después: medición real Intel

[Sonda aislada 43489383399, intento 1](https://github.com/ruzer/freyalab/actions/runs/43489383399/job/132106189108), SHA `c54abfebbf16057470b75324a87ae163eb9081a3`. Las pruebas medidas son las del commit de implementación `4bc50b2ae52bd7c3b2c941c4884f729ac05a83e2`; el único añadido de la sonda es su workflow temporal, limitado a un push en su propia rama, sin PR. Este workflow no forma parte de la entrega.

Se ejecutó **`npm test` completo**, sin filtros, reintentos ni cambios de workers/pool, con los reporteros nativos `default` y `json`. Resultado: **2.730 aprobadas, 10 omitidas, cero fallos**; 144 archivos aprobados y uno omitido. Las omisiones existentes son nueve casos que requieren Pandoc y uno exclusivo de Windows (`package-smoke.test.ts`); coinciden con las mediciones históricas. Ninguno de los seis casos objeto de esta corrección se omite.

| Caso | Push anterior, Intel (ms) | Nocturna roja, Intel (ms, cortados) | Después, Intel (ms, completos) | Resultado |
| --- | ---: | ---: | ---: | --- |
| `fillPrevious`, preview | 1.494 | 5.390 | 1.465,357 | Aprobado |
| `fillPrevious`, apply | 1.852 | 5.454 | 1.608,251 | Aprobado |
| Eliminar 110.000 filas y recuperar | 4.159 | 5.512 | 3.494,078 | Aprobado |
| Tendencia, 300.000 filas | 1.617 | 6.840 | 2.173,233 | Aprobado |
| Búsqueda, 1 rango/lote 3 | 18.763 | 29.053 | 21.353,770 | Aprobado |
| Búsqueda, 2 rangos/lote 1 | 14.787 | 30.082 | 16.347,928 | Aprobado |
| Suite completa (s) | 241,72 | 432,69 | 261,15 | Cero fallos después |

El paso de pruebas duró 264 s y el job completo 335 s (incluye preparación e instalación). La suite posterior fue un 8 % más lenta que el push verde histórico. **No se afirma una aceleración del producto**: se ajustó la tolerancia del arnés a variaciones ya observadas. Una ejecución posterior exitosa no reproduce ni garantiza todas las condiciones de la nocturna fallida.

### Entorno y trazabilidad

Node 24.19.0 y npm 11.17, fijados para comparar con el histórico; macOS 15.7.9 (24G830), arquitectura x64, Intel Core i7-8700B a 3,20 GHz. El runner expuso cuatro CPU lógicas/`availableParallelism`, 15.032.385.536 B de memoria total y 7.568.457.728 B libres antes de las pruebas. `loadavg`: 21,027832 / 19,709473 / 9,087402. Son una fotografía previa, no una medición continua ni evidencia de la carga histórica.

Los SHA-256 registrados por el runner coinciden con los archivos de la entrega:

| Archivo | SHA-256 |
| --- | --- |
| `tests/table-empty.test.ts` | `5b705f94686ee5906952ae16814a78aa05a1b81c0c9bceb2077ccd386f65662d` |
| `tests/chart-trend.test.ts` | `c64ec329ce293569f6db51083d5bf8b157b059e839b75a43d9c195f91e03991e` |
| `tests/large-search-runtime.test.ts` | `54a9423639f59f5583003342f1486bf1d60d2caf55c79d40acaba51bc2ca0082` |

Artefacto de esa corrida: `intel-unit-budget-probe`, con `vitest.json`, `unit.log` y `environment.txt`. Se preservan mediciones y nombres originales; no se publican variables de entorno ni URLs de descarga firmadas.

## CI final y límites de verificación

La rama de entrega no cambia workflows. Su plan, obtenido con `git diff --name-only --no-renames -z origin/main...HEAD | node scripts/ci-areas.mjs --stdin`, selecciona tipos, todas las unitarias y el área Shell obligatoria, sin forzar Markdown/CSV ni el paquete. El estado y los enlaces de la CI del head final se registran en el PR para no cambiar el SHA sólo por actualizar evidencia. El verde de la sonda Intel califica su SHA; no se transfiere al head final. Los hashes anteriores acreditan la igualdad de los tres archivos medidos.

No se repitió localmente toda la suite E2E ni se probaron instaladores: no hay cambios de producto, interfaz, guardado ni empaquetado. Tampoco se repitió la nocturna completa ni se midió rendimiento del producto, velocidad de cancelación o CPU/RAM durante cada prueba. No se instaló ninguna versión ni se fusionó código. El riesgo residual es una ejecución aún más lenta que el margen observado; los plazos continúan siendo finitos y todas las aserciones siguen activas.
