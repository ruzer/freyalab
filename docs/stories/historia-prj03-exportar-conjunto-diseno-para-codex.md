# PRJ-03 — Exportar un conjunto a un archivo, con su procedencia

Público (decisión del propietario, 2026-11-11): análisis de datos para prepa, universidad y maestría, sin complicar. Esta historia cierra el núcleo de proyectos: PRJ-01, PRJ-02 y PRJ-03. Según `docs/stories/6-proyectos.md` §6 (Riesgos), PRJ-04 a PRJ-07 se programan solo después de revisar ese núcleo.

Aplica:
- `6-proyectos.md`: §4.5 (resultados y procedencia), §4.6 (cobertura), §4.8 (escritura del manifiesto) y §4.9 (retención), con los criterios C4, C7, C8 y C10.
- Las decisiones de E0 §8 aprobadas el 2026-11-16.
- `historia-prj02-conjuntos-diseno-para-codex.md` y la semántica 1 (`prj02-semantica-1.md`).

## Decisiones

Ya tomadas:
- **Ubicación (E0 §8):** el archivo va dentro de la carpeta del proyecto, en la ruta que elija la persona, sin carpeta oculta.
- **Duración (E0 §8):** nada caduca ni se borra solo.
- **Disco (E0 §8):** antes de escribir se comprueba el espacio libre y se avisa, como en E1.
- **C10:** exportar otra vez crea un archivo nuevo. Nunca reemplaza en silencio una exportación anterior.

Aprobadas por el propietario el 2026-11-18:
1. **Ordenar al exportar** sirve si las filas que llegan al orden caben en los límites de edición de la tabla: 50 MiB y 2 millones de celdas (`TABLE_LIMITS`). La única excepción es cuando después vienen «Las primeras N». Si no caben, se detiene sin escribir nada. Hoy «Probar» enseña los 100 primeros sin ordenar todo; exportar necesita todas las filas ordenadas.
2. **Exportar siempre verifica la huella completa de la fuente (C4)**, también en «Las primeras N»: tras obtener las N filas, sigue leyendo solo para calcular el SHA-256, sin interpretar registros. Un archivo exportado es un resultado duradero; «Probar» no lo es.
3. **Campos ausentes (C7):** un campo ausente al final de un registro se queda ausente, y el registro sale más corto. Si en el orden de columnas elegido un campo ausente va antes de uno presente, se escribe vacío y se avisa. No hay otra forma de representarlo en CSV.
4. **No se puede eliminar un conjunto que tiene exportaciones registradas**, igual que un conjunto con dependientes. Hoy el validador del manifiesto rechaza un resultado cuyo `recipeId` no existe (`src/shared/project.ts`).

## Historia
Como estudiante, quiero guardar en un archivo las filas de un conjunto y que el proyecto recuerde de dónde salieron: qué fuente, qué condiciones, cuántas filas de cuántas, qué semilla y qué tan fiel es la copia. Así puedo entregarlo, abrirlo en otra herramienta o analizarlo como fuente nueva cuando el original es demasiado grande.

## Qué hay hoy (main d17cc81)
- **Conjuntos (PRJ-02a/b):**
  - Guardar, probar (recuento, cobertura y 100 filas) y analizar en memoria.
  - El motor (`src/main/recipe-operation.ts`) aplica filtro, orden con selección de los N primeros, muestra y columnas en una pasada, y verifica la huella.
  - No escribe archivos.
- **E1** (`src/main/operations.ts`, `src/main/extract.ts`): «Extraer filas a un archivo nuevo…» en archivos grandes.
  - Condiciones y columnas.
  - Comprueba el espacio libre.
  - Escribe en un temporal y lo renombra.
  - Copia registros idénticos (`bytes`) o los reescribe (`values`), con la lista de normalizaciones.
  - Rechaza destinos abiertos, enlaces simbólicos y extensiones que no sean .csv o .tsv.
  - Con fuentes de proyecto, usa `writeProjectDestination` y `verifyProjectSource`.
  - La procedencia (`ExtractOrigin`) solo se ve mientras el archivo está abierto.
  - Si falta una columna elegida en un registro, **rechaza** la extracción.
- **Manifiesto:** `results` ya existe, con `kind: 'extract'`, `recipeId`, `path`, `bytes`, `sha256`, `createdAt` y `provenance` (`sourceSha256`, `executedAt`, `engine`, `coverage`, `fidelity`, `warnings`, `chain`, `recipeSha256`). Nadie lo escribe todavía.
- **Análisis de un conjunto (PRJ-02b):** si la fuente supera el límite, dice «Extrae las filas a un archivo nuevo y añádelo como fuente.», pero no ofrece cómo hacerlo desde el conjunto.

## Diseño UX

### Dónde se exporta
- **Pestaña «Proyecto»:** «Exportar…» va en el menú de cada conjunto, después de «Analizar» (árbol y menús de PRJ-01c, que va antes que esta historia).
- **Panel «Conjunto»:** «Exportar…» junto a «Probar» y «Guardar». Si hay cambios sin guardar, se desactiva con «Guarda el conjunto antes de exportarlo.»
- **Análisis bloqueado por el límite:** el mensaje pasa a ser «La fuente supera el límite de análisis. Exporta el conjunto a un archivo y añádelo como fuente.», con el botón «Exportar…».
- **Paleta:** «Exportar conjunto». La encuentran: exportar, extraer, guardar como archivo, export, extract y csv.

### Flujo
1. «Exportar…» abre el cuadro de guardar del sistema. Lo abre el proceso principal; la interfaz nunca envía rutas.
   - Empieza en `02_datasets/` si existe en el proyecto y, si no, en la carpeta del proyecto.
   - Nombre propuesto: el del conjunto, con la extensión de la fuente («Oaxaca, adultos.csv»). Los caracteres que Windows no admite se cambian por «-».
2. **Se rechaza el destino, sin escribir, con un motivo concreto**, si está:
   - **Fuera de la carpeta del proyecto:** «Elige una carpeta dentro del proyecto.»
   - **Sobre una fuente del proyecto:** «No se escribe sobre una fuente protegida.»
   - **Sobre una exportación ya registrada:** «Ese archivo ya es una exportación del proyecto. Elige otro nombre: las exportaciones anteriores no se reemplazan.»
   - **Sobre un documento abierto:** el texto actual de E1.
   - **Sobre un enlace simbólico o sin extensión .csv o .tsv:** los textos actuales de E1.

   Si el archivo existe y no es nada de lo anterior, el propio cuadro del sistema pide confirmar el reemplazo.
3. **Espacio libre:** si no alcanza, el texto de E1 y no se escribe.
4. **Exportación en curso:** la fila del conjunto y el panel muestran el avance en bytes leídos y «Cancelar». Cancelar no deja ningún archivo ni temporal, y el manifiesto no cambia: «Se canceló la exportación. No se creó ningún archivo.»
5. **Al terminar:** «Exportado: Oaxaca, adultos.csv · 3 filas», con «Abrir», «Mostrar en la carpeta» y «Añadir como fuente».
   - El lector de pantalla anuncia la misma frase.
   - Si hubo avisos, por ejemplo campos ausentes escritos vacíos, aparecen debajo.

### Archivos exportados en la pestaña «Proyecto»
- **Ubicación:** cada archivo exportado es una fila hija de su conjunto en el árbol de PRJ-01c, con icono de documento y el más reciente primero.
- **La fila:**
  - El nombre del archivo, con la ruta relativa en el título.
  - Detalle: «3 filas · exportado 17 nov, 18:40».
  - En el título también va la frase de procedencia completa (§4.5), la misma que da «Probar»: «3 de 7 registros · Entidad = Oaxaca y Edad ≥ 18 · 3 columnas · valores conservados». Si hay muestra: «Muestra aleatoria de 3 de las 7 filas que cumplen · semilla 7».
- **Estados**, siguiendo PRJ-01c (lo normal no se escribe):
  - Como línea de problema: «El archivo cambió después de exportarlo» (la comprobación rápida no coincide con `bytes` y la huella) y «Falta el archivo».
  - «También es fuente del proyecto» se añade al detalle.

  El estado de obsolescencia, cuando cambian la fuente o el conjunto, es de PRJ-06 y no se muestra aquí.
- **Clic:** abre el archivo.
- **Menú:**
  - «Abrir».
  - «Mostrar en la carpeta».
  - «Añadir como fuente»: registra el archivo con la huella y su progreso, como en PRJ-01, sin pedir el archivo otra vez. Si ya es fuente, se desactiva con el motivo «Ya es fuente del proyecto».
  - Separador y «Quitar del proyecto»: confirma «¿Quitar «X» del proyecto? El archivo sigue en su carpeta; solo se olvida su procedencia.» No hay «Eliminar archivo» en esta entrega (§4.9).
- **«Eliminar» en el menú de un conjunto con exportaciones** se desactiva con el motivo «No se puede eliminar: tiene 2 archivos exportados. Quítalos del proyecto antes.»

### Abrir un archivo exportado
- Se abre como un CSV normal y editable: no es una fuente protegida.
- Arriba muestra la procedencia guardada: «Exportado del conjunto «Oaxaca, adultos» (censo.csv) · 3 de 7 registros · … · valores conservados».
- Si la persona lo modifica, el aviso añade: «Si guardas cambios, el archivo dejará de coincidir con su procedencia.» Tras guardar, su estado pasa a «El archivo cambió después de exportarlo».

### Fidelidad (lo que ve la persona)
- **«bytes conservados»** cuando no se eligieron columnas: cada registro sale idéntico al de la fuente, con las comillas, los campos multilínea y el fin de línea originales.
  - El orden y la muestra no cambian los bytes de un registro.
  - Única normalización posible: si el último registro de la fuente no tenía fin de línea y ya no queda al final, se le añade el de la fuente, y se dice.
- **«valores conservados; formato normalizado»** cuando se eligieron columnas. Se aplican las normalizaciones de E1 y, si las hubo: «1 campo ausente se escribió vacío porque va antes de otro campo».
- **Siempre se conservan** la codificación, el BOM, el delimitador y el fin de línea de la fuente. El encabezado son los nombres de las columnas exportadas; si la fuente no tiene encabezado, no se escribe.

### Cuándo no se puede
- **Fuente en estado «cambió» o «falta», o conjunto no ejecutable:** «Exportar…» se desactiva con el motivo que ya da «Probar».
- **Proyecto de versión futura (solo lectura):** se desactiva con el motivo actual, porque registrar el resultado escribe el manifiesto.
- **La huella de la fuente no coincide al terminar la pasada:** se descarta el temporal y la fuente pasa a «cambió». No queda ningún archivo.
- **Orden sin límite que no cabe:** «Para ordenar al exportar, las filas deben quedar en 50 MiB y 2 millones de celdas. Filtra, toma una muestra o elige «Las primeras» antes de ordenar.» No se escribe nada.

## Contrato técnico
- **Motor:**
  - Amplía `runRecipe`, de forma cerrada, con un modo que escribe todas las filas del resultado; por ejemplo, una operación `recipe_extract`. Documenta cuál y por qué.
  - Reutiliza `prepare`, la semántica 1, el depósito, la selección de los N primeros y la verificación de identidad.
  - Para escribir, reutiliza lo de E1: temporal con `wx` y renombrado, espacio libre, `writeProjectDestination`, validación del destino y serialización `values`.
  - Sin dependencias nuevas.
- **Memoria acotada:**
  - Filtro y porcentaje escriben mientras leen.
  - Una muestra por filas guarda N.
  - Orden seguido de primeras N guarda N.
  - Orden sin límite acumula hasta `TABLE_LIMITS` y se detiene al superarlo (decisión 1).
- **Huella:** siempre completa, calculada en la misma pasada (decisión 2). Si no coincide con la fuente registrada, se descarta el temporal. `provenance.sourceSha256` es la huella verificada.
- **Campos ausentes:** según la decisión 3. Cada campo escrito vacío se cuenta y queda en `fidelity.normalization` y en `warnings`.
- **Registro en el manifiesto:** después de renombrar, con la escritura atómica y el conflicto de PRJ-01.
  - `id`: un UUID nuevo.
  - `kind`: `extract`.
  - `recipeId`.
  - `path`: relativo a la carpeta del proyecto, con `/`.
  - `bytes` y `sha256`: del archivo escrito, calculados al escribir.
  - `createdAt`: igual a `executedAt`.
  - `provenance.engine`: `{app, contract, semantics: 1}`.
  - `coverage`: la misma que daría «Probar».
  - `fidelity`: `{level, normalization, irregularRows}`.
  - `warnings`.
  - `chain`: desde la raíz hasta este conjunto.
  - `recipeSha256`: por cada conjunto de la cadena, el SHA-256 del JSON del conjunto con claves ordenadas y sin espacios. Documenta la forma canónica.
- **Si falla el registro:** por ejemplo, porque el manifiesto cambió fuera. El archivo **no se borra**. Se dice «El archivo se guardó en …, pero no se pudo registrar en el proyecto: …» y se ofrece «Registrar de nuevo», que recalcula su huella antes de escribir.
- **Estado de un resultado:** comprobación rápida (tamaño y fecha) contra lo registrado. «Cambió» si no coincide; «Falta» si no existe. Antes de «Añadir como fuente» se calcula la huella completa.
- **IPC:** las peticiones nuevas se validan con zod. La interfaz envía ids de proyecto, conjunto y resultado; el proceso principal elige y valida la ruta.
- **Cobertura:** una sola función compone la frase para «Probar», la fila del resultado y el aviso del archivo abierto (aceptación 6 del añadido de PRJ-02).
- **E1 para archivos que no son del proyecto** no cambia.

## Aceptación
Fixture `tests/fixtures/prj02-censo.csv`, con los conjuntos de PRJ-02: «Oaxaca, adultos» (Entidad = Oaxaca y Edad ≥ 18, Edad ↓ numérico, columnas ID, Edad y Nota) y «Dos mayores» (parte del anterior, primeras 2).

1. **«Oaxaca, adultos» → `02_datasets/Oaxaca, adultos.csv`:**
   - Escribe exactamente estos bytes, con el fin de línea de la fuente:
     ```
     ID,Edad,Nota
     00128,61
     00126,52,ok
     00123,34,"línea 1
     línea 2"
     ```
     La Nota ausente de `00128` sigue ausente.
   - En el manifiesto queda un resultado `extract` con:
     - La ruta relativa, más `bytes` y `sha256` del archivo.
     - `coverage` `{kind:'filtered', matched:3, scanned:7, total:7, complete:true}`.
     - `fidelity.level:'values'`.
     - `chain` de un elemento, `recipeSha256` y `sourceSha256` igual a la huella de la fuente.
   - La fuente no cambia: mismo hash.
2. **Bytes conservados.** Un conjunto «Oaxaca» con solo el filtro y todas las columnas copia cada registro idéntico al de la fuente: el multilínea, `00124` con su Nota vacía y `00128` corto.
   - Igual con la fuente en UTF-8 con BOM y CRLF, en win1252 y en UTF-16LE: se conservan codificación, BOM y fin de línea.
   - `fidelity.level:'bytes'`.
3. **Ausente antes de presente.** Con columnas en el orden Nota, ID, la fila `00128` sale como `,00128`. El aviso «1 campo ausente se escribió vacío porque va antes de otro campo» aparece al terminar, en la fila del resultado y en `warnings`.
4. **Muestra aleatoria.** 3 filas con semilla 7 da `00124`, `9007199254740993` y `00128`, en el orden del archivo, con `sampling` en la cobertura.
5. **Primeras 2 sin orden.** Da `00123` y `00124`, con la frase «total no determinado» igual que «Probar». Aun así se leen todos los bytes para la huella y `sourceSha256` es la verificada.
6. **Orden que no cabe.** Con el límite bajado por un gancho de prueba, se detiene con el mensaje y no deja ni archivo ni temporal.
7. **Archivo de 1 GB:**
   - Un filtro que deja la mitad de las filas y una muestra aleatoria de 10.000 terminan en una sola pasada, con memoria acotada. Anota tiempo y memoria máxima en Intel y ARM.
   - Si se cancela a mitad, no hay archivo, ni `.tmp`, ni cambios en el manifiesto.
8. **Destinos rechazados**, cada uno con su mensaje: fuera del proyecto, sobre la fuente, sobre una exportación registrada, sobre un documento abierto, un enlace simbólico y una extensión inválida.
   - Si falta espacio (gancho), se avisa y no se escribe.
9. **Pestaña «Proyecto».** La exportación aparece como fila hija de su conjunto, con su detalle y la frase de procedencia en el título.
   - «Abrir» muestra la procedencia arriba del CSV.
   - «Añadir como fuente» muestra el progreso de la huella; el archivo aparece en «Fuentes» y la fila dice «También es fuente del proyecto».
   - «Quitar del proyecto» pide confirmación; el archivo sigue en disco y desaparece del manifiesto.
10. **Cambios fuera de la app.** Si se modifica el archivo exportado, la fila dice «El archivo cambió después de exportarlo» y el aviso al abrirlo lo repite. Si se borra, «Falta el archivo».
11. **Eliminar el conjunto.** Con exportaciones, «Eliminar» se desactiva con el motivo. Tras quitarlas del proyecto, se puede eliminar.
12. **Exportar otra vez (C10):**
    - Exportar «Oaxaca, adultos» con otro nombre deja dos resultados.
    - Elegir la ruta de la primera exportación se rechaza.
13. **Cadena.** Exportar «Dos mayores» da `00128` y `00126`, con `chain` [Oaxaca, adultos; Dos mayores] y `recipeSha256` de ambos.
14. **Misma frase de cobertura en tres sitios:** «Probar», la fila del resultado y el aviso del archivo abierto, comparada como texto en la prueba.
15. **Límite de análisis (PRJ-02b).** Con una fuente por encima del límite, el mensaje de análisis ofrece «Exportar…». Exportar una muestra de 10.000 filas, añadirla como fuente y analizarla funciona de principio a fin.
16. **Bloqueos.** Con un proyecto de versión futura, una fuente que cambió o falta, o cambios sin guardar en el panel, «Exportar…» se desactiva con su motivo.
17. **Teclado y capturas.** Todo se hace con teclado, y el lector de pantalla anuncia el progreso y el resultado. Textos en es, en y en-XA. Capturas en claro y oscuro, a 1440×900 y 1280×720: la fila de exportaciones y el aviso del archivo abierto.

## Casos límite
- **Cero filas:** el archivo tiene solo el encabezado, o queda vacío si la fuente no tiene encabezado. La frase dice «0 de 7 registros».
- **Nombre de conjunto con caracteres no válidos o que termina en punto o espacio:** se cambian por «-» o se quitan, solo en el nombre propuesto.
- **Dos exportaciones a la vez en el mismo proyecto:** se permiten. El registro en el manifiesto se hace en serie.
- **Exportar mientras el archivo destino está abierto en otra app de Windows:** el error del sistema se muestra tal cual, y no queda temporal.

## Fuera de alcance
- Obsolescencia y «Volver a exportar» cuando cambian la fuente o el conjunto (PRJ-06). Gráficos guardados (PRJ-04). Informes (PRJ-05).
- Exportar fuera de la carpeta del proyecto, o en Excel o Parquet.
- «Eliminar archivo» desde la app.
- Contar el total en «Las primeras N». La huella completa no interpreta registros.

## Entrega
Un PR en borrador, con base `main` y la prueba en rojo primero con el fixture.
- Copia esta historia a `docs/stories/`.
- Registra las cuatro decisiones como aprobadas por el propietario el 2026-11-18.
- Escribe el alcance según ADR 0021.

Informa:
- SHA.
- Pruebas rojas y verdes, con su salida.
- La comparación de bytes de los criterios 1 y 2.
- Capturas.
- Las medidas con 1 GB en Intel y ARM.
- La CI de las tres plataformas y una corrida completa de Intel sin «retry #1».
