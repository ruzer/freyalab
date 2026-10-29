# L4 · Medición previa de la búsqueda en archivos grandes y papel del SQL

2026-10-28 · medido por Claude, **antes de que exista código de L4a**, para orientar el diseño de [`docs/stories/9-csv-grande.md`](../stories/9-csv-grande.md). No sustituye la medición S0 que Codex debe repetir con el código real y sus fixtures: es una referencia de orden de magnitud.

## Condiciones

Apple M2 Max, 12 núcleos lógicos, 32 GiB, macOS arm64, Node v26.11.1 (el producto usa Node 24), **caché del sistema caliente**, una sola máquina, sin otros trabajos pesados. Los módulos medidos son los de `main` `33a5dfd` (`src/main/large-table.ts`: `buildIndex`, `recordBatches`, `splitFields`; `csv-parse/sync` como en `src/main/operations.ts`). Ninguna fuente de la aplicación se modificó.

Fixture sintético (no son datos reales): **529 MiB, 400.000 filas × 230 columnas**, ≈ 1,35 KiB por fila, como los fixtures del RFC. Columna 1 entera, columna 2 con texto entrecomillado con comas, columna 3 con uno de 20 nombres de municipio (con acentos), columnas 4 a 40 enteros y el resto texto corto. Se generó con un script de 20 líneas (no incluido; lo debe reproducir Codex con `experiments/large-data-extracts/generate_sales.py` o equivalente).

## 1. Estrategias de recorrido (una pasada por el archivo)

Regla de coincidencia: subcadena sin distinguir mayúsculas en cualquier celda (`toLocaleLowerCase().includes`), como la búsqueda de la tabla editable. Una medición por celda; no es una serie estadística.

| Estrategia | «mérida» (20.000 coincidencias) | «zzq99» (0) | «12345» (162) |
|---|---|---|---|
| Suelo: solo delimitar registros (`recordBatches`) | 0,9 s · 576 MiB/s | | |
| **S0 estricto** (`csv-parse/sync` por lote de 2.000 registros, como Extraer) | 18,0 s · 29 MiB/s | 18,5 s · 29 MiB/s | 18,9 s · 28 MiB/s |
| **S1 propio completo** (decodificar + `splitFields` + comparar) | 3,8 s · 138 MiB/s | 4,5 s · 118 MiB/s | 4,6 s · 116 MiB/s |
| **S2 prefiltro por bytes** (ASCII plegado + `indexOf` sobre el lote; solo se verifica con la regla exacta el registro que contiene la aguja) | no aplica (aguja con acento) | 1,5 s · 348 MiB/s | 2,0 s · 271 MiB/s |

El número de coincidencias fue idéntico en las estrategias que se aplicaron a cada aguja (20.000 / 0 / 162). El índice disperso de L2 se construyó en 1,0 s (525 MiB/s).

**Condición sobre una columna** (columna 3 contiene «mérida»): separar los campos solo hasta esa columna, **1,1 s · 495 MiB/s**; separar todos, 2,8 s · 191 MiB/s (mismas 20.000 coincidencias).

**Recorrido en paralelo** (aguja «12345», prefiltro S2, procesos independientes, cada uno con un rango de bytes que empieza en un desplazamiento del índice disperso, que cae siempre en el inicio de un registro): 1 proceso 2.007 ms; **4 procesos 524 ms; 8 procesos 340 ms** (tiempo del más lento; no incluye construir el índice). Mismas 162 coincidencias y 400.001 registros en los tres casos.

## 2. Lo que dicen estas cifras

1. Dejar de validar con `csv-parse` en las rutas de **solo lectura** (buscar y filtrar) es la mejora mayor: 4 a 5 veces. Extraer, que escribe un archivo, conserva la validación estricta.
2. El prefiltro por bytes aporta 2,3 a 3 veces más, **solo para agujas ASCII**, y exige no tener falsos negativos (véase la historia, criterio B25).
3. Una condición sobre una columna se acelera ≈ 2,6 veces separando solo hasta esa columna.
4. Partir el archivo en rangos con el índice disperso, que ya existe, escala casi linealmente hasta 4 procesos (3,8×) y bien hasta 8 (5,9×) **con caché caliente**; con caché fría el límite será el disco.
5. Extrapolación lineal (**no medida**) a 5 GiB: ≈ 3 min con el motor estricto, ≈ 40 s con el recorrido propio, ≈ 15 a 19 s con prefiltro y varios segundos con rangos en paralelo.

## 3. El SQL actual (DuckDB-Wasm, «Analizar → SQL»)

Medido en la aplicación (`main` `33a5dfd`, build limpio, `window.freya.sqlRun` con `SELECT count(*) FROM datos WHERE …`). Las tres primeras filas son archivos que la aplicación abre en modo grande.

| Archivo | Celdas | Resultado |
|---|---|---|
| 72.000 × 28 | 2,0 M | 2,4 s la primera consulta y 2,4 s la segunda; con una o con todas las columnas |
| 72.000 × 100 | 7,2 M | 7,8 s, 8,3 s y 8,2 s |
| 72.000 × 230 | 16,6 M | rechazado: «El análisis admite hasta 200 columnas por fuente.» |
| 400.000 × 230 (529 MiB) | 92 M | rechazado por el mismo motivo |

Conclusiones: cada consulta **vuelve a leer y cargar el archivo** (la segunda cuesta lo mismo que la primera); el coste es la carga (lectura estricta con `csv-parse` y paso a Apache Arrow, `src/main/analysis-source.ts`), no la consulta; sus topes son 200 columnas, 8 M de celdas, 2 M de filas y 256 MiB. Sirve para archivos medianos con pocas columnas; no es un motor de búsqueda para archivos grandes. El DuckDB **nativo** del RFC (§6) es la vía rápida para agregaciones y ordenaciones, condicionada a la puerta de §7.4 y no está en el producto.

## 4. Límites de esta medición

- Una máquina, un archivo sintético, un cálculo por celda, caché caliente; **caché fría, Windows y Linux sin medir**.
- El paralelismo se probó con **procesos** independientes, no con hilos de trabajo ni con el proceso de tablas de la aplicación (`utilityProcess`); no se midió el coste de enviar resultados entre procesos ni la contención de memoria.
- El prefiltro S2 se comprobó solo por el recuento de coincidencias en este archivo, **no** con el fixture hostil del producto (comillas dobladas, saltos de línea dentro de campos, UTF-16, el signo Kelvin y la «İ»). Su paridad es una exigencia de la historia (B25), no un hecho demostrado aquí.
- La extrapolación a GiB es lineal y no está medida.
- No se midió memoria (RSS) de ninguna estrategia en esta pasada; el RFC da ≈ 280 MiB para el recorrido propio.
