# DW-02b — agrupaciones temporales

Base: `b8a3cd51f49d263f9ec54d3ae22f34094ae70e29` del PR #29, sobre main `59a1dc8` (PR #27/#28 integrados). Rama `codex/chart-time-groups`; entrega inicialmente dependiente del PR #29. Sin fusión ni publicación automática.

## Resultado

Barras y líneas admiten agrupación explícita por día, mes o año, con los siete cálculos existentes y series categóricas. Reutiliza DuckDB-Wasm para convertir fechas y agregar; ECharts recibe etiquetas de calendario y valores acotados. No se añadieron dependencias, IPC, motor de fechas propio ni cambios en documentos, guardado, recuperación o historial.

Fechas ISO de calendario, años 0001–9999. No infiere formato local, horas o zonas horarias. Muestra recuento combinado de fechas inválidas/vacías/ausentes, también en descripción accesible e imágenes. Originales preservados. Las líneas mantienen huecos `NULL` por periodo/serie, sin inventar cero ni continuidad. Conteos/medias/sumas se verifican por separado del render.

## Límites verificados

El calendario calcula el total del rango con `date_diff`, generando solo 2 001 intervalos candidatos y hasta nueve categorías intermedias. El recuento real (no el limitado) rechaza más de ocho series. Esto evita el cruce de millones de días con miles de categorías antes de mostrar el error. La salida dibujada conserva 2 000 pares periodo/serie; barras conserva 100 grupos. Vista parcial, alcance y periodos sin observaciones permanecen explícitos.

## Validación

- Pruebas dirigidas iniciales: tres correctas (14,3 s). Siete cálculos por mes, día/año, bisiestos, fechas malformadas/ausentes/vacías, identificadores, series y huecos, filtros, selección visual y SVG.
- Regresión añadida antes de la suite final: 10 000 categorías cruzadas con el rango 0001–9999 deben producir el rechazo comprensible sin expandir el calendario completo. Las unidades y el límite intermedio también tienen prueba unitaria.
- Comprobación estática final: cero errores y advertencias. `npm test`: 132 pruebas correctas, 16 archivos.
- Las tres regresiones temporales finales ya pasaron: 6,6 s para cálculos/fechas, 3,2 s para extremos/10 000 series y 4,4 s para interfaz/exportación. La primera prueba dirigida precedía al refuerzo de categorías; estos son los casos de la versión acotada.
- Capturas finales en [claro 1440×900](dw02b-time-light-1440.png) y [oscuro 1280×800](dw02b-time-dark-1280.png), con contador de fechas descartadas, meses de calendario y huecos sin segmentos inventados.
- Suite completa final: **87 pruebas correctas**, sin reintentos, en 3,2 minutos, incluyendo build de producción (`npm run test:e2e`). Registros locales temporales: `/private/tmp/freyalab-time-check-final.log`, `/private/tmp/freyalab-time-unit-final.log`, `/private/tmp/freyalab-time-acceptance-final.log`. Paquete/instalación y CI se registran aparte en el PR para el commit exacto, sin presentar checks de #29 como prueba de esta entrega.

## Alcance pendiente

Timestamps, formatos locales/ambiguos y agrupaciones semanales no forman parte de esta subentrega. No se interpretan silenciosamente como fechas ISO. Filtros propios del gráfico siguen en DW-02c; persistencia/exportación de agregados en DW-03. No certifica instalación manual multiplataforma, lector de pantalla ni usabilidad con personas.
