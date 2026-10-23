# Comprender columnas — DW-04a y DW-04b

## Vista general de columnas — DW-04b vigente

Desde **Estadísticas → Comprender todas las columnas → Explorar columnas**, se obtiene una lista compacta de perfiles sin cambiar el CSV. La exploración se inicia mediante botón o teclado; abrir el archivo o el panel no ejecuta el análisis automáticamente. Reutiliza la exploración individual existente, una columna cada vez.

Antes de empezar se eligen dos alcances independientes:

- **Columnas:** todas o las marcadas en la tabla al iniciar. La identidad incluye la posición original, incluso con encabezados duplicados o vacíos.
- **Filas:** documento completo o vista filtrada. Cuando el editor está en modo muestra, las opciones son **Muestra completa** y **Vista filtrada de la muestra**: describen únicamente los registros cargados, nunca el archivo completo.

Cada fila presenta el nombre y posición, tipo probable, contenido, ausentes, vacíos exactos, solo espacios, distintos exactos y repeticiones adicionales. El tipo es un control desplegable con su explicación, accesible por teclado. **Explorar detalle** abre el perfil individual de esa posición y conserva el alcance de filas elegido; no depende de que el nombre sea único. La búsqueda por nombre o posición y las páginas de **50 columnas** solo cambian la lista visible, no los cálculos.

El estado muestra revisión, filas por columna, alcance y progreso. Los resultados que aparecen durante el recorrido son provisionales. **Abrir informe de columnas Markdown** queda disponible al terminar y recoge todas las columnas solicitadas, aunque se esté mostrando otra página o una búsqueda de nombres. Conserva fuente, revisión, cambios pendientes, fecha y filtros capturados. Si una columna supera el límite de cardinalidad se marca **No disponible** y se continúa con las demás; el informe declara **cobertura parcial** y no inventa ceros para sus recuentos.

### Presupuesto y cancelación

Se admiten hasta **2 000 columnas solicitadas**, **dos millones de posiciones de celdas** (filas del alcance × columnas solicitadas, incluidos campos ausentes) y **100 000 valores distintos por columna**. El límite de posiciones se comprueba antes de recorrer las columnas; para reducirlo se pueden marcar menos columnas o elegir una vista filtrada. Tras dos minutos, un temporizador de la interfaz abandona la exploración y solicita cancelación; no es un límite duro del motor ni garantiza que todo trabajo haya terminado en ese plazo. Son presupuestos de esta exploración, no una ampliación de la edición CSV ni del análisis SQL.

**Cancelar exploración de columnas** descarta la vista provisional y solicita detener la exploración activa. También se invalida al cambiar documento/revisión, alcance, filtros u orden cuando se analiza la vista filtrada, o columnas marcadas cuando se usa esa selección, y al cerrar el panel. Paginar la misma vista no invalida la exploración; cambiar filtros tampoco altera un análisis del documento completo. Una respuesta antigua no repuebla la lista ni habilita su informe. La comprobación del presupuesto reutiliza el recuento del documento o los metadatos ya aceptados de la vista filtrada; esta última espera la revisión y filtros vigentes antes de habilitarse. No inicia otra consulta de paginación. La cancelación del análisis es cooperativa entre bloques y los cálculos síncronos en curso terminan antes de descartarse. Los errores de revisión, cancelación o presupuesto invalidan la exploración; solo el exceso de valores distintos de una columna se conserva como fallo parcial.

No se añaden IPC, backend, parser, dependencia ni datasets. El documento textual y su historial permanecen bajo el motor CSV existente; esta lista no crea extractos persistentes ni modifica la política de muestras.

## Perfil individual — antecedente conservado DW-04a

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

## Progreso y pendientes

**Registro histórico al cerrar DW-04a:** faltaban una vista conjunta de columnas, completar moda/varianza/percentiles y medir el coste de exploración conjunta.

**Actualización DW-04b:** la vista conjunta bajo demanda y su informe son el alcance de esta entrega. DW-04 sigue abierto para moda, varianza, percentiles y las comprobaciones de coste y cobertura que falten; no se declara terminada por disponer de esta lista. DW-05, recomendaciones modificables de análisis, sigue pendiente: no se generan ni configuran gráficos automáticamente. Validación con estudiantes/profesionales y lectores de pantalla sigue pendiente.
