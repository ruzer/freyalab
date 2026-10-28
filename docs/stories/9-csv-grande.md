# Iteración 9 · Buscar y filtrar en archivos CSV grandes (L4a y L5a)

Origen (el propietario, 2026-10-28): «si tenemos un archivo de más de 72 mil celdas, no podemos hacer búsquedas ni aplicar filtros». Con 72 mil **celdas** sí se puede; el límite aparece al superar **dos millones de celdas o 50 MiB**, y hoy lo que existe es el **modo grande de solo lectura (L2)**: se navega y se extrae, pero no se busca ni se filtra. Esta iteración diseña las dos piezas que lo resuelven: **L4a, buscar**, y **L5a, filtrar**, del RFC `docs/design/LARGE-FILE-EDITOR-RFC.md` §11.

Principio del RFC (§0.1) que gobierna todo: **el tamaño del archivo elige la estrategia de procesamiento, no quita funciones.** No se promete rendimiento ilimitado: cada capacidad tiene un coste medido y un límite declarado.

| ID | Contenido | Depende de | Tamaño | Estado |
|---|---|---|---|---|
| **L4a** | Buscar en el archivo completo: recorrido en flujo, lista de coincidencias paginada, progreso, cancelación y resultados parciales honestos | L2 (en `main`) | M a L | **Lista** (abajo); decisiones Q1 a Q6 aprobadas el 2026-10-28 |
| **L5a** | Filtrar con las condiciones de siempre (hasta 20, todas/cualquiera, regex RE2) sobre el archivo completo; «Extraer coincidencias» desde la vista | L4a | M | **Lista** (abajo), va después de L4a en el mismo bloque; decisiones aprobadas |
| L4b | Reemplazar en un archivo grande: vista previa de recuento y **archivo nuevo**, nunca el original | L4a; decisión sobre versiones (L6) | M a L | Esbozada |
| L5b | Estadísticas de columna en un recorrido (vacíos, numéricos, mínimo/máximo/suma, únicos con tope declarado) | L5a | M a L | Esbozada |
| L5c | Ordenar: vista ordenada por llaves en memoria hasta un tope; más allá, ordenación externa | L5a | L | Esbozada |
| SQL+ | Que el SQL mantenga la fuente cargada entre consultas y acepte más de 200 columnas | — | M | Esbozada |
| L2+ | Índice persistente y caché fría (R6 del RFC): que abrir un archivo de GiB no reindexe cada vez | L2 | M | Esbozada |

Recomendación de entrega: **un bloque de integración** con dos historias (L4a y luego L5a), un solo PR en borrador, commits separados por historia y por comportamiento. L4a crea la infraestructura (trabajo de recorrido, lista de coincidencias, vista paginada, estados de la interfaz); L5a añade condiciones, el panel y la extracción.

## 1. Lo que existe hoy (verificado)

**Reproducido por mí el 2026-10-28** sobre `main` `33a5dfd` (build limpio, macOS arm64, Electron; CSV sintéticos con una columna entera y el resto de texto):

| Archivo | Celdas | Modo | Búsqueda y filtros |
|---|---|---|---|
| 2.400 filas × 30 columnas | **72.000** | editable | funcionan |
| 72.000 filas × 5 columnas | 360.000 | editable | funcionan |
| 72.000 filas × 27 columnas | 1.944.000 | editable | funcionan |
| 72.000 filas × 28 columnas | 2.016.000 | **grande (solo lectura)** | deshabilitados: «Búsqueda: archivos grandes, próximamente» |

Se leyó en el código (no se midió):

- Umbral del modo grande: más de 50 MiB **o** más de 2.000.000 de celdas (`src/main/table-engine.ts:20,74`). En ese modo el documento es de solo lectura, se indexa **una vez** (un desplazamiento cada 1.024 registros, `src/main/large-table.ts:66`) y las páginas se leen del disco (`largePage`, `table-engine.ts:138-142`). Cualquier `search`, `filters`, `order` o `conditions` en una consulta lanza «En archivos grandes todavía no hay búsqueda, filtros ni orden» (`table-engine.ts:139`).
- La interfaz lo declara deshabilitado: «Buscar en tabla», «Reemplazar», «Filtrar», «Filtros por columna», orden, «Filtrar esta columna» y estadísticas (`src/renderer/components/CsvTable.svelte:72-94,246,257,259,300`).
- **Lo que sí funciona en modo grande:** «Ir a la fila», «Extraer…» (filtra con condiciones hacia un archivo **nuevo**, sin límite de tamaño, original intacto; `src/main/operations.ts`, contrato `src/shared/operations.ts`: `count`, `preview`, `filter_extract`) y «Analizar» (SQL y gráficos sobre el archivo completo, con su propio tope de 256 MiB, 2 M de filas, 8 M de celdas y 200 columnas, `src/main/analysis-source.ts:12`).
- **La regla de coincidencia ya existe y es una sola**: `compileTableQuery` (`src/main/table-query.ts:7`) compila hasta 20 condiciones (`contains`, `equals`, `notEquals`, `starts`, `ends`, `empty`, `notEmpty`, `greater*`, `less*`, `dateBefore/On/After`, `regex` con RE2) y la usan la tabla editable y `runOperation`. La **búsqueda** de la tabla editable es «subcadena sin distinguir mayúsculas en cualquier celda» (`table-engine.ts:146-151`: `toLocaleLowerCase().includes`). No hay que inventar semántica nueva: hay que llevar la existente a un recorrido en flujo.
- Medido en el RFC (§6, M2 Max, caché caliente): recorrido propio **246–368 MiB/s** con ~280 MiB de memoria; `csv-parse` ≈ **31 MiB/s** (164 s por pasada en 5 GiB). El extracto actual (E1) es estricto y valida con `csv-parse` por lote: **≈ 30 s por GiB** (`docs/evidence/i0-e1-extracto-2026-10-25.md`). Un recorrido de 1 GiB con el recorrido propio debería rondar 3 s; con el estricto, 30 s. **Esa diferencia decide la experiencia.**

**Medición previa de Claude (2026-10-28, [evidencia](../evidence/l4-medicion-previa-2026-10-28.md))**, con los módulos de `main`, un CSV sintético de 529 MiB × 230 columnas, M2 Max, caché caliente; una sola máquina y un solo archivo:

| Estrategia (búsqueda de subcadena sin distinguir mayúsculas en cualquier celda) | Tiempo | Velocidad |
|---|---|---|
| Estricta, `csv-parse` por lote (como Extraer hoy) | 18 s | 29 MiB/s |
| Propia, decodificar y separar todos los campos | 3,8 a 4,6 s | 116 a 138 MiB/s |
| Propia con **prefiltro por bytes** (solo agujas ASCII) | 1,5 a 2,0 s | 271 a 348 MiB/s |
| Condición sobre **una columna**, separando solo hasta ella | 1,1 s (frente a 2,8 s) | 495 MiB/s |
| Prefiltro en **4 y 8 procesos** por rangos del índice disperso | 0,52 s y 0,34 s | ≈ 1 y 1,5 GiB/s |

Mismas coincidencias en todas las estrategias comparables. Lo que **no** está demostrado: paridad del prefiltro con el fixture hostil, memoria, caché fría, Windows/Linux, paralelismo con hilos dentro del proceso de tablas y la extrapolación a GiB. Por eso S0 sigue siendo obligatoria: Codex la repite con el código real.

**El SQL actual no resuelve este problema** (medido en la aplicación): cada consulta de «Analizar → SQL» vuelve a leer y cargar el archivo (2,4 s con 2 M de celdas y 7,8 a 8,3 s con 7,2 M, tanto la primera como la segunda ejecución), y rechaza archivos de más de 200 columnas, 8 M de celdas o 256 MiB. Sirve para archivos medianos con pocas columnas. El DuckDB nativo del RFC queda para agregaciones y ordenaciones (L5b, L5c, L8), tras su puerta de seguridad.

**Qué ve la persona hoy** (captura propia a 1440×900): la tabla con el aviso «Archivo grande: N filas en solo lectura… la búsqueda, los filtros, las estadísticas y la edición llegan en fases posteriores», el campo de búsqueda atenuado con «Búsqueda: archivos grandes, próximamente» y «Reemplazar» atenuado. «Filtrar» está marcado como no disponible (`aria-disabled`, el clic se ignora) pero **no se ve atenuado**: parece activo y no hace nada, un fallo de UX que L5a corrige al habilitarlo. «Limpiar datos» y «Filas y columnas» tampoco se ven atenuados y no se comprobó qué hacen en modo grande.

## 2. Diseño UX/UI común (una «vista» sobre el archivo completo)

**Idea.** En un archivo grande la persona sigue viendo el documento completo por páginas. Buscar o filtrar crea una **vista**: la lista de los registros que coinciden, que se pagina igual que el documento. La vista se construye con **un recorrido en flujo del archivo**, en el proceso de tablas (no en la interfaz), con progreso, cancelación y resultados que aparecen mientras se recorre.

**Estados** de una vista (cada uno con texto propio, sin jerga):

| Estado | Barra de estado | Tabla |
|---|---|---|
| Sin vista | «72.000 de 72.000 filas · archivo grande» (como hoy) | Documento completo |
| Buscando | «Buscando… 37 % · 12.345 coincidencias · 0:08» + **Cancelar** | Primera página en cuanto hay 200 coincidencias o termina; la lista crece y se puede recorrer lo ya encontrado |
| Completa | «4.521 coincidencias de 4.587.000 filas · 29 s» | Vista completa |
| Sin coincidencias | «Sin coincidencias en 4.587.000 filas» + **Quitar búsqueda** | Mensaje, sin tabla vacía |
| Cancelada | «Búsqueda cancelada al 37 %: 12.345 coincidencias en las primeras 1.698.000 filas. El resto del archivo no se examinó.» | Lo encontrado, marcado **parcial** |
| Tope | «Se detuvo al llegar a 10.000.000 de coincidencias. Refina la búsqueda o usa Extraer…» | Lo encontrado, marcado **parcial** |
| Invalidada | «El archivo cambió desde la búsqueda. Vuelve a buscar.» | Se quita la vista; nunca se mezclan filas de dos versiones |
| Error | El motivo en español (condición no válida, regex con un campo de más de 64 KiB, registro mal formado con su posición) | Sin resultados presentados como completos |

**Reglas de diseño.**

1. **Se busca con Enter, no en vivo.** Cada consulta recorre el archivo; hacerlo en cada pulsación sería hostil. Debajo del campo, mientras se escribe: «Enter para buscar en las 4.587.000 filas». Esc en el campo vacío quita la vista; Esc durante un recorrido lo cancela.
2. **Los números de fila son los del archivo.** La columna «#» muestra la fila original (la 1.234.567 sigue siendo 1.234.567 en la vista), no 1..N. Es lo que permite a una persona citar una fila.
3. **Resultados parciales, siempre rotulados.** Nada parcial se presenta como completo; el porcentaje examinado aparece en el mensaje.
4. **«Ver en el documento completo».** Acción sobre una fila de la vista (menú de la fila y atajo documentado): quita la vista y centra esa fila en el documento, con el foco en ella. Es la forma de ver el contexto de una coincidencia.
5. **«Ir a la fila N» con una vista activa** quita la vista y lo avisa («Se quitó la búsqueda para ir a la fila N»); no reinterpreta el número dentro de la vista.
6. **Un solo recorrido a la vez por documento.** Una consulta nueva cancela la anterior antes de empezar; sus resultados no pueden aparecer.
7. **Honestidad sobre lo que no cambia.** Reemplazar, orden, estadísticas y edición siguen deshabilitados y lo dicen. «Analizar», SQL, Gráficos y «Extraer…» siguen trabajando sobre el **documento completo** y, con una vista activa, lo indican explícitamente («usa el documento completo, no la vista»); ninguno toma la vista en silencio.
8. **Accesibilidad.** El estado va en una región `role="status"` y se anuncia solo al empezar, terminar, cancelar, llegar al tope o invalidarse (**no** en cada actualización de progreso, que se dibuja como máximo cuatro veces por segundo). «Cancelar» alcanzable por teclado; al cancelar, el foco vuelve al campo. Contraste correcto en claro y oscuro.

## 3. Decisiones del propietario (Q1 a Q6 aprobadas el 2026-10-28, tal como se recomiendan)

| ID | Decisión | Resolución (aprobada) |
|---|---|---|
| **Q1** | ¿Búsqueda explícita (Enter) o en vivo? | **Explícita.** Cada consulta recorre el archivo (3–30 s por GiB). |
| **Q2** | ¿Qué motor decide la coincidencia en lectura? | **Recorrido propio rápido** (escáner de L2 + `splitFields`) para buscar y filtrar, **si** una prueba diferencial demuestra paridad exacta con el modo editable y con `csv-parse` (S0 y B3). **Extraer sigue estricto** porque escribe un archivo. Medido: el recorrido propio es **4 a 5 veces más rápido** que el estricto (116–138 frente a 29 MiB/s). Si la paridad no se demuestra, se usa el motor estricto, se declara el tiempo (≈ 30 s/GiB) y se vuelve a pedir decisión: no se degrada la paridad en silencio. |
| **Q3** | Tope de coincidencias retenidas | **10.000.000** (≈ 120 MiB si se guardan posición y longitud por coincidencia). Al llegar, el recorrido se detiene y la vista queda parcial con aviso. Ajustable con medición; no más de 128 MiB para la lista. |
| **Q4** | Orden, estadísticas, reemplazar | **Fuera** de L4a y L5a (L5c, L5b, L4b). |
| **Q5** | «Ir a la fila» con vista activa | **Quita la vista y avisa** (diseño §2.5). |
| **Q6** | «Extraer coincidencias» desde una búsqueda | Hace falta que el contrato de operaciones (I0) acepte un campo `search` además de `conditions`: la búsqueda global no se puede expresar con 20 condiciones en una tabla de 230 columnas. **Sí, en L5a**, sin cambiar el comportamiento de lo existente. |

Notas sobre lo aprobado:

- **Q2 es condicional por diseño:** el recorrido propio rápido solo se adopta si la paridad se demuestra (B3, F4 y B25). Si no se demuestra, Codex usa el motor estricto, declara el tiempo y **se detiene a preguntar**; no degrada la paridad en silencio.
- **Q3:** 10.000.000 es el valor inicial; Codex puede proponer otro con medición, sin superar 128 MiB para la lista de coincidencias, y lo declara en la evidencia.
- **Q6:** extender I0 con `search` está aprobado **solo** para «Extraer coincidencias» (L5a); cualquier otro cambio del contrato I0 exige nueva aprobación.
- **Sin aprobar todavía:** el orden de entrega frente a TXT y PRJ (README).

## 4. L4a · Buscar en un archivo grande

**1. Historia de usuario.** Como persona que abre un CSV enorme, quiero buscar un texto en todo el archivo y ver las filas donde aparece, para encontrar un dato sin tener que extraerlo antes ni cargarlo entero.

**2. Problema y evidencia.** §1: en modo grande el campo de búsqueda está deshabilitado («próximamente») y `largePage` rechaza cualquier consulta. La regla de coincidencia, el escáner por posición, el progreso y la cancelación de la apertura ya existen; falta unirlos en un trabajo de recorrido con vista paginada. (◐ leído en el código y reproducido el límite; no se midió todavía el recorrido de búsqueda.)

**3. Diseño UX/UI.** El de §2, con estas particularidades de L4a:

- El campo «Buscar en la tabla» se habilita en modo grande. Texto de ayuda: «Buscar en el archivo completo (Enter)». Desaparece «próximamente». En documentos editables **no cambia nada**.
- Regla de coincidencia idéntica a la tabla editable: subcadena sin distinguir mayúsculas en cualquier celda de las filas de datos (no en el encabezado).
- El mismo patrón visual que «Indexando archivo grande… N %» + «Cancelar apertura» para «Buscando… N %» + «Cancelar».

**4. Criterios de aceptación.**

*Comportamiento*
- **B1.** En modo grande el campo de búsqueda está habilitado y su ayuda dice que busca en todo el archivo y se inicia con Enter; «próximamente» ya no aparece. En documentos editables la prueba actual no se edita y sigue en verde.
- **B2.** Enter con texto no vacío inicia el recorrido y aplica la regla de §3. Texto vacío o Esc en el campo vacío quita la vista.
- **B3. Paridad.** Para cualquier archivo que quepa en el modo editable, abrirlo en modo grande (`FREYALAB_LARGE_BYTES`) y buscar devuelve **las mismas filas, en el mismo orden y con el mismo contenido** que el modo editable. Prueba diferencial con ≥ 200 consultas generadas (acentos, ñ, mayúsculas, espacios, comillas, saltos de línea dentro de campos, filas irregulares, campos vacíos, UTF-8 con BOM, UTF-16, CRLF/LF/CR) sobre un fixture hostil.
- **B4.** La búsqueda recorre el archivo **una sola vez** en flujo y en el proceso de tablas; la interfaz sigue respondiendo (sin tareas largas de más de 50 ms en la interfaz durante la búsqueda sobre el fixture de 1 GiB).
- **B5.** La primera página aparece en cuanto hay 200 coincidencias o termina el recorrido; mientras continúa, la lista crece y se puede recorrer lo ya encontrado.
- **B6.** El progreso se muestra como en §2 y se actualiza como máximo cuatro veces por segundo.
- **B7.** Cancelar (botón, Esc) detiene el recorrido en **menos de 1 s**, conserva lo encontrado marcado como parcial con el porcentaje examinado y nunca lo presenta como completo.
- **B8.** Fin del recorrido: «N coincidencias de T filas · tiempo». Sin coincidencias: «Sin coincidencias en T filas» y «Quitar búsqueda».
- **B9.** La columna «#» muestra la fila original. La barra de estado dice «N de T filas · archivo grande · búsqueda».
- **B10.** Las coincidencias se resaltan como en la tabla editable (si la tabla editable no resalta, no se añade nada).
- **B11.** «Ver en el documento completo» sobre una fila de la vista quita la vista, centra la fila original y deja el foco en ella.
- **B12.** «Ir a la fila N» con una vista activa quita la vista y lo avisa.
- **B13.** Una búsqueda nueva cancela la anterior antes de empezar; los resultados de una búsqueda cancelada o reemplazada nunca aparecen (identificador de solicitud).
- **B14.** Cerrar el documento, reinterpretar (codificación, separador, encabezado) o reabrirlo cancela el recorrido y libera la lista.
- **B15.** Si el tamaño o la fecha del archivo cambian, al terminar o al pedir una página la vista se invalida con el mensaje de §2. Nunca se muestran filas leídas de dos versiones.
- **B16.** Un registro irregular (menos campos que el encabezado) compara el campo ausente como vacío, igual que la regla actual; un registro mal formado o de más de 1 MiB mantiene el error posicionado de L2.

*Límites y rendimiento (medidos y declarados, no prometidos)*
- **B17.** Tope de coincidencias retenidas (Q3). Al alcanzarlo el recorrido se detiene, la vista queda parcial y el aviso lo dice. El RSS del proceso de tablas se mantiene **por debajo de 1 GiB** durante todo el recorrido de un archivo de 1 GiB, con una coincidencia y con coincidencia en todas las filas (4,6 M).
- **B18.** Leer una página de 200 filas de una vista de 1 M de coincidencias dispersas en un archivo de 1 GiB: **mediana ≤ 50 ms**. Cada página lee **solo los registros mostrados** (acceso directo por posición); no se reescanean bloques del índice disperso (que guarda un desplazamiento cada 1.024 registros: con filas de ~1,3 KiB, localizar cada fila desde el índice leería de media ~0,7 MiB y hasta ~1,4 MiB, es decir, unos 140 MiB por página de 200 filas).
- **B19.** Velocidad del recorrido medida y declarada en MiB/s con 100 MiB y 1 GiB (M2 Max, caché caliente, serie de ≥ 3), con las palancas O1 a O3 activadas y desactivadas, para que se vea cuánto aporta cada una. Referencias medidas por Claude en 529 MiB × 230 columnas: **116–138 MiB/s** recorrido propio secuencial, **271–348 MiB/s** con prefiltro, ≈ **1 GiB/s** con 4 rangos en paralelo. Objetivo: **≥ 100 MiB/s** en la ruta secuencial de cualquier aguja (suelo, sin palancas) y, con O3 en un equipo de ≥ 8 núcleos, **≥ 3 veces** la velocidad secuencial. Si solo el motor estricto cumple B3, se declara el tiempo y se pide decisión (Q2).

*Optimización (guía en «Palancas de optimización»)*
- **B25. El prefiltro no pierde coincidencias.** El prefiltro por bytes (O1) solo se aplica a agujas ASCII sin comillas, delimitador ni saltos de línea, y no a UTF-16; un lote que contenga el signo Kelvin (U+212A, que la regla actual pliega a «k») o la «İ» (U+0130, que se pliega a «i̇») se procesa sin prefiltro. La prueba diferencial de B3 incluye agujas ASCII, con acentos, con comillas, vacías de significado (espacios), y filas con esos caracteres: **cero falsos negativos** frente al recorrido sin prefiltro y frente al modo editable.
- **B26. El recorrido en paralelo es idéntico al secuencial.** Con O3, las coincidencias salen en el orden del archivo y son las mismas que en el recorrido secuencial (prueba diferencial con 1, 2, 4 y 8 rangos y con tamaños de lote distintos); cancelar detiene todos los trabajos en < 1 s; el RSS **total** del proceso (o procesos) de tablas se mantiene por debajo de 1 GiB; el número de trabajos es configurable, con un valor por omisión prudente (p. ej. núcleos − 2, máximo 4) y nunca deja la interfaz sin respuesta.

*Seguridad y privacidad*
- **B20.** Sin dependencias nuevas. El IPC valida con un esquema (zod): texto de búsqueda de 1 a 1.000 caracteres, identificador de solicitud UUID; la interfaz no envía rutas, expresiones ni operaciones libres.
- **B21.** El texto buscado no se registra ni se guarda en disco. La lista de coincidencias vive solo en memoria y se descarta al cerrar el documento; **no se crean archivos temporales con contenido del archivo**.

*Accesibilidad y regresión*
- **B22.** Región `role="status"` según §2.8; teclado completo; foco coherente; contraste correcto en claro y oscuro.
- **B23.** Capturas reales a 1440×900 en claro y oscuro: buscando, completa, sin coincidencias, cancelada (parcial), tope.
- **B24.** Siguen deshabilitados, **se ven atenuados** (hoy «Filtrar» parece activo) y lo dicen: Reemplazar, orden, estadísticas, edición, «Filtrar…» (hasta L5a), Guardar y Exportar. «Analizar», SQL, Gráficos y «Extraer…» operan sobre el documento completo y lo indican cuando hay vista (§2.7). Ninguna prueba existente se edita para que pase; si una prueba cambia por una razón de producto, se explica.

**Palancas de optimización (guía de diseño; el orden es el de mayor a menor aporte medido y se valida con S0).**

- **O0. Recorrido propio, sin `csv-parse`, en las rutas de solo lectura** (buscar y filtrar). Es la mejora mayor (4 a 5 veces). Extraer, que escribe, sigue estricto. Condición: paridad demostrada (B3, F4).
- **O1. Prefiltro por bytes.** Antes de decodificar y separar, buscar la aguja en el lote ya leído (ASCII plegado + `indexOf`) y verificar con la regla exacta solo los registros candidatos (2,3 a 3 veces más). Solo agujas ASCII; B25 fija sus condiciones.
- **O2. Separar solo lo necesario.** Una condición sobre una o pocas columnas no necesita separar las 230 (≈ 2,6 veces). Aplica sobre todo a L5a.
- **O3. Rangos en paralelo.** El índice disperso de L2 guarda un desplazamiento cada 1.024 registros, siempre en el inicio de un registro: sirve de punto de partida seguro para partir el archivo en rangos y recorrerlos a la vez (≈ 3,8 veces con 4 y 5,9 con 8, caché caliente). Fuera de la interfaz; el resultado se fusiona en orden. Con caché fría manda el disco.
- **O4. No repetir trabajo.** Recordar la última vista completa (consulta + huella del archivo) para que volver a aplicar la misma consulta sea inmediato.
- **No se propone** usar DuckDB-Wasm (carga el archivo en cada consulta, 200 columnas, 8 M de celdas) ni adoptar DuckDB nativo en este bloque (puerta de seguridad pendiente).

**5. Casos límite.** Archivo con solo encabezado; archivo de una fila; una coincidencia; ninguna; todas las filas; texto con espacios al inicio o al final (se buscan tal cual); mayúsculas y acentos (`toLocaleLowerCase`, como hoy: no se normalizan acentos); campos con saltos de línea y comillas dobladas; filas con más o menos campos que el encabezado; UTF-16 y BOM; separadores `;` y tabulador; búsqueda mientras otra corre; cerrar o reinterpretar durante el recorrido; archivo borrado o modificado durante el recorrido; cierre de la aplicación durante el recorrido (sin restos); documento recién abierto cuya indexación aún no termina (la búsqueda espera al índice o se deshabilita con motivo); dos documentos grandes abiertos con búsquedas en curso.

**6. Prompt ejecutable para Codex.**

```text
Tarea: L4a · Buscar en un archivo grande (bloque con L5a). Sin dependencias nuevas.
Lee AGENTS.md, CONTRIBUTING.md, docs/stories/9-csv-grande.md (§1 a §4), docs/design/LARGE-FILE-EDITOR-RFC.md (§3, §6, §9, §11) y docs/evidence/l2-lectura-grande-2026-10-24.md e i0-e1-extracto-2026-10-25.md. Rama de integración codex/integracion-csv-grande-busqueda desde main actualizado, con un worktree propio. Trabaja por bloques según CONTRIBUTING (pruebas enfocadas hasta verde; cierre con check, npm test completo, test:e2e completo y build).
S0 (antes de implementar; documenta en docs/evidence/l4a-<fecha>.md y detente si contradice el diseño). Claude ya midió un orden de magnitud (docs/evidence/l4-medicion-previa-2026-10-28.md): repítelo con el código real y tus fixtures, no lo des por bueno. Con ventas_100MiB y ventas_1GiB (experiments/large-data-extracts/generate_sales.py) y un fixture de 230 columnas mide, con el recorrido existente (recordBatches de src/main/large-table.ts): (a) coincidencia con splitFields frente a la validación estricta de runOperation, en MiB/s y RSS; (b) el prefiltro por bytes (O1) y la separación parcial (O2) frente a (a); (c) el recorrido por rangos en paralelo (O3) con hilos dentro del proceso de tablas: velocidad, memoria y coste de enviar resultados; (d) leer 200 registros dispersos por el índice disperso frente a por posición directa. Comprueba que todas las variantes marcan las mismas filas en el fixture hostil, incluidos el signo Kelvin y la «İ».
1) Reproduce primero: prueba que falla porque en modo grande (FREYALAB_LARGE_BYTES con FREYALAB_TEST=1) buscar «x» devuelve el error actual de table-engine.ts:139, y E2E de que el campo está deshabilitado.
2) Implementa B1–B24 con el menor cambio posible. Reutiliza compileTableQuery (una sola regla de coincidencia), recordBatches, readRecords/splitFields, el patrón de progreso/cancelación de la apertura grande y requestId. La lista de coincidencias guarda posición y longitud por registro (acceso directo); tope según Q3. El recorrido corre en el proceso de tablas y comprueba la cancelación por lote.
3) Prueba diferencial editable↔grande (B3) con ≥ 200 consultas; independencia del tamaño de lote; cancelación < 1 s; invalidación por cambio del archivo; E2E de los estados de §2; capturas claro/oscuro 1440×900.
4) Evidencia: rojo→verde, S0, medidas de B17–B19 con 100 MiB y 1 GiB (serie ≥ 3, máquina y caché declaradas), casos NO probados. PR en borrador; no fusionar, no publicar versión, no actualizar la app instalada. Si necesitas una dependencia o cambiar el contrato I0 fuera de lo previsto en L5a, detente y pregunta.
```

**7. Plan de pruebas.** Unitarias: paridad diferencial (≥ 200 consultas) editable↔grande y contra `csv-parse` como oráculo independiente; independencia del tamaño de lote (`batchRecords` pequeño y grande); lista de coincidencias (tope, orden, lectura directa); validación del esquema IPC; invalidación por huella del archivo. Integración: recorrido con cancelación, cambio externo, cierre durante el recorrido, dos recorridos concurrentes en documentos distintos. E2E con `FREYALAB_LARGE_BYTES=1024`: estados de §2, números de fila originales, «Ver en el documento completo», «Ir a la fila», teclado y foco, regresión de lo deshabilitado. Rendimiento (manual y registrado en la evidencia, no en cada PR): 100 MiB y 1 GiB, serie de ≥ 3. Pruebas `@perf` solo para los límites de tamaño que protegen la memoria (B17).

**8. Criterios de revisión.** Rojo→verde del caso inicial; paridad diferencial demostrada y reproducible; una sola regla de coincidencia (sin copias de `compileTableQuery`); ninguna escritura de contenido a disco; cancelación < 1 s medida; memoria < 1 GiB medida con el peor caso; ningún resultado parcial presentado como completo; capturas y teclado; ninguna prueba existente debilitada; alcance (sin reemplazar, orden, estadísticas ni edición); sin dependencias nuevas.

## 5. L5a · Filtrar un archivo grande

**1. Historia de usuario.** Como persona que analiza un CSV enorme, quiero aplicar los mismos filtros que en una tabla pequeña (texto, número, fecha, regex; todas o cualquiera de las condiciones) sobre el archivo completo, para quedarme con las filas que me interesan y poder extraerlas.

**2. Problema y evidencia.** §1: «Filtrar», los filtros por columna y «Filtrar esta columna» están deshabilitados en modo grande; «Extraer…» ya filtra, pero solo hacia un archivo nuevo y sin ver antes las filas. La regla (`compileTableQuery`) ya admite todas las condiciones; L4a aporta el recorrido, la lista de coincidencias y la vista paginada.

**3. Diseño UX/UI.**

- «Filtrar» se habilita en modo grande y abre **el mismo panel de condiciones** de la tabla editable (hasta 20 condiciones, «todas/cualquiera», sensibilidad a mayúsculas, regex RE2). Se añade el botón **«Aplicar»** (porque cada aplicación recorre el archivo) y una línea que lo explica: «Recorre las 4.587.000 filas».
- Se combina con la búsqueda de L4a con **Y**, como en la tabla editable.
- Con una vista de filtro activa, un rótulo sobre la tabla: «Vista filtrada: 3 condiciones (todas) · 4.521 de 4.587.000 filas · **Editar** · **Quitar**».
- «Filtrar esta columna» (menú de columna) abre el panel con esa columna preseleccionada. Los filtros en línea bajo el encabezado siguen deshabilitados, con el texto «Usa Filtrar: en archivos grandes cada filtro recorre el archivo».
- **«Extraer coincidencias…»**: con una vista activa, «Extraer…» se abre con las mismas condiciones y la misma búsqueda ya cargadas. El resultado tiene las mismas filas que la vista y la misma fidelidad que hoy (bytes conservados al extraer filas completas).
- El estado del recorrido, el progreso, la cancelación, los parciales, el tope, la invalidación, los números de fila originales y «Ver en el documento completo» son **los de L4a**: no se diseñan dos veces.

**4. Criterios de aceptación.**

- **F1.** En modo grande «Filtrar» está habilitado y muestra el panel actual de condiciones (hasta 20, todas/cualquiera, operadores, mayúsculas, regex RE2) con «Aplicar». En tablas editables el panel no cambia.
- **F2.** Las condiciones se aplican con «Aplicar», no en vivo. Con condiciones sin cambios, «Aplicar» no repite el recorrido si la vista ya es completa y vigente.
- **F3.** Búsqueda y condiciones se combinan con Y.
- **F4. Paridad.** Para cualquier archivo que quepa en el modo editable, cada operador (`contains`, `equals`, `notEquals`, `starts`, `ends`, `empty`, `notEmpty`, `greater`, `greaterEqual`, `less`, `lessEqual`, `dateBefore`, `dateOn`, `dateAfter`, `regex`) y cada modo (todas/cualquiera) devuelve las mismas filas, en el mismo orden y con el mismo contenido en modo grande que en modo editable (prueba diferencial como B3, ≥ 300 consultas, incluidas combinaciones de 2 a 20 condiciones).
- **F5.** Los errores de condición (decimal no válido, fecha no válida, regex de más de 256 caracteres o demasiado compleja, más de 20 condiciones) se muestran en el panel **antes** de recorrer el archivo. Un campo de más de 64 KiB evaluado con regex solo se detecta durante el recorrido: el recorrido se detiene con ese mensaje, no deja resultados presentados como completos y no bloquea la cancelación.
- **F6.** «Filtrar esta columna» abre el panel con la columna preseleccionada; los filtros en línea siguen deshabilitados con el texto de §3.
- **F7.** Estados y comportamiento del recorrido = B4–B9 y B11–B16, con el rótulo de vista de §3.
- **F8.** «Extraer coincidencias…» precarga condiciones y búsqueda; el archivo extraído contiene exactamente las filas de la vista (mismo número y contenido) con fidelidad de bytes. **Q6:** el contrato de operaciones (`src/shared/operations.ts`) incorpora `search`; el comportamiento de `count`, `preview` y `filter_extract` sin `search` no cambia (sus pruebas actuales siguen en verde).
- **F9.** Una sola implementación de coincidencia: tabla editable, I0/E1 y vista grande usan `compileTableQuery`; no se duplica el compilador ni se reescribe `runOperation`.
- **F10.** Límites y rendimiento = B17–B19, medidos con **tres consultas de selectividad distinta** (≈ 0,001 %, ≈ 10 % y 100 % de las filas) en 100 MiB y 1 GiB; se declara la velocidad por consulta.
- **F11.** Regex con entrada hostil sobre un archivo de 1 GiB: la cancelación responde en < 1 s y el RSS no supera 1 GiB (RE2, sin referencias hacia atrás ni lookaround, como hoy).
- **F12.** «Analizar», SQL y Gráficos indican que usan el documento completo mientras haya una vista; el mensaje «Elige documento completo» de la vista filtrada en archivos grandes (`table-engine.ts:372`) se conserva o se mejora, no se elimina.
- **F13.** El orden sigue deshabilitado y lo dice («llega con L5c»); no se aplica a la vista en silencio.
- **F14.** Capturas a 1440×900 en claro y oscuro (panel con condiciones, vista aplicada, parcial, error de condición); teclado completo en el panel y en «Aplicar»/«Quitar»; foco coherente.
- **F15.** Seguridad y privacidad como B20 y B21: esquema IPC estricto (hasta 20 condiciones, valores de longitud acotada), sin rutas ni SQL desde la interfaz, sin contenido en archivos temporales, sin registrar las condiciones.
- **F16. Optimización de las condiciones.** Las condiciones que solo afectan a una o pocas columnas separan los campos únicamente hasta la columna necesaria (O2) y, cuando una condición `contains` de aguja ASCII lo permite, usan el prefiltro (O1) con las condiciones de B25. El resultado es idéntico al de separar todas las columnas (F4) y la ganancia se mide y se declara por condición (medido por Claude: ≈ 2,6 veces con una condición sobre una columna).

**5. Casos límite.** Las de L4a, más: 20 condiciones; condición sobre una columna que falta en filas irregulares; `empty` con espacios (se trata como vacío, como hoy); números con coma decimal (rechazados como hoy: punto decimal); fechas inválidas; regex vacío, de 256 y de 257 caracteres; `any` con una sola condición; cambiar solo el modo (todas/cualquiera) sin cambiar condiciones; búsqueda + condiciones que no coinciden con nada; extraer una vista parcial (debe decir que extrae **todas** las coincidencias del archivo, no solo las vistas: se recorre de nuevo, no se usa la lista parcial); extraer sin espacio en el destino (el aviso actual de E1).

**6. Prompt ejecutable para Codex.**

```text
Tarea: L5a · Filtrar un archivo grande (segunda historia del bloque de L4a). Sin dependencias nuevas.
Lee docs/stories/9-csv-grande.md (§2, §3 y §5) y el contrato src/shared/operations.ts. Parte de la rama de integración codex/integracion-csv-grande-busqueda con L4a ya verde y estable.
1) Reproduce primero: pruebas que fallan porque «Filtrar» está deshabilitado en modo grande y largePage rechaza conditions; prueba diferencial editable↔grande por operador (F4) que falla antes de implementar.
2) Implementa F1–F15 reutilizando L4a (trabajo de recorrido, lista de coincidencias, vista paginada, estados) y compileTableQuery. Extiende I0 con search (Q6) sin cambiar el comportamiento sin search; la extracción desde una vista vuelve a recorrer el archivo con las mismas condiciones, no reutiliza una lista parcial.
3) Evidencia: rojo→verde, paridad por operador, medidas de F10/F11 (100 MiB y 1 GiB, serie ≥ 3), capturas, casos NO probados. PR en borrador; no fusionar; no publicar; no actualizar la app instalada. Si algo exige una dependencia, un cambio del contrato I0 más allá de search o relajar la paridad, detente y pregunta.
```

**7. Plan de pruebas.** Diferencial por operador y modo con `csv-parse` como oráculo; combinaciones de condiciones; errores de condición antes y durante el recorrido; E2E del panel, «Aplicar», «Editar»/«Quitar», «Filtrar esta columna», «Extraer coincidencias…» (mismo número y contenido de filas que la vista), regresión de lo deshabilitado y de SQL/Gráficos/Analizar sobre el documento completo; rendimiento con tres selectividades.

**8. Criterios de revisión.** Paridad por operador demostrada; extracción idéntica a la vista; una sola regla de coincidencia; contrato I0 compatible hacia atrás (pruebas actuales sin editar); mismos estados y rendimiento declarado que L4a; ninguna vista parcial reutilizada como completa; alcance (sin orden, estadísticas ni reemplazo).

## 6. Historias esbozadas (no listas)

- **L4b · Reemplazar en un archivo grande.** «Reemplazar…» muestra primero el **recuento** (reutiliza la búsqueda de L4a) y escribe un **archivo nuevo**; el original no se toca. Reemplazar cambia valores, así que los campos modificados se vuelven a entrecomillar y la fidelidad pasa de «bytes conservados» a «valores conservados; formato normalizado», como en las extracciones de columnas. El RFC midió que el cambio masivo a 10 GiB no escaló (813 s frente a 75 s a 5 GiB, R12): no se promete a ese tamaño hasta entenderlo. Depende de L4a y de decidir si el resultado es un archivo nuevo o una versión (L6).
- **L5b · Estadísticas de columna.** Un recorrido por columna con vacíos, numéricos, mínimo, máximo, suma y media exactos, reutilizando la interfaz de estadísticas actual. Los **únicos y duplicados exactos** exigen memoria proporcional a los valores distintos: v1 con un tope declarado (p. ej. 5 M de valores distintos o 256 MiB) y, si se supera, el resultado se rotula «parcial». Medido en el RFC: 246–278 MiB/s con el recorrido propio.
- **L5c · Ordenar.** Una vista ordenada por llaves en memoria (≈ 145 B por fila: 578 MiB con 4 M de filas) hasta un tope; más allá, ordenación externa con disco temporal acotado. No reescribe el archivo: «Guardar ordenado» es un extracto nuevo. Depende de L5a.
- **SQL+ · Que el SQL no recargue el archivo en cada consulta y acepte más de 200 columnas.** Hoy cada ejecución vuelve a leer y cargar el archivo (2,4 s con 2 M de celdas, 8 s con 7 M, sin caché entre ejecuciones) y rechaza más de 200 columnas. Mantener la fuente cargada mientras el documento y su huella no cambien, y cargar con el recorrido propio de O0 en lugar de `csv-parse`, haría el SQL útil para consultas repetidas sobre archivos de hasta 256 MiB. No sustituye a L4a/L5a ni resuelve archivos de GiB. Pendiente de medir y de decidir si el tope de 200 columnas se levanta.
- **L2+ · Índice persistente y caché fría.** Abrir 1 GiB reindexa en ≈ 2,3 s con caché caliente y la caché fría no está medida (R6 del RFC). Un índice por huella de archivo evitaría reindexar cada vez. No bloquea L4a ni L5a.

L3 (edición puntual) y L6 a L9 siguen como en el RFC; PRJ-07 y TXT-03 siguen esperando a L3.

## 7. Qué no se ha comprobado

- La velocidad de búsqueda está medida por Claude **solo como orden de magnitud** (529 MiB, una máquina, caché caliente, [evidencia](../evidence/l4-medicion-previa-2026-10-28.md)); la medición S0 de Codex con el código real sigue siendo obligatoria. No se midió memoria, caché fría, Windows/Linux, el paralelismo con hilos dentro del proceso de tablas ni la paridad del prefiltro con el fixture hostil.
- No se probó un archivo de 1 GiB en modo grande en esta revisión; el límite se reprodujo con archivos pequeños y el umbral de celdas.
- No se comprobó qué hacen «Limpiar datos» y «Filas y columnas» en modo grande; hasta saberlo, L4a debe dejar claro en la interfaz lo que no está disponible (B24).
- Windows y Linux, lector de pantalla y caché fría quedan sin medir.
