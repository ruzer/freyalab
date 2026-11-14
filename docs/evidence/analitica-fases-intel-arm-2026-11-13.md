# Analítica CSV: fases Intel/ARM y correcciones verificadas

Estado de esta evidencia: **validación local enfocada y medición posterior satisfactorias; CI del head final pendiente**. No se fusiona ni publica. No se declara una suite completa verde.

## Código y prerrequisito

- Base de producto: `9308149778d9635440918d7d79a3add754243d6e`.
- [CI de main 43545347398](https://github.com/ruzer/freyalab/actions/runs/43545347398): **SUCCESS, siete trabajos**, incluidas las unitarias Intel. Este resultado pertenece a la base, no al head de entrega.
- Intento inicial de configurar la sonda: [43549690355](https://github.com/ruzer/freyalab/actions/runs/43549690355), **cero jobs ejecutados** por un contexto `env` no permitido en la configuración. No produjo mediciones; la configuración se corrigió en `3fadd6a` antes del baseline siguiente.
- Sonda inicial: [43550207123](https://github.com/ruzer/freyalab/actions/runs/43550207123), SHA `3fadd6ac5fc134b077c6ecaa94afffc09510f680`, **36/36 observaciones passed**.
- Head local corregido: `ba2704853cb68248184dddc50a2d491477a9b0b6`.
- Sonda posterior: [43552650063](https://github.com/ruzer/freyalab/actions/runs/43552650063), SHA `070994ef8421d34d0d3dd75d7c011202a724e6b4`, **36/36 observaciones passed**. No sustituye la CI completa del head final.

La [comparación completa de subfases](analysis-phases-intel-arm-2026-11-13/comparison.md) conserva lectura, codificación, append, consulta, materialización, transferencia y dibujo, con sus rangos por arquitectura/contexto. Los [registros rojo/verde](analysis-phases-intel-arm-2026-11-13/SHA256SUMS.txt) se incluyen junto a los resúmenes.

## Qué se midió

Tres procesos nuevos por combinación de arquitectura, contexto y caso; ventana 1280×720. Desarrollo cubre cuatro casos por arquitectura; paquete cubre constructor y SQL de más de 50 MiB por arquitectura. Son 12 combinaciones × tres observaciones, no 36 repeticiones de cada caso.

| Arquitectura | Equipo del runner | CPU lógicas | RAM | macOS kernel | Node | Electron |
|---|---|---:|---:|---|---|---|
| arm64 | Apple M1 (Virtual) | 3 | 7 GiB | 24.6.0 | 24.22.2 | 44.9.2 |
| x64 | Intel Core i7-8700B a 3,20 GHz | 4 | 14 GiB | 24.6.0 | 24.19.0 | 44.9.2 |

El [resumen compacto](analysis-phases-intel-arm-2026-11-13/baseline-summary.compact.json) conserva versiones, fixtures, medianas/rangos, tres hashes de registros originales por combinación y el hash del resumen original. Se verificaron los **36 hashes originales**, todos sus estados passed y **54 comprobaciones de fixture con hash y mtime conservados**. No contiene SQL, valores de celdas ni rutas privadas. Las observaciones originales completas se mantienen separadas; no se duplican aquí.

### Fases iniciales

Segundos: mediana [mínimo–máximo], n=3. Cada observación suma sus jobs completos antes de calcular estos estadísticos. Los oráculos y calentamientos se excluyen y contabilizan aparte en el JSON.

| Arquitectura | Contexto | Caso | Perfiles | Arranque ventana + motor | Carga de fuente | Consulta | Materializar filas | Entrega aprox. | SVG presentado |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| arm64 | development | F2b · 200 campos | 3.206 [3.188–3.671] | 1.443 [1.347–2.419] | 0.145 [0.121–0.216] | 0.150 [0.135–0.213] | 0.000 [0.000–0.000] | 0.001 [0.001–0.001] | 0.023 [0.021–0.041] |
| x64 | development | F2b · 200 campos | 14.120 [13.003–14.514] | 4.949 [4.538–5.661] | 0.469 [0.421–0.549] | 0.573 [0.390–0.759] | 0.001 [0.001–0.002] | 0.002 [0.002–0.002] | 0.071 [0.069–0.086] |
| arm64 | development | TEN-1 · 300.000 filas | — | 2.068 [1.703–2.360] | 7.704 [6.873–8.540] | 0.458 [0.391–0.598] | 0.053 [0.047–0.057] | 0.004 [0.004–0.007] | 0.182 [0.165–0.283] |
| x64 | development | TEN-1 · 300.000 filas | — | 5.401 [4.291–6.179] | 22.394 [22.140–23.998] | 1.325 [1.274–2.013] | 0.226 [0.204–0.331] | 0.016 [0.014–0.025] | 0.611 [0.527–0.646] |
| arm64 | development | Constructor explícito | 0.043 [0.016–0.053] | 9.294 [9.294–11.911] | 0.519 [0.505–0.729] | 0.909 [0.896–1.157] | 0.003 [0.002–0.003] | 0.007 [0.007–0.009] | 0.157 [0.131–0.174] |
| x64 | development | Constructor explícito | 0.082 [0.063–0.189] | 32.281 [31.093–33.196] | 1.528 [1.437–1.628] | 2.881 [2.714–2.902] | 0.007 [0.007–0.008] | 0.018 [0.016–0.024] | 0.367 [0.322–0.419] |
| arm64 | development | SQL · 55.227.700 bytes | — | 0.832 [0.699–1.286] | 4.609 [4.457–7.615] | 0.047 [0.021–0.060] | 0.000 [0.000–0.001] | 0.001 [0.000–0.001] | — |
| x64 | development | SQL · 55.227.700 bytes | — | 2.442 [2.337–2.971] | 16.896 [15.753–17.555] | 0.057 [0.056–0.083] | 0.001 [0.000–0.001] | 0.001 [0.001–0.002] | — |
| arm64 | packaged | Constructor explícito | 0.061 [0.027–0.072] | 12.325 [12.206–12.909] | 0.709 [0.688–0.727] | 1.167 [1.091–1.313] | 0.004 [0.003–0.004] | 0.009 [0.008–0.011] | 0.172 [0.169–0.175] |
| x64 | packaged | Constructor explícito | 0.078 [0.057–0.092] | 31.155 [25.575–32.742] | 1.599 [1.370–1.658] | 2.696 [2.299–2.981] | 0.006 [0.006–0.007] | 0.018 [0.017–0.021] | 0.319 [0.263–0.354] |
| arm64 | packaged | SQL · 55.227.700 bytes | — | 0.809 [0.792–0.939] | 4.725 [4.347–5.271] | 0.034 [0.026–0.041] | 0.000 [0.000–0.000] | 0.001 [0.001–0.001] | — |
| x64 | packaged | SQL · 55.227.700 bytes | — | 2.377 [1.791–3.925] | 12.743 [11.832–20.769] | 0.043 [0.042–0.049] | 0.000 [0.000–0.000] | 0.001 [0.001–0.001] | — |

Interpretación y límites de medida:

- `sourceLoad` contiene lectura, codificación y append. **No se suma otra vez con esas subfases.** `chartRendered` contiene opciones y setOption; `chartPainted` añade dos requestAnimationFrame. Tampoco se suman entre sí.
- Arranque se calcula como ventana + motor por observación y luego se resume. No se atribuye toda esa duración a WASM ni se presenta la suma de medianas como mediana del total.
- Entrega aproxima despacho/serialización restando duraciones, sin comparar relojes de procesos distintos. No aísla el transporte físico. SVG presentado es una oportunidad de presentación del navegador, no una medida de píxeles físicos.
- Runners compartidos y tres muestras no demuestran un tiempo garantizado para usuarios, ausencia de carreras ni estabilidad de toda la CI.

### Fixtures reproducibles

| Fixture sintético | Bytes | SHA-256 |
|---|---:|---|
| `campos.csv` | 3,110 | `88cbe9b7ea6124255ad616dfd05a1d9ad001eca7278a1ab464f28d9ea1ee887f` |
| `fuente-completa.csv` | 55,227,700 | `58726401f47caac31611be16a2779e699d91dfe39c76ac7375d0227aba22d7f1` |
| `ids.csv` | 106 | `f2fafd946490f94feb015c601497847885e7463c220b3705673ec373a2c43e1a` |
| `many.csv` | 14,895,498 | `f5975ee6e5cb001a3bf3838b3b87cf06c0ecd92a3ad08bec995833effe004b2f` |
| `plots.csv` | 124 | `8a85e53f26ca10a4e804c25bd637c7a0c8b220c6cdb98c5d5a7608214c05d4e2` |
| `ventas.csv` | 281 | `5d2b18ce8983effce8ddea6bc68b0a3a9b25a3b655bc1a4a048e87b30011538b` |

## Diagnóstico y cambio mínimo

| Ruta | Diagnóstico respaldado por la sonda | Corrección / límite conservado |
|---|---|---|
| F2b, 200 campos | Intel dedica 14,120 s a perfiles; 0,573 s dentro de los 200 handlers. La interfaz exponía tipos parcialmente calculados y reactividad repetida. | Publicar el lote de perfiles, muestras y tipos conjuntamente. Se mantienen solicitudes en serie: paralelizarlas cancela solicitudes del mismo documento. Sin IPC batch, caché nueva ni detector de tipos. |
| TEN-1, 300.000 filas | Dos cargas completas; carga acumulada Intel 22,394 s frente a consulta 1,325 s. | Omitir exclusivamente la segunda consulta de totales en dispersión y líneas sin agrupación temporal: su total era nulo. El resto conserva totales recalculados por el motor. |
| SQL >50 MiB | Intel: append 11,634 s, consulta 0,057 s. La decodificación ejecutaba un callback JavaScript por byte. Append también incluye transporte, Arrow e inserción: no se atribuye todo al decodificador. | Usar `Uint8Array.fromBase64`, nativo en Chromium 152 / Electron 44.9.2. Mock de Node verifica delegación e integridad del adaptador; la E2E real verifica el resultado del motor. |
| Constructor explícito | La prueba agrupaba ocho oráculos y recorrido UI en un plazo global de 90 s. El rojo histórico termina con solo 8,823 s / 6,126 s restantes para una aserción configurada a 30 s. | Dos casos en el mismo proyecto y archivo: oráculos numéricos y recorrido UI. No se aumentan plazos ni se eliminan aserciones. |
| Estado SQL | «Preparando motor local» continuaba durante carga, consulta y lectura de resultados. | Fases reales en es/en/en-XA, visibles y anunciadas. Comprobar cancelación antes de publicar avances posteriores a append. |

No se incorpora motor persistente ni se combinan consultas con UNION: cambiarían aislamiento/memoria o podrían exceder juntos el límite de resultados de 8 MiB que cada consulta respetaba por separado. No se cambian valores, límites, exportaciones, guardado ni contratos de `chartSQL`.

### Conservación de las aserciones del constructor

Rojo real: [43477798498](https://github.com/ruzer/freyalab/actions/runs/43477798498), SHA `2f6b58c`, job Intel CSV `132066110181`; alcanzó el plazo global inicialmente y al reintentar.

Comparación de cadenas completas de expectativas mediante AST: **31 aserciones originales, 33 después, ninguna original ausente**. Las dos añadidas comprueban integridad en la nueva sesión numérica; las originales de archivo y DocumentInfo siguen en UI. Los 62/66 nodos de llamada contaban `expect()` y matcher por separado: **no son el número de aserciones**.

Los 14 jobs UI de la sonda no son un recuento exacto del E2E original: la sonda no reproduce el clic Generar de B después del resultado automático. Esa redundancia original se conserva. Separar añade una sesión Electron; no se promete una reducción del tiempo total de la suite por esa división.

## Rojo → verde

| Corrección | Rojo conservado | Verde comprobado |
|---|---|---|
| Publicación atómica de 200 perfiles | `red-fields.log`: 1 fallo, tipos provisionales expuestos mientras se anuncian perfiles en lectura. No usa un presupuesto artificial de milisegundos. | `green-ui.log`: caso pasó (1,6 s); `focused-e2e.log`: volvió a pasar (1,2 s). Badge/tipos, montos e identificadores, bytes y revisión se comprueban. |
| Decodificación nativa | `red-append.log`: 1 fallo / 8 pases; no se delegaba a fromBase64 y se ejecutaba mapfn por byte. | `green-append-progress.log`: 16/16 en tres archivos, 179 ms. Incluye bytes 0–255 y longitudes distintas; el fake nativo de Node no prueba la implementación de Chromium. |
| Una carga cuando total es nulo | `red-single-load.log`: 2 fallos, dispersión y líneas sin fechas enviaban dos sqlRun. | `focused-e2e.log`: ambos pasan, 2,6 s cada uno, oráculo real DuckDB, datos/revisión/CSV, tabla/pivot y exportación SVG. |
| Mensajes reales de progreso | `red-sql-progress.log`: 3 fallos / 2 pases, es/en/en-XA. | `green-sql-progress.log`: 7/7 en dos archivos, 209 ms; E2E es/en/en-XA y gráfico pasan en `green-ui.log` y la enfocada. |
| No publicar progreso tardío tras cancelar | `red-progress-cancel.log`: 1 fallo / 4 pases: aparecía un tercer aviso después de cancelar en append. | `green-progress-cancel.log`: 5/5, 163 ms; incluido también en la suite unitaria final de ba27048. |
| Constructor separado | Rojo histórico real descrito arriba. | Ambos nuevos casos pasan en `focused-e2e.log`, con las 31 aserciones originales conservadas. No se fabricó un plazo reducido para producir rojo. |

## Validación local registrada

| Ejecución | Resultado real | Código / límite |
|---|---|---|
| `npm run check` | 0 errores y 0 advertencias de svelte-check; TypeScript sin error. | `frozen-check.log`, ba27048. |
| `npm test` (completo) | 149 archivos passed; 2.757 pruebas passed, 1 skipped; 24,13 s. | `final-unit.log`, ba27048. La omisión es el caso de hijo Windows superviviente de `package-smoke.test.ts`, no aplicable al Mac local. |
| E2E enfocadas, un worker, cero reintentos | 13/13 passed, 1,1 min. | `focused-e2e.log`. Anterior únicamente al pequeño check de cancelación; ese check tiene rojo/verde unitario propio y está en la suite final. |
| `npm run build` | main, preload y renderer construidos; renderer 2,16 s. | Construcción registrada al inicio de `full-e2e.log` sobre ba27048. El éxito de construir no es éxito de toda esa suite E2E. |
| Suite E2E local completa | **Sin conclusión verde.** ED-01 no obtuvo foco en el documento GRANDE antes de medir su plegado; causa exacta y resultado final pendientes. | No se cuenta como validación satisfactoria del head ni se oculta el fallo. La traza no aporta DOM para demostrar su causa. |

Comando enfocado ejecutado (se omiten solo prefijos de energía/PATH y carpeta temporal de salida):

```sh
npx playwright test tests/e2e/chart-single-load.spec.ts tests/e2e/chart-field-loading.spec.ts tests/e2e/sql-progress-states.spec.ts tests/e2e/chart-fields.spec.ts tests/e2e/chart-trend.spec.ts tests/e2e/charts.spec.ts tests/e2e/sql.spec.ts --project=csv --workers=1 --retries=0 --grep '200 campos|300 000 filas|constructor explícito|mayor de 50 MiB|fases reales|misma fase|carga la fuente'
```

Pandoc 3.12.1 real estuvo disponible y sus pruebas locales se ejecutaron. Ese binario está compilado **sin soporte HTTP**: cero peticiones no demuestra la eficacia del sandbox HTTP de un binario capaz de HTTP. No se atribuye esa cobertura a estas correcciones de analítica.

## Medición posterior: mismo montaje, 36/36 passed

[43552650063](https://github.com/ruzer/freyalab/actions/runs/43552650063), SHA `070994ef8421d34d0d3dd75d7c011202a724e6b4`: tres observaciones por cada una de las 12 combinaciones anteriores, cero jobs SQL incompletos. Los seis fixtures conservan nombres, bytes y hashes respecto al baseline; las 54 comprobaciones posteriores también conservan hash y mtime.

El [resumen posterior compacto](analysis-phases-intel-arm-2026-11-13/after-summary.compact.json) y el baseline conservan los tres hashes originales de cada grupo. La ruta objetivo pasa de 204 a 198 jobs SQL completos; incluyendo calentamientos y oráculos se capturan 312 → 306. El cambio de seis corresponde a TEN-1: dos cargas → una en cada una de sus tres repeticiones por arquitectura.

Misma tabla y unidades que antes: segundos, mediana [mínimo–máximo], n=3. — indica que la fase no se midió o no corresponde, no un tiempo cero.

| Arquitectura | Contexto | Caso | Perfiles | Arranque ventana + motor | Carga de fuente | Consulta | Materializar filas | Entrega aprox. | SVG presentado |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| arm64 | development | F2b · 200 campos | 0.409 [0.389–0.457] | 1.835 [1.805–2.526] | 0.240 [0.182–0.267] | 0.208 [0.189–0.242] | 0.000 [0.000–0.001] | 0.001 [0.001–0.003] | 0.034 [0.031–0.036] |
| x64 | development | F2b · 200 campos | 1.357 [0.937–2.167] | 5.073 [4.036–5.756] | 0.395 [0.334–0.469] | 0.318 [0.310–0.592] | 0.001 [0.001–0.001] | 0.002 [0.002–0.005] | 0.054 [0.054–0.075] |
| arm64 | development | TEN-1 · 300.000 filas | — | 1.122 [1.048–1.580] | 4.102 [3.582–5.044] | 0.633 [0.530–0.753] | 0.116 [0.091–0.125] | 0.009 [0.007–0.013] | 0.270 [0.251–0.340] |
| x64 | development | TEN-1 · 300.000 filas | — | 1.760 [1.611–2.216] | 7.670 [7.029–9.887] | 1.196 [0.871–1.346] | 0.148 [0.148–0.214] | 0.012 [0.010–0.014] | 0.514 [0.354–0.543] |
| arm64 | development | Constructor explícito | 0.058 [0.053–0.078] | 13.752 [13.519–14.263] | 0.844 [0.795–0.853] | 1.401 [1.342–1.416] | 0.004 [0.003–0.005] | 0.010 [0.010–0.011] | 0.192 [0.178–0.193] |
| x64 | development | Constructor explícito | 0.058 [0.046–0.157] | 25.862 [21.362–35.815] | 1.367 [1.042–1.567] | 2.444 [1.986–3.152] | 0.007 [0.005–0.008] | 0.022 [0.017–0.028] | 0.331 [0.318–0.359] |
| arm64 | development | SQL · 55.227.700 bytes | — | 1.296 [1.009–1.586] | 2.984 [2.718–3.053] | 0.043 [0.033–0.048] | 0.000 [0.000–0.001] | 0.001 [0.001–0.001] | — |
| x64 | development | SQL · 55.227.700 bytes | — | 2.336 [1.466–2.960] | 5.133 [4.709–6.432] | 0.038 [0.037–0.043] | 0.000 [0.000–0.000] | 0.001 [0.001–0.002] | — |
| arm64 | packaged | Constructor explícito | 0.049 [0.036–0.067] | 14.555 [14.358–15.494] | 0.917 [0.786–0.918] | 1.470 [1.251–1.485] | 0.004 [0.003–0.004] | 0.012 [0.011–0.013] | 0.208 [0.207–0.209] |
| x64 | packaged | Constructor explícito | 0.067 [0.038–0.071] | 21.595 [21.082–22.595] | 1.084 [1.021–1.095] | 1.817 [1.776–1.961] | 0.005 [0.005–0.005] | 0.020 [0.017–0.040] | 0.313 [0.309–0.320] |
| arm64 | packaged | SQL · 55.227.700 bytes | — | 1.414 [0.925–1.704] | 2.799 [1.859–3.040] | 0.062 [0.036–0.072] | 0.000 [0.000–0.000] | 0.002 [0.001–0.003] | — |
| x64 | packaged | SQL · 55.227.700 bytes | — | 1.516 [1.419–3.334] | 4.888 [3.876–6.257] | 0.032 [0.030–0.034] | 0.000 [0.000–0.001] | 0.001 [0.001–0.001] | — |

### Resumen antes → después

Segundos, mediana de tres; los rangos están en las tablas y JSON. No son fases aditivas ni garantías universales.

| Ruta y subfase | ARM | Intel |
|---|---:|---:|
| 200 campos: perfiles | 3.206 → 0.409 | 14.120 → 1.357 |
| 200 campos: hasta resultado visible | 6.015 → 4.184 | 22.538 → 9.618 |
| TEN-1: carga de fuente | 7.704 → 4.102 | 22.394 → 7.670 |
| TEN-1: hasta resultado visible | 10.870 → 6.766 | 31.250 → 11.773 |
| SQL >50 MiB: lectura | 1.222 → 1.967 | 4.281 → 3.587 |
| SQL >50 MiB: append | 3.332 → 0.832 | 11.634 → 1.385 |
| SQL >50 MiB: hasta resultado visible | 6.456 → 5.206 | 20.692 → 9.353 |
| SQL >50 MiB empaquetado: append | 3.362 → 0.807 | 9.155 → 1.343 |
| SQL >50 MiB empaquetado: hasta resultado visible | 6.462 → 5.387 | 16.090 → 7.515 |
| Constructor: arranque acumulado de 14 jobs UI | 9.294 → 13.752 | 32.281 → 25.862 |
| Constructor empaquetado: arranque acumulado de 14 jobs UI | 12.325 → 14.555 | 31.155 → 21.595 |

Los perfiles de 200 campos conservan las 200 solicitudes por observación. El cambio elimina la publicación parcial, no los handlers: en Intel el tiempo de perfiles baja de 14,120 a 1,357 s, mientras los handlers suman aproximadamente 0,573 → 0,598 s. Esto respalda el coste de la publicación reactiva repetida; no demuestra que todo el tiempo exterior a handlers fuera CPU de interfaz.

La mejora de append se observa tanto en desarrollo como en paquete. TEN-1 elimina una carga completa. El constructor conserva 14 jobs de la sonda: no se atribuye a estas correcciones la variación del coste de arranque; ARM resulta más lento después e Intel más rápido. Metadatos idénticos no implican carga idéntica del anfitrión. El cambio de prueba separa sus responsabilidades sin prometer un motor más rápido.

### Identidad del montaje

Verificado con `git show` de ambos SHA completos: estos tres archivos del harness son idénticos byte a byte; los hashes también constan en `harness-identity.json` de la evidencia original.

| Archivo | SHA-256 en ambas sondas |
|---|---|
| `experiments/analysis-phases/analysis-phases.spec.ts` | `0b6febaf5ab265866bacb0deaacc81920d0371b812dc3c631e54adf269f2acae` |
| `experiments/analysis-phases/playwright.config.ts` | `8072d399a5c0898dd2b097fe04f862b4ea9937687b1c6f7af25bd2020b569292` |
| `experiments/analysis-phases/tsconfig.json` | `f0c7aac80836fe4d8399a420a2a3d3ac04a08b1391522579c347aec1214e3d4f` |

Coinciden además por arquitectura/contexto los metadatos registrados: CPU, núcleos lógicos, RAM, kernel, Node y Electron de la tabla inicial. Cada observación usa un proceso nuevo y la misma ventana 1280×720. Esto controla la definición de la sonda y la fuente, no la carga externa del runner.

## CI del head final: pendiente

La sonda posterior pasó; **aún no acredita una corrida Intel completa sin reintentos ni una CI final verde**. El head final incorporará esta evidencia; su resultado se registrará en el PR sin cambiarlo solo para actualizar una tabla.

| Dato | Estado |
|---|---|
| SHA final con evidencia | Pendiente del commit de documentación. |
| CI Ubuntu / Windows / macOS ARM del head final | Pendiente. |
| Corrida completa Intel sin `retry #1` | Pendiente. |
| Suite E2E local completa | Terminada: 659 passed, 7 skipped y 2 failed sobre 2661e8e; ver actualización de validación. |

En el caso ED-01 (línea 33), la prueba no obtuvo foco en GRANDE antes de medir el plegado. La traza registra 106 clics y comprobaciones de foco, pero no contiene DOM ni captura que permita demostrar la causa exacta. No se atribuye a un bloqueo del motor, al tamaño por sí solo ni a estas correcciones CSV. No se modifica ese caso dentro de este bloque.

No se verifica aquí instalación, Gatekeeper, hardware Intel físico del usuario, cuatro plataformas del head final ni ausencia general de intermitencias. No se amplían plazos para ocultar lentitud de la app.

## Integridad de registros utilizados

Hashes de los registros terminados incluidos en esta entrega. Los logs versionados eliminan únicamente colores ANSI y espacios finales; los originales sin normalizar siguen conservados en la evidencia local. La conclusión de la suite completa se conserva en la actualización de validación; no se publica un hash provisional. Los hashes de registros originales de la sonda están en el JSON compacto y se verificaron contra sus bytes.

| Registro | SHA-256 |
|---|---|
| `red-fields.log` | `8204af4c67e8f6606634d40c509512b0d74711f2b50d594ee8f3d11f792539d2` |
| `red-append.log` | `3fcfed6dfbf0471e9c16f09b7384e75b7c17fec72377b4f5b95f47a6d1d54f00` |
| `red-single-load.log` | `dd833a70e95821b4f4bada46d74480ed489043fee837303df39e8008e7f9962e` |
| `red-sql-progress.log` | `bc2047b94bf9180c3602d8bbf2ed5312b0b2fecbfcd70a29019d2de96d76b81b` |
| `red-progress-cancel.log` | `a085285235b47389658cbda3b3a627bf84b9324943ff1d669f373966d81f1cae` |
| `green-ui.log` | `653d4c39b4e0b9485cbc70e3e79bcdaa77fc769da5bbd8c9c38a1c46918364b9` |
| `green-append-progress.log` | `ff8b6b14bd712eacdf45d0cac242fda7c97b07ac58176e93d0b49cc12ec0f48d` |
| `green-sql-progress.log` | `4489af89cbe0678c784dde60dc14e43ee62216216086d5dc6393dd7152575898` |
| `green-progress-cancel.log` | `a83dcc3f5eef7d7b1db100b845e89cadbd08e8ebd231238015c5667d043eaeb2` |
| `final-unit.log` | `2754ff1c775f21eb5a37cecb5644788231ecd6ba5f5fd6c1f23de08c8c27dfd2` |
| `focused-e2e.log` | `c51bb6b09a1ae71265eb942376eba0604cd23662e989aa9298f07a1790de153a` |
| `frozen-check.log` | `3b80d44be67f88fc9da4bbd10a7d957cb8156545c108e3632fd03ac945b7a20f` |

## Actualización de validación: consumidor del progreso

La suite completa sobre `2661e8e` terminó con **659 passed, 7 skipped y 2 failed en 26,5 min**, sin reintentos. Las siete omisiones son las E2E Word condicionadas al ejecutable de Pandoc real configurado para esas pruebas; no se añadieron omisiones. La prueba ED-01 no llegó a medir el plegado grande: falló al obtener foco. Su comparación con la base queda pendiente; Editor/App/outline no cambiaron.

El segundo fallo sí corresponde a esta entrega: `charts.spec.ts`, cancelación de exportación, buscaba `phase.startsWith('Leyendo')` después de haber localizado ese estado como «Cargando los datos». Se conservaron el rojo completo y la traza; se incluye `red-export-cancel.log` con el fallo y el resumen. Se revisaron todas las referencias a los mensajes anteriores en src/tests/experiments y no se encontró otro consumidor.

La prueba ahora compara con `t('analysis.progress.loading')` y exige `rows > 0`: debe haberse leído un lote real antes de cancelar. No cambia el fixture de 100.000 filas, la espera, el teclado, el reintento de la exportación ni ninguna aserción de archivos parciales, números o integridad.

| Comprobación posterior | Resultado real | Registro |
|---|---|---|
| Caso de cancelación, `--repeat-each=10 --workers=1 --retries=0` | 10 passed, 53,4 s | `export-cancel-green.log` |
| `npm run check` | 0 errores / advertencias | `validation-check.log` |
| `npm test` completo | 149 archivos, 2.757 passed, 1 skipped exclusivo de Windows; 22,04 s | `validation-unit.log` |
| `npm run build` | Correcto | `validation-build.log` |

La aplicación no cambia en este ajuste: solo el consumidor de la fase en esa prueba. Las mediciones antes/después siguen correspondiendo a fuentes de producto idénticas. La suite completa local no se renombra como verde por repetir el caso; la nueva CI calificará el nuevo SHA.

Las corridas [43554355799](https://github.com/ruzer/freyalab/actions/runs/43554355799) y [43554373514](https://github.com/ruzer/freyalab/actions/runs/43554373514) se cancelaron al sustituir el head: no son evidencia verde. Antes de cancelar, Intel CSV presentó un retry en AN-1a (`analysis-tab.spec.ts:97`): agotó 15 s con perfiles completos y estado «Ejecutando la consulta»; pasó al reintento. La traza no distingue consulta principal de totales ni prueba su causa interna; no se amplía ese plazo por intuición. La aceptación pendiente sigue siendo una corrida completa de Intel con cero retry #1 sobre el código final.
