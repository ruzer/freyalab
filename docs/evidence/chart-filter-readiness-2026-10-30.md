# Constructor temporal: esperar la vista filtrada real

## Cambio acotado

`tests/e2e/charts.spec.ts:208` añade dos expectativas antes del único clic de Generar del análisis filtrado: cuadrícula con `aria-rowcount=3` (dos registros y encabezado) y botón disponible. Conserva las aserciones de cifras, series, fechas inválidas, tres filas filtradas, agrupación anual, exportación SVG, temas y CSV original sin modificaciones. No añade sleeps, reintentos, plazos, dependencias ni cambios de producto/CI.

## Rojo real y delimitación

CI255, head `2a9220403f28d00ea507f5ccdbb12517263773e5`, run41002392509, job ARM123889556034: el caso del paquete falló dos veces porque el estado seguía «Opciones o datos actualizados. Pulsa Generar gráfico.». Los clics duraron161,931 y163,093ms. CI250 tenía el mismo fallo en su primer intento, con clic154,034ms. Sus trazas sólo contienen eventos del runner; no acreditan click/submit DOM, SQL ni una cancelación.

La hipótesis inicial de una publicación tardía de `pageQuery` se descartó al leer el código: CsvCharts recibe `query()` con filtros vivos. `queryValid` cambia con la carga, pero no está en la firma que invalida el gráfico.

## Reproducción controlada, sin gancho de producto

Dos arranques independientes con Node24.22.1 arm64 y `out`27df250, cuya Source es idéntica a2a92204. Un bootstrap externo envuelve el `ipcMain.handle` existente: retiene únicamente la respuesta tabular del filtro Tipo=A y registra page/sqlRun. Se observan puntero, click, submit, escrituras de status y disabled. El reloj Playwright dispara el debounce entre mousedown y pointerup. Sus150ms son un orden controlado, **no una medición de rendimiento**.

En ambos arranques se generó primero el documento completo como preparación; después se armaron contadores para un único intento filtrado. No se repitió un clic fallido.

| Orden controlado | Resultado observado |
| --- | --- |
| Mousedown → empieza carga → pointerup | Dirty aparece antes de mousedown; el botón se deshabilita durante la pulsación. Hay pointerup pero ningún mouseup/click/submit del botón ni sqlRun. El mensaje anterior permanece tras volver a estar disponible. |
| Respuesta filtrada real + botón disponible → clic | Un click, un submit y un sqlRun; «Gráfico listo». Enero10, febreroNULL y marzo30, serieA e invalid_dates0. Un oráculo independiente en Python confirma esos valores y suma40. |

Ambos comandos terminaron en0. CSV byte a byte intacto y dirtyfalse. Las558huellas de Source/tests/activos/manifiestos y258de out permanecieron idénticas antes/después; Git2a92204 limpio y0procesos propios al devolver la reserva. Se demuestra el mecanismo compatible; las trazas históricas no permiten afirmar que fuera su única causa.

## Verde del caso modificado sobre paquete existente

El parche se probó desde el worktree sombra9e806a3 más estas dos expectativas, contra el ejecutable empaquetado existente de APP04:

- Compilación del paquete: `0ffa1360d36d81c58ffba2fdda7bc984026323b2`, macOS arm64; no es un nuevo paquete D2.
- ASAR344141842bytes, SHA-256 `f2a1ebb51d1fff7109fa8ed5e7f94123f5258e30ed5db171f554d3a12be1afad`, verificado antes y después.
- CsvTable.svelte, CsvCharts.svelte y shared/charts.ts son idénticos por Git entre0ffa136 y la sombra. La comparación no se presenta como igualdad de toda la aplicación.
- Comando real: `FREYALAB_EXECUTABLE=/private/tmp/freyalab-app04-package-0ffa136/mac-arm64/FreyaLab.app/Contents/MacOS/FreyaLab node /private/tmp/freyalab-lote2/aplicacion/node_modules/@playwright/test/cli.js test tests/e2e/charts.spec.ts --project=csv --grep 'constructor temporal' --reporter=line --output=/private/tmp/freyalab-chart-ci255-review/package-results`.
- Resultado: **1/1 aprobado,5,2s,0reintentos**, exit0. Se ejecuta el caso completo, incluidas sus exportaciones/capturas e integridad.
-335huellas de archivos Source/tests/manifiestos del worktree y el ASAR permanecen idénticos durante el foco.0Electron/Node propios al terminar. El symlink temporal a dependencias ya existentes se retiró; no se instalaron dependencias.

## Evidencia cruda y límites

Los logs, los dos protocolos, eventos DOM/SQL, oráculo, guardas, artefacto ARM original y contextos están en `recovery/chart-ci255-arm` del directorio durable de esta sesión. Incluye `reproduce.mjs`, `cross-load.json`, `wait-result.json`, `numeric-oracle.json`, `package-focus.log` y guardas antes/después.

No se repite el full469 ni unidad global/build por esta adaptación de prueba. Sus resultados históricos siguen asociados a27df250 y sus identidades de Source; el head nuevo requiere su propia CI obligatoria. No se afirma un full de D2 sobre el paquete0ffa136, instalación, rendimiento real de este protocolo ni causa histórica exclusiva.

Seguimiento UX fuera de este parche: una pulsación humana que cruce el comienzo de la carga tabular también puede quedar sin generar. Cambiar esa experiencia necesita evaluación separada; aquí se sincroniza el escenario que exige analizar la vista ya filtrada.
