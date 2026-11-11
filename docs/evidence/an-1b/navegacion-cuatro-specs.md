# AN-1b: registro de navegación de cuatro archivos

Base de líneas: `75d4f3c30f6da26c58d51fb913c5ba0ef2fd8dbd`. Los cuatro archivos tienen el mismo contenido que en la base restaurada `fb2c73c`. Autorización del propietario: solo navegación, foco y alcance mediante `panel.ts`; conservar datos, guardado, seguridad y límites.

| Archivo:línea de base | Antes | Después | Motivo |
| --- | --- | --- | --- |
| ui.spec.ts:9 | Importa showPanel | Importa también showTable y closeAnalysis | Navegación compartida |
| ui.spec.ts:219 | Foco en título del panel de estadísticas | Foco en el título H2 Estadísticas de la pestaña | Equivalencia del foco en el nuevo contenedor |
| ui.spec.ts:228–230 | Edita la celda con el panel visible al lado | Vuelve al CSV, edita y vuelve a Estadísticas | La tabla y el análisis ahora son pestañas; resultado invalidado idéntico |
| ui.spec.ts:240–241 | Escape cierra el panel y devuelve foco a Analizar | Escape seguido del cierre mediante closeAnalysis; foco en la pestaña CSV seleccionada | Historia: Escape no cierra análisis; el cierre sí devuelve al CSV. Se comprueba el foco real sin forzarlo desde el ayudante |
| ui.spec.ts:287–289 | Selecciona encabezado con el panel al lado | showTable, misma selección, showPanel | Conserva límite de 100 columnas y encabezados duplicados |
| ui.spec.ts:528 | Cambia búsqueda con explorador al lado | showTable, misma búsqueda y contador, showPanel | Conserva invalidación y alcance de la vista |
| ui.spec.ts:531 | Escape cierra explorador y devuelve foco a Analizar | Escape y closeAnalysis; foco en la pestaña CSV seleccionada | Equivalencia de cierre/foco en el contenedor nuevo, sin focus artificial |
| statistics-reports.spec.ts:7 | Importa showPanel | Importa también showTable | Navegación compartida |
| statistics-reports.spec.ts:16 | Busca pestaña data.csv con expresión regular y comprueba grid visible | showTable(page,'data.csv') | Desambigua el CSV frente a su análisis/informe; la misma aserción de grid visible vive en el ayudante |
| statistics-reports.spec.ts:32 | Edita N mientras el informe estadístico está al lado | showTable, misma edición, showPanel | Conserva informe previo, invalidación y archivo original |
| selection-statistics.spec.ts:7 | Importa showPanel y numericOrder | Importa también showTable | Navegación compartida |
| selection-statistics.spec.ts:23 | Comentario del dock expandido a 1280 | Se retira solo ese comentario | El dock deja de existir |
| selection-statistics.spec.ts:25 | Filtra con estadísticas al lado | showTable, mismo filtro, showPanel | Conserva contador y resultado vacío |
| selection-statistics.spec.ts:26 | Selecciona rango con estadísticas al lado | showTable, misma selección, showPanel | Conserva todas las estadísticas numéricas |
| selection-statistics.spec.ts:27 | Edita Y con estadísticas al lado | showTable, misma edición, showPanel | Conserva invalidación y bytes originales |
| selection-statistics.spec.ts:34 | Desplaza grid con estadísticas al lado | showTable, mismo scroll visible y fila 00123, showPanel | Conserva paginación real, selección, resultados, revisión y archivo |
| descriptive-percentiles.spec.ts:7 | Importa showPanel | Importa también showTable | Navegación compartida |
| descriptive-percentiles.spec.ts:43 | Selecciona rango con estadísticas al lado | showTable, misma selección, showPanel | Conserva 68.75, 275/3 y los seis percentiles y verificaciones del informe |

## Control estático realizado

Se compararon las expresiones `expect(...)` con el AST de TypeScript ya instalado, preservando el texto de los literales. El comparador detectó correctamente una aserción deliberadamente distinta en su autocomprobación.

| Archivo | Aserciones antes | Después | Diferencias |
| --- | ---: | ---: | --- |
| ui.spec.ts | 246 | 246 | Solo los destinos de foco de las líneas 219, 241 y 531 |
| statistics-reports.spec.ts | 50 | 49 | Solo grid visible de la línea 16, trasladada al ayudante compartido |
| selection-statistics.spec.ts | 51 | 51 | Ninguna |
| descriptive-percentiles.spec.ts | 45 | 45 | Ninguna |

No se modifican fixtures, valores esperados, plazos, reintentos, etiquetas ni aserciones de datos/guardado/revisión/seguridad/límites. Este control estático no acredita ejecución de las E2E; su ejecución corresponde al cierre integrado de AN-1b.
