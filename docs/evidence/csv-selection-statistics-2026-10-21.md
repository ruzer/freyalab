# Estadísticas descriptivas sobre rangos CSV

Entrega `codex/csv-selection-statistics`, continuación de #16–#18; no cierra el objetivo A–D. Reutiliza el panel, método `stats`, proceso tabular y canal de cancelación existentes. Sin nuevas dependencias ni motor adicional.

## Alcance y compatibilidad

Cuatro opciones: documento por columnas, columnas marcadas, celdas de un rango como un único resumen y rango por columnas. El rango conserva consulta/revisión y se resuelve en el motor; no se envían todas las celdas a la interfaz. Filtros/orden modificados o edición invalidan una selección usada; desplazarse no la cambia. No se amplía silenciosamente un rango inválido al documento completo.

Todos los resúmenes añaden mediana, desviación poblacional (n), desviación muestral (n−1), ausentes, solo espacios y excluidos. El perfil de columna y el resumen comparten `descriptive` y las funciones de `simple-statistics` ya instaladas. Vacíos incluye ausentes/espacios; únicos compara texto exacto y agrupa ausentes con cadena vacía, como antes. Los valores originales nunca se convierten ni se modifican.

El argumento opcional `TableStatsOptions` añade UUID de solicitud, revisión y rango; el puente valida estos datos. Las llamadas anteriores de tres argumentos siguen funcionando y no cancelan el análisis del panel. Cada resultado lleva revisión y marca de muestra. Cancelar descarta la solicitud, interrumpe recogida por bloques de 512 celdas y evita iniciar más columnas. Los cálculos síncronos de la biblioteca pueden terminar antes de descartar su salida.

El panel mantiene 100 resultados como máximo; un único resumen puede abarcar más de 100 columnas. Se fija un máximo de dos millones de celdas lógicas por resumen, incluidos campos ausentes: rechazo previo cuando se conoce la dimensión y comprobación durante consultas de IDs. Evita recorridos enormes sobre tablas irregulares pequeñas. No limita únicos a 100 000 como el explorador de frecuencias; se comprueban 100 001 valores distintos. Se mantienen los límites y las muestras del editor.

## Verificación local

Node.js 24, macOS ARM64.

- `npm run check`: cero errores y advertencias.
- `npm test`: 104 pruebas, 13 archivos. Nueve nuevas cubren métricas conocidas, rango filtrado/ordenado, resumen conjunto/por columna, revisiones, validación de alcance, cancelación, historial intacto, 2 000 columnas, paginación y pie concurrentes, compatibilidad, ceros iniciales, identificadores inseguros, muestra y límite lógico.
- `npm run test:e2e`: 57 pruebas; construcción completa incluida. Cuatro nuevas comprueban ambos modos de rango, actualización de selección, edición real, cancelación/reintento, conservación al paginar, muestras, IPC inválido y tabla irregular fuera del límite.
- Regresión existente de estadísticas conserva sus nueve campos anteriores; los nuevos tienen expectativas numéricas y de alcance propias.
- Capturas claro/oscuro a 1440×900 y 1280×800; primera columna fija al desplazar resultados. La prueba de doble clic detectó un salto al desaparecer resultados: el modo de rango reserva ahora su espacio y conserva el objetivo de edición. La explicación está en una ayuda desplegable.

La CI vuelve a comprobar la regresión completa y 22 pruebas de SQL/gráficos/transformaciones/orden/cancelación/estadísticas en los paquetes de macOS ARM/Intel, Windows y Ubuntu. Los resultados del commit final y de la app instalada se registran en el PR después de ejecutarse. Generar/ejecutar un paquete no prueba la instalación manual en los cuatro sistemas.

## Límites y siguientes pasos

Cálculos aproximados con números de JavaScript; se excluyen enteros fuera del rango seguro y no se afirma aritmética decimal exacta. La muestral necesita dos números; sin datos o resultado representable se muestra —. Las muestras nunca se presentan como archivo completo. Guardado, recuperación e historial no se modifican. Informe exportable, localización de faltantes, rangos discontinuos y las otras tareas de A–D siguen pendientes; no se publica una nueva alfa con esta entrega.
