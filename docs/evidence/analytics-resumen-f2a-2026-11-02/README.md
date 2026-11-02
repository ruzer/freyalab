# Historia 11 · F2a · Resumen y gráfico

Fecha de comprobación: 2026-11-02. Rama aislada `codex/analitica-resumen-grafico-f2a-entrega`; fuente final `b5c2ad2f1048fdc19a51df6e555f3515df4c1db8`, main documental `695d86f651bd5f9c6cca7f015813e0b2ca4616ba` y base de producto `05212fdb86befd40f24132e8ebc7ce7e9b4b27fe`. No se modificó el checkout del propietario, el CSV original, el guardado, el IPC ni las dependencias.

**Evidencia al congelar la fuente:** este documento conserva mediciones, capturas y salidas locales reales, incluidos los fallos encontrados. El informe final del PR de continuación registra el resultado de la repetición integral y la CI por head, con sus enlaces; no se infieren del pase enfocado. No se cambia un commit solo para actualizar el estado de la CI.

## Resultado y alcance

Una presentación hermana de Tabla y Texto reutiliza CsvCharts: gráfico arriba y resumen tabular abajo. La tabla conserva borradores, filtros y selección al pasar a la presentación analítica; antes de salir de una celda confirma el borrador en memoria, sin guardar el archivo. La herramienta secundaria Estadísticas/SQL permanece. No se duplican AnalysisDock, workspace-layout, motor CSV, DuckDB ni ECharts.

Seis botones nativos permiten cambiar de tipo; la explicación viene de `suggest()` y perfiles existentes. El formulario, configuraciones, controles de series/fechas/filtros, zoom, exportaciones, consulta, precisión y tabla accesible original se conservan en Más opciones. Menos texto inicial: un icono de información y una línea de estado anunciado. Los nombres únicos no llevan números; los visualmente duplicados se desambiguan por posición.

El resumen presenta cinco filas por página y conserva acceso a todos los grupos que permite el límite original del gráfico. Los totales son consultas de solo lectura en DuckDB (`GROUPING SETS`) sobre el mismo alcance: promedio y mediana se recalculan; no se suman estadísticas agrupadas. Los campos ausentes y vacíos se mantienen distintos. Solo conteos/sumas/frecuencias tienen porcentajes; sin denominador o con total cero se muestra «—». En dispersión y líneas numéricas sin agregación no se inventa un total; la tabla conserva las observaciones. Los calendarios sin observación siguen ausentes.

La consulta normal `chartSQL` mantiene literalmente su salida de main: 67 configuraciones comparadas con SHA-256 capturado del generador original. El helper de totales reutiliza sus validaciones/identificadores y limita las filas/columnas de presentación a las marcas visibles; el total global sigue siendo del alcance completo. Se conservan los presupuestos y la cancelación existentes.

## Reutilización y seguridad (ADR 0021)

Antes de escribir interfaz se publicó el alcance en #106: cinco bloques mínimos y siete respuestas. #106 se fusionó externamente con solo el primer commit documental durante la implementación; esa fusión no entregó el código de F2a.

1. Ya existen CsvCharts, ChartPresets, AnalysisDock/workspace-layout, perfiles/suggest, chartSQL, DuckDB y ECharts. Se redistribuyen y conectan.
2. Ponytail, ECC diseño/accesibilidad/E2E/revisión de seguridad y TDD se aplicaron como herramientas de desarrollo. Visualize-data/Brand orientan marcas, paleta, totales y contraste. Sin skill dedicada de Svelte ni plugin específico de validación de colores encontrado: se usan pruebas reproducibles con ECharts y colores computados del DOM.
3. Integración directa TypeScript/Svelte; no CLI/MCP del producto ni manejadores en línea del HTML de referencia.
4. Dependencias fijadas existentes; package.json, lockfile y avisos sin cambios. No adopción nueva ni nueva auditoría de bibliotecas.
5. Coste: adaptar disposición/etiquetas, consultar totales y probar recorridos; no otro motor/renderer/almacén canónico.
6. Pegamento: presentación transitoria, misma configuración, actualización diferida, cancelación/invalidez y tabla acotada.
7. Valor propio: comprender resultados y navegar sin SQL; análisis y dibujo delegados en motores existentes.

Revisión de seguridad del diff: no HTML arbitrario nuevo; etiquetas Svelte escapadas, tooltips richText, identificadores generados con el validador existente, operaciones SQL enumeradas, sin fuentes SQL libres nuevas. Se reutilizan revisión/propietario de documento, SQL de lectura, límites, cancelación y exportación validada. Ninguna llamada de red nueva. El prototipo Gemini se conserva como documento visual sin ejecución en la app.

## Rojo → verde

Las salidas rojas se conservan en `logs/`; no son pruebas omitidas. Hubo intentos intermedios fallidos, incluidos ajustes de navegación de los specs existentes, una expectativa de orden corregida, overflow SVG y metadatos de exportación; no se presentan como verdes.

| Comportamiento | Rojo real conservado | Comprobación verde |
| --- | --- | --- |
| Pestaña hermana, resultado automático, opciones plegadas | `01-red.log`, botón inexistente en main | E2E de nueva presentación |
| Sin ordinales innecesarios, EN, paleta y tramas | `02-presentation-red.log`, 4 fallos | 4 pruebas de presentación |
| Total global y de series, promedio ponderado | `03-total-red.log`, 28,25 ausente | DuckDB real |
| Total de fila sin sumar promedios | `04-row-total-red.log`, A=2 ausente | DuckDB real |
| Pivotar sin recalcular/convertir datos en JS | `05-pivot-red.log` | 4 pruebas puras |
| Dispersión con un total nulo, no uno por registro | `06-scalar-red.log`, devolvía 4 | DuckDB real |
| Editor de filtros del gráfico en EN | `07-filter-red.log` | E2E con total 2.000 y CSV intacto |
| Tipo sugerido Líneas usa mes para fechas ISO | `08-date-red.log` | E2E: enero=30, febrero=30, total=60 |
| Guardar generación manual para pocas filas con celdas grandes | `09-size-red.log`, botón manual inexistente | E2E de guardia por bytes |
| Columnas del total limitadas a las marcas visibles | `10-total-bound-red.log`, 1.402 en vez de 402 | `10-total-bound-green-final.log`: 83/83 (totales + equivalencia) |
| Cierre y recuerdo del panel Analizar | `full-e2e.log`, compact-toolbar fallo esperado 0 / recibido 1 | `12-navigation-green.log`, prueba original intacta |
| Barra dentro del ancho disponible | `11-toolbar-red.log`, borde a 1.490,97 px en ventana de 1.440 | `12-navigation-green.log`, ambos anchos. Se reutiliza compacto: etiquetas se ocultan bajo 1.280 px de área disponible. |
| Nombre de atípicos de Caja en EN | `13-outliers-red.log` | `13-outliers-green.log`: 15/15 presentación + gráficos |

## Validación local

Equipo: Apple M2 Max, 32 GiB, darwin arm64; Node 24.22.1, Electron 44.9.2, Pandoc local 3.12.1. Son datos sintéticos temporales con perfiles aislados, sin usar documentos del propietario ni la app instalada.

| Comando | Resultado real | Registro |
| --- | --- | --- |
| `npm run check` | 0 errores, 0 avisos; salida 0 | `logs/verified-check.log` |
| `FREYALAB_PANDOC_TEST_PATH=/opt/homebrew/bin/pandoc npm test` | 119 archivos, 2.350 pruebas aprobadas; salida 0 | `logs/verified-unit.log` |
| E2E enfocadas finales anteriores al cierre | 12/12, sin reintentos, 1,2 min; luego se añadieron guardia por bytes/borrador y límite de totales | `logs/final-focused-e2e.log` |
| Calidad visual/interacción enfocada intermedia | 2/3; contraste real y borrador pasan; la guardia funcionaba pero el test esperaba una frase incorrecta en la ayuda. Expectativa corregida conservando su alcance. | `logs/quality-e2e.log` |
| Primera suite E2E completa, cero reintentos, fuente 18cfc06 | 526 aprobadas y 1 fallo de cierre del dock; 17,6 min; salida 1. Se conserva el fallo, no se declara verde. | `logs/full-e2e.log` |
| E2E tras reparar la navegación, cero reintentos | 36/36, 1,4 min: incluye compact-toolbar **sin editar**, resumen, volver/expandir/redimensionar; además comprobación de Texto con borrador | `logs/12-navigation-green.log` |
| Repetición integral de cierre (529 casos) | Se ejecuta con la fuente congelada; resultado real, head y CI se registran en el informe del PR, no se deducen de las 36 enfocadas | Informe del PR y artefactos de CI |
| `npm run build` | salida 0; no equivale a probar instaladores | `logs/verified-build.log` |

Las últimas suites check/unitarias/build corresponden al contenido final de b5c2ad2. Los cherry-pick de los dos commits propios a main 695d86f no alteraron src ni tests respecto a 3cd9b20 (comparación Git sin diferencias). Los tiempos locales no se presentan como garantías de otras máquinas ni como CI.

## Calibración de la vista previa

Guardia inicial medida antes de añadir el límite por bytes: hasta 3.000 filas y 200.000 celdas. Registro íntegro: `calibracion-antes-guardia-bytes.json`. Cada número es la mediana de tres regeneraciones completas de la misma configuración (incluye preparación, perfiles cuando procede, consulta normal, totales y presentación; medición por Playwright, no CPU pura). Se comprobó que los archivos no cambiaron.

| Filas | Columnas | Bytes | Mediana local (ms) |
| ---: | ---: | ---: | ---: |
| 100 | 3 | 812 | 1.341,57 |
| 3.000 | 3 | 23.722 | 1.341,95 |
| 1.000 | 200 | 403.788 | 1.843,51 |
| 3.000 | 67 | 408.291 | 1.839,97 |
| 3.000 | 3 | 1.070.722 | 1.332,96 |
| 3.000 | 3 | 30.020.722 | 3.842,73 |
| 100.000 | 3 | 790.022 | 1.841,64 |
| 1.000.000 | 3 | 7.900.022 | 8.375,52 |

Decisión conservadora: automático solo con documento editable no grande, tamaño conocido ≤1 MiB, ≤3.000 filas y ≤200.000 celdas; 300 ms de espera tras cambios. Fuera de esa guardia se conservan botón y cancelación. El corte por bytes se añadió porque igual cantidad de filas no acota el coste. El millón usa la ruta grande existente y nunca se regenera automáticamente. Estos datos calibran una decisión, no son un contrato universal de latencia. No se midieron aún PC modestos ni las cuatro plataformas; la CI no se usa como benchmark universal.


### Repetición aislada de la fuente final b5c2ad2

`node experiments/analytics-f2a/measure.mjs <directorio-temporal>`; salida 0. Ocho archivos intactos tras cuatro generaciones por archivo (una inicial y tres mediciones). Registro: `medicion-fuente-final.json` y `logs/measurement-final.log`. Sin solapar esta medición con E2E/perf ni otras suites. No se quitaron plazos/asserts del producto.

| Filas | Columnas | Bytes | Automática | Mediana (ms) |
| ---: | ---: | ---: | --- | ---: |
| 100 | 3 | 812 | Sí | 1339.91 |
| 3000 | 3 | 23722 | Sí | 1346.22 |
| 1000 | 200 | 403788 | Sí | 1844.33 |
| 3000 | 67 | 408291 | No | 1845.27 |
| 3000 | 3 | 1070722 | No | 1329.64 |
| 3000 | 3 | 30020722 | No | 3855.59 |
| 100000 | 3 | 790022 | No | 1835.70 |
| 1000000 | 3 | 7900022 | No | 7874.21 |

## Capturas y accesibilidad

Antes: capturas de main 05212fd, previamente tomadas para #105 con los mismos ocho registros sintéticos y reutilizadas sin repetir su auditoría. Después: Electron real de esta entrega, no boceto ni página simulada. Las capturas después corresponden a la corrección de navegación y se generan de nuevo durante la repetición integral y la CI del mismo head (artefactos evidence-*).


| Tamaño | Antes claro | Después claro | Antes oscuro | Después oscuro |
| --- | --- | --- | --- | --- |
| 1440×900 | [Antes](before-light-1440x900.png) | [Después](after-light-1440x900.png) | [Antes](before-dark-1440x900.png) | [Después](after-dark-1440x900.png) |
| 1280×720 | [Antes](before-light-1280x720.png) | [Después](after-light-1280x720.png) | [Antes](before-dark-1280x720.png) | [Después](after-dark-1280x720.png) |

| Estado | Captura y comprobación |
| --- | --- |
| Vacío | [Sin registros](state-empty.png): ayuda para empezar, sin inventar cifras |
| Cargando/cancelar | [100.000 filas](state-loading.png): progreso y cancelar alcanzables con teclado |
| Error | [Medida no numérica](state-error.png): motivo legible, CSV intacto |
| Truncado | [100 de 150 grupos](state-truncated.png): no presenta todas las marcas como visibles |
| Resultado con límite de vista previa | [Manual por bytes, 3.000 registros completos](state-result-limits.png): no es muestra |
| Estrecho | [800×720](state-narrow.png): mismo resultado principal, sin tira vertical ni sidebar |
| Inglés | [EN](state-en.png) |
| Pseudolocalización real | [en-XA](state-en-XA.png): relanzamiento con perfil de idioma, no evento simulado |

Los tests comprueban la altura del gráfico y la posición inferior del resumen dentro de la ventana, scroll inicial cero, modo estrecho de 800×720 sin barra lateral ni tira vertical, botones nativos, Enter/disclosures, aria-pressed y aria-live. El test visual mide cada texto SVG contra el fondo CSS real (≥4,5:1), presencia de patrones y ticks redondos; ocho colores por tema se validan unitariamente (≥3:1). No sustituye una sesión con lector de pantalla.

## Límites y lo no verificado

- F2b (lista de campos, cuatro zonas, conversión explícita de montos/porcentajes) y F2c (arrastre) no se implementaron. Los valores con símbolos no se convierten silenciosamente.
- Se conserva la configuración al ir a Tabla en el mismo documento; no se añade persistencia de la pestaña ni del estado abierto de Más opciones. Las configuraciones guardadas siguen por el contrato existente.
- El resumen pagina las marcas acotadas por el límite original; la fila Total es del alcance completo, no solo de la página. Ocultar una serie cambia el dibujo, no los totales; se anuncia en el estado.
- Se conserva la precisión de cálculo del motor existente (DOUBLE seguro para interpretación numérica), no se promete decimal financiero exacto nuevo. El CSV canónico sigue siendo textual. El resumen usa 12 cifras significativas, como las estadísticas existentes; la tabla original de resultados y sus exportaciones conservan las cadenas del motor.
- No se probó manualmente con lector de pantalla, alto contraste del sistema, todas las resoluciones menores de 800 px ni equipos Windows/Linux locales. La comparación de plataforma debe leerse en la CI del head final.
- No se ejecutó ninguna fusión de PR ni se publicó release o actualizó la app instalada. #105 se cerró sin fusionar, tal como autorizó el propietario. #106 fue fusionado externamente antes de contener implementación; el propietario autorizó un PR de continuación en borrador, base main, para entregar esta fuente.
- El defecto conocido SEG-S2e de custom-style en Word continúa fuera de alcance. Una prueba que documenta ese defecto no acredita que esté corregido.

## Cierre por head (fuera de este snapshot)

El PR de continuación enlaza #106, #105, esta evidencia y la salida real de la repetición completa. La CI actual ejecuta Ubuntu 24.04, Windows 2025 y macOS 15 ARM en PR, con unitarias, E2E fast + perf/solo y la app empaquetada. Intel solo se ejecuta en main/nocturno por la configuración ya aprobada; su ausencia no equivale a compatibilidad Intel verificada. No se modificó ningún workflow, plazo ni reintento. Antes de integrar, consultar el resultado del **head exacto** en el informe del PR; un verde anterior no se transfiere.
