# Historia 13 — Editor base para los cuatro formatos (md, txt, mmd, csv texto)

Diseño: Claude. Implementa: Codex. Decide y fusiona: el propietario.
Decisión del propietario (2026-11-05): el editor cubre SOLO `md/markdown`, `txt`, `mmd/mermaid` y `csv/tsv` (vista Texto). No se abren otros tipos de archivo en esta historia.

## Historia
Como persona que edita notas, diagramas y datos, quiero las funciones básicas de un editor de texto (como Sublime Text o Notepad++) iguales en los cuatro formatos, para no depender de otro programa.

## Evidencia (app real, `main` 97eca42, sondeo con un `.txt`; los scripts están fuera del repo)
Ya funcionan: buscar y reemplazar (⌘F), ir a línea, mover línea (Alt+↑/↓), duplicar (Mayús+Alt+↓), borrar línea (⌘⇧K), sangrar con ⌘], deshacer, pestañas, mostrar espacios, ajuste de línea.
Faltan o no funcionan en `.txt`:
- Multicursor: Alt+clic y ⌘D no añaden cursores (`EditorState.allowMultipleSelections` solo está activo en Markdown y CSV Texto: `markdown-editing.ts:7`, `csv-text-model.ts:81`).
- Cierre automático de paréntesis y comillas; resaltado de pares; comentar con ⌘/ (en `.txt` no aplica; en Markdown sería `<!-- -->`, en Mermaid `%%`).
- Tab no sangra (es lo accesible por defecto: debe ser un ajuste, con Esc para salir del editor).
- Barra de estado sin Ln/Col, sin selección (n líneas/caracteres), sin fin de línea (LF/CRLF), sin sangría.
- Paleta de comandos, abrir rápido, buscar en la carpeta, ajustes y atajos editables: no existen.
- Zoom del texto con ⌘+: sin efecto en el sondeo (13 px → 13 px); comprobar si solo está en el menú.
- **Codificación**: un `.txt` en Latin-1 o UTF-16 se rechaza con «Este documento no es UTF-8 válido. Convierte su codificación antes de editarlo.» Es seguro (no corrompe) pero un editor básico debe abrirlo. UTF-8 con BOM abre; hay que verificar que guardar conserve el BOM.

## Entrega en 4 PR pequeños (pruebas fallan primero; sin dependencias nuevas, salvo declarar como directas las `@codemirror/*` ya usadas si hiciera falta)
### H13-1 Ediciones de oficio
- Multicursor en los cuatro formatos (Alt+clic, ⌘D, ⌘⇧L, ⌃⌥↑/↓), sin romper la sesión de Markdown ni las reglas de CSV Texto (límite de columnas/líneas).
- `closeBrackets`, `bracketMatching`, comentar (⌘/) con la sintaxis de cada formato; en `txt` y CSV texto no hay comentario (el atajo no hace nada y no falla).
- Ajuste «Tab sangra» (desactivado por defecto; con Esc o ⇧Tab se sale), longitud de sangría 2/4/tabulación.
- Aceptación: pruebas unitarias del estado del editor por formato + una E2E real por cada función; IME y CRLF intactos; solo lectura sin cambios.
### H13-2 Barra de estado y codificación
- Barra de estado: Ln/Col, selección («3 líneas, 41 caracteres»), fin de línea (LF/CRLF, clic para cambiar y guardar), sangría, codificación, formato.
- Codificación en `txt`, `md` y `mmd`: detección (BOM UTF-8/UTF-16, UTF-8 válido, si no sugiere Windows-1252/Latin-1 y pide confirmación), «Reabrir con codificación…», «Guardar con codificación…» (lo que hoy hace CSV). Nunca guardar en otra codificación sin avisar; conservar el BOM si el original lo tenía; el archivo no cambia hasta guardar.
- Aceptación: fixtures Latin-1, UTF-16 LE/BE, UTF-8 con y sin BOM, CRLF y LF mixto; ida y vuelta byte a byte cuando no se editó nada; mensajes en es/en y en-XA.
### H13-3 Paleta de comandos y ajustes
- Paleta (⌘⇧P) sobre los comandos que ya define `application-menu.ts`; búsqueda difusa; muestra el atajo; solo lista comandos admitidos en el contexto actual (con motivo si no).
- Panel de ajustes: tamaño de letra (y zoom ⌘+/⌘−/⌘0 persistente), sangría, Tab, ajuste de línea, mostrar espacios, fin de línea por defecto, tema. Un solo almacén local, con esquema y valores por defecto.
- Atajos editables: lista con conflictos detectados y restauración. No incluir importación de atajos de otros programas.
- Aceptación: accesible (diálogo con nombre, teclado completo, anuncio de la acción ejecutada), en-XA, forced-colors, movimiento reducido.
### H13-4 Abrir rápido y buscar en carpeta
- ⌘P abre un archivo del explorador por nombre (solo los 4 formatos).
- Buscar en carpeta (texto literal y regex) sobre los 4 formatos, con resultados por archivo y línea, cancelable, con límite y progreso. Reemplazar en carpeta SOLO con vista previa de cambios y confirmación, y deshacible por archivo (copia de recuperación existente).
- Aceptación: nunca sigue enlaces simbólicos fuera de la carpeta; no lee archivos binarios ni de más del límite; medir con 2.000 archivos.

## Fuera de alcance (explícito)
Notas enriquecidas (Keep/Apple Notes), Jupyter, Python, complementos, resaltado de más lenguajes, vista en vivo de Markdown (E3 de la historia anterior) y panel de herramientas (Historia 12).

## Gancho para complementos (solo diseño, sin código)
Ajustes, atajos y, después, el catálogo de la Historia 12 se guardan como datos con esquema versionado en una carpeta local. Así los «complementos declarativos» (fragmentos, plantillas, colores, atajos) serán un cambio pequeño, sin ejecutar código de terceros.
