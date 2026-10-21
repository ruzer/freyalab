# Objetivo de FreyaLab v0.1.0-alpha.1

Desarrollar y publicar FreyaLab v0.1.0-alpha.1 en el repositorio público `ruzer/freyalab`, bajo licencia MIT. Implementar el diseño aprobado con Electron, TypeScript y Svelte; incluir navegación por archivos y carpetas, pestañas, edición y visualización Markdown con fórmulas y Mermaid, edición tabular CSV/TSV hasta 50 MiB, búsqueda, filtros, guardado seguro, recuperación y exportaciones. Separar el motor tabular de la interfaz para incorporar posteriormente procesamiento de archivos de GB. Entregar una alfa descargable para macOS, Windows y Linux, con comprobaciones funcionales y de empaquetado documentadas, sin presentar funciones o plataformas no verificadas como completas.

## Cierre

El objetivo solo se considera terminado cuando el código está integrado, las comprobaciones obligatorias del mismo commit de `main` han pasado, los paquetes han sido ejecutados y sus instalaciones probadas en las plataformas objetivo, y existe una prerelease con checksums y evidencia. Un plan, una maqueta o paquetes construidos no bastan.

## Límites aprobados

Markdown/texto/Mermaid editables hasta 10 MiB. CSV/TSV editables hasta 50 MiB, dos millones de celdas y registros de hasta 1 MiB. Archivos tabulares mayores: únicamente muestra de hasta 200 registros completos y 8 MiB leídos. Los límites se comunican en la interfaz; nunca se presenta una muestra como el archivo íntegro.

No incluye MarkItDown, OCR, herramientas PDF, multimedia, SQL, otros lenguajes de diagramación ni edición integral de archivos de GB.
