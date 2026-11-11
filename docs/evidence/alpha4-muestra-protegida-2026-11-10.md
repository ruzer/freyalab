# Alpha.4 · Alcance de muestra independiente de la protección

Base `7eca50b65d11b3bf573e6958c515ae0c1896105d`. Corrección en `d34a7237353964ff3e806911781d04902ef3a775` y ajuste de sugerencia en `91d4070d80dc39c5fc5e0b85f2f4025896a5c90e`, rama local `codex/alpha4-origen-muestra`.

## Causa y metadatos

`Documents.info()` añade `readonly:true` a las fuentes protegidas y a las que quedan abiertas después de cerrar un proyecto. Esto controla la escritura. El estado de la tabla conserva su alcance real y lo devuelve en `TablePage.sample`; `analyzeColumn()` y `stats()` también devuelven `sample` en sus resultados. Una fuente protegida completa devuelve `sample:false`.

La interfaz usaba `doc.readonly` para decidir si mostrar una muestra, validar el alcance de Información, preparar el informe de columna, perfilar gráficos o permitir su vista filtrada. Por eso una fuente completa aparecía como «Análisis de muestra» y la exploración podía rechazar su propio resultado como si hubiera cambiado.

`csvAnalysisSample()` usa el indicador del motor únicamente cuando `viewMeta.requestId > 0` y la revisión coincide con la del documento. Devuelve `undefined` mientras el alcance se desconoce. El estado inicial usa `requestId:0`, muestra «Alcance por confirmar» y bloquea las operaciones que necesitan confirmar el alcance. El permiso de escritura deja de participar en esta clasificación.

## Perímetro

| Componente | Uso corregido |
|---|---|
| AnalysisWorkspace | Aviso de muestra |
| CsvColumnsOverview | Selector, aviso, validación de vista, contexto del informe y coherencia de resultados |
| CsvStatistics | Aviso y contexto del informe a partir del resultado real |
| CsvColumnAnalysis | Selector, aviso y alcance del informe a partir del resultado real |
| CsvCharts | Perfilado y actualización de archivos pequeños, disponibilidad de vistas, avisos, exportaciones y condición de muestra transmitida a ChartPresets |
| CsvSql | Descripción del origen en memoria o disco |

`TableViewMeta` se pasa como prop de los componentes que no lo recibían. Se reutiliza el contrato existente. El motor, IPC, tipos compartidos, lectura SQL, dependencias y guardas de escritura permanecen fuera del diff. La etiqueta desconocida se añadió a los dos catálogos de idioma.

## Rojo y verde locales

macOS Apple silicon, Node.js 24, perfiles temporales y archivos sintéticos.

| Comprobación | Resultado |
|---|---|
| Unitarias del alcance antes del cambio | 7 fallaron y la prueba previa pasó. Faltaba la clasificación que distinguiera muestras y protección |
| E2E real antes del cambio | La fuente de proyecto completa, de una fila, mostró el aviso «Análisis de muestra». Se esperaba ningún aviso y apareció uno |
| E2E de los estados nuevos | 2/2 pasaron, 6,6 s, cero reintentos |
| Primera regresión conjunta, con la corrección inicial | 7/8 pasaron; AN-1a detectó que «Crear gráfico» se habilitaba antes de perfilar las columnas |
| E2E conjunta final, con `91d4070` | 8/8 pasaron, 21,0 s, cero reintentos |
| Unitarias enfocadas finales, con `91d4070` | 33/33 pasaron, 1,31 s |
| Unitarias completas, con `d34a723` | 2.687 pasaron, 1 omitida, 141 archivos, 17,40 s |
| Tipos finales, con `91d4070` | 0 errores y 0 avisos |
| Construcción final, con `91d4070` | Completada |

La omisión corresponde al caso de `tests/package-smoke.test.ts` exclusivo de Windows (`skipIf(process.platform !== 'win32')`). Pandoc real se ejecutó; el binario local 3.12.1 carece de soporte HTTP y la prueba lo registra como límite de la comprobación del sandbox HTTP, sin omitir ese caso. Una primera ejecución del nuevo E2E encontró dos botones «Analizar». El selector se acotó al panel de Proyecto antes de capturar la reproducción roja válida del aviso.

La unitaria distingue fuente completa protegida, muestra normal, muestra protegida, fuente completa de proyecto cerrado, muestra de proyecto cerrado, metadatos pendientes y revisión obsoleta. La E2E usa el registro real de fuentes. Comprueba Información, vista filtrada, Estadísticas, perfil e informe Markdown, Gráficos y etiqueta SQL sobre una fuente completa. Otro recorrido verifica una muestra antes y después de protegerla y después de cerrar su proyecto. Los archivos originales se comparan byte por byte.

La regresión conjunta detectó un estado intermedio nuevo: al desconocer aún el alcance, se detenía el perfilado pero la sugerencia inicial seguía habilitada. La prueba existente de AN-1a comprobó que no se había llamado a `analyzeColumn`. Se corrigió la habilitación de esa sugerencia para esperar tanto el alcance como el fin del perfilado, sin cambiar la prueba. La tanda final incluye los dos casos nuevos y los seis de AN-1a: apertura única, petición explícita, gráficos y exportación, filtros y revisión, cancelación, archivo grande y teclado. Los resultados finales se obtuvieron con el mismo árbol de código que `91d4070`.

Comandos del ciclo rojo y verde:

```sh
npx vitest run tests/csv-analysis-view.test.ts
npx playwright test --project=shell tests/e2e/project-source.spec.ts --grep 'el análisis distingue una fuente completa protegida' --workers=1 --retries=0
npx vitest run tests/csv-analysis-view.test.ts tests/statistics-report.test.ts tests/column-overview-report.test.ts tests/project-sources.test.ts
npx playwright test --project=shell tests/e2e/project-source.spec.ts --grep 'el análisis distingue una fuente completa protegida|una muestra conserva su alcance' --workers=1 --retries=0
npx playwright test --project=shell --project=csv tests/e2e/project-source.spec.ts tests/e2e/analysis-tab.spec.ts --grep 'el análisis distingue una fuente completa protegida|una muestra conserva su alcance|AN-1a' --workers=1 --retries=0
npm test
npm run check
npm run build
```

Los registros completos de esta sesión se conservan localmente en `/private/tmp/freyalab-alpha4-muestra-evidencia.QFsenP/`: `unit-red.log`, `red-ui-canonico.log`, `final-ui.log` (7/8), `final-ui-suggestion.log` (8/8), `unit-completo.log`, `unit-suggestion.log`, `check-suggestion.log` y `build-suggestion.log`.

## Límites de la validación

Pendiente la calificación de CI, empaquetado y validación multiplataforma de alpha.4. No se ejecutó la suite E2E completa ni una medición nueva de rendimiento. Tras el ajuste de una condición en la sugerencia se repitieron las 33 unitarias enfocadas y los ocho E2E; la suite unitaria completa corresponde al commit anterior, como se indica en la tabla. Este cambio no califica un paquete de alpha.3. La incorporación a AN-1b requiere combinar las props de metadatos con sus cambios de disposición y comprobar el resultado integrado.
