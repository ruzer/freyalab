# Referencias independientes de Limpiar · integración de SIM-1a/SIM-1b

Base: `main 7bda2e968be6675957d1687a720169cf8f085e7a`. Rama independiente `codex/csv-limpieza-referencias`, previa a SIM-1f. No cambia su historia ni implementa su panel.

Al integrar SIM-1a y SIM-1b, `CsvTable.svelte` declara dos veces `cleanButton`: para el acceso Limpiar de la barra y para el elemento Limpiar del menú de columna. `npm run check` falla con tres diagnósticos y `npm run build` se detiene al compilar el renderer. Ambos rojos se conservaron antes del cambio, con fuente idéntica a `main`.

Se renombra únicamente la referencia del submenú a `columnCleanButton`, en su declaración, retorno de foco, enlace al elemento, condición y ancla del hijo. Se conserva `cleanButton` de la barra y todos sus consumidores. Las acciones, destinos, guardas, opciones, estilos y textos permanecen iguales.

## Siete respuestas del ADR 0021

1. **Does a tool already do this?** El compilador ya detecta la declaración duplicada; los enlaces `bind:this` y la restauración de foco existentes resuelven el comportamiento al conservar una referencia por elemento.
2. **Is there a skill we can reuse?** Ponytail y diagnóstico: revisar todos los consumidores, conservar el rojo y corregir solo el nombre en conflicto.
3. **Can it be integrated through CLI, API, or MCP?** Es un enlace local de Svelte. No necesita API, IPC ni otra integración.
4. **How mature, secure, and maintained is it?** Se reutilizan Svelte, `ContextMenu` y Playwright instalados. No cambian dependencias ni límites de seguridad.
5. **What maintenance cost does it add?** Un nombre distinto para dos elementos distintos y una E2E enfocada en su independencia de foco.
6. **What is the minimum glue LAB must write?** Cinco sustituciones del identificador del submenú en FreyaLab; LAB no cambia.
7. **Does writing our own code add value?** Permite compilar la integración y evita que un enlace sobrescriba o borre el otro al montar o desmontar el menú.

## Prueba y evidencia

Antes del cambio de fuente se añadió `las referencias de Limpiar conservan el foco independiente de barra y columna`, en `tests/e2e/table-toolbar.spec.ts`. Abre el submenú de columna, comprueba el retorno con Escape a Limpiar y después a la cabecera; luego abre Rellenar vacíos desde la barra y comprueba que cancelar devuelve el foco a su acceso. Conserva el documento confirmado; el cierre común comprueba los bytes y los errores del renderer.

También se adapta un selector heredado en `tests/e2e/column-menu.spec.ts`: el acceso de barra ya se llama Limpiar desde SIM-1b, por lo que se sustituye «Limpiar datos» por la traducción existente `t('charts.toolbar.clean')`. La prueba conserva las mismas veinte acciones y sus aserciones.

Validación en macOS, Node `24.22.1`: `npm run check` pasa sin errores ni advertencias; `npm run build` termina correctamente; `npx vitest run tests/table-empty.test.ts` pasa sus 31 pruebas. La suite completa `npm test`, con permiso para servidores locales y `FREYALAB_PANDOC_TEST_PATH=/opt/homebrew/bin/pandoc`, pasa 167 archivos y 2972 pruebas, con una omitida específica de Windows, en 16.85 s. El primer intento restringido falló con `listen EPERM` en los servidores locales de prueba; su log se conserva aparte, como limitación del entorno.

Raíz ejecutó las E2E de `column-menu.spec.ts` y `table-toolbar.spec.ts`: 26 pasaron y una falló por el selector heredado. La nueva prueba de foco pasó en esa ejecución. Tras adaptar el selector, el único caso fallido pasó en una ejecución enfocada de 1/1 (3.1 s). Las 27 identidades están verdes por la unión de ambas ejecuciones; no fue una sola corrida de 27/27.

La evidencia privada `recovery/csv-clean-bindings-evidence` conserva los rojos de compilación, el fallo del selector y su trace, hashes y logs. La prueba de equivalencia confirma que la fuente solo renombra las cinco referencias del submenú y conserva las cinco referencias de barra, sin modificar acciones ni guardas. La suite E2E completa y CI están pendientes; no hay publicación, push ni PR.
