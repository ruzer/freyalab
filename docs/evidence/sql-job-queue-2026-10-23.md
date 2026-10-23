# SqlService: cola de trabajos (F1 del espacio de trabajo flexible)

**Fecha:** 23 de octubre de 2026 · **Base:** `main` en `bd09caa` · **Rama:** `codex/sql-job-queue`
**Diseño:** [`docs/design/FLEXIBLE-WORKSPACE.md`](https://github.com/ruzer/freyalab/pull/43) (PR #43, en borrador), §3 y §12. Esta entrega es la fase F1: sin interfaz nueva, sin ventana secundaria, sin caché ni reutilización de trabajos.

## Problema

`SqlService` tenía un único hueco `job` y `run()` llamaba a `stop()`. Dos consumidores distintos (por ejemplo «Generar gráfico» y «Exportar resultados») se cancelaban entre sí con «Análisis cancelado.», y el resultado paginable de una consulta desaparecía en cuanto empezaba otra. No era conexión compartida, controlador compartido ni reutilización de identificadores.

## Cambio

- `src/main/job-queue.ts` (nuevo, sin dependencias de Electron): cola con un hueco. Lo interactivo pasa por delante de lo que exporta; dentro de cada prioridad manda el orden de llegada. Cancelar en cola retira la tarea sin arrancarla; cancelar en curso libera su recurso y el hueco sin esperar a que responda; una respuesta tardía se ignora y el recurso no se libera dos veces; `clear()` cancela todo sin que lo que se libera arranque lo que espera (cierre de la aplicación).
- `src/main/sql-service.ts`: los trabajos viven en un mapa por `requestId` en lugar de un único hueco. Una solicitud nueva **espera** (con el aviso «En cola: hay otro análisis en curso») en vez de cancelar a la anterior. El tiempo límite de dos minutos cuenta desde que el trabajo empieza a ejecutarse, no desde que se pide. Se conservan los resultados de las tres últimas solicitudes terminadas para paginarlos.
- `src/main/chart-result-export.ts`: la exportación pide prioridad `export`.
- `docs/ARCHITECTURE.md`: una frase.

No cambian las operaciones `sqlRun`, `sqlPage` ni `sqlCancel`, sus esquemas, mensajes, tipos compartidos ni el preload. No hay dependencias nuevas.

## Pruebas

Primero fallaron: `tests/job-queue.test.ts` (módulo inexistente) y 6 de las 7 primeras de `tests/e2e/sql-queue.spec.ts` sobre el código sin cambiar. «Cancelar el análisis en curso libera el motor y deja pasar al siguiente» y «cerrar la aplicación con un análisis en curso y otro en cola» ya pasaban en el código anterior y se conservan como guardas: protegen justo lo que la cola podría romper (un motor huérfano o una salida colgada).

| Prueba | Antes | Después |
|---|---|---|
| Un segundo análisis espera al primero: ninguno se cancela y nunca hay dos motores | falla (el primero se cancelaba) | pasa |
| El resultado paginable sigue disponible mientras se ejecuta otro | falla («ya no está disponible») | pasa |
| Cancelar en cola no toca el que está en curso ni arranca otro motor | falla | pasa |
| Cancelar el análisis en curso libera el motor y deja pasar al siguiente | pasa | pasa |
| Generar un gráfico y exportar sus resultados a la vez (ambos órdenes) | falla | pasa |
| Lo interactivo pasa por delante de una exportación que espera | falla | pasa |
| Solo se conservan los resultados más recientes | falla (solo se conservaba uno) | pasa |
| Cerrar la aplicación con un análisis en curso y otro en cola | pasa | pasa |
| 11 pruebas unitarias de `JobQueue` (orden, prioridad, cancelación en cola y en curso, fallos, límite, aviso de espera, vaciado) | no existían | pasan |

Resultado con Node 24 en macOS: `npm run check` sin errores ni avisos; `npm test` 204 pruebas (193 anteriores + 11); `npx playwright test` 118 pruebas, y las específicas (`sql-queue`, `charts`, `sql`) repetidas tres veces sin fallos.

## Memoria de los resultados conservados

El esquema permite hasta 10 000 filas × 200 columnas por resultado (con un tope de 8 MiB de texto). Medido en Node con ese peor caso, cada resultado ocupa unos **62 MiB** de montículo, por lo que tres conservados serían unos 186 MiB en el extremo teórico; en la práctica el gráfico y la exportación liberan el suyo al terminar y solo el panel SQL conserva uno. El tope de 3 es el número de consumidores simultáneos, no un valor medido contra el uso real.

## Límites

- Concurrencia fija en 1. Aumentarla exige medir memoria (cada motor suma ~396 MiB con 100 000 filas) y no se hace aquí.
- Sin reutilización ni caché de trabajos idénticos: no hay un segundo consumidor visible que la necesite todavía.
- Una consulta larga hace esperar a las demás; el aviso «En cola» lo hace visible y cualquiera puede cancelarse.
- `experiments/flexible-workspace/concurrency.spec.ts` (PR #43) documenta el comportamiento anterior (S1–S4 esperan la cancelación) y dejará de reproducirlo con este cambio.
- No se probó en Windows ni Linux fuera de la CI del PR.
