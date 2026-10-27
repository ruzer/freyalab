# Iteración 3 · Experiencia de escritura en Markdown

Evaluación de las ocho ideas y cuatro historias listas. Regla de la iteración: **no duplicar lo que ya existe**. `main` ya trae (FL-MD-001) la barra con títulos, negrita, cursiva, tachado, código, listas, cita, separador, enlace, tablas, Mermaid y el selector de nueve lenguajes de código; por eso no hay historia de barra ni de menú «Insertar».

## Evaluación y prioridad

Evidencia sobre `origin/main` (2026-10-26): no hay controladores de pegado en el editor Markdown (las coincidencias de `paste` son del CSV), ni conteo de palabras, ni `spellcheck`; las casillas `- [ ]` se dibujan como `<input type="checkbox" disabled>`.

| # | Idea | Estado hoy | Valor | Esfuerzo | Riesgo | Decisión |
|---|---|---|---|---|---|---|
| 1 | Conteo de palabras | No existe | Medio | S | Bajo | **FL-MD-003** |
| 2 | Tiempo estimado de lectura | No existe | Medio | S (junto al 1) | Bajo | **FL-MD-003** |
| 3 | Pegar una URL sobre texto seleccionado | No existe | Medio | S | Bajo | **FL-MD-005** |
| 4 | Casillas interactivas | Solo lectura | Alto | M | Medio (edita el texto desde la vista previa) | **FL-MD-004** (tras FL-MD-002) |
| 5 | Corrector ortográfico nativo | No existe | Alto | S en macOS | **Alto en Windows/Linux** (diccionarios remotos) | **FL-MD-006**, bloqueada hasta decidir |
| 6 | Pegar HTML como Markdown | No existe | Medio | M | Medio (HTML no confiable; dependencia) | Aplazada: requiere aprobar `turndown` |
| 7 | Inserción visual de imágenes | No existe | Alto | L | Alto (rutas relativas, F05) | Aplazada: depende de FL-DRW-001 |
| 8 | Menú de inserción rápida (`/`) | **Duplica** el menú Insertar de FL-MD-001 | Bajo ahora | M | Medio (se activa en rutas, URLs, código) | No hacer; revisar con uso real |

Orden: FL-MD-003 → FL-MD-005 → FL-MD-004 → FL-MD-006. FL-MD-003 y FL-MD-005 son independientes y pueden ir en paralelo.

## FL-MD-003 · Palabras y tiempo de lectura

### 1. Historia de usuario

Como persona que redacta un informe o una entrada con un largo objetivo, quiero ver cuántas palabras llevo y cuánto se tarda en leer, para ajustar el texto sin salir del editor.

### 2. Problema y evidencia

La barra de estado (`<footer class="statusbar">` en `App.svelte`) muestra el estado de guardado y la apertura, pero ninguna medida del texto. El concepto de producto menciona «posición del cursor, codificación, delimitador» como información útil de la barra. La medición de ejemplo con `Intl.Segmenter('es', {granularity:'word'})` cuenta bien texto con signos, números y escritura sin espacios (12 palabras en la frase de prueba, incluido `你好世界`).

### 3. Diseño UX/UI

En la barra de estado, a la derecha y en texto discreto: `1 240 palabras · 7 min`. Con texto seleccionado cambia a `86 de 1 240 palabras`. Una ayuda emergente explica la regla: «No cuenta metadatos ni bloques de código. Lectura a 200 palabras por minuto». Solo aparece con Markdown y texto abiertos; en modo Vista previa se sigue mostrando.

### 4. Criterios de aceptación

- W1. El conteo usa `Intl.Segmenter` con el idioma del documento (`es` por defecto) y no cuenta signos de puntuación.
- W2. No se cuentan el front matter ni los bloques de código ni los bloques Mermaid; sí los títulos, listas y tablas. La regla está escrita en la ayuda.
- W3. Tiempo de lectura = `ceil(palabras / 200)` minutos; menos de 1 minuto se muestra «< 1 min».
- W4. Con selección, se muestra el conteo de la selección y el total.
- W5. Escribir no se retrasa: el cálculo se aplaza al dejar de teclear (≈300 ms) y, en documentos grandes, se hace por tramos; el límite de 10 MiB no congela la interfaz.
- W6. Etiquetas en español, anuncio accesible cortés solo al cambiar de documento, no por cada tecla.

### 5. Casos límite

Documento vacío; solo front matter; solo código; mezcla de idiomas; texto con números y fechas; guiones, apóstrofes y palabras con acento; selección que cruza un bloque de código; documento de 10 MiB; cambio de pestaña mientras se calcula.

### 6. Prompt ejecutable para Codex

```text
Tarea: FL-MD-003 · Palabras y tiempo de lectura en la barra de estado.
Lee AGENTS.md, CONTRIBUTING.md y docs/stories/3-markdown-experiencia.md (FL-MD-003). Rama codex/md-003-conteo-palabras desde main actualizado. Sin dependencias.
Archivos probables: src/renderer/lib/ (módulo puro nuevo, p. ej. text-stats.ts), src/renderer/App.svelte (footer.statusbar), tests/text-stats.test.ts (nuevo), tests/e2e/ui.spec.ts.
1) Pruebas primero: tests unitarios del módulo puro (reglas W1–W3 y casos límite) y un E2E que escribe texto y comprueba la barra; deben fallar porque el módulo no existe.
2) Implementa con Intl.Segmenter; cálculo diferido (~300 ms) y por tramos para documentos grandes; sin bloquear la escritura.
3) Verifica W1–W6; mide el tiempo con un documento sintético de 10 MiB y reporta el número (no afirmes «rápido» sin medida).
Comprobaciones: npm run check, npm test, npm run test:e2e, npm run build. Evidencia: docs/evidence/md-003-<fecha>.md con capturas 1440×900 en claro y oscuro. PR en borrador; no fusionar.
```

### 7. Plan de pruebas

Unitarias de la regla (puntuación, CJK, acentos, bloques excluidos, 200 wpm); E2E de actualización, selección y cambio de pestaña; medición de tiempo con 10 MiB; capturas en dos temas; verificación de que escribir no se ralentiza (marca de rendimiento con y sin la barra).

### 8. Criterios de revisión

La regla coincide con la ayuda; el módulo es puro y probado fuera de la interfaz; el número de rendimiento es real; no cambia el comportamiento de guardado ni de recuperación; la barra no desborda a 1280 px.

## FL-MD-005 · Pegar una URL sobre texto seleccionado

### 1. Historia de usuario

Como persona que cita fuentes, quiero seleccionar una palabra y pegar una dirección web encima para que se cree el enlace, sin escribir `[texto](url)` a mano.

### 2. Problema y evidencia

No hay controlador de pegado en `Editor.svelte` (`git grep` sobre `origin/main`: las únicas coincidencias de `paste`/`clipboardData` son del motor CSV). Hoy pegar sobre una selección **reemplaza** el texto por la URL y se pierde la palabra.

### 3. Diseño UX/UI

Sin interfaz nueva. Al pegar una URL sobre una selección no vacía, el texto queda como `[selección](URL)`. Deshacer (`Cmd/Ctrl+Z`) devuelve la selección original en un solo paso. `Cmd/Ctrl+Mayús+V` (pegar sin formato) pega la URL tal cual.

### 4. Criterios de aceptación

- P1. Solo actúa si el portapapeles es **una única** URL `http`, `https` o `mailto`, sin espacios ni saltos de línea, y hay una selección no vacía en una sola línea.
- P2. No actúa dentro de código en línea, bloques de código, un enlace existente o una URL; ahí se pega el texto normalmente.
- P3. El resultado es una sola transacción: un deshacer restaura el estado anterior y el cursor.
- P4. Los paréntesis y corchetes del texto o de la URL se escapan para no romper el enlace.
- P5. No hace peticiones de red ni obtiene el título de la página.
- P6. Con el documento de solo lectura, no actúa.

### 5. Casos límite

URL con paréntesis (`wikipedia.org/wiki/A_(B)`); URL con espacios o en varias líneas; selección multilínea; selección ya en negrita; pegar sobre un título; portapapeles con HTML rico; `javascript:` y `data:` (no se enlazan); IME en composición.

### 6. Prompt ejecutable para Codex

```text
Tarea: FL-MD-005 · Pegar una URL sobre texto seleccionado.
Lee docs/stories/3-markdown-experiencia.md (FL-MD-005). Rama codex/md-005-pegar-url. Sin dependencias.
Archivos: src/renderer/components/Editor.svelte (EditorView.domEventHandlers paste) y la lógica pura en src/renderer/lib/markdown-commands.ts o un módulo nuevo; tests/markdown-commands.test.ts.
1) Pruebas primero: tabla de casos (P1–P6 y los casos límite) sobre la función pura; deben fallar porque no existe. Añade un E2E de pegar y deshacer.
2) Implementa usando el árbol sintáctico de @codemirror/lang-markdown para saber si el cursor está en código o en un enlace. Una sola transacción con userEvent 'input.paste'.
3) Verifica P1–P6 y la composición IME con un evento sintético (di claramente que no es una prueba con IME físico).
Comprobaciones: npm run check, npm test, npm run test:e2e, npm run build. Evidencia: docs/evidence/md-005-<fecha>.md. PR en borrador; no fusionar.
```

### 7. Plan de pruebas

Tabla de casos de la función pura; E2E de pegado, deshacer y rehacer; verificación de no actuar en código/enlace/solo lectura; regresión de la barra de FL-MD-001 y del historial.

### 8. Criterios de revisión

La detección es estricta (una sola URL); no hay red; un deshacer; los escapes son correctos; no se altera el pegado normal en ningún otro caso.

## FL-MD-004 · Casillas interactivas en la vista previa

### 1. Historia de usuario

Como persona que lleva listas de tareas, quiero marcar una casilla directamente en la vista previa y que el documento se actualice, para no abrir el código para cambiar `[ ]` por `[x]`.

### 2. Problema y evidencia

`remark-gfm` genera `<input type="checkbox" disabled>` (comprobado). Cada `<li>` conserva su posición de origen tras el saneado (`position.start.line`: 1, 2, 3 y 5 en la prueba con listas anidadas y numeradas), así que se puede localizar la línea sin dependencias.

### 3. Diseño UX/UI

En la vista previa y en el modo dividido, las casillas se pueden pulsar con ratón, `Espacio` o `Intro`, con el cursor de mano y etiqueta accesible «Marcar tarea: <texto>». Al marcarla, el texto fuente cambia a `[x]` (o a `[ ]`), el documento queda con cambios pendientes y se puede deshacer. En documentos de solo lectura y en la exportación las casillas siguen deshabilitadas.

### 4. Criterios de aceptación

- C1. Marcar o desmarcar cambia **solo** los tres caracteres `[ ]`/`[x]` de esa línea; el resto del documento no se toca (CRLF/LF incluidos).
- C2. Una acción, un paso de deshacer; el estado «con cambios» se actualiza.
- C3. Funciona en listas anidadas, numeradas y dentro de citas; las casillas de un bloque de código no son interactivas.
- C4. Si el texto cambió entre el renderizado y el clic (carrera), no se escribe en una línea equivocada: se comprueba el contenido de la línea y, si no coincide, se avisa.
- C5. Solo lectura y exportación: casillas deshabilitadas.
- C6. Sin dependencias; el HTML saneado no gana atributos peligrosos (solo un `data-line` numérico generado por FreyaLab).

### 5. Casos límite

Documento editado mientras se hace clic; dos clics rápidos; `[X]` mayúscula; `*` y `+` como viñeta; casilla en una tabla (no existe en GFM); tarea anidada con sangría mixta; documento muy largo; undo tras guardar; modo Vista previa sin editor montado (el cambio debe pasar por el estado del documento, no por el editor).

### 6. Prompt ejecutable para Codex

```text
Tarea: FL-MD-004 · Casillas interactivas. REQUISITO: FL-MD-002 fusionada (toca el mismo render).
Lee docs/stories/3-markdown-experiencia.md (FL-MD-004). Rama codex/md-004-casillas desde main actualizado. Sin dependencias.
Archivos: src/renderer/lib/render.ts (añadir data-line numérico a los <li> de tarea), src/renderer/components/Preview.svelte (clic/teclado → callback), src/renderer/App.svelte (aplicar el cambio al texto con el mismo camino que las ediciones), tests.
1) Pruebas primero: unitarias de «dada la fuente y una línea, devuelve la fuente con la casilla alternada» (C1, CRLF, anidadas, carrera C4) y E2E de clic y deshacer. Deben fallar porque no existe.
2) Implementa con una transacción única; verifica el contenido de la línea antes de escribir.
3) Verifica C1–C6 con capturas 1440×900 en claro y oscuro.
Comprobaciones: npm run check, npm test, npm run test:e2e, npm run build. Evidencia: docs/evidence/md-004-<fecha>.md. PR en borrador; no fusionar.
```

### 7. Plan de pruebas

Función pura con tabla de casos (incluye la carrera); E2E de clic, teclado, deshacer, guardado y solo lectura; exportación con casillas deshabilitadas; seguridad (el saneado no admite otros atributos); regresión de FL-MD-002.

### 8. Criterios de revisión

El cambio es mínimo y reversible; la comprobación de la línea evita escrituras erróneas; el camino de escritura es el mismo que el del editor (un solo historial); la exportación no se vuelve interactiva.

## FL-MD-006 · Corrector ortográfico (bloqueada hasta decidir)

### 1. Historia de usuario

Como persona que escribe en español e inglés, quiero que el editor subraye las palabras mal escritas, para corregir sin herramientas externas.

### 2. Problema y evidencia

No hay rastro de `spellcheck` en `src` de `origin/main`. Según la documentación de Electron (consultada hoy): en **macOS** se usa el corrector nativo del sistema; en **Windows y Linux** se usan diccionarios Hunspell que **se descargan de una CDN de Google por defecto**, salvo que se indique otra URL con `session.setSpellCheckerDictionaryDownloadURL`. `AGENTS.md` exige «todos los recursos se incluyen localmente; sin telemetría ni cargas remotas». Por tanto, activar el corrector sin más rompería esa regla fuera de macOS. No he comprobado si el bloqueo de red de producción de la ventana principal impide esa descarga (○).

### 3. Diseño UX/UI

En el menú Editar: «Revisar ortografía mientras escribo» (activado por defecto solo si el sistema lo permite sin red) y «Idioma de revisión». Menú contextual sobre una palabra marcada: sugerencias, «Añadir al diccionario». Un aviso breve si el idioma no está disponible sin conexión.

### 4. Criterios de aceptación

- S1. En macOS, el editor subraya errores con el corrector del sistema; no se hace ninguna petición de red.
- S2. En Windows y Linux **no se activa** hasta que el propietario elija: (a) incluir diccionarios locales (es, en) con su coste de tamaño, (b) una URL propia, o (c) mantenerlo desactivado y documentarlo. Mientras tanto no se hace ninguna descarga.
- S3. El corrector solo actúa en texto y no en bloques de código ni de Mermaid (CodeMirror: atributo `spellcheck` en el contenido y desactivado en el resto).
- S4. Una prueba comprueba que no hay tráfico de red al activar el corrector (por plataforma).
- S5. El estado se recuerda entre sesiones y se puede cambiar desde Editar.

### 5. Casos límite

Idioma del sistema no disponible; documento en dos idiomas; palabras técnicas y nombres propios; tema oscuro (subrayado visible); archivos de 10 MiB; Linux sin Hunspell; modo solo lectura.

### 6. Prompt ejecutable para Codex

```text
Tarea: FL-MD-006 · Corrector ortográfico. ESTA HISTORIA ESTÁ BLOQUEADA: no empieces hasta que el propietario decida S2.
Cuando se desbloquee, lee docs/stories/3-markdown-experiencia.md (FL-MD-006) y AGENTS.md (recursos locales, sin cargas remotas). Rama codex/md-006-ortografia. Primero, en un spike sin merge, mide en cada plataforma qué descarga o consulta de red ocurre al activar el corrector y reporta la evidencia; después implementa solo la opción elegida. No añadas dependencias sin aprobación.
```

### 7. Plan de pruebas

Prueba de red por plataforma (sin tráfico); E2E del interruptor y su persistencia; verificación de que el código y Mermaid no se subrayan; prueba manual documentada en macOS.

### 8. Criterios de revisión

Cero tráfico de red demostrado; opción elegida por el propietario implementada tal cual; documentación de la limitación por plataforma; sin dependencias no aprobadas.

## Segunda tanda (2026-10-27): comparación con Joplin y MDViewer

El propietario comparó FreyaLab con Joplin (barra del editor) y MDViewer (índice lateral). Evidencia sobre `origin/main` en `61d0e05`, con la aplicación real (Electron 44, 1440×900); lo demás sale del código. Regla de la tanda: no duplicar lo que ya existe.

| # | Idea | Estado hoy | Valor | Esfuerzo | Riesgo | Decisión |
|---|---|---|---|---|---|---|
| 9 | Índice en la barra izquierda, con sección actual, ramas que se contraen y disponible al editar | Existe como lista plana en un panel derecho, sin sección actual, solo en Dividido y Vista previa | Alto | M a L | Bajo–medio (pestañas de la barra, desplazamiento y correspondencia con las líneas del editor) | **FL-MD-007** (índice como pestaña «Archivos \| Índice»; decisión del 2026-10-27) |
| 10 | Insertar fecha y hora | No existe (sin coincidencias en `markdown-commands.ts` ni en `MarkdownToolbar.svelte`) | Medio | S | Bajo | **FL-MD-008** |
| 11 | Etiquetas (tags): chips, filtro, lista con recuentos y edición | No existe | Alto | M a L (lectura) y L (edición) | Medio (dónde se guardan; escribir YAML) | **FL-MD-009** (chips, filtro y lista con recuentos; decisiones T1–T4 aprobadas el 2026-10-27) y **FL-MD-010** (edición) esbozada |
| 12 | Atrás/adelante entre documentos y «abrir en editor externo» | No existe (solo deshacer y rehacer) | Bajo | S a M | Bajo | No hacer ahora; ver «Aplazadas» |
| 13 | Dibujo libre (el lápiz de Joplin) | Planeado | Alto | L | Alto | Iteración 4 (`4-dibujos-editables.md`); decisiones D1–D6 aprobadas el 2026-10-27, FL-DRW-002 lista |

Sin diferencia con Joplin, y por eso sin historia: negrita, cursiva, código, tachado, títulos, listas con viñetas, numeradas y de tareas, separador, tabla y enlace (FL-MD-001).

Orden: FL-MD-008 puede ir en paralelo con cualquiera (toca `markdown-commands.ts` y `MarkdownToolbar.svelte`). FL-MD-007 y FL-MD-009 tocan la barra lateral de `App.svelte` (pestañas y lista de etiquetas): van seguidas, no en paralelo.

## FL-MD-007 · Un índice que dice dónde estás

### 1. Historia de usuario

Como persona que lee o edita un documento largo con muchas secciones, quiero que el índice me muestre en qué sección estoy, me deje contraer lo que no uso y viva en la barra lateral izquierda, junto al explorador de archivos, disponible también mientras escribo, para orientarme y saltar sin perder el hilo.

### 2. Problema y evidencia

El índice es una lista de botones con sangría de 10 px por nivel (`{#if outline&&active.kind==='markdown'&&mode!=='edit'&&headings.length}` en `App.svelte`, estilos `.outline` en `style.css`). Un clic llama a `preview.scrollToHeading(id)`. Medido con un documento sintético de 23 títulos (1 de nivel 1 y 22 de niveles 2 y 3, con títulos largos), 1440×900, modo Dividido:

| Medida | Resultado |
|---|---|
| Panel | 185 px de ancho; 755 px de alto visible y 1.000 px de contenido (245 px fuera de vista) |
| Altura de las filas | 29, 44 y 59 px; 5 de las 23 filas ocupan tres líneas (los títulos largos se parten, no se cortan) |
| Sección actual | **No existe**: el aspecto de las 23 entradas es idéntico con el documento al inicio, al 50 % y al final |
| Accesibilidad | 0 entradas con `aria-current`, 0 con `aria-expanded`, 0 con tooltip; el `<aside>` no tiene nombre accesible |
| Modo Editar | El panel desaparece (0 botones) mientras el botón «Índice» de la barra sigue activo y no hace nada visible |
| Ancho de ventana | 185 px por encima de 1100 px, 155 px hasta 850 px y oculto por debajo de 850 px |
| Clic en una entrada | Funciona: desplaza la vista previa (4.731 px en la prueba) |

**Dónde vive hoy.** El índice es un panel a la derecha, aparte de la barra izquierda del explorador (de 180 a 420 px, redimensionable; su visibilidad y su ancho se recuerdan en `localStorage` con `freya-sidebar` y `freya-sidebar-width`). El botón «Índice» de la barra de herramientas lo muestra u oculta (`outline=!outline`). En la captura de 1440×900 con el índice abierto, la vista previa mide unos 410 px: el panel derecho le quita 185 px. La barra izquierda solo tiene un ancho mínimo y máximo, sin reglas por ancho de ventana; el índice, en cambio, desaparece por debajo de 850 px.

La referencia del propietario (MDViewer) coloca el índice en la barra izquierda, con un conmutador entre carpetas e índice, y muestra un árbol con flechas para contraer ramas, la sección actual resaltada y los títulos largos cortados con puntos suspensivos. `App.svelte` enlaza además el `onscroll` del editor con la vista previa (línea 87); Codex debe comprobar el sentido de esa sincronización antes de mover el cursor del editor desde el índice.

### 3. Diseño UX/UI

**Dónde vive (decisión del propietario, 2026-10-27).** El índice deja de ser un panel a la derecha y pasa a ser una **pestaña de la barra lateral izquierda**, junto al explorador:

```text
┌───────────────────────┐
│ [Archivos]  Índice    │   ← pestañas; la activa va marcada
├───────────────────────┤
│ ▾ Manual de usuario   │
│   ▾ Primeros pasos    │
│ …                     │
├───────────────────────┤
│ FreyaLab alfa   Tema  │   ← el pie no cambia
└───────────────────────┘
```

- **Archivos** contiene exactamente el explorador de hoy (etiqueta EXPLORADOR con «＋», búsqueda, árbol o estado vacío y, con FL-MD-009, la lista «ETIQUETAS»). **Índice** muestra el índice del documento activo.
- La pestaña Índice solo está disponible con un documento Markdown activo. Con otro tipo de documento está deshabilitada, con la ayuda «El índice está disponible en documentos Markdown», y se muestra Archivos sin borrar la preferencia guardada.
- El botón «Índice» de la barra de herramientas sigue existiendo: abre la barra lateral si estaba oculta y selecciona la pestaña Índice; si el índice ya está visible, vuelve a Archivos.
- La última pestaña elegida se recuerda (como ya se recuerdan la visibilidad y el ancho de la barra). El ancho de la barra (de 180 a 420 px) es el mismo para las dos pestañas.
- Un documento sin títulos muestra «Este documento no tiene títulos» en lugar de ocultar el panel.
- Desaparecen el panel derecho, sus anchos de 185 y 155 px y su corte a 850 px: el índice queda disponible en ventanas estrechas mientras la barra esté visible, y la vista previa recupera el ancho que ocupaba.

El contenido de la pestaña Índice es un árbol:

```text
▾ Manual de usuario
  ▾ Primeros pasos
      Requisitos del sistema
  ▸ Flujo general de trabajo…          ← rama contraída
┃ ▾ Configuración avanzada…            ← sección actual: barra de 2 px + color de acento
      Opciones de exportación
```

- Cada título con hijos tiene una flecha (un botón aparte del título) que contrae o expande su rama.
- La **sección actual** se marca con una barra lateral de 2 px y el color de acento (no solo color) y con `aria-current="location"`. Si queda fuera de la vista del panel, este se desplaza lo mínimo para mostrarla.
- Si la sección actual está dentro de una rama contraída, se marca la rama visible más cercana; el índice nunca se expande solo.
- Los títulos largos ocupan como máximo dos líneas con puntos suspensivos; el texto completo va en el tooltip y es el nombre accesible.
- El estado de contracción vive en memoria mientras la aplicación está abierta, por documento. No se guarda en el archivo ni en disco.
- **Modo Editar:** la barra lateral es visible en todos los modos, así que el índice se muestra también. Un clic lleva el cursor al inicio de la línea del título, lo deja arriba del editor y enfoca el editor; la sección actual sigue la primera línea visible. En Dividido y Vista previa el clic sigue desplazando la vista previa, como hoy.

### 4. Criterios de aceptación

Cuatro bloques, un commit por bloque, en este orden: P, A, B, C.

**P · Pestañas en la barra lateral izquierda**
- P1. La parte superior de la barra tiene dos pestañas, «Archivos» e «Índice», con semántica de pestañas (`role="tablist"`, `tab` con `aria-selected` y `aria-controls`; las flechas izquierda y derecha, Inicio y Fin cambian de pestaña). La pestaña Archivos contiene exactamente el explorador actual sin cambios funcionales; el pie (marca y tema) se ve en las dos.
- P2. El índice se retira del lado derecho: no queda ningún panel `.outline` ni sus estilos (anchos de 185 y 155 px, `display:none` a 850 px, ni el estado `outline` de `App.svelte`).
- P3. La pestaña Índice solo está disponible con un documento Markdown activo. Con otro tipo está deshabilitada (`aria-disabled`) con la ayuda del diseño y, si estaba seleccionada, se muestra Archivos sin pisar la preferencia guardada; al volver a un Markdown reaparece la preferencia.
- P4. El botón «Índice» de la barra de herramientas abre la barra lateral si estaba oculta y selecciona Índice; si Índice ya está seleccionada y visible, vuelve a Archivos. `aria-pressed` refleja que el índice está visible.
- P5. La pestaña elegida se guarda en `localStorage` (`freya-sidebar-tab`, valores `files` u `outline`) con la misma tolerancia a fallos que `freya-sidebar-width`: valor ausente o inválido da Archivos, y sin almacenamiento la interfaz funciona igual.
- P6. El ancho de la barra (de 180 a 420 px, redimensionable y recordado) es el mismo en las dos pestañas.
- P7. Cambiar de pestaña conserva el estado de la otra: texto de la búsqueda de archivos, resultados, carpetas abiertas del árbol, desplazamiento y, en el índice, ramas contraídas y desplazamiento.
- P8. Con la barra oculta no se ve ni el índice ni el explorador; al reabrirla se muestra la última pestaña.
- P9. En ventanas de 850 px o menos el índice sigue disponible mientras la barra esté visible; a 1440×900 la vista previa mide al menos 185 px más que antes con el índice abierto (se mide antes y después).
- P10. Un documento Markdown sin títulos muestra «Este documento no tiene títulos» en la pestaña Índice.

**A · Sección actual (Dividido y Vista previa)**
- A1. Antes del primer título no hay sección actual. En cualquier otra posición la actual es el último título cuyo borde superior queda por encima del 30 % superior del panel de vista previa.
- A2. Al desplazar la vista previa (rueda, teclado, clic en el índice o en un enlace interno), la entrada actual cambia sin más de 100 ms de retraso tras detenerse el desplazamiento. Se marca con `aria-current="location"` y con un indicador que no depende solo del color.
- A3. La entrada actual queda visible dentro del panel; este se desplaza lo mínimo y sin animación.
- A4. Si el último título no llega nunca al umbral, se marca como actual cuando el desplazamiento llega al final del documento.
- A5. No se recorre el DOM en cada evento: los desplazamientos de los títulos se calculan tras cada render y al cambiar el tamaño, y el evento solo hace una búsqueda binaria. La evidencia da el coste medido por evento con 1.000 títulos.
- A6. Los títulos ocultos (por ejemplo dentro de un `<details>` cerrado) no cuentan para la sección actual.
- A7. El panel de la pestaña Índice es un `tabpanel` con el nombre accesible «Índice del documento».

**B · Ramas que se contraen**
- B1. El árbol se deriva de los niveles: un título es hijo del anterior de nivel menor. Un salto (nivel 1 a nivel 3) no crea nodos vacíos.
- B2. Cada título con hijos tiene una flecha con `aria-expanded` y nombre «Contraer sección <título>» o «Expandir sección <título>». Funciona con Intro y Espacio; Tab recorre la flecha y el título.
- B3. Contraer oculta los descendientes también para las tecnologías de apoyo (`hidden`), no solo a la vista.
- B4. La rama contraída que contiene la sección actual se marca como actual (A1) sin expandirse.
- B5. El estado se conserva entre renders y al cambiar de pestaña, identificado por la ruta de títulos (no solo por el `id`, que cambia al editar el título). Si el título desaparece, su estado se descarta.
- B6. Los títulos largos se limitan a dos líneas con puntos suspensivos, con tooltip y nombre accesible completos.

**C · Modo Editar**
- C1. La pestaña Índice funciona también en modo Editar (la barra lateral es visible en todos los modos) y se puede alternar con el botón «Índice» de la barra (P4).
- C2. En modo Editar, un clic en una entrada mueve el cursor al inicio de la línea de ese título, lo deja en la parte superior del editor y enfoca el editor. El texto no cambia.
- C3. En modo Editar, la sección actual sigue la primera línea visible del editor.
- C4. La correspondencia entre las entradas del índice y las líneas del editor se hace en orden y por texto contra los títulos del árbol sintáctico del editor (ATX y Setext). Una entrada sin pareja (por ejemplo, un título dentro de un bloque HTML) no mueve el cursor y avisa «Ese título no se puede localizar en el editor». **Nunca se salta a una línea equivocada.**
- C5. En Dividido y Vista previa el clic desplaza la vista previa como hoy, y el índice no cambia el contenido de ninguna exportación.

**Transversales:** sin dependencias nuevas; el texto del documento y el HTML exportado no cambian; `npm run check`, `npm test`, `npm run test:e2e` y `npm run build` en verde; se elimina el panel derecho con sus puntos de corte de ancho (1100 y 850 px); la barra izquierda conserva su ancho (de 180 a 420 px), su recuerdo y el resto de su comportamiento. Interacción con FL-MD-009: pulsar un chip de etiqueta selecciona la pestaña Archivos antes de escribir en la búsqueda; si FL-MD-009 se fusiona antes, este ajuste se hace aquí.

### 5. Casos límite

Documento sin títulos; solo títulos de nivel 2; saltos de nivel (1, 3, 2); títulos repetidos («Uno» dos veces); título solo con emoji o signos; título editado mientras su rama está contraída; documento con 1.000 títulos; títulos dentro de un `<details>` cerrado (tras FL-MD-002 un clic los abre); título dentro de una lista o una cita; título Setext (`Texto` y `===`); documento con front matter (el emparejamiento por texto no depende de los desplazamientos de línea); render progresivo mientras se desplaza; cambio de tema; ventana de 850 px o menos (el índice sigue disponible en la barra izquierda mientras esté visible); edición con IME (el clic en el índice no interrumpe la composición); modo Vista previa sin editor montado (C no aplica). Para las pestañas: documento no Markdown con la pestaña Índice seleccionada; cambio de Markdown a CSV y de vuelta; sin carpeta abierta (Archivos muestra «Abrir carpeta» e Índice sigue disponible); barra oculta y botón «Índice»; `localStorage` no disponible o con un valor inválido; documento sin títulos; barra de 180 px con títulos largos; teclado entre pestañas (flechas, Inicio, Fin); lector de pantalla; pulsar un chip de etiqueta (FL-MD-009) con la pestaña Índice seleccionada.

### 6. Prompt ejecutable para Codex

```text
Tarea: FL-MD-007 · Índice en una pestaña de la barra lateral izquierda, con sección actual, ramas contraíbles y modo Editar. FL-MD-002 (PR #67) ya está en main (ambas tocan Preview.svelte y render.ts).
Lee AGENTS.md, CONTRIBUTING.md y docs/stories/3-markdown-experiencia.md (FL-MD-007: criterios P1–P10 y A1–C5, casos límite y la medición de la sección 2). Rama codex/md-007-indice desde main actualizado. Sin dependencias; no toques package.json ni el lockfile.
Archivos probables: src/renderer/App.svelte (pestañas de la barra izquierda; retirar el panel derecho y el estado outline), src/renderer/components/Outline.svelte (nuevo), src/renderer/lib/outline.ts (funciones puras nuevas), src/renderer/components/Preview.svelte (exponer los desplazamientos de los títulos), src/renderer/components/Editor.svelte (ir a una línea; primera línea visible), src/renderer/style.css, tests/outline.test.ts (nuevo), tests/e2e/ (nuevo).
Método, por bloque y en este orden (P, A, B, C), UN commit por bloque:
1. Escribe primero las pruebas y comprueba que FALLAN por la razón descrita. Bloque P: E2E de pestañas (roles y flechas, botón Índice, localStorage con valor inválido, documento no Markdown, estado conservado al cambiar de pestaña, vista previa más ancha). Funciones puras: construir el árbol a partir de los títulos (B1), elegir la sección actual dada una lista de desplazamientos y un scrollTop (A1, A4, A6), emparejar títulos del índice con títulos del árbol sintáctico del editor (C4). E2E: desplazar y comprobar aria-current, contraer y expandir con teclado, clic en modo Editar.
2. Implementa lo mínimo. Reutiliza el tipo Heading de render.ts y el árbol sintáctico de CodeMirror que el editor ya importa (syntaxTree). Antes de mover el cursor desde el índice, comprueba el sentido de la sincronización onscroll del editor con la vista previa (App.svelte); si el clic en modo Editar provoca un desplazamiento extra de la vista previa, repórtalo.
3. Vuelve a ejecutar: las pruebas del bloque pasan y las anteriores siguen pasando.
Medición obligatoria: ancho de la vista previa a 1440×900 con el índice visible, antes y después de mover el panel; y con un documento sintético de 1.000 títulos: coste por evento de desplazamiento y tiempo de construir el árbol; comparar con main 61d0e05. Sin umbrales de reloj en las pruebas: demuestra con conteo de operaciones que el evento no recorre el DOM.
Al terminar: npm run check && npm test && npm run test:e2e && npm run build. Evidencia: docs/evidence/md-007-<fecha>.md con la tabla rojo→verde por bloque, capturas 1440×900 en claro y oscuro de cada bloque (panel con la sección actual marcada, una rama contraída, modo Editar), los números reales y lo que NO se verificó. PR en BORRADOR; no fusiones, no publiques versiones, no actualices la app instalada. Si algo es ambiguo, detente y pregunta.
```

### 7. Plan de pruebas

| Nivel | Qué | Dónde |
|---|---|---|
| Unitaria (rojo→verde) | Árbol a partir de niveles con saltos; elección de la sección actual (inicio, medio, final, títulos ocultos); emparejamiento por texto con títulos repetidos, Setext, front matter y bloques HTML | `tests/outline.test.ts` |
| E2E | Desplazar la vista previa y comprobar `aria-current`; contraer y expandir con Intro y Espacio; la rama contraída marcada como actual; modo Editar: clic lleva el cursor a la línea correcta y el texto no cambia | `tests/e2e/` |
| Pestañas | `tablist`, `tab` y `tabpanel` por rol; flechas, Inicio y Fin; botón «Índice» abre y alterna; `localStorage` con valor inválido o ausente; documento no Markdown; estado de cada pestaña conservado | `tests/e2e/` |
| Accesibilidad | `getByRole` por nombre de las flechas; `aria-expanded`; `aria-current`; nombre del panel; contraste del indicador en ambos temas | E2E |
| Rendimiento | 1.000 títulos: coste por evento y construcción del árbol frente a `main` | Informe de evidencia |
| Regresión | El clic sigue desplazando en Dividido y Vista previa; la barra conserva su ancho y su recuerdo; el índice sigue disponible a 850 px o menos; el explorador (búsqueda, árbol, etiquetas) funciona igual; FL-MD-002 intacta | E2E existentes |

### 8. Criterios de revisión (Claude)

- Cuatro commits (P, A, B, C), cada uno con rojo→verde; sin dependencias nuevas.
- No queda ningún resto del panel derecho (marcado, estilos, estado `outline`); las pestañas tienen roles y teclado correctos; la preferencia es robusta (valor inválido, sin almacenamiento); cambiar de pestaña no pierde el estado del explorador ni del índice; un chip de etiqueta (FL-MD-009) lleva a Archivos.
- El indicador de sección actual no depende solo del color y es coherente en claro y oscuro; `aria-current` y `aria-expanded` verificados por rol.
- La elección de la sección actual y el árbol son funciones puras probadas fuera de la interfaz; el evento de desplazamiento no recorre el DOM.
- **Ningún clic en modo Editar salta a una línea equivocada**; un título sin pareja avisa. Se prueba con títulos repetidos, Setext y un título dentro de un bloque HTML.
- El texto del documento y las exportaciones no cambian.
- El informe incluye el coste medido con 1.000 títulos y separa lo ejecutado de lo no verificado.
- `NEEDS TESTING` si falta alguna plataforma de CI o el modo Editar sin capturas; `BLOCKED` si se propone una dependencia.

## FL-MD-008 · Insertar fecha y hora

### 1. Historia de usuario

Como persona que lleva un diario, actas o un registro de cambios, quiero insertar la fecha o la hora actual donde está el cursor con un clic, para fechar mis notas sin teclearlas.

### 2. Problema y evidencia

En `origin/main` (`61d0e05`) no hay inserción de fecha ni de hora: ni `markdown-commands.ts` ni `MarkdownToolbar.svelte` contienen coincidencias de `fecha`, `datetime` ni `toLocaleDate`. El menú **Insertar** ofrece lista con viñetas, lista numerada, lista de tareas, cita, separador, enlace y bloque de código. Joplin ofrece un botón de calendario en su barra (captura del propietario).

### 3. Diseño UX/UI

Dos entradas nuevas al final de las acciones de **Insertar**, antes del selector de lenguaje:

- «Fecha de hoy» inserta `2026-10-27`.
- «Fecha y hora» inserta `2026-10-27 22:49`.

El formato es ISO 8601 con la hora local del equipo, 24 horas, sin segundos ni zona. Se eligió porque es inequívoco, se ordena alfabéticamente y no depende del idioma del sistema. Reemplaza la selección, como si se tecleara; se deshace con un solo paso; el cursor queda después del texto insertado. Deshabilitado en solo lectura, como el resto del menú. Sin atajo de teclado en la primera versión.

### 4. Criterios de aceptación

- F1. Sin selección, inserta exactamente `AAAA-MM-DD` o `AAAA-MM-DD HH:mm` en el cursor, con ceros a la izquierda y hora local de 24 horas (`09:05`).
- F2. Con selección, la reemplaza y el cursor queda tras el texto insertado.
- F3. Un paso de deshacer revierte la inserción completa; el estado «con cambios» se actualiza.
- F4. La función es pura y recibe la fecha como parámetro; las pruebas usan una fecha fija construida con componentes locales, sin depender del reloj ni de la zona del equipo.
- F5. No se inserta durante una composición con IME (misma guarda que `format()`).
- F6. Solo actúa en documentos Markdown; deshabilitada en solo lectura.
- F7. Etiquetas en español y accesibles por teclado; la entrada se anuncia como «Fecha de hoy» y «Fecha y hora».
- F8. El texto del resto del documento no cambia (CRLF y LF incluidos).

### 5. Casos límite

Medianoche (`00:00`) y `23:59`; cambio de año; 29 de febrero; día de cambio de horario (se usa la hora local tal como la entrega el sistema); selección multilínea (se reemplaza completa, como al teclear); cursor dentro de un bloque de código o del front matter (se inserta igual: es texto); documento con CRLF; dos inserciones seguidas (dos pasos de deshacer); reloj del sistema desajustado (se usa tal cual); solo lectura; composición con IME.

### 6. Prompt ejecutable para Codex

```text
Tarea: FL-MD-008 · Insertar fecha y hora.
Lee AGENTS.md, CONTRIBUTING.md y docs/stories/3-markdown-experiencia.md (FL-MD-008). Rama codex/md-008-fecha-hora desde main actualizado. Sin dependencias.
Archivos probables: src/renderer/lib/markdown-commands.ts (nuevas acciones; la fecha entra por parámetro para que la función siga siendo pura), src/renderer/components/MarkdownToolbar.svelte (dos entradas en el menú Insertar), src/renderer/components/Editor.svelte (pasar new Date() solo en el punto de llamada), tests/markdown-commands.test.ts, tests/e2e/markdown-toolbar.spec.ts.
1) Pruebas primero: unitarias con una fecha fija construida con new Date(año, mes, día, hora, minuto) (F1, F2, F8, medianoche, 29 de febrero, CRLF) y un E2E que inserta y deshace; deben fallar porque las acciones no existen. Guarda la salida roja.
2) Implementa lo mínimo siguiendo el patrón de las acciones existentes (MarkdownChange).
3) Verifica F1–F8; no añadas atajo ni configuración de formato.
Comprobaciones: npm run check, npm test, npm run test:e2e, npm run build. Evidencia: docs/evidence/md-008-<fecha>.md con capturas 1440×900 en claro y oscuro del menú Insertar y del resultado. PR en BORRADOR; no fusionar.
```

### 7. Plan de pruebas

Unitarias con fecha fija (formato, ceros, medianoche, bisiesto, selección, CRLF); E2E de inserción desde el menú, reemplazo de selección y un solo paso de deshacer; solo lectura deshabilitado; regresión de las acciones existentes de la barra.

### 8. Criterios de revisión (Claude)

La función es pura y probada con fecha fija en cualquier zona; el formato coincide con el diseño; un paso de deshacer; no hay atajo ni opciones de formato añadidas; no cambia el comportamiento de las demás acciones de la barra.

## FL-MD-009 · Etiquetas en el front matter y filtro en el explorador

### 1. Historia de usuario

Como persona con muchos documentos Markdown en una carpeta, quiero escribir etiquetas en las propiedades del documento, verlas como chips al leerlo, ver en el explorador todas las etiquetas de la carpeta con cuántos documentos tiene cada una y filtrar por etiqueta, para encontrar «todo lo del proyecto X» sin recordar los nombres de los archivos.

### 2. Problema y evidencia

Joplin guarda las etiquetas en su base de datos y las muestra bajo el título («Haga clic aquí para agregar etiquetas…», captura del propietario). FreyaLab trabaja sobre archivos, así que no hay base de datos que reutilizar. Sobre `origin/main` (`61d0e05`):

- **El explorador solo busca por nombre.** `findFiles` (`src/main/documents.ts`) recorre la carpeta en anchura, visita como máximo 1.000 directorios, devuelve como máximo 200 resultados y compara únicamente `entry.name` con la consulta; nunca abre un archivo. `App.svelte` lo llama con la cadena escrita en «Buscar archivo…» tras una espera corta.
- **No hay noción de etiqueta.** Un `tags: [a, b]` en el encabezado de un documento hoy se renderiza como un título (el defecto de FL-MD-002 bloque A). Con FL-MD-002 fusionada ese encabezado se aparta en `frontMatterOf` y se muestra en «Propiedades del documento», pero nada lo interpreta.
- **Coste de leer los encabezados de una carpeta, medido** (Apple M2, APFS, caché de disco caliente, Node 26, archivos de unos 5 KiB con el encabezado al inicio; solo los primeros 16 KiB de cada uno; 8 lecturas a la vez):

| Archivos `.md` | Tiempo |
|---:|---:|
| 500 | 11 ms |
| 2.000 | 40 ms |
| 5.000 | 92 ms |

Con la caché fría, en Windows o en una unidad de red el coste será mayor; por eso la historia pide un tope de archivos leídos y que Codex mida y publique sus propios números.

**Referencia de Joplin (tres capturas del propietario).** Las etiquetas tienen tres piezas: una sección «ETIQUETAS» en la barra lateral con cada etiqueta y su recuento de notas («Inicio 1», «welcome 1»); chips bajo el editor con el aviso «Haga clic aquí para agregar etiquetas…»; y un diálogo «Agregar o eliminar etiquetas:» con un campo combinado (autocompletado), «OK» y «Cancelar». En las tres capturas se ve que al quitar una etiqueta de la única nota que la tenía, desaparece de la lista lateral. Esta historia cubre la parte de lectura (chips, lista con recuentos y filtro); el diálogo para agregar o eliminar etiquetas es la segunda versión, abajo.

**Decisiones del propietario (2026-10-27):** T1 las etiquetas viven en el front matter del documento; T2 primera versión de solo lectura (chips en la vista previa y filtro en el explorador); T3 solo documentos Markdown; **T4 la lista «Etiquetas» con recuentos entra en esta historia como cuarto bloque (D)** (mi recomendación era aplazarla; el propietario decidió incluirla). Editar etiquetas desde chips queda fuera de esta historia.

**Regla ajustada por T4:** la coincidencia de una etiqueta es **exacta** (sin distinguir mayúsculas ni acentos), no por comienzo, para que el número de la lista coincida con los resultados del filtro. Las etiquetas jerárquicas (`proyecto/2026`) se tratan como texto completo.

### 3. Diseño UX/UI

**Dónde se escriben.** En el encabezado del documento, con las convenciones que ya entienden Obsidian, Hugo y Jekyll. Se reconoce la clave `tags` en el primer nivel:

```yaml
---
title: Informe trimestral
tags: [proyecto, informe, 2026]        # lista en línea
---
```

```yaml
---
tags:                                  # lista en bloque
  - proyecto
  - "informe final"
---
```

También `tags: proyecto, informe` (valor suelto separado por comas). Una etiqueta puede llevar `#` delante (`#proyecto`); se ignora. No se interpreta nada más de YAML.

**Dónde se ven.** En la vista previa, en la fila de «Propiedades del documento» (la de FL-MD-002), a su derecha y visibles aunque la fila esté cerrada: chips discretos `proyecto` `informe` `2026`. Fuera del artículo, así que no entran en el HTML ni en el PDF exportados. En modo Editar no se muestran (la vista previa está oculta).

```text
▸ Propiedades del documento   [proyecto] [informe] [2026]
```

**Qué hace un chip.** Es un botón. Al pulsarlo abre el explorador si estaba oculto, escribe `#proyecto` en «Buscar archivo…» (sin repetirlo si ya está) y le da el foco. Sin carpeta abierta avisa: «Abre una carpeta para filtrar por etiqueta».

**Cómo se filtra.** En «Buscar archivo…» una palabra que empieza por `#` es una etiqueta; el resto es texto del nombre, como hoy:

| Se escribe | Encuentra |
|---|---|
| `#proyecto` | Documentos Markdown con la etiqueta «proyecto» |
| `#proyecto #2026` | Documentos con ambas etiquetas |
| `informe #proyecto` | Documentos cuyo nombre contiene «informe» y que tienen la etiqueta |

La comparación ignora mayúsculas y acentos y la etiqueta debe coincidir completa. Solo los archivos Markdown pueden coincidir con una etiqueta. Los resultados se muestran como hoy: nombre y ruta.

**La lista «Etiquetas» (bloque D).** Debajo del árbol de archivos del explorador, cuando hay una carpeta abierta y al menos una etiqueta en ella: una sección «ETIQUETAS» con un botón por etiqueta y, a la derecha, el número de documentos que la tienen (`proyecto 12`). Orden alfabético sin distinguir acentos. Pulsar una etiqueta la añade a «Buscar archivo…» como `#proyecto` (y la quita si ya estaba, de modo que varias se combinan con Y); las etiquetas activas se ven pulsadas. Las etiquetas sin documentos no aparecen. Un botón «Actualizar» vuelve a leer la carpeta.

```text
EXPLORADOR
▾ informes
   acta-2026.md
ETIQUETAS                      ⟳
  informe           7
 [proyecto          12]   ← activa (filtro #proyecto)
  2026              5
```

### 4. Criterios de aceptación

Cuatro bloques (A a D), un commit por bloque, en este orden.

**A · Leer etiquetas (módulo compartido)**
- E1. `parseTags(frontMatter)` devuelve las etiquetas de `tags` en el primer nivel: lista en línea de una sola línea, lista en bloque y valor suelto separado por comas. Quita comillas simples o dobles que rodean cada valor, ignora el `#` inicial, quita espacios y comentarios finales (` # nota`) y descarta vacíos.
- E2. Se eliminan duplicados sin distinguir mayúsculas ni acentos (se conserva la primera grafía). Máximo 50 etiquetas por documento y 64 caracteres por etiqueta; las más largas se descartan.
- E3. Una entrada que no se entiende (lista en línea de varias líneas, `tags` anidada dentro de otra clave, valor que no es texto) devuelve `[]` sin lanzar excepción. Si `tags` aparece dos veces, vale la primera. Solo se reconoce la clave en minúsculas.
- E4. `frontMatterOf` (hoy en `render.ts`) se mueve sin cambios de comportamiento a `src/shared/front-matter.ts`, junto con `parseTags`, para que el renderizador y el proceso principal usen **una sola implementación**. Las pruebas A1–A4 de FL-MD-002 pasan sin editarse.
- E5. Sin dependencias nuevas y sin analizador de YAML.

**B · Chips en la vista previa**
- E6. La fila de propiedades muestra un chip por etiqueta cuando hay etiquetas y no muestra nada extra cuando no las hay. Las etiquetas se actualizan al editar el encabezado y desaparecen al borrarlas.
- E7. Los chips quedan fuera de `article`: el HTML y el PDF exportados no los contienen.
- E8. El texto de cada etiqueta se escapa (se renderiza como texto, nunca como HTML). Cada chip es un `<button>` con nombre accesible «Filtrar archivos por la etiqueta <x>», operable con Intro y Espacio; las etiquetas largas se cortan con puntos suspensivos y llevan el texto completo en el tooltip.
- E9. Pulsar un chip abre el explorador si estaba oculto (y selecciona la pestaña «Archivos» si FL-MD-007 ya está fusionada), escribe `#<etiqueta>` en «Buscar archivo…» sin duplicarlo, le da el foco y el filtro se aplica. Sin carpeta abierta aparece el aviso del diseño y no cambia nada.
- E10. El texto del documento, su estado «con cambios» y lo que se guarda no cambian (la lectura de etiquetas no modifica nada).

**C · Filtro en el explorador**
- E11. En `findFiles`, una palabra que empieza por `#` seguida de al menos un carácter es una etiqueta; las demás palabras filtran por nombre como hoy y todas se combinan con Y. Sin palabras con `#` el comportamiento es idéntico al actual (la prueba existente `findFiles(root,'objetivo')` pasa sin editarse y la firma no cambia).
- E12. La coincidencia de etiquetas ignora mayúsculas y acentos y exige la etiqueta completa (`#proy` no encuentra `proyecto`); varias etiquetas se combinan con Y.
- E13. Solo se leen archivos Markdown y solo los primeros 16 KiB de cada uno; si el encabezado no se cierra dentro de ese tramo, el archivo no tiene etiquetas. Se respetan las reglas de `tree()` (sin archivos ocultos, `node_modules` ni enlaces simbólicos) y la autorización de la carpeta (`allowed`).
- E14. Se mantienen los límites actuales (1.000 directorios, 200 resultados) y se añaden: como máximo 8 lecturas simultáneas y como máximo 5.000 archivos leídos por búsqueda. Al alcanzar un tope el resultado marca `limited` y la interfaz muestra el aviso existente («Resultados limitados; acota la búsqueda.»).
- E15. Una búsqueda nueva cancela la anterior con el mecanismo de cancelación actual; un archivo que desaparece, no se puede leer o no es UTF-8 válido se omite sin interrumpir la búsqueda.
- E16. El texto de una etiqueta nunca se usa como ruta ni como expresión regular.

**D · Lista «Etiquetas» con recuentos**
- E17. Un nuevo canal `listTags(root)` (proceso principal, `preload` y tipos compartidos) devuelve `{tags:[{tag,count}],limited}`. Usa las mismas reglas de lectura que el filtro (E13 y E14: 16 KiB por archivo, 8 lecturas simultáneas, 5.000 archivos, reglas de `tree()`, `allowed`) y el `parseTags` compartido. `count` es el número de **documentos** que tienen la etiqueta; dentro de un documento una etiqueta cuenta una vez.
- E18. Las etiquetas que solo difieren en mayúsculas o acentos (`Proyecto` y `proyecto`) forman una entrada; se muestra la grafía más frecuente y, en empate, la primera encontrada. Máximo 500 etiquetas distintas; si hay más, `limited` y el aviso de E20.
- E19. La sección «ETIQUETAS» aparece bajo el árbol solo con una carpeta abierta y al menos una etiqueta. Orden alfabético sin distinguir acentos; recuento a la derecha; las etiquetas largas se cortan con puntos suspensivos y llevan el texto completo en el tooltip; la lista tiene su propio desplazamiento y no empuja el pie del explorador.
- E20. Pulsar una etiqueta la añade a «Buscar archivo…» como `#etiqueta` o la quita si ya estaba (`aria-pressed` refleja el estado). Con una sola etiqueta activa el número de resultados es el recuento de la lista. Si la lectura quedó incompleta, la sección muestra «Lista parcial: la carpeta tiene demasiados archivos».
- E21. Se lee cuando el explorador está visible y hay carpeta: al abrir la carpeta, tras guardar un documento Markdown de esa carpeta (con una espera corta) y al pulsar «Actualizar». No hay vigilancia del sistema de archivos. Una lectura nueva cancela la anterior; mientras dura se muestra «Leyendo etiquetas…» sin bloquear el árbol ni la escritura.
- E22. Un archivo borrado, ilegible o que no es UTF-8 válido se omite sin error visible; una etiqueta que ya no tiene documentos desaparece en la lectura siguiente.
- E23. Accesibilidad: la sección es un grupo con nombre «Etiquetas»; cada botón se llama «<etiqueta>, <n> documentos» y se opera con Intro y Espacio; la sección funciona en tema claro y oscuro.
- E24. Sin carpeta abierta la sección no existe y no se lee nada; nunca se lee fuera de la carpeta autorizada.
- E25. La lista no modifica ningún documento ni la configuración guardada.

**Transversales:** sin dependencias nuevas; `npm run check`, `npm test`, `npm run test:e2e` y `npm run build` en verde; las pruebas de FL-MD-002 y la búsqueda por nombre actual no se editan; el contenido de los documentos nunca se modifica.

### 5. Casos límite

Encabezado con BOM o CRLF; `tags:` vacío o `null`; `tags: [a,,b]`; `tags: "a, b"` (un valor entre comillas es **una** etiqueta); lista en bloque con sangrías distintas y con comentarios; `tags` dentro de otra clave (`meta:` y debajo `  tags: [a]`, que se ignora); `tags` repetida; etiqueta con acento, emoji o `/` (`proyecto/2026`, se trata como texto); etiqueta numérica sin comillas (`2026`); etiqueta con `<script>`; 50 y 51 etiquetas; etiqueta de 64 y 65 caracteres; encabezado de más de 16 KiB; archivo con cierre `...`; carpeta con 10.000 archivos Markdown; archivo borrado o sin permiso durante la búsqueda; consulta con solo `#`; consulta `#a #b informe`; archivo cuyo nombre empieza por `#` (no se puede buscar con ese prefijo: queda como límite documentado); documento con una etiqueta añadida y sin guardar (el explorador lee el disco y la vista previa lee el texto abierto, así que solo coinciden tras guardar; límite documentado); cambio de carpeta mientras se busca; documento solo de lectura (≥ 10 MiB). Para la lista: más de 500 etiquetas distintas; `Proyecto` y `proyecto` en documentos distintos; la misma etiqueta dos veces en un documento (cuenta una); la misma etiqueta en subcarpetas distintas; carpeta solo con archivos que no son Markdown (la sección no aparece); guardar un documento que añade o quita una etiqueta (el recuento cambia tras la lectura siguiente); cambiar de carpeta o pulsar «Actualizar» durante una lectura; explorador oculto (no se lee); carpeta de red lenta (la interfaz no se bloquea y la lista puede quedar parcial); el filtro `#proy` sin coincidencias (se muestra «0 archivos encontrados»).

### 6. Prompt ejecutable para Codex

```text
Tarea: FL-MD-009 · Etiquetas en el front matter (solo lectura): chips, filtro y lista con recuentos en el explorador. REQUISITO: FL-MD-002 (PR #67) fusionada, porque se apoya en frontMatterOf y en la fila «Propiedades del documento» de Preview.svelte.
Lee AGENTS.md, CONTRIBUTING.md y docs/stories/3-markdown-experiencia.md (FL-MD-009: criterios E1–E25, casos límite y la medición de la sección 2). Rama codex/md-009-etiquetas desde main actualizado. Sin dependencias; no toques package.json ni el lockfile; sin analizador de YAML.
Archivos probables: src/shared/front-matter.ts (nuevo: frontMatterOf movido desde render.ts sin cambiar su comportamiento, y parseTags), src/renderer/lib/render.ts (importar desde shared), src/renderer/components/Preview.svelte (chips en la fila de propiedades), src/renderer/App.svelte (clic en un chip → buscar archivo), src/main/documents.ts (findFiles y listTags), src/main/index.ts, src/preload/index.ts y src/shared/types.ts (canal listTags), src/renderer/style.css, tests/front-matter.test.ts (nuevo), tests de findFiles con una carpeta temporal, tests/e2e/ (nuevo).
Método, por bloque y en este orden (A, B, C, D), UN commit por bloque:
1. Escribe primero las pruebas del bloque y comprueba que FALLAN por la razón descrita (guarda la salida roja). A: tabla de casos de parseTags con la sección 5; las pruebas A1–A4 de FL-MD-002 deben seguir pasando tras mover frontMatterOf. B: E2E de chips, escape, exportación sin chips y clic. C: findFiles con carpeta temporal (etiquetas, combinación con texto, topes, cancelación, archivo ilegible). D: listTags con carpeta temporal (recuentos por documento, grafías, tope de 500, parcial) y E2E de la lista, el clic y la actualización tras guardar.
2. Implementa lo mínimo. parseTags y frontMatterOf son funciones puras compartidas entre renderizador y proceso principal. En findFiles y listTags lee con el manejador de archivo solo los primeros 16 KiB, con 8 lecturas a la vez y un tope de 5.000 archivos por búsqueda; comparte el recorrido entre ambos en vez de duplicarlo.
3. Vuelve a ejecutar: las pruebas del bloque pasan y las anteriores siguen pasando.
Medición obligatoria: tiempo de una búsqueda por etiqueta y de listTags en una carpeta sintética de 2.000 y 5.000 archivos Markdown (indica sistema, caché y comandos; mi referencia con caché caliente en un M2 fue 40 ms y 92 ms para la lectura sola) y comparación con la búsqueda por nombre en main 61d0e05. Sin umbrales de reloj en las pruebas.
Al terminar: npm run check && npm test && npm run test:e2e && npm run build. Evidencia: docs/evidence/md-009-<fecha>.md con la tabla rojo→verde por bloque, capturas 1440×900 en claro y oscuro (chips con la fila cerrada y abierta; explorador filtrado; lista de etiquetas con una activa), los números reales y lo que NO se verificó. PR en BORRADOR; no fusiones, no publiques versiones, no actualices la app instalada. Si algo es ambiguo, detente y pregunta; no lo interpretes en silencio.
```

### 7. Plan de pruebas

| Nivel | Qué | Dónde |
|---|---|---|
| Unitaria (rojo→verde) | Tabla de casos de `parseTags` (listas en línea y en bloque, valor suelto, comillas, `#`, comentarios, duplicados, límites 50/64, entradas no entendidas); `frontMatterOf` sin cambios de comportamiento | `tests/front-matter.test.ts` y pruebas A de FL-MD-002 |
| Seguridad | Una etiqueta con HTML se muestra como texto; una etiqueta con `..` o `/` nunca se usa como ruta ni como expresión regular | Unitarias y E2E |
| Proceso principal | `findFiles` con carpeta temporal: etiqueta, varias etiquetas, texto + etiqueta, solo Markdown, encabezado cortado a 16 KiB, topes (directorios, resultados, archivos), cancelación, archivo ilegible; compatibilidad con la consulta sin `#`; `listTags`: recuentos por documento, grafías, tope de 500, lectura parcial, cancelación | Pruebas de `Documents` |
| E2E | Chips visibles con la fila cerrada; fuera del HTML y del PDF exportados; clic abre el explorador y filtra; sin carpeta avisa; la lista de etiquetas muestra los recuentos, pulsar una etiqueta filtra con tantos resultados como el recuento, y guardar un documento con otra etiqueta actualiza la lista | `tests/e2e/` |
| Rendimiento | 2.000 y 5.000 archivos: búsqueda por etiqueta y `listTags` frente a la búsqueda por nombre de `main` | Informe de evidencia |
| Regresión | Búsqueda por nombre actual, FL-MD-002 completa, anchos y modos de la vista previa | Suites existentes y CI en las cuatro plataformas |

### 8. Criterios de revisión (Claude)

- Cuatro commits (A, B, C, D), cada uno con rojo→verde; sin dependencias nuevas ni analizador de YAML; `package.json` y el lockfile sin cambios.
- `frontMatterOf` se movió, no se copió: una sola implementación usada por renderizador y proceso principal, y las pruebas A de FL-MD-002 pasan sin editarse.
- **El texto del usuario nunca se modifica**; las etiquetas solo se leen.
- Lo que se lee del disco está acotado (16 KiB por archivo, 8 simultáneas, 5.000 por búsqueda), respeta la autorización de la carpeta y se cancela; se comprueba con carpetas sintéticas.
- Ninguna etiqueta se interpreta como HTML, ruta o expresión regular; los chips quedan fuera de las exportaciones.
- La búsqueda por nombre sin `#` se comporta exactamente como antes (la prueba actual no se editó).
- El recorrido de la carpeta se comparte entre `findFiles` y `listTags` (no hay dos implementaciones); el recuento de la lista coincide con los resultados del filtro de esa etiqueta; la lista no bloquea la interfaz y se cancela al pedir otra lectura.
- La evidencia trae los tiempos reales con 2.000 y 5.000 archivos y separa lo ejecutado de lo no verificado; documenta los límites (documento con cambios sin guardar, nombres de archivo que empiezan por `#`, listas en línea de varias líneas).
- `NEEDS TESTING` si falta alguna plataforma de CI o la medición de carpetas grandes; `BLOCKED` si se propone una dependencia o un analizador de YAML.

### Segunda versión (FL-MD-010, esbozada, no incluida)

Depende de FL-MD-009 (la lista «Etiquetas» con recuentos ya está en el bloque D por decisión T4). Lo que falta de lo que muestran las capturas de Joplin es **agregar o eliminar etiquetas desde la vista previa**: un botón «Agregar etiquetas…» junto a los chips abre un diálogo con campo combinado (autocompletado con las etiquetas de la carpeta, que ya entrega `listTags`), «Aceptar» y «Cancelar». Al aceptar se escribe el front matter con el **cambio mínimo**: se conserva el resto del YAML, los comentarios, el orden y CRLF; se crea el encabezado solo si no existe; un solo paso de deshacer; nunca se pierde texto (si el encabezado no se entiende, el diálogo avisa y no escribe).

Riesgo principal: escribir YAML sin un analizador. Por eso la edición se limita a los formatos que `parseTags` entiende (lista en línea y en bloque) y rechaza el resto con un aviso.

## Aplazadas (con condición para retomarlas)

- **Pegar HTML como Markdown.** Requiere convertir HTML no confiable: se parsearía de forma inerte, se saneará con `sanitize-html` (ya instalado) y se convertiría con `turndown` (MIT, dependencia nueva). Retomar tras aprobar la dependencia y cuando FL-MD-005 esté fusionada para compartir el controlador de pegado.
- **Inserción visual de imágenes.** Depende de la política de activos relativos y «Guardar como» (F05): FL-DRW-001. Sin esa política, una imagen insertada puede dejar de resolverse al guardar con otro nombre.
- **Menú `/`.** Duplica **Insertar**; solo se retoma si el uso real muestra que la gente no encuentra los bloques o si se añaden plantillas (galería Mermaid) que justifiquen un acceso por teclado.
- **Etiquetas (tags).** Decididas el 2026-10-27 (T1 front matter, T2 primera versión de solo lectura con filtro en el explorador, T3 solo Markdown, T4 lista con recuentos incluida): ver FL-MD-009. El diálogo para agregar o eliminar etiquetas (referencia: Joplin) queda esbozado como FL-MD-010 dentro de FL-MD-009. Descartadas: una base de datos de etiquetas dentro de la aplicación (no es portable y se desincroniza al mover o renombrar archivos) y `#etiqueta` dentro del texto (ambiguo con títulos, enlaces y números de incidencia).
- **Atrás/adelante entre documentos y «abrir en editor externo» (Joplin).** Valor bajo hoy: FreyaLab ya tiene pestañas, deshacer y rehacer. Se retoma si el uso real muestra que se echa en falta el historial de navegación.
