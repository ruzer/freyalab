# F2b · Correcciones de la revisión de #108

Fecha: 2026-11-02. Mismo [PR108, en borrador](https://github.com/ruzer/freyalab/pull/108) y rama `codex/analitica-campos-zonas-f2b`. Revisión recibida sobre `0a79012558680bea66ee3d806e0822819f86cf1a`. Worktree independiente, sin tocar el checkout del propietario.

Fuente de esta corrección: `src:6e0dc1b37b6afea1d3eee098e6b8b5a91b87c217`; pruebas finales: `tests:91a4878f128788e9c75851f0b0f82069c4886f65`. Los resultados del cierre integral y de CI del nuevo head se registran en el cuerpo del PR, sin crear un commit solo para actualizar estados, según CONTRIBUTING. Aquí no se transfieren los checks de0a79012.

## Qué se corrigió

1. **Truncado sin Top10.** Cuando `data.limited` es verdadero, chartTop devuelve las mismas filas en el mismo orden, sin clasificarlas ni crear Otros. Con842grupos, se dibujan los100 entregados. Top10 sigue disponible para resultados completos. No se modificó chartSQL.
2. **Un solo aviso.** «Gráfico parcial. Se muestran los primeros100 de842grupos, en el orden elegido. Para comparar otros grupos, filtra o elige otro campo en Filas.» En la app hay espacios entre números y palabras. Sin «mayores» ni «los recibidos» en ese aviso; no aparece un segundo Top10. Los otros tipos conservan su identificación de gráfico parcial en el mismo aviso superior.
3. **Motivo con línea reservada.** La altura original medida era6,3046875px; ahora es17px. Las cajas de aviso, botones, motivo y gráfico no se solapan: [geometría real](geometry.json).
4. **Elección de tipo explícita.** «Elegiste…» solo puede aparecer después de pulsar un botón de tipo, y solo mientras se conserva esa configuración. Cambiar una zona, datos u opciones invalida la atribución. «Antes» se sustituye por «Sugerido»: el tipo recomendado no es una elección anterior.
5. **Un formato numérico por idioma.** Tabla, totales, marcas, ejes, intervalos, escala del mapa y tooltips reutilizan formatNumber y la misma precisión de12cifras significativas que ya tenía la tabla. es→es-MX; en/en-XA→en-US. Los identificadores de categoría siguen siendo texto exacto. Las coordenadas, consultas y exportaciones de datos no cambian. Los porcentajes usan3cifras significativas: un porcentaje pequeño pero no nulo ya no se presenta como0%.
6. **Acciones arriba y seis campos.** Intercambiar/Limpiar están en la cabecera Campos; conservan sus nombres accesibles y teclado. La lista muestra al menos6campos a1280×720, y las cuatro zonas completas están visibles. Lista y contenido de zonas pueden desplazarse independientemente cuando hay más contenido: [recuento real](fields-visible.json). En estrecho se conserva el panel plegable existente.

## Precisión sobre la revisión

Sin series y sin agrupación temporal, chartSQL ordena barras por `p.value ASC/DESC, p.x ASC`: no es siempre alfabético. Por eso el aviso dice «en el orden elegido», y la presentación no añade otro orden. La redacción sugerida también incluía «Para ver los mayores», pero su prueba prohíbe esa palabra en el aviso truncado: se usa «Para comparar otros grupos».

El CSV sintético tiene842filas,842clientes y Ventas=`100+3*i`: total1.146.383, máximo realC841=2.623. El subconjunto ascendente contiene C0…C99=100…397. Antes se dibujaba ese subconjunto como diez barras descendentes397…370; después se conservan sus cien barras ascendentes. La prueba comprueba cien marcas y C0 como primera categoría, además de la identidad completa del resultado en la unitaria. Se comprueba que el archivo original sigue intacto.

La alternancia de separador en la tabla no se reprodujo como cambio de caracteres del DOM en esta corrida; sí se reprodujeron los números sin separador en las etiquetas y los ejes. La nueva prueba de app exige `285,600` en tabla, total, marca y eje al cambiar idioma y al cambiar de campo y volver. No se atribuye una causa no demostrada a la variación visual informada.

El tooltip «Parece un monto o un porcentaje» está presente y se prueba. Descuento puede seguir clasificado como Categoría; la advertencia no lo convierte en Número. No se implementa F2b-2.

## Rojo → verde real

| Punto | Rojo conservado | Verde observado antes de cerrar la fuente |
|---|---|---|
| 1 · mismas cien filas y orden | [unitaria](review-01-truncated-red.log), Top10=true | [14/14 unitarias](review-01-truncated-green.log) |
| 1/2 · aviso y cien barras reales | [app](review-02-truncated-ui-red.log) | [7/7 E2E finales](review-final-focused.log) |
| 3 · motivo cortado | [geometría original](review-03-original-geometry-red.log),6,3046875px | [17px, sin solapes](geometry.json),7/7 |
| 6 · cuatro campos, acciones bajas | [cuatro campos](review-03-layout-red.log) | [seis campos](fields-visible.json),7/7 |
| 6 · no ocultar Filtros al mover acciones | [iteración intermedia](review-06-zones-red.log) | cuatro regiones completas verificadas,7/7 |
| 4 · atribución de elección tras cambiar zona | [app](review-04-choice-red.log) |7/7; también exige el mensaje tras clic real |
| 5 · formato por idioma y tipo de gráfico | [8 fallos nuevos](review-05-number-red.log) | [107/107 en4archivos](review-05-number-green.log), incluidas67equivalencias SQL |
| 5 · marca285600 frente a tabla285,600 | [app](review-05-number-ui-red.log) |7/7; cambio de campo y es/en |

La prueba roja de geometría se ejecutó contra la compilación anterior conservada en un worktree auxiliar: su árbol src era `7eab4be2154c781b83f1418be6e8603c4837f540`, idéntico al del head revisado0a79012. Después de unir los avisos ese mismo caso ya pasaba; no se presenta ese resultado como un rojo.

Una ejecución intermedia de61casos dejó59aprobados y2fallos: ambos consumidores todavía exigían «Gráfico parcial», que se había perdido al retirar el aviso duplicado. Se conservó esa identificación en el aviso único, sin borrar ni relajar las aserciones. Los dos consumidores se volvieron a ejecutar junto a los cinco casos nuevos:7/7 en58,2s, sin retries. El consumidor de SVG exige ahora los mismos recuentos con separador de miles (`2,400`; `2,000 de2,400`), de acuerdo con el cambio solicitado. Fuente, fórmulas, PDF/PNG y preservación del archivo mantienen sus comprobaciones.

Comandos reales durante los bloques: `npm test -- tests/chart-top.test.ts`; `npm test -- tests/chart-top.test.ts tests/chart-presentation.test.ts tests/charts.test.ts tests/chart-equivalence.test.ts`; `npm run test:e2e -- tests/e2e/chart-review.spec.ts … --retries=0`; casos enfocados directos con `npx playwright test` sobre un build de la fuente correspondiente. El log final especifica los siete títulos ejecutados. check acabó0errores/0avisos tras corregir los tipos; el cierre del nuevo SHA debe volver a ejecutar check, unitarias completas, E2E completa y build real.

## Seguimiento de CI: lectura coherente del mapa de calor

El head5ea3530 terminó localmente con check0/0,2.402unitarias completas y548E2E en18,3min, sin omisiones ni retries. En su CI41510205256, Ubuntu rechazó la prueba existente «F2a: series sin depender del color y cifras legibles sobre las celdas del mapa de calor», tanto en el intento como en retry1: cuatro celdas y su contraste sí se verificaron, pero faltaba la escala en una lectura y el eje en la otra. [Rojo remoto](ci-heatmap-red.log), [traza conservada por GitHub](https://github.com/ruzer/freyalab/actions/runs/41510205256/artifacts/13174636285).

La traza muestra la lectura de celdas unos6–7ms después del cambio de tema, y eje/escala en llamadas posteriores separadas. Esa observación es compatible con un redibujado intermedio; no demuestra por sí sola una regresión del motor. Se corrigió solo la sincronización de esa prueba consumidora: una lectura atómica reúne celdas, eje visible y escala; expect.poll espera las mismas condiciones usando el plazo ya configurado. Se conservan las cuatro celdas, contraste≥4,5:1, dimensiones de la escala y separación de2px. No se cambia src, ningún plazo, retries, workflow ni aserción de datos.

La prueba final se ejecutó tres veces deliberadamente con `--repeat-each=3 --retries=0`: [3/3 en25,7s](review-heatmap-visible.log). No son reintentos ocultos. La corrida fallida de5ea3530 se canceló en sus otros ejecutores al preparar el reemplazo; no se presentan como plataformas aprobadas. El nuevo head requiere su propia CI completa. El árbol src es idéntico al validado localmente con548E2E; se conserva esa evidencia por SHA y se verifica el consumidor modificado, evitando repetir innecesariamente el mismo recorrido local del producto.

## Capturas antes / después

Mismo CSV sintético, sin retoque; temas asentados y movimiento reducido. El antes corresponde a la fuente0a79012; el después a los árboles identificados arriba.

| Tamaño | Claro | Oscuro |
|---|---|---|
|1280×720|[Antes](before-light-1280x720.png) · [Después](after-light-1280x720.png)|[Antes](before-dark-1280x720.png) · [Después](after-dark-1280x720.png)|
|1440×900|[Antes](before-light-1440x900.png) · [Después](after-light-1440x900.png)|[Antes](before-dark-1440x900.png) · [Después](after-dark-1440x900.png)|

Las capturas cubren conjuntamente los puntos2,3y6. Se inspeccionó la imagen clara1280×720: aviso único, motivo entero, cien barras, porcentajes no nulos y acciones/zonas visibles. El manifiesto registra hashes de los artefactos.

## Límites y propuesta posterior

Un Top10 global sobre un resultado truncado requeriría una historia de motor: ordenar los grupos completos por la medida elegida antes de aplicar el límite, definir empates estables, series y valores nulos, y conservar totales/alcance coherentes. Es propuesta, no aprobación ni implementación. El truncado actual sigue limitado a lo que devuelve el motor; con series, el recuento existente corresponde a combinaciones.

No dependencias, cambios en chartSQL, guardado, IPC, límites, CI o plazos. No arrastre F2c ni conversión de montos/porcentajes F2b-2. No fusión, publicación ni actualización instalada.

La CI anterior0a79012 dejó Windows CANCELLED por superar45min: **no es una plataforma verificada ni CI verde**. Sus resultados son históricos; la CI del nuevo head se informará separadamente en el PR. No se declara «todas las pruebas pasaron» a partir de ese job. Intel, lector de pantalla manual e instalación manual no se verificaron en esta revisión. SEG-S2e conserva su fallo esperado heredado de Word.
