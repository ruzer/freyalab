# Validación de F1 (cola de consultas, PR #44)

**Fecha:** 23 de octubre de 2026 · **Base:** `main` en `3028cbe` (con #42 y #43) · **PR validado:** [#44](https://github.com/ruzer/freyalab/pull/44)
**Entorno:** macOS, Node 24.22.1, Electron 44.9.2, aplicación real construida con `npm run build`.
**Pruebas:** [`experiments/flexible-workspace/f1-validation.spec.ts`](../../experiments/flexible-workspace/f1-validation.spec.ts) (opt-in, no entra en `npm test` ni en la CI) y la suite del propio PR. Mediciones: [`f1-validation-2026-10-23.json`](f1-validation-2026-10-23.json).

## Resultado

La primera versión de #44 **no estaba lista**: la validación encontró tres defectos reproducibles y un cuarto problema ajeno que impide una CI verde. Los tres de #44 se corrigieron en el propio PR (commit `27a4ef0`), cada uno con su prueba escrita antes; el cuarto tiene su propio PR (#45).

| # | Hallazgo | Reproducción (antes) | Después |
|---|---|---|---|
| 1 | **Un resultado recién calculado se descartaba al instante.** La poda de resultados conservados usaba el orden de llegada de la solicitud, no el de uso. | 6 solicitudes simultáneas: 3 ok y 3 con «El resultado ya no está disponible» | 6/6 ok |
| 2 | **Inanición de exportaciones.** Con dos paneles lanzando consultas interactivas una tras otra, la exportación en cola esperaba a que acabaran todas. | La exportación terminó la última: puesto 12 de 12 | Puesto 4 de 12 (la adelantan como máximo dos) |
| 3 | **Datos de un documento cerrado seguían en memoria** y sus solicitudes en cola esperaban su turno antes de fallar. | Con el documento cerrado, el montículo seguía +40,3 MiB sobre la línea base; la solicitud en cola seguía esperando | Montículo 11,3 MiB (línea base 9,1); la solicitud se cancela al cerrar |
| 4 | **`main` no pasa la CI desde que se integró #42** (ver abajo). | 2 pruebas E2E fallan sobre `main` limpio | Corregido en #45 |

## Hallazgo 4: `main` está rojo por la combinación #41 + #42

Las dos pruebas de `tests/e2e/missing-resources.spec.ts` (de #41) buscan un botón llamado `⇧ Exportar ▾`; #42 sustituyó los glifos por iconos y el botón se llama `Exportar`. Cada PR pasaba por separado porque #42 se creó antes de integrar #41. Reproducido sobre `main` limpio (`3028cbe`) y sobre `main` + #44, con `TimeoutError` esperando el botón: **no tiene relación con la cola**. Corrección de dos selectores en [#45](https://github.com/ruzer/freyalab/pull/45).

## Pruebas realizadas

| Prueba | Qué comprueba | Resultado |
|---|---|---|
| V1 | 6 consultas simultáneas sobre 100 000 filas | 6/6 ok, en orden de llegada, ~890 ms cada una, máximo 2 ventanas (principal + 1 motor), 6 motores creados en total |
| V2 | Consulta larga con dos solicitudes detrás | Las dos esperan, ambas reciben el aviso «En cola»; cancelar la larga deja terminar a las siguientes en ~1,1 s |
| V3 | Exportación en cola con consultas interactivas continuas | Puesto 4 de 12 (antes 12 de 12) |
| V4 | 1 activa + 4 en cola; se cancelan 2 en cola y la activa | Las canceladas en cola no crean motor (3 motores en total), el resto avanza en orden, 1 ventana al final |
| V5 | Cerrar la aplicación con 1 activa, 3 en cola, 1 exportación y cancelaciones en carrera | Salida en 161 ms, 0 procesos vivos |
| V6 | Paginar 5 000 filas (50 páginas) mientras la cola trabaja; errores tras editar, cancelar y cerrar | Páginas íntegras y en orden; mensajes claros: «Una fuente cambió…», «El resultado ya no está disponible…» |
| V7 | Memoria con resultados de 10 000 × 200 | 3 resultados: +116 MiB (≈39 MiB cada uno); tras cancelarlos 11,1 MiB (base 9,1); uno huérfano 49,2 MiB → 11,3 MiB al cerrar su documento |
| V7b | 12 ciclos de ejecutar y cancelar un resultado grande | Montículo estable en 11,3 MiB; 5 procesos en todos los ciclos |
| V8 | Documento cerrado o editado con solicitudes en cola o en curso | La solicitud del documento cerrado se cancela; la siguiente corre; tras editar el hueco queda libre |
| V9 | Tiempo límite de 120 s (`F1_LONG=1`) | Falla a los 120,6 s con «superó dos minutos» y la siguiente solicitud corre |

Suite del propio PR tras las correcciones, con Node 24: `npm run check` sin errores; `npm test` 205; `npx playwright test` 121/121. Vista previa de integración (`main` + #45 + #44): ver el estado del PR.

## Riesgos investigados

| Riesgo pedido | Conclusión |
|---|---|
| Inanición de exportaciones | **Confirmado y corregido** (hallazgo 2). |
| Retención excesiva de memoria | Acotada: 3 resultados (~39 MiB cada uno en el peor caso del esquema), sin crecimiento tras 12 ciclos; **la retención tras cerrar un documento era real y se corrigió** (hallazgo 3). Con celdas más largas el tope de 8 MiB de texto acota el crecimiento; no se midió. |
| Resultados de solicitudes obsoletas | **Confirmado y corregido** (hallazgo 1); además, tras editar el documento la paginación falla con un mensaje claro y tras cancelar o cerrar el resultado deja de estar disponible. |
| Documentos cerrados | Corregido (hallazgo 3); un documento cerrado con una solicitud en curso la cancela y libera el motor. |
| Cancelación durante el cierre de la aplicación | Sin problema: 161 ms, 0 procesos, con cancelaciones y exportación en carrera. |

## Límites

macOS únicamente (Windows y Linux solo por la CI); un solo usuario sintético; tiempos orientativos con variación de décimas de segundo; el consumo de memoria de un resultado depende de la longitud de las celdas.
