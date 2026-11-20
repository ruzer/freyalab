# SIM-2b · Gráficos más claros · Alcance y ADR 0021

Fecha: 2026-11-19. Rama `codex/sim-2b-grafico-claro`, worktree independiente con HEAD inicial `d5de7907ccf6af135340c2cfd5c85510ea49dab8`. Parte de `origin/main 056d28f3ad1177a1fd2bf393f27e7ac77e82af8d` e incorpora A normalmente para desarrollo aislado. La rama congelada de A y su CI no se modifican ni califican otro SHA. La base de publicación de B y la integración de A dependen de la coordinación de raíz y del propietario.

La [historia SIM-2](historia-sim2-analisis-graficos-diseno-para-codex.md) conserva sus 252 líneas y SHA-256 `c0fa99ec6c788ca4316d8cf1531dd69c1a88dcbfdccd2d1492b903b375f08273`. Las decisiones del 18 de noviembre incluyen título editable y dejan las barras de distribución de Información para después de beta.

## Alcance de B y bloque actual

B reúne la configuración en el panel de campos, traslada los ajustes únicos al plegable Ajustes del gráfico y los datos/consulta/filtros/vista recuperada a Detalles del cálculo, permite editar el título y gira etiquetas solo cuando no caben. Conserva los controles y handlers existentes, la alternativa de tabla, el modo manual y el menú Exportar de A. No adelanta C/D/G ni repite E/F.

El bloque actual implementa únicamente el contrato puro del título:

- `ChartOptions.title?:string` describe un título propio opcional. El esquema estricto existente acepta títulos recortados de 1 a 120 caracteres y presets anteriores sin título, con la misma versión y protección de biblioteca.
- `chartOption` usa el título propio como texto, con fallback seguro al título automático para ausencia o blancos. Conserva la descripción accesible, las series, ejes y los valores del gráfico.
- `chartResult` usa el título en `metadata.description` del JSON/contexto CSV y en la fila Descripción del Markdown, donde hoy se usa el título automático. El H1 genérico del informe, las filas CSV y sus encabezados de columnas permanecen en su formato actual: no se añade preámbulo, fila ni un segundo formato de exportación.
- El título se trata como dato: no se interpreta HTML/Markdown del usuario. Se reutilizan `literal`, los serializadores, el hash del CSV y las protecciones existentes.
- Para parámetros idénticos, añadir title produce exactamente el mismo `chartSQL` y `chartTotalSQL`. No cambia qué se calcula, sus límites ni los datos.

Este bloque no modifica UI, firma de cálculo, rotación, distribución de controles ni código de carga de perfiles. Tampoco añade dependencias, detectores, comandos, ajustes, canales IPC, migraciones o persistencia aparte del campo opcional en presets.

## Mapa mínimo de este bloque

| Archivo | Conexión |
| --- | --- |
| `src/shared/charts.ts` | Campo opcional en ChartOptions; sin modificar las consultas ni chartLabels. |
| `src/main/chart-presets.ts` | Añadir title al esquema options estricto; trim/min/max, misma biblioteca y validación. |
| `src/renderer/chart-option.ts` | Resolver el título propio o automático y usarlo en presentación/accesibilidad. |
| `src/main/chart-result.ts` | Descripción propia o automática en los tres formatos, con escaping y datos originales. |
| `tests/chart-presets.test.ts` | Compatibilidad, título recortado y fronteras, rechazo estricto sin pérdida de biblioteca. |
| `tests/chart-presentation.test.ts` | Título propio como texto y fallback con los contratos reales actuales. |
| `tests/chart-result.test.ts` | Descripción de JSON/contexto/Markdown, HTML literal seguro, CSV idéntico y consultas idénticas. |

Los consumidores futuros de UI siguen siendo `CsvCharts`, `ChartFields`, `ChartPresets`, `tests/e2e/panel.ts` y los flujos de gráficos. Este bloque no los adapta ni declara su aceptación. `chartConfiguration` ya valida exportChartResult y presets en el puente actual; no necesita otro canal o esquema paralelo.

## Conexiones de UI que quedan por concretar

La edición del título deberá excluirlo de `signature`, que hoy serializa todo options, para evitar que renombrar cancele/recalcule. También deberá conservarlo al crear una sugerencia; `startSuggestion()` sustituye hoy el objeto completo. Esas modificaciones se harán con su rojo de comportamiento de UI, no dentro del bloque puro.

El modo manual omite perfiles/samples/interpretable. Retirar el formulario sin una alternativa en los controles existentes perdería la elección explícita de medida numérica y algunos recorridos temporales. El agrupador de campos omite hoy none, que el formulario sí ofrece. La interfaz manual, la condición de fecha y la conservación de Sin agrupar se concretarán antes de retirar controles; no se resolverán mediante un barrido automático nuevo.

Los siete pasos con clic simple dependen de la interacción de campos especificada en C. B conserva su alcance; no se presenta el doble clic actual como prueba del clic simple futuro. La rotación requiere medir el ancho real de pantalla/exportación y etiquetas; no se fija una heurística ni se modifica todavía.

## Rojo primero y evidencia

Las pruebas nuevas llaman las APIs reales existentes. No importan funciones inexistentes ni introducen falsos resultados, cambios de plazos o retries. La prueba de título ignorado observa la salida de chartOption; la del esquema intenta guardar un título válido; la de datos comprueba description, escaping y CSV sin preámbulo. Los casos de compatibilidad/seguridad y SQL idéntico conservan cobertura aunque ya sean verdes antes del cambio.

Los logs y JSON de rojo/verde se guardan de forma privada en la evidencia de B. Raíz registra el checkpoint documental y rojo antes de fuente. Este bloque usa unitarias y tipos; GUI, build, capturas y aceptación del flujo completo se incorporarán desde sus ejecuciones reales. No se publica B ni se abre su PR antes de resolver la base e integración correspondientes.

No se elimina ningún caso existente ni se cambian sus datos esperados. La migración de selectores del formulario, una vez concretada la UI, documentará archivo/línea, motivo y sustitución, conservando cálculos, muestras, filtros, revisión, cancelación, exportación y bytes.

## Siete respuestas del ADR 0021

1. **¿Existe herramienta?** Sí: ChartOptions/ChartConfiguration, el esquema estricto de presets, chartOption, chartResult y sus serializadores ya resuelven datos, configuración y presentación. Falta transportar y usar el título opcional.
2. **¿Existe habilidad reutilizable?** El flujo rojo→verde y el patrón de edición en fila de PRJ-01c cubren validación/foco cuando llegue la UI. Ponytail limita este bloque al contrato puro y sus consumidores reales; no incorpora herramientas de desarrollo al producto.
3. **¿Hay CLI, API o MCP suficiente?** Las funciones y el puente tipado actuales bastan. El título viaja en options y se valida en chartConfiguration; no hay IPC, comando, detector o acceso nuevo del renderer.
4. **¿Madurez, seguridad, mantenimiento y licencia?** Código interno MIT, ECharts y zod instalados. Se conservan estrictez, validaciones de configuración/revisión, escritura atómica, bibliotecas futuras o dañadas, SVG como texto, escaping Markdown, protección de fórmulas y hash CSV. Las pruebas puras no acreditan PNG, GUI o paquete.
5. **¿Coste?** Un campo opcional y su uso en tres consumidores puros. Sin versión nueva, migración, dependencia, preferencia, caché o motor paralelo. La UI futura reutilizará estado y controles existentes.
6. **¿Pegamento mínimo?** Aceptar title recortado, resolver propio/automático en presentación y descripciones, y mantener las consultas y filas intactas. Sin mover resultados ni duplicar serialización.
7. **¿Qué valor tiene código propio?** Nombrar y recuperar una salida conservando datos, seguridad y compatibilidad. Rehacer perfiles, SQL, presets o exportaciones no aporta valor.

## Estado inicial

Rojo puro registrado sobre la fuente inicial: 5 fallos de comportamiento y 48 casos aprobados en los tres archivos (53 casos, 0.819 s de proceso). Los fallos demuestran título ignorado en presentación/descripción y rechazo de title válido por el esquema estricto; no son errores de importación o preparación. Los cuatro archivos de producto conservaron sus SHA antes/después. Fuente de producto todavía sin cambios; se espera el checkpoint de raíz antes de implementar. La historia original y la rama de A permanecen intactas.
