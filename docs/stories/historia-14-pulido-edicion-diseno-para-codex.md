# Historia 14 — Pulido de edición (barra adaptable, Mermaid cómodo, volver donde lo dejé)

Diseño: Claude. Implementa: Codex. Decide y fusiona: el propietario.
Alcance fijado por el propietario: solo `md`, `txt`, `mmd`, `csv` (vista Texto). Sin Python, `.ipynb` ni notas tipo Keep.
Va después de E2 (#117) y H13-1; no depende de H12.

## Historia
Como persona que edita en una ventana de tamaño normal, quiero que todas las herramientas sigan al alcance, que los diagramas Mermaid se lean y se corrijan con comodidad y que la app me devuelva a lo que tenía abierto.

## Evidencia (app real, macOS arm64, `main` 97eca42; los sondeos están fuera del repo)
- **Barra de Markdown cortada.** Con el documento abierto, medí qué botones quedan dentro de `.document-tools`: a 1280 px todos; a **1100 px Buscar e Índice quedan cortados**; a 900 px también Tabla y Mermaid; a 800 px también Tarea. Causa: `.document-tools:has(.markdown-toolbar){height:43px;flex-wrap:nowrap}` (`style.css:65`) y `.markdown-toolbar{flex-wrap:nowrap}` en `MarkdownToolbar.svelte`; no hay menú de desbordamiento. La página no desborda, pero los botones son inalcanzables.
- **Mermaid sin resaltado.** El editor de `.mmd` y de los bloques ```` ```mermaid ```` no tiene lenguaje: 0 colores distintos en los `span` del código. `Editor.svelte` solo añade `markdown()` para `kind==='markdown'`. El plegado (`foldGutter`) solo existe en Markdown (`markdown-editing.ts`).
- **Errores de Mermaid**: el mensaje es claro («Falta completar el diagrama. Revisa la línea 5…») y se conserva la última versión válida. No comprobé si «línea 5» es clicable.
- **Sin restauración de sesión.** Tras un cierre normal (`app.quit()`) y relanzamiento con el mismo perfil no volvieron las pestañas. Los recientes existen en el menú Archivo (`application-menu.ts`, submenú `recent`), no en la pantalla de inicio.
- Ya está bien y no se toca: aviso de cambio externo (Recargar / Guardar copia / Conservar mi edición) y copias de recuperación (`documents.ts`).

## H14-1 Barra adaptable (PR propio, primero)
- Acción prioritaria visible: formato inline (B, I, código, tachado) y el selector de bloque. Lo demás pasa a un menú «Más» (⋯) cuando no cabe: Tarea, Tabla, Mermaid, Insertar y, en último lugar, Buscar e Índice.
- Regla de desbordamiento: se calcula por ancho disponible (ResizeObserver), sin saltos de línea que cambien la altura de 43 px; el orden de colapso es fijo y documentado. Nada desaparece sin una vía de acceso.
- El menú «Más» es un `menu` accesible: botón con nombre, flechas, Esc cierra y devuelve el foco; conserva `aria-pressed` y los motivos de «solo lectura».
- Sin duplicar botones: lo que está en «Más» no se repite en la barra.
- Aplica a la barra de Markdown; revisar y arreglar la de `mmd`, `txt` y CSV Texto si miden mal con el mismo sondeo (informar, sin ampliar alcance).
- Aceptación (prueba roja primero): para 1280, 1100, 1000, 900, 800 y 700 px, cada acción es alcanzable (visible o dentro de «Más»); ningún botón queda cortado; el área de clic ≥ 24 px; sin desbordamiento horizontal; en-XA (pseudolocale) no rompe; `forced-colors` y movimiento reducido.

## H14-2 Mermaid cómodo (PR propio)
- **Resaltado**: lenguaje ligero con `StreamLanguage` (sin dependencias) para tipos de diagrama, palabras clave por tipo, flechas y operadores, texto entre `[] () {} ""`, comentarios `%%` y directivas `%%{init}%%`. Un solo tokenizador compartido por `.mmd` y las vallas ```` ```mermaid ```` de Markdown (anidado en el árbol de Markdown). Colores con tokens del tema (claro, oscuro, forzados), contraste ≥ 4,5:1.
- **Plegado**: por bloques (`subgraph … end`, `section`, `loop/alt/opt/par … end`, llaves `{ }` de `class`/`state`/`erDiagram`), con el mismo gutter y atajos que Markdown.
- **Clic en el error**: el aviso es un botón «Ir a la línea 5» que mueve el cursor, desplaza y subraya la línea; la línea se resalta hasta que se edita.
- Sin tocar el render, la exportación, el diagnóstico ni el modo seguro.
- Aceptación: la prueba roja mide tokens/colores distintos en un `.mmd` y en una valla; plegar y desplegar no altera el archivo ni su `hash`; el clic en el error funciona en `.mmd` y en la valla dentro de Markdown; archivos de 5.000 líneas sin lentitud medible (informar tiempos); IME y CRLF intactos; solo lectura sin cambios.

## H14-3 Volver donde lo dejé (PR propio)
- Al cerrar normalmente, guardar la lista de pestañas (rutas canónicas), la activa, y por documento: modo (Editar/Dividido/Vista previa), posición del cursor y desplazamiento. Al abrir, restaurar solo lo que existe y es accesible; si falta un archivo, un aviso breve («No se encontró X») y se sigue.
- Con cambios sin guardar: la restauración usa la recuperación existente (no inventa una segunda); el usuario decide como hoy.
- Ajuste «Reabrir lo último al iniciar» (activado por defecto; desactivable en ajustes/H13-3). Un botón «Abrir último» en la pantalla de inicio, y los recientes visibles allí (los del menú).
- Privacidad: el archivo de sesión vive en el perfil local, solo rutas y posiciones, sin contenido; se borra con «Borrar recientes».
- Aceptación: prueba roja (E2E: abrir tres archivos, cerrar normal, relanzar con el mismo perfil, comprobar pestañas, activa, cursor y modo); archivo movido o borrado entre sesiones; perfil nuevo no restaura nada; cierre forzado no corrompe el archivo de sesión (escritura atómica); no restaura documentos solo lectura como editables.

## Reglas comunes
Sin dependencias nuevas (ADR 0021; responde las 7 preguntas en cada PR). Una historia por PR, en borrador, base `main`, pruebas rojas primero. Textos en es/en/en-XA. Accesible (teclado completo, nombres, anuncios). Informa head, qué verificaste y qué no.

## Fuera de alcance
Clic de nodo a línea y renombrado de nodos (otra historia), plegado fuera de Mermaid, panel de herramientas (Historia 12), paleta de comandos (H13-3), corrector ortográfico, comparar archivos.
