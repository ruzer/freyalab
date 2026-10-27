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
| 9 | Índice con sección actual, ramas que se contraen y disponible al editar | Existe como lista plana, sin sección actual, solo en Dividido y Vista previa | Alto | M | Bajo–medio (desplazamiento y correspondencia con las líneas del editor) | **FL-MD-007** (tras FL-MD-002) |
| 10 | Insertar fecha y hora | No existe (sin coincidencias en `markdown-commands.ts` ni en `MarkdownToolbar.svelte`) | Medio | S | Bajo | **FL-MD-008** |
| 11 | Etiquetas (tags) | No existe | Alto | M a L | Medio (dónde se guardan) | Pendiente de decisión del propietario; ver «Aplazadas» |
| 12 | Atrás/adelante entre documentos y «abrir en editor externo» | No existe (solo deshacer y rehacer) | Bajo | S a M | Bajo | No hacer ahora; ver «Aplazadas» |
| 13 | Dibujo libre (el lápiz de Joplin) | Planeado | Alto | L | Alto | Iteración 4 (`4-dibujos-editables.md`), a la espera de las decisiones D1–D6 |

Sin diferencia con Joplin, y por eso sin historia: negrita, cursiva, código, tachado, títulos, listas con viñetas, numeradas y de tareas, separador, tabla y enlace (FL-MD-001).

Orden: FL-MD-008 puede ir en paralelo con cualquiera (toca `markdown-commands.ts` y `MarkdownToolbar.svelte`). FL-MD-007 espera a FL-MD-002 porque ambas tocan `Preview.svelte`.

## FL-MD-007 · Un índice que dice dónde estás

### 1. Historia de usuario

Como persona que lee o edita un documento largo con muchas secciones, quiero que el índice me muestre en qué sección estoy, me deje contraer lo que no uso y siga disponible mientras escribo, para orientarme y saltar sin perder el hilo.

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

La referencia del propietario (MDViewer) muestra un árbol con flechas para contraer ramas, la sección actual resaltada y los títulos largos cortados con puntos suspensivos. `App.svelte` enlaza además el `onscroll` del editor con la vista previa (línea 87); Codex debe comprobar el sentido de esa sincronización antes de mover el cursor del editor desde el índice.

### 3. Diseño UX/UI

El panel «En este documento» pasa a ser un árbol:

```text
EN ESTE DOCUMENTO
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
- **Modo Editar:** el panel se muestra también (mismo ancho y mismos puntos de corte). Un clic lleva el cursor al inicio de la línea del título, lo deja arriba del editor y enfoca el editor; la sección actual sigue la primera línea visible. En Dividido y Vista previa el clic sigue desplazando la vista previa, como hoy.

### 4. Criterios de aceptación

Tres bloques, un commit por bloque, en este orden.

**A · Sección actual (Dividido y Vista previa)**
- A1. Antes del primer título no hay sección actual. En cualquier otra posición la actual es el último título cuyo borde superior queda por encima del 30 % superior del panel de vista previa.
- A2. Al desplazar la vista previa (rueda, teclado, clic en el índice o en un enlace interno), la entrada actual cambia sin más de 100 ms de retraso tras detenerse el desplazamiento. Se marca con `aria-current="location"` y con un indicador que no depende solo del color.
- A3. La entrada actual queda visible dentro del panel; este se desplaza lo mínimo y sin animación.
- A4. Si el último título no llega nunca al umbral, se marca como actual cuando el desplazamiento llega al final del documento.
- A5. No se recorre el DOM en cada evento: los desplazamientos de los títulos se calculan tras cada render y al cambiar el tamaño, y el evento solo hace una búsqueda binaria. La evidencia da el coste medido por evento con 1.000 títulos.
- A6. Los títulos ocultos (por ejemplo dentro de un `<details>` cerrado) no cuentan para la sección actual.
- A7. El `<aside>` recibe `aria-label="Índice del documento"`.

**B · Ramas que se contraen**
- B1. El árbol se deriva de los niveles: un título es hijo del anterior de nivel menor. Un salto (nivel 1 a nivel 3) no crea nodos vacíos.
- B2. Cada título con hijos tiene una flecha con `aria-expanded` y nombre «Contraer sección <título>» o «Expandir sección <título>». Funciona con Intro y Espacio; Tab recorre la flecha y el título.
- B3. Contraer oculta los descendientes también para las tecnologías de apoyo (`hidden`), no solo a la vista.
- B4. La rama contraída que contiene la sección actual se marca como actual (A1) sin expandirse.
- B5. El estado se conserva entre renders y al cambiar de pestaña, identificado por la ruta de títulos (no solo por el `id`, que cambia al editar el título). Si el título desaparece, su estado se descarta.
- B6. Los títulos largos se limitan a dos líneas con puntos suspensivos, con tooltip y nombre accesible completos.

**C · Modo Editar**
- C1. El panel se muestra también en modo Editar y el botón «Índice» de la barra lo alterna.
- C2. En modo Editar, un clic en una entrada mueve el cursor al inicio de la línea de ese título, lo deja en la parte superior del editor y enfoca el editor. El texto no cambia.
- C3. En modo Editar, la sección actual sigue la primera línea visible del editor.
- C4. La correspondencia entre las entradas del índice y las líneas del editor se hace en orden y por texto contra los títulos del árbol sintáctico del editor (ATX y Setext). Una entrada sin pareja (por ejemplo, un título dentro de un bloque HTML) no mueve el cursor y avisa «Ese título no se puede localizar en el editor». **Nunca se salta a una línea equivocada.**
- C5. En Dividido y Vista previa el clic desplaza la vista previa como hoy, y el índice no cambia el contenido de ninguna exportación.

**Transversales:** sin dependencias nuevas; el texto del documento y el HTML exportado no cambian; `npm run check`, `npm test`, `npm run test:e2e` y `npm run build` en verde; los puntos de corte de ancho (1100 y 850 px) se conservan.

### 5. Casos límite

Documento sin títulos; solo títulos de nivel 2; saltos de nivel (1, 3, 2); títulos repetidos («Uno» dos veces); título solo con emoji o signos; título editado mientras su rama está contraída; documento con 1.000 títulos; títulos dentro de un `<details>` cerrado (tras FL-MD-002 un clic los abre); título dentro de una lista o una cita; título Setext (`Texto` y `===`); documento con front matter (el emparejamiento por texto no depende de los desplazamientos de línea); render progresivo mientras se desplaza; cambio de tema; ventana de 850 px o menos (el panel sigue oculto); edición con IME (el clic en el índice no interrumpe la composición); modo Vista previa sin editor montado (C no aplica).

### 6. Prompt ejecutable para Codex

```text
Tarea: FL-MD-007 · Índice con sección actual, ramas contraíbles y modo Editar. REQUISITO: FL-MD-002 (PR #67) fusionada, porque ambas tocan Preview.svelte y render.ts.
Lee AGENTS.md, CONTRIBUTING.md y docs/stories/3-markdown-experiencia.md (FL-MD-007: criterios A1–C5, casos límite y la medición de la sección 2). Rama codex/md-007-indice desde main actualizado. Sin dependencias; no toques package.json ni el lockfile.
Archivos probables: src/renderer/App.svelte (retirar el bloque del índice), src/renderer/components/Outline.svelte (nuevo), src/renderer/lib/outline.ts (funciones puras nuevas), src/renderer/components/Preview.svelte (exponer los desplazamientos de los títulos), src/renderer/components/Editor.svelte (ir a una línea; primera línea visible), src/renderer/style.css, tests/outline.test.ts (nuevo), tests/e2e/ (nuevo).
Método, por bloque y en este orden (A, B, C), UN commit por bloque:
1. Escribe primero las pruebas y comprueba que FALLAN por la razón descrita. Funciones puras: construir el árbol a partir de los títulos (B1), elegir la sección actual dada una lista de desplazamientos y un scrollTop (A1, A4, A6), emparejar títulos del índice con títulos del árbol sintáctico del editor (C4). E2E: desplazar y comprobar aria-current, contraer y expandir con teclado, clic en modo Editar.
2. Implementa lo mínimo. Reutiliza el tipo Heading de render.ts y el árbol sintáctico de CodeMirror que el editor ya importa (syntaxTree). Antes de mover el cursor desde el índice, comprueba el sentido de la sincronización onscroll del editor con la vista previa (App.svelte); si el clic en modo Editar provoca un desplazamiento extra de la vista previa, repórtalo.
3. Vuelve a ejecutar: las pruebas del bloque pasan y las anteriores siguen pasando.
Medición obligatoria con un documento sintético de 1.000 títulos: coste por evento de desplazamiento y tiempo de construir el árbol; comparar con main 61d0e05. Sin umbrales de reloj en las pruebas: demuestra con conteo de operaciones que el evento no recorre el DOM.
Al terminar: npm run check && npm test && npm run test:e2e && npm run build. Evidencia: docs/evidence/md-007-<fecha>.md con la tabla rojo→verde por bloque, capturas 1440×900 en claro y oscuro de cada bloque (panel con la sección actual marcada, una rama contraída, modo Editar), los números reales y lo que NO se verificó. PR en BORRADOR; no fusiones, no publiques versiones, no actualices la app instalada. Si algo es ambiguo, detente y pregunta.
```

### 7. Plan de pruebas

| Nivel | Qué | Dónde |
|---|---|---|
| Unitaria (rojo→verde) | Árbol a partir de niveles con saltos; elección de la sección actual (inicio, medio, final, títulos ocultos); emparejamiento por texto con títulos repetidos, Setext, front matter y bloques HTML | `tests/outline.test.ts` |
| E2E | Desplazar la vista previa y comprobar `aria-current`; contraer y expandir con Intro y Espacio; la rama contraída marcada como actual; modo Editar: clic lleva el cursor a la línea correcta y el texto no cambia | `tests/e2e/` |
| Accesibilidad | `getByRole` por nombre de las flechas; `aria-expanded`; `aria-current`; nombre del panel; contraste del indicador en ambos temas | E2E |
| Rendimiento | 1.000 títulos: coste por evento y construcción del árbol frente a `main` | Informe de evidencia |
| Regresión | El clic sigue desplazando en Dividido y Vista previa; anchos de 185 y 155 px; panel oculto a 850 px o menos; FL-MD-002 intacta | E2E existentes |

### 8. Criterios de revisión (Claude)

- Tres commits (A, B, C), cada uno con rojo→verde; sin dependencias nuevas.
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

## Aplazadas (con condición para retomarlas)

- **Pegar HTML como Markdown.** Requiere convertir HTML no confiable: se parsearía de forma inerte, se saneará con `sanitize-html` (ya instalado) y se convertiría con `turndown` (MIT, dependencia nueva). Retomar tras aprobar la dependencia y cuando FL-MD-005 esté fusionada para compartir el controlador de pegado.
- **Inserción visual de imágenes.** Depende de la política de activos relativos y «Guardar como» (F05): FL-DRW-001. Sin esa política, una imagen insertada puede dejar de resolverse al guardar con otro nombre.
- **Menú `/`.** Duplica **Insertar**; solo se retoma si el uso real muestra que la gente no encuentra los bloques o si se añaden plantillas (galería Mermaid) que justifiquen un acceso por teclado.
- **Etiquetas (tags). Pendiente de decisión del propietario (2026-10-27).** Joplin las guarda en su base de datos y las muestra bajo el título («Haga clic aquí para agregar etiquetas…»). FreyaLab trabaja sobre archivos, así que la decisión es dónde viven:
  - **Recomendada: el front matter del propio documento** (`tags: [a, b]` o lista en bloque). Es texto del archivo, portable (Obsidian, Hugo y Jekyll lo entienden) y encaja con «Propiedades del documento» de FL-MD-002. Depende de FL-MD-002 fusionada, que es donde se aparta el front matter.
  - Primera versión de solo lectura: etiquetas como chips bajo el título en la vista previa, y filtro por etiqueta en el explorador (hoy «Buscar archivo» muestra nombre y ruta y no conoce las etiquetas; habría que leer solo el encabezado de cada archivo de la carpeta).
  - Segunda versión con edición: añadir y quitar etiquetas con chips que escriben el front matter con el cambio mínimo (conserva comentarios, orden, CRLF y el resto del YAML), un paso de deshacer.
  - Descartadas: una base de datos de etiquetas dentro de la aplicación (no es portable y se desincroniza al mover o renombrar archivos) y `#etiqueta` dentro del texto (ambiguo con títulos, enlaces y números de incidencia).
  - Decisiones que pide: T1 ¿las etiquetas viven en el front matter? T2 ¿primera versión de solo lectura con filtro en el explorador? T3 ¿solo documentos Markdown?
- **Atrás/adelante entre documentos y «abrir en editor externo» (Joplin).** Valor bajo hoy: FreyaLab ya tiene pestañas, deshacer y rehacer. Se retoma si el uso real muestra que se echa en falta el historial de navegación.
