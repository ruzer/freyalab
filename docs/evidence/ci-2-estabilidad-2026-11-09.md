# CI-2 · Pruebas inestables y plazos

Base `f431edc`, con CI-1b. Se conserva la lógica del producto. Los resultados de cada job y su SHA se registran en el PR.

## Diagnóstico y cambios

| Caso | Causa y alcance de la corrección |
| --- | --- |
| CSV Texto D | El plazo de 1 s empezaba antes de la respuesta asíncrona al abrir el CSV mal formado. X19 y X20 de [CSV Texto](../stories/7-csv-texto.md) exigen aviso, detalle y recuperación. Se conserva la comprobación de visibilidad y se separa del trabajo del analizador. |
| Resumen F2a | El segundo cálculo seguía en curso cuando venció la espera en ARM. La prueba agrupa y cuenta 100.000 filas. Se conserva esa cardinalidad con una sola columna y se quita el dato que el conteo no usa. |
| Barra Markdown CRLF | En Windows los bytes ya tenían CRLF. El botón de bloque de código seguía inaccesible durante el guardado. Se espera el fin del estado ocupado antes de volver a editar. H13-1 queda fuera del cambio. |
| Barra lateral P6 | Tras 12 pulsaciones la traza observó 410 px durante 15 s. Falta evidencia para distinguir un evento de teclado de una actualización perdida. Se prueba cada límite con un cruce real de teclado desde el ancho vecino. Se conservan cambio de ancho, arrastre, recuerdo tras recargar y ambas pestañas. |
| Búsqueda real, un rango y lote de una fila | La combinación realiza un intercambio por lote y lee todas las coincidencias de cuatro consultas. Se quitan filas sintéticas repetidas de esa variante. Cada consulta sigue cruzando páginas de 1.000 y compara todas las filas. Las otras 11 variantes mantienen 13.500 filas. |
| CSV Texto Windows-1252 | La ida y vuelta de codificación recorría caracteres repetidos. El euro ocupa un byte en Windows-1252 y tres en UTF-8. Se conservan el cruce de 10 MiB entre ambas representaciones y la comparación byte a byte del archivo guardado. |
| Paridad de 330 consultas UTF-16 | El temporizador de sondeo se acumulaba en cada consulta. El sondeo sigue esperando el estado real y cede el bucle de eventos. Se conservan las 330 consultas y sus oráculos, los datos y el límite de 10 s. |
| Copia y deshacer de rango | El caso gastaba tiempo en analizar un CSV de 9 MB antes de medir el portapapeles. Se abre un CSV pequeño y se prepara el mismo estado mediante el contrato de restauración del motor. Se conservan los desbordamientos de 8 y 20 MiB y la ausencia de cambios parciales. |
| Gráficos de más de 50 MiB | El primer caso hacía tres generaciones de gráfico sobre la fuente completa. La última agotó el plazo del caso empaquetado. Se reparte esa comprobación entre los dos casos que ya abren esa clase de CSV. Se conservan los 120 s por caso, el CSV parcial de solo lectura y las comprobaciones de exportación. |

Los [registros de macOS ARM](https://github.com/ruzer/freyalab/actions/runs/42591866442/attempts/1) muestran los fallos de D y F2a. CRLF se contrastó con el [push 42650938690](https://github.com/ruzer/freyalab/actions/runs/42650938690/attempts/1) y P6 con la [corrida 42546503762](https://github.com/ruzer/freyalab/actions/runs/42546503762). C2 de Markdown se conserva tal como quedó en CI-1b.

### Rendimiento del producto

Una generación de gráfico ejecuta una consulta de datos y otra de totales. Cada una prepara la fuente. La reducción del trabajo en las pruebas deja intacto ese costo de producción.

## Comprobación local

El listado de Playwright antes y después conserva las mismas 579 identidades de proyecto, archivo, suite y título. Las aserciones de gráficos repartidas entre casos siguen ejercitando la fuente de más de 50 MiB.

La suite unitaria completa se ejecutó con ocho workers y un ciclo de 15 ms de ejecución y 85 ms de pausa para el grupo de procesos de prueba. Es una presión reproducible en Apple silicon, con un perfil distinto del runner Intel.

| Unitarias bajo carga | Base | Candidata |
| --- | ---: | ---: |
| Un rango, lote de una fila | 58,348 s | 39,612 s |
| Windows-1252 | 4,793 s | 2,335 s |
| 330 consultas UTF-8 | 10,085 s, agotó el plazo | 9,435 s |
| 330 consultas UTF-16 | 10,084 s, agotó el plazo | 5,685 s |

La carga extrema dejó fallos ajenos a los casos medidos en ambas corridas. El caso de rangos final se midió por separado: 214/211/213 ms en la base y 41/42/42 ms con la restauración de datos. El fallo previo de Intel fue de 5,292 s en el [push 42298419917](https://github.com/ruzer/freyalab/actions/runs/42298419917).

- CRLF. Una demora de diagnóstico de 900 ms en la aplicación compilada, después del reemplazo en disco, reprodujo la espera fallida de «Bloque de código». Con la espera de `aria-busy=false`, pasó 4/4 bajo la misma demora y con dos workers. La demora no está versionada.
- P6. El caso anterior y el nuevo pasaron 12/12 con dos workers y ralentización 6× de la CPU del renderer. Tiempos totales 18,8 y 15,9 s. El fallo de Windows se vio en la traza original, donde 12 llamadas de teclado terminaron en 224 ms y el ancho persistió en 410 px. En el Mac local no se reprodujo ese fallo.
- CSV Texto D. Una demora diagnóstica de 1.250 ms antes de publicar el evento reprodujo el rojo. Esperar a que se monte el aviso y luego verificar su visibilidad con el mismo plazo pasó 3/3. El segundo mide la visibilidad después del montaje, no el tiempo total de apertura.
- Resumen F2a. Con la CPU local saturada, la generación final tuvo una mediana de 1.932 ms en la base y 1.866 ms con 100.000 filas de una columna. Una demora de diagnóstico de 16 s en la segunda consulta reprodujo el rojo a los 15,041 s. Esperar el fin de «Cancelar gráfico» antes del anuncio final pasó con la misma demora en 18,6 s.
- Gráficos empaquetados. Con el mismo paquete ARM y CPU saturada, los dos casos tardaron 34,4 y 4,6 s en la base, y 21,8 y 8,1 s con el reparto. El primero pasa de seis a cuatro lecturas analíticas y el segundo de una a tres. Se mantienen los dos arranques y la cobertura de imagen completa, parcial y filtrada. Los fallos anteriores quedan en [#126, intento 3](https://github.com/ruzer/freyalab/actions/runs/42423164297/attempts/3).

## Intel

- El [push 42650938690, intento 1](https://github.com/ruzer/freyalab/actions/runs/42650938690/attempts/1) perdió el runner de `csv-package` a los 63:12 de job y 61:51 de fase rápida. GitHub devolvió HTTP 404 al solicitar el log de ese job y la anotación confirmó la pérdida de comunicación. Sin el log ni muestras del sistema, la causa específica sigue sin determinarse.
- [CI-INT 42546503762](https://github.com/ruzer/freyalab/actions/runs/42546503762) da la referencia de 25:55 para las E2E rápidas de CSV, 8:44 para la fase serial y 13:22 para las E2E del paquete.
- La [nocturna 42380168846](https://github.com/ruzer/freyalab/actions/runs/42380168846) completó 52:12 de rápidas. Era anterior al reparto y sumaba Shell, Markdown y CSV. No mide aisladamente la fase rápida de CSV.
- El [intento 2 del push 42650938690](https://github.com/ruzer/freyalab/actions/runs/42650938690/attempts/2) completó las rápidas CSV en 35:41. La [nocturna 42666436586](https://github.com/ruzer/freyalab/actions/runs/42666436586), sobre la misma base, tardó 35:14. Ambas pasaron con un reintento en Resumen F2a.
- El [intento 1 del diagnóstico CI-2](https://github.com/ruzer/freyalab/actions/runs/42668411752/attempts/1) tardó 30:15 en rápidas CSV. En 16 muestras cada dos minutos, `memory_pressure -Q` indicó 90 % de memoria libre, sin compresión ni intercambio. La CPU ociosa varió entre 0 % y 61,2 %. El runner completó la fase serial y el paquete, con un reintento de CSV Texto C por una consulta cancelada por otra más reciente. Las muestras describen esta corrida y dejan abierta la causa de la desconexión anterior.
- El [intento 2 del mismo SHA temporal](https://github.com/ruzer/freyalab/actions/runs/42668411752/attempts/2) repitió solo `csv-package`. Pasaron 194 rápidas, 59 seriales y 92 del paquete, con cero `retry #1` en el log. Las rápidas tardaron 34:03, las seriales 8:56 y el paso del paquete unos 15:12. El job completo tardó 61:51. Las 17 muestras de memoria marcaron 89–90 % libre. El otro job de Intel, `shell-md`, ya había pasado sin reintentos en el primer intento.

En Windows, el mismo diagnóstico registró un reintento de CRLF en otro punto. El editor ya tenía la cita y el clic de Guardar terminó, pero la lectura de disco conservó el contenido original durante 15 s. La traza no recoge un aviso transitorio ni el resultado del guardado en el proceso principal. La causa de ese reintento queda abierta.
