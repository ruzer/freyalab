# DuckDB-Wasm en FreyaLab — 21 de octubre de 2026

Entrega de desarrollo `codex/csv-duckdb-analysis`, base `fc0f7fe4e31fc6cfa0d5457d52e491980dc1706c` tras las fusiones del usuario de #11/#12. No modifica LAB ni los binarios publicados de v0.1.0-alpha.1. El PR #6 se cerró como resuelto: su corrección y auditoría ya estaban preservadas en main, con CI satisfactoria del mismo commit (run 39630799979).

## Decisión y reutilización

El [prototipo nativo](duckdb-probe-2026-10-21.md) comprobó compatibilidad, pero un utility process no reduce privilegios. Para la integración se eligió **DuckDB-Wasm en sandbox de Chromium**, sin Node/preload, y un Web Worker para el motor. Se conserva Svelte/CodeMirror, el editor y proceso tabular existente, csv-parse/iconv y la recuperación. Sin servidores, Homebrew, herramientas CLI nuevas ni instalaciones de Python/R.

Dependencias exactas: `@duckdb/duckdb-wasm` **1.33.1-dev57.0**, MIT, y `apache-arrow` **17.0.0**, Apache-2.0. La versión npm es una **prerelease**; no se presenta como estable. `getVersion()` devuelve **v1.5.4**, distinto del motor v1.5.6 del prototipo nativo. El paquete npm omite su archivo LICENSE; se conserva el [MIT original](../licenses/duckdb-wasm-MIT.txt) del [gitHead de esa publicación](https://github.com/duckdb/duckdb-wasm/blob/ef8a4f8912b6e7f62bc0cc490145ebd391b79e1f/LICENSE). Los avisos incluyen 349 instalaciones de producción. La generación solo normaliza espacios finales/CRLF y conserva textos/copyright.

La variante EH (~34 MiB) y su worker se empaquetan como recursos locales; no se duplican las otras variantes del paquete npm. Arrow permanece disponible para el proceso tabular. Se inspeccionó el ASAR para comprobar ambos recursos, Arrow y la exclusión del paquete WASM redundante.

## Función y preservación

**Análisis** ofrece SQL y asistentes de agrupación, pivot y cruce entre archivos abiertos. Todos generan SQL visible antes de ejecutar. Datos editables incluyen cambios pendientes; las muestras se releen completas desde el original autorizado. Lotes Arrow de hasta 1 000 registros y 1 MiB de texto; el renderer principal no recibe el archivo completo.

Se mantienen valores como VARCHAR: ceros iniciales, identificadores largos, Unicode, NUL, fórmulas como texto y campos multilínea. Vacío es cadena vacía y ausente es NULL. Los nombres SQL se normalizan/desambiguan sin alterar encabezados originales. BIGINT/DECIMAL se convierten a texto por SQL antes de pasar a JavaScript: se detectó que convertir un escalar decimal Arrow mediante String perdía la escala y se corrigió en el origen.

La relectura usa el formato elegido, UTF-8 estricto/UTF-16LE/Windows-1252, encabezados, comillas y campos completos. Rechaza filas con columnas fuera de la muestra, cambios externos y límites excedidos. Verifica metadatos y huella completa por streaming, sin otra lectura del archivo entero en memoria. Una revisión nueva invalida resultados. No se modifica dirty, historial, archivo ni recuperación.

## Aislamiento y límites

La sesión permite solo recursos propios y rechaza permisos, ventanas/navegación y peticiones HTTP/file. CSP sin `unsafe-eval`; Arrow IPC se genera fuera del navegador. DuckDB: extensiones/acceso externo desactivados, configuración bloqueada, transacción READ ONLY y una sentencia preparada por su parser, utilizada como relación. No se construye un parser SQL por expresiones regulares. DDL/COPY/INSTALL/LOAD/SET y múltiples sentencias no se ejecutan.

Cuatro fuentes; 256 MiB físicos y de texto por fuente; dos millones de filas/200 columnas/registro de 1 MiB; ocho millones de celdas en total. Resultado conservado: 10 000 filas/200 columnas/8 MiB, páginas de 100; limitación rotulada sin atribuirla a una fuente incompleta. Dos minutos; cancelar destruye la ventana/proceso de consulta. Gestor de memoria de DuckDB: 384 MB, **no un límite de RAM total de Electron**. No se prometen archivos de GB.

## Comprobaciones locales

macOS arm64, Apple M2 Max/12 CPU lógicas/32 GiB, Node 24.22.0, Electron 44.9.2:

- `npm run check`: cero errores y advertencias.
- `npm test`: **60 pruebas**, ocho archivos. Incluye transferencia de cambios pendientes, cancelación/revisión/cierre, lectura completa de un millón × cuatro, codificaciones/BOM/delimitadores, multilínea/comillas/Unicode, estructura irregular y cambios externos. Regresión del hash/guardado seguro incluida.
- `npm run test:e2e`: **39 pruebas**, 1,1 minutos. Incluye los flujos anteriores de guardado/recuperación/exportaciones y cuatro casos SQL. Después se amplió el caso grande para medir los cuatro tamaños y se ejecutaron de nuevo los cuatro casos SQL: **4/4**, 24,6 s. IPC inválido y COPY comprobados también en una ejecución específica satisfactoria (8,9 s); después, los 39 E2E completos se repitieron satisfactoriamente, incluidos esos casos y atajos SQL sin formato Markdown.
- `npm run build`: incluido en la suite completa; no equivale a empaquetar.
- `electron-builder --mac --arm64 --dir`: paquete `.app` generado en carpeta temporal independiente, sin firma. Los cuatro casos SQL ejecutados **desde ese paquete**: **4/4**, 26,6 s, incluidos recursos ASAR, aislamiento, cancelación y datos grandes. No es prueba de instalación de DMG ni notarización.
- `npm run licenses` y `git diff --check`: satisfactorios. Capturas inspeccionadas en [oscuro](csv-sql-dark-1440x900.png), [claro](csv-sql-light-1440x900.png) a 1440×900 y [claro](csv-sql-light-1280x800.png) a 1280×800; panel desplazado al resultado.

La prueba de aislamiento observa `sandboxed=true` en el proceso real de macOS/Windows, y comprueba Seccomp en Linux, además de ausencia de Node/require/puente en la ventana. HTTP hacia un servidor canary y lectura file se rechazan, con cero peticiones recibidas. Una consulta de un billón de entradas se cancela mientras calcula, el motor nuevo vuelve a consultar y documentos/canary siguen intactos. En Linux la primera CI detectó Seccomp desactivado: Playwright añade `--no-sandbox` por defecto. Se corrigió el lanzador con `chromiumSandbox: true`, conservando la comprobación estricta. Se retiró una configuración preliminar del helper SUID: el binario Linux fijado no incluye `chrome-sandbox`. La CI comprueba directamente el sandbox con Chromium habilitado y no cambia políticas globales del kernel. SQL ahora rechaza arranques explícitos con `--no-sandbox`; ese rechazo también se prueba. [Opción documentada por Playwright](https://playwright.dev/docs/api/class-electron#electron-launch-option-chromium-sandbox). Estos son casos comprobados; no una demostración formal contra todo SQL posible.

## Medición sintética

Una ejecución por tamaño, máquina compartida; no p95 ni garantía universal. CSV de cuatro columnas, hasta 1 000 identificadores distintos como texto, valores numéricos 0–99. Consulta: COUNT, SUM explícita y COUNT DISTINCT. El tiempo de análisis incluye arranque de ventana/worker/WASM, transferencia/relectura y resultado. Apertura medida separadamente; el primer caso incluye iniciar el proceso tabular.

| Filas × columnas | Bytes de archivo | Apertura | Análisis | Máx. intervalo UI (20 ms) | Mayor suma de memoria muestreada |
|---|---:|---:|---:|---:|---:|
| 100 × 4 | 2,316 | 146.8 ms | 567.5 ms | 21.3 ms | 946.5 MiB |
| 3,000 × 4 | 68,726 | 29.3 ms | 578.0 ms | 21.1 ms | 996.5 MiB |
| 100,000 × 4 | 2,290,026 | 158.3 ms | 977.8 ms | 22.2 ms | 1143.6 MiB |
| 1,000,000 × 4 | 22,900,026 | 591.6 ms | 5714.8 ms | 21.3 ms | 1427.7 MiB |

[Datos completos del desarrollo](duckdb-wasm-profile-2026-10-21.json) y [del paquete](duckdb-wasm-packaged-profile-2026-10-21.json). El millón del paquete tardó 5.61 s. Memoria: suma de working sets de procesos de la app, muestreada cada 50 ms durante consulta; puede contar páginas compartidas más de una vez, omite picos entre muestras y no es RSS físico exclusivo. Incluye Electron/GPU/editor/proceso tabular y el motor. Sin forzar GC. El millón supera el límite de celdas editables: editor readonly/200; análisis completo/1 000 000 y suma 49 500 000 verificados.

## CI y pendientes

La CI de esta entrega ejecuta check/unit/licencias/build/E2E, genera un directorio de app y ejecuta los cuatro casos SQL contra el paquete en Ubuntu 24.04, Windows Server 2025 y macOS 15 ARM/Intel. Sus resultados deben comprobarse en el PR del mismo commit; esta evidencia local no los da por aprobados. Los perfiles de cada runner se guardan como artefactos, sin compararlos como benchmarks universales.

Pendientes: instalación manual en los sistemas objetivo, firma/notarización, lectores de pantalla, p95/picos físicos, formatos SQL persistentes/exportación, más medidas/diagnósticos visuales y archivos de GB. El asistente pivot usa solo categorías explícitas; el agrupador convierte a decimales elegidos y puede redondear/omitir valores; AVG es aproximado, sin modificar celdas. La nueva función permanece separada de alpha.1 y no cierra el [objetivo completo A–D](../ANALYTICS-DELIVERY.md).

Fuentes: [DuckDB-Wasm](https://github.com/duckdb/duckdb-wasm), [cliente WASM](https://duckdb.org/docs/1.5/clients/wasm/overview), [seguridad de DuckDB](https://duckdb.org/docs/1.5/operations_manual/securing_duckdb/overview). La documentación de otra versión no sustituye las pruebas del motor fijado.
