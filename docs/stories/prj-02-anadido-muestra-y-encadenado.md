# PRJ-02 · Añadido: paso «muestra» y receta a partir de otra receta

Decisión del propietario (2026-11-10). Se sigue el camino AN-1 → PRJ-01 → PRJ-05 con el stack actual (DuckDB, ECharts, constructor propio), sin adoptar una herramienta de BI. Este añadido amplía el contrato de PRJ-00 (`docs/stories/6-proyectos.md`, fusionado en el PR #75). Debe entrar en el documento como cambio del contrato antes de programar PRJ-02. No toca C5 ni C6: los dos pasos nuevos son deterministas y forman parte de la lista cerrada.

## Por qué
- **Muestra:** con un archivo de 1 GB, el uso habitual es quedarse con las primeras N filas o con una muestra aleatoria para graficar rápido. Hoy las recetas solo tienen `filter`, `select` y `order`.
- **Encadenado:** se quiere sacar un subconjunto de cualquier conjunto. Hoy una receta solo parte de una fuente (`sourceId`). Para sacar un subconjunto de un subconjunto hay que extraerlo antes a un archivo y registrarlo como fuente. Esa vía se conserva; el encadenado la evita cuando no hace falta un archivo.

## 1. Paso `sample`
```json
{"op": "sample", "method": "first", "rows": 10000}
{"op": "sample", "method": "random", "rows": 10000, "seed": 20261110}
{"op": "sample", "method": "random", "percent": 5, "seed": 20261110}
```
- **Orden:** los pasos se aplican en orden. `sample` actúa sobre las filas que llegan a ese punto, así que normalmente va después de `filter`.
- **`first`:** las primeras N filas en el orden que llega.
- **`random` con `rows`:** muestreo de depósito («Algorithm R») con un generador fijado en el contrato (propuesta: SplitMix64 sembrado con `seed`). Devuelve las filas en el orden del archivo, no en el del sorteo. Recorre una sola vez y guarda en memoria solo N filas.
- **`random` con `percent`:** se conserva la fila si `hash(seed, posición física) < umbral`. El número de filas es aproximado, se declara como tal y nunca se presenta como exacto.
- **Determinismo (C5):** misma fuente verificada, misma receta y misma `seed` dan las mismas filas en el mismo orden. La prueba usa un oráculo independiente que implementa el mismo generador.
- **Cobertura (C8):** el resultado declara `coverage.kind:'sample'`, `complete:true` (se recorrió toda la fuente) y `sampling:{method, rows|percent, seed}`. La interfaz dice «Muestra aleatoria: 10.000 de 72.465 filas · semilla 20261110». No debe confundirse con el `sample` de hoy, que significa que solo se examinó una parte: `complete:false`.
- **Límites:** `rows` entre 1 y 1.000.000; `percent` entre 0,01 y 100. Una `seed` entera de 32 bits que la interfaz propone y deja cambiar. «Otra muestra» genera una semilla nueva.

## 2. Receta a partir de otra receta
```json
{"id": "rec2", "name": "Oaxaca, adultos · muestra", "baseRecipeId": "rec1", "steps": [{"op": "sample", "method": "random", "rows": 5000, "seed": 7}]}
```
- **Base:** cada receta tiene exactamente uno de `sourceId` o `baseRecipeId`.
- **Ejecución:** los pasos de la base y luego los propios, como composición lógica. No se escribe ningún archivo intermedio.
- **Procedencia:** el resultado guarda la cadena completa (`chain:["rec1","rec2"]`), la huella de la fuente raíz y la de cada receta.
- **Prohibido:** ciclos y más de 8 niveles. Una receta que forme un ciclo se rechaza completa.
- **Editar una base:** antes de guardar se avisa: «Afecta a 2 recetas: …». Las recetas que dependen de ella quedan como obsoletas hasta volver a ejecutarse (enlaza con PRJ-06).
- **Borrar una base con recetas que dependen de ella:** se bloquea y se dice cuáles son.
- **Cambio de esquema en la fuente raíz (C9):** detiene toda la cadena.

## Diseño UX (dentro del flujo de PRJ-02)
- **Partir de:** «Fuente censo.csv» o «Receta Oaxaca, adultos». Por defecto, la vista desde la que se guarda.
- **Quedarme con:** «Todas las filas», «Las primeras N» o «Una muestra aleatoria de N filas o de un %». La semilla es visible y editable, con el botón «Otra muestra».
- **Estimación:** en archivos grandes se muestra el tamaño estimado del resultado y el tiempo del último recorrido, si se conoce. No se promete un número exacto con `percent`.
- **Gráficos sobre una muestra (PRJ-04):** heredan la cobertura y lo dicen en el pie del gráfico.

## Aceptación (se suma a la de PRJ-02)
1. `first`, `random` con `rows` y `random` con `percent` reproducen exactamente las filas del oráculo, con la misma semilla y en tres ejecuciones.
2. Un archivo de 1 GB con `random` de 10.000 filas termina en una sola pasada, con memoria acotada. Mide y anota tiempo y memoria máxima.
3. Ceros iniciales, identificadores largos, campos multilínea, y ausente frente a vacío sobreviven a la muestra (C7).
4. Una cadena de tres recetas da el mismo resultado que aplicar sus pasos en una sola receta. Un ciclo se rechaza.
5. Editar una base marca como obsoletas las recetas que dependen de ella. Borrar una base con recetas encima se bloquea.
6. La cobertura se muestra igual en la receta, en la extracción (PRJ-03) y en un gráfico (PRJ-04).

## Fuera de alcance
- Muestreo estratificado o ponderado.
- Pasos con expresiones o SQL (C6 sigue vigente).
- Copias en caché ocultas: materializar es siempre una extracción explícita (PRJ-03).
