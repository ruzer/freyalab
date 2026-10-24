# E0.1 — Paridad de acciones CSV: documento, archivo grande y extracto

Fecha de revisión: 24 de octubre de 2026. **Auditoría estática; no se ejecutó la aplicación ni se hicieron mediciones nuevas para esta matriz.** Este documento no implementa E1 ni cambia el motor del producto.

## Referencias y alcance

Se comparan dos árboles inmutables, no el checkout del usuario ni una mezcla de ramas:

- **M — corte de `main` auditado: `db9f462bc4bddf3b635a8f7d2aebfdc73b711de1`.** Un CSV que supera los límites se muestra como muestra de solo lectura. El `main` posterior, `36c99766d62aca23792d1c28cabebd66422f069e`, incorpora #58: el único archivo que cambia desde M es `tests/e2e/virtual-scroll.spec.ts`. **El código de producto es equivalente y la matriz M sigue vigente para ese `main`.** La base de la rama E0 se actualizó a `36c9976`.
- **G — L2 del [PR #57](https://github.com/ruzer/freyalab/pull/57): `b5e379fbaf319fe3a10f4e30379f4173586e762a`.** Añade lectura paginada del archivo grande y «Ir a la fila»; conserva las restricciones restantes. En la consulta de GitHub del 24-oct-2026 continúa abierto, en borrador, con CI verde en las cuatro plataformas; no está fusionado.
- Instrucciones de E0: `CODEX-INSTRUCCIONES.md`, recibido en el scratchpad local el 24-oct-2026. E0 produce documentos y experimentos; E1 exige aprobación posterior.
- [RFC de archivos grandes, §1 y §11 en M](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/docs/design/LARGE-FILE-EDITOR-RFC.md#L306): L3–L9 siguen vigentes. Los extractos **complementan** la edición grande con capa y diario; no la sustituyen.
- [Evaluación previa de bases analíticas](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/docs/ANALYSIS-DATASETS.md): no se debe materializar automáticamente un CSV por cada filtro ni confundir receta, copia y resultado.

La autorización del usuario del 24-oct-2026 amplía el trabajo a archivos grandes y extractos. El usuario decidió **proponer la actualización de `AGENTS.md` después de E0**. Su línea que excluye archivos de GB de la alfa permanece intacta en esta entrega; no se interpreta esa respuesta como permiso para editarla ahora.

### Fuentes de código

Las referencias abreviadas de las tablas remiten a estos archivos y líneas, siempre en los SHA anteriores:

| Clave | Evidencia |
|---|---|
| UI-M | [CsvTable en M: comandos, selección y bloqueos](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/src/renderer/components/CsvTable.svelte#L35), [edición, copia e interpretación](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/src/renderer/components/CsvTable.svelte#L173) |
| UI-G | [CsvTable en G: `large` y comandos](https://github.com/ruzer/freyalab/blob/b5e379fbaf319fe3a10f4e30379f4173586e762a/src/renderer/components/CsvTable.svelte#L54), [aviso en lugar de estadísticas](https://github.com/ruzer/freyalab/blob/b5e379fbaf319fe3a10f4e30379f4173586e762a/src/renderer/components/CsvTable.svelte#L215) |
| Motor-M | [Límites y apertura](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/src/main/table-engine.ts#L16), [mutaciones e historial](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/src/main/table-engine.ts#L256), [exportación, análisis y guardado](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/src/main/table-engine.ts#L320) |
| Motor-G | [Guardia de modo grande y apertura](https://github.com/ruzer/freyalab/blob/b5e379fbaf319fe3a10f4e30379f4173586e762a/src/main/table-engine.ts#L61), [páginas sin búsqueda/filtro/orden](https://github.com/ruzer/freyalab/blob/b5e379fbaf319fe3a10f4e30379f4173586e762a/src/main/table-engine.ts#L119), [transferencia analítica permitida](https://github.com/ruzer/freyalab/blob/b5e379fbaf319fe3a10f4e30379f4173586e762a/src/main/table-engine.ts#L350) |
| Contratos | [TableQuery, TableEdit, TableExport, estadísticas y API en M](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/src/shared/types.ts#L6) |
| Archivo | [Documents: apertura, serialización de operaciones, guardado y recuperación](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/src/main/documents.ts#L26), [barra común, guardar y exportar](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/src/renderer/App.svelte#L35) |
| Consulta | [Filtros y ordenamiento en la interfaz](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/src/renderer/components/CsvQueryTools.svelte#L14), [validación y comparación compartidas](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/src/main/table-query.ts) |
| Transformar | [Operaciones y vista previa](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/src/renderer/components/CsvTransform.svelte#L13), [plan reversible en el motor](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/src/main/table-engine.ts#L163) |
| Estadísticas | [CsvStatistics](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/src/renderer/components/CsvStatistics.svelte#L24), [panorámica de columnas](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/src/renderer/components/CsvColumnsOverview.svelte#L21), [detalle por columna](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/src/renderer/components/CsvColumnAnalysis.svelte#L16), [cálculos](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/src/main/table-analysis.ts#L11) |
| Analítica | [Límites y lectura CSV→Arrow](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/src/main/analysis-source.ts#L12), [SqlService](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/src/main/sql-service.ts#L36), [panel SQL](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/src/renderer/components/CsvSql.svelte#L45) |
| Gráficos | [Controles, alcance y exportación](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/src/renderer/components/CsvCharts.svelte#L85), [consultas y límites](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/src/shared/charts.ts#L2), [presets](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/src/renderer/components/ChartPresets.svelte) |
| Exportar | [Bloqueo de CSV de solo lectura; gráficos por ruta separada](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/src/main/export.ts#L33), [resultados de gráficos y contexto](https://github.com/ruzer/freyalab/blob/db9f462bc4bddf3b635a8f7d2aebfdc73b711de1/src/main/chart-result.ts#L8) |

## Cómo leer la paridad

- **Pequeño**: documento editable, dentro de 50 MiB y dos millones de celdas; registro de hasta 1 MiB. Son límites, no garantías de latencia. Un archivo menor de 50 MiB puede superar el límite de celdas.
- **Muestra M**: hasta 200 registros completos, con prefijo máximo de 8 MiB. Búsqueda, filtro, orden y estadísticas describen ese subconjunto; no hay un recuento completo del original.
- **Grande G**: índice disperso y páginas del archivo; `rows` no contiene toda la tabla. `get(id)` rechaza las operaciones que necesitan el estado en memoria; `info`, `page` y `analysisStart` optan explícitamente por admitir este modo.
- **Bloqueado**: no disponible para modificar/copiar/exportar datos, aunque algún diálogo o atajo llegue a abrirse antes de que la guardia lo rechace. No equivale a que el motor carezca de validación.
- **A**: la ruta analítica existente puede leer **el archivo completo desde disco**, dentro de los límites de la sección siguiente. No significa que trabaje sobre la muestra ni que admita cualquier archivo grande.
- **E1→normal**: propuesta, todavía no implementada por E0. Una extracción explícita crea otro archivo y, **solo si cabe en los límites del editor**, las funciones actuales trabajan sobre ese documento nuevo. La fuente grande no recibe las ediciones. Si no cabe, continúa en modo grande G, con sus restricciones.
- **Lx / Ex**: entrega propuesta; no son números de PR abiertos. Se asignará un PR a cada cambio cuando exista. El único PR de producto grande comparado aquí es #57; E0 no entrega esas funciones.

## Límite transversal de SQL y gráficos: L2 no lo elimina

En M, la tabla de muestra no es la entrada del análisis completo: `analysisStart` usa `fileRecords` sobre el original. En G se conserva esa ruta mediante `get(id, true)`. Ambas versiones siguen sujetas a:

1. **256 MiB del archivo por fuente**, comprobados antes de leer, y 256 MiB de texto decodificado.
2. **Dos millones de filas, ocho millones de posiciones de celdas y 200 columnas por fuente**; ocho millones de celdas transferidas en total cuando hay varias fuentes.
3. Hasta **cuatro fuentes** SQL, cola con un trabajo activo y tiempo máximo de dos minutos por ejecución. Cada ejecución prepara su propio motor; no existe una base persistente compartida adoptada por este documento.
4. Resultado SQL acotado a 10 000 filas y 8 MiB; páginas de 100. El límite del resultado no reduce el coste de cargar sus fuentes.
5. En `arrowBatches`, las filas, celdas y bytes de entrada se contabilizan **antes** de aplicar `where`. Un filtro que conservaría pocas filas no evita esos límites. Tampoco evita el rechazo inicial de archivos mayores de 256 MiB.
6. «Vista filtrada actual» o recuperada de la tabla está deshabilitada cuando `doc.readonly`; los **filtros propios del gráfico** (`where`) sí están disponibles, con el coste y los límites anteriores.

Por tanto, **un CSV de 1 GiB no pasa a ser analizable por aplicar un filtro desde SQL o un gráfico**. Un archivo de 100 MiB y 21 columnas también puede exceder ocho millones de celdas aunque no alcance 256 MiB. Un extracto con menos filas/columnas puede quedar dentro; habrá que medir la extracción y comprobar sus límites, sin afirmar que siempre acelera el trabajo.

## Matriz de acciones

### Abrir, comprender la tabla y navegar

| Acción existente y referencia | Pequeño en M | Grande en M | Grande en G (#57) | Sobre el documento grande completo | Mediante extracto |
|---|---|---|---|---|---|
| Abrir CSV/TSV mediante selector, arrastrar, asociación del SO o recientes (Archivo) | Editable | Muestra | Archivo indexado de solo lectura | L2 (#57); endurecimiento L9 | E1 necesita antes L2 o una ruta de fuente aprobada |
| Abrir varios archivos; carpeta, árbol y búsqueda de nombres (Archivo) | Pestañas/documentos independientes | Igual; cada CSV limitado | Igual; cada CSV indexado | Ya existe apertura; E4 debe precisar escenarios antes de ampliar | No es unión automática ni proyecto de análisis |
| Crear tabla CSV nueva (Archivo; `TableEngine.create`) | Documento vacío editable | No depende de una fuente grande | Igual | No requiere L3 | E1 abre un documento nuevo a partir de datos, no una tabla vacía |
| Desplazarse vertical/horizontalmente, teclado, inicio/final y páginas (UI-M) | Páginas virtualizadas | Solo las filas de la muestra | Todas las filas indexadas; altura escalada | L1 y L2; escalas adicionales, L9 | E1→normal o G según tamaño |
| Ir a un número de fila (UI-G) | No está en M | No está en M | Botón, paleta, Ctrl/⌘+G; también para pequeños | #57; no equivale a buscar un valor | E1 reutiliza #57 |
| Marcar filas y columnas; rango arrastrado/Mayús; seleccionar todo (UI-M) | Identificadores y rango de la vista | Selección dentro de la muestra | Selección/navegación visible; no desbloquea operaciones | L2 conserva selección; L3/L5/L7 deben dar semántica a sus operaciones | E1→normal; posiciones/identidades pertenecen al extracto |
| Cambiar codificación UTF-8/UTF-16 LE/Windows-1252 (Archivo; UI-M) | Reabre el archivo si está guardado y sin cambios pendientes | Reinterpreta muestra | Reabre/reindexa el archivo completo | Existe interpretación; conversiones persistidas requieren guardado L3/L6 | E1 debe declarar formato de salida, sin convertir silenciosamente |
| Cambiar separador coma/punto y coma/tabulación/barra (Archivo; UI-M) | Reinterpreta; no convierte automáticamente el archivo | Reinterpreta muestra | Reindexa/reinterpreta | Lectura existente; convertir y escribir es L6, no este control | E1 conserva o declara el separador elegido |
| Primera fila como encabezados o como datos (Archivo; UI-M) | Reabre según opción | Reinterpreta muestra | Reindexa/reinterpreta y ajusta recuento | Existe en L2; editar su contenido es L7 | E1 debe conservar esta elección y no perder una fila |
| Recargar tras cambio externo; cerrar pestaña (Archivo) | Avisa antes de descartar cambios pendientes | Recarga muestra | Reindexa; cierre libera estado | L2 para lectura; L3/L9 para edición/recuperación y conflictos | Extracto separado; no refrescarlo desde la fuente silenciosamente |
| Mostrar/ocultar explorador y panel; acoplar, ampliar, volver, redimensionar; temas (UI-M; App) | Disponible | Disponible | Disponible | No requieren motor nuevo | Reutilizar sin otra interfaz |
| Paleta, menús contextuales y atajos (UI-M/UI-G) | Ejecutan los mismos comandos | Guardias conservadas | Explican acciones no disponibles; añaden ir a fila | Habilitar cada comando cuando exista su motor; no solo quitar `disabled` | E1 añade una acción compartida, según contrato aprobado |

### Buscar, filtrar y ordenar

| Acción y referencia | Pequeño en M | Grande en M | Grande en G (#57) | Sobre el documento grande completo | Mediante extracto |
|---|---|---|---|---|---|
| Búsqueda global de texto, sin distinguir mayúsculas (UI-M; `indices`) | Filtra filas, no es lista paginada de coincidencias | Solo muestra | Deshabilitada; `largePage` rechaza búsqueda | E2/L4: recorrido cancelable y resultados paginados | E1 puede reducir por condiciones; E2 sigue necesario para búsqueda global |
| Resaltar celdas que contienen la búsqueda (UI-M) | Coincidencia de celda en filas visibles | Solo muestra | No hay búsqueda que resaltar | E2/L4, conservando ubicación de resultados | E1→normal |
| Filtros simples «Contiene» por columna (Consulta; `indices`) | Combinados sobre el documento | Solo muestra | Deshabilitados/rechazados | L5: vista paginada en disco; E1: condición para extraer | E1 crea subconjunto explícito; no crea copia por cada cambio de filtro |
| Texto exacto/no igual/contiene/inicia/termina; vacío/no vacío; sensibilidad a mayúsculas (Contratos; Consulta) | Condiciones de vista | Solo muestra | Consulta avanzada deshabilitada | L5; reutilizar modelo validado `TableFilter` | E1 debe reutilizar condiciones soportadas por el motor que apruebe E0 |
| Mayor/menor y sus iguales; fechas antes/en/después; regex (Contratos; Consulta) | Comparaciones explícitas; no tipan las celdas del CSV | Solo muestra | Consulta avanzada deshabilitada | L5; validar equivalencia, fechas y límites de regex | No prometer todos los operadores con otro motor sin pruebas de equivalencia |
| Combinar condiciones con Y/O; añadir/quitar; limpiar filtros (Consulta) | Hasta 20 condiciones; no modifica CSV | Solo muestra | No hay filtros grandes activos | L5; limpiar una vista no necesita reescribir datos | E1 guarda condición de origen en el contexto; filtros del extracto son independientes |
| Orden ascendente/descendente textual o numérico explícito (UI-M; Consulta) | Estable; solo vista | Solo muestra | Botones/comandos y motor bloquean orden | L5: orden externo/lista de identificadores acotada | E1→normal; el extracto conserva orden original salvo orden expresamente aprobado |
| Orden por varias columnas; Mayús+clic; cambiar prioridad/quitar criterios (Consulta) | Hasta 20 criterios; desempate original | Solo muestra | Deshabilitado | L5, sin permutación completa en RAM | E1→normal |
| Fijar el orden de la vista en el documento (`commitOrder`; Transformar) | Vista previa y un paso de historial; guardar persiste | Bloqueado | Bloqueado | L5 + L6: versión nueva, no confundir con ordenar vista | E1→normal; solo modifica el extracto |
| Reemplazar texto en documento completo, columnas elegidas o todas (UI-M; rango `documentScope`) | Vista previa; incluye filas ocultas, sin encabezados | Diálogo puede abrir; aplicación bloqueada por solo lectura | Deshabilitado | E3/L4 + L6: recuento previo y versión nueva; original intacto | E1→normal; E3 permite producir copia transformada sin exigir extracto pequeño |
| Reemplazar dentro de un rango (Contratos; UI-M) | Vista previa sobre selección/revisión capturadas | Bloqueado | Bloqueado | L3 para cambios puntuales; L4/L6 si es masivo | E1→normal; no reutilizar ordinales de la fuente como si fueran del extracto |

### Edición, estructura y portapapeles

| Acción y referencia | Pequeño en M | Grande en M | Grande en G (#57) | Sobre el documento grande completo | Mediante extracto |
|---|---|---|---|---|---|
| Editar celda por doble clic, Enter/F2; aceptar o cancelar (UI-M; `cell`) | Texto exacto; Enter/desenfoque acepta; Escape descarta edición activa | Bloqueado | Bloqueado | **L3**, capa por identificador + diario; guardar separado | E1→normal |
| Editar nombre del encabezado (`header`) | Permitido, incluso vacío/duplicado | Bloqueado | Bloqueado | L7, con identidad de columna y preservación de cabeceras ausentes | E1→normal |
| Añadir fila al final; insertar arriba/abajo de la marcada (`insertRow`) | Un paso del historial | Bloqueado | Bloqueado | L7 integra altas/bajas sobre capa L3; la PoC no equivale a función del producto | E1→normal |
| Eliminar filas marcadas (`deleteRows`) | Un paso reversible | Bloqueado | Bloqueado | L7; IDs estables y reconstrucción/ajuste de índice | E1→normal |
| Duplicar filas marcadas (`duplicateRows`) | Conserva originales; nuevas identidades | Bloqueado | Bloqueado | L7 | E1→normal |
| Añadir columna; insertar izquierda/derecha (`insertColumn`) | Extiende tabla/encabezado | Bloqueado | Bloqueado | L7 + versión en flujo para cambios que afecten todos los registros | E1→normal |
| Eliminar columna (`deleteColumn`) | Reversible; ajusta filtros/selección de interfaz | Bloqueado | Bloqueado | L7; preservar filas irregulares y ausencia frente a vacío | E1→normal |
| Duplicar columna (`duplicateColumn`) | Reversible | Bloqueado | Bloqueado | L7 | E1→normal |
| Mover filas seleccionadas o intervalo al destino (`moveRows`) | Vista previa; conserva orden relativo original | Bloqueado | Bloqueado | L6/L7; orden e IDs persistentes, memoria acotada | E1→normal |
| Mover columnas seleccionadas (`moveColumns`) | Vista previa; rechaza permutaciones que no preservan campos ausentes | Bloqueado | Bloqueado | L6/L7; no rectangularizar por comodidad | E1→normal, con la misma validación |
| Copiar rango o filas/columnas como TSV (UI-M; `clipboard`) | Valores serializados; máximo 8 MiB | Bloqueado por motor, incluidos atajos | Bloqueado por motor; marcar no habilita copiar | Lectura acotada sobre L2/L5; PR específico pendiente, no asignado por el RFC | E1→normal; mismo tope de portapapeles |
| Copiar rango/filas/vista como tabla Markdown (`markdown`) | Escapa barras y saltos; máximo 8 MiB en IPC | Bloqueado | Bloqueado | Exportación/lectura acotada sobre L2/L5; pendiente | E1→normal; Markdown es representación, no preservación byte a byte |
| Cortar rango | Copia + vaciado con vista previa, reversible | Bloqueado | Bloqueado | Copia acotada + L3; L6 si masivo | E1→normal |
| Pegar TSV en rango o desde celda (`range/paste`) | Analiza tabuladores/comillas; pega según vista y revisión | Bloqueado | Bloqueado | L3 y L7 si añade filas/columnas; límites antes de aplicar | E1→normal; no pegar sobre IDs obsoletos |
| Rellenar rango con valor (`fill`) | Vista previa; Ctrl/⌘+Enter | Bloqueado | Bloqueado | L3 para puntual, L6 para masivo | E1→normal |
| Vaciar rango; Delete/Backspace (`clear`) | Vista previa; no elimina filas | Bloqueado | Bloqueado | L3/L6; distinguir vacío creado de campo ausente | E1→normal |
| Quitar espacios, mayúsculas o minúsculas en rango/filas marcadas (`trim/upper/lower`) | Reversible; columnas elegidas o todas | Bloqueado | Bloqueado | L3/L6 según alcance; versión para operación masiva | E1→normal |
| Deshacer/rehacer (barra, paleta, teclado; `undo`) | Mutaciones inversas; presupuesto compartido de 20 MiB | Bloqueado; API de documentos devuelve estado sin cambio | Bloqueado | L3: diario puntual; L6: volver entre versiones. UX tras guardar pendiente en RFC §5 | E1→normal; historial del extracto, no del original |

### Transformaciones del documento

Todas las operaciones de esta tabla existen en el asistente **Transformar documento**; no son propuestas de E0. Salvo mover filas, actúan sobre el documento y las columnas elegidas, incluyendo filas ocultas. El asistente ofrece vista previa, invalidación por revisión/cambio externo y cancelación de preparación. Son como máximo 200 columnas y 20 MiB de presupuesto de deshacer; dividir permite como máximo 32 columnas resultantes. Las filas estructurales no pueden exceder el presupuesto de celdas/registro. Véase Transformar/Motor-M.

| Acción | Pequeño en M | Grande M / G | Sobre el documento grande completo | Mediante extracto |
|---|---|---|---|---|
| Dividir una columna por separador literal | Nueva estructura con vista previa | Bloqueado / bloqueado | L6 + L7: recorrido y versión nueva | E1→normal; sujeto al tope de 32 resultados |
| Combinar columnas en una nueva | Orden original de columnas marcadas; nombre explícito | Bloqueado / bloqueado | L6 + L7 | E1→normal |
| Eliminar filas duplicadas por columnas | Conserva primera coincidencia; claves distinguen campos ausentes | Bloqueado / bloqueado | L6; memoria de claves/derrame por evaluar; no basta una lista ilimitada en RAM | E1→normal |
| Componer texto Unicode NFC | Solo cambios explícitos; vista previa | Bloqueado / bloqueado | L6, versión nueva | E1→normal |
| Normalizar encabezados | NFC, trim, espacios→guion bajo, minúsculas, sufijos únicos | Bloqueado / bloqueado | L7; versión/encabezado nuevo sin cambiar identidades silenciosamente | E1→normal |
| Vista previa, ejemplos y recuentos antes de aplicar | Hasta ocho ejemplos; operación se revalida al aplicar | No disponible sobre fuente | L4/L6/L7 deben conservar el flujo, no aplicar por abrir diálogo | E1 reutiliza vista previa del editor; vista previa de extracción es otra operación explícita |
| Cancelar preparación o fallo sin modificación parcial | Revisiones/tickets y plan antes de mutar | No hay transformación habilitada | L3/L4/L6/L7: señal hasta lectura/escritura, borrar temporales | E1 exige cancelar extracción sin documento parcial |

### Estadísticas, calidad y exploración

Estas funciones usan el **motor textual**, no SQL. M puede calcularlas sobre la muestra con etiqueta; G monta un aviso en lugar de `CsvStatistics` y el motor rechaza las llamadas. La disponibilidad de SQL no las vuelve disponibles automáticamente. Véase Estadísticas, UI-G y Motor-G.

| Acción | Pequeño en M | Grande en M | Grande en G (#57) | Sobre el documento grande completo | Mediante extracto |
|---|---|---|---|---|---|
| Resumen de filas marcadas en la barra de estado | Vacíos, únicos y métricas numéricas | Solo muestra | No se calcula (`stats()` sale si `large`) | L5 por recorrido/selección; L9 valida escala | E1→normal |
| Estadísticas de todas las columnas o columnas marcadas | Documento completo, incluidas filas ocultas | Solo muestra | Panel sustituido por aviso | L5; acumuladores o derrame según métrica | E1→normal |
| Estadísticas de celdas de rango o rango por columnas | Vista/revisión capturadas | Solo muestra | No disponible | L5 con IDs de vista, no arrays proporcionales al archivo | E1→normal |
| Conteos de celdas, vacíos, ausentes, solo espacios, numéricos/excluidos, valores únicos | Límites actuales; sin convertir CSV | Solo muestra | No disponible | L5; únicos exactos no tienen memoria constante sin estrategia específica | E1→normal |
| Suma, media, mínimo, máximo, mediana, varianza/desviación poblacional y muestral; P10/P25/P75/P90 | Cálculos actuales; números no seguros se excluyen | Solo muestra | No disponible | L5; mediana/percentiles exactos requieren estrategia de orden/selección; no prometer solo acumuladores | E1→normal; no confundir «tipo identificador» orientativo con conversión |
| Comprender columnas: tipos probables, calidad, distintos y repeticiones | Todas o marcadas; documento o vista; máximo 2 M posiciones y 2 000 columnas | Solo muestra | No disponible | L5, por lotes, cancelable y con cobertura explícita | E1→normal; columnas de alta cardinalidad pueden fallar individualmente |
| Explorar perfil individual y explicación del tipo | Identificador/número/fecha/categoría/texto/mixto/vacío | Solo muestra | No disponible | L5 | E1→normal |
| Frecuencias, únicos y solo duplicados; paginar valores | Texto exacto; páginas de 50; tope 100 000 distintos | Solo muestra | No disponible | L5: cardinalidad y derrame, no cargar todas las claves sin límite | E1→normal; tope de distintos sigue vigente |
| Detectar ausentes/vacíos, longitudes, ceros iniciales e IDs inseguros | Perfil de calidad; no corrige automáticamente | Solo muestra | No disponible | L5 | E1→normal |
| Distribución/histograma de columna y correlación Pearson | Intervalos 1–30; pares numéricos válidos; explicación de omisiones | Solo muestra | No disponible | L5; enlazar resultados pequeños; no reutilizar incorrectamente la ventana visible | E1→normal |
| Abrir detalle desde panorámica; filtrar/buscar columnas de resultados; paginar | UI sobre resultados | Solo muestra | Aviso sin resultados | Reutilizar UI sobre L5 | E1→normal |
| Abrir informe Markdown de estadísticas, panorámica o detalle | Instantánea editable con contexto/revisión; frecuencias incluyen la página consultada | Informe rotulado como muestra | No hay resultado de esos paneles | L5 + exportación; mantener parcialidad y versión | E1→normal; conservar además procedencia del extracto |
| Cancelar estadística/exploración y descartar respuesta obsoleta | Tickets, revisión y cancelación cooperativa | Solo muestra | No hay solicitud de panel habilitada | L5; paginar el mismo alcance no debe cancelar una analítica distinta | E1 reutiliza garantías; pruebas de concurrencia siguen necesarias |

No se encontró una función de **moda** en este árbol como métrica estadística explícita; no se inventa como acción existente por poder observar frecuencias.

### Gráficos, SQL, resultados y persistencia

| Acción y referencia | Pequeño en M | Grande en M | Grande en G (#57) | Sobre el documento grande completo | Mediante extracto |
|---|---|---|---|---|---|
| Histograma, barras, líneas, dispersión, calor y cajas (Gráficos) | DuckDB prepara; ECharts dibuja | A, no la muestra | A, no las páginas visibles | L8; agregados pequeños y compuerta de motor nativo si se elige | E1→normal dentro también de límites analíticos |
| Elegir ejes, medida texto/número, conteo/únicos/suma/media/min/max/mediana (Gráficos) | Controles explícitos; cálculo incompatible deshabilitado | A | A | Reutilizar UI con fuente grande L8 | E1→normal; no convertir IDs automáticamente |
| Series por color; leyenda; día/mes/año; orden (Gráficos) | Según tipo; hasta ocho series; fechas ISO | A | A | L8; mismos cálculos/limitaciones estadísticos | E1→normal |
| Alcance completo o vista filtrada actual/guardada (Gráficos) | Completo incluye cambios pendientes; vista usa filtros, no solo página | Solo completo desde disco | Solo completo desde disco | L5 + L8 para vista grande; no simular vista con muestra | E1 fija origen del subconjunto; luego sus filtros son propios |
| Filtros adicionales del gráfico y limpiar esos filtros (Gráficos; Consulta) | Grupo Y/O separado del CSV | A; límites antes de filtrar | A; límites antes de filtrar | L8; selección en fuente grande sin saltar integridad | E1 crea subconjunto explícito; no confundir filtro analítico con extracción |
| Tabla accesible del gráfico, paginación, zoom y ajuste (Gráficos) | Datos dibujados acotados; páginas de 50 | A | A | UI reutilizable; preparar datos es L8 | E1→normal |
| Guardar, aplicar y borrar configuración de gráfico (presets) | Configuración local, no datos congelados | Sin vista de tabla guardada aplicable | Igual | UI/configuración existente; versionar fuente es otro trabajo | E1: nombres/esquema del extracto pueden no coincidir; validar antes de aplicar |
| Exportar dibujo SVG/PNG/PDF (Gráficos; Exportar) | Instantánea; revisión validada | Permitido si gráfico A válido, aunque exportación CSV general esté bloqueada | Igual | L8; no afirmar análisis de GB completo sin haberlo calculado | E1→normal |
| Exportar resultados de gráfico CSV+JSON de contexto, JSON o informe Markdown (Exportar) | Reconsulta con revisión/filtros; máximo 10 000 elementos | A y límites de resultado | A y límites de resultado | L8 + salida acotada/paginada según contrato futuro | E1→normal; JSON distingue nulos/vacíos; CSV puede proteger fórmulas |
| SQL SELECT de solo lectura, editar consulta, ejecutar/cancelar (Analítica) | Documento en memoria, cambios pendientes; filtros de tabla no limitan SQL | A completo desde disco | A completo desde disco | L8; no trasladar SQL arbitrario a un proceso privilegiado sin compuerta | E1→normal; consulta no reescribe fuente ni extracto |
| Asistente agrupar/resumir (conteo/suma/promedio) (SqlAssist) | Genera SQL; número DECIMAL explícito | A | A | L8 | E1→normal |
| Asistente tabla dinámica (pivot) (SqlAssist) | Hasta 20 categorías explícitas | A | A | L8 | E1→normal |
| Cruce inner/left entre archivos abiertos (SqlAssist) | Hasta cuatro fuentes SQL; claves de texto | A por fuente + límite conjunto | Igual | L8; escenarios de muchos archivos, E4 después de aclararlos | No es una extracción E1 ni admite automáticamente 30 archivos |
| Paginar resultado SQL y abrir informe Markdown (Analítica) | Hasta 10 000 filas conservadas; aviso de parcialidad | A | A | L8; informe conserva origen y alcance | E1→normal |
| Cancelar, timeout, cola y cierre del motor aislado (Analítica) | Existente; no modifica CSV | A | A | Conservar y extender señales a motor grande, L8/L9 | E1 no debe ocupar el renderer con captura completa |

Los límites de dibujo actuales son 2 000 puntos para líneas/dispersión, 400 para calor y 100 para los otros tipos. Un dibujo parcial puede provenir de un agregado calculado sobre toda la fuente aceptada; no equivale a analizar una muestra aleatoria ni a exportar todos sus puntos.

### Guardado, exportación del CSV y recuperación

| Acción y referencia | Pequeño en M | Grande en M | Grande en G (#57) | Sobre el documento grande completo | Mediante extracto |
|---|---|---|---|---|---|
| Guardar y Guardar como (Archivo; `serialize`) | Temporal en mismo destino y sustitución atómica; comprueba conflicto; serializa todo | Bloqueado | Bloqueado | **L3**, guardado en flujo de capa; espacio/cancelación/recuperación; L9 por plataforma | E1→normal guarda solo el archivo nuevo; no habilita guardar original |
| Exportar documento, vista filtrada o selección a CSV/TSV (Exportar; Motor-M) | Serializa valores; separador según salida; no cambia documento | Bloqueado en UI y backend | Bloqueado | E1 para subconjunto nuevo; L5/L6 para exportación/orden grande; PR de paridad completo pendiente | E1→normal; no presentar CSV estándar como copia byte idéntica |
| Cambiar delimitador al exportar | CSV/TSV según formato, mediante `TableExport.delimiter` | Bloqueado | Bloqueado | Recorrido/escritura nueva, L6 o E1 según contrato | E1 declara formato; nunca reinterpreta sin avisar |
| Guardado con codificación/BOM/saltos originales; bloqueo de caracteres no representables | Conserva metadatos; comillas normalizadas por `csv-stringify`; valida roundtrip de codificación | Sin guardado | Sin guardado | L3 copia tramos intactos; L6/L7 versionan cambios; verificar fidelidad | Extracción proyectada/normalizada debe describir cambios; E0 determina motor, no se garantiza aquí |
| Detectar cambios externos y ofrecer recargar/guardar copia | Watcher y verificación de hash al guardar | Avisa; guardar copia no es permitido por solo lectura | Avisa; reindexar; guardar sigue bloqueado | L3 conflicto y guardado seguro; L9 múltiples ventanas/volúmenes | E1 captura huella/revisión coherente; no mezcla versiones de entrada |
| Recuperación automática tras inactividad y abrir recuperado como copia | Checkpoint si está sucio; CSV conserva estado/historial; se recupera con ruta nueva | Sin cambios editables que recuperar | Sin diario de cambios grande aún | L3 diario y recuperación; L9 energía y durabilidad | E1→normal; la política de persistencia/limpieza del extracto necesita aprobación |
| Descartar recuperación; cerrar con guardar/cancelar/descartar | Disponible; respeta decisión del usuario | Solo lectura | Solo lectura | L3/L9 para diario/versiones grandes | E1 necesita definir qué pasa con el archivo nuevo al cerrar, no borrarlo por asumir que es temporal |
| Protección frente a fórmulas al abrir en hoja de cálculo | Valores del CSV no se ejecutan en FreyaLab; protección explícita en exportación de resultados de gráfico | Igual | Igual | Mantener datos exactos; una protección de exportación cambia su texto y debe ser optativa/visible | No añadir apóstrofos al archivo canónico ni prometer protección en toda exportación CSV actual |

No hay importador general JSON/XLSX ni exportación JSON del **documento CSV completo** en el contrato `ExportRequest` actual. JSON es salida de resultados de gráficos. No se presentan estas capacidades como funciones existentes que E1 deba «conservar».

## Dependencias y entregas: dos vías complementarias

| Entrega | Dependencia y responsabilidad | Qué no permite afirmar |
|---|---|---|
| L1 / [#52](https://github.com/ruzer/freyalab/pull/52) | Navegación más allá del techo de altura de Chromium; presente en M | No lee ni edita GB por sí solo |
| L2 / [#57](https://github.com/ruzer/freyalab/pull/57) | Abierto, en borrador; cuatro CI satisfactorios en la consulta del 24-oct. Índice/páginas/ir a fila/progreso/cancelación; comparado en G | No está fusionado; no habilita las operaciones bloqueadas ni el análisis ilimitado |
| [#56](https://github.com/ruzer/freyalab/pull/56) | Abierto, fuera de borrador; cuatro CI satisfactorios en la consulta del 24-oct. Menú por columna en rama independiente; coordinar al integrar UI futura | No está fusionado ni es motor de archivos grandes; no se incorpora a esta comparación |
| [#58](https://github.com/ruzer/freyalab/pull/58) | **Fusionado por el usuario**, con cuatro CI satisfactorios en el PR. Arregla únicamente `tests/e2e/virtual-scroll.spec.ts`; `main` resultante `36c9976` | Un arreglo de prueba no demuestra funciones L3–L9; el verde del PR no certifica el CI posterior de `main` ni E0 |
| **E0** | Documentar paridad y evaluar motores con mediciones T1–T6; sin `src/` | No es implementación ni autorización de E1 |
| **E1** | Tras aprobación de E0, extracción explícita de filas/columnas, vista previa de 20, progreso/cancelación; base #57 si no está fusionado | No edita el original ni garantiza que el extracto quepa en memoria |
| **L3** | Capa puntual + diario + guardado atómico + recuperación, conflictos, espacio y cancelación sobre L2 | No se reemplaza por «exporta una copia»; sigue pendiente en el producto |
| **E2 / L4** | Buscar en flujo, resultados paginados e ir a fila | Un filtro de extracción no sustituye búsqueda global |
| **E3 / L4 + L6** | Reemplazar sobre copia/versión nueva con vista previa y vuelta a versión anterior | No promete cambio masivo de 10 GiB; anomalía RFC R12 abierta |
| **L5** | Filtro/orden como vistas de identificadores en disco; estadísticas por recorrido y orden externo | No almacenar todos los ordinales/únicos en RAM sin presupuesto |
| **L6** | Transformaciones masivas y versiones; política de retención/disco | No crear una copia por cada filtro ni retener datos indefinidamente |
| **L7** | Altas/bajas de filas/columnas y encabezados con capa/versión; reconstruir índice | No equiparar una prueba de superposición con integración de todas las acciones |
| **L8** | SQL/gráficos grandes y decisión de motor; respetar compuerta RFC §7.4 | No adoptar DuckDB nativo por disponer del ejecutable en este Mac |
| **L9** | Durabilidad, Windows/Linux a escala, empaquetado y mediciones aisladas; unificación de rutas si se decide | No anunciar «1 a N» como tamaño ilimitado demostrado |
| **E4** | Inventariar varios archivos y aclarar 2–3 escenarios con el usuario antes de diseñar | Las pestañas o el join de cuatro fuentes no resuelven cualquier flujo multiarquivo |

Los estados de #56/#57/#58 anteriores son la **instantánea de GitHub verificada el 24-oct-2026**; pueden cambiar. No equivalen a instalación verificada ni a CI de la rama E0 o del `main` resultante. La equivalencia de producto M→`36c9976` se comprobó además con el listado de archivos del diff local. Las pruebas ya existentes y las mediciones históricas de L2 están en la [evidencia del SHA G](https://github.com/ruzer/freyalab/blob/b5e379fbaf319fe3a10f4e30379f4173586e762a/docs/evidence/l2-lectura-grande-2026-10-24.md#L34). No se reejecutaron para esta auditoría estática ni se repitieron las comparativas de RFC §6.

## Condiciones de E1 y riesgos que no debe esconder la paridad

1. **Acción explícita y archivo nuevo.** Ubicación, nombre, vida y tratamiento al cerrar requieren la decisión del usuario antes de E1. No es una copia automática al filtrar. No guardar sobre la fuente ni otro documento abierto.
2. **Un extracto puede seguir siendo grande.** Solo vuelve a la ruta editable si cumple bytes, celdas y registro; el límite de 200 columnas de transformaciones/analítica y el de cardinalidad de perfiles siguen independientes. Un subset no da acceso automático a todas las funciones.
3. **Origen coherente.** Conservar referencia a la fuente, huella/revisión elegida, encabezados y condiciones/columnas, N extraídas de M originales. Distinguir archivo en disco, cambios pendientes, muestra y extracto completo. La revisión numérica de una pestaña no es por sí sola una versión persistente del archivo externo.
4. **Semántica de valores.** Ceros iniciales, IDs largos, Unicode, multilínea, comillas y filas irregulares no se convierten automáticamente. Una proyección de columnas requiere decidir cómo representar campos ausentes; CSV rectangular no distingue siempre ausente de vacío. E0 debe verificarlo y declarar normalizaciones, no asumir equivalencia por coincidir un conteo.
5. **Fidelidad de bytes y valores son pruebas distintas.** Conservar el original por SHA-256 no prueba que el extracto preserve sus datos. Seleccionar todas las columnas permite copiar registros originales; proyectarlas o editar un campo cambia el registro. Comprobar campos y bytes conservables por separado, incluido BOM/codificación y salto final.
6. **Muestra de vista previa.** Las primeras 20 coincidencias son una vista previa parcial, nunca «el extracto completo». Se puede detener temprano para mostrarlas; el recuento final y la extracción completa requieren recorrer el alcance aprobado. Cancelar elimina el temporal y no publica un archivo parcial.
7. **Sin truncado silencioso.** Cero coincidencias debe explicarse; un motor que rechace una fila/codificación no debe descartarla y continuar como si la salida fuera completa. Registrar el error, no producir resultados aparentes.
8. **Reversibilidad adecuada.** Historial del extracto pequeño, diario del grande y versiones masivas son mecanismos distintos. Editar una copia no implementa el deshacer del original. Aplicar de vuelta al origen es otra acción y no está autorizada por E1.
9. **Seguridad y formato.** Reutilizar validación de condiciones/identificadores y autorización de rutas; no interpolar valores en SQL, no ejecutar contenido de celdas ni habilitar acceso externo del motor. Una copia persistente conserva datos sensibles: limpieza y tamaño deben ser visibles.
10. **Evidencia antes de cambiar estrategia.** Las cifras de RFC §6 se citan como históricas; E0 medirá tareas distintas con Python `csv` como oráculo y motores disponibles. No hay nuevas cifras de tiempo/RSS en E0.1. Las decisiones L2–L7 del RFC siguen vigentes salvo cambio posterior justificado en E0.4 y aprobado.

## Cobertura de verificación para las futuras entregas

La matriz exige verificar cada vía compartida (barra/menú/paleta/atajo) sin duplicar su lógica. Base de pruebas existentes: `table-engine`, `table-ordering`, `table-range`, `table-range-cancellation`, `table-structure`, `table-selection-statistics`, `column-analysis`, `sql-source`, `charts`, exportación, transacciones de documentos y recuperación; E2E de búsqueda, estructura, orden, análisis y gráficos. En G se añaden `tests/large-table.test.ts` y `tests/e2e/large-file.spec.ts`.

E1 añadirá primero pruebas que fallen para extracción, cuatro codificaciones, campos hostiles y proyección; SHA-256 original intacto; cero coincidencias; cancelación sin temporal publicado; extracto pequeño editable/guardable y extracto que sigue grande identificado como tal. L3 mantendrá sus propias pruebas de capa/diario/guardado/recuperación. Un E2E donde aparece una tabla o gráfico no sustituye la igualdad de valores y recuentos frente a un oráculo independiente.

**Resultado de E0.1:** inventario por código y dependencias documentados; edición integral de GB, extracción de producto, adopción de motores, rendimiento nuevo, pruebas nativas y estado CI **no verificados por esta revisión**.
