# DW-04a — interpretar tipo y calidad de una columna

Base `d70472e2874ef174e623dc55e75b497e6ce84e0f` del PR #33. Rama `codex/column-profile-types`. La prueba de extractos #34 permanece independiente; no se adopta su arquitectura. Objetivo DW-01–DW-10 abierto, sin fusión ni publicación automática.

## Cambio y alcance

El perfil existente añade un tipo probable explicable y cuatro recuentos de calidad disjuntos, compartidos con su informe Markdown. Misma pasada cancelable, documento/revisión, alcance, parser, estadísticas y IPC. Sin nuevas dependencias ni conversiones de celdas. [Reglas y límites](../COLUMN-PROFILES.md).

Prioridad: sin datos → señales de identificador → número uniforme → fecha ISO uniforme → mixto → texto repetido de baja cardinalidad → texto. Los ceros iniciales y enteros fuera del rango seguro justifican conservar un posible identificador; no lo seleccionan como medida ni alteran los cálculos manuales previos. Una sugerencia se refiere solo a las filas analizadas.

## Verificación local

Entorno: macOS ARM64, Node 24.22.1, Electron 44.9.2, un worker nativo. Los fixtures son sintéticos.

- `npm run check`: 0 errores y advertencias.
- `npm test`: **174 correctas**, 18 archivos. Añade casos de nombres de identificador con acento/camelCase y falsos positivos, ceros iniciales, enteros largos, decimales/exponentes, calendario bisiesto/años extremos/0000, fechas inválidas/ambiguas/timestamps, valores mixtos, vacíos, categorías, encabezados vacíos/duplicados, alcance filtrado y resumen de calidad. El perfil no depende de páginas de frecuencias ni de «solo repetidos». Se conservan las pruebas de cancelación, muestra, revisión, snapshot y serialización original.
- `npm run test:e2e`: **96 correctas**, sin reintentos, **3,7 min**, incluido build. El flujo nuevo usa controles de columna y ejecución con teclado, verifica nueve columnas y cada recuento, abre un informe consistente y comprueba archivo BOM/CRLF y estado de guardado intactos. Los flujos existentes de apertura/guardado/recuperación/exportación/SQL/gráficos continúan pasando.
- Capturas inspeccionadas: [claro 1440×900](dw04a-column-type-light-1440x900.png) y [oscuro 1280×800](dw04a-column-type-dark-1280x800.png). El resumen queda visible antes de medidas y sobre la tabla. No sustituye un estudio de usabilidad o una comprobación con lector de pantalla.
- Registro de la suite: `/private/tmp/freyalab-dw04a-e2e.log`.

El fallo histórico de main en run `39849871629`, SHA `59a1dc84`, fue el fixture de cardinalidad de 100 001 filas sobre Intel: 5 255 ms frente a timeout de 5 s; 128 pruebas restantes y otros tres sistemas pasaron. Esa misma prueba sin cambios pasó posteriormente en Intel en #33 y #34. Se acota su presupuesto a 15 s para esta prueba concreta, preservando todas las aserciones y límites del producto; no se cambia el timeout global. No se presenta ese fallo como defecto de cálculo ni se reutiliza CI de otra revisión como prueba del nuevo código.

## Pendiente

Ejecución del paquete/copia instalada y CI del commit exacto se registran por separado. No certifica Windows, Linux, Intel, instaladores, firma/notarización, lectores de pantalla ni usabilidad con participantes. No mide aquí p95/picos de memoria ni amplía límites de filas/celdas.

DW-04 no termina en esta entrega: sigue pendiente la vista conjunta de columnas, completar moda/varianza/percentiles y navegación. DW-05 debe añadir recomendaciones modificables de gráficos usando esta evidencia, sin asumir que inferir tipo equivale a configurar un análisis correctamente.
