# DW-02c — filtros propios del gráfico

Base: `ff9e9e3bb224e79e200d32045706fef364f967bc` del PR #30, dependiente del #29. Rama `codex/chart-local-filters`. Sin fusión ni publicación automática. Mantiene el objetivo DW-01–DW-10 abierto.

## Solución acotada

Reutiliza `CsvQueryTools`, el compilador de condiciones del motor tabular, la transferencia Arrow y DuckDB. Los operadores/etiquetas se extraen a un único módulo compartido; no se duplica la lógica de filtrado ni se agregan dependencias, motor o canal IPC. El request SQL existente admite un grupo `where` validado (máximo veinte reglas, modo all/any, sin claves desconocidas).

El alcance de tabla se prepara primero y el grupo adicional se aplica antes de agregaciones; esto conserva `(tabla O tabla) Y (gráfico O gráfico)`. Identificadores, vacíos/ausentes, valores multilínea y orden original no se convierten ni guardan. Los filtros del gráfico no alteran los de la tabla. Borradores son locales al editor hasta Aplicar; Cancelar/Escape conserva el resultado previo. IDs accesibles y Escape quedan limitados a la instancia del editor.

En muestras, el grupo propio filtra el archivo original completo desde disco. Se mantienen UTF-8/codificación, hash/cambios externos, estructura y presupuestos sobre todas las filas leídas **antes** de filtrar. Se cede el control aun si no hay coincidencias. La fuente devuelve condiciones y estado filtrado; la UI/imagen identifica alcance/contador y el informe SQL incluye las reglas, aclarando que el recuento son coincidencias.

## Validación

- Comprobación estática: cero errores y advertencias. Unitarias: 135 correctas en 16 archivos; incluye grupos O independientes, ausente/vacío y ceros iniciales, origen completo de un millón de filas filtrado a 100 000, límites/estructura antes del rechazo y cancelación programada durante un recorrido sin coincidencias; reportes saneados y semántica de mayúsculas.
- Dirigidas: archivo superior a 50 MiB e IPC/numérica con 3 000 registros correctos; regresión de UI corregida para abrir los paneles en el orden que permite la app y escoger su encabezado h3 explícitamente. La última prueba de UI pasó (5,3 s), sin modificar la app para acomodar esos errores de preparación/selectores.
- La UI comprueba borradores, Escape/foco, IDs únicos, aplicar/quitar, alcance completo/tabla, sumas conocidas, exportación con filtros, error regex y tabla original sin cambios.
- Suite completa final: **89 pruebas correctas**, sin reintentos, en 3,4 minutos, incluyendo build de producción. Registros temporales: `/private/tmp/freyalab-chart-filters-verified-check.log`, `/private/tmp/freyalab-chart-filters-verified-unit.log`, `/private/tmp/freyalab-chart-filters-acceptance.log`. Paquete, copia instalada y CI se registran por separado en el PR para el commit exacto.
- Capturas en [claro 1440×900](dw02c-local-filters-light-1440.png) y [oscuro 1280×800](dw02c-local-filters-dark-1280.png).

## Límites y siguiente paso

Las condiciones filtran filas de origen; HAVING sobre agregados no se incorpora en esta subentrega. Persistencia/configuraciones y exportación de agregados permanecen en DW-03. No se certifica usabilidad con personas, lector de pantalla ni instalación manual multiplataforma.
