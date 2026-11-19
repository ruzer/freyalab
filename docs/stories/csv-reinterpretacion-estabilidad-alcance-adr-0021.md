# CSV · Estabilidad al reinterpretar · Alcance y ADR 0021

Fecha: 2026-11-19. Rama `codex/csv-reinterpretacion-sin-recarga-doble`, base `main 39c2000936f1b03c00daee45bc0a257132fb26ab`, worktree privado de estabilidad. Es un seguimiento de Vacíos, separado de PR193/SIM-1e.

Este documento conserva el alcance decidido en el primer commit `1f97cbe`, anterior al producto. Sus formulaciones condicionales y comprobaciones pendientes describen ese momento histórico. La implementación y sus resultados posteriores se registran en la [evidencia del A/B](../evidence/csv-reinterpretacion-recarga-2026-11-19.md).

## Observación y límite de la evidencia

En main CI `44479652308`, Windows, `tests/e2e/empty-values.spec.ts:367`, caso en-XA, pasó la comprobación de que la acción estaba habilitada; después Enter no abrió el diálogo esperado. El reintento pasó. **No hay pérdida de datos demostrada ni causa histórica probada.**

Raíz reprodujo localmente el mecanismo antes de modificar el producto: la primera lectura real terminó, pasó el guard habilitado y la segunda lectura real de la misma consulta, disparada por el timer, deshabilitó la acción antes de Enter. Tras liberar esa respuesta, la paleta siguió abierta y falló la comprobación original del campo. La traza histórica no observa esa transición y no permite atribuirle con certeza ese fallo; el verde A/B sigue pendiente.

## Alcance potencial mínimo

Si el A/B lo confirma, cancelar únicamente la recarga pendiente programada por el effect que resulte redundante con la recarga explícita de la reinterpretación. Reutilizar `options()`, `tick`, el timer existente y `load()`, sin una capa nueva de coordinación.

Conservar la recarga explícita y sus esperas, la conducta de los otros doce callers de `load`, la cancelación/limpieza existente y los rechazos actuales de reinterpretación. Backend, IPC, datos CSV, selección y comportamiento de las demás acciones permanecen fuera del cambio. No se añade capacidad, dependencia, timer, plazo, retry, caché o workflow.

Las pruebas conservan **todas** sus aserciones, datos, títulos y plazos. No se sustituye Enter por otra acción para ocultar el fallo, ni se interpreta un retry verde como demostración de estabilidad. El A/B debe mantener fuente/build identificados y distinguir reproducido, corregido y pendiente; no transfiere resultados entre fuentes diferentes.

## Siete respuestas del ADR 0021

1. **¿Existe herramienta?** Sí: el handler `options()`, `tick`, ya usado en el componente, el timer del effect y `load()` ya cubren reinterpretación y recarga. Falta comprobar si una programación se duplica y, en ese caso, cancelar solo esa programación.
2. **¿Habilidad reutilizable?** Cambio mínimo completo y reproducción rojo→verde, con raíz como única ejecutora GUI. No se incorpora ninguna herramienta al runtime.
3. **¿CLI, API o IPC?** Bastan los contratos existentes. No se crea operación de backend ni se amplía el puente.
4. **¿Madurez, seguridad y licencia?** Se reutilizan mecanismos internos MIT y Svelte instalado, sin incorporar dependencias. Se preservan validación y errores. La observación de Windows y el A/B local se informan por separado; ninguno demuestra por sí solo la causa histórica.
5. **¿Coste?** Una intervención local sobre el timer existente, si el rojo la justifica, más evidencia y validación de consumidores. Sin dependencias, configuración o excepciones de tiempo nuevas.
6. **¿Pegamento mínimo?** Cancelar la recarga redundante en el límite de reinterpretación, conservando la recarga explícita y los otros doce puntos de entrada. No refactorizar el sistema de carga.
7. **¿Valor del código propio?** Evitar una segunda recarga que el A/B haya demostrado innecesaria, sin cambiar lo que puede hacer la persona ni el significado de sus datos.

## Estado y comprobaciones posteriores

En `1f97cbe` se añadió únicamente documentación de alcance: el mecanismo rojo estaba observado y el verde y la corrección seguían pendientes. Ese estado histórico no describe el head actual. El producto mínimo ya existe en `3e6547c`; tipos, unitarias, build, nuevas regresiones y consumidores tienen resultados registrados en la evidencia enlazada. SHA de publicación y CI siguen pendientes.
