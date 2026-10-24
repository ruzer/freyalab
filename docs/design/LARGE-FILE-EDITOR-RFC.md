# Editor escalable de archivos grandes — RFC de la Fase 0

**Estado:** RFC para revisar; **sin cambios en el producto** (el único código de `src/` que acompaña a este tema es la corrección de navegación del PR #52, en otra rama). Los experimentos están en `experiments/large-file-editor/` y se pueden repetir (§13).
**Fecha:** 23 de octubre de 2026, sobre `main` en `799cb70`.
**Alcance:** edición **completa** de CSV/TSV de varios GiB: abrir, navegar, editar celdas/filas/columnas, buscar y reemplazar, filtrar y ordenar, transformaciones masivas, estadísticas, gráficos, análisis, guardar y recuperar. **Fuera de alcance:** otros formatos (JSON, Parquet, Excel), edición colaborativa, y cualquier cambio de la arquitectura de producción antes de que este RFC se apruebe.
**Máquina de las mediciones:** Apple M2 Max (12 núcleos), 32 GiB de RAM, SSD interno, macOS 27.0.1, Node 24.22.1, Electron 44.9.2 (Chromium 152). Los ficheros estaban en la caché del sistema operativo; **no se midió con caché fría**.

## 0. Resumen

1. **Objetivo de producto:** el tamaño del archivo elige la *estrategia de procesamiento*, no quita funciones. Un archivo de 5 GiB debe poder editarse, no solo verse. No se promete rendimiento ilimitado: cada capacidad tiene un coste medido y un límite declarado (§9, §10).
2. **El diseño que se propone** (§4): el archivo original sigue siendo la fuente canónica de bytes; un **índice disperso** de posiciones permite leer por páginas; las ediciones puntuales viven en una **capa** con **diario** de operaciones; guardar es una **copia en flujo** que reescribe solo los registros tocados y reemplaza el original con un `rename` atómico. DuckDB **no** es el almacén canónico.
3. **Demostrado con 5 GiB** (5 369 182 394 bytes, 3 967 421 filas × 230 columnas): índice completo en 10,1 s con 30 KiB de memoria; páginas de 50 filas en 2,8 ms (mediana); 1000 ediciones en 24 ms; guardado en 5,8 s con 283 MiB de RSS máximo; **1001 tramos sin editar con SHA-256 idéntico** y 1000 registros editados verificados con un analizador independiente; recuperación tras `SIGKILL` real; cambio masivo en flujo en 75 s con 439 MiB de RSS (§4, §5). Con 1 y 10 GiB el índice y el guardado escalan casi linealmente (19,9 s y 8,5 s a 10 GiB, ≤ 287 MiB de RSS), **pero el cambio masivo a 10 GiB tardó 813 s y su verificación 35 min: anomalía no explicada** (§5, R12).
4. **Lo que el PR #52 resuelve y lo que no** (§3): corrige el límite de altura de Chromium (524 286 filas) y es exacto hasta 10 M de filas; con más filas la barra de desplazamiento pasa a ser gruesa (a 100 M de filas, 1 píxel físico ≈ 6,7 filas) y «ir a la fila N» se desvía hasta ±15 filas a 500 M si no se ancla la posición lógica. **Con el motor actual (50 MiB / 2 M de celdas) el PR #52 no abre ningún archivo grande**: es un requisito, no la solución.
5. **Motor analítico** (§6): el DuckDB nativo es ~65 veces más rápido que `csv-parse` y 5–7 veces más que un recorrido propio en JS (5 GiB), pero **no se recomienda adoptarlo todavía**: las restricciones propias de DuckDB funcionan (27 comprobaciones esperadas, todas cumplidas, más 2 informativas), pero **no está demostrado el aislamiento a nivel de sistema operativo** en Windows y Linux ni el empaquetado en las 4 plataformas (§7). Un recorrido propio en JS ya cubre recuento, filtro, agrupación y estadísticas con 250–370 MiB/s y **cero dependencias nuevas**.
6. **Corrección de una afirmación anterior** (§14): el guardado actual **no** conserva el CSV byte a byte; normaliza las comillas (verificado). El diseño propuesto sí lo hace con los registros que no se tocan.
7. **Recomendación** (§12): aprobar la dirección y la hoja de ruta; implementar **L2 (lectura grande por índice) y L3 (edición puntual con capa y guardado atómico)** como los dos siguientes PR, junto con #52. **No aprobar #52 solo** como si resolviera el problema. DuckDB nativo queda detrás de una puerta de seguridad explícita (§7.4).

## 1. Principios

| # | Principio | Consecuencia |
|---|---|---|
| P1 | El tamaño elige la estrategia, no las funciones. | Todas las capacidades de §9 existen en cualquier tamaño; cambia cómo se calculan y cuánto tardan. |
| P2 | El original es canónico y solo se reemplaza al final, con `rename` atómico. | Cancelar, fallar o quedarse sin disco no daña el archivo. |
| P3 | Lo que no se toca no se reescribe. | Los bytes de los registros sin cambios se copian tal cual (comillas, saltos de línea, BOM, ceros a la izquierda). |
| P4 | Ninguna operación carga el archivo entero en memoria. | La memoria es función de la ventana visible, la capa de cambios y los búferes, no del tamaño. |
| P5 | Toda operación larga muestra progreso y se puede cancelar. | `AbortSignal` de extremo a extremo; el temporal se borra al cancelar. |
| P6 | Preferir herramientas maduras y poco código propio. | El código propio de los experimentos son ~250 líneas; no se añaden motores sin justificación (§6). |
| P7 | Separar lo demostrado de lo estimado y de lo pendiente. | La tabla de §9 etiqueta cada criterio. |

## 2. Punto de partida (hechos del código)

| Hecho | Dónde | Consecuencia |
|---|---|---|
| `TABLE_LIMITS = { bytes: 50 MiB, cells: 2 000 000, record: 1 MiB, sampleBytes: 8 MiB, sampleRows: 200 }` | `src/main/table-engine.ts:16` | Todo lo que supera 50 MiB o 2 M de celdas se abre como **muestra de solo lectura de 200 filas**. |
| Archivo > 50 MiB → `readonly` y motivo «El archivo supera 50 MiB» | `table-engine.ts:67`, `:77`–`:81` | Es el límite que ve el usuario con `conjunto_de_datos_ageb_urbana_20_cpv2020.csv`. |
| Toda la tabla vive en memoria como `rows: TableRow[]`; cada consulta construye un `number[]` con **todos** los índices que coinciden | `table-engine.ts:96` | Memoria proporcional al tamaño; no escala a GiB. |
| El historial son mutaciones con `forward/backward`, incluidas las de orden de filas/columnas completas; la recuperación es `structuredClone` del estado entero | `table-engine.ts:387` | Deshacer y recuperar suponen copiar toda la tabla. |
| `serialize()` re-escribe **todo** con `csv-stringify` y rechaza más de 50 MiB | `table-engine.ts:380`–`:383` | No conserva el original (§14). |
| SQL/Análisis: DuckDB-Wasm en una ventana oculta aislada, con tope de 8 M de celdas y 256 MiB por archivo, sin acceso a disco ni red | `src/main/sql-service.ts:62` | Seguro, pero acotado por la memoria de Wasm (32 bits). |
| Chromium limita un elemento a **16 777 214 px**; con filas de 32 px son 524 286 filas | medido (Electron 44 / Chromium 152) | Defecto de navegación corregido en #52. |

## 3. Navegación (PoC 3)

**PR #52** (`codex/virtual-scroll-limit`) escala el desplazamiento cuando la altura lógica supera 15 000 000 px: la barra de desplazamiento recorre una altura física acotada, la posición se convierte a lógica (`toLogical`) y las filas se colocan con `rowTop`. Prueba unitaria (9) y E2E (8, con 1 000 000 de filas): última fila alcanzable, `Ctrl/⌘+End`, rueda, selección estable, filtro/orden y barrido de 7 posiciones.

**Qué ocurre con muchas más filas** (`experiments/large-file-editor/scroll/`, mismo Chromium del producto, ventana de 600 px, filas de 32 px):

| Filas | Escala | Filas por píxel de `scrollTop` | Última fila alcanzable | Desvío de «ir a la fila N» · ingenuo | Desvío · anclado | Fotograma p50 / p95 |
|---:|---:|---:|:-:|---|---|---|
| 1 M | 2,1 | 0,1 | sí | 0 | 0 | 8,3 / 9,2 ms |
| 10 M | 21 | 0,7 | sí | 0 | 0 | 8,3 / 9,1 ms |
| 50 M | 107 | 3,3 | sí | ±1 | 0 | 8,3 / 9,1 ms |
| 100 M | 213 | 6,7 | sí | hasta −3 | 0 | 8,3 / 9,1 ms |
| 500 M | 1067 | 33,3 | sí | hasta **15** | 0 | 8,3 / 9,3 ms |

*Ingenuo* = la posición lógica se reconstruye desde el `scrollTop` redondeado (lo que hace #52). *Anclado* = si el desplazamiento lo provocó el programa, se conserva la posición lógica exacta. En todos los tamaños las 40 posiciones aleatorias auditadas tuvieron filas contiguas y a 32 px; el DOM se mantiene en 25 nodos; el fotograma es el del refresco de la pantalla (120 Hz = 8,3 ms).

**Consecuencias de diseño:**

- Hasta **~10 M de filas, #52 basta**. Más allá hay que anclar la posición lógica (3 líneas en el manejador de `scroll`, demostrado en el banco).
- La barra de desplazamiento deja de ser un control de precisión: con 10 M de filas y una pista de ~800 px, **1 píxel de la barra ≈ 12 500 filas**. Navegar a una fila concreta exige **«Ir a la fila N»**, búsqueda, saltos entre resultados y una referencia de posición. Esto es requisito de L2.
- Todos los números salen de un banco con datos sintéticos (`fila i`): miden el desplazamiento, no la lectura de datos, que se mide en §4.

## 4. Modelo de edición (PoC 1)

```text
archivo original (canónico, solo lectura)
   │  índice disperso: desplazamiento del registro 0, 1024, 2048…  (8 B por 1024 registros)
   ▼
página(i, n) → bytes [inicio, fin) del registro i … i+n → campos → capa encima
   ▲
capa (memoria):  ordinal → {celdas: col→valor} | eliminado        altas: tras ordinal → filas nuevas
   ▲
diario (disco):  una línea JSON por operación; cabecera con la huella del original
   │
guardar = copia en flujo [original + capa] → temporal en la misma carpeta → fsync → comprobar huella → rename → desplazar índice
```

### 4.1 Índice disperso

- Un registro termina en `LF` (o `CR` si el archivo no tiene ningún `LF` en sus primeros 64 KiB) **fuera de comillas**; las comillas dobles escapadas (`""`) se compensan solas al alternar el estado. UTF-16LE usa unidades de 2 bytes.
- Se guarda el desplazamiento de cada 1024.º registro: **30 KiB para 3 967 422 registros**; ~7,5 MiB para mil millones. Leer una página es saltar al punto de control y recorrer como mucho 1023 registros.
- Medido en 5 GiB: **10,1 s (506 MiB/s)**, 75 MiB de RSS máximo. Una página de 50 filas (~65 KB): **2,84 ms p50, 3,99 ms p95, 5,9 ms máximo**; la última página, 1,9 ms.
- **Se reconstruye en cada apertura** (el diario de recuperación también tiene que esperar a ese índice: 8,9 s). Un índice persistente con la huella del archivo evitaría la espera; **no se implementó** (estimado, §10 R6).
- Tras guardar sin altas ni bajas de registros el índice **no se relee**: cada punto de control se desplaza por la suma de diferencias de longitud. Comprobado byte a byte contra un índice reconstruido (5 GiB y pruebas). Con altas/bajas se reconstruye.

### 4.2 Identificadores estables

El identificador de un registro existente es su **ordinal en el archivo original**; las altas reciben identificadores propios. Es lo que usan la capa y el diario. **Pendiente de diseñar en L5:** las vistas filtradas/ordenadas como listas de identificadores en disco y su correspondencia con la posición visible tras altas/bajas (el PoC no incluye vistas).

### 4.3 Capa de cambios

`Map<ordinal, {celdas}|eliminado>` en memoria. 1000 ediciones: **24 ms** (24 µs cada una, con diario). Memoria ∝ celdas editadas. Estimado: ~100–200 B por edición ⇒ 1 M de ediciones ≈ 100–200 MB. Regla propuesta: al superar un umbral (p. ej. 1 M de celdas o 256 MiB) la interfaz ofrece **guardar** (consolidar); no se descarta nada.

### 4.4 Diario y recuperación

- Una línea JSON por operación (`set`, `del`, `ins`) tras una cabecera con la huella del original (tamaño, `mtime`, SHA-1 de los primeros y últimos 64 KiB) y el delimitador. `flush()` hace `datasync`.
- Al abrir: si hay diario y la huella coincide, se reaplica; **si el archivo cambió desde entonces no se aplica** y se avisa (el diario se conserva). Una última línea truncada por un cierre brusco se ignora.
- **Demostrado:** un proceso hijo que escribe 200 operaciones, hace `flush()` y muere con `SIGKILL` real; el siguiente `open` recupera las 200 y el guardado produce el CSV esperado. 1000 operaciones se reaplican en milisegundos; en 5 GiB el tiempo de recuperación (8,9 s) es el del índice.
- **Un defecto real que las pruebas encontraron:** tras recuperar un diario con la última línea truncada, lo que se añadía después quedaba pegado a la línea rota y se perdía en la siguiente recuperación. Se corrige recortando el diario hasta el último byte bueno al recuperar (la prueba falla sin esa línea y pasa con ella).
- **No demostrado:** pérdida de energía o fallo del sistema operativo (la caché de escritura puede perder operaciones posteriores al último `datasync`). Política propuesta: `datasync` cada N operaciones o T ms; el coste de esa política **no se midió**.

### 4.5 Guardado

1. Comparar la huella del archivo con la de la apertura; si cambió → `ExternalChangeError` y **no se escribe nada**.
2. Comprobar espacio libre (`statfs`) ≥ tamaño + altas + 64 MiB; si no → `InsufficientSpaceError` **antes de crear el temporal**.
3. Crear `.<nombre>.freyalab-<pid>.tmp` en la **misma carpeta** (el `rename` es atómico solo dentro del mismo volumen), con los permisos del original.
4. Copiar en bloques de 8 MiB los tramos sin cambios y reescribir los registros tocados; comprobar `AbortSignal` entre bloques y registros.
5. `fsync`, volver a comparar la huella (estrecha, no elimina, la carrera con otros procesos) y `rename` sobre el original.
6. Si algo falla o se cancela: cerrar, borrar el temporal; el original no se tocó y la capa y el diario siguen intactos (se puede reintentar).

Medido: **5,8 s** para 5 GiB con 1000 registros reescritos (≈ 0,9 GiB/s de copia), 283 MiB de RSS máximo, +5333 bytes. Se abre por `realpath` (un `rename` sobre un enlace simbólico lo reemplazaría), y se conservan los permisos (probado).

### 4.6 Qué se conserva y qué no

| | Registros sin tocar | Registro editado | Campo editado |
|---|---|---|---|
| Bytes | **idénticos** (1001 tramos con SHA-256 igual en 5 GiB; 4 codificaciones en pruebas) | cambia solo el campo editado; los demás campos conservan su texto exacto, incluidas comillas innecesarias | se reescribe con comillas solo si hace falta o si ya las tenía |
| BOM, saltos de línea mixtos, ausencia de salto final | conservados | conservados | — |
| Ceros a la izquierda, identificadores > 2^53 | conservados (nunca se interpretan números) | conservados | — |

**No se conservan:** propietario, ACL, atributos extendidos, marcas de tiempo (el archivo nuevo tiene `mtime` nuevo), vínculos duros (el `rename` rompe el vínculo) ni la identidad del `inode`. Esto debe ser un aviso documentado, no una sorpresa. En Windows el `rename` sobre un archivo abierto por otro proceso sin `FILE_SHARE_DELETE` falla (se informa, no se pierde nada); en carpetas de nube o unidades de red la atomicidad **no está garantizada** (no probado).

### 4.7 Escalado 1 / 5 / 10 GiB

Misma máquina, mismo generador (perfil `wide`, 230 columnas), 1000 ediciones aleatorias; `overlay-1GiB.json`, `overlay-5GiB.json`, `overlay-10GiB.json`.

| | 1 GiB | 5 GiB | 10 GiB |
|---|---:|---:|---:|
| Registros | 793 956 | 3 967 422 | 7 934 845 |
| Índice en memoria | 6 KiB | 30 KiB | 61 KiB |
| Indexar (RSS máx.) | 2,0 s (74 MiB) | 10,1 s (75 MiB) | 19,9 s (76 MiB) |
| Página de 50 filas p50 / p95 | 2,9 / 4,1 ms | 2,8 / 4,0 ms | 2,7 / 3,8 ms |
| 1000 ediciones con diario | 21 ms | 24 ms | 23 ms |
| Recuperar tras cierre (incluye reindexar) | 1,8 s | 8,9 s | 16,7 s |
| Guardar (RSS máx.) | 1,6 s (250 MiB) | 5,8 s (283 MiB) | 8,5 s (287 MiB) |
| Verificar por hash los 1001 tramos sin editar | 7,1 s | 24,1 s | 31,7 s |
| Cambio masivo en flujo (RSS máx.) | 14,7 s (478 MiB) | 74,9 s (439 MiB) | **812,6 s** (531 MiB) |
| Abrir la versión nueva y leer 300 registros | 2,7 s | 15,0 s | **2119 s** |

La memoria es plana (≤ 287 MiB en edición y guardado, ≤ 531 MiB en cambios masivos) y el índice, las páginas y el guardado crecen casi linealmente. **El cambio masivo y la apertura de la versión nueva a 10 GiB no**: 10,8 veces más tiempo con el doble de tamaño (cambio masivo) y 141 veces (apertura). La verificación por hash de 20 GiB en la misma ejecución sí fue lineal (31,7 s), así que el disco no era lento en general. La causa no se determinó; la ejecución duró ~57 min y el conjunto de trabajo (fixture + copia + versión nueva) era de unos 30 GiB en una máquina de 32 GiB de RAM. Hasta repetirlo en aislamiento (con `memory_pressure` y sin otras cargas) **no se afirma que el cambio masivo de 10 GiB funcione en un tiempo razonable**.

**Diferencia con el motor actual:** `serialize()` normaliza las comillas de todo el archivo. El modo grande sería *más fiel* que el modo en memoria; la unificación se decide en L9.

## 5. Cambios puntuales frente a masivos (PoC 1)

| | Puntual (celda, fila) | Masivo (reemplazar todo, transformar columna, ordenar, columnas) |
|---|---|---|
| Dónde vive | Capa + diario | Pasada en flujo que escribe una **versión nueva** completa |
| Memoria | ∝ ediciones | Acotada: bloques de 8 MiB + un registro |
| Deshacer | Operación inversa en el diario (barato) | Volver a la versión anterior (el archivo anterior sigue ahí) |
| Disco | 0 hasta guardar; al guardar, tamaño + margen | **Un archivo completo por versión retenida** |

**Medido (5 GiB, 3 967 422 registros, 230 columnas):** poner en mayúsculas una columna en todos los registros: **75 s (68 MiB/s)**, 439 MiB de RSS máximo, salida de 5 369 187 727 bytes; 300 registros al azar de la versión nueva comparados con la anterior; el archivo anterior intacto. Los registros cuyo valor no cambia se copian como bytes originales. **A 10 GiB el mismo cambio tardó 813 s (13 MiB/s), 10,8 veces más que a 5 GiB, y no se ha explicado** (§4.7, R12). Es la peor tasa de las operaciones: decodifica y divide cada registro; un extractor perezoso por columna (como el de §6) la acercaría a 300 MiB/s (estimado; no implementado en el cambio masivo).

**Historial sin cargar el archivo en RAM:** cada operación masiva produce un archivo nuevo en una carpeta de versiones (misma unidad que el original); «volver» es cambiar el puntero a la versión anterior. No hay datos en RAM. El coste es disco: 5 GiB por versión retenida. Política propuesta: conservar las últimas K versiones mientras el espacio libre sea ≥ 2× el tamaño del archivo, avisando antes de crear una. La clonación de archivos (`COPYFILE_FICLONE`) **no clonó** en esta máquina (APFS): Node copió los 5136 MiB completos en 3,5 s, así que **no se puede contar con ella**. Alternativa investigable en L6 (no recomendada ahora): operaciones por columna como *recetas* aplicadas al leer, sin materializar.

**Deshacer puntual tras guardar:** guardar es una confirmación; el historial puntual anterior se pierde salvo que se conserve el diario (decisión de UX pendiente).

## 6. Motor analítico (PoC 4)

**Método.** Un proceso por (motor, tarea, archivo) para medir la memoria máxima limpia (`maxRSS`). Archivos «wide» de 256 MiB, 1 GiB y 5 GiB (230 columnas; la columna 3 es texto y las columnas 8–37 son enteros). Tareas: *count* (registros), *filter* (`NOM_MUN = 'Mérida'`), *groupby* (los 5 municipios más frecuentes), *analyze* (30 columnas: no vacíos, numéricos, mínimo, máximo, suma), *sort-full* (permutación completa de ordinales ordenada por una columna de texto). Motores: **csv-parse 7.0.3** en flujo (el que usa hoy el motor de tablas), **propio** (índice por posición + extracción perezosa de columnas en JS, `lib/`), **DuckDB nativo v2.0.0** y **DuckDB-Wasm 1.33.1-dev57** (el paquete del producto, en Node y no en la ventana aislada). Cada resultado se resume con un hash: **los cuatro motores devolvieron resultados idénticos en todas las tareas y tamaños** (`DISCREPANCIAS: []`). Tiempo · rendimiento · RSS máximo:

| Tarea | Motor | 256 MiB | 1 GiB | 5 GiB |
|---|---|---|---|---|
| count | csv-parse | 8,4 s · 31 MiB/s · 301 MiB | 34 s · 31 MiB/s · 336 MiB | — |
| count | propio | 0,8 s · 324 MiB/s · 172 MiB | 2,8 s · 361 MiB/s · 282 MiB | 15 s · 333 MiB/s · 273 MiB |
| count | DuckDB nativo | 0,5 s · 534 MiB/s · 297 MiB | 0,8 s · 1284 MiB/s · 286 MiB | **2,6 s · 1985 MiB/s · 287 MiB** |
| count | DuckDB-Wasm | 1,6 s · 165 MiB/s · 674 MiB | 3,6 s · 287 MiB/s · 680 MiB | — |
| filter | csv-parse | 8,4 s · 31 MiB/s · 300 MiB | 34 s · 30 MiB/s · 302 MiB | **164 s · 31 MiB/s · 300 MiB** |
| filter | propio | 0,8 s · 323 MiB/s · 170 MiB | 2,8 s · 368 MiB/s · 230 MiB | 16 s · 314 MiB/s · 281 MiB |
| filter | DuckDB nativo | 0,5 s · 543 MiB/s · 298 MiB | 0,8 s · 1312 MiB/s · 287 MiB | 2,5 s · 2049 MiB/s · 287 MiB |
| filter | DuckDB-Wasm | 1,6 s · 164 MiB/s · 642 MiB | — | — |
| groupby | csv-parse | 8,4 s · 30 MiB/s · 316 MiB | 33 s · 31 MiB/s · 301 MiB | — |
| groupby | propio | 0,8 s · 321 MiB/s · 171 MiB | 2,9 s · 354 MiB/s · 282 MiB | 16 s · 326 MiB/s · 282 MiB |
| groupby | DuckDB nativo | 0,5 s · 544 MiB/s · 301 MiB | 0,8 s · 1315 MiB/s · 290 MiB | 2,5 s · 2070 MiB/s · 291 MiB |
| groupby | DuckDB-Wasm | 1,6 s · 164 MiB/s · 690 MiB | — | — |
| analyze | csv-parse | 8,6 s · 30 MiB/s · 301 MiB | 34 s · 30 MiB/s · 301 MiB | — |
| analyze | propio | 1,0 s · 250 MiB/s · 162 MiB | 3,7 s · 278 MiB/s · 188 MiB | 21 s · 246 MiB/s · 286 MiB |
| analyze | DuckDB nativo | 0,9 s · 302 MiB/s · 297 MiB | 1,3 s · 786 MiB/s · 319 MiB | 3,8 s · 1339 MiB/s · 319 MiB |
| sort-full | propio (llaves en memoria) | — | 3,2 s · 322 MiB/s · 366 MiB | 16 s · 313 MiB/s · 578 MiB |
| sort-full | DuckDB nativo | — | 2,3 s · 455 MiB/s · 296 MiB | 9,3 s · 550 MiB/s · 501 MiB |

«—» = **no medido** (no es «falló»). csv-parse a 5 GiB solo se midió en *filter*; el resto es del mismo orden (≈ 165 s por pasada, **estimado**). DuckDB-Wasm a 5 GiB **no se intentó**: Wasm es de 32 bits (4 GiB de espacio de direcciones) y el producto ya lo limita a 256 MiB / 8 M de celdas; se considera no viable (estimado). Todos con la caché del sistema caliente.

**Ordenar el archivo entero** (reescribirlo ordenado por una columna, DuckDB nativo, 5 GiB, `COPY … ORDER BY … TO` CSV): es la operación que cuesta disco temporal y memoria.

| `memory_limit` | `preserve_insertion_order` | Resultado | Tiempo | RSS máximo | Temporal máximo |
|---|---|---|---|---|---|
| 4 GB | sí | completa | 57 s | **4,9 GiB** | 9,4 GiB |
| 2 GB | no | completa | 98 s | 2,7 GiB | **20,2 GiB** |
| 1 GB | no / sí | **falla** («Out of Memory Error… 676 MiB/953,6 MiB used») | 15 s | 1,4–1,6 GiB | ~10 GiB |

Lo que hay que planificar: el temporal llega a **2–4 veces el tamaño del archivo**; `memory_limit` **no es un tope del proceso** (el RSS superó el límite en ~30–45 %: 4,9 GiB con 4 GB y 2,7 GiB con 2 GB); con filas de 230 columnas un límite de 1 GB no basta; y la salida de DuckDB **no conserva los bytes** del original (normaliza el CSV). Por eso DuckDB sirve para *analizar y calcular vistas*, no como almacén canónico ni como escritor del archivo del usuario.

**Conclusiones.**

1. **csv-parse (≈ 30 MiB/s)** es el cuello de botella actual: 164 s por pasada en 5 GiB. Sigue siendo válido para tablas pequeñas.
2. **El recorrido propio (246–368 MiB/s)** es 8–12 veces más rápido que csv-parse, usa ~280 MiB de memoria con independencia del tamaño, comprueba `AbortSignal` en los límites de bloque y **no añade dependencias**. Cubre recuento, filtro, agrupación, estadísticas por columna y ordenación de ordinales (llaves en memoria: 578 MiB con 4 M de filas, **estimado ≈ 145 B por fila** ⇒ más allá de ~30 M de filas hay que pasar a ordenación externa o a un motor con derrame). Su extractor de columnas coincide con la división completa en cada registro de un fixture hostil de 39 000 registros (prueba).
3. **DuckDB nativo (1,3–2,1 GiB/s)** es ~65 veces más rápido que csv-parse y 5–7 veces más que el recorrido propio en 5 GiB, con el mismo ~290–320 MiB de RSS en consultas de agregación. Es el candidato natural para L8 (SQL, gráficos, ordenaciones grandes), **condicionado a §7**.
4. **DuckDB-Wasm** (165–287 MiB/s, 640–690 MiB de RSS) sirve para el panel SQL actual sobre archivos pequeños; no escala a GiB.
5. **Cancelación:** `interrupt()` de DuckDB nativo responde en 2–3 ms (§7); el recorrido propio comprueba `AbortSignal` por bloque (≤ 16 MiB ≈ 50 ms a 330 MiB/s, **estimado**; la prueba verifica que cancela y limpia, no la latencia).
6. **Alternativas maduras no medidas** (`xsv`/`qsv`, Miller, ClickHouse-local, Polars): ninguna estaba instalada y, por el principio P6, no se añaden motores sin justificación. Todas serían ejecutables nativos con el mismo problema de empaquetado y aislamiento que DuckDB sin ofrecer una capacidad que DuckDB o el recorrido propio no cubran para uso interactivo; se reconsideran solo si la puerta de §7.4 falla.

**Decisión propuesta.** L2–L7 con el recorrido propio (sin dependencias nuevas); L8 evalúa DuckDB nativo como acelerador opcional detrás de §7.4; DuckDB-Wasm se queda con el panel SQL actual (≤ 256 MiB).


## 7. Seguridad del DuckDB nativo (PoC 2)

`experiments/large-file-editor/duckdb-native-security.mjs`, DuckDB v2.0.0 (`@duckdb/node-api@2.0.0-r.1`, MIT) en una carpeta aislada. **Ninguna consulta del experimento puede descargar extensiones:** se desactivan `autoinstall`/`autoload` y el repositorio de extensiones apunta a una ruta inexistente antes de ejecutar nada.

### 7.1 Valores por defecto (peligrosos)

`enable_external_access=true`, `autoinstall_known_extensions=true`, `autoload_known_extensions=true`, `allow_community_extensions=true`, `allowed_directories=[]`, `lock_configuration=false`, `memory_limit=25,5 GiB` (80 % de la RAM), `threads=12`, `temp_directory=.tmp` (relativo al directorio de trabajo). **Un `read_csv('http://…')` en una instalación por defecto podría autoinstalar `httpfs` desde Internet.**

### 7.2 Controles que sí funcionan (27 comprobaciones, todas cumplidas, más 2 informativas)

Configuración aplicada en este orden y bloqueada con `SET lock_configuration=true`: `autoinstall/autoload=false`, `custom_extension_repository` inexistente, `memory_limit`, `threads`, `temp_directory`, `max_temp_directory_size`, `allowed_paths` (un archivo exacto) o `allowed_directories`, `enable_external_access=false`.

| Intento | Resultado |
|---|---|
| Leer el CSV autorizado | permitido |
| Leer otro archivo; recorrido `../`; **enlace simbólico dentro de la carpeta autorizada que apunta fuera**; `read_text('/etc/hosts')`; `glob('/etc/*')` | **denegado** |
| `COPY … TO` fuera; `ATTACH` de una base en disco | **denegado** |
| `read_csv('http://127.0.0.1:…')`; `INSTALL httpfs`; `LOAD httpfs` | **denegado**; **0 peticiones** recibidas por un servidor local durante todo el experimento |
| Reactivar el acceso externo, ampliar `allowed_directories`, subir `memory_limit` tras el bloqueo | **denegado** («the configuration has been locked») |
| `allowed_paths=[archivo]`: ese archivo / otro archivo de la misma carpeta / listar la carpeta | permitido / **denegado** / **denegado** |
| Consulta que necesita más memoria **y** más disco temporal que los límites (`memory_limit=512MB`, `max_temp_directory_size=1GB`) | **falla limpiamente** («Out of Memory… 953,6 MiB/953,6 MiB used»); RSS máximo 603 MiB |
| `interrupt()` sobre una consulta de 10^11 filas | la promesa se rechaza **2–3 ms** después |

Una barrera de la aplicación (una sola sentencia y solo `SELECT`, comprobado con `extractStatements` + `statementType` antes de ejecutar) rechaza `select 1; drop table t`, `COPY`, `CREATE`. **Es un primer filtro, no un límite de seguridad:** `pragma database_list` pasa porque DuckDB lo reescribe como `SELECT`; lo que detiene `select * from read_csv('/etc/hosts')` (también un `SELECT`) es la configuración de DuckDB, ya al *preparar* la sentencia. Escribir **dentro** de la carpeta autorizada sí está permitido (con `allowed_paths` de un solo archivo de entrada no hay carpeta donde escribir).

### 7.3 Lo que **no** está demostrado

- **Un proceso auxiliar no es un sandbox.** Un `utilityProcess` de Electron corre con los privilegios del usuario y `ForkOptions` no ofrece opción de sandbox; las únicas barreras demostradas son las de DuckDB, que son de la *aplicación* (un fallo de memoria en el lector de CSV o en una extensión incorporada las saltaría).
- **Capa del sistema operativo:** en macOS, `sandbox-exec` con un perfil correcto bloqueó lectura de `/etc/hosts` y red (`EPERM`); **el primer perfil que escribí no bloqueó nada** porque usaba `/etc/hosts` y `/etc` es un enlace simbólico a `/private/etc` — ilustra lo fácil que es un perfil inofensivo sin darse cuenta. `sandbox-exec` está obsoleto. En Linux (Landlock/seccomp/bwrap) y Windows (AppContainer/token restringido + objeto de trabajo) **no se probó nada**.
- **Empaquetado:** existen paquetes binarios para darwin-arm64/x64, linux-x64/arm64 (+musl) y win32-x64/arm64; solo se midió darwin-arm64 (**64 MB** descomprimidos, además de ~1,7 MB del envoltorio). Falta: `asarUnpack` de los `.node`, firma y notarización en macOS (la carga de una biblioteca nativa desde un `utilityProcess` bajo *hardened runtime* puede exigir `allowLoadingUnsignedLibraries` o firmar el binario), instalador de Windows/Linux, avisos de licencias. **Pendiente en las 4 plataformas.**
- **Dos versiones de DuckDB** si se mantiene Wasm: el nativo es v2.0.0 y DuckDB-Wasm es 1.33.1-dev57; el dialecto y los resultados podrían diferir entre el panel SQL actual y el motor nativo.

### 7.4 Decisión

**No adoptar DuckDB nativo en L2–L4.** Puerta de entrada para L5/L8: (a) proceso auxiliar dedicado con `allowed_paths` exacto + `enable_external_access=false` + `lock_configuration` + extensiones y repositorio desactivados + límites de memoria/disco temporal + `interrupt`, todo con pruebas automáticas como las de este experimento; (b) al menos una capa de aislamiento del sistema operativo demostrada **en cada plataforma publicada**, o un riesgo residual aceptado por escrito; (c) empaquetado y firma comprobados en las 4 plataformas en la CI; (d) una sola versión de DuckDB en el producto o diferencias documentadas. Si (b) no se puede demostrar, **no se adopta** y los análisis grandes se quedan con el motor propio (§6).

## 8. Formatos y casos límite

Evaluado en `tests/overlay.test.mjs` (40 pruebas, en la CI de las 4 plataformas) con fixtures de unos cientos de bytes que fuerzan el modo grande (trozos de 6 bytes, puntos de control cada 2 registros), contra `csv-parse` como oráculo independiente:

| Caso | Estado |
|---|---|
| UTF-8, UTF-8 con BOM, UTF-16LE con BOM, Windows-1252 (indexado, páginas, guardado idéntico sin cambios, cambio de una celda, desplazamiento del índice) | **demostrado** |
| CRLF, LF y **saltos mezclados**; último registro sin salto de línea | **demostrado** (nota: `csv-parse` autodetecta *un* terminador; sus pruebas usan una lista explícita) |
| Saltos de línea y comillas escapadas dentro de comillas; comillas dobles en el valor | **demostrado** |
| Filas irregulares (más y menos columnas), campos vacíos, delimitador final | **demostrado** |
| Ceros a la izquierda; identificador de 17 dígitos (> 2^53) | **demostrado** (nunca se interpretan) |
| TSV con valores entrecomillados y tabuladores | **demostrado** |
| Cambio externo antes y durante el guardado | **demostrado** antes de guardar (cambio total); **parcial** durante (segunda comprobación de huella; carrera residual) |
| Espacio insuficiente | **demostrado con espacio libre inyectado**; disco realmente lleno **pendiente** |
| Cancelación a mitad de guardado, de cambio masivo y de indexado | **demostrado** |
| Recuperación tras `SIGKILL`; diario con última línea truncada; archivo cambiado | **demostrado** |
| Texto que Windows-1252 no puede representar | **demostrado** (se rechaza al editar, no al guardar) |
| Apertura por enlace simbólico; conservación de permisos | **demostrado** (POSIX) |
| **Archivos de prueba hechos por otra herramienta** (`ventas_10MiB`, `100MiB`, `1GiB` y `ancho_150_columnas`, con acentos, comillas, comas, saltos de línea dentro de campos y vacíos) | **demostrado**: el índice cuenta 45 000 / 448 000 / 4 587 000 / 46 000 registros de datos, **igual que su informe de validación**, y los bytes coinciden; 1 GiB en 2,0 s (516 MiB/s) con 35 KiB de índice (`results/user-files-row-counts.json`, `verify-row-counts.mjs`) |
| UTF-16BE, UTF-16 sin BOM, otras codificaciones (Shift-JIS, ISO-8859-x), detección automática | **pendiente** (el motor actual ya detecta algunas; no se portó) |
| Comilla sin cerrar en medio del archivo | **pendiente**: el resto del archivo se leería como un registro; hace falta el tope de 1 MiB por registro con error posicionado (L2) |
| Cadenas de CR solitarias dentro de un archivo LF | **pendiente** (se tratan como parte del registro) |
| Pérdida de energía, sistemas de archivos de red/nube, Windows y Linux a escala GiB | **pendiente** |

## 9. Criterios de aceptación

**Demostrado** = medido en este RFC con la evidencia indicada. **Estimado** = extrapolado de una medición. **Pendiente** = sin medir.

| Capacidad | Criterio propuesto (5 GiB, equipo de gama media) | Estado | Evidencia / valor |
|---|---|---|---|
| Abrir | primera página < 2 s; índice completo con progreso y cancelable | índice completo **demostrado** (10,1 s, caché caliente); primera página antes del índice **estimado**; caché fría **pendiente** | `overlay-5GiB.json` |
| Navegar | página < 50 ms; llegar a cualquier fila; selección estable | páginas **demostrado** (2,6 / 3,8 ms); 500 M de filas **demostrado**; «Ir a la fila» y barra gruesa **pendiente** (L2) | `overlay-5GiB.json`, `scroll.json` |
| Editar | celda < 10 ms; filas; columnas | celda y filas **demostrado** (24 µs/celda); columnas **pendiente** (L7) | pruebas |
| Guardar | sin cargar el archivo; original intacto si falla; < 2× el tiempo de copiar | **demostrado** (5,8 s, 283 MiB RSS; 8,5 s y 287 MiB a 10 GiB) | `overlay-5GiB.json` |
| Buscar | recorrido en flujo cancelable | recorrido **demostrado** (filtro 361 MiB/s ⇒ ~14 s); lista de resultados paginada **pendiente** (L4) | §6 |
| Reemplazar | vista previa de recuento; versión nueva | cambio masivo **demostrado a 1 y 5 GiB** (75 s a 5 GiB); **no escaló a 10 GiB** (813 s, §5); vista previa **pendiente** | §5 |
| Filtrar | vista paginada sin arrays de 4 M de enteros | recuento/filtro **demostrado**; vista paginada de identificadores **pendiente** (L5) | §6 |
| Ordenar | ordenación externa con disco temporal acotado | **ver §6** (motor propio en memoria / DuckDB con derrame) | §6 |
| Estadísticas | resumen por columna en un recorrido | **demostrado** (278 MiB/s propio, 786 MiB/s nativo) | §6 |
| Gráficos | agregados pequeños desde el recorrido | agregación **demostrado** (agrupar); integración con ECharts **pendiente** (L8) | §6 |
| Memoria | < 1 GiB de RSS en cualquier operación | **demostrado**: máx. 531 MiB (cambio masivo a 10 GiB; 439 MiB a 5 GiB), 365 MiB (verificación), ~300 MiB (DuckDB con 4 GB de tope en agregaciones; 5,0 GiB al ordenar el archivo entero, §6) | JSON |
| Disco | aviso antes de crear un temporal o una versión; comprobación de espacio | comprobación **demostrado**; política de versiones **estimado** | §5 |
| Cancelar | cualquier operación < 1 s | guardado, masivo, indexado y consulta nativa **demostrado** (2–3 ms tras `interrupt`) | pruebas, `duckdb-native-security.json` |
| Recuperar | sin pérdida tras cierre del proceso; aviso si el archivo cambió | `SIGKILL` **demostrado**; pérdida de energía **pendiente** | pruebas |

## 10. Riesgos y límites

| # | Riesgo | Mitigación / estado |
|---|---|---|
| R1 | Un cierre del sistema (no del proceso) puede perder operaciones posteriores al último `datasync`. | Política de `datasync` por N operaciones o T ms; **medir su coste** (L9). |
| R2 | `rename` atómico solo dentro del mismo volumen; en SMB/NFS/nube no hay garantía; en Windows falla si otro proceso mantiene el archivo abierto. | Detectar y avisar; no probado. |
| R3 | El guardado pierde propietario/ACL/atributos extendidos/vínculos duros. | Documentar; ofrecer «guardar copia». |
| R4 | Una comilla sin cerrar convierte el resto del archivo en un registro. | Tope de 1 MiB por registro con error posicionado (L2). |
| R5 | La huella de cambio externo (tamaño, `mtime`, hash de 64 KiB en cada extremo) no detecta un cambio del mismo tamaño y `mtime` en el medio del archivo. | Aceptable para uso interactivo; documentar. |
| R6 | Indexar 5 GiB tarda ~10 s en cada apertura; con caché fría puede ser mucho más (no medido). | Primera página antes del índice; índice persistente por huella (estimado). |
| R7 | Cada versión masiva retenida cuesta un archivo completo. | Política de retención y comprobación de espacio (§5). |
| R8 | DuckDB nativo: sin sandbox del sistema operativo demostrado, empaquetado y firma sin probar, dos versiones de DuckDB. | Puerta de §7.4. |
| R9 | El campo editado de un registro muy largo (> 1 MiB) o con millones de columnas. | Tope existente de 1 MiB por celda/registro; 200 columnas en las transformaciones actuales. |
| R10 | Dos ventanas con el mismo archivo editándose a la vez. | La segunda debe abrirse de solo lectura (no implementado). |
| R11 | Mediciones de un único equipo con caché caliente. | Benchmarks manuales/nocturnos de 1/5/10 GiB en las 3 plataformas (L9). |
| R12 | A 10 GiB el índice, las páginas y el guardado escalaron casi linealmente en tiempo y con memoria plana (≤ 287 MiB), pero el **cambio masivo no**: 813 s frente a 75 s a 5 GiB, y la verificación posterior 2119 s frente a 15 s. | Causa **no determinada** (hipótesis: presión de caché/memoria con fixture + copia + versión nueva = 30 GiB en 32 GiB de RAM, o carga ajena: al terminar, el sistema tenía una carga de 15 con 12 núcleos y el Finder al 86 % de CPU, y dos pruebas pesadas de `npm test` agotaron su tiempo de 90 s en una de tres ejecuciones; **no se descarta que Spotlight o el Finder estuvieran leyendo los fixtures**); volver a medir aislado. No prometer el cambio masivo de 10 GiB hasta entonces. |

## 11. Hoja de ruta (L1–L9)

Cada paso es un PR pequeño y verificable, con la prueba que falla primero.

| Paso | Contenido | Puerta de salida | Estado |
|---|---|---|---|
| **L1** | Corrección de navegación (altura máxima de Chromium) | CI verde en 4 SO; E2E con 1 M de filas | PR #52 en revisión |
| **L2** | Lectura grande de solo lectura: índice disperso en un proceso de utilidad, páginas por posición, progreso/cancelación, detección de codificación/BOM/saltos, tope de 1 MiB por registro con error posicionado, «Ir a la fila N», posición anclada. Sustituye la muestra de 200 filas. Umbral del modo grande configurable por variable de entorno, para que fixtures de unos cientos de bytes fuercen el modo grande en la CI | 1 y 5 GiB (manual) y fixtures de CI; memoria < 1 GiB | **implementado en solo lectura** ([evidencia](../evidence/l2-lectura-grande-2026-10-24.md)): índice y páginas, progreso y cancelación, «Ir a la fila», aviso con la posición de un registro de más de 1 MiB, umbral configurable para CI. Pendiente: índice persistente y caché fría |
| **L3** | Edición puntual: capa + diario + guardado atómico + recuperación al abrir + cambio externo + espacio libre + cancelación | las pruebas de este RFC trasladadas al producto + E2E | propuesto |
| **L4** | Búsqueda y reemplazo en flujo: lista de resultados paginada; reemplazo = versión nueva con vista previa de recuento | cancelable; 5 GiB manual | propuesto |
| **L5** | Vistas (filtro/orden) como listas de identificadores en disco; estadísticas por recorrido; ordenación externa. Motor propio por defecto | memoria acotada en 5 GiB | propuesto |
| **L6** | Cambios masivos versionados e historial por versiones; transformaciones actuales en flujo; política de espacio | volver a una versión sin cargarla | propuesto |
| **L7** | Filas y columnas estructurales (altas/bajas, cabecera) con la capa/versión | índice reconstruido tras altas/bajas | propuesto |
| **L8** | Gráficos y SQL sobre fuentes grandes; **aquí entra la decisión de DuckDB nativo** (puerta de §7.4) | seguridad y empaquetado en 4 SO | condicionado |
| **L9** | Endurecimiento: pérdida de energía, Windows/Linux a escala, benchmarks nocturnos 1/5/10 GiB, unificación o retirada del motor en memoria | umbrales de §9 en las 3 plataformas | propuesto |

## 12. Recomendación

1. **Aprobar la dirección**: original canónico + índice disperso + capa con diario + guardado en flujo atómico (§4), y la separación puntual/masivo con versiones (§5). Es lo único probado a 5 GiB en este RFC.
2. **Implementar L2 y L3 a continuación**, en ese orden, junto con L1. **No aprobar L1 solo**: sin L2 el usuario sigue viendo una muestra de 200 filas, y sin L3 solo *ve* el archivo, no lo edita.
3. **Primera iteración recomendada:** L2 (lectura grande), porque es lo que desbloquea `conjunto_de_datos_ageb_urbana_20_cpv2020.csv` y es la base de todo lo demás; es de solo lectura, así que su riesgo de pérdida de datos es nulo.
4. **No adoptar DuckDB nativo** hasta que se cumpla §7.4. Para el análisis de campos, usar el recorrido propio (§6): ya es 8–12 veces más rápido que el `csv-parse` actual, sin dependencias nuevas.
5. **No prometer «sin límite»**: prometer 5 GiB con lo medido. A 10 GiB la edición puntual y el guardado se demostraron; el cambio masivo no escaló (§4.7) y no se promete hasta entenderlo. Declarar los límites de §10.

## 13. Reproducibilidad y evidencia

`experiments/large-file-editor/README.md` tiene los comandos. Resultados en `experiments/large-file-editor/results/`:

| Archivo | Contenido |
|---|---|
| `overlay-5GiB.json` | PoC 1: clonación, índice, páginas, ediciones, recuperación, guardado, verificación por hash, cambio masivo, versiones |
| `duckdb-native-security.json` | PoC 2: valores por defecto, valores endurecidos, 29 entradas (27 comprobaciones + 2 informativas) |
| `scroll.json` | PoC 3: 1 M – 500 M de filas |
| `engines.json` | PoC 4: motores × tareas × tamaños, con el resumen (hash) del resultado de cada motor para comprobar que coinciden |

Generador de fixtures: `gen-fixture.mjs` (determinista, comprueba espacio libre, se niega a escribir dentro del repositorio, deja SHA-256). Los benchmarks de 1/5/10 GiB **no están en la CI**; la CI ejecuta solo `node --test experiments/large-file-editor/tests/overlay.test.mjs`.

## 14. Correcciones a afirmaciones anteriores

- **«El guardado conserva el CSV byte a byte»** (afirmado antes en esta conversación) es **falso** para el motor actual: `serialize()` re-escribe todo con `csv-stringify` y normaliza las comillas (verificado experimentalmente). Lo que sí se demuestra aquí es que el diseño propuesto conserva los bytes de los registros no tocados.
- La «muestra de 200 filas» del usuario no es un fallo del desplazamiento: es el límite de 50 MiB / 2 M de celdas del motor (`table-engine.ts:16`). El PR #52 corrige otro defecto (el techo de altura de Chromium) que se produce con tablas que sí caben en memoria.
