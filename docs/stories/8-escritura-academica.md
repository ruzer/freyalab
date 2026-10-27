# Iteración 8 · Escritura académica y profesional

**Objetivo final (decisión del propietario, 2026-10-27):** que el editor Markdown de FreyaLab produzca libros, tesis, artículos científicos, reportes profesionales y trabajos escolares, con edición avanzada tipo Sublime Text y gestión del conocimiento. **Se avanza por etapas, sin abandonar esa visión.** Regla de esta iteración: terminar funcionalidades útiles de extremo a extremo antes de ampliar alcance, y no abrir desarrollos que toquen los mismos archivos que el lote actual de Codex (`render.ts`, `Preview.svelte`, `Editor.svelte`, `App.svelte`) hasta que ese lote se fusione.

Este archivo contiene: el roadmap completo (nada se descarta), la **evaluación de Pandoc** hecha con la copia real instalada, las historias de la primera etapa (un reporte con portada, índices, figuras y tablas numeradas, citas, gráficos y exportación DOCX y PDF) y su orden. No hay código de producción.

## 1. Roadmap completo

| Línea | Capacidad | ID | Etapa | Estado |
|---|---|---|---|---|
| AC | Evaluación y prueba de Pandoc como herramienta opcional | AC-00 | 1 | Evaluada aquí; falta validar en Windows y Linux |
| ED | Edición avanzada con CodeMirror sin dependencias nuevas (multicursor, plegado, `markdownKeymap`) | ED-01 | 1 | Lista; después de FL-MD-007 y TXT-01 (mismo editor) |
| AC | Figuras y tablas numeradas con referencias cruzadas | AC-01 | 1 | Lista; después del lote actual |
| AC | Portada, metadatos e índices (contenido, figuras, tablas) | AC-02 | 1 | Lista tras AC-01 |
| AC | Citas y bibliografía (CSL JSON primero; `.bib` con Pandoc) | AC-03 | 1 | Lista tras AC-00 |
| AC | Exportación DOCX y PDF del reporte | AC-04 | 1 | Lista tras AC-01 a AC-03 |
| AC | Reporte de extremo a extremo con gráficos de datos | AC-05 | 1 | Gráficos estáticos ya; enlace vivo tras PRJ-04 y PRJ-05 |
| ED | Búsqueda de contenido en todos los archivos de la carpeta | ED-02 | 2 | Pendiente; comparte el escaneo de FL-MD-009 |
| KN | Wikilinks `[[…]]` con índice local de la carpeta | KN-01 | 2 | Pendiente |
| KN | Backlinks y «notas relacionadas» | KN-02 | 2 | Pendiente; tras KN-01 |
| KN | Etiquetas inteligentes: en línea `#etiqueta`, colores, alias y grupos | KN-03 | 2 | Pendiente; tras FL-MD-009 (hoy solo front matter) |
| WR | Documentos largos por capítulos (varios archivos) | WR-01 | 3 | Pendiente |
| WR | Plantillas de reporte, ensayo, artículo, tesis y libro | WR-02 | 3 | Pendiente; usa `--reference-doc` de Pandoc |
| WR | Edición visual avanzada («vista en vivo» sobre CodeMirror) | WR-03 | 3 | Pendiente; empieza con un prototipo |
| AC | Integración con Zotero (archivo CSL JSON o BibTeX que Zotero mantiene; sin API en vivo) | AC-06 | 3 | Pendiente |
| ED | Paleta de comandos, snippets y autocompletado | ED-03 | 4 | Pendiente; autocompletado exige `@codemirror/autocomplete` (dependencia nueva) |
| ED | Minimapa y comparación de archivos | ED-04 | 4 | Pendiente; exige `@codemirror/merge` y un minimapa de terceros |
| KN | Grafo de conocimiento (Cytoscape.js o Sigma.js, ambas MIT) | KN-04 | 4 | Pendiente; tras KN-01 y KN-02 |

**Portabilidad (principio):** Markdown sigue siendo el formato. Las citas usan la sintaxis estándar de Pandoc (`[@clave]`), las etiquetas viven en YAML, y las extensiones que no son estándar (wikilinks, avisos `> [!IMPORTANT]`) deben verse como texto legible en cualquier otro editor y convertirse al exportar.

## 2. Evaluación de Pandoc como herramienta opcional (AC-00)

Probado el 2026-10-27 con **Pandoc 3.12.1** instalado por Homebrew en macOS (Apple M2 Max). No se descargó ni instaló nada. **No se probó** Windows, Linux, EPUB, `--reference-doc`, estilos CSL como APA (no hay archivos CSL locales) ni documentos grandes.

| Aspecto | Resultado |
|---|---|
| Licencia | **GPL-2.0 o superior** (repositorio oficial). FreyaLab es MIT: usarlo como programa externo detectado en el sistema no obliga a nada al código de FreyaLab; **incluirlo en el instalador** exige cumplir su licencia y revisar el empaquetado (no es asesoría legal) |
| Instalación | Windows: MSI, zip, Chocolatey o winget. macOS: paquete, zip, Homebrew o MacPorts. Linux: paquetes de la distribución (a veces desactualizados), `.deb` y binario estático, **solo amd64** en la lista oficial. En este equipo ocupa **259 MB** instalado |
| Rendimiento | ~71 ms por conversión de un documento pequeño (mediana de 10): sirve para exportar, **no para una vista previa en vivo** |
| DOCX | Funciona: títulos, autor y fecha, `Heading 1…`, `Bibliography`, pie de figura (`ImageCaption`) y de tabla (`TableCaption`), notas al pie, ecuaciones y un índice con `--toc` (campo que Word actualiza al abrir) |
| Citas | `--citeproc` resuelve `[@clave]` y añade la bibliografía con el estilo Chicago por omisión; otros estilos necesitan un archivo `.csl` |
| **Numeración y referencias cruzadas** | **No existen en Pandoc**: no escribe «Figura 1» y `[@fig:ventas]` queda como cita sin resolver (`(fig:ventas?)`). Hace falta un filtro externo o resolverlo en FreyaLab |
| PDF | Pandoc necesita un motor LaTeX (`pdflatex` no está). **El PDF sigue saliendo de FreyaLab** (`printToPDF`) |
| Filtros | Un documento **no puede** pedir filtros Lua (`filters:` y `lua-filter:` del YAML se ignoran); solo los ejecuta quien invoca Pandoc con `--lua-filter` |

**Hallazgos de seguridad (reproducidos):**

1. **`--sandbox` no impide que el YAML del documento nombre un archivo.** Con `bibliography: /ruta/afuera/secreto.bib`, Pandoc lee y muestra esa entrada **con y sin** `--sandbox`. Mitigación: FreyaLab **quita el YAML del documento** y pasa por línea de comandos solo metadatos vetados (título, autor, fecha, idioma) y una ruta de bibliografía que él validó dentro del proyecto.
2. **Los bloques crudos entran al DOCX.** Un bloque `{=openxml}` se convierte en un **campo de Word real** (`INCLUDETEXT`, 2 `fldChar` y 1 `instrText`); con `-f markdown-raw_attribute` quedan 0 campos y el texto sale literal. Mitigación: siempre `-f markdown-raw_attribute-raw_html-raw_tex`.
3. **`--sandbox` bloquea todas las imágenes por ruta, incluso dentro de la carpeta** (0 imágenes embebidas), pero **funciona con imágenes `data:`** (1 embebida). Mitigación: FreyaLab entrega las imágenes ya incrustadas como `data:`, que es lo que ya hace para la vista previa y respeta su regla de que una imagen no puede salir de la carpeta del documento.
4. `--sandbox` bloquea además una imagen con ruta absoluta fuera de la carpeta.

**Decisión de diseño:** Pandoc es **opcional y externo**. FreyaLab lo detecta (PATH y ubicaciones habituales), muestra su versión y ofrece «Probar Pandoc»; sin él, DOCX y el formateo de citas quedan deshabilitados con una explicación, y todo lo demás sigue funcionando. Invocación fija: sin shell, con tiempo límite, sin red, `--sandbox`, `-f markdown-raw_attribute-raw_html-raw_tex`, **sin filtros** y con metadatos vetados. **No se empaqueta ni se añade ninguna dependencia** hasta cumplir estas condiciones: revisión de licencia, binarios y peso por plataforma, repetir las pruebas de seguridad en Windows y Linux, y una experiencia de instalación comprobada.

**Citas y licencias:** formatear con estilos CSL en JavaScript exige `citeproc-js` (**CPAL-1.0 o AGPL**), que también arrastra Citation.js (MIT) en su plugin de CSL. Por eso la v1 formatea citas **con Pandoc cuando está**, y sin él muestra una forma simple autor-año calculada a partir del archivo CSL JSON (sin motor CSL). Los estilos CSL son **CC BY-SA 3.0** (atribución y conservar los autores); se empaquetaría solo un conjunto pequeño (APA 7, IEEE, Vancouver, Chicago y MLA) con su aviso.

## 3. ED-01 · Edición avanzada con CodeMirror 6, sin dependencias nuevas

### 1. Historia de usuario

Como persona que escribe documentos largos, quiero seleccionar y editar varias líneas a la vez, plegar secciones y escribir listas con comodidad, para trabajar con la rapidez de un editor como Sublime Text sin salir de FreyaLab.

### 2. Problema y evidencia

Auditoría sobre `main` (`49817b6`) de lo que **ya está instalado** y de lo que `Editor.svelte` usa hoy. Instalados: `@codemirror/view` 6.43.15, `state` 6.7.6, `language` 6.13.1, `commands` 6.11.1, `search` 6.7.2 y `lang-markdown` 6.5.2. Verificado que exportan cada función de la tabla; `Editor.svelte` **no usa ninguna** de las marcadas «No».

| Capacidad | API disponible | En el editor hoy |
|---|---|---|
| Múltiples cursores (Alt+clic, columna, siguiente coincidencia) | `EditorState.allowMultipleSelections`, `EditorView.clickAddsSelectionRange`, `rectangularSelection`, `crosshairCursor`, `addCursorAbove/Below`, `selectNextOccurrence` | No |
| Plegado de secciones | `foldGutter`, `foldKeymap`, `codeFolding`, `foldService`; `lang-markdown` ya referencia sus propios nodos plegables | No |
| Listas y citas en Markdown | `markdownKeymap`, `insertNewlineContinueMarkup`, `deleteMarkupBackward` | No |
| Edición de líneas | `moveLineUp/Down`, `copyLineUp/Down`, `deleteLine`, `selectLine`, `indentMore` | Parcial (según `defaultKeymap`; Codex lo verifica) |
| Buscar, reemplazar, regex, ir a línea | `searchKeymap`, `gotoLine`, `highlightSelectionMatches` | **Sí** |
| Paréntesis, caracteres especiales, espacios | `bracketMatching`, `highlightSpecialChars`, `highlightWhitespace`, `dropCursor`, `scrollPastEnd` | No |
| Autocompletado y snippets | `@codemirror/autocomplete` | **Dependencia nueva**: fuera de ED-01 |
| Comparar archivos | `@codemirror/merge` | **Dependencia nueva**: fuera de ED-01 |
| Minimapa | Paquete de terceros | **Dependencia nueva**: fuera de ED-01 |

### 3. Diseño UX/UI

Sin pantallas nuevas. Se activan los comportamientos y se documentan en la ayuda del editor: multicursor con Alt+clic y Mod+D (siguiente coincidencia), flecha de plegado en el margen de los encabezados, y continuación automática de listas, tareas y citas al pulsar Intro. El plegado y los multicursores no cambian la apariencia hasta que se usan.

### 4. Criterios de aceptación

- E1. Alt+clic añade un cursor; Mod+D selecciona la siguiente coincidencia; escribir afecta a todos los cursores y **un solo paso de deshacer** revierte la edición completa.
- E2. Los encabezados muestran una flecha de plegado; plegar y desplegar no modifica el texto, ni el estado «con cambios».
- E3. Intro continúa listas con viñetas, numeradas y de tareas y citas; Intro en un elemento vacío sale de la lista; Retroceso borra el marcador.
- E4. **No se rompen** los atajos de FL-MD-001 (negrita, cursiva, tachado, títulos), la composición con IME, la barra de formato ni su estado activo con varios cursores (con varias selecciones, las acciones de formato se aplican solo a la principal o se deshabilitan: se decide y se prueba).
- E5. El modo Texto del CSV (TXT-01) y el editor de `.txt` no cambian de comportamiento (sin multicursor automático en ellos si genera conflictos; se decide y se prueba).
- E6. Sin dependencias nuevas; `package.json` y el lockfile sin cambios.
- E7. Accesibilidad: el plegado se opera con teclado y con nombre accesible; los multicursores no rompen el lector de pantalla (se documenta lo no verificado).

### 5. Casos límite

Documento de 10 MiB (el tiempo de plegar no debe crecer notablemente); encabezados dentro de bloques de código o `<details>`; plegar con el cursor dentro de la sección; CRLF; multicursor sobre varias líneas con selección vacía; deshacer tras plegar; solo lectura.

### 6. Prompt ejecutable para Codex

```text
Tarea: ED-01 · Edición avanzada con CodeMirror 6 sin dependencias nuevas. REQUISITO: FL-MD-007 y TXT-01 ya fusionadas (comparten Editor.svelte).
Lee AGENTS.md, CONTRIBUTING.md y docs/stories/8-escritura-academica.md (ED-01: criterios E1–E7 y la auditoría de la sección 2). Rama codex/ed-01-edicion-avanzada desde main actualizado. Sin dependencias; no toques package.json ni el lockfile.
Archivos probables: src/renderer/components/Editor.svelte, src/renderer/lib/ (módulo con la lista de extensiones), tests/e2e/markdown-toolbar.spec.ts y un E2E nuevo.
Método: 1) pruebas primero (E2E de Alt+clic y Mod+D con un solo deshacer, plegado de encabezados sin cambio de texto, continuación de listas, y que los atajos y la barra de FL-MD-001 sigan funcionando con varios cursores); deben fallar por la razón descrita. 2) Activa solo lo listado, reutilizando las funciones ya instaladas. 3) Mide el tiempo de plegar y desplegar en un documento de 10 MiB frente a main.
Ejecuta check, npm test, build y los E2E de Markdown (npm run test:e2e:md si ya existe; si no, los markdown-*, mermaid-*, ui, app e icons); esta tarea toca el editor compartido, así que ejecuta también la suite completa. Evidencia: docs/evidence/ed-01-<fecha>.md con rojo→verde, mediciones, capturas 1440×900 en claro y oscuro y lo no verificado. PR en BORRADOR; no fusiones.
```

### 7. Plan de pruebas

E2E de multicursor, plegado, listas y deshacer; regresión de FL-MD-001 (atajos, barra, IME); modo Texto de CSV y `.txt` sin cambios; medición con 10 MiB; la suite completa y la CI en las cuatro plataformas.

### 8. Criterios de revisión (Claude)

Un solo paso de deshacer con varios cursores; ningún atajo previo roto; el texto no cambia al plegar; sin dependencias nuevas; medición real; los modos CSV y `.txt` intactos.

## 4. Primera etapa: un reporte de extremo a extremo

**Historia de usuario del conjunto.** Como estudiante o profesional, quiero escribir un reporte con portada, índice, tablas y figuras numeradas, citas bibliográficas y gráficos de mis datos, y exportarlo a DOCX y a PDF, sin salir de FreyaLab ni escribir código.

**Flujo objetivo:** abrir datos → generar un gráfico → exportarlo como imagen → insertarlo con su pie → numerar y referenciar → citar → generar índice → exportar.

| ID | Entrega | Depende de | Tamaño | Toca |
|---|---|---|---|---|
| AC-00 | Validar Pandoc en Windows y Linux; módulo de detección y prueba | — | S | Módulo nuevo; sin tocar los componentes del lote |
| ED-01 | Edición avanzada de CodeMirror | FL-MD-007 y TXT-01 fusionadas | S a M | `Editor.svelte` |
| AC-01 | Figuras y tablas numeradas con referencias cruzadas | Fin del lote actual | M | `render.ts`, `Preview.svelte`, CSS de exportación |
| AC-02 | Portada, metadatos e índices | AC-01 | M | Ídem |
| AC-03 | Citas y bibliografía | AC-00 y AC-01 | M | Ídem, `documents.ts` |
| AC-04 | Exportación DOCX y PDF del reporte | AC-00 a AC-03 | M a L | `export.ts`, proceso principal |
| AC-05 | Gráficos de datos con procedencia | PRJ-04 y PRJ-05 | M | Proyectos |

Hasta que PRJ-04 y PRJ-05 existan, AC-05 se cubre con **gráficos exportados como imagen** (PNG o SVG ya existentes) insertados con la política de activos de FL-DRW-001; el reporte funciona de extremo a extremo y gana trazabilidad cuando lleguen los proyectos.

### AC-00 · Pandoc opcional: módulo de detección, prueba y validación multiplataforma

**Historia.** Como persona que quiere exportar a DOCX, quiero que FreyaLab encuentre mi Pandoc o me diga cómo instalarlo y que lo use de forma segura.

**Criterios.**
- P1. Detecta Pandoc en PATH y ubicaciones habituales de macOS, Windows y Linux, o en una ruta elegida; muestra versión, ruta y licencia; botón «Probar Pandoc» que convierte un documento de prueba.
- P2. Versión mínima fijada con evidencia (Codex la determina probando versiones disponibles); por debajo, deshabilitado con el motivo.
- P3. **Invocación fija:** `execFile` sin shell, tiempo límite, sin red, `--sandbox`, `-f markdown-raw_attribute-raw_html-raw_tex`, **sin `--lua-filter`**, `--data-dir` vacío si procede, y **YAML del documento eliminado** (solo metadatos vetados por línea de comandos).
- P4. Pruebas de seguridad que **reproducen los cuatro hallazgos** de la sección 2: un YAML con `bibliography` externo no lee el archivo; un bloque `{=openxml}` no produce ningún campo; una imagen fuera de la carpeta no entra; el documento no carga filtros. Además, una imagen con URL `http` no genera ninguna petición (se comprueba con un servidor local de prueba que cuenta las visitas).
- P5. Sin Pandoc, la aplicación funciona igual: DOCX y el formateo de citas aparecen deshabilitados con una guía de instalación por sistema.
- P6. Evidencia de **Windows y Linux** (versiones, ruta, resultados de P4), además de macOS.
- P7. No se empaqueta Pandoc ni se añade ninguna dependencia.

**Prompt para Codex.**
```text
Tarea: AC-00 · Pandoc opcional. Sin dependencias; no empaquetes Pandoc.
Lee docs/stories/8-escritura-academica.md (sección 2: evaluación y hallazgos; AC-00: criterios P1–P7). Rama codex/ac-00-pandoc-opcional desde main actualizado. Archivos: módulo nuevo en src/main/ (detección e invocación), canal IPC mínimo, y una sección «Pandoc» en la interfaz de ajustes que ya exista o un diálogo propio; no toques render.ts, Preview.svelte ni Editor.svelte.
1) Pruebas primero: unitarias de la lista de argumentos (siempre --sandbox, -f markdown-raw_attribute-raw_html-raw_tex, sin filtros), de la eliminación del YAML y de la validación de rutas; de seguridad con Pandoc real reproduciendo los hallazgos 1–4 (se omiten solo si Pandoc no está instalado, y eso se declara). 2) Implementa lo mínimo. 3) Ejecuta las pruebas en macOS, Windows y Linux (CI o equipos) y documenta versión y resultados. Evidencia: docs/evidence/ac-00-<fecha>.md. PR en BORRADOR.
```

### AC-01 · Figuras y tablas numeradas con referencias cruzadas

**Historia.** Como autor de un reporte, quiero que mis figuras y tablas se numeren solas y poder citarlas en el texto («véase la Figura 2»), para no renumerar a mano cuando agrego o muevo una.

**Diseño.** Sintaxis compatible con Pandoc, de modo que el documento siga siendo portable: figura `![Pie de la figura](ruta.png){#fig:ventas}`; tabla con su pie `: Pie de la tabla {#tbl:ventas}` debajo; referencia `[@fig:ventas]` y `[@tbl:ventas]`. FreyaLab resuelve la numeración **en su propia tubería** (un plugin de remark restringido, sin dependencias) y produce «Figura 1. Pie» y «véase la Figura 1» (etiquetas en el idioma del documento, `lang` del YAML). La numeración sale igual en la vista previa, el HTML y el PDF, y el DOCX recibe el texto ya numerado (Pandoc no numera: sección 2). Una referencia sin destino se marca como `enlace-roto`, igual que FL-MD-002.

**Criterios.**
- N1. Las figuras y tablas con identificador se numeran por orden de aparición, de forma independiente («Figura 1…», «Tabla 1…»); el pie conserva su formato Markdown interior.
- N2. `[@fig:id]` y `[@tbl:id]` se resuelven a «Figura N» y «Tabla N» con un enlace al elemento; un identificador inexistente se muestra como referencia rota sin lanzar excepción; un identificador repetido se avisa.
- N3. Añadir, quitar o mover una figura renumera todo el documento en la siguiente vista previa.
- N4. La sintaxis no estándar sigue legible en otro editor: `{#fig:id}` y `: Pie {#tbl:id}` no desaparecen del texto fuente ni lo alteran.
- N5. Sin identificador, la figura y la tabla se comportan como hoy (sin número).
- N6. El HTML y el PDF exportados llevan la numeración; los pies se ven bien en claro y oscuro (vista) y en claro (exportación).
- N7. Ningún HTML crudo sobrevive: el plugin solo reconoce esa sintaxis, sin atributos arbitrarios; los casos hostiles de FL-MD-002 siguen pasando.
- N8. Sin dependencias; el rendimiento con 10 MiB no empeora de forma apreciable (se mide frente a `main`).

**Riesgos.** `remark-gfm` no entiende los pies de tabla ni los atributos de imagen: hace falta un plugin propio, como el de `<details>`; hay que evitar la complejidad cuadrática que se corrigió en FL-MD-002. Las ecuaciones numeradas quedan fuera de AC-01.

**Prompt para Codex.**
```text
Tarea: AC-01 · Figuras y tablas numeradas. REQUISITO: el lote actual de Codex fusionado (toca render.ts y Preview.svelte).
Lee docs/stories/8-escritura-academica.md (AC-01: criterios N1–N8). Rama codex/ac-01-numeracion desde main actualizado. Sin dependencias.
Método: 1) pruebas primero (casos de numeración, referencias rotas, repetidos, sintaxis hostil, idioma del documento, 10 MiB); deben fallar. 2) plugin remark restringido en src/renderer/lib/ y estilos en documentCSS; sin rehype-raw. 3) mide el render de 10 MiB frente a main. Evidencia con capturas 1440×900 en claro y oscuro. Ejecuta check, npm test, build y la suite E2E de Markdown; PR en BORRADOR.
```

### AC-02 · Portada, metadatos e índices

**Historia.** Quiero una portada con el título, autor, fecha e institución, y un índice de contenido, de figuras y de tablas generados automáticamente.

**Criterios.**
- C1. El front matter admite `title`, `subtitle`, `author`, `date`, `institution` y `abstract`; una opción `portada: true` genera la portada (sin número de página) y el resto del reporte empieza en la página siguiente.
- C2. Índice de contenido a partir de los encabezados, índice de figuras y de tablas a partir de AC-01, con enlaces; cada índice se puede activar o no desde el front matter.
- C3. **Limitación declarada:** el PDF de FreyaLab (Chromium) puede numerar páginas pero **no** rellena números de página dentro de los índices; en el PDF los índices llevan enlaces y en el DOCX el índice es un campo que Word actualiza con números de página.
- C4. Los metadatos se escapan; no se interpretan como HTML.
- C5. Sin dependencias; los documentos sin esos campos no cambian.

**Prompt para Codex.** `Tarea: AC-02 · Portada e índices. REQUISITO: AC-01. Lee docs/stories/8-escritura-academica.md (AC-02: C1–C5). Rama codex/ac-02-portada-indices. Pruebas primero; sin dependencias; evidencia con PDF y HTML generados y capturas en claro; PR en BORRADOR.`

### AC-03 · Citas y bibliografía

**Historia.** Quiero citar fuentes con `[@clave]` y obtener la lista de referencias en un estilo reconocido (APA 7, IEEE, Vancouver, Chicago o MLA).

**Diseño.** Fuente de referencias: un archivo **CSL JSON** del proyecto (Zotero lo exporta) elegido en el front matter (`bibliography:`); **`.bib`** cuando Pandoc está disponible. Sintaxis `[@clave]`, `[@clave, p. 10]` y `@clave`. FreyaLab valida las claves y ofrece completarlas al escribir `[@`; **formatea con Pandoc** si está (AC-00); sin Pandoc, muestra una forma simple autor-año y avisa «sin estilo final». El estilo se elige entre los empaquetados.

**Criterios.**
- B1. Lee CSL JSON sin dependencias (`JSON.parse` con validación estricta); un archivo inválido da un error con ubicación, no una excepción.
- B2. Una clave inexistente se marca como cita rota y se lista en un panel de problemas del documento.
- B3. Con Pandoc, el reporte exportado trae las citas y la bibliografía en el estilo elegido; sin Pandoc, la vista previa muestra autor-año y el DOCX queda deshabilitado con la explicación.
- B4. La ruta de la bibliografía debe estar dentro de la carpeta del documento o del proyecto (el hallazgo 1 de la sección 2); una ruta externa se rechaza.
- B5. Los estilos CSL empaquetados llevan su aviso CC BY-SA 3.0 y conservan sus autores; se empaqueta un conjunto pequeño, no el repositorio entero.
- B6. Sin dependencias nuevas; un lector de `.bib` propio o de terceros solo con justificación expresa y licencia compatible (existe `@retorquere/bibtex-parser`, ISC).

**Prompt para Codex.** `Tarea: AC-03 · Citas y bibliografía. REQUISITO: AC-00 y AC-01. Lee docs/stories/8-escritura-academica.md (sección 2 y AC-03: B1–B6). Rama codex/ac-03-citas. No añadas dependencias; si crees necesitar un lector de .bib, detente y repórtalo. Pruebas primero (CSL JSON válido e inválido, claves rotas, ruta fuera de la carpeta, Pandoc presente y ausente); evidencia; PR en BORRADOR.`

### AC-04 · Exportación del reporte a DOCX y PDF

**Historia.** Quiero exportar el reporte completo a DOCX (para entregarlo o editarlo en Word) y a PDF con portada, índices, figuras numeradas y citas.

**Diseño.** **PDF:** la tubería actual de FreyaLab con portada, índices y numeración de páginas (`printToPDF` con encabezado y pie). **DOCX:** FreyaLab prepara un Markdown «resuelto» (numeración ya aplicada, imágenes `data:`, YAML vetado) y lo entrega a Pandoc con la invocación fija de AC-00 y `--toc` si el índice está activo; un `reference-doc` opcional (plantilla institucional) debe estar dentro de la carpeta del proyecto.

**Criterios.**
- D1. El PDF y el DOCX del mismo documento muestran las mismas figuras, tablas, numeraciones y referencias.
- D2. El DOCX abre en Word y LibreOffice con estilos de Word reconocibles (`Heading 1`, pie de figura y de tabla, `Bibliography`) y el índice es un campo actualizable.
- D3. Un documento hostil (bloques crudos, YAML con rutas, imágenes externas) produce un DOCX **sin campos ni lecturas no autorizadas** (se repiten los casos de AC-00).
- D4. Sin Pandoc, «Exportar a DOCX» está deshabilitado con la guía; el PDF y el HTML siguen funcionando.
- D5. Un error de Pandoc se muestra con un mensaje comprensible y sin ruta ni contenido del documento en los registros públicos.
- D6. Sin dependencias; el tiempo de exportación de un reporte de 50 páginas se mide y se publica.

**Prompt para Codex.** `Tarea: AC-04 · Exportación DOCX y PDF. REQUISITO: AC-00 a AC-03. Lee docs/stories/8-escritura-academica.md (AC-04: D1–D6). Rama codex/ac-04-exportar-reporte. Pruebas primero, incluida la repetición de los hallazgos de seguridad sobre el DOCX final; abre el DOCX generado con una herramienta independiente de Word para comprobar estilos; evidencia; PR en BORRADOR.`

### AC-05 · Gráficos de datos en el reporte

**Primera versión (sin dependencias del trabajo de proyectos):** insertar una imagen exportada de un gráfico (PNG o SVG) como figura con pie y numeración (AC-01), usando la política de activos de FL-DRW-001. **Con PRJ-04 y PRJ-05:** el gráfico queda ligado a su receta y fuente, con aviso de «datos cambiados» y su procedencia en una nota. Criterios y prompt se detallan cuando PRJ-04 esté listo.

## 5. Orden y dependencias

1. **Ahora, sin tocar el lote:** AC-00 (módulo nuevo y validación multiplataforma).
2. **Cuando termine el lote actual:** AC-01, AC-02 y AC-03, en ese orden; ED-01 cuando FL-MD-007 y TXT-01 estén fusionadas.
3. **Después:** AC-04 (reúne todo lo anterior) y AC-05 con imágenes.
4. **Con PRJ-04 y PRJ-05:** el enlace vivo de AC-05.
5. **Segunda etapa:** ED-02, KN-01 a KN-03. **Tercera:** WR-01 a WR-03 y AC-06. **Cuarta:** ED-03, ED-04 y KN-04.

Para evitar desarrollos simultáneos sobre los mismos archivos, **no hay más de una historia de esta iteración activa sobre `render.ts` y `Preview.svelte` a la vez**.

## 6. Riesgos y decisiones por confirmar

| Riesgo o decisión | Propuesta |
|---|---|
| Empaquetar Pandoc (GPL, ~260 MB por plataforma) | No ahora. Se decide con las condiciones de la sección 2 |
| Formatear citas sin Pandoc | Autor-año simple y aviso; ningún motor CSL en JavaScript por la licencia de `citeproc-js` |
| Referencias cruzadas con la sintaxis de Pandoc | Sí: el texto fuente queda portable; FreyaLab resuelve la numeración |
| Números de página en los índices del PDF | No se prometen (Chromium); sí en el DOCX |
| `.bib` | Con Pandoc; un lector propio solo con justificación |
| Edición visual (WR-03) | Prototipo sobre CodeMirror antes de decidir; no un segundo motor de edición |

## 7. Revisión de cada PR (Claude)

Para cada PR de esta iteración reviso por separado: **funcionalidad** (criterios de la historia con rojo→verde demostrado), **UX/UI** (capturas 1440×900 en claro y oscuro, accesibilidad y mensajes), **seguridad** (los casos hostiles de FL-MD-002 y los cuatro hallazgos de Pandoc repetidos sobre el resultado final, nada de red ni lecturas fuera de la carpeta) y **regresiones** (las suites afectadas y la CI en las cuatro plataformas). Veredicto: `APPROVED`, `CHANGES REQUESTED`, `NEEDS TESTING` o `BLOCKED`.
