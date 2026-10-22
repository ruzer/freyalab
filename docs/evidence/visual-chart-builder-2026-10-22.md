# DW-01 — constructor visual de gráficos

Base: `main` bf5e670 (PR #26 integrado). Rama `codex/visual-chart-builder`. La evaluación del PR #27 se consultó abierta, MERGEABLE y con cuatro comprobaciones SUCCESS; no se fusionó.

## Cambio acotado

- Reutiliza TanStack, motor textual, DuckDB-Wasm/Arrow y ECharts. Sin dependencias ni cambios de formatos de guardado/recuperación.
- Empieza con barras/conteo y ninguna medida numérica seleccionada. Texto/identificador solo permite contar filas o valores únicos; suma/promedio/mínimo/máximo/mediana requieren declarar Número y elegir una columna. La misma restricción se verifica al generar la consulta tipada.
- Ejes, título, resumen y descripción accesible muestran nombres reales y alcance. Las imágenes SVG/PNG/PDF también incluyen alcance; encabezados duplicados se eligen por índice.
- Documento completo incluye cambios pendientes y filas ocultas. Vista filtrada utiliza la búsqueda/filtros combinados del motor existente sobre todas las coincidencias; no solo una página. No aplica el orden de tabla: el gráfico tiene su orden. Se conserva orden original relativo al transferir.
- La API SQL existente acepta una query validada opcional por fuente. La transferencia conserva VARCHAR/null y reporta `filtered`. El informe SQL distingue ese origen, sin un nuevo motor/IPC general de archivos.
- Se rechaza analizar la vista filtrada de una muestra. En ese caso solo se permite el archivo completo desde disco, dentro de los límites vigentes. Gráficos parciales de puntos/categorías mantienen su aviso.
- Cambios de datos, filtros u opciones invalidan el resultado. La carga/paginación visual de la tabla no debería borrar un gráfico válido. Cancelación/revisión siguen las protecciones existentes.

## Validación local

Verificación terminal local en macOS Apple silicon, Node.js 24 y Electron 44.9.2:

- `npm run check`: cero errores y cero advertencias.
- `npm test`: 129 pruebas correctas en 16 archivos.
- `npm run test:e2e`: construcción de producción y 81 pruebas correctas, sin reintentos, en 2,8 minutos.
- La suite verifica los siete cálculos contra resultados independientes, tipos explícitos, ejes, alcance completo/filtrado, 3 000 registros con filtros combinados de texto/número/fecha, revisión/cancelación, ceros iniciales, identificadores largos, ausente/vacío, encabezados duplicados y cambio de encabezado desde la interfaz.
- Exportaciones SVG/PNG/PDF comprobadas, incluyendo CSV superior a 50 MiB cuyo editor permanece en muestra y cuyo gráfico consulta la fuente completa. Originales, historial y recuperación no se modifican por analizar/exportar.
- Capturas revisadas en [claro 1440×900](dw01-builder-light-1440.png) y [oscuro 1280×800](dw01-builder-dark-1280.png). El panel conserva desplazamiento para gráfico/controles que excedan el alto disponible; no se presenta como prueba de usabilidad con usuarios.
- [Perfil sintético reproducible](dw01-chart-million-profile.json): Apple M2 Max, un millón de filas, 21 900 021 bytes, diez intervalos de 100 000 observaciones; consulta 5 572 ms y mayor intervalo observado del temporizador del renderer de 22,5 ms. Es una observación de esta máquina compartida, no una garantía universal ni medición de todos los estados de la interfaz.

Los registros terminales locales se conservaron en `/private/tmp/freyalab-builder-check-final.log`, `/private/tmp/freyalab-builder-unit-final.log` y `/private/tmp/freyalab-builder-acceptance.log`; son temporales y no sustituyen CI del PR. La ejecución del paquete de macOS, copia instalada y CI se registrarán separadamente en el PR con el commit exacto. No se certifica instalación manual multiplataforma con estos resultados.

## Límites y siguientes fases

Suma/media/mediana/etc. usan DOUBLE aproximado y el rango seguro existente; vacíos y valores numéricos inválidos se excluyen con recuentos visibles. Valores únicos compara el texto exacto, incluye cadena vacía y excluye campos ausentes. No se convierten identificadores ni se altera el CSV.

DW-02 (series/fechas/filtros propios) y DW-03 (persistencia/datos agregados) quedan pendientes. Las sugerencias deterministas son DW-05: política definida, sin implementación ni IA en esta entrega. Tampoco se certifica usabilidad con personas, lector de pantalla o instalación manual Windows/Linux/Intel.

Al cambiar una medida ya elegida, se restablece Texto/identificador y conteo: el tipo no se hereda a otra columna. Si cambia la lista de encabezados, el constructor se reinicia y cancela su cálculo anterior. No intenta reutilizar una configuración por índice sobre otras columnas.
