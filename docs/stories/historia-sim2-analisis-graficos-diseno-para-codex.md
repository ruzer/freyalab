# SIM-2 — Análisis y gráficos más claros, para salir de alfa

Público (decisión del propietario, 2026-11-11): análisis de datos para prepa, universidad y maestría, sin complicar.
- **Qué hace:** ordena la pestaña «Análisis · <archivo>» y sus cuatro secciones (Información, Estadísticas, Gráficos y SQL), y deja un solo aviso por evento. No cambia qué se calcula ni sus valores, salvo lo que dice cada parte.
- **Relación con SIM-1:** SIM-1 cubre la tabla, el menú de columna, la barra de estado, que «Analizar» abra con Información (SIM-1c) y qué gráfico se sugiere (SIM-1d). SIM-2 cubre el resto del análisis.
- **Maqueta:** la vio el propietario (lámina «Análisis y gráficos» del lienzo), pero es privada. Esta historia es la referencia completa.

## Decisiones del propietario (2026-11-18)
1. **Estadísticas en español**, con el nombre de pandas en el título de cada fila. Los valores siguen siendo los de pandas.
2. **Título editable del gráfico:** sí.
3. **Barras de distribución en Información** (como Power Query): después de la beta. Quedan fuera de esta historia.

## Por qué
Medido en la app (PR #180, e2394b0) con una encuesta de 240 filas y 7 columnas, a 1440×900 y 1280×720:
- **Gráficos:**
  - Hay 27 controles a la vista y 19 más en «Más opciones». De esos, 8 repiten el panel de campos: tipo, eje X, eje Y, medida, resumen, color, filtros y «Generar gráfico».
  - La imagen (SVG, PNG, PDF) se exporta dentro de «Más opciones». Los datos se exportan en otro sitio, un «▶ Exportar resultados del análisis» en la cabecera.
  - Cada campo lleva una etiqueta de tipo y un botón «Añadir a…»: 14 piezas para 7 campos. El doble clic añade, pero no se ve.
  - Los 6 tipos de gráfico se ven igual aunque no encajen con los campos elegidos.
  - Las etiquetas del eje X van siempre giradas 25° (`chart-option.ts`), aunque quepan rectas.
  - Hacer «Promedio de Ingreso por Ciudad» y guardarlo en PNG cuesta unos 11 pasos desde la tabla.
- **Información:**
  - Hay 33 controles.
  - Tres líneas de estado van antes de la tabla, con «revisión 0».
  - Los nombres de columna van alineados a la derecha, hay triángulos ▶ dentro de las celdas y 7 botones «Explorar detalle» iguales.
  - Buscador y paginación aparecen aunque solo haya 7 columnas.
- **Estadísticas:**
  - Las filas usan los nombres de pandas en inglés: count, mean, std, 25%, 50% y 75%.
  - Cada columna lleva decimales distintos: 42.5, 6,266.4434 y 1.4172.
  - La tabla se estira a todo el ancho, con «Resumen calculado» y «Revisión 0» encima.
- **SQL:**
  - Dos párrafos de límites técnicos van antes del editor: DuckDB, MiB, celdas y extensiones.
  - «Ejecutar consulta» tiene un color que parece desactivado.
  - El primer mensaje dice «Consulta o fuentes actualizadas» sin que nada cambiara.
  - Los nombres de las columnas están escondidos. Hay 65 textos sin traducir.
- **La pestaña:**
  - Las secciones son 4 botones con borde y el nombre de la sección se repite como título.
  - «El archivo no se modifica» sale hasta 3 veces por pantalla.
  - Cada sección exporta en un sitio distinto.
- **Avisos:**
  - `notify()` (`App.svelte:162`) pone cada mensaje a la vez en un aviso flotante y en la barra de estado, siempre con el icono ✓.
  - Cuando una fuente protegida cambia fuera, salen 4 mensajes: la franja amarilla con 3 botones, la franja de protección, el aviso flotante con ✓ y la barra de estado. El aviso flotante dice «Al guardar se comprobarán los cambios», aunque el archivo no se puede guardar.

**Referencias:**
- **Google Sheets:** el editor de gráficos tiene un sitio para el tipo y los datos («Configuración») y otro para la apariencia («Personalizar»).
- **Tableau «Show Me»:** marca el tipo recomendado y pone en gris los que no encajan.
- **jamovi:** opciones a un lado y resultados que se actualizan al marcar.

## Partes

### SIM-2a · La pestaña de análisis: pestañas, cabecera y un solo «Exportar ▾»
- **Secciones como pestañas:**
  - Las cuatro secciones son `role="tablist"`, `tab` y `tabpanel`, con ← → Inicio y Fin, según el patrón de pestañas de WAI-ARIA APG.
  - Se ven como las pestañas de la barra lateral (Archivos · Índice · Proyecto): subrayado, sin borde de botón.
  - Una sección no disponible para archivos grandes conserva su motivo actual (`analysis.tab.large`).
- **Cabecera de una línea:**
  - El `h2` deja de repetir el nombre de la sección. Contiene la línea de origen actual (`analysis.tab.source` o `subset.analysis.source`) y sigue siendo el destino del foco que usa hoy (`heading`).
  - «El archivo no se modifica» solo aparece ahí. Se quita de `charts.fields.status` y de `charts.fields.unchanged`.
- **«Exportar ▾» en el mismo sitio en las cuatro secciones**, a la derecha de la cabecera y antes de «Ir al CSV». Reutiliza `ContextMenu.svelte` (PRJ-01c): lo no disponible sigue enfocable, con `aria-disabled` y su motivo actual (`controlHint`). Contenido:
  - **Información:** «Informe de columnas (Markdown)» (`info.report`).
  - **Estadísticas:** «Informe (Markdown)» (`describe.report`) y «Informe detallado» (`describe.detailedReport`).
  - **Gráficos:**
    - Imagen PNG · Imagen SVG · Imagen PDF (`exportChart`).
    - Separador.
    - Datos JSON · Datos CSV… · Datos Markdown (`exportResults`). «Datos CSV…» abre el panel de hoy con «Proteger fórmulas» (`charts.ui.protect`) y su ayuda.
  - **SQL:** «Informe (Markdown)», disponible cuando hay resultado.
- **Se quitan:** el desplegable «▶ Exportar resultados del análisis» de la cabecera y los botones sueltos «Abrir informe…» de cada sección.
- **Aceptación:**
  - Tab entra una vez en las pestañas y ← → Inicio Fin cambian de sección. Cada pestaña tiene `role="tab"`, `aria-selected` y `aria-controls` hacia su `tabpanel`.
  - En las cuatro secciones, «Exportar ▾» está en la misma posición (misma caja ±1 px a 1440×900) y cada elemento hace lo mismo que su botón de hoy.
  - «El archivo no se modifica» aparece una sola vez en cada sección.

### SIM-2b · Gráficos: un solo sitio para configurar y título editable
- **Se quita el formulario de «Más opciones»:** Datos incluidos, Gráfico, Agrupar fechas, Comparar categorías, Valores verticales, Usar valores como, Resumir por, Separar por color, Orden, Filtros del gráfico y Generar gráfico.
  - Lo que repite el panel de campos o los botones de tipo desaparece.
  - En modo manual (archivos grandes), el «Generar gráfico» que ya existe sobre el gráfico (`.manual`) se queda.
- **«Ajustes del gráfico»:** una sección plegable al final del panel de campos, cerrada al abrir. Recoge lo que no tiene otro sitio, con los mismos controles de hoy:
  - Datos incluidos (`scope`).
  - Orden (`descending`).
  - Agrupar fechas: solo con Barras o Líneas y una fecha en Filas.
  - Intervalos: solo con Histograma.
  - Zoom (Reducir · Ampliar · Ajustar).
  - Series visibles: la lista de casillas de hoy, que es la alternativa de teclado a la leyenda.
  - Configuraciones guardadas (`ChartPresets`).
  - «Tendencia» de Dispersión se queda donde está, junto a los tipos.
- **«Detalles del cálculo» (ⓘ):** recibe lo informativo que estaba en «Más opciones»: «Ver datos del gráfico» (la tabla), «Ver consulta», los filtros aplicados y la vista recuperada. Los textos no cambian.
- **Título editable (decisión 2):**
  - Un botón ✎ («Cambiar título») junto al título convierte el título en un campo, igual que el renombrado en fila de PRJ-01c: Intro guarda, Escape cancela y vacío vuelve al título automático, que se ve como texto de ejemplo del campo.
  - El título propio se guarda en `ChartOptions.title?: string`, recortado y de 1 a 120 caracteres.
  - El esquema estricto de `src/main/chart-presets.ts` lo acepta. Las configuraciones guardadas sin título siguen siendo válidas.
  - Se usa en pantalla, en el título de la imagen exportada (`chart-option.ts`, `title.text`, que hoy es `axes.summary`) y en los encabezados de las exportaciones de datos que ya llevan título.
  - Cambiar los campos no lo borra.
  - PRJ-04 (gráficos guardados) lo reutilizará.
- **Etiquetas del eje X:** rectas cuando caben; giradas 25° solo cuando no caben (hoy `rotate:25` fijo en 4 sitios de `chart-option.ts`).
- **Aceptación:**
  - Ningún ajuste aparece en dos sitios: una prueba recorre los controles visibles y los de «Ajustes del gráfico» y comprueba que no se repite ninguna etiqueta accesible.
  - Cada ajuste de hoy sigue alcanzable, en el panel de campos, en los tipos, en «Ajustes del gráfico» o en «Exportar ▾». Una prueba recorre la lista.
  - El título «Ingreso medio por ciudad, 2026» sale en pantalla, en el PNG (texto del SVG intermedio) y en una configuración guardada y vuelta a aplicar.
  - Con las 5 ciudades de la encuesta las etiquetas van a 0°; con 30 nombres de 25 caracteres van a 25°.
  - «Promedio de Ingreso por Ciudad» en PNG cuesta como mucho 7 pasos desde la tabla (con SIM-1d): Analizar, Gráficos, Ingreso, Ciudad, Exportar ▾, Imagen PNG y Guardar.

### SIM-2c · Campos más simples y tipos recomendados
- **Fila de campo:** icono de tipo, nombre y «⋯». Lo que hace cada acción:
  - **Clic, Intro o Espacio en un campo sin usar:** va a su zona recomendada (`recommendedZone`, lo mismo que hoy hace el doble clic). Se anuncia con el texto actual (`charts.fields.added`).
  - **Clic en un campo ya usado:** abre su menú (Mover a… · Quitar). No lo quita sin preguntar.
  - **«⋯» («Más acciones de {campo}»):** se ve al pasar el cursor, al enfocar la fila o si está seleccionada, como en PRJ-01c. Abre el menú de destinos de hoy («Añadir a Valores (recomendado)», etc.), con el comportamiento de `ContextMenu.svelte`. También se abre con Mayús + F10 y con la tecla de menú.
  - **Navegación:** la lista tiene un solo punto de tabulación, con tabindex itinerante y ↑ ↓ Inicio Fin.
- **Etiqueta de tipo:** se quita el texto (Categoría, Número…), porque los grupos ya lo dicen. Queda un icono pequeño con el tipo en su `title` y en el nombre accesible. El aviso de «número escrito como texto» (`charts.fields.amountBadge`) se queda, como icono de advertencia con su texto.
- **Zonas vacías:** se quita «Usa «Añadir a…»», que hoy aparece 4 veces. Encima de las zonas va una sola pista: «Haz clic en un campo para añadirlo». Una zona vacía dice «Vacía».
- **Tipos recomendados:**
  - El tipo de la sugerencia actual lleva «Recomendado» en su nombre visible y accesible.
  - Un tipo es «no disponible» cuando, tras aplicar lo que hoy hace `chooseKind`, no se puede construir la consulta: el mismo caso que hoy desactiva «Generar» con el motivo `parameters`.
  - Un tipo no disponible sigue enfocable, con `aria-disabled` y su motivo en el título y en `aria-describedby`. Por ejemplo, «Necesita dos campos numéricos» en Dispersión con Ciudad y Edad.
  - Activarlo no hace nada.
  - Cada tipo lleva su motivo como clave nueva.
- **Aceptación:**
  - Con la encuesta, la lista de 7 campos tiene un solo punto de tabulación y ninguna etiqueta de tipo con texto. Hoy son 7 botones «Añadir a…» y 7 etiquetas.
  - Clic en Ingreso y luego en Ciudad dibuja «Promedio de Ingreso por Ciudad» (con SIM-1d).
  - Para Ciudad + Edad, una prueba fija qué tipos están disponibles, cuál es el recomendado y el motivo exacto de cada no disponible.
  - El teclado llega a todo sin ratón: campos, menú de destinos, zonas, tipos y ajustes.

### SIM-2d · Información más clara
- **Una línea de resumen:**
  - Se queda la línea del archivo (`file-summary`: filas × columnas · tamaño · codificación · separador · encabezado) y las fichas de tipos.
  - El mensaje de estado (`info.complete`…) solo se ve mientras calcula, si falla o si el resultado es parcial.
  - La línea de alcance (`info.scopeSummary`, con la revisión) solo se ve si el alcance no es el archivo completo o si es parcial.
  - La revisión pasa a «Cómo interpretar esta vista».
- **Tabla:**
  - «Columna» y «Tipo probable» alineados a la izquierda; los números, a la derecha. Cada encabezado se alinea como su columna.
  - Los desplegables de las celdas (explicación del tipo, desglose de vacíos y detalle de distintos) se quedan con su contenido y sus acciones (Ver, Rellenar y Eliminar filas con vacío). Pierden el triángulo ▶ y llevan un chevron detrás del valor; su nombre accesible no cambia.
  - «Explorar detalle» pasa a un botón sin borde, «Explorar ›», con el mismo nombre accesible (`info.inspect`).
- **Buscador y páginas:** el buscador solo aparece con más de 20 columnas y la paginación, con más de 50 (el tamaño de página de hoy).
- **Informe Markdown:** pasa a «Exportar ▾» (SIM-2a).
- **Textos:** «Los datos cambiaron. Vuelve a explorar.» entra al catálogo. `CsvColumnsOverview.svelte` sale de `pending-files.json`.
- **Aceptación:**
  - Con la encuesta, tras calcular: ninguna línea de estado ni de alcance, ningún triángulo ▶, ningún botón con borde dentro de la tabla, y sin buscador ni paginación. Son 4 controles menos que hoy (buscador, dos de paginación e informe).
  - Los desplegables siguen dando las mismas cifras y acciones.
  - Con 60 columnas aparecen el buscador y la paginación; con 7, no.

### SIM-2e · Estadísticas legibles (decisión 1)
- **Nombres de las filas**, en es y en (en-XA se genera):

  | pandas | es | en |
  |---|---|---|
  | count | Número de valores | Count |
  | unique | Valores distintos | Distinct values |
  | top | Más frecuente | Most frequent |
  | freq | Veces del más frecuente | Frequency of most frequent |
  | mean | Media | Mean |
  | std | Desviación estándar | Standard deviation |
  | min | Mínimo | Minimum |
  | 25% | Percentil 25 | 25th percentile |
  | 50% | Mediana | Median |
  | 75% | Percentil 75 | 75th percentile |
  | max | Máximo | Maximum |

- **Título y nombre accesible de cada fila:** «Media · pandas: mean · <ayuda actual de `describe.help.*`>».
- **Informe Markdown:** usa «Media (mean)», para que se pueda comparar con pandas.
- **Valores:**
  - A la vista, los no enteros llevan hasta 2 decimales y los enteros, ninguno.
  - El valor completo sigue en el `title` de la celda (ya existe, `full(value)`), en el informe y al exportar, con la precisión de hoy.
  - Ningún valor cambia: solo cómo se muestra.
- **Tabla compacta:** ancho según el contenido, con la etiqueta junto a los valores. El título de la tabla dice solo el alcance; «Revisión N» pasa a «Cómo se calcula».
- **Estado:** «Resumen calculado.» solo se ve mientras calcula o si falla.
- **Textos:** los 30 textos sin catálogo de `CsvStatistics.svelte` entran al catálogo y el archivo sale de `pending-files.json`.
- **Aceptación:**
  - La encuesta muestra «Media 42.5», «Desviación estándar 14.43» y «Mediana 42.5». El `title` de la celda de la desviación estándar es `14.4321…` con la precisión de hoy.
  - Las pruebas que comparan valores con pandas (AN-2) siguen pasando sin cambiar sus valores esperados.

### SIM-2f · SQL sin muros de texto
- **Cabecera:**
  - El título «Análisis local con DuckDB» se quita; la pestaña ya dice SQL.
  - Debajo, una línea: «Solo lectura: tus consultas no cambian el archivo.»
  - Los dos párrafos de alcance y límites pasan sin cambios a ⓘ «Límites».
- **Columnas a la vista:**
  - Bajo la línea, las columnas de `datos` se ven como fichas. Con más de un archivo, se queda el desplegable «Archivos y nombres para SQL».
  - Clic en una ficha inserta el nombre entre comillas dobles en el cursor del editor. Si `Editor.svelte` no expone cómo insertar, se añade lo mínimo para hacerlo.
- **Ejecutar:**
  - «Ejecutar consulta» pasa a botón principal (`btn-primary`).
  - El atajo se escribe según el sistema: «⌘ Intro» en macOS y «Ctrl Intro» en Windows y Linux, como en SIM-1b.
- **Estado:**
  - Sin mensaje inicial.
  - El área de resultados vacía dice «Escribe una consulta y pulsa Ejecutar. Los resultados aparecen aquí.».
  - «Consulta o fuentes actualizadas» solo aparece si algo cambió después de una ejecución.
- **Línea del resultado:** se queda en «240 filas de resultado». La versión de DuckDB y la revisión pasan a ⓘ.
- **Textos:** los 65 textos sin catálogo de `CsvSql.svelte` entran al catálogo y el archivo sale de `pending-files.json`.
- **Aceptación:**
  - Al abrir SQL, entre el editor y las pestañas hay como mucho una línea de texto y las fichas.
  - Clic en «Ingreso» inserta `"Ingreso"` en el cursor.
  - En en-XA no queda texto en español en la sección.

### SIM-2g · Un aviso por evento
- **Avisos con tipo:**
  - `notify(message, kind)` admite `success`, `info`, `warning` y `error`.
  - El icono va según el tipo: ✓ (`circle-check`) para éxito, `info` para información y `triangle-alert` para advertencia y error.
  - El icono `info` se copia de Lucide, como se hizo con `lock` en PRJ-01c.
  - Todas las llamadas a `notify` de `App.svelte` reciben su tipo.
- **La barra de estado ya no copia los avisos:** `notify` deja de escribir en `status` y la barra muestra solo estado.
- **Cambio externo (`event.type==='external'`):**
  - Si el documento que cambió tiene su franja a la vista, no hay aviso flotante: la franja es el mensaje.
  - Si no se ve (por ejemplo, con la pestaña de análisis delante), sale un aviso `warning`: «encuesta.csv cambió fuera de FreyaLab.».
  - Ya no se promete «Al guardar se comprobarán los cambios», que no vale para una fuente protegida.
  - Esos textos entran al catálogo.
- **Aceptación:**
  - Con la fuente protegida abierta en Tabla, modificarla en disco deja exactamente una franja de cambio externo (más la de protección que ya estaba), sin aviso flotante y con la barra de estado igual que antes.
  - Con la pestaña de análisis delante sale un solo aviso, con el icono de advertencia.
  - «Guardado» y el resto de los avisos de éxito siguen con ✓.

## Reglas comunes a las siete partes
- **Sin dependencias nuevas** (ADR 0021): se reutilizan `ContextMenu.svelte`, `controlHint`, los iconos copiados de Lucide y los textos que ya existen.
- **Textos:**
  - Todo texto nuevo o cambiado va en es, en y en-XA.
  - Las claves que dejen de usarse se quitan.
  - Un archivo que quede sin textos fuera del catálogo sale de `pending-files.json`.
- **Prueba en rojo primero.**
- **Pruebas que cambian (decisión del propietario, 2026-11-18: no se prueba lo que ya no existe):**
  - Si una prueba comprueba un comportamiento que sigue, se actualiza: mismo comportamiento y mismos datos, con el selector nuevo.
  - Si una prueba solo comprueba algo que esta historia quita (por ejemplo, el formulario de «Más opciones» o la línea «revisión 0»), se borra.
  - El PR lista las pruebas borradas, cada una con su motivo y con la prueba que ahora cubre ese comportamiento, si la hay.
- **Accesibilidad:** se conservan el teclado, los nombres accesibles, los motivos de lo desactivado y la tabla como alternativa al gráfico.
- **Capturas** en claro y oscuro, en es y en en-XA, a 1440×900 y 1280×720, de lo que cambia en cada parte.
- **Copia** esta historia a `docs/stories/` en el primer PR (SIM-2a).

## Orden y dependencias
- SIM-2 empieza cuando SIM-1 esté en `main`.
- SIM-2e (Estadísticas) y SIM-2f (SQL) no tocan archivos de SIM-1 y pueden adelantarse si conviene.
- Orden: SIM-2a → SIM-2b → SIM-2c → SIM-2d → SIM-2e → SIM-2f → SIM-2g. Un PR en borrador por parte, con base `main`.

## Fuera de alcance
- Las barras de distribución en Información (decisión 3).
- Traducir el resto de los archivos pendientes (`App.svelte`, `CsvTable.svelte`, `CsvColumnAnalysis.svelte` y otros): irá en una historia de textos aparte.
- Que el «Exportar ▾» de la barra superior funcione en la pestaña de análisis.
- Cambiar cálculos, límites o confirmaciones.
- Los gráficos guardados en el proyecto (PRJ-04).

## Para salir de alfa (no es trabajo de Codex)
Cuando SIM-1 y SIM-2 estén en `main`, el propietario hará una prueba con 5 estudiantes que no conozcan la app, sin ayuda:
1. Abrir encuesta.csv y decir cuántos vacíos tiene Ingreso.
2. Rellenar esos vacíos con 0 y guardar una copia.
3. Hacer «Promedio de Ingreso por Ciudad» y guardarlo como PNG.
4. Decir la media y la mediana de Edad.
5. Crear un proyecto con el CSV y guardar el conjunto «Adultos».

Una tarea que falla en 2 de 5 personas bloquea la beta.

## Entrega
Cada PR informa:
- SHA.
- Pruebas rojas y verdes.
- Pruebas borradas, con su motivo.
- Capturas.
- La CI de las tres plataformas.
