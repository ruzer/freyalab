# FL-MD-002 · Correcciones del renderizado Markdown

Base: `61d0e05b1d87ba30186a7a8f1908f1c9ed06d73a`, main actualizado con PR #66 fusionado. Rama: `codex/md-002-correcciones-render`; worktree independiente `/private/tmp/freyalab-md-002`. Historia leída desde `origin/claude/historias-markdown-mermaid`; esa rama no se fusiona. El checkout del usuario permanece intacto.

## Tabla rojo → verde por bloque

| Bloque | Rojo real antes del cambio | Verde comprobado |
| --- | --- | --- |
| A · Front matter | `npx vitest run tests/render.test.ts`: 8 fallos y 6 aprobados, incluyendo los tres casos originales; `/private/tmp/md002-a-red.log`. | 14/14; `/private/tmp/md002-a-green.log`. E2E A 1/1 en 4,8 s: propiedades fuera del artículo/índice, HTML/PDF sin metadatos y fuente/guardado intactos; `/private/tmp/md002-a-e2e.log`. |
| B · Enlaces internos | 9 fallos/15 aprobados en render; 1 fallo/3 aprobados en export. `/private/tmp/md002-b-red-corrected.log`, `md002-b-export-red.log`. E2E detectó además que `mailto:` estaba bloqueado pese a B5 (`md002-b-e2e.log`). | 29/29 render+export; `/private/tmp/md002-b-green.log`. A+B: 2/2 E2E, 7,9 s; `/private/tmp/md002-b-e2e-green.log`. |
| C · Notas al pie | 8 fallos/31 aprobados en render+export; `/private/tmp/md002-c-red-corrected.log`. Una prueba adicional de un título dentro de una nota falló antes de darle ancla (`md002-c-note-heading-red.log`). | 40/40 render+export; `/private/tmp/md002-c-green.log`. A+B+C: 3/3 E2E, 9,9 s; `/private/tmp/md002-c-e2e.log`. |
| D · Plegables | 16 fallos/47 aprobados en render+export antes de integrar el plugin; `/private/tmp/md002-d-red.log`. | 71/71 render+export; `/private/tmp/md002-d-green.log`. A–D: 4/4 E2E en 12,0 s; `/private/tmp/md002-d-e2e.log`. Validación final ampliada registrada abajo. |

## A · Propiedades del documento

Se aparta el encabezado antes de remark-parse y se devuelve `frontMatter` opcional como texto literal, sin interpretar YAML. En Preview hay un `<details>` cerrado por defecto, «Propiedades del documento», fuera del artículo que se exporta. Svelte escapa su contenido; la fuente nunca cambia. Un bloque vacío se distingue de la ausencia de bloque.

La detección inspecciona como máximo las primeras **100 líneas totales**, incluidos delimitadores. Acepta BOM, CRLF/LF, cierre `---` o `...`, comentarios, claves, listas y sangría. Un bloque sin cierre, mayor de ese límite o con líneas que no parecen YAML se entrega entero al renderizador anterior: no se consume contenido de forma silenciosa. No se añade un parser ni dependencia YAML.

Capturas A de Electron real a 1440×900: [claro](md-002-a-light-1440x900.png) y [oscuro](md-002-a-dark-1440x900.png). Se verificaron exportaciones HTML/PDF reales y guardado del original con el mismo contenido. `npm run check` del bloque A: 0 errores y 0 advertencias; build correcto.

## Regla acordada para B

El usuario aclaró la tensión B1/B3: enlaces internos sin destino pasan a `<span class="enlace-roto" data-seccion-faltante="x">texto</span>`, sin href ni foco. En la app, pulsarlos muestra el aviso; al exportar son texto sin salto ni JavaScript, con subrayado punteado y tono apagado. `href="#"` es una excepción explícita (inicio) y los enlaces externos con fragmento no se reescriben. Se decodifican fragmentos antes de compararlos, sin distinguir acentos ni mayúsculas. El span no es tabulable: límite de teclado aceptado expresamente por el usuario.

## B · Destinos reales y representación única de huérfanos

Los id de títulos conservan `heading-` y tienen slug sin acentos/mayúsculas; se evitan también colisiones entre duplicados y títulos terminados en número. Un plugin rehype después de generar los id reescribe los fragmentos válidos al id real. Los inválidos pasan al span acordado, preservando sus hijos y el fragmento decodificado como texto; porcentajes mal formados no lanzan excepciones. El estilo punteado/apagado está tanto en Preview como en `documentCSS`. Se conserva el atributo inerte del span en la frontera de exportación.

Preview abre ancestros `<details>` al navegar, desplaza el destino y le da foco sin quitar del recorrido de Tab a los enlaces de vuelta. Un span roto solo responde al clic con el aviso, sin href ni tabindex (limitación de teclado acordada). `#` va al inicio. Los enlaces externos con fragmento no se reescriben. B5 reveló que `mailto:` estaba bloqueado en main: se añadió únicamente ese protocolo a la lista HTTP/HTTPS existente; `file:`, `javascript:` y `data:` siguen rechazados por el puente. El test sustituye solo `shell.openExternal` para no abrir apps reales.

No se amplió `allowedSchemes` de `autonomousHTML`: la política preexistente de exportación retira los href externos. La excepción de no reescribirlos se prueba en `markdownHTML` y B5 se verifica en Preview. Se corrigió una aserción inicial que esperaba Unicode sin codificar en una URL externa: remark ya lo codificaba a UTF-8 antes de este cambio.

Invariante E2E B comprobado sobre elementos DOM, excluyendo `href="#"`: **Preview 4 id / 4 href internos; HTML autónomo sin JS 4 / 4; 0 destinos ausentes y 0 id duplicados en ambos**. La comprobación unitaria usa el parser de `sanitize-html` ya instalado, no regex sobre texto que podría contener `href`/`id` de ejemplo en un bloque de código. Capturas B: [claro](md-002-b-light-1440x900.png) y [oscuro](md-002-b-dark-1440x900.png), 1440×900. Tipos y build del bloque correctos.

La revisión adicional reprodujo B7 con un título `ZZ` y `[mal](#%ZZ)`: la prueba falló porque el slug del fragmento mal formado coincidía con ese título. Se separó la decodificación estricta de la búsqueda; si falla, queda el span, incluso cuando existe un título parecido. Rojo 1/1 (`md002-b-malformed-red.log`); verde 12/12 del grupo B (`md002-b-malformed-green.log`). Esta corrección queda integrada en el commit B.

## C · Notas en español, con un único prefijo y destinos coherentes

`remark-rehype` deja de añadir su propio prefijo; `rehype-sanitize` conserva su configuración predeterminada y aplica `user-content-` una sola vez. Se localizan «Notas al pie» y «Volver a la referencia N». El título generado es visible, conserva su id para `aria-describedby` y queda fuera del índice; un título real del usuario con ese nombre sí entra.

Las notas y referencias generadas reciben identificadores ordinales opacos por documento. Así no colisionan la segunda referencia de `1` y una nota llamada `1-2`, ni se depende de porcentajes o Unicode en la URL. Se enlazan las vueltas con las referencias de cada nota. Las definiciones nunca usadas no se emiten. El HTML crudo no puede declarar esos id ni atributos de nota; el saneamiento sigue activo. Los títulos dentro del cuerpo de una nota admiten ancla, aunque no aparezcan en el índice de secciones.

Se conservan los atributos semánticos inertes de las notas en la frontera de exportación. E2E C comprobó ida/vuelta con foco, español, exclusión del índice, fuente/guardado intactos y navegación del HTML fuera de la app con JavaScript deshabilitado. **7 id / 6 href internos / 0 ausentes / 0 duplicados**, tanto Preview como HTML exportado. Capturas C: [claro](md-002-c-light-1440x900.png) y [oscuro](md-002-c-dark-1440x900.png), 1440×900. Tipos y build correctos.

## D · Plegables nativos y exportación

Un plugin remark restringido convierte únicamente etiquetas de bloque `details`, `details open` y `summary` en nodos con `data.hName`; el contenido pasa por el parser Markdown instalado y el saneamiento habitual. No se habilita HTML arbitrario ni se añade `rehype-raw`. Las etiquetas con atributos no admitidos no se promueven. Los cierres/aperturas sin pareja conservan el texto, y se prueban tres niveles, lista, cita, tabla, código, resumen ausente y entradas hostiles.

**Decisión D4 confirmada por el usuario:** el HTML conserva el `open` escrito en el archivo, incluso si el lector abre o cierra el plegable en Preview. El PDF muestra todos abiertos. Se registra el estado original como atributo interno al preparar el DOM, y `exportHTML()` restaura ese estado en una copia del artículo; retira el atributo antes de serializar. El DOM que está usando el lector no se toca. Una nueva prueba E2E falló primero: exportaba `[true,false,true,false,false]` tras los clics, en vez de `[false,true,false,false,false]` de la fuente (`md002-d4-e2e-red.log`).

Antes de imprimir PDF se abren todos los `details` únicamente en la ventana aislada de exportación. Electron comprobó el texto de los cinco plegables (exterior, intermedio, profundo, lista y cita) dentro del PDF real; comprobó también que el HTML autónomo, sin JavaScript, conserva los estados iniciales `[false,true,false,false,false]`. Intro/Espacio operan el control nativo, y navegar a un título oculto abre sus ancestros y le da foco. El HTML D tiene **2 id / 1 href interno / 0 ausentes / 0 duplicados**. La validación final incluye exportar de nuevo después de invertir estados abiertos y cerrados, sin perder el estado visible ni modificar la fuente.

Capturas D: [claro](md-002-d-light-1440x900.png) y [oscuro](md-002-d-dark-1440x900.png), 1440×900. Tras cada cambio de tema se abren los mismos niveles mediante clic nativo, porque el render existente repone el estado del documento. No se ha añadido persistencia de la apertura de plegables al cambiar de tema.

La revisión del helper añadió pruebas deterministas de trabajo, sin umbrales de reloj: una corrida larga de backticks, corridas de distintas longitudes y aperturas huérfanas al final. Primero fallaron por recorrer repetidamente sufijos o mover contenido entre padres; se salta cada corrida completa, se indexa su última posición por longitud y se vacía la pila una sola vez. Un `details` dentro de HTML `code` no se promociona a plegable. Rojo: 4 fallos/4 aprobados (`md002-d-helper-red.log`); verde: 8/8 (`md002-d-helper-green.log`).

Se comprobó además que un plegable compacto puede usar notas al pie y enlaces por referencia definidos fuera, o definiciones Markdown normales dentro del plegable. El helper reutiliza los textos de definiciones del AST original al parsear fragmentos, retirando los nodos inyectados; un bloque de código sin cierre no absorbe ese contexto. Rojo adicional: 3 fallos/9 aprobados (`md002-d-references-red.log`); verde: 12/12 (`md002-d-references-green.log`). No es un parser HTML general: no incorpora definiciones enterradas exclusivamente en HTML compacto que no existan como definiciones en el AST original. Los contenedores HTML ajenos como div/object/svg y sus atributos no se emiten; solo las etiquetas permitidas se promueven.

## Invariante sobre el corpus reproducible

`tests/helpers/markdown-invariants.ts` cuenta elementos reales con el parser ya instalado, excluyendo exclusivamente `href="#"` según la excepción acordada. No confunde ejemplos de HTML dentro de bloques de código con enlaces reales. Cada documento se comprueba por separado antes y después de `autonomousHTML`, con los mismos resultados:

| Documento | id generados / exportados | href locales generados / exportados | Sin destino | id duplicados |
| --- | ---: | ---: | ---: | ---: |
| a-properties.md | 2 / 2 | 0 / 0 | 0 | 0 |
| b-links.md | 8 / 8 | 9 / 9 | 0 | 0 |
| c-notes.md | 9 / 9 | 9 / 9 | 0 | 0 |
| d-details.md | 2 / 2 | 1 / 1 | 0 | 0 |
| d-hostile.md | 1 / 1 | 0 / 0 | 0 | 0 |
| mixed.md | 9 / 9 | 10 / 10 | 0 | 0 |
| Total de las seis comprobaciones | **31 / 31** | **29 / 29** | **0** | **0** |

Las pruebas no reescriben fixtures ni documentos de usuario. Los tres casos originales de `tests/render.test.ts` siguen intactos. Los logs completos de desarrollo están en el worktree temporal indicado; esta tabla y las capturas conservan el resumen revisable en Git.

## Validación final y límites

Equipo local: Apple M2 Max, 32 GiB RAM, macOS 27.0.1 arm64; Node.js 24.22.1, Electron 44.9.2. Esta evidencia no sustituye la CI de otras plataformas ni una prueba de instaladores.

### Render de 10 MiB frente a main

Se comparó la función `markdownHTML` original exacta de `61d0e05` con la nueva, dentro del mismo proceso Vitest y con las mismas dependencias. Documento sintético de **10.485.760 bytes**: `# Inicio\n\n`, texto repetido `Texto de prueba. ` hasta completar el tamaño y `\n\n[Volver](#inicio)\n`. Una vuelta de calentamiento por implementación y tres muestras alternadas; sin Electron, builds u otras suites ejecutándose a la vez. Comando: `npx vitest run tests/md002-perf.tmp.test.ts`; los dos archivos temporales de comparación se retiraron tras medir, sin alterar dependencias.

| Implementación | Muestras (ms) | Mediana (ms) |
| --- | --- | ---: |
| main `61d0e05` | 5807, 5796, 5912 | **5807** |
| FL-MD-002 final | 5909, 5841, 5864 | **5864** |

Diferencia de medianas: **+57 ms (+0,98 %)** en este documento y equipo. Log `/private/tmp/md002-perf-final-repeat.log`, datos `/private/tmp/md002-render-10mib-final.json`. Se repitió la comparación tras el último cambio del helper; la primera ejecución había dado 5852/5892 ms (+0,68 %), conservada en `md002-perf-final.log` y `md002-render-10mib.json`. Es una medición de render completo, no de arranque ni latencia de teclado, y no demuestra el rendimiento de cualquier distribución de 10 MiB, especialmente miles de bloques anidados.

### Comandos finales

| Comando | Resultado local real |
| --- | --- |
| `npm run check` | 0 errores y 0 advertencias; `md002-final-check.log`. |
| `FREYALAB_MD_EVIDENCE=1 npm test` | **527/527 pruebas**, 31 archivos, 5,67 s; `md002-final-unit.log`. |
| `FREYALAB_MD_EVIDENCE=1 npm run test:e2e` | **233 aprobadas / 1 fallo, 9,0 min, salida 1**; `md002-final-e2e.log`. Los cuatro bloques A–D pasan (1,7/5,5/1,9/2,8 s), también los 17 casos Mermaid, el render progresivo con imágenes y el documento de 10 MiB. |
| `npm run build` | Correcto, salida 0; `md002-final-build.log`. También compiló correctamente al iniciar la suite E2E. |

La suite completa **no está verde en local**: `analysis-dock.spec.ts:74/81`, sin cambios en este PR, esperaba `SELECT 42 AS respuesta` y recibió `SELnECT 42 AS respuesta` después de simular la escritura. La configuración del gráfico sí se conservó. No se cambió SQL/CSV para ocultar el fallo; la comparación focal con main y con la rama se registra a continuación. Los resultados del DOM final B/C/D coinciden con los recuentos anteriores (`md002-final-e2e-anchors.json`).

Comparación focal, con el mismo Node/Electron y sin otra suite nativa simultánea:

- `main` exacto `61d0e05` en un worktree temporal: `npx playwright test tests/e2e/analysis-dock.spec.ts -g 'cambiar de pestaña conserva' --repeat-each=3` → **3/3**, 6,0 s; `md002-baseline-sql.log`.
- Rama FL-MD-002, mismo comando → **3/3**, 3,5 s; `md002-branch-sql.log`.

El fallo inicial no se reprodujo en esas seis ejecuciones. Esto **no demuestra** que sea preexistente ni identifica su causa; sigue registrado como incidencia no reproducida. No se sustituyó la salida de la suite completa por estos resultados focales. La CI de las cuatro plataformas se verificará sobre el head del PR y se informará en su descripción; no se presenta aquí como ejecutada antes de existir el PR.

No se ejecutaron instaladores ni una comprobación manual con lector de pantalla. La extracción de texto del PDF valida contenido, sin sustituir una revisión visual exhaustiva de cada página. No hay dependencias nuevas, ni cambios en el editor CSV o el motor Mermaid. No se fusionan PR, publican releases ni actualiza la aplicación instalada.
