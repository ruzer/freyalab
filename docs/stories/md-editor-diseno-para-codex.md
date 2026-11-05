# Editor Markdown — E1 selección visible, E2 formato inline fiable, E3 vista en vivo (estudio)

Diseño: Claude. Implementa: Codex. Decide y fusiona: el propietario.
Evidencia: reproducido en la app real (macOS arm64, `main` 22b871f; scripts de sondeo fuera del repo).

## Hallazgos reproducidos

### H1 — La selección no se ve en la línea activa (causa raíz del «no me deja seleccionar»)
- La selección SÍ existe (`getSelection()` devuelve «mundo»; CodeMirror dibuja el rectángulo de 257 px), pero no se pinta.
- Causa: `'.cm-activeLine':{backgroundColor:'var(--hover)'}` (`Editor.svelte`, tema de `EditorView.theme`) es **opaco** (`#e7e7ee` claro, `#2b2b32` oscuro) y cubre la capa de selección (`.cm-selectionBackground`, z-index −2, `var(--tint)`).
- Efecto: doble clic en una palabra, arrastrar sobre una línea, Mayús+flechas dentro de la línea → nada resaltado. Con selección multilínea solo se ve en las líneas que no son la del cursor (la última o la primera, según la dirección).
- Ocurre en el editor de Markdown, y por compartir `Editor.svelte`, probablemente también en Mermaid y CSV texto (comprobar).

### H2 — La negrita (y cursiva/tachado/código) produce Markdown inválido o inútil
Casos medidos (selección entre corchetes, `|` = cursor):
| Caso | Resultado actual | Problema |
|---|---|---|
| `Hol|a mundo` + Negrita | `Hol****a mundo` | inserta marcadores vacíos en medio de la palabra; Word aplicaría a la palabra |
| `[Hola ]mundo` | `**Hola **mundo` | `**` seguido/precedido de espacio no abre/cierra negrita: se ve literal |
| `Hola[ mundo]` | `Hola** mundo**` | ídem |
| `[Hola mundo\n\nOtr]a linea` | `**Hola mundo\n\nOtr**a linea` | cruza párrafos: Markdown no lo interpreta |
| doble clic en Windows | incluye el espacio final | dispara el caso 2 casi siempre |
Casos que sí funcionan (no regresar): palabra con doble clic, arrastre de varias palabras, quitar negrita, `m[und]o` → `m**und**o`, lista, punto final fuera de los marcadores.

## E1 — Selección siempre visible (PR pequeño, primero)
Historia: como persona que edita, cuando selecciono texto quiero verlo resaltado en cualquier línea, enfocada o no, en claro, oscuro y contraste forzado.

Criterios de aceptación
1. Doble clic, arrastre y Mayús+flechas sobre la línea activa muestran el resaltado. La prueba falla primero: captura del recorte de la línea sin selección vs con selección; deben diferir en la zona de la palabra (comparar buffers, sin dependencias nuevas), en claro y oscuro.
2. El texto seleccionado conserva ≥ 4,5:1 contra el fondo del resaltado; el resaltado se distingue del fondo y del fondo de línea activa. Define UN token `--selection` (y `--selection-inactive` para ventana sin foco) con valores claro y oscuro; documenta la razón de contraste.
3. Solución sugerida, la más pequeña: línea activa translúcida o sin fondo mientras hay selección no vacía. No muevas la capa de selección ni cambies versiones de CodeMirror.
4. Ventana sin foco: la selección sigue visible (gris del token inactivo).
5. `forced-colors: active`: usa `Highlight`/`HighlightText`. Comprueba con emulación.
6. Revisa el mismo comportamiento en Mermaid y CSV texto (mismo componente) y en la Vista previa (selección con ratón); informa, no amplíes alcance si no falla.
7. Sin cambios en el comportamiento de edición. Pruebas unitarias existentes intactas.

## E2 — Formato inline fiable
Historia: como persona que escribe, cuando aplico negrita, cursiva, tachado o código quiero que el resultado sea Markdown válido y que actúe como en un procesador de texto.

Reglas (aplican a negrita, cursiva, tachado y código en línea):
- R1 Cursor sin selección **dentro o tocando una palabra** (`\p{L}\p{N}_`, Unicode) → aplica a la palabra completa y conserva la posición del cursor dentro de ella. Cursor en espacio, puntuación, inicio de línea o línea vacía → comportamiento actual (marcadores vacíos con el cursor en medio).
- R2 Selección con espacios al borde → recorta los espacios inicial y final antes de envolver; los espacios quedan fuera de los marcadores. Selección solo de espacios → sin cambio.
- R3 Selección que cruza líneas o párrafos → envuelve cada segmento no vacío por separado, conservando prefijos de bloque (`- `, `1. `, `> `, `# `). Omite bloques de código con valla y no cruces `|` de tablas (una celda a la vez; varias celdas: sin cambio, sin error).
- R4 Alternancia: si todos los segmentos ya están formateados, quita el formato de todos; si solo algunos, aplica a los que faltan.
- R5 Tras aplicar, la selección queda sobre el contenido (sin los marcadores), como hoy.
- R6 Mantén: atajos ⌘/Ctrl+B, I, ⇧X; `aria-pressed`; deshacer en un solo paso; archivos CRLF; composición IME (no actuar durante composición); sin cambios en bloques con valla.
- R7 `lineFormatState` debe seguir diciendo «negrita activa» cuando el cursor está dentro de una palabra ya en negrita.

Pruebas (fallan primero), en `tests/markdown-commands.test.ts` y una E2E real en `tests/e2e/markdown-editing.spec.ts`:
- La tabla de H2, cada fila con su resultado esperado: `**Hola** mundo` (cursor en palabra), `**Hola** mundo` (selección con espacio final), `Hola **mundo**` (espacio inicial), `**Hola mundo**\n\n**Otr**a linea` (dos párrafos).
- Validación semántica: renderiza el resultado con el mismo pipeline de la Vista previa y comprueba que existe `<strong>`/`<em>`/`<del>`/`<code>` y que no quedan `*` literales.
- Acentos/emoji/CJK, CRLF, palabra al inicio/fin de línea y de documento, cursor al borde de la palabra, lista, cita, encabezado, tabla, valla, selección inversa (cabeza antes que ancla).
- Aleatoria acotada (property-based sin dependencias): para texto aleatorio y selecciones aleatorias, aplicar dos veces la misma acción restaura el texto original, y el resultado nunca deja `**` adyacente a espacio exterior.

## E3 — «Como Word»: ¿es factible? (solo estudio; no implementar sin decisión)
Respuesta corta: **sí, a medias y sin dependencias nuevas**. Tres niveles:

| Nivel | Qué es | Coste | Riesgo |
|---|---|---|---|
| A. Barra + atajos fiables (E1+E2) | Hoy mismo: seleccionar y aplicar estilo sin sorpresas | Bajo | Bajo |
| B. **Vista en vivo** (como Obsidian) | El mismo documento en CodeMirror; los marcadores `**`, `#`, `[]()` se ocultan salvo en la línea con el cursor; títulos, negritas, enlaces, listas y tareas se ven con su estilo. Conmutador «Fuente / Vista en vivo». El archivo sigue siendo Markdown idéntico | Medio (decoraciones CM6 sobre el árbol Lezer ya instalado) | Medio: IME, lectores de pantalla (texto oculto), tablas/Mermaid/matemáticas, rendimiento en archivos grandes, desplazamiento del cursor al ocultar marcadores |
| C. WYSIWYG real (ProseMirror/Tiptap/Milkdown) | Edición sobre un modelo rico y exportar a Markdown | Alto | Alto: dependencias nuevas (ADR 0021), reescribe/normaliza el Markdown del usuario, pierde números de línea, plegado, multicursor, búsqueda por línea, CRLF y archivos grandes |

Recomendación: A ahora (E1, E2); luego un **estudio acotado de B** en una rama y PR en borrador, con las 7 preguntas del ADR 0021 respondidas (no hay dependencia nueva: reutiliza `@codemirror/*` y Lezer). No hacer C.

Criterios del estudio de B (mide, no prometas):
- Conmutador persistente por documento; por defecto sigue siendo la vista actual.
- Cero cambios al archivo: guardar tras alternar no altera ni un byte (CRLF incluido).
- Funciona con IME, deshacer/rehacer, multicursor y el Dividido actual.
- Lector de pantalla: el texto oculto no se pierde (la línea del cursor muestra la fuente).
- Rendimiento: documento de 1 MB y uno con tablas+Mermaid+matemáticas; si supera un umbral medido, vuelve a Fuente con aviso.
- Informe: qué elementos entran en la primera versión (títulos, negrita/cursiva/tachado, enlaces, listas, tareas, citas) y cuáles no (tablas, Mermaid, matemáticas).

## Orden y límites
E1 (PR propio) → E2 (PR propio) → decisión del propietario sobre el estudio E3.
Sin tocar CSV, Resumen ni empaquetado. Sin dependencias. Sin commits a `main`.
