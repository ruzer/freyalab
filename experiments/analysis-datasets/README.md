# Experimento: una base analítica por versión

Prueba opt-in; no cambia `src/`, dependencias, IPC, interfaz, instaladores ni CI. No es una función disponible para usuarios. Contrasta la propuesta de trabajar con extractos con el flujo actual usando el mismo motor DuckDB-Wasm, no Python.

Desde la raíz, con Node 24 y dependencias ya instaladas:

```sh
npm run build
./node_modules/.bin/tsc -p experiments/analysis-datasets/tsconfig.json --noEmit
./node_modules/.bin/playwright test --config experiments/analysis-datasets/playwright.config.ts
```

En macOS puede anteponerse `caffeinate -i` a la última instrucción durante la prueba para evitar suspensión por inactividad. No iniciar otras suites nativas simultáneamente. Resultados en `test-results/analysis-datasets/`; fixtures y perfil aislado temporales, eliminados al finalizar. Nunca apunta a archivos del usuario.

## Comparación

- **Actual:** tres llamadas productivas a `sqlRun`, cada una con arranque/importación/consulta/cierre y cancelación del resultado ya leído. Se conservan los eventos de preparación y ejecución; no se inventa un desglose de arranque que esos eventos no ofrecen.
- **Congelada:** captura íntegra del documento editable por `tablePage`, revisión constante y sin filtros; `arrowBatches`/`sqlColumns` productivos; una sola carga de `datos`, tres consultas de solo lectura y cierre al terminar. Dos preparaciones CTE con filtros distintos; la primera alimenta estadísticas y agregados para un gráfico. No se añaden `CREATE VIEW`, persistencia ni API nuevas.
- Mismos CSV sintéticos de 3 000 y 100 000 filas, mismas consultas, resultados contrastados con un cálculo independiente de céntimos mediante BigInt. Dos repeticiones, orden actual→congelada y congelada→actual. Resultados de menos de 100 filas para evitar sesgos por paginación.
- El total incluye captura/transferencia/arranque/consultas. La apertura CSV común se registra aparte. Las consultas calientes por sí solas no representan el coste de crear el extracto.
- Memoria: observaciones cada 25 ms de working sets de procesos Electron. Las sumas pueden contabilizar páginas compartidas; no son memoria exclusiva ni pico garantizado. RSS del proceso Playwright antes/después por separado. La captura y Arrow experimentales usan ese proceso adicional; su coste no puede ignorarse.

## Integridad y límites

Comprueba ceros iniciales, ID mayor que el entero seguro, BOM/CRLF, Unicode, campos multilínea y ausente frente a vacío. V1 conserva resultados después de una edición pendiente; una captura explícita V2 refleja la nueva revisión. Antes del cambio externo intencional, el hash original permanece idéntico. Después, la prueba verifica que el análisis conserva intacto el nuevo contenido externo.

La ventana hereda protocolo, partición, bloqueo de red/permisos y runtime de `SqlService`, con sandbox y sin preload/puente. Se prueban mutaciones/lecturas externas rechazadas y recuperación posterior mediante ROLLBACK. `seal()` bloquea configuración, no vuelve inmutables las tablas por sí solo: la disciplina de no cargar después y las consultas READ ONLY son las protecciones de este ensayo.

El cierre rechaza explícitamente una solicitud pendiente (igual que la carrera de cancelación productiva). No demuestra que la consulta costosa haya comenzado su recorrido antes de cerrar, ni que otra consulta pueda sobrevivir en el mismo motor. La reconstrucción posterior se prueba en un motor nuevo.

Validación nativa inicial: macOS ARM64. El chequeo `sandboxed` necesita la adaptación Seccomp ya existente en las pruebas productivas para certificar este experimento en Linux. No se afirma compatibilidad probada del ensayo en otras plataformas.

Estas son instantáneas **efímeras**, no proyectos recuperables. No cubre archivos de GB, muestras, persistencia, recuperación tras caída, concurrencia, cancelación cooperativa del motor compartido ni experiencia con usuarios. La captura por páginas/Playwright es deliberadamente aislada y no se recomienda como ruta productiva. Dos repeticiones permiten observar costes, no publicar garantías de rendimiento.

Evaluación y decisión pendiente en [el análisis de arquitectura](../../docs/ANALYSIS-DATASETS.md).
