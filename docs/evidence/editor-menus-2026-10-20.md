# Barra Markdown y operaciones CSV — 20 de octubre de 2026

Cambio posterior a v0.1.0-alpha.1. No se modifican su etiqueta ni sus descargas.

## Alcance comprobado

- Barra del render conservada: negrita, cursiva, código en línea, tareas, tabla y Mermaid; menú con encabezado, lista, cita, enlace y bloque de código.
- Inserción sobre selección, recuperación del foco, actualización de vista previa y deshacer por acción. Bloques de código con delimitadores adaptados cuando el contenido contiene acentos graves.
- Limpieza CSV por filas identificadas y columnas explícitas: espacios exteriores, mayúsculas y minúsculas; no altera otras filas, encabezados ni celdas ausentes.
- Selección estable después de rehacer: el reinicio de selección ocurre al cambiar la vista o revisión, antes de la recarga diferida; una recarga pendiente no borra una selección posterior.
- Duplicación de filas/columna, identificadores nuevos de fila, deshacer/rehacer y recuperación del historial. Los filtros por columna y el orden se reinician cuando cambia el número de columnas.
- Validación de operaciones en Main, sin ampliar el acceso a archivos del renderer. Muestras de solo lectura protegidas por el motor.
- Reutilización del historial tabular; acumulación y reversión al final para evitar desplazamientos repetidos al preparar cambios masivos. Sin dependencias nuevas.

## Validación local

Equipo: macOS 27.0.1, arm64; ejecución mediante Node.js 24 y Electron del archivo bloqueado de dependencias.

- `npm run check`: sin errores ni advertencias.
- `npm test`: 32 pruebas en cinco archivos satisfactorias.
- `npm run test:e2e`: 20 pruebas satisfactorias, incluida construcción de producción mediante `npm run build`.
- `git diff --check`: sin incidencias.

Casos nuevos: selección en una vista ordenada/filtrada, ceros iniciales, valores Unicode y multilínea, filas irregulares, deshacer en un paso, recuperar historial, duplicación sin colisión de identificadores, selecciones inválidas sin cambios parciales y rechazo de una operación no permitida por IPC. Los E2E anteriores siguen cubriendo guardado, exportación y recuperación tras caída.

Capturas de la app ejecutada, revisadas localmente:

- [Markdown oscuro, 1440 × 900](screenshots/markdown-toolbar-dark-1440x900.png).
- [Markdown claro, 1280 × 800](screenshots/markdown-toolbar-light-1280x800.png).
- [Operaciones CSV, 1440 × 900](screenshots/csv-operations-1440x900.png).

La CI de la rama y del PR debe comprobar el mismo cambio en Ubuntu 24.04, Windows Server 2025, macOS 15 arm64 y macOS 15 Intel antes de integrarlo. El resultado actual se consulta en GitHub Actions; estas comprobaciones locales no acreditan esas plataformas.

No se han generado ni probado instaladores nuevos ni medido el rendimiento de estas operaciones en archivos extremos. No se incluye mover filas/columnas, transposición ni el catálogo completo de Modern CSV.
