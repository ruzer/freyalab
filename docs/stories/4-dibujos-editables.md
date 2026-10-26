# Iteración 4 · Dibujos editables

Investigación del editor de dibujos de Joplin y plan para FreyaLab. **No se incorpora ninguna dependencia hasta que el propietario apruebe la solución** (decisiones D1 a D6 al final). La única historia que se puede empezar ya es FL-DRW-001, que no necesita librerías.

Marcas: ✔ comprobado en el artefacto instalado o en el registro/repositorio oficial · ◐ por lectura de código o documentación · ○ no verificado.

## 1. Qué es el editor de dibujos de Joplin

REA (`analyze_javascript_application`, estático, sin ejecutar nada) y lectura directa sobre **Joplin 3.7.21 instalado** (`/Applications/Joplin.app`). El editor no está en el núcleo: es el plugin por defecto `io.github.personalizedrefrigerator.js-draw.jpl` («Freehand Drawing» 4.3.0, autor Henry Heino, licencia MIT según npm, `app_min_version` 3.3.0), empaquetado en `Contents/Resources/build/defaultPlugins/` ✔. Contiene `index.js` (52 KB), un diálogo web (`webview.js`, 1,1 MB, con la librería dentro) y un *content script* de markdown-it (`markdownIt-content.js`, `markdownIt.css`).

| Aspecto | Qué hace Joplin | Evidencia |
|---|---|---|
| Librería | **js-draw** (editor de dibujo a mano alzada, TypeScript) | ✔ rutas `js-draw/dist/...` en `webview.js` y manifiesto |
| Guardado | El dibujo es un recurso **SVG** (`image/svg+xml`, extensión `.svg`). No hay archivo auxiliar | ✔ `Resource.ofData(..., ".svg")` en `index.js` |
| Inserción | Escribe en la nota `![Freehand Drawing](:/<idDelRecurso>)`, una imagen Markdown normal | ✔ `insertNewDrawing()` |
| Edición posterior | Abre el mismo recurso SVG; solo se pueden editar los de tipo `image/svg+xml` (otros dan «no es una imagen editable»). Ofrece **Sobrescribir** o **Guardar como dibujo nuevo** | ✔ `editDrawing()` y cadenas `overwriteExisting`, `saveAsNewDrawing`, `notAnEditableImage` |
| Autoguardado | Copia de seguridad cada N minutos (ajuste) en `autosaves/autosave.svg` del directorio de datos del plugin; se recupera o borra con comandos | ✔ `src/autosave.ts` |
| Ajustes | Modo diálogo (pantalla completa o parcial), tipo de barra (predeterminada, lateral, desplegable), tema (igual que Joplin / claro / oscuro), atajos | ✔ cadenas `setting__*` |
| Importación | Puede insertar imágenes y PDF dentro del dibujo (avisa si el PDF es grande) | ✔ cadenas `images`, `pdfs`, `loadLargePdf` |
| Aislamiento | El diálogo es una ventana web; el mensaje solo se acepta si su origen empieza por `file:` | ✔ `dialog/window/window.js` |
| Botón «Editar» sobre la imagen | Hay cadena `edit` y un *content script* de markdown-it con estilos; no verifiqué su aspecto | ◐ |
| Comportamiento en ejecución | **No ejecuté Joplin ni creé un dibujo**; todo lo anterior es análisis estático del paquete | ○ |

## 2. La librería: js-draw

| Dato | Valor | Fuente |
|---|---|---|
| Versión / fecha | 1.33.0, publicada el 2025-12-26; último *push* al repositorio el 2026-03-31 | ✔ npm y API de GitHub |
| Licencia | MIT | ✔ npm y GitHub |
| Tamaño | 4,5 MB desempaquetado; dependencias: `@js-draw/math` y `@melloware/coloris` 0.25.1 (MIT) | ✔ npm |
| Salud del proyecto | 299 estrellas, 21 incidencias abiertas, no archivado. Sin versión nueva en unos 10 meses al 2026-10-26: **riesgo de mantenimiento a vigilar**, no un bloqueo | ✔ GitHub; interpretación mía |
| Integración | `new Editor(elemento)`, `editor.addToolbar()`, `editor.toSVG()`, `editor.loadFromSVG(...)`, `editor.remove()`. Sin framework: encaja con Svelte 5 en `onMount` y limpieza | ✔ README |
| Formato | Lee y escribe un **subconjunto de SVG**; conserva los elementos que no reconoce al exportar, de modo que el archivo sigue siendo editable. También exporta PNG/JPEG | ✔ README; ◐ la restauración exacta de trazos depende de su formato interno |
| Seguridad | `SVGLoader.fromString` carga el SVG en un `iframe` con `sandbox="allow-same-origin"` y CSP, con la nota «NO habilitar allow-scripts»; la opción `sanitize` descarta atributos desconocidos, pero un comentario del código avisa de que los *plugins* pueden añadir objetos | ✔ código fuente de `SVGLoader.ts` |
| Idioma | Incluye localización en español (`es.ts`) además de inglés, alemán, croata, eslovaco y chino | ✔ repositorio |
| Accesibilidad | El README no documenta teclado ni lectores de pantalla; es una herramienta orientada a puntero, lápiz y táctil | ✔ README; ○ la realidad hay que medirla |

### Alternativas descartadas (con motivo)

| Opción | Licencia y tamaño | Por qué no |
|---|---|---|
| Excalidraw 0.18.1 | MIT, **46,8 MB** desempaquetado, requiere **React** | Desproporcionado y ajeno a Svelte ✔ npm |
| tldraw 5.5.2 | «Ver LICENSE.md» (no es MIT simple), requiere React | Licencia por revisar; mismo problema de React ✔ npm |
| draw.io incrustado | No evaluado | Muy pesado y pensado para servicio web ○ |
| Editor propio sobre `<canvas>` | — | Contradice «no desarrollar un motor nuevo» y ADR de reutilizar |

## 3. Diseño propuesto para FreyaLab

**Almacenamiento (recomendado):** el dibujo es un archivo `.svg` junto al documento, en `<documento>.assets/dibujo-1.svg`, y el Markdown lleva `![Descripción del dibujo](documento.assets/dibujo-1.svg)`. Es una imagen normal: la ven otros visores (incluido GitHub), no hay formato propietario y la vista previa ya sabe cargarla (`Documents.image()` admite `.svg`, hasta 8 MiB, contenida en la carpeta del documento, entregada como `data:`) ✔.

**Insertar:** el menú **Insertar** gana «Dibujo…». Abre el editor en un panel grande; al pulsar «Guardar y cerrar» pide la **descripción** (texto alternativo, obligatoria para accesibilidad) y escribe el archivo y la línea Markdown en una sola acción deshacible.

```text
┌ Dibujo ───────────────────────────────────────────────────────┐
│ [lápiz][resaltador][borrador][selección][texto][forma] [↶][↷] │
│                                                               │
│            (lienzo de js-draw, tema claro/oscuro)             │
│                                                               │
│ Descripción: [ Diagrama de la sala, vista desde arriba   ]    │
│                         [Cancelar]  [Guardar y cerrar]        │
└───────────────────────────────────────────────────────────────┘
```

**Editar:** en la vista previa, una imagen creada por FreyaLab muestra «Editar dibujo». **Solo se abren como editables los SVG con la marca de js-draw/FreyaLab** (Joplin acepta cualquier SVG; aquí un SVG ajeno se trata como imagen, no como dibujo). El editor ofrece «Guardar» (sobrescribe tras comprobar el hash) y «Guardar como dibujo nuevo».

**Exportar:** PDF y HTML del documento incluyen el SVG como cualquier imagen (ya incrustada como `data:`); exportar el dibujo suelto a SVG/PNG es FL-DRW-005.

**Seguridad:** nombres de archivo generados por FreyaLab (nunca derivados de texto del usuario), contención en la carpeta de activos, tope de 8 MiB, escritura atómica y comprobación de hash como el resto del guardado; el SVG se muestra siempre con `<img>` (no ejecuta scripts) y `cleanSVG` solo se usa en exportaciones, nunca sobre el archivo editable.

## 4. Historias

### FL-DRW-001 · Activos relativos y «Guardar como» (sin dependencias)

**1. Historia de usuario.** Como persona que inserta imágenes en un documento, quiero que sigan apareciendo cuando guardo con otro nombre o recupero el documento, para no perder los dibujos ni las imágenes.

**2. Problema y evidencia.** El audit (`docs/EDITOR-UX-AUDIT.md`, F05) lo describe: las imágenes relativas se leen desde la carpeta del documento; «Guardar como» cambia esa carpeta; recuperar crea un documento sin ruta y usa Documentos como raíz. Sin resolver esto, insertar imágenes o dibujos produce enlaces que se rompen. Está leído en el código (`Documents.image()` resuelve contra `r.root`) y no reproducido por mí (◐).

**3. Diseño UX/UI.** Convención `<nombre>.assets/`. Al «Guardar como», los recursos referenciados que viven en la carpeta de activos antigua se **copian** a la nueva (nunca se mueven) y el texto se reescribe solo si cambia la carpeta; se informa «Se copiaron 3 imágenes». Un documento sin guardar no puede recibir activos: se pide guardarlo primero («Guarda el documento para poder insertar imágenes»). Una imagen no encontrada muestra un marcador con el nombre y una acción «Buscar…» en lugar de desaparecer.

**4. Criterios de aceptación.**
- A1. «Guardar como» conserva visibles todas las imágenes del documento que estaban en la carpeta de activos antigua.
- A2. El original no se modifica ni se borra; si la copia falla, el documento nuevo no se guarda a medias y el usuario ve el motivo.
- A3. Un documento recuperado sin ruta no escribe activos en Documentos; muestra el aviso del diseño.
- A4. Una referencia fuera del documento y de su carpeta de activos no se copia y se avisa (contención de rutas).
- A5. Sin dependencias; los tres tipos de lectura actuales (`data:`, relativa, bloqueada) no cambian.

**5. Casos límite.** Nombre con espacios y acentos; dos documentos con el mismo nombre de carpeta; enlaces simbólicos (hoy se rechazan); disco lleno a mitad de la copia; imagen mayor de 8 MiB; mayúsculas distintas en sistemas sin distinción; carpeta de solo lectura; Windows con rutas largas.

**6. Prompt ejecutable para Codex.**

```text
Tarea: FL-DRW-001 · Activos relativos y «Guardar como». Sin dependencias.
Lee AGENTS.md, CONTRIBUTING.md, docs/stories/4-dibujos-editables.md (FL-DRW-001) y docs/EDITOR-UX-AUDIT.md (F05). Rama codex/drw-001-activos desde main actualizado.
Archivos probables: src/main/documents.ts (image, saveNow y la ruta de «Guardar como»), src/main/index.ts (contratos IPC con zod), src/renderer/components/Preview.svelte, tests/files.test.ts, tests/e2e.
1) Reproduce primero F05 con una prueba que falle: documento con ![x](a.assets/x.png), «Guardar como» en otra carpeta, la imagen debe seguir resolviéndose.
2) Implementa A1–A5 con el menor cambio posible; reutiliza la contención de rutas existente (contained) y la escritura atómica del guardado. Nada se mueve ni se borra.
3) Comprobaciones: npm run check, npm test, npm run test:e2e, npm run build. Evidencia: docs/evidence/drw-001-<fecha>.md con rojo→verde, casos límite probados y los NO probados. PR en borrador; no fusionar.
```

**7. Plan de pruebas.** Reproducción de F05 (rojo); «Guardar como» con 0, 1 y 3 imágenes; fallo de copia simulado (disco lleno, carpeta de solo lectura); documento recuperado; ruta hostil (`../..`); nombres con acentos y espacios; regresión de guardado atómico, recuperación y de las pruebas de `files.test.ts`.

**8. Criterios de revisión.** Rojo→verde del caso F05; ninguna escritura fuera de la carpeta del documento; la copia es atómica o se revierte; el texto del usuario solo cambia donde hace falta y con aviso; sin dependencias.

### FL-DRW-002 · Prototipo aislado con js-draw (BLOQUEADA hasta aprobar D1)

**1. Historia de usuario.** Como propietario, quiero medir si js-draw encaja en FreyaLab antes de decidir, para no comprometer el tamaño, la seguridad ni la accesibilidad por una intuición.

**2. Problema y evidencia.** La investigación (secciones 1 y 2) es estática y de documentación. Faltan medidas propias: tamaño real en el *bundle*, comportamiento bajo la CSP de FreyaLab, ciclo de vida en Svelte 5, fidelidad de ida y vuelta del SVG y accesibilidad por teclado.

**3. Diseño UX/UI.** Ninguno de producto: una rama de prototipo `spike/drw-js-draw` que **nunca se fusiona**, con una página mínima que abre js-draw, guarda y recarga un SVG, y un informe de medidas.

**4. Criterios de aceptación (medidas, no promesas).**
- S1. Diferencia de tamaño del *bundle* con js-draw cargado de forma diferida (como Mermaid), y confirmación de que el arranque no cambia.
- S2. Funciona con la CSP y sin red de FreyaLab (cero peticiones remotas durante crear, guardar y reabrir).
- S3. Ida y vuelta: un dibujo creado, guardado y reabierto conserva los trazos; un SVG ajeno (Inkscape, mermaid, hostil con `<script>` y `onload`) no se ejecuta ni se corrompe al abrirlo; se identifica **qué marca** del archivo permite tratarlo como dibujo editable.
- S4. Crear y destruir el editor 100 veces en una pestaña no acumula memoria ni listeners (medida real).
- S5. Auditoría de teclado y lector de pantalla: qué se puede hacer sin ratón, qué no, y qué alternativa se ofrece (descripción obligatoria, edición del texto alternativo).
- S6. Español: la interfaz de js-draw sale en español con el idioma de FreyaLab.
- S7. Licencias: `THIRD_PARTY_NOTICES.txt` y `npm run licenses` incluirían js-draw y Coloris sin conflicto.

**5. Casos límite.** SVG de 8 MiB; dibujo vacío; lápiz y pantalla táctil; tema oscuro; escalado alto; documento cerrado con el editor abierto; edición simultánea del mismo archivo desde otra pestaña.

**6. Prompt ejecutable para Codex.**

```text
Tarea: FL-DRW-002 · Prototipo js-draw. NO EMPIECES sin aprobación escrita del propietario (decisión D1).
Lee docs/stories/4-dibujos-editables.md. Rama de prototipo spike/drw-js-draw desde main; instala js-draw SOLO en esa rama. NUNCA abras PR de fusión: el resultado es un informe.
Mide S1–S7 y escribe docs/evidence/drw-002-spike-<fecha>.md con números reales, la salida de los comandos y un veredicto go/no-go propuesto con riesgos. Incluye la versión exacta de js-draw y de Coloris y sus licencias. Si algo no se puede medir, dilo. No cambies producción, package.json de main ni el lockfile de main.
```

**7. Plan de pruebas.** Cada criterio S1–S7 es una medida; el informe adjunta el `npm run build` con y sin la librería, el registro de red vacío, el corpus de SVG, la prueba de 100 ciclos y las notas de teclado.

**8. Criterios de revisión.** Cada afirmación tiene número o salida; el prototipo no contamina `main`; el informe distingue «no medido» de «sin problema»; recomendación go/no-go justificada.

### FL-DRW-003 a 005 (esbozadas, dependen de FL-DRW-001 y del «go» de FL-DRW-002)

| ID | Contenido | Criterio principal |
|---|---|---|
| FL-DRW-003 | Panel de dibujo con js-draw cargado de forma diferida, tema claro/oscuro, español, autoguardado de recuperación | Abre, guarda y reabre sin red; el arranque no cambia |
| FL-DRW-004 | «Insertar → Dibujo…», descripción obligatoria, una acción deshacible, «Editar dibujo» solo para SVG con la marca, «Guardar como dibujo nuevo» | El texto Markdown cambia en una sola transacción; un SVG ajeno no se ofrece como editable |
| FL-DRW-005 | Exportar el dibujo a SVG/PNG, incrustado en PDF/HTML, en tema claro | Contraste y fondo correctos; consistente con FL-MER-009 |

Se detallan en cuanto FL-DRW-002 dé un «go».

## 5. Decisiones del propietario

| ID | Decisión | Recomendación |
|---|---|---|
| D1 | ¿Se aprueba medir js-draw en una rama de prototipo sin fusionar? | Sí; cuesta poco y evita decidir a ciegas |
| D2 | ¿Dónde viven los activos? | `<documento>.assets/` junto al archivo |
| D3 | ¿Solo se editan dibujos con la marca de FreyaLab/js-draw? | Sí, para no alterar SVG ajenos |
| D4 | ¿La primera versión importa imágenes y PDF dentro del dibujo (como Joplin)? | No; solo dibujo a mano y formas |
| D5 | ¿La descripción (texto alternativo) es obligatoria? | Sí |
| D6 | ¿Qué nivel de accesibilidad por teclado se exige antes de publicarlo? | Documentarlo y ofrecer la descripción como alternativa; no prometer paridad con el ratón |
