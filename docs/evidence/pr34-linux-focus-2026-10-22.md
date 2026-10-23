# PR #34: foco repetido en la tabla CSV

Fecha: 2026-10-22 (America/Mexico_City).

## Fallo y alcance

En el commit `0da3ade5a75738c22b6a5d11bdbef8bb26256fe5`, el [CI 39875942163](https://github.com/ruzer/freyalab/actions/runs/39875942163) falló únicamente en el paquete Linux: `tests/e2e/range-cancellation.spec.ts:21` no encontraba «Fila 1, ID» después de cerrar el diálogo y volver al inicio de la tabla. Falló también en su reintento. Windows, macOS Intel y Apple silicon aprobaron ese commit.

La petición de restauración del foco seguía activa después de completarse. Las actualizaciones del virtualizador volvían a enfocar la celda final y revertían el desplazamiento.

Se reutiliza exactamente la corrección de `2aef4c0` (PR #36), mediante `2c9108c5db491c833ec9b02c7f8c255b1d96fcaf`, sin incorporar perfiles de columnas ni cambiar la base del PR. El efecto, sus llamadores y el archivo de pruebas previo coinciden entre ambas ramas. La restauración espera la carga de página y consume la petición solo cuando la celda recibe realmente el foco.

La regresión usa el diálogo real y comprueba foco, posición de desplazamiento, metadatos y bytes originales. No se modifican dependencias, IPC, motor CSV, guardado, configuración de CI, tiempos de espera ni aserciones existentes.

## Validación de esta rama

Entorno: macOS Apple silicon, Node 24 y Electron 44.9.2. Un solo worker y una aplicación de prueba a la vez, con perfiles temporales.

- `npm run check`: 0 errores y 0 advertencias.
- `npm test`: 154 pruebas aprobadas, 18 archivos.
- `npm run test:e2e`: compilación aprobada y 96 pruebas E2E aprobadas en 4,0 min, sin reintentos. Incluye el caso original de cancelación y la regresión de foco.
- `electron-builder --dir --mac --arm64`: paquete generado con dependencias locales completas, sin enlace externo de `node_modules`.
- Paquete macOS real: 12 pruebas aprobadas en 17,2 s, sin reintentos; rangos, cancelación, paleta, menús estructurales y restauración del foco.

El primer paquete temporal utilizó dependencias enlazadas, que el empaquetador no resolvió completamente: la primera prueba agotó el tiempo de arranque y se interrumpió esa corrida. Se conservó su registro y se generó un paquete independiente con una copia completa de las mismas dependencias, sin cambios de código ni nuevas instalaciones. Solo la segunda corrida se considera satisfactoria.

Registros locales: `/private/tmp/freyalab-pr34-check.log`, `freyalab-pr34-unit.log`, `freyalab-pr34-e2e.log`, `freyalab-pr34-package-isolated.log`, `freyalab-pr34-packaged-e2e.log` y `freyalab-pr34-packaged-symlink-failed.log` en la misma carpeta temporal. Paquete probado: `/private/tmp/freyalab-pr34-package-isolated-2c9108c/mac-arm64/FreyaLab.app`. No constituye prueba de instalación de un DMG.

El documento `csv-focus-restoration-2026-10-22.md` conserva la evidencia histórica del desarrollo de la corrección sobre PR #35. Sus recuentos y su CI no se atribuyen a PR #34.

## Límites

La resolución en Linux requiere el CI del nuevo commit; los resultados anteriores no lo sustituyen. No se repiten las mediciones del experimento de extractos, cuyo código permanece intacto. No se aprueba una migración de arquitectura, no se reemplaza la aplicación instalada por esta rama experimental y no se fusiona ni publica automáticamente.
