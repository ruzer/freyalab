# Experimento: espacio de trabajo flexible

Pruebas opt-in que sustentan [`docs/design/FLEXIBLE-WORKSPACE.md`](../../docs/design/FLEXIBLE-WORKSPACE.md). **No forman parte del producto:** no importan nada de `src/`, no cambian dependencias, IPC, interfaz, instaladores ni CI, y `npm test` / `npm run test:e2e` no las ejecutan (`vitest` solo incluye `tests/**`; Playwright usa `tests/e2e`).

## Contenido

| Archivo | Qué hace |
|---|---|
| `concurrency.spec.ts` | Caja negra sobre la aplicación **real** (`out/main/index.js`): reproduce que `SqlService` cancela entre consumidores (S1–S4) y mide coste del motor (M1), ancho mínimo del panel y latencia del gráfico (M2), columnas visibles con un panel acoplado (M3) y memoria de una segunda ventana (M4). No modifica la aplicación. |
| `f1-validation.spec.ts` | Validación de la cola de F1 (PR #44) sobre la aplicación real: consultas simultáneas y largas, exportaciones en cola, cancelaciones, cierre con trabajos pendientes, paginación, documentos cerrados o editados, memoria y (con `F1_LONG=1`) el tiempo límite de 120 s. Resultados en `F1_RESULTS`. |
| `spike.spec.ts` | Prueba el spike: cola de trabajos, ventana secundaria, contrato IPC, cierre, fallo del renderer y persistencia. |
| `spike/` | Aplicación Electron mínima y desechable: `main.mjs`, preloads, páginas, `contract.mjs` (Zod), `queue.mjs` (cola) y `layout-store.mjs` (persistencia). El motor de consultas se simula con una ventana oculta y un temporizador. |

## Ejecutar

Desde la raíz, con Node 24 y las dependencias ya instaladas.

```sh
# Spike (no necesita compilar la aplicación)
./node_modules/.bin/playwright test --config experiments/flexible-workspace/playwright.config.ts spike.spec.ts

# Validación de F1 (requiere la cola integrada; añade F1_LONG=1 para la prueba de 120 s)
npm run build
./node_modules/.bin/playwright test --config experiments/flexible-workspace/playwright.config.ts f1-validation.spec.ts

# Reproducción y mediciones sobre la aplicación real (documentan el comportamiento ANTERIOR a F1)
npm run build
./node_modules/.bin/playwright test --config experiments/flexible-workspace/playwright.config.ts concurrency.spec.ts

# Tipos de los experimentos
./node_modules/.bin/tsc -p experiments/flexible-workspace/tsconfig.json --noEmit
```

Para guardar los resultados en un archivo fijo: `SPIKE_RESULTS=/ruta/spike.json` y `CONCURRENCY_RESULTS=/ruta/concurrency.json`. Si no se indican, quedan en `test-results/flexible-workspace/`.

No ejecutar a la vez que otras suites nativas: las mediciones de memoria y tiempo son sensibles a la carga. Cada prueba usa un perfil y archivos temporales que se eliminan al terminar; nunca apunta a archivos de la persona usuaria.

## Límites

El motor del spike es simulado; las mediciones con DuckDB real están en `concurrency.spec.ts`. Una sola pantalla y solo macOS. Los valores de prueba (presupuesto de reinicios, tamaño de la caché, regla de ventana visible) no están medidos y se declaran así en el documento de diseño.
