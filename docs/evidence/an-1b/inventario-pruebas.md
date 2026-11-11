# AN-1b · Inventario de pruebas retiradas o migradas

Base `fb2c73c493842b1985647b63f6b6d4114471f910`; código final `d2109ba14adc2314f911d3d5da982b97f34ea227`. Listado real de Playwright, sin ejecutar los casos para obtenerlo.

| Proyecto | Antes | Después |
| --- | ---: | ---: |
| shell | 126 | 128 |
| md | 256 | 256 |
| csv | 247 | 229 |
| **Total** | **629** | **613** |

Son 19 retiradas de conducta eliminada, 8 títulos reescritos para la pestaña y 3 casos nuevos. No se cambió ningún caso de proyecto. Las identidades completas (incluidas las suites) están en `identidades-antes.json` y `identidades-despues.json`; el delta está en `diferencias-identidades.json`.

## Las 19 E2E retiradas

| Archivo | Título exacto | Motivo |
| --- | --- | --- |
| analysis-dock.spec.ts | con el panel acoplado a 1366×768 la tabla sigue mostrando al menos tres columnas y no queda debajo del panel | La tabla y el análisis dejan de compartir el ancho. |
| analysis-dock.spec.ts | con un panel de análisis abierto la tabla conserva las filas que tenía sin panel | La tabla y el análisis dejan de compartir el ancho. |
| analysis-dock.spec.ts | el gráfico generado en el panel acoplado no se desplaza en horizontal y queda a la vista | La tabla y el análisis dejan de compartir el ancho. |
| dock-expanded.spec.ts | Escape en la vista ampliada vuelve a acoplar y un segundo Escape cierra el panel | No hay modo acoplado/ampliado ni restauración de ese panel. |
| dock-expanded.spec.ts | a 900×600 los tres paneles son utilizables en la vista ampliada | No hay modo acoplado/ampliado ni restauración de ese panel. |
| dock-expanded.spec.ts | ampliar y volver a la tabla conserva búsqueda, selección y posición de desplazamiento | No hay modo acoplado/ampliado ni restauración de ese panel. |
| dock-expanded.spec.ts | en una ventana estrecha el panel se abre ampliado con un aviso y al ensanchar vuelve a acoplarse sin perder nada | No hay modo acoplado/ampliado ni restauración de ese panel. |
| dock-expanded.spec.ts | en una ventana estrecha «Volver a la tabla» cierra el panel y devuelve el foco a su botón | No hay modo acoplado/ampliado ni restauración de ese panel. |
| dock-expanded.spec.ts | la vista ampliada no se guarda: tras reiniciar el panel vuelve acoplado | No hay modo acoplado/ampliado ni restauración de ese panel. |
| dock-expanded.spec.ts | los comandos amplían y acoplan el panel, y solo están disponibles cuando tienen sentido | No hay modo acoplado/ampliado ni restauración de ese panel. |
| dock-resize.spec.ts | el divisor expone su estado y se mueve con el teclado dentro del rango | El divisor, su anchura y su persistencia dejan de existir. |
| dock-resize.spec.ts | el divisor se arrastra con el puntero y solo guarda al soltar | El divisor, su anchura y su persistencia dejan de existir. |
| dock-resize.spec.ts | el panel abierto, su pestaña y su ancho pasan de un documento a otro sin llevar el foco al panel | El divisor, su anchura y su persistencia dejan de existir. |
| dock-resize.spec.ts | tras reiniciar con el mismo perfil se restauran visibilidad, pestaña y ancho, y solo se guarda eso | El divisor, su anchura y su persistencia dejan de existir. |
| dock-resize.spec.ts | un valor guardado corrupto o de otra versión se ignora sin avisos y se usan los valores por defecto | El divisor, su anchura y su persistencia dejan de existir. |
| dock-startup.spec.ts | arrancó cerrado por la ventana estrecha: ensanchar la ventana después no lo abre solo | No hay modo acoplado/ampliado ni restauración de ese panel. |
| dock-startup.spec.ts | con una ventana ancha el mismo panel guardado se restaura abierto y acoplado | No hay modo acoplado/ampliado ni restauración de ese panel. |
| dock-startup.spec.ts | restaurado abierto en una ventana ancha: estrechar la ventana lo amplía y ensancharla lo acopla, sin cerrarlo | No hay modo acoplado/ampliado ni restauración de ese panel. |
| dock-startup.spec.ts | un panel guardado como abierto arranca cerrado si la ventana es estrecha y conserva lo guardado | No hay modo acoplado/ampliado ni restauración de ese panel. |

## Reescrituras y casos nuevos

| Archivo | Título final | Tipo y motivo |
| --- | --- | --- |
| analysis-dock.spec.ts | cambiar de sección conserva la configuración del gráfico y el borrador SQL | Reescrito: entrada, foco, cancelación o permanencia equivalentes en la pestaña; resultados intactos. |
| analysis-dock.spec.ts | las secciones de la pestaña de análisis se alcanzan y activan con teclado | Reescrito: entrada, foco, cancelación o permanencia equivalentes en la pestaña; resultados intactos. |
| analysis-dock.spec.ts | las secciones visitadas se conservan y cerrar análisis las desmonta y devuelve el foco al CSV | Reescrito: entrada, foco, cancelación o permanencia equivalentes en la pestaña; resultados intactos. |
| analysis-tab.spec.ts | AN-1b ignora la disposición antigua del panel al abrir un perfil existente | Nuevo: ignora el workspace antiguo conservando preferencias ajenas. |
| compact-toolbar.spec.ts | Analizar abre una pestaña a petición y permite volver a la tabla con el foco en su pestaña | Reescrito: entrada, foco, cancelación o permanencia equivalentes en la pestaña; resultados intactos. |
| csv-summary.spec.ts | AN-1b: desde Texto con cambios, Cancelar conserva el borrador y descartar abre análisis sin escribir | Reescrito: entrada, foco, cancelación o permanencia equivalentes en la pestaña; resultados intactos. |
| csv-summary.spec.ts | AN-1b: pestaña de análisis crea gráfico y resumen a petición, con opciones plegadas y fuente intacta | Reescrito: entrada, foco, cancelación o permanencia equivalentes en la pestaña; resultados intactos. |
| project-source.spec.ts | el análisis distingue una fuente completa protegida de una muestra, incluso con el proyecto cerrado | Nuevo: separa alcance real de permiso de escritura y cierre del proyecto; conserva bytes. |
| project-source.spec.ts | una muestra conserva su alcance al protegerla y al cerrar el proyecto | Nuevo: separa alcance real de permiso de escritura y cierre del proyecto; conserva bytes. |
| structure.spec.ts | H15-2: cerrar Análisis cancela su perfilado y permite preparar la fórmula | Reescrito: entrada, foco, cancelación o permanencia equivalentes en la pestaña; resultados intactos. |

| column-menu.spec.ts | «Estadísticas de la columna» abre Análisis con esa columna marcada | Reescrito: sustituye el destino retirado y conserva el marcado Ciudad/Folio y el alcance. |

## Unitarias de la disposición

El diseño dice «16 unitarias» para `workspace-layout.test.ts`. La extracción del AST de la base encuentra **16 llamadas ordinarias y 14 entradas de `it.each`: 30 casos expandidos**. Se retira exactamente ese archivo junto con su módulo, sin ampliar la retirada a otras funciones. Se retira además **una fila** de `tests/ci-areas.test.ts` que solo clasificaba la ruta eliminada de `AnalysisDock.svelte`.

Se añaden 7 casos puros de alcance real/muestra/protección, 10 de validez semántica de la consulta, 1 del alcance de estadísticas y 1 de la paleta nativa CSV Texto. La integración de la versión alpha.4 añade el caso de actualización desde alpha.3. El recuento de la suite completa final se registra en el informe de ejecución, sin inferirlo de llamadas de código.

## Navegación de los quince archivos de datos

`cambios-por-linea.json` guarda el diff con líneas de base y finales de cada archivo tocado. `search.spec.ts` y `commands.spec.ts` no cambian: basta el ayudante común. `navegacion-cuatro-specs.md` detalla ui, statistics-reports, selection-statistics y descriptive-percentiles. `aserciones-75bf731.json` recoge la revisión independiente por AST del punto de integración; 26a5 añadió la petición explícita de regeneración y medidas de geometría. d2109ba añade las precondiciones de migración y metadatos, navegación idempotente del explorador y comprobaciones del bloqueo real de presets en grandes; no cambia cifras ni condiciones de datos. El registro por línea incluye también column-menu y el montaje Markdown P5.

Las comprobaciones UI retiradas o sustituidas son las de «Resumen y gráfico» activo, los botones por posición, el cierre por Escape y los títulos/foco de los paneles. Cuando la conducta permanece se comprueba en la pestaña nueva. Las capturas y los anuncios en/en-XA se conservan; antes del primer gráfico se comprueba ausencia de resultado y se pulsa Crear. La fila/contadores/estadísticas/exportación/bytes/revisiones/seguridad/cancelación/límites permanecen.

La carrera de `columns-overview.spec.ts` conserva una respuesta real retenida, vuelve al CSV visible, desplaza su cuadrícula hasta la fila 10.000 y regresa a Información antes de liberar la respuesta. Las comprobaciones de solo lectura de charts vuelven al CSV real; no se apoyan en el bloqueo general de Guardar de la pestaña de análisis.
