# H15-1 · Alcance y ADR 0021

La primera entrega añade el cálculo por fila a «Transformar documento» en CSV y TSV editables. La vista previa usa todas las filas y los cambios pendientes. «Aplicar» añade valores de texto en un paso reversible y «Guardar» escribe en disco. Si una fila o el encabezado físico es más corto que la posición de inserción, se rechaza antes de aplicar para conservar los campos ausentes. La inserción asistida con ejemplos, las otras entradas al diálogo y las fórmulas entre filas corresponden a H15-2 y H15-3.

1. **Herramienta existente.** DuckDB-Wasm evalúa la expresión y convierte los tipos. FreyaLab ya tiene una ventana aislada de Análisis, transferencia Arrow, nombres SQL de columnas, un diálogo de transformación y guardado atómico.
2. **Skills reutilizadas.** Ponytail orienta la integración hacia esos puntos existentes. TDD verifica las salidas decimales, los rechazos y la ausencia de mutaciones antes de implementar el diálogo.
3. **Integración.** El mismo contrato de vista previa y aplicación del editor recibe `calculate`. La ventana de Análisis devuelve valores por identificador de fila y el motor CSV aplica un cambio en el historial existente.
4. **Madurez, seguridad, mantenimiento y licencia.** Se usan las versiones y licencias ya incluidas. El analizador de DuckDB tokeniza, el motor verifica la expresión escalar y la ventana conserva el bloqueo de archivos externos, red y extensiones. La fórmula se trata como contenido no confiable.
5. **Costo de mantenimiento.** Mantener las conversiones permitidas, los mensajes y las pruebas de límites, integridad y cancelación cuando cambie DuckDB o la serialización CSV. La medición de 200.000 filas en ARM e Intel precede al pulido del diálogo.
6. **Pegamento mínimo.** Añadir una operación al diálogo y al contrato existentes, proyectar las columnas elegidas, recuperar el resultado en lotes y reutilizar el cambio de columna del motor.
7. **Valor del código propio.** FreyaLab conserva la identidad de cada fila, los bytes de los campos intactos, el historial y la decisión de cuándo guardar. DuckDB sigue calculando y validando los tipos de la fórmula.
