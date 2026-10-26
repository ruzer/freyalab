# FL-MD-001 · Barra de formato Markdown

Fecha de comprobación local: **25 de octubre de 2026**. Base: `main` en `d17c427`.
Rama: `codex/md-001-barra-formato`. Equipo: Apple M2 Max, 32 GiB, macOS arm64; Node.js 24.22.1.

## Resultado y alcance

Registro puro `markdown-commands.ts`, adaptador de una transacción por acción en `Editor.svelte` y barra `MarkdownToolbar.svelte` en el mismo lugar de `App.svelte`. El selector de párrafo/título precede a B/I; se conserva el orden de los controles anteriores. No se añadieron franjas ni dependencias.

Se comprobaron aplicar/quitar formatos, selecciones vacías e inversas, títulos/listas/citas multilínea, cambios de nivel, líneas vacías, LF/CRLF, Unicode, cercas simples y dentro de citas/listas, selección y deshacer/rehacer, foco, teclado, solo lectura, cambio de documento y temas. Los marcadores vacíos muestran el formato pendiente, incluidas cuatro tildes entre las que está el cursor.

El estado consulta `syntaxTree`, sus ancestros y la línea del cursor. No convierte ni recorre el documento completo al mover el cursor. El fallback de marcadores es lineal en la longitud de esa línea; su prueba incluye 280 000 caracteres. Las acciones de bloque sí recorren las líneas para proteger las cercas. El texto sigue siendo el documento canónico; no hay conversión HTML → Markdown.

## Pruebas rojas y validación local

Las pruebas nuevas se escribieron antes de los cambios que verifican:

- Registro puro: falló primero por módulo inexistente. Regresiones adicionales fallaron antes de corregir cercas anidadas, marcadores vacíos y títulos ATX vacíos.
- E2E inicial: Negrita aplicaba el texto, pero faltaba `aria-pressed` en la barra original.
- Regresiones observadas y corregidas: tachado vacío interpretado como cerca por el árbol, incluido con espacios iniciales; atajos durante composición que podían llegar al explorador o al mapa predeterminado; ejemplo de tarea vacía que ya no producía casilla en la vista previa.
- Se corrigieron dos expectativas de la prueba: borrar una selección vacía usa Backspace y la prueba de composición verifica la selección real. No se relajaron las comprobaciones de integridad.
- Una ejecución global se interrumpió expresamente para añadir la regresión de indentación; no se cuenta como suite aprobada.

| Comando ejecutado | Resultado |
|---|---|
| `npm run check` | 0 errores y 0 advertencias |
| `npm test` | 411/411; 116 casos del registro Markdown |
| `npm run build` | Correcto |
| `./node_modules/.bin/playwright test tests/e2e/markdown-toolbar.spec.ts` | 20/20 antes del último ajuste de indentación; cubierto de nuevo por la suite global |
| `./node_modules/.bin/playwright test tests/e2e/ui.spec.ts --grep Markdown` | 3/3 tras adaptar el selector y la alternancia del bloque de código |
| `npm run test:e2e` | 212/212 (7,8 minutos), incluidos los 20 casos Markdown finales |

## Diseño y capturas

En 1440×900 y 1280×720, en claro y oscuro, se verificó que la barra contextual mide **43 px**, como la barra Markdown existente; el grupo de formato no supera 33 px. Todos los botones visibles, incluidos Editar/Dividido/Vista previa, Buscar e Índice, caben completos en el área. No se usó solo intersección parcial con el viewport como prueba de visibilidad.

El texto del botón activo usa `#174a91` sobre `#dbeafe` en claro (**7,10:1**) y `#dbeafe` sobre `#233e63` en oscuro (**8,87:1**), calculados con luminancia sRGB. El foco y el estado se distinguen en las capturas reales, sin retoques:

- [Claro · 1440×900](md-001-light-1440x900.png)
- [Oscuro · 1440×900](md-001-dark-1440x900.png)
- [Claro · 1280×720](md-001-light-1280x720.png)
- [Oscuro · 1280×720](md-001-dark-1280x720.png)

Las genera la prueba de barra compacta con `FREYALAB_MD_EVIDENCE=1`. Sin esa variable, la CI no reescribe los archivos del repositorio. La prueba adjunta sus medidas reales al informe de Playwright.

## Atajos elegidos

- **Ctrl/⌘ + B / I:** se mantienen. B consume el evento para no activar el explorador. I sigue sustituyendo intencionalmente `selectParentSyntax` del mapa predeterminado, como hacía el editor anterior.
- **Ctrl/⌘ + Alt + 0…3:** párrafo y títulos 1…3, agrupados por nivel y sin desplazar los atajos existentes.
- **Ctrl/⌘ + Mayús + X:** tachado, convención reconocible de edición de documentos.

Se compararon `defaultKeymap`, `historyKeymap` y `searchKeymap` instalados; los atajos nuevos no aparecen en ellos. Se verificó también el menú real de Electron mediante `Menu.getApplicationMenu()`; en macOS sus 19 aceleradores explícitos no chocan con los nuevos. `Alt+Command+I` corresponde a herramientas de desarrollo y es distinto de I sin Alt. La E2E vuelve a comprobar los aceleradores en cada plataforma.

Todos los comandos tienen control enfocable con Tab. Los selectores y el menú se manejan con teclado; las acciones devuelven el foco al editor. Durante composición, los atajos se consumen sin cambiar texto, selección ni explorador.

## Rendimiento observado y límites

Fixture real de **10 485 760 bytes**, con 43 509 líneas de datos y títulos al principio y al final. Medición local en la suite específica: apertura hasta el primer foco **79 570,96 ms**. Después de abrir: 20 movimientos de cursor; mediana **7,7 ms**, p95 empírico **7,9 ms**, máximo **11,3 ms**. Incluye comunicación con Playwright y el siguiente frame de Chromium; no es tiempo puro de ejecución ni una garantía para otros equipos.

La apertura lenta es un hallazgo fuera del alcance de esta entrega. No se atribuye a una causa confirmada ni se modifica el renderizador. Un fixture inicial con unas 655 000 líneas no completó la apertura dentro de 180 s; otro intento con el fixture de 43 509 líneas agotó el timeout de una acción de 30 s. La prueba final separa apertura y movimiento; mantiene un umbral amplio de 5 s por movimiento para detectar bloqueos, sin presentarlo como objetivo de UX. No desactiva la vista previa ni reduce los bytes del documento para pasar.

La composición se verifica con eventos sintéticos; no sustituye una prueba con un IME físico del sistema. El tachado se detecta en la línea del cursor porque la gramática CommonMark actual no ofrece ese nodo. Las cercas anidadas se protegen de forma conservadora: una cerca sin cierre puede bloquear también una acción posterior fuera de su contenedor. Quitar un bloque de código dentro de una cita/lista queda como no-op para preservar el contenedor; ampliar esa edición no forma parte de FL-MD-001.

No se cambiaron `package.json`, el lockfile, CSV, `Diagram.svelte`, `Preview.svelte` ni `render.ts`. En documentación existente solo se editó `## Markdown` de `EDITOR-MENUS.md`; el CSS global añadido está al final bajo `FL-MD-001`.

## CI y distribución

Las cuatro comprobaciones remotas son una puerta de aceptación adicional. El panel de checks del PR de esta rama identifica el commit y los resultados vigentes; este documento acredita las comprobaciones locales, no reutiliza checks de otra revisión.

No se fusionó el PR, no se publicó una release y no se actualizó la aplicación instalada. Compilar y ejecutar pruebas no acredita por sí solo la instalación de un paquete.
