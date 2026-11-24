# SIM-3b · Las limpiezas de columna llegan a toda la columna

Rama `codex/sim-3b-columna-completa`, desde `main@3b5e822c`, que incorpora SIM-3a y SIM-3c. El alcance procede del apartado SIM-3b de [la historia SIM-3](historia-sim3-resultados-correctos-diseno-para-codex.md). Los rojos nativos del alcance, las otras tres acciones y el contador obsoleto preceden a sus cambios. El producto `43d0e96fada124d09d3091c4bb9941781a3be9bd` tiene 13 pruebas nuevas y 58 consumidores aprobados en ejecuciones enfocadas separadas, check sin errores/avisos, unitarias completas con dos omisiones y build completado. La [evidencia por fases](../evidence/sim-3b-2026-11-23.md) conserva los límites: no hay todavía suite nativa completa local de SIM-3b ni CI del head final.

## Estado comprobado antes de implementar

- `CsvTable.svelte:119–127` construye la columna con `page.matched` y `pageQuery`. Por tanto, Quitar espacios, Mayúsculas y Minúsculas usan las filas visibles, tanto desde la cabecera como desde Limpiar.
- `CsvRangePreview.svelte:20–28` ya delega la vista previa y la aplicación en las operaciones existentes. Su texto de alcance (`:33`) explica que las filas ocultas no se modifican; las celdas Antes (`:41`) muestran los espacios originales sin marcas.
- Las ayudas `charts.toolbar.column.{trim,upper,lower}Help` conservan «de la vista actual» en `es.json:825–827`.
- Las acciones sobre filas marcadas usan `rowIds` y sus columnas elegidas; las de celda/rango conservan el `TableRange` seleccionado y su consulta. Son contratos distintos y no deben ampliarse.
- Rellenar y eliminar vacíos usan la rama integrada de `CsvTransform.svelte:127–151`, cuyo aviso `empty.scope` explica el documento completo sin N/H. Deduplicar usa el aviso general (`:157`), también sin N/H. No existe un componente CsvEmpty separado. `CsvTransform` recibe `viewQuery`, pero no los metadatos de filas visibles; las tres operaciones ya recorren el documento completo.

## Cambio mínimo implementado

Quitar espacios, Mayúsculas y Minúsculas de **columna** aplican la transformación a todas sus filas de datos, incluidas las ocultas por búsqueda o filtros. Sus dos entradas existentes comparten la misma intención. Rellenar vacíos, Eliminar filas con vacío y Quitar filas duplicadas ya tenían alcance completo y lo conservan, sin reimplementar sus motores; sus diálogos incorporan la misma explicación N/H cuando la intención es una columna singular.

El diálogo muestra «Alcance: toda la columna · {n} filas, también las {h} que oculta el filtro.». Si no hay filas ocultas, muestra «Alcance: toda la columna · {n} filas.». `n` representa todas las filas de datos y `h` las que oculta la vista actual; nunca el encabezado. Las ayudas de columna pierden «de la vista actual».

El total documental N se puede explicar aunque la consulta de vista esté pendiente. H es opcional: solo se publica con la revisión y la consulta coherentes según `csvAnalysisQueryReady`. Mientras H sea desconocido se muestra únicamente el alcance N; no se sustituye por cero ni se bloquea la operación por ese contador. El mismo diálogo actualiza H cuando llega la respuesta real. La revisión estática detectó que el candidato inicial congelaba H desde la vista anterior y que deduplicar desde cabecera no propagaba la intención de columna. Después de sus rojos, las trece pruebas nuevas aprobaron el contexto de columna y la transición N conocido/H desconocido→H real; no se extrapola ese resultado local a otra plataforma o head.

Solo en las celdas **Antes** de la vista previa de columna, los espacios iniciales y finales se representan con `·`. Los espacios interiores y los valores reales no se modifican por esta presentación. Después muestra el resultado de la transformación elegida. Se conservan el recuento de cambios, cancelar sin editar y un único paso de deshacer.

Las limpiezas de filas marcadas y de celda/rango siguen limitadas a su selección. Se conservan orden, filtros, identificadores, encabezados, tipos, cálculos, exportaciones, guardado, límites, cancelación, historial y revisión como mecanismos. Las guardas de edición protegida, ocupada, revisión obsoleta y consulta inválida siguen vigentes. No se añadieron dependencias, API o IPC.

El mapa incluye la intención de columna y ayudas de `CsvTable.svelte`, la presentación de alcance/Antes de `CsvRangePreview.svelte`, la explicación N/H de las tres acciones documentales en `CsvTransform.svelte` y los catálogos es/en; en-XA deriva del mecanismo existente. CsvTable pasa a CsvTransform los `TableViewMeta` existentes y reutiliza `csvAnalysisQueryReady` para no explicar una vista con un recuento obsoleto. Es una prop interna, sin App, API, IPC ni consulta nuevos. La búsqueda de callers encuentra una sola instancia de CsvTransform, en CsvTable, que aporta el nuevo prop requerido. Una transformación general, un cambio a varias columnas o una acción de fila/rango conserva su contrato y no recibe una etiqueta engañosa de columna singular. Si la prueba revela que el motor actual no puede representar la intención completa con sus validaciones, se comunicará el límite antes de ampliar este mapa. No se extenderá globalmente el alcance del rango.

## Siete respuestas del ADR 0021

1. **¿Una herramienta ya lo hace?** Sí: las transformaciones trim/upper/lower, vista previa, recuento, aplicación por revisión y deshacer ya existen. Las limpiezas documentales restantes ya incluyen filas ocultas. Se reutilizan esas capacidades para la intención de columna.
2. **¿Hay una skill reutilizable?** Se reutilizan TDD y los patrones de selección y menús de la casa. Son procedimientos de desarrollo; no se incorpora una herramienta al producto ni se hace necesaria para usarlo.
3. **¿CLI, API o MCP?** La API interna de rango y los callbacks existentes bastan para evaluar la solución mínima. Las entradas visibles llaman a la misma intención; no se crea otro puente, servicio ni ruta de archivos.
4. **¿Madurez, seguridad y mantenimiento?** Se conservan los motores, validaciones, versiones y licencias instalados. Los datos siguen pasando por la revisión y las guardas actuales; una vista previa no escribe y el CSV original solo cambia al guardar.
5. **¿Coste de mantenimiento?** Un único alcance de columna para sus dos entradas, textos traducibles y una representación visual de espacios marginales. Los contratos separados de fila y rango evitan una regla implícita que altere consumidores existentes.
6. **¿Pegamento mínimo?** Expresar la intención completa de columna con la operación existente, pasar los metadatos de vista existentes al diálogo documental y conservar el número de filas ocultas solo como explicación. Reutilizar su comprobación de coherencia, menús, selección, previa, cancelar y deshacer; marcar los espacios marginales exclusivamente al renderizar Antes de la previa de columna.
7. **¿Aporta valor código propio?** Evita que una limpieza de columna deje categorías equivalentes en filas ocultas y explica su alcance antes de confirmar. No aporta valor duplicar el motor ni ampliar las selecciones del usuario.

## Rojo, verde enfocado y aceptación pendiente

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

Raíz ejecutó los seis casos iniciales contra el build anterior al producto: cinco fallos previstos y un control aprobado, 55.5 s. Después ejecutó los casos de trim ordenado y cero visibles: fallaron porque las filas ocultas no se transformaban y la limpieza seguía deshabilitada cuando no había visibles. Estos rojos preceden al cambio de las tres transformaciones.

Los tres casos N/H de rellenar/eliminar/deduplicar y los dos de idioma/teclado fallaron sobre el baseline anterior: faltaba el alcance nuevo y la previa conservaba los valores sin puntos. El caso de consulta pendiente se ejecutó sobre el core de columna completa anterior al guard: mostró nueve ocultas de Puebla antes de recibir la consulta Oaxaca y siguió mostrando nueve cuando ya se veían sus cuatro ID, en vez de las ocho correctas. Falló en tres aserciones del mismo caso. La extensión de las otras tres acciones y el ajuste de coherencia/entrada de columna se aplicaron después de estos rojos. Las trece pruebas nuevas aprobaron en 21,1 s.

Los dos casos de idioma registraron la matriz es/en-XA, claro/oscuro, 1440×900 y 1280×720: ocho imágenes anteriores y ocho posteriores, con cuatro manifiestos. Se copiaron y verificaron sus SHA-256, bytes y dimensiones; la lectura individual de los dieciséis PNG no encontró recortes ni rutas o secretos visibles. Los datos de Carrera conservan su escritura. `EVIDENCE`/`FREYALAB_SIM3B_EVIDENCE` hacen opcional la captura y `FREYALAB_SIM3B_CAPTURE_PHASE=before|after` identifica la fase.

La primera ejecución de 58 consumidores terminó con 56 aprobados y dos expectativas anteriores al nuevo alcance. Raíz adaptó únicamente esos dos casos, sin borrar ninguno: el de columna filtrada ahora exige 5 filas/4 ocultas/3 cambios; el de la barra conserva Ingreso en el título y exige N=240. La repetición final de los 58 aprobó en 1,5 min. Check terminó con 0 errores/0 avisos; unitarias completas, 3191 aprobadas y 2 omitidas en 23,69 s; build completó sus fases. Los límites y artefactos están en la evidencia enlazada. No se ejecutó aún la suite nativa completa local de SIM-3b ni se calificó el head final en CI. No se transfiere a esta entrega el verde de SIM-3a, SIM-3c o SIM-3d. Publicación y fusión siguen en manos del propietario.
