# SEG-S5a · Recuperación de la cola interna de Mermaid

**Estado: DIFERIDO · solo historia.** El propietario aprobó separarla de S5b. El objetivo vigente del 2026-10-30 (§1.3) autoriza este documento, no un timeout, prototipo, aislamiento o reinicio del motor.

## Problema y prueba roja conservada

Si un trabajo de la FIFO interna de Mermaid queda retenido, dejar de esperar su promesa externa no libera esa cola. Un `Promise.race` por sí solo puede avisar al usuario y dejar bloqueado el siguiente diagrama. Reinicializar mientras el trabajo anterior sigue vivo también puede mezclar configuración y resultados.

Fuente: [PR #101](https://github.com/ruzer/freyalab/pull/101), `docs/evidence/seg-s5a-deferred-2026-10-30/`. Se conservan `README.md`, `proposed-recovery-tests.patch`, `s5a-red.txt` y `s5a-red.exit`.

La salida roja registrada es **exit 1, tres casos propuestos fallidos y tres oráculos A0 existentes aprobados, 354 ms**. El mock representa la FIFO de Mermaid 12.2.0. Los 30 s del caso se avanzaron con reloj falso; no son un nuevo plazo real ni una medición del runner. Los casos propuestos quedaron pendientes al vencer ese plazo o al solicitar el siguiente render. No se incorporaron a la suite activa y los tres A0 originales se conservaron. Esto no acredita una recuperación del motor real.

## Decisión pendiente antes de implementar

Evaluar cómo interrumpir o aislar realmente el trabajo retenido y recuperar el servicio sin que una inicialización nueva compita con el motor antiguo. La historia **no elige** proceso, worker u otro mecanismo, ni añade dependencias.

La decisión deberá demostrar qué ocurre con la FIFO real, quién posee cada recurso y cómo se termina su vida. Si requiere un contrato, permiso, dependencia o alcance no previsto, se detiene para decidirlo. No se resuelve sólo haciendo que una promesa rechace antes.

## Invariantes

- Mantener Mermaid estricto y la sanitización con DOMPurify; la recuperación no autoriza HTML ni SVG sin sanear.
- No cambiar ni perder el código del usuario, los documentos o la última representación válida por agotar la espera.
- Conservar la configuración por operación y los oráculos de concurrencia A0: temas claro/oscuro aislados, validación sin contaminar un render y caché con el tema correcto.
- No guardar errores, SVG parciales o resultados obsoletos en la caché. Una respuesta tardía no sustituye el resultado de la generación vigente.
- No dejar motores, tareas, temporizadores, listeners o recursos huérfanos tras recuperación, cierre o descarte. No iniciar un motor nuevo que siga compartiendo estado mutable con el trabajo atascado.
- No cambiar plazos de CI ni relajar los límites existentes de memoria, cancelación o paridad. No convertir los 30 s propuestos en una decisión ya aprobada.

## Criterios de aceptación futuros

| ID | Resultado exigido |
| --- | --- |
| R1 | Reproducir y conservar el rojo de un render y de un parse retenidos, distinguiendo la espera externa de la ocupación de la FIFO. Verificar además el comportamiento del motor Mermaid real bajo el mecanismo elegido. |
| R2 | La operación retenida termina para su llamador con un estado comprensible y deja intacto el texto. El plazo y su mensaje se acuerdan y documentan antes de declararlos completos. |
| R3 | Un siguiente diagrama válido termina **sin liberar manualmente el trabajo antiguo**, con su propio tema y contenido. Un rechazo rápido que deja bloqueada la cola no cumple. |
| R4 | El trabajo antiguo, si devuelve algo tarde, no altera el SVG actual, los errores, la configuración ni la caché de la generación vigente. |
| R5 | Claro/oscuro, parse/render concurrentes, varios bloques Markdown y cambios rápidos de documento conservan aislamiento y supersesión de resultados. Los tres oráculos A0 siguen intactos. |
| R6 | Cerrar, cancelar o reemplazar una solicitud durante la recuperación no deja recursos huérfanos ni callbacks que modifiquen un documento posterior. Comprobar liberación real y consumo, no sólo una promesa resuelta. |
| R7 | Las rutas individuales y Markdown mantienen seguridad, datos y estados de error existentes; una recuperación no habilita exportar una definición inválida como si fuera actual. |

## Plan de pruebas futuro

Partir de la evidencia roja de #101, sin ejecutarla ni modificarla en esta entrega. En la implementación futura, conservar los tres A0 y usar primero pruebas deterministas para render retenido, parse retenido y sucesor bloqueado. Comprobar el efecto tardío después de que ya haya terminado un sucesor válido.

Después verificar integración con la versión instalada de Mermaid y con la interfaz real: un bloqueo controlado, cambio de tema/documento, varios bloques y cierre durante la recuperación. Registrar que la UI conserva el código, que los resultados antiguos no reaparecen y que no quedan recursos activos. Comparar tiempo y memoria sin ampliar presupuestos. Una prueba con mock de la promesa externa, un timeout aislado o una captura del último SVG no bastan para demostrar recuperación de la FIFO.

No hay implementación, arquitectura elegida, prototipo ni verde de recuperación. El riesgo pendiente es que un trabajo interno retenido siga impidiendo todos los diagramas siguientes aunque el usuario ya haya recibido un aviso.
