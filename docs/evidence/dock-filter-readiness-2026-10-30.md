# Selección de rango tras aplicar la búsqueda · corrección de prueba

## Fallo observado y alcance

CI254, run41000529006/job123883615510, head `2a70d2b1fc26a141825fbcbe0c3fe3746ac7aa94`: `dock-expanded.spec.ts:31` falló en3.4s, antes de ampliar el panel. La línea36 tomó una sola lectura de `.csv-status` y esperaba «Rango», pero recibió sólo codificación/separador/encabezado. El retry#1 pasó3.3s; el resultado es439aprobados+1intermitente, no440a la primera.

El artefacto12955738036 (16.029.635B, SHA256 `9c70c82555ae8f5ce9a6ae22a59f4319bd42cf4916b399722f327d736a2b892b`) se verificó contra GitHub. Su trace contiene52eventos de test, sin DOM, red o estado interno del renderer. El click empezó10.351ms después del fill; la espera anterior sólo contaba más de5celdas, condición que ya cumple la tabla sin filtrar. El rastro no demuestra por sí solo qué ocurrió en pointerdown ni la causa histórica única.

## Reproducción y control reales

Protocolo **externo**, sin Source/hook/IPC nuevos: un bootstrap de prueba envuelve `ipcMain.handle` antes de importar el main compilado y retiene únicamente la respuesta real de `freya/page` cuya búsqueda esC1. El motor calcula40coincidencias de200; no se simulan datos ni se introduce una demora fija. La barrera se libera explícitamente desde Playwright.

Fuente del experimento: unión ED-01+A3, head `df3f22171049968af2e1c1937ac35d59c4b19b3a`, Source `4d30bd4bca4ca987ee8dc2fa84de0e2ecfd63880`. Node24.22.1, Mac arm64, corriente AC, reserva exclusiva. SHA256 del main compilado: `a942f18fb58e3765a177ef215d5304be2825d80008d8b17d4f4534d34b875556`.

| Modo | Evidencia observada | Resultado real |
|---|---|---|
| Race | Predicate viejo cumplido con aria-rowcount201 y0respuestas. Respuesta40/200retenida, «Procesando…» visible; click no crea selección. Tras liberar: aria-rowcount41 y sigue sin Rango. | Código0,1.82s; demuestra una ordenación permitida que invalida la preparación anterior. |
| Control | Libera respuesta; espera aria-rowcount41 y fin de «Procesando…». Un click crea1celda de rango; ampliar/volver conserva el texto del rango y scroll, con diferencia≤1px. | Código0,1.66s. |

La selección se inicia en pointerdown y se rechaza mientras la tabla está busy. No se traslada automáticamente la causa mousedown/up del botón de gráficos. La reproducción no identifica retrospectivamente la causa única de CI254.

Los primeros dos intentos del **protocolo** fallaron antes del escenario porque intentaban leer `appInfo`, API de D2 que no existe en esta fuente. Se preservaron como protocol-1 y se retiró esa lectura, sin añadir un hook. No son fallos del producto ni rojos del comportamiento. La identidad se registra mediante Git y hash de la salida real.

## Cambio mínimo revisado

Sólo dos expectativas, antes del click original:

```ts
await expect(grid()).toHaveAttribute('aria-rowcount','41')
await expect(page.locator('.csv-status')).not.toContainText('Procesando…')
```

Se conservan el predicate anterior, el único click, la aserción de «Rango», scroll, foco, búsqueda, ancho, expansión/retorno y todos los oráculos. No se cambia configuración, plazo, fixture, Source, package/lock ni CI. No se agrega sleep o retry. Root revisó reproducción/control y aprobó este parche antes de congelar el head.

## Integración Markdown observada en la misma fuente

Otra comprobación externa, código0/1.78s: biblioteca local y cita activa → plegar una sección → dos cursores mediante Alt+clic en otra → editar ambos con Unicode → un solo undo restaura todo el texto y conserva plegado/dos cursores → clic normal vuelve a un cursor → Enter acepta una cita → ambas se renderizan. El Markdown original y la biblioteca permanecen idénticos en disco. No se exige ni se declara autocompletado en ambos cursores.

Tras ambos diagnósticos y esa comprobación,988archivos rastreados/189PNG y258archivos de out seguían idénticos a las guardas anteriores. Cero sesiones Electron de FreyaLab al terminar. No se modificó una captura rastreada.

## Calificación y límites

Check0errores/0advertencias, unidades completas1654/1654 (86archivos,14.21s,0omisiones) y build0/1.83s se ejecutaron sobre la misma Source4d30 antes de estas dos expectativas y notas documentales. Pandoc real local3.12.1 ejecutó sus seis casos; carece de HTTP y aquí no se demuestra eficacia de ese bloqueo. No se repiten check/unidades por cambios de prueba/documentación que no cambian esa fuente.

El full E2E y CI/paquete de las cuatro plataformas **deben calificar el head final**; siguen pendientes al escribir esta nota. Los resultados definitivos se añadirán al cuerpo del mismo PR y a la evidencia externa sin reiniciar la CI por un commit documental posterior. No se declara resuelta una intermitencia histórica por un retry ni se transfiere verde de otros heads.

Protocolo, comandos, logs, JSON, capturas externas y guardas: `/private/tmp/freyalab-pr91-local-a2847b1/`, copiados a la evidencia durable de la sesión. Logs y artefacto de CI254 en `recovery/ci91-2a70d2b/` y `recovery/dock-flake-ci254-2a70d2b/`. No se publicó release, fusionó un PR ni actualizó la aplicación instalada.
