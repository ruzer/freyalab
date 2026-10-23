# DW-04b — vista general de columnas

Rama `codex/column-overview`, basada en `codex/focus-restoration` (`2aef4c0c756657caa0f6548403d3755e17f742cd`, PR #36), que depende de DW-04a (#35). Implementación en `379c06e07796c2aef38d867eb42922fee92cdf87`, con fixtures/documentación completados en esta rama. El PR #34 de extractos sigue independiente; esta entrega no adopta su arquitectura. Objetivo DW-01–DW-10 abierto; sin fusión ni publicación automática.

## Resultado

**Estadísticas → Comprender todas las columnas** permite explorar todas o las columnas marcadas, sobre documento completo o vista filtrada. Tipo probable con explicación accesible, calidad disjunta, distintos exactos, repeticiones, búsqueda por nombre/posición, páginas de 50 y acceso al detalle con posición y alcance. El informe Markdown incluye todas las columnas solicitadas, no solo la página o búsqueda visible. [Uso, presupuestos y semántica](../COLUMN-PROFILES.md).

Reutiliza `analyzeColumn`, `columnSummary`, procedencia y saneamiento de informes; ningún IPC, parser, backend o dependencia nuevo. Solo conserva resúmenes compactos, sin retener frecuencias, histogramas o ejemplos de cada columna. El CSV y su historial no cambian al analizar.

Hasta 2 000 columnas y dos millones de posiciones lógicas por solicitud. Una columna con más de 100 000 valores distintos queda no disponible, con cobertura parcial explícita; no se sustituyen sus cifras por ceros. Revisión/cancelación/error de motor aborta el conjunto. El temporizador UI de dos minutos solicita abandono/cancelación; no es un límite duro de CPU. El preflight puede concluir en segundo plano, pero sus respuestas se descartan.

## Pruebas locales sobre el árbol final

Commit probado y empaquetado: `4e0a454bbfb92414e36eb391bc59773f47afaaee`. La actualización posterior de este documento solo añade evidencia de paquete/instalación, sin cambios de producto o tests.

macOS ARM64, Apple M2 Max, 32 GiB, Node 24.22.1, Electron 44.9.2, un worker nativo, fixtures sintéticos.

- `npm run check`: **0 errores, 0 advertencias**.
- `npm test`: **181 correctas**, 19 archivos. Siete nuevas verifican informe de 51 columnas, identidad por posición, calidad disjunta, cobertura parcial sin ceros ficticios, procedencia/muestra/filtros, contenido hostil e inmutabilidad.
- Dirigidas de la nueva interfaz: **6 correctas, 7,8 s**, sin reintentos.
- `npm run test:e2e`: **103 correctas, 3,9 min**, sin reintentos, incluido `npm run build`. Conserva apertura, guardado, recuperación, aislamiento, exportaciones, cálculos, gráficos y la regresión independiente del foco.
- Casos nuevos: tipos y recuentos exactos; explicación mediante teclado; alcance filtrado; informe completo aunque se busque una columna; 62 columnas con encabezados duplicados y página reiniciada al reducir selección; detalle por posición; cancelación durante preflight; rechazo de revisión obsoleta y de solicitud reemplazada; cardinalidad alta limitada a su columna; muestras rotuladas durante resultados provisionales; límites de 2 000 columnas y dos millones de posiciones; documento, BOM/CRLF y cambios pendientes preservados.

Los primeros intentos del fixture de concurrencia intentaban reemplazar funciones del puente aislado; se sustituyeron por solicitudes reales y observación del DOM. El fixture de revisión se corrigió para aceptar los mensajes legítimos del motor e intercambiar metadatos con la interfaz tras una edición directa por API; ninguna aserción de integridad se eliminó. Los resultados anteriores fallidos no se presentan como defectos del cálculo ni como pruebas satisfactorias.

Registros locales: `/private/tmp/freyalab-dw04b-check-final.log`, `/private/tmp/freyalab-dw04b-unit-final.log`, `/private/tmp/freyalab-dw04b-targeted-final2.log`, `/private/tmp/freyalab-dw04b-e2e-final.log`.

Capturas inspeccionadas: [claro 1440×900](dw04b-overview-light-1440x900.png), [oscuro 1280×800](dw04b-overview-dark-1280x800.png). Permiten revisar contraste, distribución y foco; no sustituyen pruebas con lector de pantalla ni participantes.

## Medición acotada

[JSON de la suite completa](dw04b-column-overview-profile.json). Una ejecución por tamaño, una columna y 1 000 valores distintos repetidos; equipo compartido con otros procesos. Medida desde la acción de abrir y desde pulsar explorar hasta completar; no arranque frío de la app.

| Filas completas | Apertura (ms) | Exploración (ms) | Mayor separación observada del heartbeat UI (ms) |
|---|---:|---:|---:|
| 3 000 | 158,9 | 70,1 | 22,1 |
| 100 000 | 92,8 | 110,1 | 21,6 |
| 1 000 000 | 502,7 | 820,1 | 29,9 |

El heartbeat se solicita cada 20 ms; para 3 000 filas solo hay tres observaciones. No demuestra p95, consumo/pico de memoria, latencia universal inferior a 200 ms ni rendimiento equivalente en tablas anchas, textos largos o cardinalidad extrema. Un millón de filas con varias columnas puede superar el límite de edición; no se amplían límites.

## Gates y pendientes

El paquete y la copia instalada se registran debajo; la CI del commit final sigue pendiente al preparar este registro. Ningún resultado local acredita Windows/Linux/Intel, instalación manual, firma/notarización o usabilidad validada. La cancelación manual durante una columna y el temporizador de dos minutos con respuesta tardía no tienen un nuevo caso dirigido aquí; sí se comprueban cancelación de preflight, reemplazo de la solicitud activa y rechazo de revisiones.

DW-04 sigue abierto para moda, varianza, percentiles y cobertura/coste pendientes. DW-05 (sugerencias modificables de análisis) no está implementado en esta entrega. No hay persistencia de bases, proyectos obligatorios ni migración a Python.

## Paquete y copia instalada — macOS ARM64

Paquete de desarrollo **0.1.0-dev.20261022.4e0a454**, generado con `electron-builder --mac --arm64 --dir --publish never` y metadatos de versión explícitos, sin modificar `package.json` ni el lockfile. No es un instalador DMG ni una publicación. Firma comercial y notarización ausentes.

- Paquete real: **14 pruebas E2E correctas, 29,4 s**, sin reintentos: seis de panorámica, cuatro de cancelación/foco de rangos y cuatro de exportación de resultados de gráficos, incluidas lectura completa y cancelación real de DuckDB. Perfil temporal aislado. Registro `/private/tmp/freyalab-dw04b-packaged-e2e.log`.
- Se comprobó que FreyaLab no estuviera abierta, se preparó la nueva app y se conservaron los archivos anteriores antes del reemplazo. No se cerraron aplicaciones del usuario ni se modificaron sus preferencias/documentos.
- Copia actualizada: `/Applications/FreyaLab.app`. Respaldo anterior: `/private/tmp/freyalab-before-column-overview-ollpdpic/FreyaLab.app`. Los respaldos en una carpeta temporal no son almacenamiento permanente.
- Se verificó igualdad SHA-256 de ASAR, icono, ejecutable e Info.plist entre paquete y copia instalada. ASAR: `aec243a466f99f49901225d1102dc4d846593a3094e08076d28de2b9a4cdf668`. Icono de Freya: `98a9bfaaeb9a2b98a681601c17b1c294f660c728c89fd53c0e96645a8e1e9f9a`. Metadatos locales: `/private/tmp/freyalab-dw04b-installed.json`.
- Copia instalada ejecutada mediante Playwright con otro perfil temporal: **1 prueba correcta, 4,1 s**. Comprueba tipos/recuentos, teclado/temas, vista filtrada, informe íntegro y fuente intacta. Registro `/private/tmp/freyalab-dw04b-installed-smoke.log`.

Esto acredita ejecución del paquete y de la app copiada en este Mac. No acredita descarga con cuarentena/Gatekeeper, instalación manual DMG, Intel/Windows/Linux ni estado verde de CI.

## Ajuste del fixture de límite de configuraciones

La CI de `fe583fa` (run `39883746215`) detectó en Windows un timeout de 5 s en `tests/chart-presets.test.ts`: 50 guardados sincronizados sucesivos, con 180/181 pruebas unitarias correctas. Se sustituyó esa preparación repetitiva por una biblioteca válida de 49 entradas y se comprueban **49→50→51** mediante un guardado real, lectura desde otra instancia y rechazo sin alterar los bytes del archivo. Se mantienen todas las aserciones de identidad/encabezados y los otros tests de guardado, concurrencia y fallo de escritura. No se amplían timeouts ni se cambia el producto.

Prueba dirigida: 7 correctas (359 ms de suite local). Suite unitaria completa: 181 correctas. La CI del nuevo commit debe confirmar Windows; el fallo anterior no se declara resuelto remotamente por pasar en este Mac. Este ajuste solo afecta tests/evidencia: no requiere reemplazar la app instalada del commit `4e0a454`.

## Corrección posterior: aislamiento de consultas

El preflight por `tablePage` y su cancelación descritos arriba corresponden a la implementación inicial. Se sustituyeron por metadatos existentes y se separó la cancelación del análisis de la paginación. Evidencia de la corrección en [csv-overview-query-isolation-2026-10-22.md](csv-overview-query-isolation-2026-10-22.md).
