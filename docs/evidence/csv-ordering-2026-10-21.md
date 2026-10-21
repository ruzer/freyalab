# CSV: movimientos y orden permanente — 21 de octubre de 2026

Rama `codex/csv-ordering`, continuación de las transformaciones del PR #16, dirigida a `main`. Sin fusiones automáticas ni dependencias nuevas. Mantiene abierto el objetivo A–D.

## Cambio comprobable

- Mover filas: selección por IDs, rango de una vista capturada o intervalo original; conserva el orden relativo original y el contenido.
- Mover columnas: encabezados y celdas juntos; conserva campos ausentes o rechaza íntegramente destinos imposibles de representar sin materializarlos.
- Fijar orden: todos los criterios estables/exactos de la vista, solo sin búsqueda/filtros, con todas las filas. La ordenación habitual sigue siendo una vista.
- Diálogo compartido: vista previa, preparación cancelable, recuentos/ejemplos, un paso de deshacer, recuperación y guardado independiente. Destinos originales explícitos. Después de aplicar muestra el documento completo sin filtros/orden de vista.

## Verificación local

MacBook Pro Apple M2 Max, 32 GB, macOS ARM64; Node.js 24 mediante el ejecutor fijado del proyecto. Estos resultados no son garantías universales de rendimiento.

- `npm run check`: cero errores y advertencias.
- `npm test`: 88 pruebas en 11 archivos. Incluye paginación concurrente durante la preparación del orden, cancelación/revisión, UTF-16/BOM/Windows-1252, delimitador y CSV sin encabezados.
- `npm run test:e2e`: 50 pruebas, sin reintentos locales. El comando construye previamente la aplicación con `npm run build`.
- Cuatro flujos nuevos en `ordering.spec.ts`, incluidos controles reales, teclado, guardado, vista de orden independiente, recuperación v1/v2 y rechazo sin modificar documentos. Capturas en claro/oscuro a 1440×900 y 1280×800, generadas como evidencia de pruebas.
- CSV sintético de más de 40 MiB (20 000 filas, dos columnas): historial de movimiento menor de 300 000 bytes, un paso de deshacer y resultado original exacto. No se mide aquí una latencia de arranque ni se amplía el límite de 50 MiB/dos millones de celdas.

## Compatibilidad y límites

La recuperación interna CSV pasa a v2 para representar permutaciones; el contenedor permanece v1. Se prueba una recuperación v1 producida por la app instalada anterior, con historial original. Versiones/mutaciones desconocidas se rechazan y su archivo se conserva; no dejan un documento vacío abierto. La app anterior no puede leer v2.

El historial guarda índices e inversas, sin copiar valores. Conserva el presupuesto de 20 MiB; los movimientos que lo superan se rechazan antes de modificar. Los archivos abiertos como muestra siguen en solo lectura. No se añaden GB, rangos discontinuos ni alcance por rango para las cinco transformaciones iniciales.

La CI vuelve a ejecutar la regresión completa y SQL/gráficos/transformaciones/orden sobre paquetes en macOS ARM/Intel, Windows y Ubuntu. Su resultado y el de la copia local instalada se registran en el PR del mismo commit, una vez ejecutados. Empaquetar/ejecutar un paquete no acredita instalación manual en los cuatro sistemas; no se publica una nueva alfa con esta entrega.
