# AN-2 — Información y Estadísticas al estilo `info()` y `describe()`

Depende de AN-1 (pestaña «Análisis»). Rediseña dos secciones de esa pestaña para que quien analiza datos encuentre lo que conoce de pandas: `df.info()` y `df.describe()`. No hay Python: se calcula con el motor que ya existe.

## Historia
Como persona que analiza un dataset, quiero pulsar «Obtener información» y «Calcular estadísticas» y ver lo mismo que me darían `df.info()` y `df.describe()`, con los mismos números, para entender el CSV sin salir de FreyaLab.

## Evidencia (main 3a2404a)
- **Ya existe casi todo, pero mal presentado.**
  - «Estadísticas por columna» (`CsvStatistics.svelte`) calcula Celdas, Vacíos, Únicos, Numéricos, Suma, Media, Mín., Máx., Mediana, desviaciones (n y n−1), P10, P25, P75, P90 y varianzas.
  - Lo muestra con una fila por columna y 20 columnas de estadísticas, dentro de una caja de 140 px de alto. Delante va un párrafo de ayuda largo.
  - P25 y P75 quedan escondidos tras la casilla «Varianza y percentiles».
- «Comprender todas las columnas» (`CsvColumnsOverview.svelte`) da Tipo probable (Identificador, Categórico, Numérico, Fecha ISO, Texto, Mixto), Con contenido, Ausentes, Vacíos exactos, Solo espacios, Distintos y Repeticiones.
- **Mismos criterios que pandas.**
  - La desviación muestral es `sqrt(sampleVariance)` (n−1), igual que `std` de pandas.
  - Los percentiles de `simple-statistics.quantile` coinciden con el método lineal de pandas. Comprobado con [1,2,3,4], [1..5] y [10..70]: P25 de [1,2,3,4] = 1,75.
- **Lo que falta frente a `describe(include='all')`:**
  - top y freq: el valor más repetido solo aparece en «Explorar una columna».
  - Mínimo y máximo de fechas: hoy las fechas cuentan como texto.
  - La cabecera de `info()`: filas × columnas, tamaño y recuento de columnas por tipo.
- **`SUMMARIZE` de DuckDB no sirve.** Probado en la pestaña SQL: el motor carga todo como texto. No da media ni desviación, y el máximo de «Precio» sale «4» porque compara texto. No lo uses.

## Diseño UX
**Sección Información** (`info()`): un botón, «Obtener información». Al terminar muestra:
1. **Cabecera:** «240 filas × 7 columnas · 18,4 KB · UTF-8 · coma · con encabezado». Con solo lectura o muestra, añade «· muestra».
2. **Tipos:** fichas con el número de columnas de cada tipo, por ejemplo «3 categóricas · 2 numéricas · 1 fecha · 1 identificador». Solo aparecen los tipos presentes.
3. **Tabla, una fila por columna:**

   | # | Columna | Tipo probable | Con contenido | Vacíos | Distintos | Detalle |
   |---|---|---|---|---|---|---|

   Vacíos incluye ausentes y solo espacios, con el desglose en la ayuda. «Detalle» abre «Explorar una columna» en Estadísticas.

**Sección Estadísticas** (`describe()`): un botón, «Calcular», y la casilla «Incluir texto y fechas», apagada al empezar.
- **Tabla traspuesta, como pandas:** una fila por estadística y una columna por columna del CSV. La primera columna queda fija al desplazar en horizontal.
- **Sin la casilla**, solo las columnas de tipo Número, con estas filas:

  | Fila | Ayuda al pasar el ratón y para lector de pantalla |
  |---|---|
  | count | «valores numéricos» |
  | mean | «media» |
  | std | «desviación estándar muestral (n−1)» |
  | min | «mínimo» |
  | 25% | «percentil 25, interpolación lineal» |
  | 50% | «mediana» |
  | 75% | «percentil 75» |
  | max | «máximo» |

- **Con la casilla**, se añaden las columnas de texto, categoría, identificador, mixtas y fechas, con las filas count, unique, top y freq.
  - Para las fechas ISO también se rellenan min y max.
  - Las celdas que no corresponden a un tipo quedan vacías, como los NaN de pandas.
- **Formato:** hasta 4 decimales, en el formato numérico del idioma. El valor completo aparece al pasar el ratón y en el informe.
- **Acciones:** «Abrir informe Markdown» (ya existe) genera esta misma tabla traspuesta.
- **Ayuda:** un «Cómo se calcula», plegado, con tres líneas:
  - «Mismos criterios que pandas: std con n−1 y percentiles lineales.»
  - «Las columnas que parecen identificadores no se promedian.»
  - «Los números con coma decimal se tratan como texto.»
  - El párrafo largo de hoy deja de ir delante de los resultados.
- **Alcance:** «Documento completo», «Vista filtrada» y «Columnas marcadas», como hoy (de AN-1). «Celdas del rango» queda como hoy, en su vista propia.
- **Paleta:** «describe» lleva a Estadísticas y «info» a Información.

## Reglas de cálculo
- **Tipo de cada columna:** se usa el de `ColumnProfile.kind`.
  - number → sección numérica.
  - date → fecha.
  - identifier, category, text, mixed → texto. Las mixtas son object en pandas, así que no se promedian, y en la cabecera de la columna dicen «mixta».
  - empty → solo count 0.
- **count (numérica):** valores numéricos. **count (texto o fecha):** celdas con contenido. Las vacías y las de solo espacios no cuentan.
- **unique:** texto exacto, como «Únicos». **top/freq:** el valor más repetido y sus apariciones. En caso de empate gana el que aparece antes en el archivo; la ayuda lo indica.
- **min/max de fecha:** sobre las fechas ISO válidas. Las inválidas se cuentan aparte en la ayuda, como hoy.
- **Coste:** reutiliza `stats` y `analyzeColumn`, que ya devuelve frecuencias y perfil. Como mucho dos llamadas por columna, con progreso y cancelación. Se mantiene el límite de 100 columnas por cálculo, con su mensaje.
- **Sin dependencias nuevas.**

## Aceptación
1. Con el fixture de abajo, Estadísticas da exactamente estos valores (tolerancia relativa 1e-12 en los reales):

   ```
   Producto,Precio,Cantidad,Alta,Mixta
   a,10,1,2026-01-02,1
   b,20,2,2026-03-04,x
   a,30,3,2026-02-01,1
   c,40,4,2026-01-15,
   a,,,2026-02-20,
   a,50,,2026-01-30,
   ```

   | | Precio | Cantidad |
   |---|---|---|
   | count | 5 | 4 |
   | mean | 30 | 2,5 |
   | std | 15,811388300841896 | 1,2909944487358056 |
   | min | 10 | 1 |
   | 25% | 20 | 1,75 |
   | 50% | 30 | 2,5 |
   | 75% | 40 | 3,25 |
   | max | 50 | 4 |

   Con «Incluir texto y fechas»:

   | | Producto | Alta | Mixta |
   |---|---|---|---|
   | count | 6 | 6 | 3 |
   | unique | 3 | 6 | 2 |
   | top | a | — | 1 |
   | freq | 4 | — | 2 |
   | min | — | 2026-01-02 | — |
   | max | — | 2026-03-04 | — |

   En Alta, top y freq quedan vacíos: no hay repetidos y en las fechas no se muestran. Son los valores de pandas `describe()` para numéricas y `describe(include='object')` para Producto y Mixta, calculados con las mismas fórmulas.
2. Información con el mismo fixture: «6 filas × 5 columnas», las fichas «2 numéricas · 1 fecha · 1 categórica · 1 mixta» y la tabla con Con contenido 6, 5, 4, 6 y 3. Son los tipos que da hoy `ColumnProfile.kind`, comprobados con las reglas de `table-analysis.ts`.
3. Nada se calcula hasta pulsar «Obtener información» o «Calcular» (espía de IPC de AN-1).
4. Editar el CSV con resultados a la vista muestra el aviso de datos cambiados. Al recalcular salen los valores nuevos.
5. Con 120 columnas aparece el mensaje del límite de 100. Con 100, la tabla traspuesta se desplaza en horizontal con la primera columna fija y no hay desbordamiento de página.
6. El informe Markdown reproduce la tabla traspuesta con los valores completos.
7. Lector de pantalla: la tabla tiene `caption`, y los encabezados de fila y columna son `th` con `scope`. Cada abreviatura (std, 25%) tiene su nombre largo en el nombre accesible.
8. Capturas a 1440×900 en claro y oscuro, en es y en-XA.

## Casos límite
- Columna numérica con un solo valor: std vacío (pandas da NaN), sin error.
- Columna toda vacía: count 0 y el resto vacío.
- Enteros fuera del rango seguro o `1e309`: se excluyen y se cuentan como hoy («Excluidos»), con nota.
- Números con coma decimal (`1.234,56`): texto, tal como dice la ayuda.
- Fechas con espacios alrededor: siguen la regla actual de `dateReadCompatible`. Documenta si cuentan para min y max.
- Archivo grande: desactivado con el motivo de AN-1.

## Plan de pruebas
- Unitarias: construcción de la tabla traspuesta y de top y freq con empates, a partir de resultados de `stats` y `analyzeColumn` simulados.
- E2E (`tests/e2e/analysis-describe.spec.ts`): criterios 1 a 7 con el fixture. Rojo primero en main.

## Fuera de alcance
- Media y percentiles de fechas (pandas los da para datetime). Queda anotado para después.
- Leer números con coma decimal en Estadísticas (existe «Cómo leer» en columna calculada; unificarlo es otra historia).
- Correlaciones, histogramas por columna y estadísticas de la selección en la barra de estado.

## Entrega
Un PR en borrador, base `main`, después de AN-1b. Informa: SHA, pruebas rojas y verdes con su salida, capturas, CI de las tres plataformas y una nota si algún valor difiere de la tabla del criterio 1.
