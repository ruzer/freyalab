# SIM-2b · Gráficos más claros · Alcance y ADR 0021

Preparación inicial: 2026-11-19; actualización documental: 2026-11-20. Rama `codex/sim-2b-grafico-claro`, worktree independiente con HEAD inicial `d5de7907ccf6af135340c2cfd5c85510ea49dab8`. Parte de `origin/main 056d28f3ad1177a1fd2bf393f27e7ac77e82af8d` e incorpora A normalmente para desarrollo aislado. La rama congelada de A y su CI no se modifican ni califican otro SHA. Este inicio es histórico. La evidencia actual por fases y el target final pendiente están al final de este alcance; la base de publicación e integración siguen la coordinación del propietario.

La [historia SIM-2](historia-sim2-analisis-graficos-diseno-para-codex.md) conserva sus 252 líneas y SHA-256 `c0fa99ec6c788ca4316d8cf1531dd69c1a88dcbfdccd2d1492b903b375f08273`. Las decisiones del 18 de noviembre incluyen título editable y dejan las barras de distribución de Información para después de beta.

## Alcance de B y fases

B reúne la configuración en el panel de campos, traslada los ajustes únicos al plegable Ajustes del gráfico y los datos/consulta/filtros/vista recuperada a Detalles del cálculo, permite editar el título y gira etiquetas solo cuando no caben. Conserva los controles y handlers existentes, la alternativa de tabla, el modo manual y el menú Exportar de A. No adelanta C/D/G ni repite E/F.

La primera fase implementó el contrato puro del título:

- `ChartOptions.title?:string` describe un título propio opcional. El esquema estricto existente acepta títulos recortados de 1 a 120 caracteres y presets anteriores sin título, con la misma versión y protección de biblioteca.
- `chartOption` usa el título propio como texto, con fallback seguro al título automático para ausencia o blancos. Conserva la descripción accesible, las series, ejes y los valores del gráfico.
- `chartResult` usa el título en `metadata.description` del JSON/contexto CSV y en la fila Descripción del Markdown, donde hoy se usa el título automático. El H1 genérico del informe, las filas CSV y sus encabezados de columnas permanecen en su formato actual: no se añade preámbulo, fila ni un segundo formato de exportación.
- El título se trata como dato: no se interpreta HTML/Markdown del usuario. Se reutilizan `literal`, los serializadores, el hash del CSV y las protecciones existentes.
- Para parámetros idénticos, añadir title produce exactamente el mismo `chartSQL` y `chartTotalSQL`. No cambia qué se calcula, sus límites ni los datos.

Esa primera fase dejó UI y cálculo intactos. La fase de UI reutiliza después los controles y handlers existentes; ninguna fase añade dependencias, detectores, comandos, preferencias, canales IPC, migraciones o persistencia aparte del campo opcional en presets.

## Mapa del contrato puro

| Archivo | Conexión |
| --- | --- |
| `src/shared/charts.ts` | Campo opcional en ChartOptions; sin modificar las consultas ni chartLabels. |
| `src/main/chart-presets.ts` | Añadir title al esquema options estricto; trim/min/max, misma biblioteca y validación. |
| `src/renderer/chart-option.ts` | Resolver el título propio o automático y usarlo en presentación/accesibilidad. |
| `src/main/chart-result.ts` | Descripción propia o automática en los tres formatos, con escaping y datos originales. |
| `tests/chart-presets.test.ts` | Compatibilidad, título recortado y fronteras, rechazo estricto sin pérdida de biblioteca. |
| `tests/chart-presentation.test.ts` | Título propio como texto y fallback con los contratos reales actuales. |
| `tests/chart-result.test.ts` | Descripción de JSON/contexto/Markdown, HTML literal seguro, CSV idéntico y consultas idénticas. |

La fase de UI reutiliza `CsvCharts`, `ChartFields` y `ChartPresets`; la migración de consumidores usa `tests/e2e/panel.ts` y los flujos de gráficos indicados en su tabla. `chartConfiguration` ya valida exportChartResult y presets en el puente actual; no necesita otro canal o esquema paralelo. Sus seis pruebas de `tests/e2e/chart-clarity.spec.ts` se escribieron antes de fuente y raíz ejecutó el rojo real antes de implementar.

## Conexiones de UI y límites

La edición del título lo excluye de `signature` y lo conserva al crear una sugerencia, cambiar campos o restaurar su preset. El editor recorta, valida, recupera el título automático al quedar vacío y restaura el foco. La prueba con reloj del renderer y observador real de IPC comprueba que renombrar no cancela ni recalcula ni retira SVG/tabla.

La evidencia anterior a la reorganización mostró que el modo manual omite perfiles/samples/interpretable. `CsvCharts.svelte:74` limita el automático a fuentes completas de hasta 3000 filas, 1 MiB y 200 000 celdas; `loadFields` limpia esos tres estados en la línea 153 y retorna sin `analyzeColumn` en la 155. Sin perfil, `shared/chart-fields.ts:5,22,27` trata el campo como texto y añadirlo a Valores selecciona texto/conteo; `ChartFields.svelte:75` deshabilita suma/promedio. La agrupación de `ChartFields.svelte:78` solo aparece con perfil fecha y omite none. El aviso de conversión de `CsvCharts.svelte:305` no sustituye la elección manual: `interpretable` está vacío y no permite confirmarla.

**Excepción mínima de conservación:** cuando el campo elegido no tenga perfil comprobado, Ajustes conserva los selectores actuales X/Y y agrupación temporal, incluido Sin agrupar fechas. El propietario aprobó además conservar una sola elección Texto/Número para toda medida agregada: las zonas eligen campo y resumen, pero no sustituyen esa interpretación explícita. Agrupar fechas permanece alcanzable para Barras/Líneas cuando el perfil ya contiene fechas válidas, falta el perfil manual o la configuración guardada ya trae agrupación. Esto incluye un perfil mixto con una fecha inválida; se conservan los descartes y avisos actuales. Los controles mantienen sus cambios actuales de options; no introducen un detector, barrido, conversor o clasificación automática de identificadores. Con perfil, Filas/Valores/Columnas sustituyen únicamente los selectores duplicados de campos. Tipo sigue en los botones, Resumir en Valores, series en Columnas y Generar gráfico conserva el botón manual existente. La prueba manual usa 3001 filas para omitir perfiles por el límite existente y exige que no aumenten las llamadas a `analyzeColumn`.

Los siete pasos con clic simple dependen de la interacción de campos especificada en C. B conserva su alcance; no se presenta el doble clic actual como prueba del clic simple futuro. La rotación usa el ancho real de ECharts tras cada resize de pantalla/exportación y su medición pública de texto Inter 12 px; reserva el margen horizontal predeterminado de las etiquetas. No estima el ancho multiplicando caracteres ni añade un hook de dimensiones.

## Seis casos de UI escritos antes de fuente

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

### Conservación explícita aprobada después de los seis casos

Se añaden dos casos independientes en `tests/e2e/chart-compatibility-controls.spec.ts`, antes de aplicar el parche de visibilidad. Reutilizan los bytes de las fixtures históricas de `charts.spec.ts`: diez filas con Y=`0005` y `9007199254740993`, y cuatro fechas con `2026-02-30`. Observan las respuestas reales que recibe `loadFields`, sin emitir otro análisis: Y debe tener perfil identificador, ocho números utilizables y un excluido; Fecha debe ser mixta con tres fechas válidas y una inválida.

El primero exige Texto/Número único en Ajustes, Suma bloqueada para Texto, elección explícita Número/Suma y los resultados exactos C=5, B=12, A=110. Volver a Texto restaura Conteo y C=1, B=4, A=5. El segundo exige Mes/Año único en Ajustes, resultados mensuales 30/30 y anual 60, aviso de una fecha descartada y retorno sin agrupación con el valor 99 original. Ambos contrastan el SQL emitido con `chartSQL`, conservan bytes/revisión/dirty y exigen que cambiar opciones no vuelva a perfilar. No se usan presets para ocultar la pérdida de un recorrido de creación.

Raíz ejecutó los dos casos antes de fuente. El primer intento falló por preparación: `openChartFields` consultaba la visibilidad antes de que Gráficos apareciera y buscaba su toggle de ventana estrecha en escritorio. Se conserva ese intento sin contarlo como rojo funcional; el helper ahora espera el panel visible y el aside montado antes de decidir si necesita el toggle real, sin sleeps ni plazos nuevos. El segundo intento alcanzó perfiles y resultados reales y ambos casos fallaron por el control ausente: 37,103 s Playwright / 37,454 s de proceso externo, sin reintentos.

Después de ese rojo y de la aprobación del propietario se cambiaron únicamente las dos condiciones de visibilidad de `CsvCharts.svelte`: agrupación temporal basada en fechas válidas ya perfiladas/modo manual/configuración ya agrupada, y selector Texto/Número para medida agregada. No cambia el handler ni se añade cálculo. La nueva decisión hacía incompatible solo la línea 155 de `chart-clarity.spec.ts`: se retiró esa etiqueta del bucle de ausencias y se añadió unicidad dentro de Ajustes y del panel completo en la línea 156. Permanecen las otras cinco ausencias y todos los demás cuerpos, datos y oráculos. El SHA anterior era `910d5b7990162f73a6260fdcf262b2d813e491ca131a1166b8ac979cc133200b`; el actual es `655c7b36ecb9890cf443e0209a1f4f524b0c697045fceff50f4ae116bfda305f`. No se atribuye el verde anterior de seis casos a esta fuente nueva; su ejecución actualizada queda pendiente.

La comprobación aislada de tipos del archivo nuevo terminó sin errores. Su enumeración añade exactamente dos identidades CSV: completo 799→801, rápido 736→738 y perf/solo 63→63, sin pérdida, duplicados ni traslado; rápido y perf/solo siguen siendo disjuntos y su unión coincide con el completo. No es una ejecución de esos casos. Tras las dos condiciones y la expectativa aprobada, `npm run check` termina con 0 errores/0 avisos en 9,233 s. Build y GUI de esta fuente corresponden a raíz y siguen pendientes; no hay otro cambio de producto en este bloque.

## Rojo primero y evidencia

### Migración de consumidores después del verde de B

Sobre `eb64dd43b22bc3fb4fd3caec7fd4f5d95105c874`, raíz registró check 0 errores/0 avisos, build y seis E2E aprobadas sin reintentos. Esto califica esos seis recorridos locales; no acredita todavía los consumidores anteriores, la suite completa o CI. Antes de editar consumidores, el listado completo registra **799 casos**: 736 rápidos y 63 perf/solo, conjuntos disjuntos cuya unión coincide exactamente, sin duplicados. Los seis casos nuevos de chart-clarity conservan sus identidades y oráculos.

El mapa directo contiene 11 specs anteriores y el helper panel.ts. Sus 119 casos registrados se conservan: el listado posterior contiene exactamente las mismas 799 identidades (736 + 63), sin omitir, borrar, renombrar, duplicar ni cambiar etiquetas de casos. Esto es enumeración, no ejecución de 799 pruebas. Las líneas anteriores pertenecen a eb64dd4; las posteriores son las del diff preparado.

| Consumidor: líneas anteriores | Líneas después | Casos antes / después | Navegación y oráculos que se conservan |
| --- | --- | --- | --- |
| `analysis-dock.spec.ts:51` | 51–58 | 3 / 3 | El control eliminado usado para foco se sustituye por un control alcanzable de Campos/Ajustes; docking y foco de retorno permanecen. |
| `analysis-tab.spec.ts:102,112,185` | 103,113,186 | 7 / 7 | Presets se abren en Ajustes; estado, reapertura, revisión y generación manual siguen comprobados. |
| `chart-fields.spec.ts:115,133` | 115,133 | 12 / 12 | Exportar no requiere Más opciones; automático se observa tras la acción de campo, sin falso botón Generar. Se conservan filtros, total y CSV. |
| `chart-review.spec.ts:136` | 136–143 | 8 / 8 | El plegable de teclado pasa a Ajustes; geometría, valores, truncado y representación permanecen. |
| `chart-single-load.spec.ts:36–58` | 36–62 | 2 / 2 | Ejes/tipo se eligen en Campos/tipos; tabla en Detalles. El observador conserva exactamente la consulta y una carga completa. |
| `chart-trend.spec.ts:30,37,87,104,120,145,179` | 30–34,57,96–145,173 | 9 / 9 | Campos/tipos disparan automático; scope, zoom, series y presets están en Ajustes. Se conservan regresión, degenerados, procedencia, exportaciones y cancelación. |
| `charts.spec.ts:18,38–42,54,98–107,134–169,185–196,242–272,289–312,338–366` | 18,33–110,131–232,275–350,373–400 | 32 / 32 | Formulario sustituido por Campos/tipos/Ajustes; datos/consulta/filtros/vista recuperada en Detalles; exportaciones en el menú de A. Todos los datos, precisión, seguridad, rechazo IPC, guardado, límites y bytes se conservan. |
| `csv-summary.spec.ts:29–40,72,81,112,130,138,178–180` | 29–40,72,81–82,113–115,132–141,181–183 | 15 / 15 | Ajustes reemplaza las comprobaciones del formulario plegado; campos/tipos, errores, totales, idiomas y geometría mantienen sus oráculos. |
| `project-source.spec.ts:190` | 190 | 7 / 7 | Scope desde Ajustes; fuente, error, recuperación y proyecto sin cambios. |
| `project-subset-analysis.spec.ts:143,145` | 144–154 | 13 / 13 | Tabla/contexto en Detalles y presets en Ajustes; subconjunto, lineage, SQL y exportación intactos. |
| `ui-u0.spec.ts:131–136` | 131–139 | 11 / 11 | La visibilidad/foco del plegable eliminado pasa al Ajustes del panel de campos; se mantienen resumen paginado, altura y tamaño de controles. El título histórico del caso se conserva como identidad. |
| `panel.ts:80` | 82–155 | helper | Generar selecciona únicamente el botón real manual/revisión/cancelación. Helpers de Campos, Ajustes y Detalles navegan controles reales; no fabrican un Generar automático ni sustituyen respuestas. |

Las aserciones exclusivamente ligadas al formulario retirado (Más opciones visible, selector Tipo oculto y expansión de ese formulario) se sustituyen por la presencia/estado de Ajustes y el acceso por Campos/tipos. Esto materializa el objetivo de eliminar duplicados; no elimina un cálculo ni una protección.

Hay cuatro diferencias de recorrido que necesitan una traducción explícita y conservan sus oráculos: Generar automático estable ya no existe; Número sobre una columna con símbolos perfilada no está disponible en el conversor; mes sobre una columna sin fechas válidas no aparece; el disparador global de filtros se sustituye por Añadir a Filtros, que precarga una condición pendiente. No se borrarán silenciosamente las pruebas de error, contador, cancelación o foco. Se documentará el disparador real elegido para cada una antes de calificarlas; no se modificará producto para simular el formulario anterior.

La carga única de chart-single-load prepara un tipo alternativo por la UI y espera su resultado antes de instalar el observador; elegir el tipo final real inicia la generación observada. Conserva la consulta exacta, filas, nulos y una sola sqlRun de esa generación. En Tendencia, activar el checkbox es el disparador automático: se conserva cero consultas de regresión antes de activarlo y exactamente una al terminar; el antiguo contador del botón se comprueba ahora en el alcance, sin cambiar el subconjunto. El anuncio de resultado se espera mediante su texto traducido.

Los filtros se abren mediante Añadir a Filtros con una condición pendiente: cancelar mantiene cero condiciones aplicadas y al reabrir la pendiente está vacía. ChartFields.closeMenu enfoca síncronamente Añadir/Mover antes de abrir el editor; se conserva el oráculo de retorno a ese mismo botón. Editar desde un chip vuelve al mismo chip, y Quitar filtros vuelve al buscador de Campos. La hipótesis estática inicial que atribuía el foco al menú temporal fue corregida antes de GUI y sin modificar producto.

La prueba de errores numéricos sobre Nota/porcentajes y la de fechas completamente inválidas usan una configuración persistida válida mediante el puente estricto y Aplicar en la UI, con nombres y comentarios de preset legado. Es compatibilidad y manejo de errores, no evidencia de que la UI actual construya esa configuración. La guarda sin Y se conserva en Suma deshabilitada de Resumir filas; Count/Distinct, edición de encabezado y Deshacer siguen usando controles reales. Los recorridos ordinarios de identificadores y fechas parcialmente válidas tienen aprobación y rojo real para conservar sus controles; las dos condiciones mínimas están integradas y tienen verde por fases: un lote aprobó siete de ocho identidades B+compatibilidad y el único oráculo nuevo de etiquetas se corrigió y pasó aparte. No se afirma un lote único de ocho aprobadas. No se sustituyen por un preset para ocultar su falta de acceso.

U0 conserva foco, teclado, tres anchos y viewport del plegable movido al final de Campos. Ahora se desplaza dentro de Campos para alcanzarlo y comprueba explícitamente el mínimo de 13 px ya prometido por su título histórico. Si Ajustes calcula 11 px, será un fallo de producto por calificar, no se rebajará el umbral. El lote no cambia fuentes ni los seis casos nuevos de B. Tipos de los consumidores y probe privados: 0 errores. El lote inicial de 119 consumidores aprobó 114 y falló cinco; cuatro correcciones pasaron aparte; TEN cerró después en el lote final de 18 junto con B, controles y el constructor temporal. Se archivaron 24 capturas antes y 24 después; el verde visual no sustituye la calificación completa.

Las pruebas nuevas llaman las APIs reales existentes. No importan funciones inexistentes ni introducen falsos resultados, cambios de plazos o retries. La prueba de título ignorado observa la salida de chartOption; la del esquema intenta guardar un título válido; la de datos comprueba description, escaping y CSV sin preámbulo. Los casos de compatibilidad/seguridad y SQL idéntico conservan cobertura aunque ya sean verdes antes del cambio.

Los logs y JSON de rojo/verde se guardan de forma privada en la evidencia de B. Raíz registra el checkpoint documental y rojo antes de fuente. Las fases puras usan unitarias y tipos; el rojo/verde local de los seis casos usa GUI y build de raíz. Las capturas y resultados se incorporan desde sus ejecuciones reales; el cierre enfocado final de 18 pasó. No se declara ejecución integral de consumidores ni CI. No se publica B ni se abre su PR antes de resolver la base e integración correspondientes.

No se elimina ningún caso existente ni se cambian sus datos esperados. La migración de selectores del formulario, una vez concretada la UI, documentará archivo/línea, motivo y sustitución, conservando cálculos, muestras, filtros, revisión, cancelación, exportación y bytes.

## Siete respuestas del ADR 0021

1. **¿Existe herramienta?** Sí: ChartOptions/ChartConfiguration, el esquema estricto de presets, chartOption, chartResult y sus serializadores ya resuelven datos, configuración y presentación. El cambio transporta el título opcional y reúne los controles existentes en Campos/Ajustes/Detalles.
2. **¿Existe habilidad reutilizable?** El flujo rojo→verde y el patrón de edición en fila de PRJ-01c cubren validación y foco. El alcance se limita al contrato, la UI y sus consumidores reales; no incorpora herramientas de desarrollo al producto.
3. **¿Hay CLI, API o MCP suficiente?** Las funciones y el puente tipado actuales bastan. El título viaja en options y se valida en chartConfiguration; no hay IPC, comando, detector o acceso nuevo del renderer.
4. **¿Madurez, seguridad, mantenimiento y licencia?** Código interno MIT, ECharts y zod instalados. Se conservan estrictez, validaciones de configuración/revisión, escritura atómica, bibliotecas futuras o dañadas, SVG como texto, escaping Markdown, protección de fórmulas y hash CSV. Las pruebas puras no acreditan PNG, GUI o paquete.
5. **¿Coste?** Un campo opcional, su presentación/exportación y la redistribución de controles existentes mediante un snippet Svelte. Sin versión nueva, migración, dependencia, preferencia, caché o motor paralelo.
6. **¿Pegamento mínimo?** Aceptar title recortado, resolver propio/automático, excluirlo de cálculo, reunir controles y medir la cabida de etiquetas con ECharts. Se conservan consultas, filas, serialización y handlers; no hay otro coordinador.
7. **¿Qué valor tiene código propio?** Nombrar y recuperar una salida conservando datos, seguridad y compatibilidad. Rehacer perfiles, SQL, presets o exportaciones no aporta valor.

## Resultados de las primeras fases

Rojo puro registrado sobre la fuente inicial: 5 fallos de comportamiento y 48 casos aprobados en los tres archivos (53 casos, 0.819 s de proceso). Los fallos demuestran título ignorado en presentación/descripción y rechazo de title válido por el esquema estricto; no son errores de importación o preparación. Los cuatro archivos de producto conservaron sus SHA antes/después. El checkpoint documental y rojo fue `c54966e792eb8976831f36a9113640aacc611013`.

Después del cambio puro pasan 53/53 casos (38 anteriores y 15 nuevos), tipos Node, renderer y consumidores. Se conserva también un primer intento de 52/53: la prueba nueva exigía `&lt;img` mientras el serializador existente emitía la codificación equivalente `&#x3C;img`. Se corrigió únicamente esa expectativa de representación, manteniendo título exacto, filas, CSV/hash y ausencia de etiquetas activas. La historia original y la rama congelada de A permanecen intactas. Raíz registró el rojo de UI (5 fallos funcionales y Caja ya aprobada) y, después, seis casos verdes sin reintentos sobre eb64dd43b22bc3fb4fd3caec7fd4f5d95105c874. Los consumidores anteriores siguen su calificación independiente; no se declara CI ni aceptación completa de B con esos seis casos.


## Estado documental actual · 2026-11-20

La [evidencia pública de B](../evidence/sim2b-graficos-claros-2026-11-20.md) conserva rojo→verde, controles aprobados, consumidores por fases y las 48 capturas originales con huellas/dimensiones. El antes corresponde a `4e3289f` y el después a `e7598ed`; el CSV sintético es el mismo. No contiene rutas del entorno privado ni reconstruye exportaciones no archivadas.

Las seis nuevas E2E pasaron y las ocho identidades B+controles se calificaron por unión de siete más una. Los 119 consumidores iniciales terminaron 114 aprobadas/5 fallos; cuatro correcciones enfocadas pasaron. Un intento intermedio TEN/temporal terminó 8 aprobadas/2 fallos y se conserva. El cierre actual sobre 00074b4 aprobó 18/18 en 113.132534 s PW / 113.431 s proceso: 6B + 2 controles + 9TEN + 1 constructor temporal, 0 reintentos/flaky/omitidas. No es una ejecución integral. El sondeo de cuatro fixtures aprobado no demuestra la causa histórica de AllX. Las precondiciones nuevas verifican ejes/SQL/tipo y una respuesta actual del documento correcto, sin cambiar fixtures, cálculos, plazos o reintentos.

El target posterior `00074b4764f03004246521a9d8de7887a37885e6` conserva el producto de `e7598ed64820116e1a348e592778891f879a9e6e` y añade la espera de preparación del helper. El cierre identificado registró check 0 errores/0 avisos, 9.08 s; unitarias 3034 aprobadas/2 omitidas (170 + 1 archivos), 17.36 s Vitest / 17.712 s proceso con Pandoc real 3.12.1; build 1.84 s. El log histórico sin SHA permanece separado y no se utilizó para atribuir este cierre. CI por SHA/plataforma, Intel, paquete, instalación y lectura externa siguen sin acreditarse aquí. La entrega prevista es un PR completo de implementación en borrador contra main, no otra entrega documental previa.
