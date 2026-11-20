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

Los consumidores futuros de UI siguen siendo `CsvCharts`, `ChartFields`, `ChartPresets`, `tests/e2e/panel.ts` y los flujos de gráficos. Este bloque no los adapta ni declara su aceptación. `chartConfiguration` ya valida exportChartResult y presets en el puente actual; no necesita otro canal o esquema paralelo. El siguiente bloque añade únicamente `tests/e2e/chart-clarity.spec.ts` y este alcance; la implementación de UI espera el rojo real de raíz.

## Conexiones de UI que quedan por concretar

La edición del título deberá excluirlo de `signature`, que hoy serializa todo options, para evitar que renombrar cancele/recalcule. También deberá conservarlo al crear una sugerencia; `startSuggestion()` sustituye hoy el objeto completo. Esas modificaciones se harán con su rojo de comportamiento de UI, no dentro del bloque puro.

El modo manual omite perfiles/samples/interpretable. `CsvCharts.svelte:74` limita el automático a fuentes completas de hasta 3000 filas, 1 MiB y 200 000 celdas; `loadFields` limpia esos tres estados en la línea 153 y retorna sin `analyzeColumn` en la 155. Sin perfil, `shared/chart-fields.ts:5,22,27` trata el campo como texto y añadirlo a Valores selecciona texto/conteo; `ChartFields.svelte:75` deshabilita suma/promedio. La agrupación de `ChartFields.svelte:78` solo aparece con perfil fecha y omite none. El aviso de conversión de `CsvCharts.svelte:305` no sustituye la elección manual: `interpretable` está vacío y no permite confirmarla.

**Excepción mínima de conservación:** cuando el campo elegido no tenga perfil comprobado, Ajustes conserva los selectores actuales de tipo de medida, X/Y y agrupación temporal, incluido Sin agrupar fechas. Estos controles mantienen sus cambios actuales de options; no introducen un detector, barrido, conversor o clasificación automática de identificadores. Con perfil, Filas/Valores/Columnas y sus controles actuales sustituyen esos duplicados. Tipo sigue en los botones, Resumir en Valores, series en Columnas y Generar gráfico conserva el botón manual existente. No se añade una segunda selección de esas funciones. La prueba manual usa 3001 filas para omitir perfiles por el límite existente y exige que no aumenten las llamadas a `analyzeColumn`.

Los siete pasos con clic simple dependen de la interacción de campos especificada en C. B conserva su alcance; no se presenta el doble clic actual como prueba del clic simple futuro. La rotación requiere medir el ancho real de pantalla/exportación y etiquetas; no se fija una heurística ni se modifica todavía.

## Seis casos de UI preparados antes de fuente

La fixture sintética conserva Ciudad, Ingreso, Fecha ISO, ID con ceros iniciales, Grupo y Edad; usa cinco ciudades y 50 filas. Las variantes tienen 3001 filas para modo manual y 60 filas con treinta nombres de 25 caracteres para Caja. No se modifica ningún caso anterior ni el helper común. Se usa el botón Añadir y su menú actual; no se adelanta el clic simple de C.

| Caso nuevo en chart-clarity | Conducta y oráculo |
| --- | --- |
| Lápiz, Intro, Escape y vacío | Cambiar título enfoca Título del gráfico; Intro recorta y guarda, Escape cancela y blanco recupera el título automático mostrado como placeholder. SQL y operaciones de análisis/cancelación permanecen exactamente iguales; SVG y tabla no desaparecen. |
| Campos, preset y exportaciones | Cambiar campos conserva el título; guardarlo y aplicar su preset lo recupera. SVG y SVG intermedio enviado al PNG incluyen el título. JSON y contexto CSV conservan descripción, revisión, configuración y 50 IDs originales; se comprueban todas las filas CSV, encabezados y SHA-256. |
| Ajustes y Detalles | Ajustes empieza cerrado y está después de las zonas dentro de Campos y zonas. La unicidad se comprueba desde todo el panel de gráficos, incluidos zoom, series y presets; se recorren scope/orden, fecha/none, intervalos y tendencia. Fecha no aparece con Ciudad ni Edad, ni en Histograma/Dispersión/Mapa/Caja; intervalos solo aparece con Histograma. Tabla, consulta, filtros aplicados y vista recuperada quedan en Detalles del cálculo. |
| Manual sin perfil | Los controles existentes de medida, ejes y agrupación siguen alcanzables en Ajustes. Número/Suma se eligen expresamente, se comprueban total, mes y fechas sin agrupar con datos exactos; ningún perfil adicional ni cambio del CSV/ID. |
| Cinco ciudades | Barras muestra exactamente las cinco etiquetas, una por ciudad, a 0° cuando caben, a 1440 y 1280; el SVG exportado también conserva las cinco y sus ángulos. |
| Treinta nombres | Caja muestra 25° a ambos anchos y al exportar; conserva treinta grupos. `chartTop` reduce Barras/Mapa a diez grupos, por lo que no se altera ese ranking para fabricar este oráculo. |

Los únicos nombres accesibles nuevos previstos son Cambiar título, Título del gráfico y Ajustes del gráfico. Configuración del gráfico, Campos y zonas, Detalles del cálculo y todos los nombres de controles/exportación ya existen. El selector de datos usa la tabla real; el de rotación obtiene las matrices de transformación de los textos del SVG real, sin una API o hook de dimensiones. Los anchos observados del gráfico se adjuntan como diagnóstico, sin imponer una API a `chartOption` antes del rojo.

El caso de renombrado instala `page.clock` únicamente en el renderer y después del gráfico real, con movimiento reducido. `documents()` por el mismo puente sirve de barrera FIFO antes de fotografiar el observador de main y después de cada `runFor(301)`, que agota el debounce actual de 300 ms. Un MutationObserver detecta la pérdida de SVG/tabla. Es control temporal de la prueba funcional, no una medición de latencia real ni una modificación de timeout, retries, reloj de main o producto. Los cinco casos restantes usan reloj real. JSON y CSV se exportan mediante el handler real por separado: sus datos, configuración y contexto coinciden, mientras cada completedAt debe ser una fecha válida de su propia ejecución.

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

Rojo puro registrado sobre la fuente inicial: 5 fallos de comportamiento y 48 casos aprobados en los tres archivos (53 casos, 0.819 s de proceso). Los fallos demuestran título ignorado en presentación/descripción y rechazo de title válido por el esquema estricto; no son errores de importación o preparación. Los cuatro archivos de producto conservaron sus SHA antes/después. El checkpoint documental y rojo fue `c54966e792eb8976831f36a9113640aacc611013`.

Después del cambio puro pasan 53/53 casos (38 anteriores y 15 nuevos), tipos Node, renderer y consumidores. Se conserva también un primer intento de 52/53: la prueba nueva exigía `&lt;img` mientras el serializador existente emitía la codificación equivalente `&#x3C;img`. Se corrigió únicamente esa expectativa de representación, manteniendo título exacto, filas, CSV/hash y ausencia de etiquetas activas. La historia original y la rama congelada de A permanecen intactas. Las seis E2E nuevas están preparadas; su rojo y la implementación de UI siguen pendientes de la ejecución de raíz.
