# SIM-2e · Estadísticas legibles: alcance y decisiones

Base: `d17cc81cd279f3e8a0938077d0b8d55294f05e83` (`main`). Entrega independiente de SIM-1, permitida expresamente por la historia. La historia recibida se copia íntegra en este primer commit; sus decisiones del propietario del 2026-11-18 son la referencia, sin modificar su contenido.

## Alcance cerrado

Se traducen los nombres de las once estadísticas de la matriz de pandas y los textos de `CsvStatistics.svelte`; cada fila conserva su identificador pandas en el título y nombre accesible, junto a la ayuda actual. Pantalla: números enteros sin decimales y no enteros con hasta dos decimales, según el idioma. El título de cada celda y los informes conservan la precisión completa y los resultados originales. El informe usa «Media (mean)» y los equivalentes de cada idioma.

La tabla se ajusta a su contenido. El caption muestra solo el alcance; la revisión se consulta en «Cómo se calcula». El éxito no ocupa una línea encima del resultado; carga, fallo y cobertura parcial siguen anunciándose. No se modifican el motor, cálculos, reglas de pandas, archivos CSV, guardado, IPC, límites, exports, ni ninguna parte de SIM-1 o SIM-2a/b/c/d/f/g.

## Siete respuestas del ADR 0021

1. **Does a tool already do this?** Sí: `describeTable` obtiene la matriz existente; `CsvDescribe` presenta las cifras; `describeReport` genera Markdown; `formatNumber` ya localiza números. Se reutilizan esos mismos resultados, sin una segunda capa de cálculo.
2. **Is there a skill we can reuse?** TDD para fijar el informe y el DOM esperado antes de implementar; accesibilidad para conservar nombres, estado y tabla desplazable; Ponytail para limitar el cambio a presentación y catálogo. Se leen sus instrucciones y se aplican a esas superficies.
3. **Can it be integrated through CLI, API, or MCP?** La presentación consume las operaciones tipadas actuales `stats` y `analyzeColumn`. No añade CLI, MCP, IPC ni capacidad remota.
4. **How mature, secure, and maintained is it?** Se mantienen las versiones y licencias ya bloqueadas. Svelte escapa las etiquetas y los valores; el informe mantiene `literal` y el pipeline seguro de Markdown. No hay dependencias ni nuevas entradas de datos.
5. **What maintenance cost does it add?** Claves de catálogo y pruebas de presentación/reporte; se elimina una excepción de traducción de CsvStatistics. Los contratos y cálculos existentes permanecen iguales.
6. **What is the minimum glue FreyaLab must write?** Vincular cada identificador pandas con su etiqueta traducida, usar el formateador existente con máximo dos decimales y mover revisión/estado a sus lugares ya existentes. Traducir los literales de la vista avanzada sin duplicar la lógica de estadísticas.
7. **Does writing our own code add value?** Sí, adapta la comprensión para estudiantes y profesionales conservando la comparación con pandas y la precisión completa. No sustituye ninguna librería madura ni implementa cálculos propios.

## Pruebas y coordinación

Pruebas primero en el pipeline de `describeReport`, catálogos y la E2E `analysis-describe.spec.ts`; las pruebas de cifras pandas del motor no cambian. Las capturas cubren es/en-XA, claro/oscuro, 1440×900 y 1280×720. La raíz ejecuta toda GUI de forma exclusiva; este worktree prepara las pruebas y conserva evidencia de unitarias sin abrir Electron.

Sin dependencias nuevas; package.json/lockfile intactos. Sin push, PR ni fusión hasta revisión de la raíz.
