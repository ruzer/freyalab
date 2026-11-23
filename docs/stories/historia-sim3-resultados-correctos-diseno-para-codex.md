SIM-3 — Resultados correctos y arreglos rápidos, antes de la prueba con estudiantes
Público: el mismo de SIM-2 (análisis de datos para prepa, universidad y maestría, sin complicar).

Qué hace: corrige dos sitios donde un estudiante saca una conclusión falsa sin darse cuenta (orden de números y alcance de las limpiezas) y seis detalles pequeños de menús, cifras y textos. No cambia qué se calcula ni los valores, salvo lo que dice cada parte.
De dónde sale: una evaluación en frío de un experto en UX que no conocía la app (2026-11-23, main 6e70d54, CSV de 60 filas con datos sucios), comprobada después en la app y en el código.
Maqueta: láminas «Bloque 1» y «Bloque 2» del lienzo del propietario. Es privado: esta historia es la referencia completa.
Base: main con #209 (SIM-1h) ya fusionado. 3a, 3b, 3c y 3e tocan CsvTable.svelte, App.svelte o Tree.svelte, que #209 también cambia. Antes de empezar cada parte, comprueba que lo descrito en «Hoy» sigue así y dime si algo cambió.
Por qué
Medido en la app (main 6e70d54) con un CSV de 60 filas, a 1440×900:

«Ordenar de menor a mayor» en Edad da 100, 100, 18, 19… y el 9 al final, aunque Información dice «Numérico». Para ordenar como número hay que encontrar la casilla «Orden numérico» de Filtrar ▾, que vale para todas las columnas a la vez. Ya estaba en la auditoría anterior (UX-08, prioridad alta) y SIM-1 lo dejó fuera.
Con un filtro puesto (36 de 60 filas), tres limpiezas del menú de columna cambian el documento completo y otras tres solo las filas visibles. El experto quitó espacios en Carrera con el filtro puesto y luego Gráficos mostró dos barras «INGENIERÍA»: las filas ocultas conservaron « INGENIERÍA».
En «Nuevo ▾», el selector Tabla/Texto tapa «Tabla CSV». En «Exportar ▾», «#», «⌘K» y «Analizar» se dibujan encima del menú.
«Más estadísticas» muestra «Media 5.52264150943», «Desviación poblacional (n) 0.869100925471» y «11.6666666667 %». La tabla principal de Estadísticas ya redondea a 2 decimales.
Siguen textos internos: «revisión 0», «Cancelar detiene la recogida entre bloques…», «presupuesto de deshacer de 20 MiB», «Esta acción necesita otro contexto», «Componer texto Unicode (NFC)».
La barra de estado dice «1 celdas» y «1 filas seleccionadas», y con un Markdown activo sigue mostrando «2 de 2 filas» del CSV. En el explorador, los nombres salen centrados.
Escribir «>20» en el filtro de Edad da «No hay filas que coincidan.» y un botón «Añadir fila».
Con un filtro activo, «Exportar ▾» propone «Documento completo».
Partes
SIM-3a · Ordenar números como números
Hoy

El orden por encabezado, por el menú de columna y por «Filas y columnas ▾» compara texto salvo que esté marcada la casilla global «Orden numérico» (CsvTable.svelte, bind:checked={numeric}).
Cambio

Al ordenar una columna, se ordena como número si cumple las dos cosas:
su tipo probable es «Numérico», con la misma regla que usa Información (no inventes otra);
no tiene valores con ceros a la izquierda («001»), que son códigos.
Si no las cumple, se ordena como texto, como hoy.
El tipo se averigua al pedir el orden, solo para esa columna. Abrir el CSV sigue sin calcular nada (decisión AN).
Las celdas vacías quedan donde las deja hoy el orden numérico; el PR dice dónde.
Sale la casilla «Orden numérico» de Filtrar ▾. La consulta avanzada conserva su «Numérico exacto», y las recetas de Proyecto conservan su «como número o como texto» (PRJ-02).
Archivos grandes: hoy no se ordenan por columna (sortBy sale si large) y siguen igual.
Prueba en rojo

E2E: una columna con 100, 18 y 9, ordenada de menor a mayor, da 9, 18, 100; de mayor a menor, 100, 18, 9.
E2E: una columna de códigos 001, 002, 010 sigue en orden de texto.
E2E: Filtrar ▾ ya no tiene «Orden numérico».
SIM-3b · Las limpiezas de columna llegan a toda la columna
Hoy

En el menú de columna › Limpiar ▸ y en las opciones de columna de Limpiar ▾:
«Rellenar vacíos…», «Eliminar filas con vacío…» y «Quitar filas duplicadas…» actúan sobre todo el documento y lo dicen («Se aplica a todo el documento, no solo a la vista filtrada»);
«Quitar espacios…», «Mayúsculas…» y «Minúsculas…» actúan sobre las filas visibles: CsvTable.svelte usa «la columna entera de la vista actual» como rango, y el diálogo dice «36 filas de la vista actual. 24 filas ocultas por búsqueda o filtros no se modifican».
Cambio

Las seis actúan sobre toda la columna, también sobre las filas ocultas por la búsqueda o los filtros. Es la regla de LIM-1.
Texto de alcance: «Alcance: toda la columna · {n} filas, también las {h} que oculta el filtro.». La segunda parte solo aparece si {h} > 0.
Las ayudas de la barra («… en toda la columna de la vista actual …») pierden «de la vista actual».
En la columna «Antes» de la vista previa, los espacios al principio y al final se ven como «·». Solo en la vista previa; el dato no cambia.
Se conservan la vista previa, el recuento, cancelar y un solo paso de deshacer.
«Limpiar filas marcadas» y el menú de celda o rango siguen actuando sobre su selección.
Prueba en rojo

E2E: con un filtro que oculta filas, «Quitar espacios…» en una columna también limpia las ocultas. Después, Frecuencias de esa columna muestra un solo «INGENIERÍA», y un ⌘Z lo deja todo como estaba.
E2E: la vista previa muestra «·INGENIERÍA» → «INGENIERÍA».
SIM-3c · Menús, barra de estado y explorador
Hoy y cambio

Menús tapados:
Causa: en style.css, .toolbar (barra superior) tiene z-index:20 y .csv-toolbar[role=toolbar], z-index:30.
Cambio: sube la barra superior por encima, por ejemplo a 40, sin pasar de los diálogos (100) ni del menú contextual (2000).
Plurales: «1 celdas» → «1 celda»; «1 filas seleccionadas» → «1 fila seleccionada». Revisa los demás contadores de la barra.
Barra de estado: con un Markdown, texto o diagrama activo, no se muestran las filas del CSV. Cada barra habla solo del documento activo.
Explorador: los nombres salen centrados aunque .tree-item pide text-align:left. Busca qué lo pisa y alinea a la izquierda con la sangría de su nivel.
Prueba en rojo

E2E a 1440×900 y 1280×720: con «Nuevo ▾» y «Exportar ▾» abiertos, elementFromPoint en el centro de cada opción devuelve esa opción.
Unitaria o E2E de los plurales.
E2E: con un Markdown activo, la barra de estado no contiene «filas».
E2E: en un mismo nivel del árbol, todos los nombres empiezan en la misma x.
SIM-3d · Cifras y textos para estudiantes
Cifras

En «Más estadísticas» (Perfil, Frecuencias, Distribución), los números en pantalla usan el mismo formato que la tabla principal: formatNumber(value,{maximumFractionDigits:2}) de CsvStatistics.svelte. Así 5.52264150943 → 5.52 y 11.6666666667 % → 11.67 %.
El valor exacto sigue en la ayuda (title) y al copiar.
Se mantiene el punto decimal de hoy; la coma sería otra decisión.
Textos (es, en y en-XA)

Hoy	Propuesta
«2. Carrera · Documento completo · 60 filas · revisión 0» (CsvColumnAnalysis.svelte)	«Carrera · documento completo · 60 filas»
El párrafo «Solo consulta. Vacíos incluye… Cancelar detiene la recogida entre bloques; los cálculos matemáticos en curso terminan antes de descartarse.», en cada subvista	«Solo lectura: tu archivo no cambia.» El detalle pasa a un «Cómo se calcula ▸» plegado.
«El cambio supera el presupuesto de deshacer de 20 MiB. El documento se conserva.» (empty.error.undoLimit)	«Este cambio es demasiado grande para poder deshacerlo, así que no se aplicó. Tu documento no cambió.» Si de verdad no se aplica; si se aplica, dime qué pasa y lo redacto.
«Esta acción necesita otro contexto. Revisa su descripción y la selección actual.» (ui.reason.context)	Lo que falta, cuando se sabe: «Haz clic en una celda de la columna que quieres limpiar» (limpiezas de columna de Limpiar ▾), «Marca filas por su número» (acciones de filas). Si no se sabe: «Esta acción no está disponible con la selección actual.»
«Componer texto Unicode (NFC)» (CsvTransform.svelte)	«Unificar letras con acento (NFC)»
Quita también «revisión {n}» donde se muestre al usuario en Gráficos y SQL (charts.trend.memory, sql.ui.memory, sql.ui.sourceMemory): «documento en memoria».
Si un archivo queda sin textos fuera del catálogo, sácalo de pending-files.json.
Prueba en rojo

Unitaria del formato: 5.52264150943 → «5.52»; el title conserva el exacto.
E2E: Perfil de una columna numérica no contiene más de 2 decimales a la vista ni «revisión».
E2E de cada texto nuevo en es y en-XA.
SIM-3e · Filtro sin resultados y exportar lo que se ve
Filtro sin resultados (CsvTable.svelte, .table-empty)

Con un solo filtro de columna: «Ninguna fila de {columna} contiene «{texto}».».
Con varios filtros o búsqueda: «Ninguna fila cumple los filtros.».
Si el texto del filtro empieza por <, > o =, añade: «Este filtro busca texto. Para comparar números usa Filtrar ▾ › Consulta avanzada.».
Botón «Quitar filtros». Con filtro o búsqueda activa no se ofrece «Añadir fila».
Exportar (App.svelte, select de contenido)

Con filtro o búsqueda activa, queda elegida la opción que ya existe «Filas filtradas», con el número: «Filas filtradas (36)». «Documento completo» sigue en la lista.
Sin filtro, como hoy.
Prueba en rojo

E2E: «>20» en un filtro de columna numérica muestra el mensaje y la pista; «Quitar filtros» devuelve todas las filas; no hay «Añadir fila».
E2E: con un filtro que deja 36 de 60 filas, «Exportar ▾» abre con «Filas filtradas (36)».
Reglas comunes a las cinco partes
Una acción dice antes de aplicarse a qué filas llega, y las de un mismo grupo llegan a las mismas.
En pantalla, como mucho 2 decimales; el valor exacto, en la ayuda y al copiar.
Textos para estudiantes: qué pasa y qué hacer, sin términos internos (revisión, bloques, MiB, contexto).
Cada barra y cada aviso hablan solo del documento activo.
Una rama y un PR en borrador por parte, con base main. Sin dependencias nuevas (ADR 0021: siete respuestas en un sim-3x-alcance-adr-0021.md). Prueba en rojo primero.
Textos nuevos en es, en y en-XA.
Si una prueba solo comprueba algo que se quita (la casilla «Orden numérico», el alcance «de la vista actual»), se borra, y el PR dice cuáles y por qué. Si comprueba algo que sigue, se actualiza con los mismos datos.
Fixture nuevo y pequeño (unas 12 filas) si no hay uno que sirva:
ID con ceros a la izquierda;
Carrera con variantes («Ingeniería», «ingeniería», « INGENIERÍA», «psicologia »);
Edad con 9, 18, 100 y un vacío;
Ciudad con vacíos.
Orden y dependencias
3a → 3b → 3e, en serie: las tres tocan CsvTable.svelte.
3c en paralelo con 3a y 3b:
antes de 3e, porque las dos tocan App.svelte;
después del PR de contraste, porque los dos tocan style.css. Si ese PR aún no existe, el contraste puede ir dentro de 3c.
3d en paralelo con todo, salvo que toque los mismos archivos que otra parte abierta.
Después de cada fusión, incorpora main al siguiente PR y espera su CI.
Fuera de alcance
Que «Limpiar ▾» use la columna marcada con su casilla sin hacer clic en una celda.
Reordenar las tarjetas de «Más estadísticas» (resumen arriba, detalles plegados).
Archivos recientes en el inicio, aviso al cerrar un análisis con un gráfico sin exportar y ruta en el aviso de guardado. Los gráficos guardados son PRJ-04.
«Primera letra en mayúscula» y la sugerencia inicial de Gráficos.
Coma decimal y formato regional de números.
Vista Texto de solo lectura: descartada, choca con la vista Texto editable.
Para salir de alfa (no es trabajo de Codex)
Con SIM-1h y SIM-3 en main, el propietario hace la prueba de SIM-2: 5 estudiantes, 5 tareas, sin ayuda. Una tarea que falla en 2 de 5 bloquea la beta.

Entrega
Cada PR informa, en pocas líneas:

SHA.
Pruebas rojas y verdes.
Pruebas borradas, con su motivo.
Capturas: claro y oscuro, es y en-XA, 1440×900 y 1280×720.
CI de las tres plataformas, con el tiempo de cada job de Windows.
No fusiones, no publiques ni actualices la app instalada.
