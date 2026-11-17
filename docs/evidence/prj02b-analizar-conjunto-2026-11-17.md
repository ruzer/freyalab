# PRJ-02b · Analizar un conjunto · Evidencia del 2026-11-17

## Estado de esta evidencia

Entrega de los criterios 13 y 15 de [PRJ-02](../stories/historia-prj02-conjuntos-diseno-para-codex.md), con el [alcance y las siete respuestas del ADR 0021](../stories/prj02b-alcance-adr-0021.md). Se implementó en una rama independiente desde `main 3960648e8757c16ae27431f126d04c5b84e528f1`, después de #177. El propietario fusionó el PR #178, que contenía solo alcance y documentación, como `561ff098a13ef0bbf656d617cd44c62ef77d3d90`. La continuación de implementación parte de ese main, en `codex/prj-02b-analizar-conjunto-implementacion`, y se entrega en un nuevo PR en borrador. No ejecuté fusiones ni publiqué versiones.

Los resultados locales siguientes corresponden al árbol de trabajo de esta entrega, aún sin un SHA final de producto. El HEAD de documentación durante las mediciones era `a3c7986ab126feb1c40bea9cc1030d1ad6d9f14b`; las fuentes estaban modificadas. **Ese SHA no califica la implementación.** El cierre local de tipos, unitarias y construcción ya pasó; la suite E2E completa está en curso al congelar el código. La CI del head congelado sigue pendiente. Sus resultados se registran en el PR sin cambiar el head evaluado. No se transfieren los verdes de #177.

Los registros originales de desarrollo se conservan fuera del repositorio, agrupados en `backend`, `text`, `chart-context`, `analysis` y `final-review`. Aquí se reproducen sus resultados y fallos relevantes, sin rutas privadas, trazas masivas ni datos reales de usuarios. Los nombres de log identifican la salida consultada; los tiempos son observaciones locales, no presupuestos del producto.

## Qué cambia y qué se conserva

- «Analizar» vuelve a ejecutar la cadena guardada y abre una pestaña analítica de solo lectura, con Información, Estadísticas, Gráficos y SQL existentes. El snapshot completo permanece en el proceso de datos; la vista previa de cien filas no se usa como fuente del análisis. No se crea un CSV intermedio ni otro motor.
- Se aplican los límites existentes a la **fuente raíz antes de filtrar, seleccionar o muestrear**: 256 MiB, dos millones de filas, ocho millones de celdas y 200 columnas. Una muestra pequeña no permite saltarlos. No se amplían límites ni dependencias.
- Analizar recorre la raíz completa, comprueba estructura y huella y solo publica un resultado íntegro. En «Probar», primeras N conserva su lectura parcial y no afirma una huella completa. Cancelar o cambiar proyecto, fuente o definición descarta el resultado obsoleto y libera sus recursos.
- Se preservan ausencias frente a cadenas vacías, ceros iniciales, identificadores largos, Unicode, campos multilínea y orden del motor. El snapshot no permite editar, deshacer, guardar, serializar el CSV bruto ni acceder a imágenes o bibliografía por un id sin ruta.
- Los gráficos, SQL y las exportaciones agregadas existentes identifican **«Conjunto completo»** y su procedencia en memoria, sin afirmar cambios pendientes ni «muestra del archivo». JSON, contexto del CSV agregado y Markdown conservan pasos, cobertura, semilla e identidad, sin rutas de la fuente. No se implementa exportación de conjuntos de PRJ-03 ni nuevos informes de PRJ-05/06.
- Se comparte la redacción de cobertura: sin «Paso N»; las muestras múltiples se atribuyen al nombre del conjunto. Una fuente verificada por completo no muestra bytes; una ejecución parcial conserva sus bytes reales y no inventa denominadores. La ayuda de orden aleatorio no acotado propone guardar una muestra y ordenar otro conjunto basado en ella.

### Aclaración aprobada sobre proyectos futuros

El propietario autorizó extender a «Analizar» la excepción de **conjuntos v1 íntegramente reconocidos en proyectos de versión futura**. Se permite la ejecución en memoria y se conservan los bytes del manifiesto futuro. Una semántica, paso o cadena desconocidos siguen bloqueados; el proyecto futuro permanece de solo lectura. Esto no autoriza migrar, reescribir ni guardar el proyecto futuro.

### Reejecución después de guardar cambios

La revisión final detectó una caché incorrecta por id: tras cambiar los pasos propios o una base, «Analizar» reabría el snapshot anterior sin ejecutar el motor. Se eliminó ese atajo. Pulsar «Analizar» vuelve a preparar los datos actuales y solo al éxito sustituye el snapshot previo; error y cancelación conservan el anterior. Navegar a una pestaña ya abierta no vuelve a ejecutar.

La reproducción E2E con definición y nombre actualizados falló en ambos casos (`reexecute-red-actual.log`). El arreglo mínimo de dos líneas pasó las dos variantes tres veces: **6/6, 8,2 s, cero reintentos**, `reexecute-green.log`; se comprueban una fila, Edad 61, nombre actual, liberación del snapshot anterior y bytes de fuente/manifiesto intactos después del guardado intencional. La primera versión del escenario tenía dos errores de montaje (no esperaba la pestaña inicial y usaba posición proyectada en vez de la referencia raíz); esa salida no se cuenta como rojo del producto.

La suite local sobre `fba72e9` se detuvo voluntariamente al encontrarlo: 453 pasan, 7 omisiones de plataforma, 1 interrumpida y 248 no ejecutadas; **no fue una ejecución completa ni un fallo del producto**. Se cancelaron las corridas remotas 44153467908 y 44154068152 del SHA anterior para no consumir recursos calificando código sustituido. Sus resultados no se transfieren. Se inicia de nuevo la suite completa sobre las fuentes corregidas.

## Rojo → verde por bloque

Las omisiones de las ejecuciones enfocadas con filtro seleccionan casos concretos; no son `test.skip` añadidos al producto. Los recuentos verdes de varias tablas se solapan: no se suman como pruebas distintas.

| Bloque y comprobación | Rojo guardado | Verde guardado |
| --- | --- | --- |
| Ejecutor analítico: resultado completo, integridad y límites raíz | `recipe-analysis-red.log`: 13 fallos; faltaba la nueva operación | `recipe-analysis-green.log`: 43/43 entre el ejecutor y su contrato previo |
| Recorrido completo después de primeras N: cobertura y progreso por lotes | `analysis-first-coverage-red.log`: 1 fallo; `analysis-first-batch-red.log`: 1 fallo, ejecutados por filtro | Incluidos en `backend-focused-final.log`: 141/141, 9 archivos, 5,17 s |
| Snapshot de tabla: ausentes, perfiles, estadísticas, Arrow, protección y cierre | `subset-engine-red.log`: 13 fallos | `subset-engine-green.log`: 61/61, 4 archivos |
| Documento analítico: solo metadata, sin guardar ni conceder acceso relativo | `subset-documents-red.log`: 10 fallos | `subset-documents-green.log`: 50/50, 3 archivos |
| Coordinador: autorización, publicación completa, cancelación y limpieza | `subset-coordinator-red.log`: 12 fallos | `subset-coordinator-green.log`: 23/23, 2 archivos |
| Cambio de definición durante la comprobación final o la instalación | `subset-definition-race-red.log`: 2 fallos, 1 pasa, 11 filtrados | `subset-definition-race-green.log`: 25/25, 2 archivos |
| Excepción futura aprobada y rechazo de semántica desconocida | `red-future-approved.log`: 2 fallos, 13 pasan | `green-future-approved.log`: 15/15 |
| Operadores de resumen en es/en/en-XA y conservación de los datos | `summary-red.log`: 13 fallos, 2 pasan | `summary-green.log`: 15/15 |
| Ayuda de muestra → conjunto basado → orden | `order-help-red.log`: 2 fallos, 16 pasan | `order-help-green.log`: 18/18 |
| Contrato exacto de esa ayuda: eliminar la frase «No se cambia el orden…» y su equivalente en inglés | `order-help-contract-red.log`: 2 fallos, 18 pasan | `order-help-contract-green.log`: 20/20, 136 ms |
| Cobertura compartida: una muestra, parcial/cancelada, cadenas y recuentos compatibles | `coverage-single-red.log`: módulo ausente; después 2, 2 y 3 fallos en `coverage-partial-red.log`, `coverage-chain-red.log` y `coverage-compatible-red.log` | `all-focused-green.log`: resumen, traducciones y cobertura, 45/45 en 3 archivos, 209 ms |
| Origen y alcance de las exportaciones agregadas, metadata íntegra y rutas ausentes | `chart-context/red.log`: 3 fallos, 7 pasan; el origen decía «cambios pendientes» | `chart-context/green.log`: 10/10, 169 ms; las 7 pruebas anteriores no se modificaron |
| Pestañas y alcance analítico en la app | `red-tabs.log`: 2 fallos, 21 pasan | `green-tabs.log`: 23/23, 98 ms |
| Botón «Analizar» y resultado real sobre el fixture | `red-e2e.log`: el botón no existía; 1 fallo | Incluido en `focused-10.log`: 10/10, 53,1 s |
| Gráficos: alcance correcto; al reabrir el mismo proyecto con otra versión no queda una pestaña fantasma | `red-scope-close.log`: 2 fallos; mostraba «Documento completo» y conservaba una pestaña cuyo snapshot ya se había cerrado | `green-scope-close.log`: 3/3, 3,5 s |
| SQL sobre el conjunto sin afirmar que incluye cambios pendientes | `red-sql-label.log`: 1 fallo con la ayuda general del documento | Incluido en `focused-10.log` y `focused-perf-final.log` |
| Reaperturas superpuestas: B/C durante el cierre del snapshot de A | `lifecycle-red.log`: 1 fallo; C rechazaba con «El documento ya no está abierto» y no se publicaba correctamente el último proyecto | `lifecycle-green.log`: 3 repeticiones pasan, 5,4 s; también pasa en la ejecución de 15 casos |
| Huellas SHA hexadecimales equivalentes en mayúsculas/minúsculas | `hash-case/red.log`: 3 fallos, 1 pasa, 15 filtrados; una huella equivalente se etiquetaba como distinta o impedía analizar | `hash-case/green.log`: 30/30, 2 archivos, 261 ms |

La reproducción de reaperturas retiene únicamente el cierre del snapshot en la frontera del proceso de datos y observa las lecturas reales de los tres manifiestos para ordenar las dos aperturas. No usa sleeps ni cambia el contrato del producto. Restaura ambas fronteras en `finally`. Comprueba C publicado, ninguna pestaña/snapshot obsoleto y bytes originales intactos. El arreglo ignora únicamente un cierre ya completado y revalida la generación; no debilita el contrato general de cierre de documentos.

## Comprobaciones locales e integración

Entorno de las E2E medidas: macOS ARM64, Apple M2 Max, 12 CPU lógicas, 32 GiB, Node 24.22.1 y Electron 44.9.2. Ejecuciones de Playwright con un worker y cero reintentos. No se atribuyen estos tiempos a los runners de CI ni a Intel.

| Comando / selección | Resultado real consultado | Alcance temporal |
| --- | --- | --- |
| `npm run check` | **0 errores y 0 avisos**; `check-reexecute-final.log` | Después de todos los cambios de producto |
| `npm test` | **162 archivos; 2.933 pasan y 1 omisión; 21,00 s**; `unit-reexecute-final.log` | Después del ajuste de huellas y de la reejecución de conjuntos editados |
| `npm run build` | **Finalizó correctamente**; `build-closure.log`: renderer 2,76 s | Después de todos los cambios; no es una prueba del paquete ni del instalador |
| `npm test -- tests/chart-result.test.ts` | 10/10; rojo previo 3 fallos; `chart-context/{red,green}.log` | Subbloque de procedencia |
| `node_modules/.bin/vitest run tests/subset-summary.test.ts tests/subset-i18n.test.ts tests/subset-coverage.test.ts` | 45/45, 209 ms; `all-focused-green.log` | Subbloque de textos y cobertura |
| Playwright: `tests/e2e/project-subset-analysis.spec.ts --project=csv --workers=1 --retries=0` | 10/10, 53,1 s; `focused-10.log` | Primera integración, antes del nuevo caso de ciclo de vida |
| Mismo spec, filtro de cancelación, `--repeat-each=3 --retries=0` | 3/3, 5,0 s; `cancel-repeat.log` | Regresión de cancelación |
| Mismo spec, filtro de reaperturas superpuestas, `--repeat-each=3 --retries=0` | 3/3, 5,4 s; `lifecycle-green.log` | Regresión de ciclo de vida |
| `npx playwright test tests/e2e/project-subset-analysis.spec.ts tests/e2e/project-subsets-perf.spec.ts --project=csv --workers=1 --retries=0` | **15/15, 1,0 min**, sin `retry #1`; `focused-perf-final.log` | 11 casos de la app y 4 casos de límites/muestreo de 1 GB |

La omisión unitaria local es la prueba específica de Windows de `tests/package-smoke.test.ts`: el hijo que sigue vivo tras un timeout y mantiene bloqueado el ejecutable. No se declara ejecutada en macOS. Pandoc 3.12.1 sí estuvo disponible y sus pruebas reales se ejecutaron; ese binario no tiene soporte HTTP, por lo que esta ejecución no demuestra el bloqueo de red de un Pandoc capaz de HTTP.

### Fixture, resultados numéricos y conservación

El fixture literal de siete filas preserva `00123`, `9007199254740993`, un campo multilínea y campos ausentes. «Oaxaca, adultos» produce tres filas y las columnas ID, Edad y Nota. El histograma representa **34, 52 y 61**; las estadísticas y la consulta SQL comprueban esos valores, no solo que se dibuje un gráfico. Otro caso de 150 registros verifica que el análisis usa todas sus filas y no las cien de la vista previa: 150 valores de Edad, mínimo 20, máximo 169 y suma 14.175. La cadena de tres niveles conserva la muestra semilla 7 y luego ordena sus mismas filas.

Las pruebas comparan los bytes de fuente y manifiesto después de analizar, consultar, cerrar, cancelar y cambiar de proyecto; el fixture grande además vuelve a calcular el SHA del archivo escrito con un lector independiente del motor, comprueba mtime y lista de archivos. Esto comprueba conservación en los escenarios ejecutados; no constituye una prueba de toda combinación de formatos y fallos de disco.

### Control de 1 GB y límites de análisis

Fuente sintética: **1.000.000.008 bytes**, un millón de registros de mil bytes, SHA-256 `ad5e0f81fd1c132ed1347c7e717b14286aa7594294a9cd99df5d0bee756b4540`. Se abre solo el proyecto, sin abrir ni indexar el CSV como documento. La creación y el hash previo calientan la caché del sistema; no son mediciones de disco frío. Cada caso usa una app nueva.

| Caso | Resultado verificado | Duración de la operación / caso E2E | Memoria utility observada |
| --- | --- | --- | --- |
| Probar primeras 2 | 2 filas, `complete:false`, sin SHA completo; lee 4.194.304 bytes del prefijo | 132,9 ms / 1,7 s | 142.144 KiB |
| Probar depósito de 10.000, semilla 7 | Recorre un millón de filas y 1.000.000.008 bytes; resultado 10.000, preview 100; SHA completo coincide | 18.220,1 ms / 19,8 s | 334.624 KiB |
| Cancelar el depósito a mitad | 502.000 examinadas, 507.510.784 bytes; `cancelled:true`, `complete:false`, sin SHA completo, sin archivos nuevos | 9.272,1 ms / 10,9 s | 332.320 KiB |
| Analizar una muestra de dos filas de esa raíz | Botón deshabilitado con motivo y API rechazada por 256 MiB; no se inicia el worker de datos ni se abre un documento | No se mide una operación analítica; caso E2E 1,1 s | No aplicable |

Los tres primeros casos son regresiones de «Probar», no una ampliación del límite de «Analizar». Los JSON de la ejecución guardan muestreos de memoria cada 50 ms; la columna corresponde al máximo observado de la suma de working sets de los procesos Utility. No es RSS de todo el sistema ni un máximo continuo garantizado. Los tiempos de operación excluyen las verificaciones posteriores de integridad. La igualdad de `bytesRead` y tamaño es evidencia del contador público; no se presenta como una traza de syscalls de todo Electron.

## Capturas y navegación

Se generaron **32 capturas** en [prj02b-2026-11-17](prj02b-2026-11-17/): cuatro estados × es/en-XA × claro/oscuro × 1440×900/1280×720. Las E2E comprueban teclado, foco, lectura de cobertura y ausencia del aviso de cambios externos antes de capturar.

| Estado | Captura de ejemplo en claro | Captura de ejemplo en oscuro | Total de variantes |
| --- | --- | --- | --- |
| Información del conjunto | [es, 1440×900](prj02b-2026-11-17/prj02b-informacion-es-light-1440x900.png) | [es, 1280×720](prj02b-2026-11-17/prj02b-informacion-es-dark-1280x720.png) | 8 |
| Histograma | [es, 1280×720](prj02b-2026-11-17/prj02b-histograma-es-light-1280x720.png) | [en-XA, 1440×900](prj02b-2026-11-17/prj02b-histograma-en-XA-dark-1440x900.png) | 8 |
| Conjunto con cadena y varias muestras | [en-XA, 1440×900](prj02b-2026-11-17/prj02b-conjunto-cadena-en-XA-light-1440x900.png) | [es, 1280×720](prj02b-2026-11-17/prj02b-conjunto-cadena-es-dark-1280x720.png) | 8 |
| Proyecto con cadena | [es, 1440×900](prj02b-2026-11-17/prj02b-proyecto-cadena-es-light-1440x900.png) | [en-XA, 1280×720](prj02b-2026-11-17/prj02b-proyecto-cadena-en-XA-dark-1280x720.png) | 8 |

Las capturas tempranas fallaron durante la construcción de los escenarios de navegación; se conservaron sus logs. No se usan como evidencia verde. La tanda enfocada de 15 casos sí finalizó correctamente. Las imágenes acreditan los estados capturados, no sustituyen una auditoría manual completa de accesibilidad ni demuestran cada contraste posible.

## Pendiente al congelar la entrega

- SHA final que se mostrará en el PR y resultado de `npm run test:e2e` completo, actualmente en curso. Tipos, 2.933 unitarias y construcción ya pasaron después de todos los cambios. Las fuentes se congelan con este documento; un resultado posterior se registra en el PR, sin otro commit documental durante su calificación.
- CI del PR en Linux, Windows y macOS ARM, Gate y pruebas del paquete del mismo head. No se atribuye resultado ni duración mientras no concluyan.
- Sonda Intel completa del producto equivalente, sus tiempos y recuento real de reintentos. No se transfieren las mediciones Intel de PRJ-02a.
- Empaquetado/instalación local, Gatekeeper, SmartScreen e integración de escritorio no se verificaron en esta tanda; build no los demuestra.
- No se midió aquí rendimiento de análisis cerca de todos los límites, disco frío, consumo continuo de memoria, tecnologías de asistencia en plataformas distintas ni cada combinación de pasos/formatos. La revisión de contratos, cancelación, identidad y limpieza encontró y corrigió los casos documentados; no es una auditoría de seguridad exhaustiva.
- PRJ-03 a PRJ-06, exportar el conjunto bruto y ampliar los límites permanecen fuera de alcance. No se fusionó, publicó ni actualizó la aplicación instalada.

Los resultados finales de CI se registrarán en el PR sobre el SHA congelado. No se crea un commit solo para cambiar un estado de CI en este documento.

## Cierre de la primera suite completa

La suite completa sobre `f4e83ba6` finalizó en 25,4 min: **703 pasan, 7 omisiones de plataforma y 1 fallo**. El fallo fue `project-subsets.spec.ts:352`: la prueba anterior esperaba `las 2 primeras de las 3 filas que cumplen`, mientras la redacción aprobada sin «Paso N» comienza `Las 2 primeras…`. La traza conserva las dos filas correctas; se actualiza solo la mayúscula de esa aserción literal, sin cambiar datos, plazos ni comportamiento. El rojo se conserva en `e2e-full-f4e83ba6.log`; el verde enfocado está en `coverage-chain-case-green.log`. Se volverá a calificar el head resultante; no se presenta esa corrida como verde.

Una corrida local previa se había interrumpido por desalineación de build/HEAD en Acerca de: se construyó con `fba72e9` antes de crear `f4e83ba`. Al reconstruir desde el commit congelado, APP-02 pasó en 7,4 s. No se cambió esa prueba ni el producto para resolverlo.
