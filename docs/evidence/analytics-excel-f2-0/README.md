# Historia 11 · F2-0 · Tabla dinámica + gráfico

**Estado: boceto para aprobación. No es la interfaz implementada.** Base `main` `05212fdb86befd40f24132e8ebc7ce7e9b4b27fe`, que incorpora F1/#104. Rama independiente `codex/analitica-excel-f2-0`. No se modifica `src/`, dependencias, guardado, SQL, límites ni exportaciones. No se modifica LAB ni el checkout del propietario.

[Contrato recibido, conservado aparte de la historia F1](../../stories/11-analitica-excel-f2.md) · [Abrir HTML del boceto](index.html) (abrir localmente; GitHub muestra el código). Apariencia: `index.html?theme=light` o `index.html?theme=dark`.

## Propuesta visual

- Campos a la derecha, como en Excel. Insignias de tipo, «Añadir a…» y cuatro zonas: Filas, Columnas, Valores, Filtros. En la propuesta futura, clic/menú y teclado compartirán acciones; el arrastre vendrá después.
- Área principal: gráfico **y** tabla dinámica simultáneos; nombre legible, motivo de sugerencia en una línea y una sola línea de estado.
- «Resumir por»: Suma, Cuenta, Promedio, Mín., Máx., Mediana. No se introduce otro motor de cálculo.
- A 1280×720 se propone usar toda el área, ocultando temporalmente el explorador; «Volver a la tabla» queda arriba y horizontal. No cambia el archivo ni se propone borrar la preferencia del explorador. Esta adaptación visual requiere la aprobación del propietario.
- «Más opciones» conserva el lugar para los controles actuales, exportaciones de resultados, precisión, límites, zoom, ajustes y configuraciones; «Ver consulta» está dentro. Nada se elimina del producto en este PR.
- La nota de texto explica montos y porcentajes y reserva la conversión explícita. La política propuesta para la implementación es interpretar en el análisis, sin reescribir el CSV original; requiere definir la conversión y su confirmación al implementar, no está implementada aquí.

Los botones y campos son ilustrativos. Solo funcionan los desplegables nativos de ayuda y «Más opciones», y la elección visual del select nativo. No hay cálculos, filtros, sugerencias dinámicas, conversión, exportación, persistencia, arrastre ni acciones de edición. El HTML indica «Boceto estático» y «Datos ficticios».

## Antes / propuesta

| Tamaño | Claro | Oscuro |
|---|---|---|
| 1440×900 | [Antes](before-light-1440x900.png) · [Propuesta](after-light-1440x900.png) | [Antes](before-dark-1440x900.png) · [Propuesta](after-dark-1440x900.png) |
| 1280×720 | [Antes](before-light-1280x720.png) · [Propuesta](after-light-1280x720.png) | [Antes](before-dark-1280x720.png) · [Propuesta](after-dark-1280x720.png) |

**Antes:** Electron real compilado desde main en este worktree, perfil temporal y los mismos ocho registros ficticios. Se configuró suma de Ventas por Región, serie Canal, se generó y se volvió al inicio del panel para capturar su disposición sin desplazamiento. A 1440×900 el gráfico empieza en y=711,5 px; a 1280×720, en y=590,5 px. Su alto fijo de 342 px no cabe completo en ninguna de esas vistas. Esto demuestra la disposición actual; no es una captura fabricada del antes.

**Propuesta:** HTML estático renderizado con Chromium, mismos valores y temas. No se compara su rendimiento con una aplicación que ejecuta DuckDB.

| Tamaño | Gráfico propuesto | Tabla propuesta | Exportaciones | Desbordamiento de documento |
|---|---|---|---|---|
| 1440×900 | y=252,6 a 617 px | y=627 a 825 px | y=833 a 862 px | No |
| 1280×720 | y=239,3 a 466 px | y=476 a 650 px | y=657 a 683 px | No |

Las coordenadas son iguales en ambos temas. El alto del gráfico responde al espacio disponible. Los textos SVG mantienen 12 px (rótulos) y 11 px (escala), sin encogerlos para que quepan. Marcas horizontales, escala desde cero, valores directos y ocho barras sin gradientes.

## Datos y exactitud del ejemplo

Registros ficticios: Norte/Web 1.200, Norte/Tienda 800, Centro/Web 1.600, Centro/Tienda 900, Sur/Web 900, Sur/Tienda 600, Oeste/Web 700, Oeste/Tienda 500. Descuento contiene `10%` como texto.

Totales: Norte 2.000; Centro 2.500; Sur 1.500; Oeste 1.200. Web 4.400; Tienda 2.800; total 7.200. Se contrastaron las celdas renderizadas con esos literales independientes y se contaron ocho marcas. Las posiciones/longitudes estáticas representan esos mismos valores; no son resultados calculados por una nueva implementación.

## Paleta, marcas y accesibilidad

Se aplicaron las reglas de marcas de la skill de visualización: barras desde cero, longitudes alineadas, etiquetas completas, dos colores explícitos de serie, leyenda compacta y trama para Tienda; no se depende solo del color ni se numeran categorías únicas. Se mantienen la tipografía del sistema y la estructura de FreyaLab. No se cambia su logotipo ni se pretende definir otra identidad de marca.

No se encontró un plugin dedicado de validación de color. Se ejecutó un validador local de contraste usando la fórmula WCAG documentada por la skill Brand, sobre **colores computados del navegador**, no solo nombres de variables. No se añade ese validador al producto ni una dependencia. Los mínimos comprobados: 4,5:1 para texto y 3:1 para marcas. No se hizo simulación de daltonismo.

| Tema | Texto/fondo | Secundario/panel | Web/fondo | Tienda/fondo |
|---|---:|---:|---:|---:|
| Claro | 15,24:1 | 5,39:1 | 5,13:1 | 5,30:1 |
| Oscuro | 14,51:1 | 7,06:1 | 7,48:1 | 8,66:1 |

Claro: Web `#006adc`, Tienda `#9b5d00`. Oscuro: Web `#6faaff`, Tienda `#efa657`. Foco visible, controles nativos, tabla con encabezados de fila y columna, descripción del SVG y región de estado. Se comprobó Enter para abrir/cerrar ayuda y «Más opciones». Esto **no acredita** teclado o lector de pantalla de las acciones futuras simuladas.

## Validación ejecutada y límites

Mac Apple silicon, Node **24.22.1**; Playwright ya fijado en el repositorio y Chromium local `chromium_headless_shell-1243`. Sin descargas nuevas. La navegación del boceto fue `file://`; cero solicitudes HTTP/HTTPS observadas y `connect-src 'none'`.

| Comprobación | Resultado real |
|---|---|
| Baseline main: dos clics deben dibujar | Rojo: 0 marcas antes de «Generar gráfico»; salida conservada |
| `npm run build` en main aislado para capturar el antes | Exit 0; no implica nueva función, instalador ni CI |
| Render estático en 4 tamaños/temas | Exit 0; ocho marcas, totales, geometría, contraste y teclado de disclosures comprobados |
| Inspección visual de cuatro propuestas | Realizada; sin recorte del resultado ni solapamiento de controles en esos tamaños |
| Checker de evidencia ECC | Exit 0: «Evidence record complete; visual correctness still requires rendered inspection.» Valida completitud del registro estático, no el funcionamiento de la app |

**No hay verde funcional de F2 en la app:** el resultado positivo es únicamente el boceto. No se ejecutaron `npm run check`, unitarias completas ni E2E completas para este PR documental, porque no modifica código de la aplicación ni tests. No se modifican workflows para omitir nada. La CI pesada puede omitirse por el filtro documental existente; si ocurre, no significa que F2 haya pasado CI.

No verificado/pendiente: actualizaciones reales, equivalencia funcional nueva sobre chartSQL, inferencia conectada, múltiples campos/medidas, agregados no aditivos y totales, cancelación, exportación, gran cardinalidad, idiomas en/en-XA, lectores de pantalla y sistemas Windows/Linux. Los ocho registros se eligieron para mostrar la distribución, no para prometer que caben todas las categorías de cualquier archivo. Los límites y la tabla accesible del producto deben seguir vigentes.

El boceto muestra un campo en Filas, uno en Columnas y uno en Valores; no decide ni promete capacidades multidimensionales adicionales de Excel. Para agregados no aditivos (promedio/mediana) un total futuro debe recalcularse con el motor, nunca sumar los resultados agrupados.

## Skills y reutilización

- **Ponytail full:** HTML documental sin dependencias ni implementación anticipada; detenerse para aprobación.
- **ECC frontend-design-direction:** jerarquía de resultado primero, vista estrecha explícita, contraste y revisión renderizada; sin cambiar el sistema visual de la app.
- **ECC accessibility:** rótulos, controles nativos, foco, tabla semántica, estado y canal redundante de patrón.
- **Data visualize-data + Brand:** reglas de marcas y paleta/contraste sobre el fondo real; no se añadieron motores ni recursos remotos.
- **TDD/E2E:** baseline real rojo, comprobaciones de render del boceto; los tests de implementación comienzan en F2a. No se confunden validaciones estáticas con pruebas de producto.
- **Svelte:** no se encontró skill dedicada; no se toca Svelte en F2-0.

ADR 0021, siete respuestas para la futura capacidad: (1) reutilizar componentes, perfiles/suggest, chartSQL/DuckDB y ECharts existentes; (2) usar las skills de desarrollo sin introducirlas al runtime; (3) integración directa, sin CLI/MCP en la app; (4) sin componente/licencia nuevos ni nueva auditoría de popularidad; (5) coste acotado al adaptador y UX; (6) compartir las acciones de clic/teclado/Pointer Events, sin motores duplicados; (7) el valor propio es el flujo integrado y el vocabulario comprensible, no reimplementar estadística. F2-0 solo documenta la propuesta.

## Trabajo anterior detenido

La primera instrucción autorizaba F2a directamente; al reemplazarla por este contrato se detuvo su rama local `codex/analitica-dos-clics-f2a` y su corrida enfocada. Quedó sin publicar ni fusionar: 23 casos pasados, dos fallidos, uno interrumpido y 23 sin correr. No es una entrega aprobada ni evidencia de este boceto, y no se trasladan sus cambios a este PR. El propietario mantiene su checkout intacto.

**Puerta siguiente: aprobación del boceto. No se empieza F2a/F2b/F2c ni se fusiona este PR automáticamente.**
