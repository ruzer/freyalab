# AN-2: diferencias entre la historia y el motor actual

Propuesta para revisión, todavía sin implementación. AN-1b y el candidato alpha.3 continúan independientemente.

## Hechos revisados

- La historia supone que `analyzeColumn` ya entrega todos los datos necesarios. Hoy no devuelve mínimo/máximo de fechas. Sus frecuencias incluyen valores vacíos, solo entregan una página de 50 resultados y recortan textos a 256 caracteres.
- La estadística existente cuenta el valor vacío como distinto. El fixture de AN-2 exige `unique=2` para Mixta, excluyendo sus vacíos: no basta con renombrar el campo actual.
- La historia menciona `dateReadCompatible`, que ya no existe. El perfil actual acepta fechas ISO con espacios exteriores mediante la validación compartida.
- La historia dice que solo lectura implica muestra, pero una fuente completa protegida sigue siendo completa. Se mantendrá el metadato canónico del motor, sin volver a esa asociación incorrecta.
- El análisis de frecuencias tiene un límite de 100.000 distintos. El nuevo diseño no debe quitar las estadísticas numéricas que hoy sí se pueden calcular con cardinalidades mayores.

## Contrato propuesto para el nuevo describe

1. Conservar los resultados y la semántica de las estadísticas actuales. La nueva matriz describe es una presentación distinta, sin alterar el CSV.
2. En describe, `count`, `unique`, `top` y `freq` de texto excluyen campos ausentes, vacíos y compuestos solo por espacios. Para los demás valores se compara el texto exacto: `a` y ` a` siguen siendo distintos. El fixture Mixta da count 3, unique 2, top 1, freq 2.
3. Los empates de top se resuelven por la primera aparición en el archivo entre las filas del alcance elegido. Se conserva el valor completo en la información del resultado y el informe; la interfaz puede abreviarlo visualmente.
4. Para fechas, min/max consideran fechas ISO válidas, aceptando espacios exteriores sin cambiar el valor original. Top/freq quedan vacíos siempre en columnas de fecha, de acuerdo con la tabla de aceptación. No se incorporan medias ni percentiles de fechas.
5. Extender únicamente el resumen del motor existente con esos resultados, sin nuevo motor, sin dependencia y con un máximo de dos operaciones por columna. La cardinalidad elevada no bloquea las descriptivas numéricas existentes; los resúmenes exactos no disponibles deben indicarse explícitamente, nunca inventarse o presentarse como completos.
6. Mantener progreso, cancelación, límite de 100 columnas, revisión y diferencia entre muestra, fuente completa y fuente protegida. Los rangos conservan su presentación y sus cálculos actuales.

## Pruebas mínimas antes de implementarlo

Fixture de aceptación; vacíos dominantes; empate; top mayor de 256 caracteres; más de 100.000 valores distintos; fechas con espacios e inválidas; muestra frente a fuente completa protegida; alcance filtrado; cancelación/revisión; 100 columnas y tabla accesible; informe con valores completos.

Esta propuesta requiere cerrar las diferencias semánticas antes de comenzar AN-2. No cambia AN-1b ni alpha.3.
