# H14-1 · Barra de Markdown adaptable · 2026-11-05

Base de prueba `97eca425563415a9282477844031a7a5c888b124`. Electron local en macOS Apple silicon, Node 24. [Historia original](../stories/historia-14-pulido-edicion-diseno-para-codex.md) y [respuestas al ADR 0021](../design/h14-1-alcance-adr-0021.md).

## Rojo antes del cambio

- `npm run build` y `npx playwright test tests/e2e/markdown-toolbar.spec.ts -g 'H14-1:' --retries=0 --reporter=list`. El primer caso falló con botones fuera de la barra a 1100, 1000, 900, 800 y 700 px. A 1280 px no detectó recorte. A 1100 px quedaron cortados Buscar e Índice. A 700 px también quedaron cortados Cursiva, Código en línea y Tachado.
- `npx playwright test tests/e2e/markdown-toolbar.spec.ts -g 'TXT, Mermaid' --retries=0 --reporter=list`. TXT y Mermaid pasaron el sondeo. CSV Texto desbordó horizontalmente a 700 px. El ajuste redujo solo el espacio entre los controles de esa fila.

## Decisiones

- La barra conserva 43 px y mide el espacio de trabajo y los anchos de las etiquetas. El orden de traslado a «Más» es Tarea, Tabla, Mermaid, Insertar, Buscar e Índice. El selector de bloque y los cuatro formatos inline siguen en la fila.
- En Markdown, si la ventana y el explorador juntos dejan muy poco espacio, el explorador cede ancho visualmente y recupera el ancho preferido cuando vuelve a caber.
- «Índice» conserva el estado pulsado cuando es botón y lo expone como marcado cuando es un elemento de menú. Las acciones de formato en solo lectura exponen el motivo de bloqueo. Buscar e Índice siguen disponibles.
- Los 700 px se verificaron como ancho de viewport de Chromium. El mínimo configurado para una ventana nativa es 720 px.
- El texto de la historia se copió sin editar. SHA-256 `71e4feea83729ef767d5b909f7f18a15fd60a962bf2141532988f5f6cd13ed69`.

## Verde y límites

| Comprobación | Resultado |
|---|---|
| `npm run build` | Correcta. |
| `npm run check` | 0 errores y 0 advertencias. |
| `FREYALAB_PANDOC_TEST_PATH=/opt/homebrew/bin/pandoc npm test`, en serie | 125 archivos aprobados, 2.460 casos aprobados y 1 omitido. El Pandoc local no tiene soporte HTTP. |
| `npx playwright test tests/e2e/markdown-toolbar.spec.ts tests/e2e/ui.spec.ts --grep 'H14-1:|estadísticas CSV: muestra rotulada' --workers=1 --retries=0 --reporter=list` | 5 aprobadas sobre la compilación final en 6,6 s. Se cubren los seis anchos, navegación por teclado, inserción, explorador, en-XA, colores forzados y movimiento reducido. |
| Corrida amplia con `markdown-toolbar`, `markdown-editing`, `markdown-sidebar`, `csv-text` y `ui` | 90 de 92 aprobadas en la compilación anterior. El recorte CSV Texto en-XA a 800 px se corrigió activando la presentación compacta antes. La prueba de muestra CSV agotó su plazo durante una corrida concurrente y pasó al ejecutarse en serie sobre la compilación final. |

Una corrida unitaria concurrente con Electron agotó el plazo de `large-search-runtime.test.ts` en la búsqueda por ocho rangos. La suite unitaria final en serie pasó sin cambios de plazos. Las pruebas de solo lectura, claro y oscuro pasaron en la corrida amplia. Quedan pendientes la suite E2E completa, el lector de pantalla real, los instaladores y la validación en otras plataformas. H14-2 y H14-3 quedan fuera del alcance.
