# DW-02a — series por categoría

Base: DW-01, commit `3301a3b9eccb168fa105e00297cfd838a7e7b5b8` del PR #28. Rama `codex/chart-category-series`. PR dependiente; no fusionar ni publicar automáticamente. No se modifica el PR #28 ni la evaluación #27.

## Alcance

Reutilizar el contrato tipado de gráficos, DuckDB-Wasm y ECharts. Añade una columna opcional para separar por color en barras/líneas/dispersión. No hay nuevas dependencias ni cambios del modelo CSV, IPC, guardado o recuperación.

Barras calcula cada combinación mediante DuckDB; líneas/dispersión separan las observaciones sin agregarlas. La interfaz muestra nombres de columnas, texto de ayuda, leyenda nativa y casillas de teclado sincronizadas. Límite de ocho series sobre la fuente elegida (incluye vacío/ausente); al superar el límite se pide reducir, sin seleccionar categorías arbitrariamente. Los límites de elementos totales existentes no se amplían.

Las series preservan códigos `001` frente a `1`, identificadores largos, texto hostil y ausencia frente a vacío. Barras sin observación no se rellenan con cero; las líneas conservan huecos numéricos. Las series ocultas solo afectan al dibujo, con aviso dentro de la imagen exportada; no filtran ni cambian los resultados de la tabla accesible ni la fuente.

## Validación

- `npm test`: 131 pruebas correctas, 16 archivos.
- Comprobación estática: cero errores y advertencias.
- Tres regresiones nuevas de Electron correctas: siete cálculos por combinación con valores independientes, líneas/puntos, categorías exactas; interfaz, leyenda/teclado, filtros, SVG y rechazo comprensible de nueve series. No se interpreta un SVG renderizado como prueba de exactitud numérica.
- `npm run test:e2e`: build de producción y **84 pruebas correctas**, sin reintentos, en 3,1 minutos. Registros locales temporales: `/private/tmp/freyalab-series-final-check.log`, `/private/tmp/freyalab-series-final-unit.log` y `/private/tmp/freyalab-series-final-acceptance.log`. El paquete y CI se comprueban aparte.
- Capturas revisadas en [claro 1440×900](dw02a-series-light-1440.png) y [oscuro 1280×800](dw02a-series-dark-1280.png). No certifican usabilidad con personas ni lector de pantalla.
- [Medición sintética](dw02a-series-performance.json), Apple M2 Max/macOS ARM, Electron 44.9.2: 3 000 registros (95 692 bytes), apertura IPC 151 ms y análisis 595 ms; 100 000 registros (3 189 022 bytes), apertura IPC 186 ms y análisis 1 035 ms. Veinte combinaciones y cuatro series, todas las sumas verificadas con acumulaciones independientes; sin cambios de revisión ni archivo. El temporizador de 20 ms del renderer observó intervalos máximos de 21,7/22,2 ms durante el análisis. Apertura mide `openPaths`, no el momento en que toda la vista terminó de dibujarse; no son arranques en frío ni garantías universales o mediciones de memoria.
- La suite mantiene además los casos anteriores de un millón de filas y CSV superior a 50 MiB. No se amplía el límite de edición ni se confunde la muestra de la tabla con la fuente analítica completa.

## Pendiente

Agrupaciones temporales y filtros propios de gráfico son las siguientes subentregas DW-02; persistencia/exportaciones agregadas corresponden a DW-03. No se declara completo el objetivo general ni se cambia el alcance de la alfa publicada. El empaquetado/instalación y CI de este commit se registrarán separadamente, sin reutilizar checks de DW-01 como prueba de esta entrega.
