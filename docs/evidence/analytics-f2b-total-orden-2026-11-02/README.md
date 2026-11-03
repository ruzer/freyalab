# PR #108 · Total completo y orden explícito · 2026-11-02

Base de esta corrección: `29aac4c52aaa99f069533dfc22cf2d7e00d03128`, misma rama y PR. El propietario revisó la app y aceptó las correcciones anteriores; esta entrega solo aborda Total y el aviso de orden.

## Rojo → verde

| Punto | Rojo real, antes del cambio correspondiente | Cambio mínimo | Verde |
| --- | --- | --- | --- |
| Total, 1280×720 | Caja inferior 631,5 px frente a borde visible 623,5 px: recorte de **8 px**, en claro y oscuro | `tfoot` fijo al fondo del área desplazable (`position:sticky; bottom:0`) | Geometría de la fila completa dentro del área visible |
| Total, 800×720 | Caja inferior 667,5 px frente a borde visible 659,5 px: recorte de **8 px**, ambos temas | Mismo estilo, sin cambiar datos ni tipografía | Misma comprobación geométrica |
| Orden en es/en | El aviso decía «en el orden elegido» y no nombraba medida ni desempate | Texto por los campos que realmente ordena la consulta existente | Suma y Cuenta, dos idiomas, primeros cinco grupos comprobados contra literales independientes |
| Espacio estrecho | Al explicar el orden con una frase larga, el paginador quedó parcialmente fuera de vista | Acortar la ayuda a «Filtra o cambia Filas» / «Filter or change Rows» | Paginador íntegro, además de Total, con `toBeInViewport({ratio:1})` |

Se conservan [rojo de Total](total-red.log), [rojo de orden](order-red.log) y [regresión intermedia del aviso largo](notice-wrap-red.log). La primera prueba de 800 px intentó cambiar el tema con el explorador oculto; se corrigió el montaje para elegirlo a 1280 px antes de estrechar. Los rojos de Total publicados son los posteriores a esa corrección, ambos por geometría, no por ese montaje.

## Qué dice el aviso y por qué

No se cambió `chartSQL` ni el contrato de `chart-pivot`.

- Barras sin series ni agrupación temporal: la consulta existente ordena por `p.value` y desempata por `p.x`. El aviso nombra «Suma de Ventas» o «Cuenta» y el desempate «Cliente», sin atribuir al usuario una elección de orden.
- Con esta fuente, Suma empieza **C0, C1, C2, C3, C4**; Cuenta empieza **C0, C1, C10, C100, C101**, porque todos cuentan una fila y se aplica el desempate textual.
- Barras temporales: el campo principal es el periodo de Filas; con series, el desempate es el campo de Columnas. Barras con series sin tiempo: Filas y después Columnas. Mapa de calor: ambos campos de sus ejes. Se reutilizan los nombres accesibles y desambiguados existentes.
- El aviso nombra los criterios; no impone un sentido nuevo ni promete orden alfabético universal. Las opciones de orden y todos los resultados del motor se conservan.
- Un solo aviso, sin Top10 sobre truncados. Claves es/en con los mismos parámetros: `charts.fields.truncated`, `charts.fields.truncatedTies`.

Se incluye el ajuste opcional: **«Total de los 842 grupos»**, también en inglés. Solo se aplica a totales aditivos de resultados truncados, usando el recuento completo que el motor ya devolvía; no calcula un total sobre los 100 recibidos ni sobre la página de cinco. Los promedios y medianas conservan «Total (recalculado)».

El pie permanece visible en el área desplazable de la tabla; el cuerpo conserva su desplazamiento y paginación. No se reducen tamaños ni se cambia la fuente para hacer caber el texto.

## Pruebas locales

- Nuevas pruebas en `tests/e2e/chart-review.spec.ts`: dos tamaños en claro/oscuro, cajas dentro del área visible, paginador completo, suma independiente 1.146.383, orden Suma/Cuenta en es/en, etiqueta del total y bytes originales intactos.
- La aserción anterior del aviso se actualiza solo porque cambió su redacción; mantiene las cien barras, su orden, un único aviso y la ausencia de máximos globales falsos.
- Una pasada enfocada intermedia de `chart-fields`, `chart-review` y `csv-summary` aprobó **35/35** sin reintentos, 3,0 min. Después se acortó únicamente el final de dos frases de ayuda en cada catálogo para recuperar espacio; el resultado final se comprueba por separado a continuación.
- `npm run check`: salida 0, **0 errores / 0 avisos** sobre el cambio final.
- `FREYALAB_PANDOC_TEST_PATH=/opt/homebrew/bin/pandoc npm test`: salida 0, **2.402/2.402**, 122 archivos, **18,75 s**, sin omisiones. Pandoc real local 3.12.1; no tiene soporte HTTP, de modo que no acredita la eficacia de ese aislamiento.
- `npm run test:e2e -- tests/e2e/chart-review.spec.ts --grep 'Revisión108 final|truncado conserva|motivo con línea' --retries=0 --output=/private/tmp/freyalab-f2b-evidence/total-order-final-green`: salida 0, **5/5**, **29,8 s**, sin reintentos ni omisiones, con el texto compacto final. Incluye las tres nuevas comprobaciones y los casos anteriores de truncado y solapes.
- `npm run build`: salida 0, ejecutado por el script anterior antes del E2E, con las mismas fuentes. No se reutilizó un build anterior.
- La integral E2E local no se repitió; se mantiene la validación enfocada solicitada y se ejecutará toda la CI sobre el nuevo head.

## Capturas y medidas

Los archivos `before-total-*` y `after-total-*` comparan el mismo montaje sintético de **842 clientes y grupos**, a 1280×720 y 800×720, claro/oscuro. Cada JSON publica el borde superior/inferior de la fila y la intersección visible con el contenedor y la ventana. Las capturas se generan con la app real, sin retocarlas.

| Tamaño | Antes claro / oscuro | Después claro / oscuro |
| --- | --- | --- |
| 1280×720 | [claro](before-total-light-1280x720.png) · [oscuro](before-total-dark-1280x720.png) | [claro](after-total-light-1280x720.png) · [oscuro](after-total-dark-1280x720.png) |
| 800×720 | [claro](before-total-light-800x720.png) · [oscuro](before-total-dark-800x720.png) | [claro](after-total-light-800x720.png) · [oscuro](after-total-dark-800x720.png) |

## Alcance y no verificado

No se cambian `charts.ts`, `chart-pivot.ts`, límites, contratos, datos originales, exportaciones, guardado, IPC, dependencias, workflows ni el presupuesto de 30 s del caso de 200 campos. No se modifica ni se relanza Windows por la cancelación previa: esa decisión corresponde al propietario.

La CI del head final se registrará en el PR, separada de cualquier verde anterior, sin un commit documental que vuelva a iniciarla. Esta evidencia local no acredita Windows/Linux visual, instalación manual, lector de pantalla ni Intel. No se hace un benchmark nuevo de rendimiento; las pruebas geométricas verifican visibilidad.

Detenerse tras la entrega. Sin fusionar ni marcar listo; U0 continúa en espera de la fusión por el propietario. No F2b-2 ni F2c.
