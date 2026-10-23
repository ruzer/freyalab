# FreyaLab

Editor local de documentos, tablas y diagramas para macOS, Windows y Linux. Para Freya.

**Estado:** [v0.1.0-alpha.1 — alfa pública](https://github.com/ruzer/freyalab/releases/tag/v0.1.0-alpha.1). Incluye paquetes para macOS, Windows y Linux. Consulta [la evidencia de publicación](docs/evidence/release-v0.1.0-alpha.1.md) para distinguir las comprobaciones automatizadas y las pruebas manuales pendientes.

FreyaLab reúne un editor Markdown con vista previa, diagramas Mermaid y una tabla editable CSV/TSV. Abre un archivo individual o una carpeta, trabaja en pestañas y guarda o exporta sin comandos. El contenido se procesa localmente; no requiere cuenta ni incorpora telemetría.

## Desarrollo

Necesitas Node.js 24 LTS, npm y Git. En Linux, Electron requiere las bibliotecas de escritorio de su distribución y un servidor gráfico; en CI usamos Xvfb.

```sh
git clone https://github.com/ruzer/freyalab.git
cd freyalab
npm ci
npm run dev
```

```sh
npm run check
npm test
npm run test:e2e
npm run build
npm run licenses
npm run dist
```

En Linux sin sesión gráfica: `xvfb-run -a npm run test:e2e`. `npm run dist` genera paquetes para la plataforma y arquitectura del equipo; no acredita que se hayan probado los instaladores de otras plataformas.

## Alcance de la alfa

- Markdown (`.md`, `.markdown`) y texto (`.txt`) editables hasta 10 MiB: búsqueda/reemplazo, deshacer/rehacer, índice y vista dividida. Documentos más grandes se abren como muestra limitada, de solo lectura.
- Fórmulas, código, tablas e imágenes locales; Mermaid dentro de Markdown o en `.mmd`/`.mermaid`.
- CSV/TSV editables hasta **50 MiB**, dos millones de celdas y registros de hasta 1 MiB. Valores textuales: `000124` sigue siendo `000124`.
- Para archivos tabulares que superan los límites: muestra de hasta 200 registros completos y hasta 8 MiB leídos. La muestra no representa estadísticas ni operaciones sobre el archivo completo.
- Exportación de documentos a PDF/HTML, diagramas a SVG/PNG/PDF y datos a CSV/TSV o tabla Markdown.

El delimitador, codificación, BOM y saltos de línea se conservan al guardar cuando son compatibles. El entrecomillado puede normalizarse sin alterar los valores. Guardar un documento conserva su orden; exportar una vista filtrada respeta el orden mostrado. Un filtro no elimina filas del archivo.

La alfa no incluye importación Office/PDF, MarkItDown, OCR, edición de páginas PDF, multimedia, SQL ni análisis integral de archivos de GB. La interfaz y el proceso de datos se comunican por páginas para poder ampliar después el motor.

## Novedades en desarrollo después de alpha.1

La barra Markdown reproduce los accesos del render: negrita, cursiva, código en línea, tareas, tablas y Mermaid. El menú **Insertar** añade encabezados, listas, citas, enlaces y bloques de código. Inserta ejemplos editables con vista previa; no necesitas escribir la sintaxis desde cero.

El menú **Operaciones** de CSV añade limpieza de espacios, mayúsculas/minúsculas y duplicación de filas o columnas. Las transformaciones tienen selección explícita y deshacer. Consulta [cómo usar los menús](docs/EDITOR-MENUS.md). Estas novedades todavía no forman parte de las descargas de `v0.1.0-alpha.1`.

El panel **Análisis** añade consultas SQL locales y asistentes para agrupaciones, tablas dinámicas y cruces entre CSV abiertos. Usa DuckDB-Wasm aislado; conserva cambios pendientes y distingue el análisis completo de la muestra editable. Consulta [límites y comprobaciones](docs/evidence/duckdb-wasm-2026-10-21.md). Tampoco forma parte de los binarios alpha.1.

En **Estadísticas → Comprender todas las columnas** puedes explorar tipos probables y calidad, buscar columnas y abrir un informe Markdown del alcance completo solicitado. Se conservan los valores originales y se identifican las muestras y columnas no disponibles. Consulta [uso y límites](docs/COLUMN-PROFILES.md). Es una función de desarrollo, pendiente de integración y distribución.

Las estadísticas y el perfil incluyen **Varianza y percentiles** como opciones avanzadas: varianza poblacional/muestral y P10/P25/P75/P90. Los informes Markdown conservan las medidas aunque se oculten en pantalla. Consulta [definiciones y límites](docs/COLUMN-PROFILES.md).

La [evaluación del ecosistema open source](docs/OPEN-SOURCE-ECOSYSTEM.md) documenta alternativas para tablas, análisis y gráficos, con métricas, pruebas aisladas y límites. Es una evaluación técnica; no incorpora dependencias ni cambia las funciones publicadas.

## Descargas y compatibilidad

Las descargas se publican como **prereleases** en [GitHub Releases](https://github.com/ruzer/freyalab/releases) únicamente después de los controles documentados. Si no hay prerelease, todavía no existe una alfa publicada.

Objetivos iniciales: macOS 14+ (Apple silicon e Intel), Windows 11 x64 y Ubuntu 24.04 x64. Los binarios de alfa no llevan firma comercial ni notarización. El sistema puede mostrar advertencias; no se recomienda desactivar protecciones del equipo. Las actualizaciones son manuales. Consulta [distribución](docs/DISTRIBUTION.md).

## Seguridad, datos y contribución

Consulta [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md), [arquitectura](docs/ARCHITECTURE.md), [objetivo](docs/OBJECTIVE.md) y [plan](docs/PLAN.md).

MIT para el código de FreyaLab. Las dependencias, fuentes y Chromium conservan sus propias licencias y avisos. Ejecuta `npm run licenses` para actualizar `THIRD_PARTY_NOTICES.txt` a partir del árbol de producción bloqueado. El render aprobado se conserva en `docs/design/` como referencia, no como app ejecutable de producción.
