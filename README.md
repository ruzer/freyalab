# FreyaLab

Editor local de documentos, tablas y diagramas para macOS, Windows y Linux. Para Freya.

**Estado:** primera alfa en construcción. La presencia de una función en el plan no acredita que esté implementada o verificada. Consulta [el progreso](docs/PROGRESS.md) y [la evidencia](docs/evidence/README.md) antes de distribuirla.

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

## Descargas y compatibilidad

Las descargas se publican como **prereleases** en [GitHub Releases](https://github.com/ruzer/freyalab/releases) únicamente después de los controles documentados. Si no hay prerelease, todavía no existe una alfa publicada.

Objetivos iniciales: macOS 14+ (Apple silicon e Intel), Windows 11 x64 y Ubuntu 24.04 x64. Los binarios de alfa no llevan firma comercial ni notarización. El sistema puede mostrar advertencias; no se recomienda desactivar protecciones del equipo. Las actualizaciones son manuales. Consulta [distribución](docs/DISTRIBUTION.md).

## Seguridad, datos y contribución

Consulta [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md), [arquitectura](docs/ARCHITECTURE.md), [objetivo](docs/OBJECTIVE.md) y [plan](docs/PLAN.md).

MIT para el código de FreyaLab. Las dependencias, fuentes y Chromium conservan sus propias licencias y avisos. Ejecuta `npm run licenses` para actualizar `THIRD_PARTY_NOTICES.txt` a partir del árbol de producción bloqueado. El render aprobado se conserva en `docs/design/` como referencia, no como app ejecutable de producción.
