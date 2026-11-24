# SIM-3b · Las limpiezas de columna llegan a toda la columna

Rama `codex/sim-3b-columna-completa`, desde `main@3b5e822c`, que incorpora SIM-3a y SIM-3c. El alcance procede del apartado SIM-3b de [la historia SIM-3](historia-sim3-resultados-correctos-diseno-para-codex.md). La implementación y su evidencia avanzan por fases: el alcance de las tres transformaciones tiene rojo nativo previo; la unificación del texto de las otras tres conserva su motor y requiere su propio rojo antes de aplicarse.

## Estado comprobado antes de implementar

- `CsvTable.svelte:119–127` construye la columna con `page.matched` y `pageQuery`. Por tanto, Quitar espacios, Mayúsculas y Minúsculas usan las filas visibles, tanto desde la cabecera como desde Limpiar.
- `CsvRangePreview.svelte:20–28` ya delega la vista previa y la aplicación en las operaciones existentes. Su texto de alcance (`:33`) explica que las filas ocultas no se modifican; las celdas Antes (`:41`) muestran los espacios originales sin marcas.
- Las ayudas `charts.toolbar.column.{trim,upper,lower}Help` conservan «de la vista actual» en `es.json:825–827`.
- Las acciones sobre filas marcadas usan `rowIds` y sus columnas elegidas; las de celda/rango conservan el `TableRange` seleccionado y su consulta. Son contratos distintos y no deben ampliarse.
- Rellenar y eliminar vacíos usan la rama integrada de `CsvTransform.svelte:127–151`, cuyo aviso `empty.scope` explica el documento completo sin N/H. Deduplicar usa el aviso general (`:157`), también sin N/H. No existe un componente CsvEmpty separado. `CsvTransform` recibe `viewQuery`, pero no los metadatos de filas visibles; las tres operaciones ya recorren el documento completo.

## Cambio mínimo propuesto

Quitar espacios, Mayúsculas y Minúsculas de **columna** aplicarán la transformación a todas sus filas de datos, incluidas las ocultas por búsqueda o filtros. Sus dos entradas existentes compartirán la misma intención. Rellenar vacíos, Eliminar filas con vacío y Quitar filas duplicadas ya tienen alcance completo y lo conservarán, sin reimplementar sus motores; sus diálogos incorporarán la misma explicación N/H cuando la intención sea una columna singular.

El diálogo mostrará «Alcance: toda la columna · {n} filas, también las {h} que oculta el filtro.». Si no hay filas ocultas, mostrará «Alcance: toda la columna · {n} filas.». `n` representa todas las filas de datos y `h` las que oculta la vista actual; nunca el encabezado. Las ayudas de columna perderán «de la vista actual».

El total documental N se puede explicar aunque la consulta de vista esté pendiente. H es opcional: solo se publica con la revisión y la consulta coherentes según `csvAnalysisQueryReady`. Mientras H sea desconocido se muestra únicamente el alcance N; no se sustituye por cero ni se bloquea la operación por ese contador. El mismo diálogo actualizará H cuando llegue la respuesta real. La revisión estática detectó que el candidato inicial congelaba H desde la vista anterior y que deduplicar desde cabecera no propagaba la intención de columna: ambas correcciones siguen en propuesta privada, pendientes del rojo nativo y de su aplicación; no se presentan aquí como resueltas.

Solo en las celdas **Antes** de la vista previa, los espacios iniciales y finales se representarán con `·`. Los espacios interiores y los valores reales no se modificarán por esta presentación. Después mostrará el resultado de la transformación elegida. Se conservarán el recuento de cambios, cancelar sin editar y un único paso de deshacer.

Las limpiezas de filas marcadas y de celda/rango seguirán limitadas a su selección. No se cambiarán orden, filtros, identificadores, encabezados, tipos, cálculos, exportaciones, guardado, límites, cancelación, historial ni revisión como mecanismos. Las guardas de edición protegida, ocupada, revisión obsoleta y consulta inválida seguirán vigentes. No se añadirán dependencias, API o IPC.

El mapa incluye la intención de columna y ayudas de `CsvTable.svelte`, la presentación de alcance/Antes de `CsvRangePreview.svelte`, la explicación N/H de las tres acciones documentales en `CsvTransform.svelte` y los catálogos es/en; en-XA deriva del mecanismo existente. CsvTable pasará a CsvTransform los `TableViewMeta` existentes y se reutilizará `csvAnalysisQueryReady` para no explicar una vista con un recuento obsoleto. Es una prop interna, sin App, API, IPC ni consulta nuevos. Una transformación general, un cambio a varias columnas o una acción de fila/rango conserva su contrato y no recibe una etiqueta engañosa de columna singular. Si la prueba revela que el motor actual no puede representar la intención completa con sus validaciones, se comunicará el límite antes de ampliar este mapa. No se extenderá globalmente el alcance del rango.

## Siete respuestas del ADR 0021

1. **¿Una herramienta ya lo hace?** Sí: las transformaciones trim/upper/lower, vista previa, recuento, aplicación por revisión y deshacer ya existen. Las limpiezas documentales restantes ya incluyen filas ocultas. Se reutilizan esas capacidades para la intención de columna.
2. **¿Hay una skill reutilizable?** Se reutilizan TDD y los patrones de selección y menús de la casa. Son procedimientos de desarrollo; no se incorpora una herramienta al producto ni se hace necesaria para usarlo.
3. **¿CLI, API o MCP?** La API interna de rango y los callbacks existentes bastan para evaluar la solución mínima. Las entradas visibles llaman a la misma intención; no se crea otro puente, servicio ni ruta de archivos.
4. **¿Madurez, seguridad y mantenimiento?** Se conservan los motores, validaciones, versiones y licencias instalados. Los datos siguen pasando por la revisión y las guardas actuales; una vista previa no escribe y el CSV original solo cambia al guardar.
5. **¿Coste de mantenimiento?** Un único alcance de columna para sus dos entradas, textos traducibles y una representación visual de espacios marginales. Los contratos separados de fila y rango evitan una regla implícita que altere consumidores existentes.
6. **¿Pegamento mínimo?** Expresar la intención completa de columna con la operación existente, pasar los metadatos de vista existentes al diálogo documental y conservar el número de filas ocultas solo como explicación. Reutilizar su comprobación de coherencia, menús, selección, previa, cancelar y deshacer; marcar los espacios marginales exclusivamente al renderizar Antes de la previa de columna.
7. **¿Aporta valor código propio?** Evita que una limpieza de columna deje categorías equivalentes en filas ocultas y explica su alcance antes de confirmar. No aporta valor duplicar el motor ni ampliar las selecciones del usuario.

## Rojo preparado y aceptación pendiente

`tests/e2e/sim3b-column-cleaning.spec.ts` reutiliza `sim-3-students.csv`: doce filas y cuatro columnas. Filtrar Ciudad por Oaxaca deja cuatro filas y oculta ocho; la búsqueda global ofrece un segundo tipo de vista. Los oráculos conservan los ID, Edad y Ciudad originales, comprueban todas las filas mediante el lector existente y comparan los bytes del CSV original.

1. Trim desde Limpiar: alcance 12/8, seis cambios, puntos marginales en Antes y cancelar sin modificar filas, revisión ni archivo.
2. Trim desde la cabecera: aplica también a las ocultas; conserva filtro y orden numérico de Edad; Frecuencias del documento conserva las cuatro categorías exactas, cada una con tres filas, incluida una única entrada `INGENIERÍA`; un deshacer restaura todo.
3. Mayúsculas desde Limpiar con búsqueda: nueve cambios en doce filas, incluidos los ocultos; conserva espacios y las otras columnas; un deshacer.
4. Minúsculas desde la cabecera con filtro: seis cambios en doce filas, incluidos los ocultos; conserva espacios y las otras columnas; un deshacer.
5. Sin filtro: alcance de doce filas sin inventar una parte de filas ocultas; cancelar conserva el documento.
6. Controles de filas marcadas y rango: solo cambian los ID elegidos, conservan las filas ocultas y admiten un deshacer por operación.
7. Cero filas visibles: la cabecera sigue ofreciendo la limpieza de las doce filas; previa12/12 y cancelar conserva filas, revisión, archivo, filtro y orden.
8. Rellenar vacíos desde una columna: el diálogo explica doce filas y ocho ocultas; cancelar no edita.
9. Eliminar filas con vacío desde una columna: el mismo alcance N/H y conservación al cancelar.
10. Quitar duplicados desde una columna: la columna inicial es la correcta, se explica el mismo N/H y cancelar conserva los datos.
11. Consulta pendiente Puebla→Oaxaca: antes del debounce real se explica solo N, sin publicar las nueve ocultas anteriores; al llegar los cuatro ID reales, el mismo diálogo explica ocho ocultas. Cancelar conserva filas, revisión, archivo y filtro.
12. Español: apertura de menús con teclado, alcance 12/8 traducido, puntos marginales y Escape con retorno de foco y datos intactos.
13. en-XA: el mismo contrato con los nombres de menú y el alcance obtenidos del catálogo, sin traducir los datos de Carrera.

Raíz ejecutó los seis casos iniciales contra el build anterior al producto: cinco fallos previstos y un control aprobado, 55.5s. Después ejecutó los casos de trim ordenado y cero visibles: fallaron porque las filas ocultas no se transformaban y la limpieza seguía deshabilitada cuando no había visibles. Estos rojos preceden al cambio de las tres transformaciones. Los tres casos N/H de rellenar/eliminar/deduplicar, la consulta pendiente y los dos casos de idioma/teclado aún no se ejecutaron; la extensión de CsvTransform y las dos correcciones estáticas se mantienen privadas y sin aplicar hasta que raíz capture los rojos correspondientes. No se declara verde del candidato.

Los dos casos de idioma preparan la matriz claro/oscuro a 1440×900 y 1280×720: ocho imágenes por ejecución, dieciséis si se registran las fases antes y después. Solo capturan con `EVIDENCE` o `FREYALAB_SIM3B_EVIDENCE`; sin esa opción verifican el comportamiento sin escribir PNG. `FREYALAB_SIM3B_CAPTURE_PHASE=before|after` identifica la fase, y cada manifiesto registra los textos/muestras observados, SHA-256, bytes y dimensiones reales, con nombres relativos. No se han generado imágenes ni resultados de esa matriz. Después se verificarán consumidores y la aceptación es/en/en-XA completa. Check, unitarias, integración completa, paquete y CI sobre el head final se registrarán como fases reales. No se transfiere a esta entrega el verde de SIM-3a, SIM-3c o SIM-3d. Publicación y fusión siguen en manos del propietario.
