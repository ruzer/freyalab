# Comprender una columna — DW-04a

Desde **Estadísticas → Explorar una columna → Explorar columna**, FreyaLab presenta un tipo probable, su explicación y un resumen de calidad antes de las medidas existentes. La exploración se solicita con un botón o teclado; no recorre automáticamente todas las columnas al abrir un archivo.

Es una interpretación del alcance elegido, no un cambio de formato. Un perfil de muestra o de vista filtrada no describe el archivo completo. Si cambian los datos o filtros, el resultado se invalida hasta volver a explorar. La misma interpretación y los mismos recuentos se incluyen al abrir el informe Markdown.

## Cómo se sugiere el tipo

Se examinan todos los valores del alcance, sin utilizar únicamente las 50 frecuencias mostradas. Los espacios exteriores no impiden reconocer un número o fecha, pero permanecen intactos en el documento.

| Sugerencia | Evidencia |
|---|---|
| Sin datos | No hay campos con contenido |
| Posible identificador | Encabezado con una palabra de identificación (`id`, `código`, `clave`, `folio`, `code`, `uuid`, `rfc`, `curp`, `sku`, `zip`), números con ceros iniciales o enteros fuera del rango seguro |
| Numérico | Todos los valores con contenido son números utilizables y no hay esas señales de identificador |
| Fecha ISO | Todos los valores con contenido son fechas de calendario válidas `AAAA-MM-DD`, entre 0001 y 9999 |
| Mixto o con valores incompatibles | Hay mezcla de números/fechas/texto, o valores con forma de fecha ISO cuyo calendario es inválido |
| Categórico | Texto sin números/fechas reconocidos, con repeticiones y hasta 20 valores distintos con contenido |
| Texto | No se cumplen las reglas anteriores |

El nombre se compara por palabras, ignorando acentos y distinguiendo palabras camelCase habituales (`idCliente`); `Identidad` o `Idioma` no se consideran `id`. Las señales de identificador son conservadoras y tienen prioridad: un valor aislado puede cambiar la sugerencia. El usuario conserva los cálculos manuales y la elección explícita de tipos en gráficos; no se genera ni configura automáticamente un gráfico en DW-04a.

Las categorías son una sugerencia explicable de agrupación, no una certeza semántica ni un porcentaje de confianza. Repetir una categoría no significa que exista un error. Fechas como `01/02/2026`, timestamps y zonas horarias permanecen como texto; no se adivina su interpretación. La comprobación de calendario reutiliza la función existente de filtros, manteniendo sus reglas; la inferencia excluye el año 0000 para coincidir con los gráficos.

## Calidad sin confundir casos

Los cuatro recuentos son disjuntos y suman las filas analizadas:

- **Con contenido:** campo presente con algún carácter que no sea espacio.
- **Campos ausentes:** la fila termina antes de esa columna.
- **Campos vacíos exactos:** campo presente con valor `""`.
- **Solo espacios:** campo presente no vacío, compuesto por espacios en blanco.

La medida avanzada «Vacíos» conserva su significado anterior: suma de ausentes, campos vacíos y solo espacios. Las frecuencias/duplicados también mantienen la comparación textual anterior; no se redefine esa funcionalidad al añadir el resumen.

## Reutilización y límites

La misma pasada de `table-analysis.ts` recoge la evidencia, en el proceso tabular. Se conservan validación, revisión, cancelación cooperativa y límite de 100 000 valores distintos. No hay otro parser, motor, dependencia o canal IPC. El CSV original y su historial no cambian. Los perfiles no son bases de datos persistentes ni extractos versionados.

`columnSummary` comparte los rótulos, explicaciones y calidad entre interfaz e informe Markdown. Las estadísticas, frecuencias, distribución y Pearson existentes continúan disponibles. Las sugerencias no modifican qué valores se incluyen en esos cálculos manuales.

DW-04 sigue abierto: falta una vista conjunta de columnas, completar moda/varianza/percentiles y medir el coste de exploración conjunta. DW-05 añadirá recomendaciones modificables de análisis; no se presenta aquí como implementado. Validación con estudiantes/profesionales y lectores de pantalla sigue pendiente.
