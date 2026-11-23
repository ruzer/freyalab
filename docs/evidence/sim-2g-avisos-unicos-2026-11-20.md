# SIM-2g · Un aviso por evento · Evidencia

Estado documental, 2026-11-20. Producto G aislado en `82f3782b252621d022093dc1f074766b13c2458c`, sobre P3 `c257980`; las fases anteriores se conservan abajo. La composición `281450f0dbf9384ced37f6893854a55b130765cb` incorpora mediante merges normales PRJ-03 `59d9077` y main `8a002af` con A: tipos, unitarias, build y 32 casos enfocados aprobados. El spec limpio conserva SHA256 `3ed5c4301d087acbb006096481a91bfa229b3d88c546d8829c80081381ffa7d4`. Las 32 capturas son las fases aisladas antes/después de G. Suite completa de App, SHA de publicación, CI y paquete de ese futuro head siguen pendientes.

## Cambio y límites

Los 18 callers existentes de `notify` reciben tipo explícito. Guardado, copia y exportación completados usan éxito, salvo los resultados con advertencias; información y advertencia tienen su icono correspondiente. `error()` conserva la limpieza de su mensaje, el cierre de apertura y el rechazo duplicado del diálogo CSV; delega en el mismo `notify` con tipo error. Hay 19 llamadas tipadas contando esa delegación nueva. Los plazos permanecen en 3500 ms y 7000 ms para error. `notify` ya no escribe en el pie.

El cambio externo usa el documento activo, la pestaña de análisis y la marca de subconjunto para decidir si su franja documental está visible. Tabla conserva una franja externa más la protección existente, sin toast. Si su franja no está a la vista, se anuncia un warning con nombre de archivo. El estado persistente de invalidez de Análisis se mantiene. Se conserva el registro/hash histórico de la fuente, sus bytes originales analizados y su protección; el archivo sintético se modifica realmente fuera de la aplicación, sin fabricar el evento externo ni la respuesta IPC.

El icono `info` es una constante de la [fuente oficial de Lucide](https://github.com/lucide-icons/lucide/blob/main/icons/info.svg), blob `2a46eac2b55a1ead226035d1efa8721f6f08bd17`. La URL usa `main`, no se afirma haber obtenido ese SVG del tag 1.61.0. Se conservan las licencias y el componente `Icon` existentes; no se añade dependencia.

G modifica App, registro de iconos, colores de aviso y tres claves es/en, con en-XA generado. App sigue en pendientes de traducción. En la fase inicial, el consumidor de iconos cambia `.toast.info` a `.toast.success` para un guardado: mismo texto, dos SVG y bytes en disco. No se borra ninguna prueba ni se cambian backend, motor CSV, motor/registro de PRJ-03, esquemas, IPC, configuración de CI, plazos o retries.

## Rojo y verde reales

Los cinco casos nuevos cubren Tabla protegida en es/en-XA, Análisis delante en es/en-XA y éxito/información/error con teclado, duración y pie. Se reutilizan los dos casos existentes de iconos. El rechazo de reinterpretación dirty se solicita con el mismo intento sintético de frontera de SIM-1f: el control permanece desactivado y no se atribuye ese intento a una acción posible del usuario; se comprueban su mensaje real y la conservación de los datos.

| Corrida de raíz | Resultado | Tiempo del reporte / proceso | Lectura |
| --- | --- | --- | --- |
| Baseline P3 anterior a G; spec endurecido conservado en `e8c0a643958cd8a353b82191f55d79ea05c00346` | 5 fallos, 0 retries | 58,269 s / 58,559 s | Tabla mostró un toast cuando debía haber cero; Análisis recibió info en lugar de warning; guardar recibió info en lugar de success. |
| Primer candidato, producto `82f3782` | 4 aprobados, 3 fallos, 0 retries | 61,159 s / 61,467 s | Dos casos en-XA llegaron hasta un selector «Guardar» sin traducir; el quinto llegó al rechazo TableOnly durante el paso a Texto. |
| Observación pasiva, mismo producto | 1 aprobado, 0 retries | 2,231 s / 2,517 s | No reprodujo TableOnly; una página solapó el cambio de vista y terminó bien. No demostró una resolución. |
| Segunda tanda, `b3c491a199e4efb86328b8a9f5d3257126781131`, mismo producto | 6 aprobados, 1 fallo, 0 retries | 29,592 s / 29,9 s | El IPC real identificó una página tardía después de completar Texto. |
| Reloj instalado antes de editar, `fc86f9e` | 1 aprobado, 0 retries | 2,040 s / 2,313 s | Preparación temporal corregida, sin cambio de producto. |
| Cinco casos nuevos + dos de iconos, `fc86f9e` | 7/7 aprobados, 0 retries y 0 omisiones | 14,517 s / 14,809 s | Una sola tanda sobre el producto `82f3782`; todavía incluía el observador temporal. |
| Quinto caso limpio, `081a8bd`, sin observador | 1/1 aprobado, 0 retries y 0 omisiones | 2,402 s / 2,688 s | El caso conserva el verde sin wrapper IPC. No es una tanda limpia de siete casos. |
| Composición con PRJ-03/main, `281450f` | 32/32 aprobados, 0 retries y 0 omisiones | 48,707 s / 48,993 s | 5 casos G limpios + 2 iconos + 16 PRJ-03 + 9 A, en una tanda enfocada. No es la suite completa. |

Antes del rojo endurecido se corrigieron dos errores del harness: una espera de ausencia dejaba expirar el toast y el pie se capturaba con `innerText` pero se comparaba con `textContent`, que incluía controles ocultos. El reloj pausado antes de la escritura real y la comparación consistente del pie permitieron demostrar el duplicado transitorio. El selector en-XA se corrigió usando `toolbar.save`, conservando la aserción de desactivado.

## TableOnly: observación separada de G

El segundo intento registró `csvView(text)` de 1449,222625 a 1472,394167 ms. La última página previa había terminado antes de pedir Texto. Una nueva `page`, requestId 5, empezó a 1499,885542 ms —27,491375 ms después de la respuesta de Texto— y recibió «Disponible en modo Tabla.». No se observó un bucle ni un error de clasificación de `notify`.

La secuencia es compatible con el contador que incrementa `onDestroy` y un `load` tardío. El reloj se instalaba después de editar; la implementación instalada de Playwright 1.64.1 no cancela mediante su `clearTimeout` los identificadores de timers nativos anteriores. Esto respalda una mezcla de relojes en la preparación; no se capturó una pila del timer que permita afirmar su origen con certeza total. Se movió la misma instalación/pausa del reloj a después de las dos filas iniciales y antes de editar, sin añadir espera de quiescencia, consulta, sleep o demora.

El observador solo delegaba el IPC real y registraba tiempos/errores; no retenía ni alteraba respuestas. Sus fuentes y logs permanecen privados. Se retiró íntegro del spec después del verde de siete casos: el proof comprueba que las demás acciones, datos y aserciones son iguales. Los archivos relevantes de CSV/main son idénticos al baseline anterior a G por comparación estática; **el control runtime anterior a G de esta carrera no se ejecutó**. No se afirma haber arreglado una carrera del producto ni una causa histórica.

## Comprobaciones del producto

| Comprobación de raíz | Resultado sobre producto `82f3782` |
| --- | --- |
| Tipos | 0 errores, 0 advertencias; 9,87 s de proceso |
| Unitarias completas | 3065 aprobadas, 2 omitidas; 173 archivos aprobados y 1 omitido; 17,82 s en Vitest |
| Build inicial | Exit 0; 2,153 s de proceso |
| Build del spec limpio `081a8bd`, mismo producto | Exit 0; 2,183 s de proceso |
| Suite completa de App con las demás partes integradas | Pendiente |
| CI y paquete del futuro SHA publicado | Pendientes; no se transfieren resultados de otro head |

## Integración normal y calificación de la composición

Raíz incorporó PRJ-03 `59d9077` y main `8a002af` mediante merges normales, sin reescribir los heads individuales. El conflicto de los catálogos fue mecánico al final del archivo: se conservaron ambas entregas, con 1794 claves únicas en es/en. La observación C5 de main y los menús Exportar de PRJ-03 se conservan. App, iconos y style siguen idénticos al producto G `82f3782`; los componentes de análisis y su helper de A entran desde main.

| Comprobación de raíz sobre `281450f` | Resultado |
| --- | --- |
| Tipos | 0 errores, 0 advertencias; 9,16 s de proceso |
| Unitarias completas | 3065 aprobadas + 2 omitidas; 173 archivos aprobados + 1 omitido; 16,62 s de Vitest / 16,962 s de proceso; Pandoc real 3.12.1 |
| Build | Exit 0; 1,881 s de proceso |
| Tanda enfocada | 32/32, reporte 48,707 s / proceso 48,993 s; sin retries, flaky u omisiones |
| Suite completa de App y CI del futuro SHA publicado | Pendientes |

La tanda enfocada ya usa el spec G sin observador; los siete casos de G/iconos están incluidos en esa composición de 32. No se atribuyen estos resultados a un SHA de publicación todavía inexistente. El binario local de Pandoc no prueba eficacia HTTP.

Comandos relativos al repositorio utilizados por raíz:

```sh
npm run check
npm test
npm run build
npx playwright test tests/e2e/single-event-notices.spec.ts --project=csv --workers=1 --retries=0
npx playwright test tests/e2e/single-event-notices.spec.ts tests/e2e/icons.spec.ts --workers=1 --retries=0
```

## Capturas antes y después

Raíz ejecutó cuatro casos privados por fase: **4/4 antes** en 10,917 s de reporte / 11,222 s de proceso y **4/4 después** en 10,689 s / 10,966 s, sin retries ni omisiones. Cada caso produjo cuatro imágenes. Los 32 PNG se copiaron con SHA256, tamaño de archivo y dimensiones idénticos a sus ocho manifiestos privados; no se afirma aquí una inspección visual adicional. El probe privado no suma nuevas pruebas públicas ni convierte las fases en una tanda pública de quince casos.

El montaje usa registro, modificación y watcher reales, con una instancia nueva por vista. Conserva el hash histórico del registro y los recuentos/bytes originales de la tabla abierta. Pausa el reloj renderer después de estar lista y avanza 40 ms por imagen para ajustar viewport/virtualizador, 160 ms por caso; main y su watcher siguen reales. No fabrica eventos ni resultados. En el baseline, Tabla/Análisis muestran el toast info anterior y su copia al pie; el candidato comprueba ausencia de toast en Tabla y warning con nombre en Análisis.

| Fase | Producto y árbol de fuente | Matriz | PNG |
| --- | --- | --- | --- |
| Antes | P3 `c257980`, checkpoint `f321dc0`; árbol `ec12107e61373bea9556e5540f8f966690037508` | Tabla / Análisis × es / en-XA × claro / oscuro × 1440×900 / 1280×720 | 16 |
| Después | G `82f3782`; árbol `d7037a0312880d78f93bb75e0ddcabd9b47af79a` | La misma matriz | 16 |

Estas matrices aíslan G sobre P3 y se conservan como esas fases históricas; no son recapturas de la composición `281450f` con main/A, cuya calificación enfocada se documenta por separado. No se transfiere la CI de PRJ-03 ni de otro head a G.

| Vista | Idioma | Tema | Tamaño | Antes | Después |
| --- | --- | --- | --- | --- | --- |
| Tabla | es | Claro | 1440×900 | [PNG](sim-2g-avisos-unicos-2026-11-20/before/before-table-es-light-1440x900.png) | [PNG](sim-2g-avisos-unicos-2026-11-20/after/after-table-es-light-1440x900.png) |
| Tabla | es | Claro | 1280×720 | [PNG](sim-2g-avisos-unicos-2026-11-20/before/before-table-es-light-1280x720.png) | [PNG](sim-2g-avisos-unicos-2026-11-20/after/after-table-es-light-1280x720.png) |
| Tabla | es | Oscuro | 1440×900 | [PNG](sim-2g-avisos-unicos-2026-11-20/before/before-table-es-dark-1440x900.png) | [PNG](sim-2g-avisos-unicos-2026-11-20/after/after-table-es-dark-1440x900.png) |
| Tabla | es | Oscuro | 1280×720 | [PNG](sim-2g-avisos-unicos-2026-11-20/before/before-table-es-dark-1280x720.png) | [PNG](sim-2g-avisos-unicos-2026-11-20/after/after-table-es-dark-1280x720.png) |
| Tabla | en-XA | Claro | 1440×900 | [PNG](sim-2g-avisos-unicos-2026-11-20/before/before-table-en-XA-light-1440x900.png) | [PNG](sim-2g-avisos-unicos-2026-11-20/after/after-table-en-XA-light-1440x900.png) |
| Tabla | en-XA | Claro | 1280×720 | [PNG](sim-2g-avisos-unicos-2026-11-20/before/before-table-en-XA-light-1280x720.png) | [PNG](sim-2g-avisos-unicos-2026-11-20/after/after-table-en-XA-light-1280x720.png) |
| Tabla | en-XA | Oscuro | 1440×900 | [PNG](sim-2g-avisos-unicos-2026-11-20/before/before-table-en-XA-dark-1440x900.png) | [PNG](sim-2g-avisos-unicos-2026-11-20/after/after-table-en-XA-dark-1440x900.png) |
| Tabla | en-XA | Oscuro | 1280×720 | [PNG](sim-2g-avisos-unicos-2026-11-20/before/before-table-en-XA-dark-1280x720.png) | [PNG](sim-2g-avisos-unicos-2026-11-20/after/after-table-en-XA-dark-1280x720.png) |
| Análisis | es | Claro | 1440×900 | [PNG](sim-2g-avisos-unicos-2026-11-20/before/before-analysis-es-light-1440x900.png) | [PNG](sim-2g-avisos-unicos-2026-11-20/after/after-analysis-es-light-1440x900.png) |
| Análisis | es | Claro | 1280×720 | [PNG](sim-2g-avisos-unicos-2026-11-20/before/before-analysis-es-light-1280x720.png) | [PNG](sim-2g-avisos-unicos-2026-11-20/after/after-analysis-es-light-1280x720.png) |
| Análisis | es | Oscuro | 1440×900 | [PNG](sim-2g-avisos-unicos-2026-11-20/before/before-analysis-es-dark-1440x900.png) | [PNG](sim-2g-avisos-unicos-2026-11-20/after/after-analysis-es-dark-1440x900.png) |
| Análisis | es | Oscuro | 1280×720 | [PNG](sim-2g-avisos-unicos-2026-11-20/before/before-analysis-es-dark-1280x720.png) | [PNG](sim-2g-avisos-unicos-2026-11-20/after/after-analysis-es-dark-1280x720.png) |
| Análisis | en-XA | Claro | 1440×900 | [PNG](sim-2g-avisos-unicos-2026-11-20/before/before-analysis-en-XA-light-1440x900.png) | [PNG](sim-2g-avisos-unicos-2026-11-20/after/after-analysis-en-XA-light-1440x900.png) |
| Análisis | en-XA | Claro | 1280×720 | [PNG](sim-2g-avisos-unicos-2026-11-20/before/before-analysis-en-XA-light-1280x720.png) | [PNG](sim-2g-avisos-unicos-2026-11-20/after/after-analysis-en-XA-light-1280x720.png) |
| Análisis | en-XA | Oscuro | 1440×900 | [PNG](sim-2g-avisos-unicos-2026-11-20/before/before-analysis-en-XA-dark-1440x900.png) | [PNG](sim-2g-avisos-unicos-2026-11-20/after/after-analysis-en-XA-dark-1440x900.png) |
| Análisis | en-XA | Oscuro | 1280×720 | [PNG](sim-2g-avisos-unicos-2026-11-20/before/before-analysis-en-XA-dark-1280x720.png) | [PNG](sim-2g-avisos-unicos-2026-11-20/after/after-analysis-en-XA-dark-1280x720.png) |

Los [hashes, identidades y resultados acotados](sim-2g-avisos-unicos-2026-11-20/proof.json) y el [manifiesto de capturas](sim-2g-avisos-unicos-2026-11-20/captures.json) permiten comprobar esta evidencia sin publicar rutas locales, perfiles o logs brutos. No se declara la entrega publicada ni la CI aprobada.

## Composición final para revisar el lote

La rama incorpora PRJ-03 #202, B #203, C #204 y D #205 mediante merges normales; A, E y F ya proceden de main. La base sin G es `7d1be5f5c26c0b9b96a6e6dcda8be4c01eb9356f` y la composición con G y la corrección de foco C es `3d2511f7d08d36bad103e1a4cfc314c4270795f1`. La [comparación exclusiva de G](https://github.com/ruzer/freyalab/compare/7d1be5f5c26c0b9b96a6e6dcda8be4c01eb9356f...3d2511f7d08d36bad103e1a4cfc314c4270795f1) conserva cinco archivos de producto y dos de pruebas, además de su documentación; no reescribe las ramas individuales ni main. Orden de revisión: #202 → #203 → #204 → #205 → G, todos los PR pendientes en borrador y con base main. El propietario decide las fusiones.

Sobre `3d2511f7d08d36bad103e1a4cfc314c4270795f1` se construyó de nuevo y se ejecutaron **4/4** casos privados para otras **16 capturas** de la composición, con la misma matriz Tabla/Análisis × es/en-XA × claro/oscuro × 1440×900/1280×720. Son una fase adicional; no sustituyen las 32 capturas aisladas históricas. El [manifiesto de composición](sim-2g-avisos-unicos-2026-11-20/composition/captures.json) fija las huellas del producto, construcción, fixture y PNG. Tiempo real: 10.700 s de reporte; 11.178 s de proceso; cero reintentos u omisiones.

La revisión visual anterior de composición registró un límite menor: en Análisis en-XA a 1280×720 el aviso transitorio tapa la cola de la ayuda plegable inferior; los perfiles y el cierre permanecen visibles. No se afirma que ese solape sea una regresión nueva. No se cambia aquí la posición general de los avisos.

La validación integral anterior sobre `26cb325` terminó tipos con 0 errores/0 avisos, 3096 unitarias aprobadas + 2 omitidas (174 archivos aprobados + 1 omitido) y build aprobado. Se interrumpió voluntariamente la E2E al confirmar el defecto de foco C: 95 aprobadas, 1 interrumpida, 742 sin ejecutar; exit 130 y 176,869 s. **No fue una suite integral aprobada.** C ya incorpora su corrección roja→verde en `937237a`: quince casos del archivo de campos y seis de campos simples pasaron en ejecuciones distintas. Esos resultados tampoco se presentan como la validación integral de G.

La suite completa y la CI del head documental congelado se ejecutarán tras este checkpoint y se registrarán en el PR sin mover el head. Siguen sin acreditarse instaladores manuales, eficacia de Pandoc HTTP con otro binario, lectores externos o la resolución de las causas históricas intermitentes no reproducidas. No se modificó la app instalada ni se publicó una versión.

## Cierre integral y consumidores restantes de guardado

Se ejecutaron los cuatro comandos de cierre sobre `91f6c5b`: `npm run check` (0 errores/0 avisos, 9,116 s), `npm test` (3096 aprobadas + 2 omisiones existentes, 17,265 s de proceso), `npm run test:e2e -- --workers=1 --retries=0 --reporter=list,json` y `npm run build` (exit 0, 1,983 s). La E2E completa alcanzó las **841 identidades** en 1893,405 s de reporte / 1895,697 s de proceso: **834 aprobadas ordinarias + 1 fallo esperado SEG-S2e + 6 fallos inesperados**, sin reintentos ni omisiones. No se declara una integral verde.

Cuatro fallos eran consumidores del aviso que esta historia retira del pie: `text-encoding.spec.ts:84` para TXT, Mermaid y CSV Texto; y `:112` para guardar con UTF-16. Los archivos ya contenían la primera instantánea y el editor conservaba el texto posterior, pero el test buscaba «Archivo guardado» en `.statusbar`. Se cambiaron solo esos **dos selectores** a `.toast.success`, manteniendo el mismo mensaje y todas las aserciones posteriores de carrera, dirty, firma, copia y bytes finales. Los cuatro pasaron en `55447f5`: **4/4, 4,800 s de proceso**, con build fresco, sin reintentos ni omisiones. No cambian producto, títulos, número de pruebas, límites o tiempos. El inventario de 112 usos del pie/alias no encontró otros consumidores del aviso retirado. La corrección y sus pruebas pertenecen al mismo PR de G.

Los otros dos fallos fueron las versiones claro/oscuro de E1: el documento no perdió el foco nativo al abrir otra ventana, en `markdown-selection.spec.ts:127`. Doble clic, arrastre, teclado y contraste previos sí pasaron. La sesión gráfica se observó bloqueada durante el diagnóstico. Un control posterior con **main `8a002af` sin modificar** repitió los mismos dos fallos (33,907 s de proceso) y seguía bloqueado antes/después; spec E1 y Editor tienen las mismas huellas en ambas ramas. No se atribuye una regresión a G ni se afirma demostrada una causa de sistema sin control desbloqueado. Se conservan esos oráculos, sin skip, emulación alternativa o plazos nuevos; la comprobación local con otra ventana realmente enfocada queda pendiente.

Las 841 identidades se conservan, sin bajas ni traslados. La calificación final se registra por fases y la CI del siguiente head congelado deberá pasar por sí misma. La suite local completa se conserva como la fase `91f6c5b`; los cuatro selectores modificados se verificaron aparte. La comprobación de foco nativo local requiere una sesión gráfica desbloqueada. Los resultados y huellas se recogen en el [cierre de integración](sim-2g-avisos-unicos-2026-11-20/integration-closure.json); los reportes completos y trazas permanecen privados.
