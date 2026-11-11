# AN-1 — Pestaña «Análisis» aparte y a petición

Decisión del propietario (2026-11-10): el CSV se abre para ver y editar. Gráficos, estadísticas y SQL se abren solo cuando se piden, en una pestaña aparte ligada a ese CSV. AN-2 (presentación al estilo `info()` y `describe()`) va después y se apoya en esta.

## Historia
Como persona que trabaja con un CSV, quiero que el archivo se abra solo con la tabla y el texto, y abrir el análisis cuando lo necesite, en su propia pestaña ligada a ese CSV. Así edito sin distracciones ni cálculos que no pedí, y cierro el análisis cuando acabo.

## Evidencia (main 3a2404a, app real, `inventario.csv` de 240 filas)
- La pestaña del CSV tiene tres vistas: Tabla | Resumen y gráfico | Texto. «Resumen y gráfico» es el constructor de tablas dinámicas y gráficos (`CsvCharts.svelte`). En archivos pequeños (editables, ≤1 MiB, ≤3.000 filas, ≤200.000 celdas) dibuja un gráfico sugerido al entrar («Sugerido: compara la suma de Precio por Articulo»). El propietario lo percibe como algo autogenerado que no pidió.
- Las estadísticas (`CsvStatistics.svelte`), «Comprender todas las columnas» (`CsvColumnsOverview.svelte`), «Explorar una columna» (`CsvColumnAnalysis.svelte`) y SQL (`CsvSql.svelte`) viven en un panel lateral de Tabla (`AnalysisDock.svelte`, botón «Estadísticas y SQL»). Esos sí esperan a que se pulse su botón, pero están escondidos.
- El código de gráficos se carga al primer uso (`import('./CsvCharts.svelte')`). Después sigue montado y oculto (`summaryVisited` no vuelve a `false`), con ECharts vivo, mientras se edita la tabla.
- Las pestañas superiores (`App.svelte`, `.tabs`) solo representan documentos (`documents`). No hay pestañas que no sean archivos.
- Los paneles dependen del estado de la tabla: `query()` (búsqueda, filtros, orden), columnas marcadas, rango de celdas y `viewMeta`, hoy locales en `CsvTable.svelte`.
- 28 referencias en `tests/e2e` a «Resumen y gráfico» o «Estadísticas y SQL».

## Diseño UX
**Pestaña del CSV.** El selector de vista queda en **Tabla | Texto**. El botón de la derecha que abría el panel lateral pasa a ser **«Analizar»** (icono de gráfico y texto). No hay panel lateral de análisis.

**Abrir el análisis.**
- Formas de abrirlo: el botón «Analizar», el comando «Analizar…» de la paleta y los comandos que ya existen.
- Destino de cada comando:

  | Comando | Abre |
  |---|---|
  | «Estadísticas y exploración» | Estadísticas |
  | «Gráficos» | Gráficos |
  | «Análisis SQL y asistentes» | SQL |
  | «Estadísticas de la columna» | Estadísticas con esa columna marcada |
  | Acciones de rango | Estadísticas con «Celdas del rango» |

- Términos de búsqueda en la paleta: análisis, estadísticas, gráficos, sql, resumen, describe, info.
- Se abre la pestaña **«Análisis · inventario.csv»** justo a la derecha de su CSV, con el foco puesto en ella.
- Hay una sola por CSV. Si ya existe, se activa en la sección pedida.

**Dentro de la pestaña.**
- **Cabecera:** una línea fija, «Datos de inventario.csv · 240 filas · El archivo no se modifica», con el botón «Ir al CSV».
- **Secciones:** un selector con **Información | Estadísticas | Gráficos | SQL**:
  - Información: hoy «Comprender todas las columnas».
  - Estadísticas: hoy «Estadísticas por columna», con «Explorar una columna».
  - Gráficos: hoy el constructor.
  - SQL: hoy el panel SQL.
- **Contenido:** en AN-1 cada sección muestra el componente que ya existe, a ancho completo, sin rediseñarlo. AN-2 rediseña Información y Estadísticas.
- **Nada calcula al abrir.** Información, Estadísticas y SQL esperan a que se pulse su botón, como hoy.
- **Gráficos al entrar:**
  - Prepara la lista de campos (el perfilado de tipos actual, con progreso y cancelación) porque entrar ya es pedir gráficos.
  - **No dibuja nada.** La sugerencia aparece como botón: «Crear: suma de Precio por Articulo».
  - El primer gráfico sale al pulsar la sugerencia o al colocar un campo. Desde ahí, en archivos pequeños, se actualiza solo mientras se ajustan los campos, como hoy.
- **Alcance:** los selectores de cada componente («Documento completo», «Vista filtrada», «Columnas marcadas», «Celdas del rango») siguen igual. Leen el estado **actual** de la tabla del CSV: búsqueda, filtros, orden, marcas y rango.

**Ligada al CSV.**
- **Cambios en el CSV:** una edición, un guardado que cambia la revisión, reinterpretar o un cambio externo hacen que cada sección con resultados muestre su aviso actual («Los datos cambiaron…»). Ningún resultado viejo se queda sin aviso.
- **Renombrar o Guardar como:** cambia el nombre de la pestaña.
- **Cerrar el CSV:** primero va su confirmación de siempre. Si se cierra, su análisis se cierra con él; si se cancela, quedan los dos.
- **Cerrar el análisis (× o Cmd/Ctrl+W):** no pide confirmación porque no guarda nada. Cancela los trabajos en curso y libera los componentes.
- **Al reiniciar** las pestañas de análisis no se restauran. La biblioteca de configuraciones de gráficos sigue igual.

**Barra superior con el análisis activo.**
- **Título:** «Análisis · inventario.csv».
- **Guardar, Deshacer, Rehacer y Exportar documento:** desactivados, con el motivo «Vuelve al CSV para editar, guardar o exportar». Cmd/Ctrl+S no hace nada ahí.
- **«Exportar resultados del análisis»:** pasa a la cabecera de la pestaña de análisis.

**Archivos grandes.** Información y Estadísticas aparecen desactivadas, con el motivo de hoy («Las estadísticas llegan en una fase posterior»). Gráficos (manual) y SQL funcionan como hoy.

**Accesibilidad.**
- La pestaña forma parte de la misma lista de pestañas y se recorre con las flechas. Su nombre accesible es «Análisis de inventario.csv».
- El selector de secciones es un grupo de botones con `aria-pressed`, como el selector de vista.
- Al abrir, el foco va al encabezado de la sección. Escape no cierra la pestaña.
- Textos en es, en y en-XA.

## Contrato técnico
- **Pestañas:** un modelo que admita documentos y análisis, por ejemplo `{type:'document',id}` y `{type:'analysis',source,section}`. No conviertas el análisis en un `DocumentInfo`, porque no es un archivo. La sesión guarda solo pestañas de documento.
- **El origen es abstracto.** En AN-1, `source` es siempre `{documentId}`, el CSV abierto, y por eso se cierra con él. PRJ-04 añadirá orígenes `{sourceId}` y `{recipeId}` del proyecto, para trabajar los gráficos sin abrir el CSV (decisión del propietario, 2026-11-10). No ates la pestaña ni sus componentes a que exista una pestaña de documento más allá de ese caso: el cierre en cascada depende del tipo de origen.
- **Estado de la tabla:** sube la vista (query, marcas, rango, viewMeta) a un almacén por `doc.id` en `src/renderer/lib`, que `CsvTable` escribe y la pestaña de análisis lee. Una sola fuente de verdad.
- **Componentes:** reutiliza `CsvStatistics`, `CsvColumnsOverview`, `CsvColumnAnalysis`, `CsvCharts` y `CsvSql` con sus props actuales. **Sin dependencias nuevas, sin motor nuevo.**
- **Gráficos:** el cambio es pequeño. Al entrar, la regeneración automática espera a que el usuario haga algo: pulsar la sugerencia o colocar un campo. Los límites de archivo pequeño no cambian.
- **Disposición:** quita `AnalysisDock`, los comandos «Ampliar panel» y «Acoplar panel» y el ancho guardado. `parseLayout` debe aceptar sin error un `workspace` guardado con los valores antiguos.

## Entrega en 2 PR (borrador, base `main`, pruebas rojas primero)
1. **AN-1a (solo añade):** tipo de pestaña, almacén de vista, botón y comandos «Analizar», secciones con los componentes actuales, gráficos sin dibujo al entrar, cierre ligado. El panel lateral y «Resumen y gráfico» siguen existiendo.
2. **AN-1b (quita):** elimina «Resumen y gráfico» y el panel lateral y redirige los comandos. Las pruebas se borran **en este mismo PR**, junto con el código que probaban, nunca antes ni con `test.skip`. Reparto, contado sobre main 3a2404a:

   | Qué hacer | Pruebas | Motivo |
   |---|---|---|
   | **Borrar** | `dock-expanded.spec.ts` (7), `dock-startup.spec.ts` (4), `dock-resize.spec.ts` (5) y `tests/workspace-layout.test.ts` (16 unitarias), junto con `workspace-layout.ts` si queda sin uso | Prueban el panel lateral en sí: ampliar, acoplar, divisor, ancho guardado y arranque según la ventana. Con la pestaña ya no existe nada de eso |
   | **Borrar** | En `analysis-dock.spec.ts`: «la tabla conserva las filas que tenía sin panel» (:41), «a 1366×768… tres columnas» (:53) y «el gráfico… no se desplaza en horizontal» (:93) | Hablan de compartir el ancho con la tabla |
   | **Reescribir para la pestaña** | El resto de `analysis-dock.spec.ts`: secciones accesibles por teclado (:61), cambiar de sección conserva el gráfico y el borrador SQL (:73), cerrar desmonta y devuelve el foco (:83). En `compact-toolbar.spec.ts`: «Analizar abre el panel…» (:76) | El comportamiento sigue existiendo en la pestaña. Coincide con los criterios 2, 7 y 11 de AN-1 |
   | **No tocar la prueba, solo el ayudante** | `charts`, `csv-summary`, `chart-fields`, `sql`, `ui`, `ui-u0`, `structure`, `statistics-reports`, `selection-statistics`, `search`, `descriptive-percentiles`, `commands`, `columns-overview`, `large-file`, `chart-review` | Prueban resultados (sumas, percentiles, SQL, exportaciones) que siguen igual. Casi todas entran por `showPanel` y `analyzeButton` de `tests/e2e/panel.ts`: cambia ese ayudante para que abra la pestaña «Análisis» en la sección pedida. Si una prueba solo comprueba la navegación antigua, pasa a la fila de reescribir. En `csv-summary`, `chart-fields`, `ui-u0`, `large-file` y `chart-review` se adaptan la navegación directa y las comprobaciones que solo existen en la interfaz retirada, con las condiciones de la nota de abajo |
   | **Añadir** | Una prueba: un perfil con el `workspace` del panel guardado por una versión anterior arranca sin errores y lo ignora | Sustituye a la de «valor guardado corrupto» de `dock-resize.spec.ts` |

   **Condiciones para adaptar pruebas de datos** (autorizado por el propietario):
   - La navegación pasa por un ayudante común en `tests/e2e/panel.ts` (por ejemplo, `openAnalysis(page, section)`), sin selectores sueltos por archivo.
   - Una comprobación de la interfaz retirada se **sustituye** por su equivalente en la pestaña cuando la conducta sigue existiendo: nombres en en y en-XA, capturas y disposición a 1280×720 y 1440×900, foco, conservar la configuración al volver.
   - Solo se **borra** si la conducta desaparece a propósito: `aria-pressed` de «Resumen y gráfico» o el botón por posición (`ui-u0.spec.ts:205`).
   - El gráfico que salía solo al entrar se sustituye por: comprobar que no se dibuja nada, pulsar la sugerencia «Crear» y mantener intactas todas las aserciones del resultado.
   - Las aserciones de datos, guardado, seguridad y límites no cambian. En su diff solo pueden cambiar las líneas de navegación.
   - El PR lista cada comprobación cambiada o borrada con `archivo:línea`, antes y después, y su motivo.

   Quita también las entradas de los archivos borrados en el mapa de áreas de CI (`tests/ci-areas.test.ts` y su configuración). En la CI de macOS ARM, los archivos borrados suman unos 2 minutos de E2E por corrida (corrida 42772526410). En el PR: la lista de pruebas borradas con su motivo y el recuento antes y después.

## Aceptación
1. Abrir el CSV, desplazarse, editar y guardar no llama a `analyzeColumn`, `stats` ni `sqlRun`. Compruébalo con un espía de IPC, como el de H15-2.
2. «Analizar» abre «Análisis · X» a la derecha del CSV, con el foco dentro. Pulsarlo otra vez activa la misma pestaña, sin crear otra.
3. Las secciones Información, Estadísticas y SQL no calculan hasta pulsar su botón.
4. Al entrar en Gráficos se prepara la lista de campos y no se dibuja nada; el espía no ve consultas de gráfico. El botón de la sugerencia dibuja el gráfico. Después, cambiar un campo lo actualiza solo en un archivo pequeño, y en uno grande hace falta «Generar gráfico».
5. Editar una celda en el CSV hace que la sección con resultados muestre el aviso de datos cambiados. Al actualizar, sale el valor nuevo.
6. Filtrar en el CSV y elegir «Vista filtrada» en Estadísticas da los mismos números que hoy desde el panel lateral. Lo mismo con columnas marcadas y con «Celdas del rango».
7. Cerrar el análisis con trabajos en curso los cancela (el espía ve `cancelAnalysis` o `sqlCancel`) y no cambia el CSV. Cerrar el CSV con cambios pregunta; si se cancela, quedan las dos pestañas, y si se descarta, se cierran las dos.
8. Tras reiniciar no hay pestañas de análisis y las configuraciones de gráficos guardadas siguen disponibles.
9. Con el análisis activo, Guardar, Deshacer, Rehacer y Exportar documento están desactivados con su motivo, y Cmd/Ctrl+S no escribe en disco.
10. Con un archivo grande, Información y Estadísticas están desactivadas con su motivo, y Gráficos (manual) y SQL funcionan.
11. Teclado de principio a fin: abrir con la paleta, recorrer las pestañas con las flechas, cambiar de sección y volver con «Ir al CSV».
12. Capturas a 1440×900 y a 900 px de ancho, en claro y oscuro, en es y en-XA, sin textos cortados.

## Casos límite
- Dos CSV abiertos, cada uno con su análisis. Cerrar uno no toca el otro.
- **Abrir el análisis desde Texto con cambios sin confirmar** (botón o paleta): aparece el mismo diálogo de hoy, «Guardar y cambiar», «Descartar cambios y cambiar» y «Cancelar». Con Cancelar no se abre el análisis y el texto sigue intacto. Hoy lo cubre `csv-summary.spec.ts:164-167`, y se conserva con el nuevo disparador.
- Si el análisis ya está abierto y se edita en Texto, avisa de datos cambiados cuando se confirmen.
- Reinterpretar el CSV con otro separador o codificación invalida todos los resultados.
- Documento de solo lectura o muestra: los avisos de «muestra limitada» siguen visibles.
- El análisis abierto mientras el CSV se cierra desde el menú de la app o al salir.
- Ventana estrecha: las cuatro secciones caben o pasan a un menú, sin desbordar.

## Plan de pruebas
- Unitarias: modelo de pestañas (abrir, reutilizar, cerrar en cascada, no restaurar) y almacén de vista por documento.
- E2E nuevas (`tests/e2e/analysis-tab.spec.ts`): criterios 1 a 11, con el espía de IPC.
- AN-1b: borra, reescribe o adapta según la tabla de «Entrega». Las pruebas de datos no pierden ninguna aserción; solo cambia cómo llegan a la sección.

## Fuera de alcance
- Abrir el análisis en una ventana del sistema aparte (más adelante, solo si se pide).
- Rediseño de Información y Estadísticas (AN-2).
- Estadísticas rápidas de la selección en la barra de estado.
- Vista dividida CSV y análisis.

## Riesgos que deben quedar escritos en el PR
- Lo que se pierde al quitar el panel lateral: ver tabla y estadísticas a la vez, hasta que exista una vista dividida.
- Cualquier E2E cuya comprobación cambie en la migración, con el motivo.

## Informa
SHA, pruebas rojas y verdes con su salida, el resultado del espía de IPC del criterio 1, capturas y CI de las tres plataformas.
