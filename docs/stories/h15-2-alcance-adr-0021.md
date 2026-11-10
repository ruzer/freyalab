# H15-2 · Alcance y ADR 0021

La ayuda inserta ejemplos con columnas del CSV abierto y configura su lectura al elegirlos. El menú de encabezado inserta a su derecha y la paleta abre el cálculo al final. La vista previa identifica las columnas y distingue celdas vacías de campos ausentes. La evaluación sigue siendo por fila.

1. **Herramienta existente.** DuckDB-Wasm evalúa las expresiones. FreyaLab ya dispone de perfiles de columna, nombres SQL, paleta, menús y diálogo de transformación.
2. **Skills reutilizadas.** Ponytail limita la integración a esos controles y al perfil actual. TDD comprueba las fórmulas, el catálogo y la inserción a través del diálogo.
3. **Integración.** El ejemplo rellena la expresión y la lectura. La posición ya viaja en la operación `calculate`. La vista previa usa muestras estructuradas para que la interfaz presente los valores en el idioma elegido.
4. **Madurez, seguridad, mantenimiento y licencia.** Se reutilizan las versiones y licencias instaladas. La lista de funciones del diálogo sale de la misma fuente que delimita las llamadas en el validador. DuckDB conserva la validación y el aislamiento de H15-1.
5. **Costo de mantenimiento.** Las funciones se mantienen en un catálogo agrupado. Las pruebas comprueban la lista expuesta y la evaluación de los ejemplos. Los textos se mantienen en español e inglés.
6. **Pegamento mínimo.** Se usa el perfil existente con una sugerencia de decimales, se pasan las posiciones de los menús al diálogo y se reemplaza el JSON cortado de la muestra de cálculo por los valores que presenta la interfaz.
7. **Valor del código propio.** FreyaLab conecta las columnas del documento con ejemplos editables, conserva el significado de los campos ausentes y permite descubrir la sintaxis sin memorizarla.
