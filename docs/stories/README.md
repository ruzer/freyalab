# Historias para Codex · Markdown y Mermaid

Fecha: 2026-10-26, estado actualizado el 2026-10-27 · Base de las medidas originales: `main` en `da7a002` (incluye FL-MD-001, PR #65); estado de esta tabla sobre `main` en `61d0e05` (incluye el PR #66) · Autor del diseño: Claude · Implementa: Codex · Valida: Claude.

Este directorio contiene las historias de mejora continua de los editores Markdown y Mermaid. **Son documentos de diseño: no cambian código de producción.** No fusionar PR, no publicar versiones y no actualizar la aplicación instalada.

## Cómo se usa

1. Codex toma **una historia** (un ID), crea una rama `codex/<id>-<tema>` desde `main` actualizado y trabaja en un worktree independiente.
2. Codex escribe primero las pruebas que reproducen el defecto y comprueba que fallan (rojo), luego implementa lo mínimo (verde).
3. Codex abre un PR en borrador con la evidencia (`docs/evidence/<id>-<fecha>.md`, y capturas 1440×900 en claro y oscuro si hay interfaz).
4. Claude revisa el PR contra la historia original y entrega un veredicto: `APPROVED`, `CHANGES REQUESTED`, `NEEDS TESTING` o `BLOCKED`.

Cada historia tiene los mismos ocho apartados: 1 historia de usuario, 2 problema y evidencia, 3 diseño UX/UI, 4 criterios de aceptación, 5 casos límite, 6 prompt ejecutable para Codex, 7 plan de pruebas, 8 criterios de revisión.

## Reglas comunes (de `AGENTS.md` y `CONTRIBUTING.md`)

- Electron, TypeScript estricto y Svelte. Sin telemetría ni cargas remotas: todo recurso es local.
- **Sin dependencias nuevas** salvo que la historia lo diga y el propietario lo apruebe antes. Si Codex cree que necesita una, se detiene y lo informa.
- Reutilizar lo que ya existe: unified/remark/rehype, CodeMirror 6, Mermaid 12.2.0, DOMPurify, `sanitize-html`. No escribir un motor nuevo.
- Comprobaciones: `npm run check`, `npm test`, `npm run test:e2e`, `npm run build`. Documentar plataforma, comandos y resultados; no declarar aprobado lo que no se ejecutó.
- Conservar el texto del usuario: ninguna historia puede normalizar, reescribir o perder contenido del documento.
- Los IDs `FL-MD-002` en adelante y `FL-MER-007` en adelante son **propuestos**. Codex ya menciona `FL-MER-002` a `FL-MER-006` en el PR #66; si alguno de estos IDs está reservado, se renumera sin cambiar el contenido.

## Estado y orden

| Iteración | Historia | Tamaño | Depende de | Estado |
|---|---|---|---|---|
| 1 · Correcciones Markdown | [FL-MD-002](1-markdown-correcciones.md): front matter, enlaces internos, notas al pie, `<details>` | M | — | **Fusionado**: PR #67 en `main` (`7955b68`) el 2026-10-27, **sin la corrección de rendimiento** que pidió la revisión (`CHANGES REQUESTED`); esa corrección pasa a la tarea 0 del lote de Codex (rama `codex/md-002-rendimiento-plegables`) |
| 2 · Robustez Mermaid | FL-MER-001: último SVG válido y errores con línea | — | — | **Hecha**: PR #66 fusionado en `main` (`61d0e05`); `CHANGES REQUESTED` por latencia (544 ms), corregido y `APPROVED` (169 y 171 ms) |
| 2 | [FL-MER-008](2-mermaid-robustez.md): «Ajustar a pantalla» | S | — | Lista |
| 2 | [FL-MER-009](2-mermaid-robustez.md): exportación en tema claro y oscuro | S | — | Lista (hay medición) |
| 2 | [FL-MER-007](2-mermaid-robustez.md): marcas en el editor (CodeMirror) | M | #66 fusionado | Lista (el #66 ya está fusionado) |
| 2 | [FL-MER-010](2-mermaid-robustez.md): vista ampliada | M | FL-MER-008 | Bloqueada por FL-MER-008 |
| 3 · Experiencia Markdown | [FL-MD-003](3-markdown-experiencia.md): palabras y tiempo de lectura | S | — | Lista |
| 3 | FL-MD-004: casillas interactivas | M | FL-MD-002 | Lista (FL-MD-002 ya está en `main`) |
| 3 | FL-MD-005: pegar una URL sobre texto seleccionado | S | — | Lista |
| 3 | FL-MD-006: corrector ortográfico | S + decisión | Decisión de diccionarios | **Bloqueada** hasta decidir Windows/Linux |
| 3 | [FL-MD-007](3-markdown-experiencia.md): índice como pestaña «Archivos \| Índice» de la barra izquierda, con sección actual, ramas que se contraen y modo Editar | M a L | FL-MD-002 (ya en `main`) | Lista |
| 3 | [FL-MD-008](3-markdown-experiencia.md): insertar fecha y hora | S | — | Lista |
| 3 | [FL-MD-009](3-markdown-experiencia.md): etiquetas en el front matter (solo lectura): chips en la vista previa, lista «Etiquetas» con recuentos y filtro `#etiqueta` en el explorador | M a L | FL-MD-002 | Lista (FL-MD-002 ya está en `main`; T1–T4 aprobadas el 2026-10-27) |
| 3 | FL-MD-010: etiquetas, segunda versión (diálogo «Agregar o eliminar etiquetas» con autocompletado, como Joplin) | M | FL-MD-009 | Esbozada dentro de [FL-MD-009](3-markdown-experiencia.md) |
| 3 | Pegar HTML como Markdown · imágenes · menú `/` · atrás/adelante y editor externo | — | Aprobación | Evaluadas, aplazadas |
| 4 · Dibujos editables | [FL-DRW-001](4-dibujos-editables.md): activos relativos y «Guardar como» (F05) | M | — | Lista (sin dependencias) |
| 4 | [FL-DRW-002](4-dibujos-editables.md): prototipo aislado con js-draw (solo medidas; rama `spike/drw-js-draw` que nunca se fusiona) | S | — (D1 aprobada el 2026-10-27) | **Lista**; el «go» de su informe y una decisión nueva del propietario deciden si js-draw entra en `main` |
| 4 | FL-DRW-003 a 005: integración, inserción y exportación | L | FL-DRW-001 y el «go» de FL-DRW-002 | Esbozadas (D2 a D6 aprobadas el 2026-10-27) |
| 5 · Pruebas | [FL-TST-001](5-pruebas.md): segmentar la suite E2E en `shell`, `md`, `csv` y `@perf`, sin borrar pruebas | S | — | Lista (recomendada antes de las demás, para que usen los grupos) |

Orden recomendado (2026-10-27): **tarea 0 (corrección de rendimiento de FL-MD-002, que quedó fuera del #67) → FL-TST-001 (grupos de pruebas, para que las demás los usen) → FL-MER-009 → FL-MER-008 → FL-MD-003 → FL-MD-005 → FL-MD-008 → FL-MD-004 → FL-MD-007 → FL-MD-009 → FL-MER-007 → FL-MER-010 → FL-DRW-001**; FL-DRW-002 (prototipo y medidas, nunca se fusiona) puede ir en paralelo con cualquiera porque no toca producción. Las historias independientes pueden ir en paralelo si tocan archivos distintos: FL-MD-002 toca `render.ts`, `Preview.svelte` y las pruebas de render; FL-MER-008/009/010 tocan `Diagram.svelte` y la exportación; FL-MD-003 y FL-MD-005 tocan `Editor.svelte`/`App.svelte`; FL-MD-008 toca `markdown-commands.ts` y `MarkdownToolbar.svelte`; FL-MD-007 toca la barra lateral de `App.svelte`, `Preview.svelte`, `Editor.svelte` y un componente nuevo del índice; FL-MD-009 toca `src/shared/front-matter.ts` (nuevo), `documents.ts` (`findFiles` y `listTags`), el canal IPC (`index.ts`, `preload`, tipos), `Preview.svelte` y `App.svelte`, y va después de FL-MD-007 para no solaparse en la barra lateral de `App.svelte` ni en `Preview.svelte`.

## Contexto verificado el 2026-10-26

- `main` incluye la barra de formato completa (FL-MD-001: tachado, títulos, listas numeradas, separador, selector de 9 lenguajes). Por eso **no hay historias de barra ni de menú «Insertar»**.
- PR #66 `codex/mer-001-errores-diagrama`: traductor de errores de Mermaid al español, último dibujo válido atenuado, exportación bloqueada si el diagrama es inválido. Revisado contra los criterios de FL-MER-001 de [2-mermaid-robustez.md](2-mermaid-robustez.md) y fusionado el 2026-10-26.
- PR #67 `codex/md-002-correcciones-render` (FL-MD-002), revisado el 2026-10-27 sobre `84efa63`: A–D cumplen sus criterios, con rojo→verde por commit, 527 pruebas unitarias, 4 E2E nuevos y CI 4/4. `CHANGES REQUESTED` por un cambio obligatorio: `remark-details.ts` añade todas las definiciones del documento a cada fragmento, y el render pasa de 41 ms en `main` a 2.493 ms con 100 plegables y 400 definiciones. **Se fusionó el 2026-10-27 en `7955b68` sin esa corrección**, así que `main` conserva el coste cuadrático hasta que se haga la tarea 0.
- Auditoría de pruebas del 2026-10-27 sobre `main` en `7955b68` (detalle en [5-pruebas.md](5-pruebas.md)): 234 E2E y 527 unitarias en verde, E2E completo en 8,7 min, sin pruebas omitidas ni módulos que solo existan para ser probados.
- Las medidas de las iteraciones 1 a 4 salen de una **copia del canal de renderizado** (`unified`, `remark-gfm`, `remark-math`, `remark-rehype`, `rehype-sanitize`, `rehype-katex`, `rehype-highlight`) y de **Mermaid 12.2.0 real en Chromium**. Las del índice (FL-MD-007) salen de la **aplicación real construida desde `main`** (Electron 44, 1440×900). Ninguna procede de la aplicación empaquetada ni de los instaladores.

## Veredictos de revisión

| Veredicto | Cuándo |
|---|---|
| `APPROVED` | Cumple todos los criterios de aceptación, hay rojo→verde demostrado, la evidencia es verificable y no hay alcance extra. |
| `CHANGES REQUESTED` | Falta o falla un criterio, hay regresión, alcance extra o una afirmación sin evidencia. Se lista cada cambio con su criterio. |
| `NEEDS TESTING` | El código parece correcto pero falta una prueba, una plataforma o una captura que lo demuestre. |
| `BLOCKED` | Depende de una decisión del propietario o de otra historia, o aparece un riesgo que exige detenerse. |

Protocolo de revisión de Claude: (1) leer la historia y el PR sin mirar el resumen de Codex; (2) comprobar que las pruebas nuevas fallan sin el cambio; (3) ejecutar las cuatro comprobaciones en un worktree propio; (4) recorrer los casos límite de la historia; (5) revisar diff por alcance, dependencias y seguridad; (6) entregar veredicto y lista de hallazgos con criterio asociado.
