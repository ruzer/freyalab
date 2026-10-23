# SqlService: cola de trabajos (F1 del espacio de trabajo flexible)

**Fecha:** 23 de octubre de 2026 · **Base:** `main` en `bd09caa` · **Rama:** `codex/sql-job-queue`
**Diseño:** [`docs/design/FLEXIBLE-WORKSPACE.md`](https://github.com/ruzer/freyalab/pull/43) (PR #43, en borrador), §3 y §12. Esta entrega es la fase F1: sin interfaz nueva, sin ventana secundaria, sin caché ni reutilización de trabajos.

## Problema

`SqlService` tenía un único hueco `job` y `run()` llamaba a `stop()`. Dos consumidores distintos (por ejemplo «Generar gráfico» y «Exportar resultados») se cancelaban entre sí con «Análisis cancelado.», y el resultado paginable de una consulta desaparecía en cuanto empezaba otra. No era conexión compartida, controlador compartido ni reutilización de identificadores.

## Cambio

- `src/main/job-queue.ts` (nuevo, sin dependencias de Electron): cola con un hueco. Lo interactivo pasa por delante de lo que exporta; dentro de cada prioridad manda el orden de llegada. Cancelar en cola retira la tarea sin arrancarla; cancelar en curso libera su recurso y el hueco sin esperar a que responda; una respuesta tardía se ignora y el recurso no se libera dos veces; `clear()` cancela todo sin que lo que se libera arranque lo que espera (cierre de la aplicación). Una tarea de menor prioridad pasa al frente tras ser adelantada dos veces (dos paneles, SQL y gráfico, pueden tener una consulta interactiva pendiente a la vez), de modo que una exportación no espera indefinidamente.
- `src/main/sql-service.ts`: los trabajos viven en un mapa por `requestId` en lugar de un único hueco. Una solicitud nueva **espera** (con el aviso «En cola: hay otro análisis en curso») en vez de cancelar a la anterior. El tiempo límite de dos minutos cuenta desde que el trabajo empieza a ejecutarse, no desde que se pide. Se conservan los resultados de las tres solicitudes terminadas **usadas más recientemente** para paginarlos. Al cerrar un documento se cancelan sus solicitudes (en cola, en curso o terminadas) y se suelta lo que retenían (`forget`, llamado desde la operación `close`).
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
| Muchas solicitudes a la vez: todas devuelven su resultado | falla (ver validación) | pasa |
| Una exportación en cola no espera indefinidamente | falla (ver validación) | pasa |
| Cerrar un documento cancela sus solicitudes en cola sin esperar su turno | falla (ver validación) | pasa |
| 12 pruebas unitarias de `JobQueue` (orden, prioridad, adelantamiento acotado, cancelación en cola y en curso, fallos, límite, aviso de espera, vaciado) | no existían | pasan |

Resultado con Node 24 en macOS: ver «Validación posterior» más abajo.

## Validación posterior (mismo día)

Una validación de estrés sobre la aplicación real ([`experiments/flexible-workspace/f1-validation.spec.ts`](https://github.com/ruzer/freyalab/pull/46)) encontró tres problemas reproducibles en la primera versión de este PR; los tres se corrigieron aquí, cada uno con su prueba escrita antes:

1. **Un resultado recién calculado podía descartarse al instante.** La poda de resultados conservados ordenaba por orden de llegada de la solicitud, no por uso; con seis solicitudes simultáneas las tres últimas fallaban con «El resultado ya no está disponible». Ahora se ordena por último uso.
2. **Inanición de exportaciones.** Con dos paneles lanzando consultas interactivas una tras otra, la exportación en cola terminaba la última (puesto 12 de 12). Ahora la adelantan como máximo dos (puesto 4 de 12).
3. **Datos de un documento cerrado seguían en memoria** (unos 38 MiB más con un resultado de 10 000 × 200 hasta que llegaran tres análisis nuevos) y sus solicitudes en cola esperaban su turno antes de fallar. Ahora cerrar el documento las cancela y libera la memoria.

## Memoria de los resultados conservados

El esquema permite hasta 10 000 filas × 200 columnas por resultado (con un tope de 8 MiB de texto). Medido en la aplicación real con ese peor caso (valores de 1 a 3 caracteres), tres resultados retenidos suman **+116 MiB** de montículo del proceso principal (~39 MiB cada uno) y vuelven a la línea base (9,1 → 11,1 MiB) al cancelarlos; un resultado que nadie cancela baja a 11,3 MiB al cerrar su documento. Con valores más largos el tope de 8 MiB de texto acota el crecimiento, pero no se midió. En doce ciclos de ejecutar y cancelar el montículo se mantuvo en 11,3 MiB y el número de procesos en 5. El tope de 3 es el número de consumidores simultáneos, no un valor medido contra el uso real.

## Límites

- Concurrencia fija en 1. Aumentarla exige medir memoria (cada motor suma ~396 MiB con 100 000 filas) y no se hace aquí.
- Sin reutilización ni caché de trabajos idénticos: no hay un segundo consumidor visible que la necesite todavía.
- Una consulta larga hace esperar a las demás; el aviso «En cola» lo hace visible y cualquiera puede cancelarse.
- `experiments/flexible-workspace/concurrency.spec.ts` (PR #43) documenta el comportamiento anterior (S1–S4 esperan la cancelación) y dejará de reproducirlo con este cambio.
- No se probó en Windows ni Linux fuera de la CI del PR.
