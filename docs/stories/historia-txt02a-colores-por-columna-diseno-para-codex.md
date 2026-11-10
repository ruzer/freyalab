# TXT-02a — Colores por columna en la vista Texto del CSV

Parte de TXT-02 (`docs/stories/7-csv-texto.md`, hoy «Esbozada»). Esta entrega cubre solo los colores por columna, el resaltado de la columna actual y la columna en la barra de estado. El resto de TXT-02 (errores con línea y columna, «Interpretar con otro separador», «Convertir separador…») sigue pendiente. La alineación visual pasa a TXT-02b y se decide después de probar esta.

## Historia
Como persona que revisa o corrige un CSV en modo Texto, quiero distinguir de un vistazo a qué columna pertenece cada valor y saber en qué columna está el cursor, para editar sin contar comas y sin cambiar el archivo.

## Evidencia (main 3a2404a)
- La vista Texto del CSV usa `Editor.svelte` con `kind='csv-text'`. No tiene resaltado: todo el texto sale del mismo color (captura del propietario, `Etiquetas_CGSI_2026-10-07.csv`, 7 columnas entrecomilladas).
- Buscar ya existe: botón «Buscar» en la barra de la vista, Cmd+F, panel con reemplazar, expresiones regulares, mayúsculas y palabra completa, traducido (`csvText.cm.*`). «Ir a línea» está en «Opciones». También hay selección múltiple y deshacer. **No hay que añadir búsqueda.**
- `DocumentInfo` ya trae `delimiter` y `headers`. El editor guarda el texto con LF y los finales reales en `csvLineEndings`, así que el resaltado ve líneas normales.
- Límite de la vista Texto: 10 MiB (`src/main/documents.ts`).

## Diseño UX
**Colores.** El texto de cada campo toma el color de su columna. Las columnas pasan por 6 colores en este orden y la 7.ª vuelve al primero. Los separadores y las comillas que encierran un campo se muestran en `--muted`. Una comilla escapada (`""`) dentro del campo conserva el color del campo. La primera línea va en peso 500 cuando el documento tiene encabezado. Un campo entrecomillado que ocupa varias líneas conserva su color en todas ellas.

| Columna (módulo 6) | Claro | Oscuro |
|---|---|---|
| 1 | `#1d4ed8` | `#93c5fd` |
| 2 | `#92400e` | `#fbbf24` |
| 3 | `#166534` | `#4ade80` |
| 4 | `#7e22ce` | `#d8b4fe` |
| 5 | `#be123c` | `#fda4af` |
| 6 | `#115e59` | `#5eead4` |

Contraste medido (WCAG): todos ≥ 4,5:1 sobre `--bg`, sobre la línea activa y sobre el tinte de columna, en los dos temas. Sobre la selección en tema claro, el azul (4,33) y el rojo (4,06) quedan por encima de 3:1. Defínelos como variables CSS por tema, no como valores sueltos en el código.

**Columna actual.** Los campos de la columna donde está el cursor principal llevan un tinte de fondo suave en las líneas visibles (claro: acento al 8 %; oscuro: acento al 14 %). Así se sigue una columna aunque las filas no estén alineadas.

**Barra de estado.** Después de «Lín, Col» aparece «Columna 4 de 7 · MarcaModelo» (lector de pantalla: «Columna 4 de 7, MarcaModelo»). El nombre sale del primer registro del texto actual si hay encabezado, para que siga bien si se edita la línea 1. Sin encabezado: «Columna 4 de 7». Si la fila tiene más campos que el encabezado: «Columna 9 · sin encabezado». Se muestra siempre, aunque los colores estén apagados: así el color nunca es la única pista.

**Opción.** En «Opciones», «Colores por columna», encendida al empezar. Apaga a la vez los colores y el tinte, y se recuerda como ajuste general (no se reinicia como «Ajustar línea»).

**Nada de esto cambia los bytes.** Solo son decoraciones. Guardar sin editar deja el archivo idéntico.

## Contrato técnico
- Usa `StreamLanguage` de `@codemirror/language` (ya instalado) con estado `{columna, dentroDeComillas}` que pasa de una línea a la siguiente, y un `HighlightStyle` con una etiqueta por color. **Sin dependencias nuevas.** El análisis es incremental y solo pinta lo visible, que es lo que hace falta hasta 10 MiB.
- El separador viene de `doc.delimiter` (coma, punto y coma, tabulador). Pásalo al `Editor` como prop. Si el separador cambia, se reconfigura con un `Compartment`.
- El tinte de la columna actual es un `ViewPlugin` con decoraciones solo en `view.visibleRanges`, recalculado al mover la selección.
- Solo en `kind==='csv-text'`. Markdown, TXT y Mermaid no cambian.

## Aceptación
1. Con el archivo de la captura, cada columna sale con su color, los separadores y comillas atenuados y la línea 1 en peso 500. Pasa en los dos temas.
2. Al mover el cursor a «MarcaModelo», la barra dice «Columna 4 de 7 · MarcaModelo» y esa columna lleva tinte en las líneas visibles.
3. `"a, b"` es un solo campo; `"di ""hola"""` también; un campo con salto de línea dentro conserva el color en la línea siguiente y la columna siguiente sigue la secuencia.
4. Funciona con TSV y con punto y coma.
5. Editar la línea 1 cambia el nombre de la barra sin recargar.
6. Apagar «Colores por columna» quita colores y tinte, deja la columna en la barra y se recuerda tras reiniciar.
7. Abrir, mover el cursor y guardar deja los bytes idénticos (hash), con CRLF y con BOM.
8. Un archivo de 10 MiB con 200 columnas se desplaza y se edita sin bloqueos visibles. Mide y anota: tiempo de apertura antes y después, y una pulsación en mitad del archivo.

## Casos límite
- Comilla sin cerrar: desde ahí todo queda como un solo campo. Es aceptable, porque señala el error. No intentes repararlo; los errores con posición son de otra parte de TXT-02.
- Una sola línea enorme (1 MiB sin saltos): no debe congelar la ventana. Si el analizador tarda, deja de pintar esa línea en vez de bloquear, y anótalo como `shortcut:`.
- Filas con distinto número de campos: los colores siguen el índice real del campo.
- Separador dentro de un campo sin comillas mal formado: se pinta como separador; es lo que leerá la tabla.
- Solo lectura, con codificación pendiente: los colores se ven igual.

## Plan de pruebas
- Unitarias del analizador: comillas, comillas escapadas, multilínea, TSV, punto y coma, CRLF (LF interno), fila vacía, campo vacío `""`.
- E2E (`tests/e2e/csv-text.spec.ts`): criterios 1, 2, 5 y 6 con colores leídos con `getComputedStyle`; criterio 7 con hash; captura en los dos temas a 1440×900.
- Rojo primero: la E2E de colores falla en main.

## Fuera de alcance
- Alineación visual de columnas (TXT-02b), solo después de probar esta y sin tocar bytes.
- Buscar solo dentro de una columna, seleccionar una columna entera, errores CSV con posición y conversión de separador.
- Cambiar la búsqueda actual: ya cumple.

## Entrega
Rama nueva desde main, PR en borrador, una sola entrega. Pega en el PR: capturas en claro y oscuro, el contraste medido con los colores finales y la medición del criterio 8.
