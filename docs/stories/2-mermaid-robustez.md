# Iteración 2 · Robustez de Mermaid

Seis necesidades, cinco historias. Reutilizan Mermaid 12.2.0 (`strict`, `htmlLabels:false`, DOMPurify) y CodeMirror 6. **No se desarrolla ningún motor de diagramación.**

| Necesidad pedida | Historia | Estado |
|---|---|---|
| Conservar el último SVG válido ante errores | FL-MER-001 | Cubierta por el PR #66 |
| Mostrar errores con línea y descripción | FL-MER-001 | Cubierta por el PR #66 |
| Integrar diagnósticos con CodeMirror | FL-MER-007 | Bloqueada por #66 |
| Corregir «Ajustar a pantalla» | FL-MER-008 | Lista |
| Verificar exportación HTML/PDF en claro y oscuro | FL-MER-009 | Lista, con medición |
| Abrir diagramas en vista ampliada | FL-MER-010 | Bloqueada por FL-MER-008 |

## FL-MER-001 · Ya implementada en el PR #66: revisión contra la historia

El PR #66 (`codex/mer-001-errores-diagrama`, borrador, CI 4/4 en verde) se escribió antes de esta historia; no se duplica el trabajo. Se **revisa contra estos criterios** cuando Codex lo marque listo:

- R1. Ante un error, el último SVG válido sigue visible, atenuado, con aviso persistente «desactualizado»; no es interactivo; al corregir, el aviso desaparece sin desplazar el dibujo.
- R2. El mensaje explica en español qué revisar, indica la línea del analizador y deja el texto técnico original plegado y exacto.
- R3. SVG, PNG y PDF bloquean una fuente inválida («Corrige el diagrama antes de exportar.») y no dejan archivos a medias.
- R4. Dentro de Markdown, un bloque inválido usa la misma explicación con la línea relativa al diagrama; los bloques válidos y las imágenes del documento siguen apareciendo.
- R5. Sin diagrama previo, ofrece un ejemplo mínimo copiable.
- R6. Pruebas: traductor puro con los mensajes reales de Mermaid 12.2.0; E2E con rojo documentado; sin dependencias nuevas ni cambios de IPC, guardado o CSV.
- R7. Anuncio accesible (`role=status`, cortés) sin repetirse al seguir escribiendo; contraste medido.

Observaciones ya visibles en la descripción del PR (para tenerlas presentes al revisar, no para pedir cambios todavía): la comprobación de `maxTextSize` cuenta comentarios y front matter (documentado); no hay navegación a la línea ni plantillas de `.mmd` vacío (reservadas para FL-MER-002 y FL-MER-006).

## FL-MER-009 · Exportar siempre legible, también desde el tema oscuro

### 1. Historia de usuario

Como persona que usa FreyaLab en modo oscuro, quiero que el PDF, el HTML, el SVG y el PNG de mi diagrama se lean bien en papel y en cualquier pantalla, para no tener que cambiar de tema antes de exportar.

### 2. Problema y evidencia

La vista previa dibuja los diagramas con el tema activo (`diagramSVG(source, dark)` en `Preview.svelte` y `Diagram.svelte`). `Preview.exportHTML()` toma el `innerHTML` ya dibujado (lectura de código), y la página exportada tiene fondo blanco (`documentCSS` en `render.ts`). Medición con **Mermaid 12.2.0 real en Chromium** (mismo diagrama de 5 nodos, mismas opciones que `diagramSVG`), contraste contra blanco:

| Tema | Color del texto | Contraste texto/blanco | Color de las flechas | Contraste flechas/blanco |
|---|---|---|---|---|
| Claro (`default`) | `rgb(51,51,51)` | **12,63:1** | `rgb(51,51,51)` | **12,63:1** |
| Oscuro (`dark`) | `rgb(204,204,204)` | **1,61:1** | `rgb(211,211,211)` | **1,50:1** |

El mínimo WCAG para texto normal es 4,5:1 y para elementos gráficos 3:1. Los nodos oscuros (`rgb(31,32,32)`) dejan el texto interior legible; no lo están las etiquetas y flechas que caen sobre el fondo blanco. **No se ha ejecutado la exportación completa de la aplicación** (la parte «el archivo exportado contiene el SVG oscuro» sale de leer el código); la historia exige comprobarlo.

### 3. Diseño UX/UI

Sin controles nuevos. Regla simple: **toda exportación se genera con el tema claro**, aunque la pantalla esté en oscuro. Una nota en el menú de exportación lo dice: «Se exporta con colores claros para que se lea en papel y en cualquier pantalla». (Si más adelante se pide exportar con el tema actual, será una opción aparte, no el valor por defecto.)

### 4. Criterios de aceptación

- E1. Con la app en tema oscuro, SVG, PNG, PDF y HTML de un diagrama individual usan el tema `default` de Mermaid.
- E2. Con la app en tema oscuro, el PDF y el HTML de un documento Markdown con diagramas los muestran con tema claro.
- E3. La vista en pantalla no cambia ni parpadea durante la exportación; cambiar el tema no invalida el último SVG válido de FL-MER-001.
- E4. Contraste mínimo medido por script en el SVG exportado: texto y flechas ≥ 4,5:1 sobre el fondo de la página exportada.
- E5. Un diagrama inválido sigue bloqueando la exportación (comportamiento de FL-MER-001).

### 5. Casos límite

Documento con muchos diagramas (la caché guarda 64 entradas); mismo diagrama dos veces; tema que cambia a mitad de la exportación; exportación mientras aún se está renderizando; diagramas con `%%{init: {theme:'dark'}}%%` propio (se respeta la intención del autor o se documenta); PNG con fondo transparente frente a blanco.

### 6. Prompt ejecutable para Codex

```text
Tarea: FL-MER-009 · Exportar diagramas siempre con tema claro.

Lee AGENTS.md, CONTRIBUTING.md y docs/stories/2-mermaid-robustez.md (sección FL-MER-009).
Rama codex/mer-009-export-tema-claro desde main actualizado (si #66 ya está fusionado, desde ese main). Sin dependencias nuevas.

Archivos probables: src/renderer/lib/render.ts (diagramSVG), src/renderer/components/Diagram.svelte (exportSVG, exportHTML), src/renderer/components/Preview.svelte (exportHTML), src/main/export.ts (solo si hace falta).

1. Pruebas primero: en tests/e2e, con la app en tema oscuro, exporta un diagrama y un Markdown con diagrama a HTML/SVG y mide el contraste texto/flecha del SVG exportado contra el fondo de la página; debe FALLAR (hoy ~1,6:1). Guarda la salida roja.
2. Implementa lo mínimo: la exportación vuelve a obtener el SVG con diagramSVG(source, false) (la caché ya distingue tema) sin tocar lo que se ve en pantalla. En Markdown, conserva la fuente de cada diagrama sin ponerla en atributos HTML no saneados.
3. Verifica E1–E5 y que la vista en pantalla no cambia.

Comprobaciones: npm run check, npm test, npm run test:e2e, npm run build. Evidencia: docs/evidence/mer-009-<fecha>.md con la medición antes/después y capturas del PDF en oscuro y claro. PR en borrador; no fusionar ni publicar.
```

### 7. Plan de pruebas

Medición automática de contraste en el SVG exportado (script con el DOM del renderer, igual que la medición de esta historia); E2E de exportación con la app en oscuro para diagrama individual y Markdown; regresión de FL-MER-001 (exportación inválida bloqueada); prueba de que la vista no cambia de tema al exportar.

### 8. Criterios de revisión

El rojo es la medición de contraste, no solo «la función se llama»; los cuatro formatos cubiertos; el HTML/PDF de un Markdown mixto probado; sin cambios en lo que se ve en pantalla; sin dependencias.

## FL-MER-008 · «Ajustar a pantalla» que ajuste de verdad

### 1. Historia de usuario

Como persona que revisa un diagrama grande, quiero un botón que lo deje completo dentro del panel, para verlo entero sin buscar el zoom a mano.

### 2. Problema y evidencia

`Diagram.svelte`: «Ajustar» hace `zoom=1` y `scrollTo(0,0)`. El CSS (`.diagram-svg svg{width:100%;height:auto}`, relleno de 45 px y 24 px del lienzo) hace que al 100 % el diagrama **ocupe el ancho** del panel; si es alto (diagrama de secuencia, flujo vertical) sigue sobresaliendo por abajo, y si es muy ancho el texto queda minúsculo sin que el botón lo diga. El audit (`EDITOR-UX-AUDIT.md`) ya anota: «Ajustar» no calcula un encuadre geométrico. El SVG real de la medición tiene `viewBox="4 4 879.88 203.18"` y `width="100%"`, es decir, proporción conocida: se puede calcular el ajuste sin motor nuevo.

### 3. Diseño UX/UI

Barra: `[−] 100% [+]  [Ajustar] [100 %]`. **Ajustar** calcula `min(ancho_disponible/ancho, alto_disponible/alto)` con la proporción del `viewBox` y deja el diagrama completo y centrado. **100 %** vuelve al tamaño natural (hoy «Ajustar» hace algo parecido). Mientras el usuario no cambia el zoom, el modo «ajustado» se mantiene al redimensionar el panel o al cambiar de modo (editar/dividido). Atajos: `Cmd/Ctrl+0` ajustar, `Cmd/Ctrl+1` 100 %, `Cmd/Ctrl+±` zoom.

### 4. Criterios de aceptación

- J1. Con un diagrama alto y uno ancho, «Ajustar» deja el SVG completo dentro del lienzo (sin barras de desplazamiento) y centrado.
- J2. Tras redimensionar el panel en modo ajustado, el diagrama se reajusta; tras un zoom manual deja de reajustarse.
- J3. «100 %» restaura el tamaño natural y el desplazamiento al inicio.
- J4. El porcentaje mostrado coincide con el ajuste real; el zoom mínimo permite diagramas muy grandes.
- J5. Los botones tienen etiqueta accesible y los atajos funcionan con el foco en el panel.

### 5. Casos límite

Diagrama de 1×1 o vacío; `viewBox` ausente; diagrama enorme (cientos de nodos); panel casi cerrado; cambio de tema con el diagrama ajustado; pantalla con escalado alto.

### 6. Prompt ejecutable para Codex

```text
Tarea: FL-MER-008 · «Ajustar a pantalla» geométrico. Lee docs/stories/2-mermaid-robustez.md (FL-MER-008).
Rama codex/mer-008-ajustar-pantalla desde main actualizado. Sin dependencias.
Archivos: src/renderer/components/Diagram.svelte y el CSS .diagram-* de src/renderer/style.css.
1) Pruebas primero (E2E): un flowchart ancho y un sequenceDiagram alto; tras «Ajustar» el SVG debe caber completo en el lienzo. Deben fallar hoy para el alto.
2) Implementa: lee el viewBox del SVG renderizado, calcula el ajuste con el tamaño del lienzo menos el relleno, aplica el zoom resultante; modo «ajustado» persistente hasta un zoom manual; botón «100 %»; atajos.
3) Verifica J1–J5 con capturas 1440×900 y 1280×800 en claro y oscuro.
Comprobaciones: npm run check, npm test, npm run test:e2e, npm run build. Evidencia en docs/evidence/mer-008-<fecha>.md. PR en borrador; no fusionar.
```

### 7. Plan de pruebas

E2E con dos diagramas de proporciones opuestas; medida geométrica (el rectángulo del SVG dentro del rectángulo del lienzo); redimensionado; atajos; accesibilidad por teclado; capturas en dos resoluciones y dos temas.

### 8. Criterios de revisión

La prueba mide geometría real (no un valor de zoom fijo); el modo ajustado no se pierde al cambiar de pestaña; no cambia la caché ni la exportación; el código de zoom/desplazamiento queda en un solo lugar, listo para reutilizarse en FL-MER-010.

## FL-MER-007 · Marcas de error en el editor (CodeMirror)

### 1. Historia de usuario

Como persona que escribe Mermaid, quiero ver en el propio texto qué línea falla, para corregirla sin leer el mensaje técnico ni contar líneas.

### 2. Problema y evidencia

Tras el PR #66 el error se explica en la vista (aviso y línea del analizador), pero el **editor no marca nada**: hay que contar líneas a mano. En un bloque dentro de Markdown la línea es relativa al diagrama, no al documento. `package.json` no incluye `@codemirror/lint`, y hacerlo con `@codemirror/view` (ya instalado: `Decoration`, `gutter`, `GutterMarker`) evita una dependencia.

### 3. Diseño UX/UI

Línea con fondo suave de error y marca en el margen (icono más texto accesible), no solo color. Al poner el cursor en la línea aparece la explicación corta. En un archivo `.mmd` la línea es la del archivo; en Markdown se marca la línea absoluta dentro del bloque ```` ```mermaid ````. Las marcas desaparecen al corregir; el último diagrama válido sigue visible (FL-MER-001).

```text
 1  flowchart LR
 2    A --> B
 3  ⚠ B --> --> C          ← línea marcada
    └ Revisa las flechas: aquí hay dos seguidas.
```

### 4. Criterios de aceptación

- D1. Un error de Mermaid marca la línea correcta del `.mmd` en el editor.
- D2. En Markdown, el error de un bloque marca la línea correcta del documento (línea de apertura del bloque + línea relativa). Con dos bloques, cada marca va a su bloque.
- D3. Las marcas se actualizan al escribir (con el mismo retardo de 150 ms) y desaparecen al corregir; no quedan marcas de generaciones antiguas.
- D4. La marca es perceptible sin color (icono y texto accesible) y mantiene contraste ≥ 3:1 en claro y oscuro.
- D5. Sin dependencias nuevas; el texto del usuario no cambia; deshacer/rehacer no se ven afectados.
- D6. Si el analizador no da línea, no se inventa: solo aviso general, como en FL-MER-001.

### 5. Casos límite

Documento editado mientras se renderiza; línea fuera de rango tras borrar texto; bloque Mermaid dentro de una lista o cita; fence con más de tres acentos graves; CRLF; modo «Vista previa» (no hay editor visible); varios errores a la vez; el límite de 50 000 caracteres de `maxTextSize`.

### 6. Prompt ejecutable para Codex

```text
Tarea: FL-MER-007 · Marcas de error de Mermaid en CodeMirror. REQUISITO: el PR #66 (FL-MER-001) debe estar fusionado; parte de ese main.
Lee docs/stories/2-mermaid-robustez.md (FL-MER-007) y src/renderer/lib/diagram-errors.ts. Rama codex/mer-007-marcas-editor. Sin dependencias (usa @codemirror/view: Decoration, gutter, GutterMarker, StateField).
1) Pruebas primero: unitaria del cálculo de línea absoluta (bloque Markdown → línea del documento) y E2E que escribe un error en .mmd y en un bloque de Markdown y comprueba la línea marcada. Deben fallar hoy.
2) Implementa: un StateField con las marcas, alimentado desde el resultado de render (Preview/Diagram → App → Editor) con el número de generación; sin acoplar Editor a Mermaid.
3) Verifica D1–D6, con capturas en claro/oscuro a 1440×900.
Comprobaciones: npm run check, npm test, npm run test:e2e, npm run build. Evidencia: docs/evidence/mer-007-<fecha>.md. PR en borrador; no fusionar. Si necesitas @codemirror/lint, DETENTE y pide aprobación.
```

### 7. Plan de pruebas

Unitarias del mapeo de líneas (CRLF, bloque en lista, varios bloques); E2E de marca y de desaparición; prueba de que una generación antigua no deja marcas; contraste de la marca medido; regresión de deshacer/rehacer y de FL-MER-001.

### 8. Criterios de revisión

La línea absoluta es correcta en los casos límite; no hay estado duplicado entre Preview y Editor sin dueño claro; no se duplica el traductor de #66; sin dependencias; ninguna marca sobrevive a su causa. Relación con FL-MER-006 (navegación a la línea): reutilizar el mismo cálculo, no crear otro.

## FL-MER-010 · Vista ampliada de un diagrama

### 1. Historia de usuario

Como lector de un documento con diagramas, quiero abrir un diagrama en grande, con zoom y desplazamiento, para leer las etiquetas pequeñas sin salir del documento.

### 2. Problema y evidencia

En la vista previa de Markdown el diagrama se dibuja dentro de `.mermaid-render` (desplazable, sin zoom ni ampliación). Solo los archivos `.mmd` tienen el visor con zoom de `Diagram.svelte`. El prompt de producto del concepto de render (documento del propietario, fuera de este repositorio) pide «vista del diagrama a pantalla amplia».

### 3. Diseño UX/UI

Un diagrama de la vista previa muestra, al pasar el ratón o recibir foco, el botón `⤢ Ampliar`. Se abre un diálogo modal a pantalla casi completa con el visor de zoom y desplazamiento de FL-MER-008, `Esc` cierra y devuelve el foco al diagrama de origen. No edita; para editar se vuelve al texto.

### 4. Criterios de aceptación

- V1. Cada diagrama válido de la vista previa ofrece «Ampliar»; los bloques con error no.
- V2. El diálogo es modal (`role=dialog`, `aria-modal`, foco atrapado), se cierra con `Esc` y con un botón, y devuelve el foco.
- V3. Reutiliza el componente de zoom/ajuste de FL-MER-008, sin duplicar lógica.
- V4. Respeta el tema; cambiar de tema con el diálogo abierto no lo rompe.
- V5. Funciona con varios diagramas y con diagramas grandes; no bloquea la edición cuando está cerrado.

### 5. Casos límite

Documento que cambia mientras el diálogo está abierto (el diagrama se actualiza o se avisa); cierre de pestaña; tecla `Esc` dentro de otros diálogos; pantalla pequeña; lector de pantalla (nombre accesible con el tipo de diagrama); impresión con el diálogo abierto.

### 6. Prompt ejecutable para Codex

```text
Tarea: FL-MER-010 · Vista ampliada. REQUISITO: FL-MER-008 fusionada (reutiliza su visor).
Lee docs/stories/2-mermaid-robustez.md (FL-MER-010). Rama codex/mer-010-vista-ampliada. Sin dependencias.
1) Pruebas primero: E2E que abre un Markdown con 2 diagramas, pulsa Ampliar, comprueba foco, Esc, tema y que un bloque con error no ofrece el botón. Deben fallar hoy.
2) Implementa un diálogo que reutilice el visor de FL-MER-008; no dupliques el código de zoom.
3) Verifica V1–V5 con capturas 1440×900 en claro y oscuro.
Comprobaciones: npm run check, npm test, npm run test:e2e, npm run build. Evidencia: docs/evidence/mer-010-<fecha>.md. PR en borrador; no fusionar.
```

### 7. Plan de pruebas

E2E de apertura, cierre, foco y teclado; cambio de tema abierto; varios diagramas; bloque con error; prueba de accesibilidad básica (roles y nombre); regresión de FL-MER-008.

### 8. Criterios de revisión

Una sola implementación de zoom; foco atrapado y restaurado; ningún estado queda tras cerrar (sin fugas del SVG ampliado); sin cambios en la exportación.
