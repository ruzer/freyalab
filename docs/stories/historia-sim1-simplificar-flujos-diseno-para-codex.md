# SIM-1 — Flujos más cortos y menús que se entienden

Público (decisión del propietario, 2026-11-11): análisis de datos para prepa, universidad y maestría, sin complicar.
- **Recorrido medido** por Claude el 2026-11-17 en la app real (main d17cc81), con una encuesta de 240 filas, a 1440×900.
- **Entrega:** siete partes independientes, cada una en su propio PR pequeño, en el orden de abajo. No dependen de PRJ-01c ni de PRJ-03.
- **No cambia** lo que hace cada acción: solo dónde está, cómo se llama y cuántos pasos cuesta.

## Decisiones
- **Del propietario (2026-11-17): pulsar «Analizar» cuenta como la petición.** La pestaña de análisis se abre con Información ya calculada.
  - Matiza la decisión del 2026-11-10: abrir el CSV sigue sin calcular nada.
  - Gráficos, Estadísticas y SQL siguen esperando a que se pidan.
- **Propuesta de esta historia, que se aplica salvo que el propietario diga otra cosa (SIM-1d):** una sugerencia de gráfico con un número por categoría usa «Promedio», no «Suma».
  - En encuestas y trabajos académicos, sumar edades, escalas o calificaciones no tiene sentido. Cambiar a «Suma» sigue estando a un clic.

## Hallazgos (lo que hay hoy)
1. **Dos menús de columna distintos según dónde se pulse** (`CsvTable.svelte`, `structuralContext`):
   - **Clic derecho en el encabezado:** una lista plana de 20 opciones, con el título «0 FILAS · 1 COLUMNAS».
   - **Botón ▾ «Acciones de la columna X»:** las mismas opciones en 4 grupos con título (Vista de la tabla, Limpiar la columna, Estructura y Más), 25 líneas en total, que piden desplazamiento a 900 px.
   - En los dos, el texto está centrado.
   - «Más» trae «Transformar documento…», «Copiar como Markdown», «Deshacer edición CSV» y «Rehacer edición CSV», que no son de la columna o ya están en la barra.
2. **La barra de la tabla tiene dos menús solo con icono:** una llave («Limpiar datos») y una tabla («Filas y columnas»).
   - «Limpiar datos» tiene 4 opciones (Transformar documento…, Quitar espacios, Mayúsculas y Minúsculas), pero **no** rellenar vacíos, eliminar filas con vacío ni quitar duplicados, que solo están en el menú de columna.
   - «Ir a la fila» usa una flecha ↓. «Buscar acción» muestra «⌘» también en Windows y Linux.
3. **Pestaña de análisis:** al pulsar «Analizar» abre Información vacía, con «Datos o alcance actualizados. Pulsa Obtener información.» aunque nada cambió, y con «Abrir informe de columnas Markdown» desactivado.
   - Con 6 columnas muestra igualmente «Columnas anteriores» y «Columnas siguientes».
   - Ver los tipos y los vacíos cuesta 2 clics.
4. **Gráficos, sin campos elegidos,** sugiere «Crear: Suma de Edad por Ciudad». La sugerencia numérica usa `aggregate:'sum'` en `src/shared/chart-suggest.ts:44`.
5. **Proyecto con el CSV abierto:** crear el proyecto y luego «Añadir fuente…» obliga a volver a elegir el mismo archivo, en unos 7 pasos.
   - «Crear proyecto» solo está al pie de la barra lateral: no aparece en Inicio ni en «Nuevo ▾».
6. **Barra de estado:** Codificación, Separador y Encabezado están siempre visibles como controles. «Guardado» aparece dos veces, en el botón de arriba y en la barra de estado.
7. **Menús con el texto centrado:** «Nuevo ▾» y los menús de columna.

## Partes

### SIM-1g · Menús alineados a la izquierda (primero, la más pequeña)
- **Qué:** todo `role="menu"` de la app (la clase `range-context`, los desplegables de la barra y «Nuevo ▾») alinea el texto de sus elementos a la izquierda. Los títulos de grupo, también.
  - Los botones de la app son `inline-flex` y centrados (`style.css`, regla `button`), así que `text-align:left` no basta: hace falta `justify-content:flex-start`.
  - Si PRJ-01c ya está en `main`, `ContextMenu.svelte` ya lo hace para el menú de «Proyecto» y el de «Archivos». Se reutiliza esa regla y no se duplica.
- **Aceptación:**
  - Una prueba E2E abre «Nuevo ▾» y un menú de columna. Con un `Range` sobre el texto de cada `menuitem`, comprueba que el texto empieza a no más de 12 px del borde izquierdo del elemento. No basta con leer `text-align`.
  - Capturas antes y después.

### SIM-1a · Un solo menú de columna, más corto
- **Qué:** el clic derecho en el encabezado, el botón ▾, Mayús + F10 y la tecla de menú abren **el mismo** menú.
- **Estructura del menú**, con separadores y sin títulos de grupo salvo el del submenú:
  - Título: el nombre de la columna («Ingreso»). Sin recuento de filas.
  - «Ordenar de menor a mayor» · «Ordenar de mayor a menor» · «Filtrar esta columna» · «Ver filas vacías».
  - «Limpiar ▸», un submenú con:
    - «Rellenar vacíos…».
    - «Eliminar filas con vacío…».
    - «Quitar filas duplicadas…».
    - «Quitar espacios…».
    - «Mayúsculas…».
    - «Minúsculas…».
  - «Estadísticas de la columna».
  - «Insertar a la izquierda» · «Insertar a la derecha» · «Duplicar columna» · «Calcular columna a la derecha».
  - «Eliminar columna», en el color de peligro y al final.
- **Fuera del menú de columna:**
  - «Transformar documento…»: está en «Limpiar ▾» de la barra (SIM-1b).
  - «Copiar como Markdown»: se queda en «Filas y columnas ▾».
  - «Deshacer» y «Rehacer»: están en la barra superior y en ⌘Z.
- **Submenú:** patrón de menú de WAI-ARIA. → o Intro lo abre, ← o Escape lo cierra, el foco vuelve a «Limpiar ▸» y se abre a la derecha o a la izquierda según el espacio.
- **Lo desactivado:** se queda con su motivo actual (`disabledReason`, `controlHint`).
- **Aceptación:**
  - Las cuatro formas de abrir dan la misma lista de elementos, comparada en la prueba.
  - El menú cabe sin desplazarse a 1280×720.
  - Cada una de las 20 acciones de hoy sigue alcanzable, en este menú o en el sitio indicado. Una prueba recorre la lista.
  - Las E2E que usan el menú de columna se actualizan según la regla de pruebas de abajo.

### SIM-1b · Barra de la tabla con texto
- **Qué:**
  - Los dos menús solo con icono pasan a tener texto visible: «Limpiar ▾» y «Filas y columnas ▾». El icono se queda delante.
  - «Limpiar ▾» reúne todas las limpiezas.
    - Primero, las seis del submenú de SIM-1a, que actúan sobre **la columna de la celda activa** y lo dicen en el texto: «Rellenar vacíos de Ingreso…». Sin celda activa, se desactivan con el motivo «Elige una celda de la columna que quieres limpiar.»
    - Separador y las de hoy («Quitar espacios al inicio y final», «Convertir a mayúsculas», «Convertir a minúsculas»), con el mismo alcance que ya tienen.
    - Al final, «Transformar documento…».
  - «Ir a la fila» usa un icono de almohadilla («#») en lugar de la flecha. Conserva su `aria-label` y su atajo.
  - «Buscar acción» muestra el atajo de la plataforma: «⌘K» en macOS y «Ctrl K» en Windows y Linux, tanto en el botón como en su título.
- **Ancho:** a 1280 px la barra cabe en una fila; si no cabe, los textos de «Filtrar», «Limpiar» y «Filas y columnas» se ocultan en ese orden y se quedan en el `aria-label`.
- **Aceptación:**
  - Con la celda activa en Ingreso, «Limpiar ▾» → «Rellenar vacíos de Ingreso…» abre el mismo diálogo que el menú de columna.
  - En Windows el botón dice «Ctrl K».
  - Capturas a 1280 y 1440 px.

### SIM-1f · Barra de estado compacta
- **Qué:**
  - Los tres controles de formato del CSV (Codificación, Separador y Encabezado) se sustituyen por un solo botón con su resumen: «UTF-8 · Coma · Con encabezado».
  - El botón abre un panel pequeño, «Formato del archivo», con los mismos tres controles, que hacen lo mismo que hoy. Hoy no hay diálogo de confirmación: el cambio se aplica al momento porque solo vuelve a leer el archivo sin modificarlo, y se rechaza con el mismo mensaje si hay cambios sin guardar, si el archivo no tiene ruta, si cambió en disco o si es una fuente protegida del proyecto. No se añade ninguna confirmación (corrección del 2026-11-18).
  - Se quita de la barra de estado el «Guardado» repetido; se queda el de la barra superior.
- **Aceptación:**
  - Cambiar el separador desde el panel reinterpreta igual que hoy: la prueba actual pasa por el panel.
  - Con cambios sin guardar, cambiar el separador desde el panel muestra el mismo mensaje de hoy y el resumen no cambia.
  - El resumen se actualiza.
  - En la barra de estado no aparece «Guardado».

### SIM-1c · «Analizar» abre con Información calculada
- **Qué:** abrir la pestaña de análisis con «Analizar» (barra, paleta, menú o «Analizar» de una fuente en Proyecto) lanza una vez el mismo cálculo que «Obtener información».
  - Muestra su progreso y «Cancelar», como hoy.
  - Si la pestaña ya estaba abierta y sus datos no cambiaron, no recalcula.
  - El botón se queda para recalcular y pasa a llamarse «Actualizar información» cuando ya hay un resultado.
- **Además:**
  - Quita el mensaje «Datos o alcance actualizados…» del primer cálculo; ese aviso solo aparece si los datos o el alcance cambian después.
  - «Abrir informe de columnas Markdown» no aparece hasta que hay resultado.
  - La paginación no aparece si todas las columnas caben en una página.
- **Límites:** si la fuente supera los límites del análisis, no se calcula y se muestra el motivo actual.
  - Gráficos, Estadísticas y SQL **no** se calculan al abrir: siguen como hoy.
  - Abrir el CSV no calcula nada.
- **Aceptación:**
  - Un clic en «Analizar» con la encuesta muestra la tabla de Información (6 columnas, tipos, vacíos y distintos) sin otro clic.
  - Volver a la pestaña no recalcula.
  - Al editar una celda aparece el aviso de datos cambiados y «Actualizar información».

### SIM-1d · Sugerencias de gráfico con sentido
- **Qué** (`src/shared/chart-suggest.ts` y su uso en `CsvCharts.svelte`):
  - **Sin campos elegidos:** si hay una columna categórica, la sugerencia es el conteo por esa categoría: «Crear: Número de filas por Ciudad». No se sugiere ningún número.
  - **Número por categoría:** la sugerencia usa «Promedio» (`aggregate:'average'`, decisión propuesta). «Suma» se sigue eligiendo, como hoy, en el selector de cálculo del campo en «Valores».
  - **Nunca se sugiere** un cálculo sobre una columna de tipo identificador.
- **Aceptación:**
  - Con la encuesta, sin campos, la sugerencia es «Número de filas por Ciudad».
  - Con Ciudad en Filas e Ingreso en Valores, la sugerencia es «Promedio de Ingreso por Ciudad» y el gráfico coincide con un oráculo calculado en la prueba.
  - Las pruebas unitarias de `chart-suggest` se actualizan con los nuevos casos, sin quitar los actuales.

### SIM-1e · Proyecto desde el CSV abierto
- **Qué:**
  - Si al pulsar «Crear proyecto» la pestaña activa es un CSV o TSV guardado en disco y sin cambios, el diálogo «Nuevo proyecto» muestra la casilla, marcada, «Añadir «encuesta.csv» como primera fuente».
    - Al crear, se abre el diálogo de fuente de PRJ-01 con ese archivo ya elegido (columnas detectadas y «Añadir y calcular huella»), sin volver a pedir el archivo.
    - Si el archivo queda fuera de la carpeta del proyecto, se registra como externo, con el aviso que ya existe.
  - «Nuevo proyecto…» aparece también como cuarta tarjeta en Inicio y como elemento de «Nuevo ▾».
- **Aceptación:**
  - Con la encuesta abierta: «Crear proyecto» → carpeta → nombre → «Crear proyecto» → «Añadir y calcular huella» deja la fuente registrada, en 5 pasos frente a unos 7 de hoy.
  - Con la casilla desmarcada no se añade nada.
  - Con cambios sin guardar, la casilla no aparece.
  - Desde Inicio y desde «Nuevo ▾» se abre el mismo diálogo.

## Reglas comunes a las siete partes
- **Sin dependencias nuevas** (ADR 0021): se reutilizan los menús, diálogos, `controlHint` y textos que ya existen.
- **Textos** en es, en y en-XA. Las claves que dejen de usarse se quitan.
- **Prueba en rojo primero.**
- **Pruebas que cambian (decisión del propietario, 2026-11-18: no se prueba lo que ya no existe):**
  - Si una prueba comprueba un comportamiento que sigue, se actualiza: mismo comportamiento y mismos datos, con el selector nuevo.
  - Si una prueba solo comprueba algo que esta historia quita (por ejemplo, «Transformar documento…» dentro del menú de columna o el primer mensaje engañoso de «Analizar»), se borra. No se mantiene viva para conservar el número de pruebas.
  - En el PR se listan las pruebas borradas, cada una con su motivo y con la prueba que cubre ahora ese comportamiento, si lo hay.
- **Capturas** en claro y oscuro, en es y en en-XA, a 1440×900 y 1280×720, de lo que cambia en cada parte.
- **Copia** esta historia a `docs/stories/` en el primer PR (SIM-1g).

## Fuera de alcance
- La pestaña «Proyecto» (PRJ-01c) y la exportación (PRJ-03).
- Cambiar qué hace cualquier acción, sus confirmaciones o sus límites.
- Calcular Gráficos, Estadísticas o SQL al abrir el análisis.
- «Orden numérico» y «Copiar como Markdown» se quedan donde están; no se tocan en esta historia.

## Por confirmar (no es parte de esta historia)
En la prueba automática, el diálogo «Nuevo proyecto» apareció en la esquina superior izquierda en lugar de centrado. Puede ser un efecto de cambiar el tamaño de ventana con Playwright. El propietario lo comprobará en la app instalada; si se reproduce, se abrirá una tarea aparte.

## Entrega
Siete PR en borrador, con base `main`, en este orden: SIM-1g → SIM-1a → SIM-1b → SIM-1f → SIM-1c → SIM-1d → SIM-1e. Cada uno informa SHA, pruebas rojas y verdes, capturas y la CI de las tres plataformas.
