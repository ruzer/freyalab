# Iteración 1 · Correcciones del renderizado Markdown

Una historia, cuatro bloques independientes (A a D). Codex debe hacer **un commit por bloque** (prueba en rojo, luego corrección) para que cada uno se pueda revisar y revertir por separado.

## FL-MD-002 · Que lo escrito en Markdown se vea y navegue como se espera

### 1. Historia de usuario

Como persona que escribe notas y guías en Markdown, quiero que los metadatos del encabezado no estorben, que los enlaces a mis secciones y a mis notas al pie funcionen y que los bloques plegables muestren todo lo que escribí, para no tener que revisar el código fuente cada vez que algo no aparece.

### 2. Problema y evidencia

Medido con una copia exacta de la cadena de `markdownHTML` (`src/renderer/lib/render.ts`, `unified` 11.0.5) sobre el `node_modules` del repositorio. Resultados reales:

| Bloque | Entrada | Resultado actual |
|---|---|---|
| **A** Front matter | `---\ntitle: Guía\ntags: [a, b]\n---\n\n# Hola` | `<hr>` y un `<h2 id="heading-title-guía-tags-a-b">` con el texto de los metadatos; ese título **entra al índice** (`headings`). |
| **B** Enlace interno | `# Instalación` y `[ir](#instalacion)` | El título recibe `id="heading-instalación"`; el enlace queda `href="#instalacion"`. En la vista previa, `Preview.svelte` busca `[id="instalacion"]`, no lo encuentra y **no hace nada, sin avisar**. En el HTML exportado no hay controlador de clics, así que el enlace está muerto. |
| **C** Nota al pie | `Texto[^1]` y `[^1]: Nota.` | La referencia tiene `id="user-content-user-content-fnref-1"` y apunta a `#user-content-fn-1`, pero la nota tiene `id="user-content-user-content-fn-1"`: el prefijo se aplica **dos veces** y ningún salto coincide. La sección dice «Footnotes» y el enlace de vuelta «Back to reference 1» (inglés), y «Footnotes» **entra al índice** como `heading-footnotes`. |
| **D** Plegable | `<details><summary>Más</summary>\n\ncontenido\n\n</details>` | Sale solo `<p>contenido</p>`: el texto «Más» **se pierde en silencio**. La causa no es el saneado: `remark-rehype` descarta los nodos `html` crudos (sin `allowDangerousHtml`). |

Contexto: el audit `docs/EDITOR-UX-AUDIT.md` ya señala el HTML embebido sin representar. El front matter es habitual en notas de Obsidian, Jekyll o Hugo, y la herramienta `vt markdown` de LAB planea escribirlo (propuesta CI-40); hoy FreyaLab lo muestra mal.

Pruebas existentes que no deben romperse: `tests/render.test.ts` (3 casos: GFM sin HTML ejecutable, anclas únicas con Mermaid, fórmulas y título escapado) y los E2E de `tests/e2e/ui.spec.ts`.

### 3. Diseño UX/UI

**A. Front matter.** En la vista previa se muestra una fila plegada al inicio: `▸ Propiedades del documento`. Al abrirla muestra el YAML tal cual, en una caja monoespaciada de solo lectura. No aparece en el índice ni en PDF/HTML exportados. El texto del archivo no cambia.

```text
┌──────────────────────────────────────────────┐
│ ▸ Propiedades del documento                  │   ← cerrado por defecto
├──────────────────────────────────────────────┤
│ # Hola                                       │
```

**B. Enlaces internos.** Un clic en `#sección` lleva a ese título y deja el foco en él (para teclado y lectores de pantalla). Si no existe, aparece un aviso no bloqueante: «No encontré la sección “instalacion” en este documento». La coincidencia tolera mayúsculas y acentos (`#instalacion` encuentra «Instalación»). En el HTML exportado el enlace funciona sin JavaScript porque el `href` ya apunta al `id` real.

**C. Notas al pie.** La sección final se titula «Notas al pie»; el enlace de vuelta dice «Volver a la referencia 1». Los saltos de ida y vuelta funcionan en vista previa y en el HTML exportado. La sección no aparece en el índice.

**D. Plegables.** `<details>` y `<summary>` se ven como un plegable nativo, accesible con teclado (Intro y Espacio). El contenido interior se interpreta como Markdown. En el PDF exportado todos los plegables salen **abiertos** (un `<details>` cerrado no imprime su contenido); en el HTML exportado conservan su estado.

### 4. Criterios de aceptación

**A**
- A1. Un documento que empieza con `---`, líneas de metadatos y un cierre `---` o `...` no produce `<hr>` ni `<h2>` de metadatos, y sus claves no entran en `headings`.
- A2. El YAML se muestra en el plegable «Propiedades del documento» de la vista previa y no aparece en el HTML ni en el PDF exportados.
- A3. Un documento que empieza con `---` pero **no** es front matter (por ejemplo `---\n\nTexto\n\n---`) conserva su comportamiento actual: separador y texto.
- A4. El texto fuente no se modifica, ni al abrir, ni al guardar, ni al exportar.

**B**
- B1. Para todo `href="#x"` del HTML generado existe un elemento con `id="x"` en ese mismo HTML (invariante comprobado sobre el corpus).
- B2. `[ir](#instalacion)` y `[ir](#Instalación)` llevan al título «Instalación»; con repetidos (`# Uno` dos veces) `#uno` lleva al primero.
- B3. En la vista previa, el clic desplaza al título y le da foco; si no existe, muestra el aviso del diseño sin lanzar excepción.
- B4. En el HTML exportado el enlace funciona sin el controlador de clics de la aplicación.
- B5. Enlaces externos y `mailto:` siguen abriéndose por `window.freya.openLink`.

**C**
- C1. Para cada nota, el `href` de ida coincide con un `id` y el de vuelta también (mismo invariante B1).
- C2. La sección y el enlace de vuelta usan español; el título de la sección no está en `headings`.
- C3. Los `id` de notas no se pueden usar para suplantar otros elementos: el prefijo se aplica una sola vez y el saneado de `id` sigue activo para todo lo que no sea generado por FreyaLab.

**D**
- D1. `<details><summary>Más</summary>` + Markdown + `</details>` genera un `<details>` con su `<summary>` y el contenido interpretado, sin pérdida de texto.
- D2. Solo se admiten las etiquetas `details` (atributo `open` opcional) y `summary` **sin otros atributos**. Cualquier otro HTML crudo sigue descartándose como hoy (el caso `<script>` de `render.test.ts` sigue pasando).
- D3. Una etiqueta sin pareja (por ejemplo solo `<details>` o solo `</details>`) **no hace desaparecer contenido**: el texto restante se muestra.
- D4. El PDF exportado muestra el contenido de todos los plegables; el HTML exportado conserva `open` según el documento.

**Transversales:** sin dependencias nuevas; `npm run check`, `npm test`, `npm run test:e2e` y `npm run build` en verde; los 3 casos de `render.test.ts` existentes pasan sin editarse.

### 5. Casos límite

- Front matter con CRLF, con BOM al inicio, con cierre `...`, vacío (`---\n---`), sin cierre, de más de 100 líneas, y un documento que empieza por un título y contiene `---` más abajo.
- Título repetido, título con símbolos o emoji, título solo con signos (`seccion` de respaldo), título con enlace dentro.
- Enlace a un título que está dentro de un `<details>` cerrado: debe abrirlo al navegar (o documentar que no).
- Dos notas con el mismo texto; nota referenciada dos veces; nota definida pero nunca usada.
- `<details>` anidado hasta 3 niveles; `<summary>` ausente; `<details>` dentro de una lista o cita; Markdown con tabla o código dentro del plegable.
- Entradas hostiles: `<details onclick="x()">`, `<summary><img src=x onerror=x></summary>`, `<details open="javascript:">`; ninguna debe conservar atributos ni ejecutar nada.
- Documento de 10 MiB (límite del editor): el tiempo de render no debe crecer de forma apreciable por la detección de front matter ni por la reescritura de enlaces.

### 6. Prompt ejecutable para Codex

```text
Tarea: FL-MD-002 · Correcciones del renderizado Markdown (4 bloques A–D).

Lee primero AGENTS.md, CONTRIBUTING.md y docs/stories/1-markdown-correcciones.md (criterios A1–D4 y casos límite).
Crea el worktree y la rama codex/md-002-correcciones-render desde main actualizado. No tocar package.json ni el lockfile.

Archivos probables: src/renderer/lib/render.ts (markdownHTML, standaloneHTML), src/renderer/components/Preview.svelte (linkClick, scrollToHeading, exportHTML), src/main/export.ts (solo si el PDF debe abrir los <details>), tests/render.test.ts, tests/fixtures/markdown-corpus/*.md (nuevo), tests/e2e/ui.spec.ts.

Método, por bloque y en este orden (A, B, C, D), con UN commit por bloque:
1. Escribe primero las pruebas del bloque en tests/render.test.ts con el corpus de la historia y ejecútalas: deben FALLAR por la razón descrita (guarda la salida roja).
2. Implementa lo mínimo. Preferencias de diseño:
   - A: detectar el front matter al inicio del texto (primera línea exactamente '---', cierre '---' o '...', líneas con forma clave: valor / lista / comentario / sangría, límite de 100 líneas) y apartarlo ANTES de parsear; devolverlo como campo opcional (frontMatter) del resultado. No dependas de remark-frontmatter.
   - B: reescribe los href '#frag' del HTML generado al id real del título (comparación sin acentos ni mayúsculas) en un plugin rehype que corre después de asignar los id; conserva el clic de Preview como respaldo con foco en el título y aviso si no existe.
   - C: elimina el doble prefijo y localiza etiquetas con las opciones de remark-rehype (footnoteLabel, footnoteBackLabel, clobberPrefix) y la configuración de rehype-sanitize; excluye la sección del índice.
   - D: transforma SOLO <details>/<details open>/<summary>…</summary>/</details> en un plugin remark propio y restringido (nodos html hermanos → nodos con data.hName), sin rehype-raw. Si concluyes que necesitas rehype-raw u otra dependencia, DETENTE y repórtalo.
3. Ejecuta de nuevo: las pruebas del bloque deben pasar y las anteriores seguir pasando.

Al terminar: npm run check && npm test && npm run test:e2e && npm run build. Pega el resumen de cada uno.
Evidencia: docs/evidence/md-002-correcciones-render-<fecha>.md con (a) la tabla rojo→verde por bloque, (b) el invariante B1 sobre el corpus, (c) una captura 1440×900 en tema claro y oscuro de cada bloque en la vista previa, (d) límites y lo que NO se verificó.
Entrega: PR en BORRADOR con el cuerpo basado en la historia. No fusiones, no publiques versiones, no actualices la app instalada. Si algo de la historia es ambiguo o imposible, detente y pregunta; no lo interpretes en silencio.
```

### 7. Plan de pruebas

| Nivel | Qué | Dónde |
|---|---|---|
| Unitaria (rojo→verde) | Una tabla de casos por bloque con entrada y salida esperada (los de la sección 2 y los límite 5) | `tests/render.test.ts` |
| Invariante | Para cada documento del corpus: todo `href="#x"` tiene un `id="x"`; ningún `id` duplicado; el índice no incluye metadatos ni «Notas al pie» | `tests/render.test.ts` + `tests/fixtures/markdown-corpus/` |
| Seguridad | Las entradas hostiles de la sección 5 no conservan atributos de evento ni `javascript:`; el caso `<script>` existente sigue pasando | `tests/render.test.ts` |
| E2E | Clic en `[ir](#instalacion)` desplaza y da foco; salto y vuelta de una nota; plegable con teclado; aviso por sección inexistente | `tests/e2e/ui.spec.ts` |
| Exportación | Exportar HTML y abrirlo en una ventana sin la aplicación: los enlaces internos y las notas funcionan; el PDF muestra el contenido de los plegables y no los metadatos | `tests/export.test.ts` y E2E de exportación existentes |
| Regresión | Los 3 casos actuales de `render.test.ts` y toda la suite E2E sin cambios | CI en las cuatro plataformas |

Ejemplo del primer caso (rojo esperado antes del cambio):

```ts
it('no convierte el front matter en un título ni lo mete en el índice', async () => {
  const r = await markdownHTML('---\ntitle: Guía\ntags: [a, b]\n---\n\n# Hola\n')
  expect(r.html).not.toContain('<hr')
  expect(r.headings.map(h => h.text)).toEqual(['Hola'])
})
```

### 8. Criterios de revisión (Claude)

- Los tres cambios de comportamiento (A, C, D) y la reescritura de enlaces (B) existen por separado en commits distintos y cada uno muestra rojo→verde.
- No hay dependencias nuevas; `package.json` y el lockfile no cambian.
- El texto del usuario nunca se modifica; la detección de front matter no consume contenido que no lo sea (caso A3).
- La seguridad no empeora: ningún atributo de HTML crudo sobrevive; la prueba de `<script>` original está intacta; el prefijo de `id` sigue protegiendo lo que no genera FreyaLab.
- La evidencia incluye el invariante B1 con números reales y capturas en ambos temas; el informe separa lo ejecutado de lo no verificado.
- Veredicto `NEEDS TESTING` si falta la exportación HTML/PDF o alguna plataforma de CI; `BLOCKED` si Codex propone una dependencia.
