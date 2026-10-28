# Historias para Codex · FreyaLab

Estado actualizado el 2026-10-28 sobre `main` en `33a5dfd` · Autor del diseño: Claude · Implementa: Codex · Valida: Claude.

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

## Estado y orden (2026-10-28)

| Iteración | Historia | Tamaño | Depende de | Estado |
|---|---|---|---|---|
| 1 · Correcciones Markdown | [FL-MD-002](1-markdown-correcciones.md): front matter, enlaces internos, notas al pie, `<details>` | M | — | **Hecho**: #67 (`7955b68`) y #68 (corrección del render cuadrático de los plegables y bloqueo de adjuntos `mailto:`) |
| 2 · Robustez Mermaid | FL-MER-001: último SVG válido y errores con línea | — | — | **Hecho**: #66 |
| 2 | [FL-MER-009](2-mermaid-robustez.md): exportación en tema claro y oscuro | S | — | **Hecho**: #69 |
| 2 | [FL-MER-008](2-mermaid-robustez.md): «Ajustar a pantalla» | S | — | **Hecho**: #70 |
| 2 | [FL-MER-007](2-mermaid-robustez.md): marcas en el editor (CodeMirror) | M | #66 (en `main`) | **Implementada en #81, aún no en `main`** (se fusionó en la rama `codex/integracion-navegacion-markdown`, no en `main`). Revisión de Claude: **cambios solicitados** (carrera de tema en Mermaid, [comentario](https://github.com/ruzer/freyalab/pull/81#issuecomment-6473177544)) |
| 2 | [FL-MER-010](2-mermaid-robustez.md): vista ampliada | M | FL-MER-008 (en `main`) | **Implementada en #81, aún no en `main`** (ver FL-MER-007) |
| 3 · Experiencia Markdown | [FL-MD-003](3-markdown-experiencia.md): palabras y tiempo de lectura | S | — | **Hecho**: #71 |
| 3 | [FL-MD-004](3-markdown-experiencia.md): casillas interactivas | M | FL-MD-002 | **Hecho**: #74 |
| 3 | [FL-MD-005](3-markdown-experiencia.md): pegar una URL sobre texto seleccionado | S | — | **Hecho**: #72 |
| 3 | [FL-MD-006](3-markdown-experiencia.md): corrector ortográfico | S + decisión | Decisión de diccionarios | **Bloqueada** hasta decidir Windows y Linux |
| 3 | [FL-MD-007](3-markdown-experiencia.md): índice como pestaña «Archivos \| Índice» de la barra izquierda, con sección actual, ramas que se contraen y modo Editar | M a L | FL-MD-002 (en `main`) | **Hecho**: #80 (revisión posterior: aprobada; seguimiento F1 sobre el ancho mínimo de ventana, 720 px deja fuera el botón «Analizar» del CSV) |
| 3 | [FL-MD-008](3-markdown-experiencia.md): insertar fecha y hora | S | — | **Hecho**: #73 |
| 3 | [FL-MD-009](3-markdown-experiencia.md): etiquetas en el front matter (solo lectura): chips, lista «Etiquetas» con recuentos y filtro `#etiqueta` | M a L | FL-MD-002 (en `main`); va después de FL-MD-007 (misma barra lateral) | **Hecho**: #80 (T1–T4 aprobadas el 2026-10-27) |
| 3 | FL-MD-010: etiquetas, segunda versión (diálogo «Agregar o eliminar etiquetas») | M | FL-MD-009 | Esbozada dentro de FL-MD-009 |
| 3 | Pegar HTML como Markdown · imágenes · menú `/` · atrás/adelante y editor externo | — | Aprobación | Evaluadas, aplazadas |
| 4 · Dibujos editables | [FL-DRW-001](4-dibujos-editables.md): activos relativos y «Guardar como» | M | — | **Implementada en #82, aún no en `main`** (se fusionó en `codex/integracion-mermaid`). Código aprobado con seguimientos de UX (U1 a U3, [comentario](https://github.com/ruzer/freyalab/pull/82#issuecomment-6473178087)); su aterrizaje depende de corregir #81 |
| 4 | [FL-DRW-002](4-dibujos-editables.md): prototipo aislado con js-draw (solo medidas; rama `spike/drw-js-draw` que nunca se fusiona) | S | — (D1 aprobada el 2026-10-27) | **Hecho como evaluación**: rama local `spike/drw-js-draw`, sin push. Propuesta **NO GO** de Codex (fugas de nodos y listeners al destruir el editor, pérdida de fidelidad con SVG ajenos); Claude coincide. Pendiente la decisión del propietario |
| 4 | FL-DRW-003 a 005: integración, inserción y exportación | L | FL-DRW-001 y el «go» de FL-DRW-002 | Esbozadas (D2 a D6 aprobadas) |
| 5 · Pruebas | [FL-TST-001](5-pruebas.md): segmentar la suite E2E en `shell`, `md`, `csv` y `@perf`, sin borrar pruebas | S | — | **Hecho**: #78 (revisión posterior: aprobada) |
| 6 · Proyectos | [PRJ-00](6-proyectos.md): contrato de proyecto, recetas, procedencia y privacidad (documento de decisión) | S | — | **En `main`** (#75). Faltan por confirmar las cuatro decisiones de su sección 8 |
| 6 | PRJ-01 a PRJ-07: proyecto y fuente protegida, vistas y recetas, extracción con procedencia, gráficos, informes, obsolescencia, comparar versiones | M a L | PRJ-00 confirmado; PRJ-07 espera a L3 | Esbozadas |
| 7 · Vistas Tabla y Texto | [TXT-01](7-csv-texto.md): abrir un CSV como tabla o como texto | S a M | — | **En `main`** (#76); lista para Codex, sin rama |
| 7 | TXT-02 a TXT-05: columnas en colores, separador, cambios entre vistas, vista dividida, texto paginado | M a H | TXT-01; TXT-03 y PRJ-07 esperan a L3 | Esbozadas |
| 8 · Escritura académica | [AC-00 a AC-05 y ED-01](8-escritura-academica.md): reporte de extremo a extremo (Pandoc opcional, edición avanzada de CodeMirror, figuras y tablas numeradas, portada e índices, citas, DOCX y PDF) | S a M cada una | AC-01 a AC-04 esperan a los bloques de editor y barra lateral; ED-01 a FL-MD-007 y TXT-01 | **En `main`** (#77); AC-00 puede empezar ya |
| 8 | KN-01 a KN-04, WR-01 a WR-03, ED-02 a ED-04, AC-06: wikilinks, backlinks, etiquetas inteligentes, grafo, capítulos, plantillas, edición visual, Zotero, paleta de comandos | M a H | Etapas 2 a 4 | Roadmap conservado |
| 9 · CSV grande | [L4a y L5a](9-csv-grande.md): buscar y filtrar en archivos de más de 2 M de celdas o 50 MiB (hoy solo lectura). Recorrido en flujo, vista paginada, progreso y cancelación; «Extraer coincidencias» | M a L | L2 (en `main`) | **Listas** (L4a y luego L5a, en un solo bloque), sin rama; decisiones Q1 a Q6 por confirmar |
| 9 | L4b (reemplazar), L5b (estadísticas), L5c (ordenar), SQL+ (que el SQL no recargue el archivo en cada consulta), L2+ (índice persistente y caché fría) | M a L | L4a / L5a | Esbozadas |

Líneas de desarrollo (decisión del propietario, 2026-10-27): **CSV escalable L3–L9** (RFC `docs/design/LARGE-FILE-EDITOR-RFC.md`), **vistas Texto y Tabla TXT-01–05**, **proyectos de análisis PRJ-00–07** y, como cuarta línea por etapas, **escritura académica y profesional** (iteración 8). No se abren desarrollos nuevos sobre los mismos archivos que otro bloque activo.

Orden recomendado (2026-10-28), como punto de partida para el plan de Codex: FL-TST-001 (#78) → barra lateral y exploración (FL-MD-007, luego FL-MD-009) → editor (ED-01 y TXT-01) → editor de Mermaid (FL-MER-007 y FL-MER-010) → FL-DRW-001 (FL-DRW-002 como spike en paralelo) → PRJ-01 a PRJ-03 → AC-00 y AC-01 a AC-04. Un solo bloque activo por conjunto de archivos compartidos: FL-MD-007 y FL-MD-009 tocan la barra lateral de `App.svelte`, `Preview.svelte`, `documents.ts` y el canal IPC; ED-01 y TXT-01 tocan `Editor.svelte` y la ruta de texto de `documents.ts`; FL-MER-007 y FL-MER-010 tocan `Diagram.svelte` y `Editor.svelte`; AC-01 a AC-04 tocan `render.ts`, `Preview.svelte` y `export.ts`. **Propuesta pendiente de confirmar por el propietario (2026-10-28):** pasar L4a y L5a ([9-csv-grande.md](9-csv-grande.md)) delante de TXT y PRJ, porque hoy un CSV de más de 2 M de celdas no se puede buscar ni filtrar.

## Contexto verificado el 2026-10-28

- `main` incluye la barra de formato completa (FL-MD-001), las correcciones de render de FL-MD-002 y las historias FL-MER-001, 008 y 009, FL-MD-003, 004, 005 y 008. No hay historias de barra ni de menú «Insertar».
- PR #67 y #68: la revisión de Claude sobre el #67 pidió un cambio obligatorio (el render de los plegables crecía de forma cuadrática con las definiciones de enlace). El #68 lo corrigió: con 100 plegables y 400 definiciones el render pasó de 2.196 ms (#67) a 44 ms (`main`, medido), y con 1.600 plegables compactos y 1.600 definiciones de 208 s a 406 ms. La revisión independiente de Claude de #69 a #74 sigue pendiente; se fusionaron antes de revisarlas.
- El PR #77 se publicó como un solo archivo de documentación, pero se fusionó con una corrección de producción (`fix(md): posponer la vista previa oculta durante la edición`, `App.svelte` y `Preview.svelte`, con su prueba y evidencia): una prueba pesada de solo lectura (un archivo de 12 MB) venció su tiempo en macOS Intel y puso en rojo ese PR. Es un caso de la trazabilidad que se quiere conservar: las correcciones de producción van en su propio PR.
- Auditoría de pruebas sobre `main` en `7955b68` (detalle en [5-pruebas.md](5-pruebas.md)): 234 E2E y 527 unitarias en verde, E2E completo en 8,7 min, 15 pruebas concentran el 38 % del tiempo, sin pruebas omitidas ni módulos que solo existan para ser probados. La CI por PR dura entre 38 y 97 min por corrida (macOS Intel es el cuello; su límite subió de 45 a 60 min en #69) y las corridas de los commits de fusión en `main` se cancelan entre sí.
- Las medidas de las iteraciones 1 a 4 salen de una copia del canal de renderizado (`unified`, `remark-gfm`, `remark-math`, `remark-rehype`, `rehype-sanitize`, `rehype-katex`, `rehype-highlight`) y de Mermaid 12.2.0 real en Chromium. Las del índice, de la aplicación real construida desde `main` (Electron 44, 1440×900). Ninguna procede de la aplicación empaquetada ni de los instaladores.
- **Estado de la pila de Codex (2026-10-28, 15:09 UTC):** #80 (FL-MD-007 y FL-MD-009) está en `main` (`33a5dfd`). #81 y #82 se fusionaron en las ramas `codex/integracion-navegacion-markdown` y `codex/integracion-mermaid` porque sus bases no eran `main`: sus commits **no son ancestros de `main`**. Para aterrizarlos hace falta un PR hacia `main`, y antes hay que corregir la carrera de tema de Mermaid señalada en la revisión de #81.
- **CSV grande:** con 72.000 **celdas** la búsqueda y los filtros funcionan; el modo grande de solo lectura (L2) aparece al superar 2.000.000 de celdas o 50 MiB (por ejemplo 72.000 filas × 28 columnas). Reproducido sobre `main` `33a5dfd`; detalle y diseño de la solución en [9-csv-grande.md](9-csv-grande.md); medición previa de la búsqueda y del SQL actual en [l4-medicion-previa-2026-10-28.md](../evidence/l4-medicion-previa-2026-10-28.md).

## Veredictos de revisión

| Veredicto | Cuándo |
|---|---|
| `APPROVED` | Cumple todos los criterios de aceptación, hay rojo→verde demostrado, la evidencia es verificable y no hay alcance extra. |
| `CHANGES REQUESTED` | Falta o falla un criterio, hay regresión, alcance extra o una afirmación sin evidencia. Se lista cada cambio con su criterio. |
| `NEEDS TESTING` | El código parece correcto pero falta una prueba, una plataforma o una captura que lo demuestre. |
| `BLOCKED` | Depende de una decisión del propietario o de otra historia, o aparece un riesgo que exige detenerse. |

Protocolo de revisión de Claude: (1) leer la historia y el PR sin mirar el resumen de Codex; (2) comprobar que las pruebas nuevas fallan sin el cambio; (3) ejecutar las cuatro comprobaciones en un worktree propio; (4) recorrer los casos límite de la historia; (5) revisar diff por alcance, dependencias y seguridad; (6) entregar veredicto y lista de hallazgos con criterio asociado.
