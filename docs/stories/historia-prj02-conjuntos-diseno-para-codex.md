# PRJ-02 — Conjuntos: guardar, probar y analizar un subconjunto de una fuente

Público (decisión del propietario, 2026-11-11): análisis de datos para prepa, universidad y maestría, sin complicar. Esta historia define la interfaz de PRJ-02. Aplica el contrato de recetas de PRJ-00 (`docs/stories/6-proyectos.md` §4.4–4.7) y su añadido de muestra y encadenado (`docs/stories/prj-02-anadido-muestra-y-encadenado.md`). Depende de PRJ-01 (proyecto y fuentes protegidas) y de AN-1 (pestaña de análisis).

## Decisiones registradas
- **E0 §8, aprobadas por el propietario el 2026-11-16 tal como se propusieron:**
  - Los resultados se guardan en la carpeta del proyecto, en la ruta que elija la persona, sin carpeta oculta.
  - Nada caduca ni se borra solo.
  - Se comprueba el espacio libre antes de escribir y se avisa, sin cuotas.
  - La receta se aplica a la versión guardada en disco, con las normalizaciones en `provenance.fidelity` y sin «contexto de presencia» en la v1.

  El PR de PRJ-02a las marca como decididas en `6-proyectos.md` §8.
- **Término:** la interfaz dice **«conjunto»**. «Receta» queda para el manifiesto y el código. Es la palabra de un estudiante y la app ya la usa («Trabaja con un conjunto o una muestra»). Los rótulos del añadido («Receta Oaxaca, adultos») pasan a «Conjunto Oaxaca, adultos».

## Historia
Como estudiante con un archivo de muchas filas, quiero guardar con un nombre el subconjunto con el que trabajo: qué filas, qué columnas, en qué orden y, si quiero, una muestra. Así puedo obtenerlo de nuevo exactamente igual y analizarlo sin tocar la fuente ni crear copias.

## Qué hay hoy (main a30988e)
- **Manifiesto:** `recipes` ya existe en `src/shared/project.ts`.
  - Pasos: `filter`, `select`, `order` y `sample` (`first`, o `random` con `rows` o `percent` y `seed`).
  - Cada receta tiene `sourceId` o `baseRecipeId`, además de `sourceSha256`, `semantics` y `createdAt`.
  - El validador ya rechaza ciclos y más de 8 niveles.
  - No hay interfaz ni ejecución.
- **Pestaña «Proyecto»** (`ProjectPanel.svelte`): cada fuente tiene «Abrir», «Analizar», «Mostrar en la carpeta», «Volver a registrar» y «Quitar del proyecto». Una fuente demasiado grande ya avisa «Supera el límite de análisis. Trabaja con un conjunto o una muestra.»
- **Tabla:**
  - «Consulta avanzada»: condiciones Y/O y orden por varias columnas; es solo de vista.
  - En archivos grandes: «Filtrar archivo completo» y «Extraer filas a un archivo nuevo…» (E1, `CsvExtract.svelte`). E1 tiene editor de condiciones, selector de columnas, recuento y vista previa de 100 filas.
- **I0** (`src/shared/operations.ts`): `count`, `preview` y `filter_extract`, con condiciones y columnas. No tiene orden ni muestra.
- **Análisis:**
  - Gráficos ya tienen alcance «todo», «vista filtrada» y «vista guardada» (`CsvCharts.svelte`).
  - El análisis rechaza una fuente de más de 256 MiB antes de leerla, y cuenta filas y celdas antes de filtrar (`analysis-source.ts`).

## Diseño UX

### Dónde se crea un conjunto
- **Desde la tabla de una fuente del proyecto:**
  - Botón «Guardar como conjunto…» en la barra de la tabla, junto a «Consulta avanzada» o «Filtrar archivo completo», y la misma acción en la paleta.
  - Abre el panel «Conjunto» con la vista actual ya puesta: condiciones, modo Y/O y orden.
  - Si hay una búsqueda global o filtros de texto en los encabezados, el panel avisa: «La búsqueda «x» no se guarda en el conjunto. Para incluirla, añádela como condición «Contiene».» No se convierte sola.
  - Si el archivo no es una fuente del proyecto activo, el botón aparece desactivado con el motivo «Añade este archivo como fuente del proyecto para guardar conjuntos.» Sin proyecto activo, no aparece.
- **Desde la pestaña «Proyecto»:** cada fuente y cada conjunto tienen «Nuevo conjunto…». Abre la fuente con el panel vacío y «Partir de» ya elegido.

### Panel «Conjunto»
Se abre dentro de la pestaña de la fuente, en el mismo sitio que «Extraer filas». Solo hay uno abierto a la vez. Reutiliza el editor de condiciones y el selector de columnas de E1.

Los campos van en el orden en que se aplican:
1. **Nombre:** obligatorio, de 1 a 200 caracteres y único en el proyecto, sin distinguir mayúsculas. El foco empieza aquí.
2. **Partir de:** «Fuente censo.csv» o «Conjunto Oaxaca, adultos».
   - Ofrece la fuente de la pestaña y los conjuntos que parten de ella, directa o indirectamente.
   - Al editar, no ofrece el propio conjunto ni los que dependen de él, así que la interfaz nunca forma un ciclo.
   - Si la base es un conjunto, debajo aparece una línea de solo lectura con sus pasos: «Parte de Oaxaca, adultos: Entidad = Oaxaca y Edad ≥ 18 · 3 columnas · Edad ↓».
3. **Filas que cumplen:** el editor de condiciones de E1, con Y/O. Si está vacío, entran todas.
4. **Ordenar por:** columnas, ascendente o descendente, como número o como texto. Es opcional.
5. **Quedarme con:**
   - «Todas las filas» (por defecto).
   - «Las primeras [N]».
   - «Una muestra aleatoria de [N] filas».
   - «Una muestra aleatoria del [p] %».

   La semilla es visible y editable: se propone una al abrir y «Otra muestra» la cambia. La ayuda dice: «La misma semilla da siempre las mismas filas.»
6. **Columnas:** «Todas» o las marcadas, en el orden de la fuente, como en E1. En un conjunto encadenado solo se ofrecen las columnas que conserva su base.

Pie del panel:
- **«Probar»** ejecuta sin guardar y muestra el resultado. Mientras corre, muestra el progreso en bytes leídos y «Cancelar».
- **«Guardar»** crea el conjunto o guarda los cambios.
- **«Cerrar».** Escape también cierra, salvo durante una ejecución. Si hay cambios sin guardar, pregunta «¿Descartar los cambios del conjunto?».
- **Al guardar un conjunto que es base de otros**, primero avisa: «Afecta a 2 conjuntos: Mujeres, muestra; Adultos 2020. Usarán la nueva definición la próxima vez que se ejecuten.» Ofrece «Guardar» y «Cancelar».

### Resultado (al pulsar «Probar» o al abrir un conjunto)
**Recuento y cobertura.** Siguen las frases de §4.6, extendidas para la muestra y la cadena:

| Caso | Frase |
|---|---|
| Sin filtro ni muestra | «Todos los registros (72.465)» |
| Con filtro | «1.250 de 72.465 registros · Entidad = Oaxaca y Edad ≥ 18 · 3 columnas · Edad ↓» |
| Aleatoria por filas | «Muestra aleatoria de 1.000 de las 1.250 filas que cumplen · 72.465 registros examinados · semilla 7» |
| Aleatoria por porcentaje | «Muestra aleatoria de aproximadamente 5 %: 63 de las 1.250 filas que cumplen · … · semilla 7» |
| Primeras N, sin orden antes | «Primeras 100 filas que cumplen · total no determinado». Se dejó de leer al llegar a N. Si ya se había leído todo el archivo, la cobertura es completa |
| Primeras N, después de ordenar | «Las 100 primeras según Edad ↓ de las 1.250 filas que cumplen · 72.465 registros examinados» |
| Se pidieron más filas de las que hay | Añade «Se pidieron 5.000 filas y solo hay 1.250: se toman todas.» |
| Cancelado | «Parcial: 4.000 filas · se canceló tras examinar 30.000 registros». Nunca muestra un «N de M» |
| Ninguna fila | «0 de 7 registros…» y en la vista previa «Ninguna fila cumple las condiciones.» |

**Fuente:**
- «censo.csv · verificada».
- «censo.csv · versión distinta de la usada al guardar el conjunto: se repiten las instrucciones, no necesariamente los mismos valores».

**Vista previa:** hasta 100 filas, en el orden del resultado y con las columnas elegidas. Es de solo lectura.

**Lector de pantalla:** anuncia el progreso y «Conjunto listo: 1.250 filas».

### Sección «Conjuntos» en la pestaña «Proyecto»
- Va debajo de «Fuentes». Si está vacía: «Todavía no hay conjuntos. Abre una fuente, filtra y pulsa «Guardar como conjunto…».»
- Los conjuntos se agrupan bajo su fuente raíz. Los encadenados van sangrados bajo su base, en listas anidadas con hasta 8 niveles.
- **Cada conjunto muestra:**
  - El nombre.
  - Sus pasos en una línea: «Entidad = Oaxaca y Edad ≥ 18 · 3 columnas · muestra de 1.000 · semilla 7».
  - Su estado: «Listo», el estado de la fuente cuando cambió o falta (con el motivo de hoy), «Las columnas de la fuente cambiaron» o «Versión distinta de la fuente», que solo informa.
- **Acciones:**
  - «Abrir»: abre o enfoca la pestaña de la fuente, abre el panel y ejecuta, con progreso y «Cancelar».
  - «Analizar»: llega con PRJ-02b.
  - «Nuevo conjunto…»: crea uno que parte de este. Se desactiva en el nivel 8 con el motivo «Máximo 8 niveles».
  - «Renombrar».
  - «Eliminar»: confirma «¿Eliminar el conjunto «X»? Solo se borra su definición del proyecto; la fuente y los archivos no cambian.» Si otros conjuntos dependen de él, se desactiva con el motivo «No se puede eliminar: Mujeres, muestra parte de este conjunto.»
- **«Quitar del proyecto» en una fuente con conjuntos** se desactiva con el motivo «No se puede quitar: 2 conjuntos parten de esta fuente.» Hoy `changeSources` lo rechaza al validar el manifiesto (`src/main/projects.ts:117`), pero con un error genérico de referencia. La interfaz debe explicarlo antes de que se intente.
- **Proyecto de una versión futura (solo lectura):** se puede listar, abrir y probar. Crear, guardar, renombrar y eliminar se desactivan con el motivo que ya existe.

### PRJ-02b · Analizar un conjunto
- «Analizar» en un conjunto abre la pestaña «Análisis · Oaxaca, adultos». La línea de datos dice «Datos del conjunto Oaxaca, adultos · 1.250 filas · La fuente no se modifica», seguida de la frase de cobertura.
- Información, Estadísticas, Gráficos y SQL usan las filas del conjunto. En Gráficos, el pie dice la cobertura.
- Si la fuente raíz supera los límites actuales del análisis (256 MiB, 2 millones de filas u 8 millones de celdas, contados antes de filtrar), «Analizar» se desactiva con el motivo «La fuente supera el límite de análisis. Extrae las filas a un archivo nuevo y añádelo como fuente.»

### Cuándo no se puede
- **La fuente cambió o falta:** «Probar», «Abrir» y «Analizar» se desactivan con el motivo de la fuente.
- **Cambió el esquema (C9):** se detiene antes de leer filas.
  - Mensaje: «Las columnas de censo.csv cambiaron: la columna 3 era «Edad» y ahora es «Años». Edita el conjunto y elige las columnas de nuevo.»
  - El panel marca con error los campos afectados. No se adivinan renombres.
  - Los conjuntos encadenados sobre ese conjunto también se detienen.
- **Pasos que el panel no edita:** un manifiesto editado a mano puede traer pasos en otro orden o repetidos. Se ejecuta tal cual y el panel lo muestra en solo lectura: «Este conjunto tiene pasos que el panel no edita. Puedes probarlo, renombrarlo o eliminarlo.»

### Textos y accesibilidad
- **Lenguaje de tarea:** la interfaz no dice «receta», «sample» ni «seed»; sí dice «semilla». En inglés, «Subset»; en en-XA, el seudolocalizado de siempre.
- **Interacción:** el panel tiene foco inicial y anuncios. Las listas anidadas se recorren con el teclado y los motivos de desactivación son visibles (patrón `ui.reason`).
- **Paleta:** «Guardar como conjunto» y «Nuevo conjunto». Las encuentran: conjunto, subconjunto, muestra, muestreo, semilla, subset, sample, dataset y receta.

## Contrato técnico
- **Manifiesto:** `recipes` se usa tal como está y `version` no sube.
  - Crear, editar, renombrar y eliminar usan la escritura atómica con detección de conflicto de PRJ-01.
  - `sourceSha256` guarda la huella de la fuente raíz al guardar; además, `semantics: 1`. Editar conserva el `id`.
- **Pasos al guardar desde la interfaz:** siempre en el orden `filter` → `order` → `sample` → `select`, sin los vacíos. Así «primeras N» después de ordenar da los N primeros según el orden. La muestra aleatoria devuelve las filas en el orden en que llegan, que es el del orden si lo hay.
- **Columnas:** por `{position, name}` de la fuente raíz, también en las cadenas.
- **Ejecución:**
  - Un solo recorrido de la versión en disco de la fuente raíz, con la cadena aplanada: primero los pasos de la base y después los propios.
  - Sin archivos intermedios ni caché.
  - El motor propio amplía I0 de forma cerrada con orden y muestra; por ejemplo, pasos en `count` y `preview` u operaciones nuevas. Documenta cuál y por qué.
  - Sin SQL ni expresiones (C6).
- **Memoria acotada:**
  - `random` con `rows` usa un depósito de N filas.
  - `first` sin orden antes deja de leer al llegar a N; la cobertura es `sample` con `complete:false`, salvo que haya llegado al final del archivo.
  - Orden seguido de `first` N, o la vista previa de 100 filas, se resuelven con una selección de los N primeros, con memoria proporcional a N.
  - Contar no necesita ordenar.
- **Semántica v1 del muestreo:** como pide §4.4, queda fijada y documentada antes de programar:
  - SplitMix64 inicializado con `seed` para el depósito.
  - Para `percent`: el hash de (`seed`, posición física en la fuente raíz) y su umbral.
  - Las pruebas usan vectores de referencia escritos a mano, no salidas del propio motor.
- **Identidad de la fuente:**
  - Antes de ejecutar, la comprobación rápida. Si indica un cambio, no se ejecuta.
  - Durante el recorrido se calcula la SHA-256, como en `analysis-source.ts`. Si no coincide con la registrada, el resultado se descarta y la fuente pasa a «cambió».
  - Si coincide con la registrada pero no con `sourceSha256` del conjunto, aparece el aviso de versión distinta.
- **Esquema (C9):** antes de leer filas se comparan las columnas que usa toda la cadena con `source.schema.columns`, por posición y nombre.
- **Cobertura (C8):** el motor devuelve los registros examinados, las filas que llegan a la muestra, las filas finales y si es completa. La interfaz compone las frases. Nunca aparece «N de M» sin haber recorrido toda la fuente.
- **Valores (C7):** se manejan como texto. `00123`, `9007199254740993` y los campos multilínea se conservan, y un campo ausente sigue siendo distinto de uno vacío.
- **IPC:** las peticiones nuevas se validan con zod en `src/main/index.ts`, reutilizando el esquema `step` del manifiesto. La interfaz envía ids de proyecto, fuente y conjunto, nunca rutas.
- **Cancelación:** como en E1; cancelar no escribe nada.
- **Sin dependencias nuevas** (ADR 0021): se reutilizan el motor propio, el validador del manifiesto, las piezas de E1 y el análisis existente.

## Aceptación
Fixture `tests/fixtures/prj02-censo.csv`, con 7 registros. A la fila `00128` le falta Nota.
```
ID,Entidad,Edad,Ingreso,Nota
00123,Oaxaca,34,1200,"línea 1
línea 2"
00124,Oaxaca,17,0,
9007199254740993,Puebla,45,3400,ok
00126,Oaxaca,52,,ok
00127,Chiapas,29,2100,ok
00128,Oaxaca,61,5000
00129,Puebla,15,0,ok
```
1. **Guardar desde la tabla.** Se abre la fuente y en «Consulta avanzada» se pone Entidad «Es igual a» Oaxaca Y Edad «Mayor o igual» 18, con orden Edad descendente como número.
   - «Guardar como conjunto…» abre el panel con eso ya puesto.
   - Con columnas ID, Edad y Nota y el nombre «Oaxaca, adultos», «Probar» dice «3 de 7 registros · …».
   - Las filas, en orden: `00128` (Nota ausente), `00126` y `00123` (con el campo multilínea entero).
   - Al guardar, el manifiesto tiene los pasos `filter`, `order` y `select` en ese orden, `sourceId`, `sourceSha256` de la fuente y `semantics: 1`.
   - La fuente no cambia: mismo hash.
2. **Encadenado.** «Nuevo conjunto…» desde «Oaxaca, adultos», con «Las primeras 2» y el nombre «Dos mayores»:
   - Da `00128` y `00126`, con la cobertura completa de «primeras N después de ordenar».
   - El resultado es igual al de una sola receta con todos los pasos, con las mismas filas y el mismo orden.
   - Su panel solo ofrece las columnas ID, Edad y Nota.
3. **Muestra aleatoria.** 3 filas con semilla 7 desde la fuente:
   - Tres ejecuciones dan las mismas filas, en el orden del archivo, iguales al vector de referencia.
   - «Otra muestra» cambia la semilla.
   - Si se piden 10 filas: «Se pidieron 10 filas y solo hay 7: se toman todas.»
   - Con 50 % y semilla 7 coincide con su vector de referencia y la frase dice «aproximadamente».
4. **Primeras N sin orden.** «Las primeras 2» sin orden da `00123` y `00124` y dice «total no determinado». Con un archivo de 1 GB solo lee el principio: anota los bytes leídos.
5. **Archivo de 1 GB.** Una muestra aleatoria de 10.000 filas termina en una sola pasada y con memoria acotada. Anota tiempo y memoria máxima en Intel y en ARM. Si se cancela a mitad, dice «Parcial…» y no escribe nada.
6. **Base con dependientes:**
   - Al editar «Oaxaca, adultos», antes de guardar avisa «Afecta a 1 conjunto: Dos mayores».
   - En «Oaxaca, adultos», «Partir de» no ofrece «Dos mayores».
   - «Eliminar» se desactiva en «Oaxaca, adultos», con su motivo.
   - En «Dos mayores», «Eliminar» pide confirmación y solo cambia el manifiesto.
   - «Quitar del proyecto» en la fuente se desactiva con su motivo.
7. **Cambio de esquema.** Si en disco el encabezado `Edad` pasa a `Años` y se vuelve a registrar la fuente:
   - Los dos conjuntos muestran «Las columnas de la fuente cambiaron».
   - «Probar» se detiene antes de leer filas y nombra la columna 3.
   - Elegir de nuevo la columna en el panel y guardar lo resuelve.
8. **Cambio de contenido.** Si cambia una celda en disco sin tocar el encabezado, la fuente pasa a «cambió». Tras volver a registrarla, el conjunto se ejecuta y avisa «versión distinta de la usada al guardar».
9. **Valores, en prueba unitaria del motor.** `00123` y `9007199254740993` salen intactos, el campo multilínea sale entero y la Nota ausente de `00128` sigue siendo distinta de la Nota vacía de `00124`.
10. **Búsqueda global activa.** Al pulsar «Guardar como conjunto…» aparece el aviso y el conjunto no incluye la búsqueda.
11. **Nombres y solo lectura.**
    - Un nombre repetido (sin distinguir mayúsculas) da error en el campo.
    - En un proyecto de versión futura se puede listar, abrir y probar; crear, guardar, renombrar y eliminar se desactivan con el motivo.
12. **Manifiesto editado a mano.** Con pasos en otro orden, se ejecuta tal cual y el panel lo muestra en solo lectura. Un ciclo sigue rechazado por el validador actual.
13. **PRJ-02b.** «Analizar» en «Oaxaca, adultos» abre «Análisis · Oaxaca, adultos» con la línea de cobertura.
    - Información cuenta 3 filas y 3 columnas.
    - Un histograma de Edad usa 34, 52 y 61.
    - Con una fuente de más de 256 MiB, «Analizar» se desactiva con su motivo.
14. **Paleta.** «conjunto», «subconjunto», «muestra», «subset» y «sample» encuentran las acciones.
15. **Teclado y capturas.** Todo se hace con teclado, y el lector de pantalla anuncia progreso y recuento. Capturas en claro y oscuro, en es y en en-XA, a 1440×900 y 1280×720: el panel y la pestaña «Proyecto» con una cadena de 3 niveles.

## Casos límite
- **Encabezados duplicados o vacíos:** se nombran «Columna 4».
- **`percent` de 100:** entran todas las filas, con cobertura de muestra.
- **Proyecto abierto en dos ventanas o manifiesto editado fuera de la app:** aplica el conflicto de escritura de PRJ-01.
- **Más de 100.000 filas recorridas:** muestra progreso y «Cancelar», como en las transformaciones.

## Fuera de alcance
- Exportar el conjunto a un archivo (PRJ-03), los gráficos guardados (PRJ-04), los informes (PRJ-05) y el estado obsoleto con «Volver a ejecutar» (PRJ-06). PRJ-02 no crea resultados, así que nada queda obsoleto. El aviso «Afecta a…» es lo que le toca a PRJ-02 del punto 5 del añadido.
- Analizar la muestra de una fuente de más de 256 MiB sin extraerla. Exige cambiar los límites de E0 §1, y esa decisión es del propietario.
- Muestreo estratificado o ponderado, pasos con expresiones o SQL, y la búsqueda global como paso.
- Aplicar el conjunto a la tabla de la fuente: el resultado se ve en el panel.
- Copias en caché.

## Entrega
Dos PR en borrador, con base `main` y la prueba en rojo primero:
- **PRJ-02a:** incluye lo siguiente y cubre los criterios 1–12, 14 y 15.
  - La semántica v1 del muestreo, documentada.
  - El motor: orden, muestra, cadena, cobertura y huella durante el recorrido.
  - El IPC.
  - El panel «Conjunto» y la sección «Conjuntos».
  - El bloqueo de «Quitar del proyecto».
  - §8 de `6-proyectos.md` marcado como decidido.
  - La copia de esta historia en `docs/stories/`.
- **PRJ-02b:** analizar un conjunto. Cubre los criterios 13 y 15.

Informa:
- SHA.
- Pruebas rojas y verdes, con su salida.
- Capturas.
- Las medidas con 1 GB en Intel y ARM.
- La CI de las tres plataformas y una corrida completa de Intel (sonda o nocturna) sin «retry #1».
