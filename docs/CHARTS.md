# Gráficos del editor CSV

Entrega de desarrollo sobre los PR #13/#14; no es una función publicada en alpha.1. Abre un CSV y pulsa **Gráficos**. Elige un tipo, columnas y opciones; pulsa **Generar gráfico**. No necesitas escribir SQL. La consulta reproducible está en «Consulta y precisión del gráfico».

El panel reutiliza DuckDB-Wasm y el puente de análisis existentes; no incorpora otro modelo de edición ni permisos de archivos. Apache ECharts **6.1.0**, Apache-2.0, dibuja con SVG y carga al abrir el panel mediante importación diferida. Se registran solo las series/componentes utilizados, con avisos en `THIRD_PARTY_NOTICES.txt`.

## Datos, alcance y límites

- Analiza **toda la fuente** y los cambios pendientes del documento editable. Los filtros/orden de la tabla no se aplican a los gráficos; el panel lo indica. Una fuente abierta como muestra se vuelve a leer completa desde disco con las comprobaciones del motor SQL.
- Se mantienen los límites del análisis: 256 MiB por fuente, dos millones de filas, 200 columnas y ocho millones de celdas. No promete archivos de GB.
- Las agregaciones se calculan antes de limitar los elementos dibujados. Barras/cajas: primeras 100 categorías; mapa: primeros 400 pares; líneas/dispersión: primeros 2 000 puntos. No es muestreo aleatorio. La vista parcial se identifica tanto en el panel como dentro de SVG/PNG/PDF. Histograma: de 1 a 30 intervalos.
- El motor transfiere solamente el resultado acotado, paginado de 100 en 100, a la interfaz. La tabla alternativa muestra páginas de 50; tiene todos los elementos dibujados y valores originales de categoría, incluso si las etiquetas del eje se abrevian.
- Números aproximados con punto decimal y exponente opcional. Se excluyen vacíos, texto no numérico, infinitos y magnitudes superiores a 9 007 199 254 740 991. Las conversiones afectan exclusivamente al análisis. Por ejemplo `0005` puede ser una medida numérica si el usuario elige esa columna; su contenido CSV sigue siendo `0005`. Los identificadores grandes permanecen como texto en el editor.
- Las categorías se agrupan por texto completo exacto; vacío y campo ausente son distintos. Su índice en el eje evita confundir categorías con etiquetas visualmente parecidas.

## Los seis tipos

| Tipo | Cálculo y orden |
|---|---|
| Histograma | Intervalos de igual amplitud `[desde, hasta)`, último cerrado; recuentos incluyen todos los numéricos utilizables. Una constante produce un intervalo. |
| Barras | Categoría elegida; contar filas, suma o promedio. Orden explícito ascendente/descendente por resultado, empate por categoría. Las categorías sin medida utilizable conservan NULL; no se inventa un cero. |
| Líneas | X e Y explícitamente numéricas, orden X ascendente/descendente y fila original en empates. X inválidas se omiten; Y inválidas dejan un hueco (`connectNulls: false`). No infiere fechas ni intervalos regulares. |
| Dispersión | Pares numéricos de la misma fila; orden X y fila original, con recuentos de exclusión y límite de puntos explícitos. |
| Mapa de calor | Conteo de cada par de categorías exactas. Las combinaciones ausentes quedan sin celda; no se imputan ceros. Escala visible y tabla alternativa. |
| Caja | Por categoría: cuartiles `quantile_cont` (Hyndman–Fan tipo 7); bigotes hasta observaciones dentro de 1,5 × RIC; conteo exacto de atípicos. Dibuja hasta los primeros 20 atípicos por categoría, orden numérico, y lo informa. |

## Interacción y exportación

Los selectores, botones de tamaño, exportación y tabla alternativa admiten teclado. Escape desde el panel lo cierra y devuelve el foco a **Gráficos**. La región ampliada se puede desplazar con teclado. El tamaño responde al panel y el tema cambia sin recalcular los datos. La descripción accesible se complementa con la tabla; no se ha certificado con lectores de pantalla.

**Exportar gráfico SVG/PNG/PDF** reutiliza la exportación aislada y saneada existente, con escritura segura y rechazo de destinos que sean documentos abiertos. Exporta el dibujo actual y sus recuentos/límites; no exporta el CSV ni guarda cambios pendientes. El SVG incorpora las fuentes locales Inter y JetBrains Mono; PNG y PDF usan ese mismo dibujo para conservar la tipografía. La imagen también puede exportarse cuando el editor abre el CSV como muestra: el gráfico se calcula sobre la fuente completa, dentro de los límites de análisis. La muestra de la tabla no se convierte en un documento completo; Guardar y exportar el CSV/TSV siguen bloqueados. Una vista limitada de puntos o categorías mantiene su aviso dentro de la imagen.

La exportación guarda una instantánea del dibujo mostrado; no vuelve a leer el CSV ni recalcula el análisis. Si la revisión de la sesión cambia mientras se elige el destino o se genera el archivo, se rechaza la exportación y se pide generar de nuevo el gráfico.

Cambiar columnas/opciones o editar el documento invalida el resultado. Un cambio externo en disco también lo invalida. Cancelar destruye el proceso SQL y descarta respuestas antiguas; cerrar el panel cancela su solicitud y libera el dibujo y observadores. Se conserva el límite de dos minutos y las protecciones de DuckDB: sin red/disco mediante SQL, extensiones ni configuración modificable. Los atípicos usan funciones del núcleo; no se habilita la extensión JSON.

Las etiquetas del archivo no se insertan como HTML. ECharts usa SVG y tooltips de texto (`richText`); la tabla usa texto escapado de Svelte. Las imágenes exportadas pasan por el saneador SVG y ventana aislada existentes.

## Verificación

- `tests/charts.test.ts`: opciones/identificadores, recuentos, vacío frente a muestra limitada, huecos en líneas, series de caja, datos ausentes de mapa y tooltip sin HTML.
- `tests/e2e/charts.spec.ts`: seis consultas reales DuckDB con resultados conocidos; seis SVG en la interfaz, temas, teclado, PNG con píxeles de dibujo y PDF, invalidación por edición, cancelación, datos vacíos/constantes, etiquetas hostiles, paginación/límite de puntos y un millón de filas con muestra de 200 en el editor. Comprueba que el CSV original permanece intacto.
- `tests/graphic-export.test.ts`: el guardián original de muestras sigue rechazando todos los formatos del documento; la operación gráfica no serializa la tabla y protege revisión, tipo de fuente, cancelación y destinos.
- La suite E2E añade un CSV válido mayor de 50 MiB con 2 400 filas: exporta tres formatos, conserva un gráfico parcial de 2 000 puntos, rechaza peticiones tabulares/HTML/revisiones antiguas y comprueba SHA-256 y estado del original.
- La CI ejecuta la suite y después vuelve a ejecutar SQL/gráficos desde la app empaquetada en macOS ARM/Intel, Windows y Ubuntu. No equivale a probar instaladores manualmente.

Referencias: [importaciones modulares ECharts](https://echarts.apache.org/handbook/en/basics/import/), [accesibilidad ECharts](https://echarts.apache.org/handbook/en/best-practices/aria/), [cuantiles DuckDB](https://duckdb.org/docs/stable/sql/functions/aggregates.html#quantile_contx-pos).
