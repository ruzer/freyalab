# SIM-1c · Información al pulsar Analizar

Base actualizada explícitamente: `main 7bda2e968be6675957d1687a720169cf8f085e7a`. Rama independiente `codex/sim-1c-informacion-al-analizar`; el merge normal `a3c0f06d7b5ff13e25768f12791ccdc304e46c98` incorpora como prerrequisito separado la corrección #189 (`1a639b6`). Su fuente coincide con esa corrección. SIM-1f permanece congelado en otra rama y no forma parte de esta base.

Contrato: sección SIM-1c de [la historia existente](historia-sim1-simplificar-flujos-diseno-para-codex.md), SHA-256 del documento en esta base `767ade59a0c705f37eab2d8e3ad805a402f44250dfe999a83d1f139e3e4dc446`. Se continúa el plan privado de solo lectura ya preparado; este documento fija el alcance previo a interfaz.

## Conducta y reutilización

Pulsar Analizar solicita una sola exploración de Información mediante `explore()` y el motor existentes. Abrir un CSV sigue sin solicitar análisis. La petición inicial espera los metadatos válidos del alcance y se consume una vez, también si termina cancelada, limitada o con error: volver no inicia reintentos automáticos.

Las instancias visitadas de `AnalysisWorkspace` y sus secciones permanecen montadas. Volver a la pestaña con los mismos datos y alcance conserva el resultado. Volver al CSV y paginar la misma vista no cancela una exploración en curso. Se conservan revisión, firma de alcance, `serial`, requestId, cancelación, respuestas tardías, límites, muestra y cobertura parcial.

Tras un resultado, el botón se llama Actualizar información, también después de invalidarlo. Cambiar datos o alcance invalida y muestra su aviso, sin recalcular automáticamente. El primer cálculo no muestra el aviso de datos cambiados. El informe aparece cuando existe un resultado válido; se conservan los informes parciales y sus advertencias. La paginación solo aparece si los resultados visibles superan la página existente de 50 columnas.

Las entradas de barra, paleta/menú, CSV Texto y Proyecto/snapshot siguen convergiendo en `openAnalysis`. Se conserva la confirmación del borrador de Texto, la preparación del conjunto y la fuente protegida. Gráficos conserva sus perfiles al visitarse; Estadísticas y SQL conservan sus botones. El motor sigue teniendo una solicitud activa por documento. El traspaso de una exploración pendiente a otra sección se comprobará antes de escoger cualquier conexión de cancelación necesaria.

## Superficies y pruebas

La conexión mínima alcanza `AnalysisWorkspace.svelte`, `CsvColumnsOverview.svelte` y sus textos es/en; `App.svelte` solo si la ruta convergente lo requiere. Se reutilizan `workspace-tabs`, `csv-analysis-view`, motor y contratos sin introducir otra caché. en-XA usa el generador existente.

Primero se añaden cinco E2E públicas con una fixture sintética independiente de seis columnas. Comprueban apertura sin perfiles, petición única y oráculos de tipos/vacíos/distintos, retorno, invalidación y actualización manual, cancelación/límites/traspaso, informe y paginación. Los espías y bloqueos se instalan antes de Analizar. No se necesita una unitaria que copie un flag local; si cambia un contrato puro, se amplía su prueba existente.

Los consumidores se adaptarán conservando datos y aserciones: `analysis-tab`, `columns-overview`, `analysis-describe`, `project-source`, `project-subset-analysis`, `empty-values` y el helper compartido `panel.ts`. Se conserva expresamente el cálculo mientras se vuelve al CSV y se pagina la misma vista. Las dos expectativas retiradas por la historia son cero perfiles después de Analizar y paginación con dos columnas; sus casos y oráculos de datos se mantienen.

Raíz es la única ejecutora GUI: conserva rojos antes de cambiar interfaz y después captura la base. Durante el bloque se ejecutan los flujos afectados; al cierre de integración, tipos, unitarias completas, E2E completa y build. La CI califica el head congelado y todos los proyectos requeridos. El PR puede ser borrador contra `main`, declarando #189 como prerrequisito mientras corresponda; no hay fusión automática ni transferencia de verdes entre SHAs.

## Siete respuestas del ADR 0021

1. **Does a tool already do this?** `explore()` ya calcula Información, con progreso, cancelación, límites y reportes. Se conecta la petición de entrada y se ajusta su presentación.
2. **Is there a skill we can reuse?** Ponytail, diagnóstico y TDD: aprovechar el plan existente, conservar los oráculos de datos y resolver la conexión mínima después del rojo.
3. **Can it be integrated through CLI, API, or MCP?** Las rutas actuales de `openAnalysis` y `analyzeColumn` bastan; no se añade IPC, CLI ni servicio.
4. **How mature, secure, and maintained is it?** Se usan Svelte y dependencias fijadas, con el motor y validaciones actuales. Se conservan fuente, límites, cancelación y cobertura de muestras.
5. **What maintenance cost does it add?** Estado local mínimo de petición inicial consumida y resultado previo, más etiquetas y pruebas de comportamiento. Los componentes ya montados conservan el resultado.
6. **What is the minimum glue LAB must write?** Conectar entrada visible de Información a la exploración existente una vez y condicionar aviso, informe y paginación en FreyaLab. LAB no cambia.
7. **Does writing our own code add value?** Elimina un clic después de una petición explícita sin cambiar el análisis ni calcular al abrir archivos. No requiere otra caché, motor, cola, dependencia o preferencia.

Estado de este primer commit: alcance previo a implementación. Las nuevas pruebas se escribirán antes del rojo de raíz; no se ha modificado la interfaz de SIM-1c.
