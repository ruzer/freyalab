# Historia 12 — Herramientas de escritura para Markdown y Mermaid («no necesito saber las etiquetas»)

Diseño: Claude. Implementa: Codex. Decide y fusiona: el propietario.

## Historia
Como persona que escribe documentos y diagramas sin conocer la sintaxis, quiero un panel de herramientas con todo lo que puedo insertar y su ejemplo, para elegir «qué quiero hacer» en lugar de recordar etiquetas, y aprender la sintaxis mientras lo uso.

## Evidencia (app real y código, `main` 22b871f)
- Markdown: la barra tiene título, negrita, cursiva, código, tachado, Tarea, Tabla, un solo botón **Mermaid** (inserta un diagrama de flujo fijo) y el menú «Insertar» (listas, cita, separador, enlace, fechas, bloque de código).
- Documentos `.mmd` («DIAGRAMA»): **no tienen ninguna barra de herramientas**; solo Editar / Dividido / Vista previa.
- No hay catálogo de diagramas, plantillas por tipo, bloques por tipo, ni ayuda de sintaxis. `@codemirror/autocomplete` ya está en el árbol (se usa para citas) y su `snippet` da marcadores con Tab sin dependencia nueva.
- Verificado en la app real: Mermaid 12.2.0 empaquetado, con `securityLevel:'strict'`, renderiza **23 tipos**: flowchart, sequence, class, state, ER, gantt, mindmap, pie, timeline, journey, gitGraph, quadrantChart, requirementDiagram, C4Context, sankey, xychart, kanban, architecture, block, packet, radar, treemap y venn; también `%%{init: {"theme":"forest"}}%%` y `style A fill:…`. Un diagrama incompleto y un texto que no es Mermaid ya muestran su error claro («Falta completar el diagrama», «No se reconoce el tipo de diagrama»).
- Decisión previa (Historia 3): el menú `/` se descartó por duplicar el menú Insertar. Aquí el panel **sí** aporta lo que Insertar no: descubrir, buscar, ver ejemplo y explicación.

## Diseño UX
### Panel «Herramientas» (un solo componente, dos contextos)
- Botón «Herramientas» junto a Buscar/Índice; abre un panel lateral derecho (misma zona que Índice; se alterna con él). Atajo único, que no choque con los existentes (comprobar).
- Arriba: campo «Buscar herramienta…» (busca por nombre, objetivo y etiqueta: «tabla», «flecha», «negrita»). Debajo, secciones plegables según contexto:
  - **Markdown**: Texto (negrita, cursiva, tachado, código, enlace, nota al pie si el render la soporta) · Estructura (títulos, listas, tareas, cita, separador, tabla, bloque de código con lenguaje) · Avanzado (matemáticas, cita académica `[@id]`, fecha) · **Diagramas** (ver abajo).
  - **Mermaid**: «¿Qué quieres mostrar?» → tarjetas por objetivo (abajo) y, con un diagrama ya escrito, **Elementos de este diagrama** y **Estilo y color**.
- Cada herramienta es una fila-botón: icono, nombre, una línea «para qué sirve» y la sintaxis que inserta (`**texto**` → **texto**) para aprender. Clic = inserta; con texto seleccionado lo envuelve (reutiliza las reglas de E2). La inserción deja el cursor en el primer marcador y Tab salta al siguiente.
- Contexto automático: en un `.mmd` muestra Mermaid; en Markdown muestra Markdown; si el cursor está dentro de un bloque ```` ```mermaid ```` muestra los elementos de ese diagrama.

### «¿Qué quieres mostrar?» (elige objetivo, no nombre técnico)
| Objetivo | Tipo | Ejemplo que inserta |
|---|---|---|
| Pasos de un proceso o decisiones | flowchart | inicio → decisión → fin |
| Quién habla con quién y en qué orden | sequenceDiagram | 2 actores, mensaje y respuesta |
| Estructura de clases/objetos | classDiagram | herencia simple |
| Estados por los que pasa algo | stateDiagram-v2 | inicio, estado, fin |
| Tablas y relaciones de una base de datos | erDiagram | cliente–pedido |
| Plan o cronograma | gantt | sección y 2 tareas |
| Ideas jerarquizadas | mindmap | raíz y 2 ramas |
| Proporciones | pie | 3 partes |
| Hechos en el tiempo | timeline | 3 hitos |
| Experiencia de una persona | journey | 2 secciones |
| Ramas y versiones de código | gitGraph | commit y rama |
| Priorizar en 2 ejes | quadrantChart | 3 puntos |
| Valores por categoría | xychart | barras |
| Flujos con cantidades | sankey | 3 enlaces |
| Tareas por columnas | kanban | 3 columnas |
| Arquitectura de sistemas / contexto C4 / requisitos / bloques / paquetes / radar / treemap / venn | resto | ejemplo mínimo |
Orden de presentación: primero los 8 más comunes; el resto bajo «Más diagramas». Cada tarjeta: nombre claro en español, el objetivo en una frase y el nombre técnico en pequeño.
- En `.mmd` con contenido: la tarjeta pregunta «¿Reemplazar el diagrama actual?» (Reemplazar / Cancelar; deshacer lo revierte). Documento vacío: inserta sin preguntar. En Markdown: inserta un bloque completo con su valla en el cursor.

### Elementos de este diagrama (según la primera línea)
- flowchart: nodo, nodo redondeado, decisión, base de datos, enlace, enlace con texto, enlace punteado, subgrafo, dirección (LR/TD).
- sequence: participante, actor, mensaje, respuesta, nota, bucle, alternativa (alt/else), opcional, activación.
- class: clase, herencia, composición, agregación, método y atributo.
- state: estado, transición, estado compuesto, inicio/fin, nota.
- er: entidad, relación y sus cardinalidades (uno, muchos, cero o uno…).
- gantt: sección, tarea, hito, tarea dependiente.
- mindmap / pie / timeline / journey / otros: elemento básico del tipo (rama, porción, hito, paso…).
Cada elemento es un `snippet` con marcadores (`${1:texto}`) y se muestra con su sintaxis.

### Estilo y color
Solo lo que el render admite con `securityLevel:'strict'`: color de un nodo (`style A fill:…,stroke:…`), clase reutilizable (`classDef` + `class`), tema del diagrama (`%%{init: {"theme":"forest"}}%%`: default, neutral, forest, dark, base), dirección. Selector de color con las paletas del producto y contraste visible; el color nunca es el único portador de significado.

### Ayuda en línea
- Autocompletado: al escribir en Mermaid, sugiere las palabras clave y flechas del tipo detectado (`participant`, `subgraph`, `-->`, `->>`…) con una línea de explicación; en Markdown, al abrir una valla, sugiere los lenguajes (incluido `mermaid`). Sin `/` en esta historia.
- Pestaña «Ayuda» del panel: hoja de sintaxis del contexto actual (mismo catálogo, solo lectura), sin red y sin enlaces salientes.

## Contrato de datos (un solo catálogo)
`src/shared/` o `src/renderer/lib/`: lista tipada de herramientas `{id, grupo, contexto, nombre, objetivo, sintaxis, snippet, requiere?}` con textos en el catálogo i18n (es, en y pseudolocale en-XA). Un solo catálogo alimenta panel, búsqueda, autocompletado y ayuda. Nada se escribe en el documento salvo la inserción.

## Reglas
- Sin dependencias nuevas (ADR 0021: reutiliza CodeMirror `snippet`/autocomplete y el Mermaid empaquetado; responde las 7 preguntas). Si `@codemirror/autocomplete` no figura como dependencia directa, declararla es un cambio de `package.json` a justificar aparte.
- Todo local, sin red.
- Inserción deshacible en un paso; sin tocar texto fuera del rango; respeta CRLF, IME (no actuar durante composición), solo lectura (panel deshabilitado con motivo) y bloques con valla.
- Accesible: región con nombre, lista navegable con teclado (flechas, Enter inserta, Esc cierra y devuelve el foco al editor), campo de búsqueda alcanzable, anuncio «Insertado: …» en región viva, objetivos ≥ 24 px, movimiento reducido, `forced-colors`. Textos que respetan en-XA.
- Una herramienta = una prueba de que lo que inserta **funciona**: en CI, todo snippet Markdown se renderiza con el pipeline de la Vista previa y produce el elemento esperado; toda plantilla Mermaid pasa por el Mermaid empaquetado y renderiza sin error (así el catálogo no se pudre al actualizar Mermaid).

## Entrega en 4 PR pequeños (cada uno verificable; pruebas fallan primero)
1. **H12-1 Panel y Markdown**: catálogo, panel con búsqueda, secciones Texto/Estructura/Avanzado, inserción con marcadores, E2 como base para envolver. Prueba E2E: buscar «tabla», insertar, Tab entre celdas.
2. **H12-2 Diagramas por objetivo**: «¿Qué quieres mostrar?», 8 comunes + resto, panel en `.mmd` y en Markdown, reemplazo con confirmación. Prueba de render de las 23 plantillas.
3. **H12-3 Elementos y estilo**: elementos por tipo (flowchart, sequence, class, state, er, gantt primero), color/estilo/tema.
4. **H12-4 Autocompletado y Ayuda**: palabras clave/flechas por tipo, lenguajes de valla, pestaña Ayuda.
Orden fijo; cada PR en borrador, base `main`, sin dependencias. Aplazado: `/` en línea, asistente con IA, editor visual por arrastre de nodos (otra historia si el propietario lo quiere).

## Aceptación global (humana, en la app real)
Una persona que nunca ha escrito Mermaid: abre un `.mmd` vacío, elige «Quién habla con quién», ve el diagrama, añade un mensaje desde «Elementos» sin escribir una flecha, cambia el color de un participante, y guarda. Otra que nunca ha escrito Markdown: busca «tabla», la inserta, y rellena con Tab.
