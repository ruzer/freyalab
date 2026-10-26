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

## Aplazadas (con condición para retomarlas)

- **Pegar HTML como Markdown.** Requiere convertir HTML no confiable: se parsearía de forma inerte, se saneará con `sanitize-html` (ya instalado) y se convertiría con `turndown` (MIT, dependencia nueva). Retomar tras aprobar la dependencia y cuando FL-MD-005 esté fusionada para compartir el controlador de pegado.
- **Inserción visual de imágenes.** Depende de la política de activos relativos y «Guardar como» (F05): FL-DRW-001. Sin esa política, una imagen insertada puede dejar de resolverse al guardar con otro nombre.
- **Menú `/`.** Duplica **Insertar**; solo se retoma si el uso real muestra que la gente no encuentra los bloques o si se añaden plantillas (galería Mermaid) que justifiquen un acceso por teclado.
