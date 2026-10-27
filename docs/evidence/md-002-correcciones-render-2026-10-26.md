# FL-MD-002 · Correcciones del renderizado Markdown

Base: `61d0e05b1d87ba30186a7a8f1908f1c9ed06d73a`, main actualizado con PR #66 fusionado. Rama: `codex/md-002-correcciones-render`; worktree independiente `/private/tmp/freyalab-md-002`. Historia leída desde `origin/claude/historias-markdown-mermaid`; esa rama no se fusiona. El checkout del usuario permanece intacto.

## Tabla rojo → verde por bloque

| Bloque | Rojo real antes del cambio | Verde comprobado |
| --- | --- | --- |
| A · Front matter | `npx vitest run tests/render.test.ts`: 8 fallos y 6 aprobados, incluyendo los tres casos originales; `/private/tmp/md002-a-red.log`. | 14/14; `/private/tmp/md002-a-green.log`. E2E A 1/1 en 4,8 s: propiedades fuera del artículo/índice, HTML/PDF sin metadatos y fuente/guardado intactos; `/private/tmp/md002-a-e2e.log`. |

## A · Propiedades del documento

Se aparta el encabezado antes de remark-parse y se devuelve `frontMatter` opcional como texto literal, sin interpretar YAML. En Preview hay un `<details>` cerrado por defecto, «Propiedades del documento», fuera del artículo que se exporta. Svelte escapa su contenido; la fuente nunca cambia. Un bloque vacío se distingue de la ausencia de bloque.

La detección inspecciona como máximo las primeras **100 líneas totales**, incluidos delimitadores. Acepta BOM, CRLF/LF, cierre `---` o `...`, comentarios, claves, listas y sangría. Un bloque sin cierre, mayor de ese límite o con líneas que no parecen YAML se entrega entero al renderizador anterior: no se consume contenido de forma silenciosa. No se añade un parser ni dependencia YAML.

Capturas A de Electron real a 1440×900: [claro](md-002-a-light-1440x900.png) y [oscuro](md-002-a-dark-1440x900.png). Se verificaron exportaciones HTML/PDF reales y guardado del original con el mismo contenido. `npm run check` del bloque A: 0 errores y 0 advertencias; build correcto.

## Regla acordada para B

El usuario aclaró la tensión B1/B3: enlaces internos sin destino pasan a `<span class="enlace-roto" data-seccion-faltante="x">texto</span>`, sin href ni foco. En la app, pulsarlos muestra el aviso; al exportar son texto sin salto ni JavaScript, con subrayado punteado y tono apagado. `href="#"` es una excepción explícita (inicio) y los enlaces externos con fragmento no se reescriben. Se decodifican fragmentos antes de compararlos, sin distinguir acentos ni mayúsculas. El span no es tabulable: límite de teclado aceptado expresamente por el usuario.

Los resultados globales, el invariante y lo no verificado se completarán al terminar B–D. Este estado parcial no afirma pruebas de bloques aún no implementados ni CI multiplataforma.
