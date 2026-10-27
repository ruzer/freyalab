# Iteración 7 · Vistas Tabla y Texto del CSV

Objetivo (decisión del propietario, 2026-10-27): que un CSV o TSV se pueda trabajar **como tabla** (edición de celdas, filtros, estadísticas, gráficos y análisis) y **como texto** (edición directa, buscar, reemplazar, expresiones regulares y manipulación de delimitadores), con la preferencia recordada. Principio de arquitectura: **un solo documento y ningún dato perdido al cambiar de vista**; los dos modos no editan a la vez.

Referencias consultadas: Rainbow CSV (MIT) colorea columnas por delimitador y alinea de forma virtual; Advanced CSV de Sublime alinea **rellenando con espacios**, es decir, cambia los bytes (no se adopta); VS Code desactiva las funciones de Rainbow CSV por encima de 50 MB y, según la comunidad de Notepad++, su tope de unos 2 GiB viene de Scintilla. Para archivos muy grandes existen herramientas dedicadas (Modern CSV, EmEditor, Delimit) con modos propios, según sus fichas (afirmaciones de los fabricantes que no verifiqué).

| ID | Contenido | Depende de | Tamaño | Estado |
|---|---|---|---|---|
| **TXT-01** | Abrir como Tabla o como Texto, texto editable, recuerdo, salida de emergencia para CSV mal formados | — | S a M | **Lista** (abajo) |
| TXT-02 | Resaltado de columnas por delimitador (decoraciones, sin tocar bytes), errores CSV con línea y columna, «Interpretar con otro separador» (no cambia los bytes) y «Convertir separador…» (vista previa, un paso de deshacer, respeta comillas y campos multilínea), preferencia general de vista | TXT-01 | M | Esbozada |
| TXT-03 | Conservar los cambios pendientes al cambiar de vista (un documento, dos representaciones) | **L3** (guardado que conserva los bytes) | M a H | Esbozada |
| TXT-04 | Vista dividida, sin edición simultánea, con correspondencia registro↔línea física | TXT-03 | H | Esbozada |
| TXT-05 | Texto paginado de solo lectura para archivos grandes, con índice de líneas físicas y búsqueda en flujo | L2 | H | Esbozada |

Un registro CSV puede ocupar varias líneas físicas (campos entrecomillados con saltos de línea), de modo que el índice de registros de L2 **no** sirve para localizar líneas de texto: TXT-04 y TXT-05 necesitan un índice de líneas propio. Con L3 existente, la capa de cambios aplicada sobre los bytes originales permitirá que TXT-03 no reserialice el archivo.

## TXT-01 · Abrir un CSV como tabla o como texto

### 1. Historia de usuario

Como persona que trabaja con archivos CSV y TSV, quiero elegir si abro un archivo como tabla o como texto y poder cambiar entre ambos, para ver y editar el archivo exactamente como está, buscar y reemplazar con expresiones regulares, y corregir los CSV mal formados que la tabla no puede abrir.

### 2. Problema y evidencia

Medido el 2026-10-27 sobre `main` en `6362e2d` con la aplicación y el motor reales (Apple M2 Max, macOS, Electron 44; una corrida por caso):

- **Hoy no existe el modo texto para un CSV.** El tipo de documento sale solo de la extensión (`.csv` y `.tsv` son tabla, `.txt` es texto) y `Documents.open` guarda **un documento por ruta**: abrir el mismo archivo otra vez devuelve el que ya está abierto.
- **La tabla se niega a abrir CSV mal formados, sin salida.** Tres casos clásicos fallan con error y el documento no se abre:

| Archivo | Resultado de la tabla |
|---|---|
| Comilla sin cerrar (`1,"abc` …) | `Quote Not Closed … at line 4`: la línea es la **del final del archivo**, no donde se abrió la comilla |
| Comilla suelta en un campo sin comillas (`1,5" de largo`) | `Invalid Opening Quote … field 1 at line 2` |
| Texto tras la comilla de cierre (`"abc"def`) | `Invalid Closing Quote: got "d" at line 2 …` |

  Filas con distinto número de columnas, en cambio, sí se abren.
- **La tabla reescribe al guardar solo las comillas innecesarias.** Probé siete construcciones: comillas dobles escapadas, saltos de línea mezclados (LF y CRLF), filas irregulares, espacios y campos vacíos, coma final y BOM se guardan idénticos; `"001","Ana"` se guarda como `001,Ana`. Con la muestra del propietario (`00123`, un campo entrecomillado con salto de línea y acento, `9007199254740993`) la tabla conserva todo; el modo texto lo conserva por construcción en todos los casos.
- **Codificaciones:** la tabla detecta UTF-8 estricto y, si no lo es, Windows-1252 (y UTF-16 LE con BOM). El camino de texto actual **rechaza** todo lo que no sea UTF-8 con «Este documento no es UTF-8 válido». `iconv-lite` ya es una dependencia, así que el modo texto puede soportar las mismas codificaciones sin librerías nuevas.
- **Coste:** abrir el mismo CSV como texto es unas dos veces más rápido y usa dos o tres veces menos memoria que como tabla:

| Tamaño | Tabla: abre / memoria extra | Texto: abre / memoria extra |
|---:|---:|---:|
| 2 MiB | 468 ms / +139 MiB | 151 ms / +46 MiB |
| 5 MiB | 574 ms / +169 MiB | 232 ms / +82 MiB |
| 9 MiB | 708 ms / +227 MiB | 347 ms / +114 MiB |

- **El editor ya trae lo necesario.** CodeMirror 6 está integrado (`@codemirror/view` 6.43.15, `@codemirror/search` 6.7.2) y exporta buscar y reemplazar con expresiones regulares, `gotoLine`, `highlightWhitespace` y `lineWrapping`: no hace falta ninguna dependencia nueva.
- **Límite del texto actual:** un archivo de más de 10 MiB se abre como una muestra de solo lectura de su primer MiB.

### 3. Diseño UX/UI

**Dos modos del mismo documento, uno a la vez.** Un archivo es un documento y una pestaña. Cambiar de modo **reabre el archivo desde el disco en el otro modo**; así los dos modelos nunca se desfasan y el modo texto reutiliza el camino ya probado de guardado atómico, recuperación y detección de cambios externos de `.txt`.

**Elegir.**
- Clic derecho sobre un `.csv` o `.tsv` del explorador: «Abrir como tabla» y «Abrir como texto». Doble clic o «Abrir» usan el modo recordado para ese archivo, o Tabla si no hay ninguno.
- En la barra del documento, un conmutador `[▦ Tabla] [≡ Texto]` con el estilo del selector Editar/Dividido/Vista previa de Markdown.

```text
ventas.csv                        [▦ Tabla] [≡ Texto]
┌───────────────────────────────────────────────────┐
│ id,nombre,importe                                 │
│ 00123,"Ana",1500.50                               │
│ 9007199254740993,"Luis","dos                      │
│ líneas"                                           │
└───────────────────────────────────────────────────┘
UTF-8 · LF · 3 líneas
```

**Modo Texto.** Editor CodeMirror con números de línea, buscar y reemplazar (panel nativo con expresiones regulares, mayúsculas y palabra entera), ir a línea, resaltado de coincidencias, selección múltiple, deshacer y rehacer, ajuste de línea y mostrar espacios y tabuladores (ambos alternables y apagados al empezar, porque un CSV suele tener líneas muy largas). La barra de estado muestra codificación, saltos de línea (LF, CRLF o mixto) y número de líneas. Las funciones propias de la tabla (analizar, gráficos, SQL, filtros por columna) no aparecen; su ayuda dice «Disponible en modo Tabla».

**Cambiar con cambios pendientes.** Aparece un diálogo con tres botones: «Guardar y cambiar», «Descartar cambios y cambiar» y «Cancelar» (Escape cancela). El historial de deshacer es independiente en cada modo y se reinicia al cambiar (conservarlo es TXT-03).

**Salida de emergencia.** Si la tabla no puede abrir el CSV, el aviso conserva el mensaje con su línea y añade **«Abrir como texto»**: abre el mismo archivo en modo Texto con el cursor y la línea resaltados en la indicada. El aviso aclara que el error se detecta en esa línea y que la causa (por ejemplo, una comilla sin cerrar) puede estar antes.

**Recuerdo.** El último modo elegido por archivo se guarda en `userData` (ruta canónica → modo), sin contenido, como `recents.json`. Una preferencia general de vista queda para TXT-02.

**Límites que se dicen en la interfaz.** El modo Texto edita hasta 10 MiB; por encima, su botón queda deshabilitado con «El modo Texto admite hasta 10 MiB. Usa la tabla» y la tabla se comporta como hoy.

### 4. Criterios de aceptación

**A · Elegir y recordar**
- X1. Clic derecho sobre `.csv` y `.tsv` en el explorador ofrece «Abrir como tabla» y «Abrir como texto»; doble clic y «Abrir» usan el modo recordado o Tabla.
- X2. La barra del documento tiene el conmutador `Tabla | Texto`, accesible (grupo con nombre, estado seleccionado anunciado, operable con teclado).
- X3. **Un archivo = un documento = una pestaña.** Abrir como texto un archivo ya abierto como tabla cambia el modo de ese documento (con el aviso de cambios pendientes de X15) y no crea otro.
- X4. El modo se recuerda por archivo en `userData`, con un máximo de 500 entradas (se descarta la más antigua), escritura atómica y lectura tolerante: ausente o dañado equivale a Tabla. No guarda contenido.
- X5. Si la ruta recordada ya no existe o el archivo supera 10 MiB, se usa Tabla sin error.
- X6. Etiquetas en español; el cambio de modo se anuncia.

**B · Modo Texto**
- X7. CodeMirror 6 con números de línea, buscar y reemplazar con expresiones regulares, ir a línea, resaltado de coincidencias, selección múltiple, deshacer y rehacer, ajuste de línea y mostrar espacios y tabuladores (los dos últimos apagados por defecto).
- X8. **Sin editar, lo guardado es idéntico byte a byte a lo abierto; al editar, solo cambia lo editado.** Se prueba con la muestra `00123⇥"á⏎ñ"⏎9007199254740993⇥conservar` (LF y CRLF, con y sin salto final), saltos de línea mezclados, BOM y `"001","Ana"` (las comillas se conservan).
- X9. Codificación: UTF-8 con o sin BOM, UTF-16 LE con BOM y Windows-1252, con la **misma detección que la tabla** y con `iconv-lite`. Se guarda con la misma codificación y el mismo BOM.
- X10. Si decodificar y volver a codificar no reproduce los bytes originales, el documento se abre **en solo lectura con aviso**; jamás se escribe un reemplazo de caracteres.
- X11. Guardar un carácter que la codificación del archivo no puede representar se rechaza con un error que indica la línea, y no se escribe nada.
- X12. La barra de estado muestra codificación, saltos de línea (LF, CRLF o mixto) y número de líneas.
- X13. Hasta 10 MiB es editable; por encima, el conmutador a Texto y «Abrir como texto» están deshabilitados con la ayuda del diseño (la tabla no cambia).
- X14. Las funciones exclusivas de la tabla no aparecen en modo Texto y su ayuda dice «Disponible en modo Tabla».

**C · Cambiar de modo**
- X15. Cambiar de modo reabre el archivo desde el disco. Con cambios pendientes aparece «Guardar y cambiar», «Descartar cambios y cambiar» o «Cancelar»; **nunca se pierde un cambio sin esa elección**.
- X16. «Guardar y cambiar» usa el guardado del modo actual (el de la tabla normaliza comillas innecesarias, como hoy; el de texto es exacto). Si el guardado falla, no se cambia de modo.
- X17. La recuperación tras un cierre inesperado funciona en modo Texto igual que para `.txt` y recupera el documento en ese modo.
- X18. El historial de deshacer es independiente en cada modo y se reinicia al cambiar.

**D · Salida de emergencia**
- X19. Cuando la tabla no puede abrir un CSV por un error de formato, el aviso conserva su mensaje y añade «Abrir como texto»; al pulsarlo el documento se abre en modo Texto con el cursor y la línea resaltados en la indicada.
- X20. El aviso explica que la causa puede estar antes de la línea indicada. Los tres CSV mal formados de la sección 2 se abren como texto, se corrigen, se guardan y se reabren como tabla (prueba de extremo a extremo).

**Transversales**
- X21. Sin dependencias nuevas (`iconv-lite` y CodeMirror ya están). Si hace falta una, se detiene y se informa.
- X22. El texto del archivo no cambia al abrir, al cambiar de modo ni al cerrar sin guardar.
- X23. No se modifica `TableEngine`; el modo texto reutiliza el camino de guardado atómico, recuperación y detección de cambios externos existente.

### 5. Casos límite

Saltos de línea mezclados; BOM con CRLF; solo encabezado; archivo vacío; archivo de exactamente 10 MiB (10.485.760 bytes) y de 10 MiB + 1; UTF-16 LE grande; Windows-1252 con los bytes 0x81, 0x8D, 0x8F, 0x90 y 0x9D; TSV; un CSV con una sola línea de 1 MB (rendimiento de CodeMirror con líneas muy largas); archivo que cambia fuera de FreyaLab mientras está en modo Texto (la detección existente); archivo de solo lectura del sistema; cambiar de modo mientras se guarda; cambiar de modo con datos de recuperación pendientes; renombrar el archivo; `.csv` con `;` o `|`; un CSV de más de 50 MiB que la tabla abre como muestra (el modo Texto queda deshabilitado); un `.csv` abierto por «Abrir con…» desde el sistema operativo; un error de formato en un archivo que sí cabe en texto pero cuya línea indicada es la última.

### 6. Prompt ejecutable para Codex

```text
Tarea: TXT-01 · Abrir un CSV como tabla o como texto.
Lee AGENTS.md, CONTRIBUTING.md y docs/stories/7-csv-texto.md (TXT-01: criterios X1–X23, casos límite y la evidencia de la sección 2). Rama codex/txt-01-csv-texto desde main actualizado. Sin dependencias (iconv-lite y CodeMirror ya están); no toques package.json ni el lockfile. No modifiques TableEngine.
Archivos probables: src/main/documents.ts (abrir un CSV o TSV en modo texto reutilizando el camino de texto y la detección de codificación de la tabla; un documento por ruta), src/main/ (almacén del modo recordado en userData, módulo nuevo), src/main/index.ts y src/preload/index.ts y src/shared/types.ts (canal para abrir en un modo y cambiar de modo), src/renderer/App.svelte y Editor.svelte (conmutador, diálogo de cambios pendientes, barra de estado del modo texto), src/renderer/components/Tree.svelte (menú contextual), src/renderer/style.css, tests unitarios nuevos y tests/e2e/ nuevo.
Método, por bloque y en este orden (A elegir y recordar, B modo Texto, C cambiar de modo, D salida de emergencia), UN commit por bloque:
1. Escribe primero las pruebas y comprueba que FALLAN por la razón descrita (guarda la salida roja). Unitarias: almacén del modo (límite de 500, lectura tolerante, escritura atómica); ida y vuelta de codificación (UTF-8 con y sin BOM, UTF-16 LE, Windows-1252 con los bytes 0x81/0x8D/0x8F/0x90/0x9D; si la ida y vuelta no reproduce los bytes, solo lectura); apertura como texto con la muestra del propietario en LF y CRLF, saltos de línea mezclados y las comillas innecesarias. E2E: menú contextual, conmutador, diálogo de cambios pendientes con sus tres botones, guardado exacto, y los tres CSV mal formados de la historia: abrir como texto, corregir, guardar y reabrir como tabla.
2. Implementa lo mínimo reutilizando lo existente; un archivo es un documento y una pestaña.
3. Vuelve a ejecutar: las pruebas del bloque pasan y las anteriores siguen pasando.
Medición obligatoria: abrir un CSV como tabla y como texto a 2, 5 y 9 MiB con el mismo método de la historia (tiempo hasta que el contenido es visible y memoria total de la app menos la de reposo), y un CSV con una línea de 1 MB en modo Texto.
Esta tarea toca CSV y archivos compartidos: ejecuta npm run check, npm test, npm run build y la suite E2E completa. Evidencia: docs/evidence/txt-01-<fecha>.md con la tabla rojo→verde por bloque, las mediciones con números reales, capturas 1440×900 en claro y oscuro (modo Texto, diálogo de cambios pendientes, aviso con «Abrir como texto») y lo que NO se verificó. PR en BORRADOR; no fusiones, no publiques versiones, no actualices la app instalada. Si algo es ambiguo, detente y pregunta; no lo interpretes en silencio.
```

### 7. Plan de pruebas

| Nivel | Qué | Dónde |
|---|---|---|
| Unitaria (rojo→verde) | Almacén del modo (500 entradas, lectura tolerante, escritura atómica); ida y vuelta de codificación con los bytes sensibles; detección idéntica a la de la tabla | Pruebas nuevas |
| Fidelidad | Muestra del propietario y las siete construcciones de la sección 2 abiertas como texto y guardadas sin editar: bytes idénticos; con una edición, solo cambia lo editado | Unitarias de `Documents` |
| E2E | Menú contextual y conmutador; diálogo con los tres botones; guardar y cambiar; descartar y cambiar; recuperación en modo Texto; límite de 10 MiB | `tests/e2e/` |
| Emergencia | Los tres CSV mal formados: aviso con «Abrir como texto», cursor en la línea indicada, corregir, guardar, reabrir como tabla | `tests/e2e/` |
| Rendimiento | Tabla frente a texto a 2, 5 y 9 MiB; línea de 1 MB | Informe de evidencia |
| Regresión | Tabla, `.txt` y Markdown sin cambios; `TableEngine` intacto; CI en las cuatro plataformas | Suites existentes |

### 8. Criterios de revisión (Claude)

- Cuatro commits (A, B, C, D), cada uno con rojo→verde; sin dependencias nuevas; `TableEngine` sin cambios.
- **Un archivo = un documento**: no se puede abrir dos veces el mismo archivo en modos distintos a la vez.
- **Ningún cambio se pierde sin elección** y el texto guardado en modo Texto es idéntico byte a byte (sin editar) con la muestra y las construcciones de la historia.
- Codificación: ida y vuelta verificada, solo lectura si no es exacta, error posicionado si un carácter no cabe; nunca un reemplazo silencioso.
- Los tres CSV mal formados se abren como texto, se corrigen y se reabren como tabla.
- Los números de rendimiento son reales y comparables con los de la sección 2; la evidencia separa lo ejecutado de lo no verificado.
- `NEEDS TESTING` si falta alguna plataforma de CI, la suite E2E completa o las capturas en ambos temas; `BLOCKED` si se propone una dependencia o se modifica `TableEngine`.
