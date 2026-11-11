# AN-2 · Alcance inicial y reutilización

Base de alpha.4: `26a5e1bc5bb24646941a15d4c59bef7f99430685`, AN-1b congelado. El propietario aprobó el contrato de resumen el 2026-11-10. Se conserva su texto sin editar en `an-2-contrato-resumen-aprobado.md`; su redacción «propuesto» corresponde al documento recibido, no a una autorización pendiente.

Esta primera entrega añade únicamente el resumen que falta en el resultado existente de `analyzeColumn`. Reutiliza el perfil, los recuentos y el recorrido de frecuencias. No cambia `unique`, las frecuencias paginadas, los cálculos de `stats`, la interpretación del CSV ni sus bytes. No incluye la interfaz de Información/Estadísticas ni modifica AN-1b mientras se valida.

El resumen nuevo excluye valores ausentes, vacíos y compuestos solo por espacios; compara los demás textos exactamente, conserva el valor completo más frecuente y resuelve empates por la primera fila original. Las fechas usan la validación ISO actual, recortando únicamente espacios exteriores para comparar sus extremos. Las frecuencias anteriores conservan su texto abreviado y su semántica.

La futura presentación numérica utilizará `profileOnly` y `stats`: dos operaciones, sin imponerle el límite de 100.000 distintos de las frecuencias. Para texto/fechas, el análisis completo existente proporciona el resumen exacto; su error de cardinalidad seguirá significando «no disponible», sin inventar resultados. Este bloque no cambia ese límite ni introduce otra operación del puente.

## Siete respuestas del ADR 0021

1. **Does a tool already do this?** `analyzeColumn`, `stats`, `ColumnProfile` y simple-statistics ya proporcionan clasificación y descriptivas. Faltan en su resultado el valor completo de top y los extremos de fechas; se amplía ese resultado, sin añadir un motor.
2. **Is there a skill we can reuse?** Ponytail exige completar la causa con el menor cambio y revisar sus consumidores. TDD fija los resultados mediante el fixture aprobado y casos de borde antes de implementar cada criterio. ECC coding-standards guía tipos explícitos, reutilización y ausencia de mecanismos especulativos.
3. **Can it be integrated through CLI, API, or MCP?** Sí, por la operación tipada `analyzeColumn` ya existente. No se necesita CLI, MCP ni un canal nuevo en la aplicación.
4. **How mature, secure, and maintained is it (release cadence, maintainers, license)?** Se conservan las versiones y licencias bloqueadas. El análisis sigue local, cancelable y sujeto a revisión, límites de tabla y validación del proceso principal. No se agregan dependencias ni acceso a red.
5. **What maintenance cost does it add?** Un tipo pequeño de resumen y su construcción durante el recorrido actual. Las estadísticas y frecuencias anteriores conservan su contrato y sus pruebas. No se duplica el análisis en el renderer.
6. **What is the minimum glue LAB must write?** En FreyaLab, devolver los campos del resumen y probarlos en las interfaces públicas de análisis; después la presentación convertirá esos resultados en una matriz, sin recalcular estadísticas.
7. **Does writing our own code add value?** Conecta resultados ya calculados con el contrato de describe, conservando los textos originales, los ámbitos de análisis y los límites. No reemplaza una librería estadística.

## Interfaces y comprobaciones acordadas

La autorización pide pruebas puras del resumen y pruebas de la ruta numérica existente. Se comprobará `analyzeColumn(rows, indices, request, ensure, header)` con filas sintéticas, sin DOM ni Electron, y `TableEngine.analyzeColumn`/`stats` para cardinalidad e integridad. El resultado esperado proviene del fixture aprobado y cálculos literales independientes.

Perímetro previsto: `src/main/table-analysis.ts`, el tipo de respuesta en `src/shared/types.ts` y pruebas del resumen. Los consumidores de `ColumnAnalysis` y las pruebas existentes se revisan para conservar compatibilidad. La interfaz, los informes, la CI, el empaquetado y la calificación multiplataforma quedan pendientes de la entrega posterior.
