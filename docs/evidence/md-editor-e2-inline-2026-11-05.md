# E2 · Formato inline fiable · 2026-11-05

Base de referencia `97eca425563415a9282477844031a7a5c888b124`. Validación local en macOS Apple silicon con Node 24.

## Reproducción

| Comprobación | Antes del arreglo |
|---|---|
| `npm test -- tests/markdown-commands.test.ts` | 19 fallos de 166 pruebas. El comando envolvía la selección completa o insertaba marcadores vacíos en una palabra. |
| `npx playwright test tests/e2e/markdown-editing.spec.ts --grep 'E2 inline'` | 2 fallos contra la compilación de E1, con los mismos archivos de producción que la base. El texto editado no coincidió con el esperado. |
| `npm test -- tests/markdown-commands.test.ts -t contiguo` | 4 fallos antes de corregir la ampliación de un tramo formateado contiguo a otro nuevo. |

## Cobertura

- Los cuatro casos H2 producen el Markdown esperado. Para los cuatro formatos se comprueba el HTML de `markdownHTML`, el pipeline real de la Vista previa, con `strong`, `em`, `del` y `code` y sin asteriscos literales introducidos por la acción.
- Se verifican selección inversa, CRLF, Unicode, espacios al borde, tramos mixtos, listas, citas, encabezados, celdas GFM, vallas y alternancia. En Electron se comprueban la Vista previa, la selección y un solo paso de deshacer.
- El comando conserva los dos extremos de la selección sobre el contenido y su dirección. Entre extremos se conserva una selección continua, que abarca los marcadores internos en varias líneas.
- Si unos delimitadores se interpretarían como texto literal, se conserva el original. Por ejemplo, seleccionar solo `(b)` dentro de `a(b)c` no admite negrita con asteriscos en CommonMark.
- Una medición exploratoria del comando puro con párrafos de texto plano dio aproximadamente 2,2 s antes de acotar el análisis, 16 ms después para 1 MiB y 116 ms para 10 MiB. No es un presupuesto de rendimiento para documentos con vallas, HTML, citas, referencias o fórmulas que pueden exigir analizar más contexto.

## Validación final

| Comando | Resultado |
|---|---|
| `npm test -- tests/markdown-commands.test.ts tests/markdown-format-selection.test.ts` | 197 aprobadas. |
| `npm run check` | 0 errores y 0 advertencias de svelte-check. TypeScript terminó correctamente. |
| `FREYALAB_PANDOC_TEST_PATH=/opt/homebrew/bin/pandoc npm test` | 125 archivos aprobados, 2.487 pruebas aprobadas y 1 omitida. El Pandoc local 3.12.1 carece de soporte HTTP. |
| `npm run build` | Compilación correcta. |
| `npx playwright test tests/e2e/markdown-editing.spec.ts tests/e2e/markdown-toolbar.spec.ts tests/e2e/ui.spec.ts --workers=1 --reporter=list` | 65 aprobadas en 1,3 min. |

Pendientes de verificación local: IME físico (se simuló la composición), la suite E2E completa, instaladores y otras plataformas. H13 queda fuera de esta entrega.
