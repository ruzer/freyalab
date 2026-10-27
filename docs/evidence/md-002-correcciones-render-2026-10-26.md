# FL-MD-002 · Correcciones del renderizado Markdown

Base: `61d0e05b1d87ba30186a7a8f1908f1c9ed06d73a`, main actualizado con PR #66 fusionado. Rama: `codex/md-002-correcciones-render`; worktree independiente `/private/tmp/freyalab-md-002`. Historia leída desde `origin/claude/historias-markdown-mermaid`; esa rama no se fusiona. El checkout del usuario permanece intacto.

## Tabla rojo → verde por bloque

| Bloque | Rojo real antes del cambio | Verde comprobado |
| --- | --- | --- |
| A · Front matter | `npx vitest run tests/render.test.ts`: 8 fallos y 6 aprobados, incluyendo los tres casos originales; `/private/tmp/md002-a-red.log`. | 14/14; `/private/tmp/md002-a-green.log`. E2E A 1/1 en 4,8 s: propiedades fuera del artículo/índice, HTML/PDF sin metadatos y fuente/guardado intactos; `/private/tmp/md002-a-e2e.log`. |
| B · Enlaces internos | 9 fallos/15 aprobados en render; 1 fallo/3 aprobados en export. `/private/tmp/md002-b-red-corrected.log`, `md002-b-export-red.log`. E2E detectó además que `mailto:` estaba bloqueado pese a B5 (`md002-b-e2e.log`). | 29/29 render+export; `/private/tmp/md002-b-green.log`. A+B: 2/2 E2E, 7,9 s; `/private/tmp/md002-b-e2e-green.log`. |
| C · Notas al pie | 8 fallos/31 aprobados en render+export; `/private/tmp/md002-c-red-corrected.log`. Una prueba adicional de un título dentro de una nota falló antes de darle ancla (`md002-c-note-heading-red.log`). | 40/40 render+export; `/private/tmp/md002-c-green.log`. A+B+C: 3/3 E2E, 9,9 s; `/private/tmp/md002-c-e2e.log`. |

## A · Propiedades del documento

Se aparta el encabezado antes de remark-parse y se devuelve `frontMatter` opcional como texto literal, sin interpretar YAML. En Preview hay un `<details>` cerrado por defecto, «Propiedades del documento», fuera del artículo que se exporta. Svelte escapa su contenido; la fuente nunca cambia. Un bloque vacío se distingue de la ausencia de bloque.

La detección inspecciona como máximo las primeras **100 líneas totales**, incluidos delimitadores. Acepta BOM, CRLF/LF, cierre `---` o `...`, comentarios, claves, listas y sangría. Un bloque sin cierre, mayor de ese límite o con líneas que no parecen YAML se entrega entero al renderizador anterior: no se consume contenido de forma silenciosa. No se añade un parser ni dependencia YAML.

Capturas A de Electron real a 1440×900: [claro](md-002-a-light-1440x900.png) y [oscuro](md-002-a-dark-1440x900.png). Se verificaron exportaciones HTML/PDF reales y guardado del original con el mismo contenido. `npm run check` del bloque A: 0 errores y 0 advertencias; build correcto.

## Regla acordada para B

El usuario aclaró la tensión B1/B3: enlaces internos sin destino pasan a `<span class="enlace-roto" data-seccion-faltante="x">texto</span>`, sin href ni foco. En la app, pulsarlos muestra el aviso; al exportar son texto sin salto ni JavaScript, con subrayado punteado y tono apagado. `href="#"` es una excepción explícita (inicio) y los enlaces externos con fragmento no se reescriben. Se decodifican fragmentos antes de compararlos, sin distinguir acentos ni mayúsculas. El span no es tabulable: límite de teclado aceptado expresamente por el usuario.

Los resultados globales, el invariante y lo no verificado se completarán al terminar B–D. Este estado parcial no afirma pruebas de bloques aún no implementados ni CI multiplataforma.

## B · Destinos reales y representación única de huérfanos

Los id de títulos conservan `heading-` y tienen slug sin acentos/mayúsculas; se evitan también colisiones entre duplicados y títulos terminados en número. Un plugin rehype después de generar los id reescribe los fragmentos válidos al id real. Los inválidos pasan al span acordado, preservando sus hijos y el fragmento decodificado como texto; porcentajes mal formados no lanzan excepciones. El estilo punteado/apagado está tanto en Preview como en `documentCSS`. Se conserva el atributo inerte del span en la frontera de exportación.

Preview abre ancestros `<details>` al navegar, desplaza el destino y le da foco sin quitar del recorrido de Tab a los enlaces de vuelta. Un span roto solo responde al clic con el aviso, sin href ni tabindex (limitación de teclado acordada). `#` va al inicio. Los enlaces externos con fragmento no se reescriben. B5 reveló que `mailto:` estaba bloqueado en main: se añadió únicamente ese protocolo a la lista HTTP/HTTPS existente; `file:`, `javascript:` y `data:` siguen rechazados por el puente. El test sustituye solo `shell.openExternal` para no abrir apps reales.

No se amplió `allowedSchemes` de `autonomousHTML`: la política preexistente de exportación retira los href externos. La excepción de no reescribirlos se prueba en `markdownHTML` y B5 se verifica en Preview. Se corrigió una aserción inicial que esperaba Unicode sin codificar en una URL externa: remark ya lo codificaba a UTF-8 antes de este cambio.

Invariante E2E B comprobado sobre elementos DOM, excluyendo `href="#"`: **Preview 4 id / 4 href internos; HTML autónomo sin JS 4 / 4; 0 destinos ausentes y 0 id duplicados en ambos**. La comprobación unitaria usa el parser de `sanitize-html` ya instalado, no regex sobre texto que podría contener `href`/`id` de ejemplo en un bloque de código. Capturas B: [claro](md-002-b-light-1440x900.png) y [oscuro](md-002-b-dark-1440x900.png), 1440×900. Tipos y build del bloque correctos.

## C · Notas en español, con un único prefijo y destinos coherentes

`remark-rehype` deja de añadir su propio prefijo; `rehype-sanitize` conserva su configuración predeterminada y aplica `user-content-` una sola vez. Se localizan «Notas al pie» y «Volver a la referencia N». El título generado es visible, conserva su id para `aria-describedby` y queda fuera del índice; un título real del usuario con ese nombre sí entra.

Las notas y referencias generadas reciben identificadores ordinales opacos por documento. Así no colisionan la segunda referencia de `1` y una nota llamada `1-2`, ni se depende de porcentajes o Unicode en la URL. Se enlazan las vueltas con las referencias de cada nota. Las definiciones nunca usadas no se emiten. El HTML crudo no puede declarar esos id ni atributos de nota; el saneamiento sigue activo. Los títulos dentro del cuerpo de una nota admiten ancla, aunque no aparezcan en el índice de secciones.

Se conservan los atributos semánticos inertes de las notas en la frontera de exportación. E2E C comprobó ida/vuelta con foco, español, exclusión del índice, fuente/guardado intactos y navegación del HTML fuera de la app con JavaScript deshabilitado. **7 id / 6 href internos / 0 ausentes / 0 duplicados**, tanto Preview como HTML exportado. Capturas C: [claro](md-002-c-light-1440x900.png) y [oscuro](md-002-c-dark-1440x900.png), 1440×900. Tipos y build correctos.
