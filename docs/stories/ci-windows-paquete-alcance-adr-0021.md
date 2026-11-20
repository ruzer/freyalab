# CI · Paquete Windows separado · Alcance y ADR 0021

Base verificada: `9a4aa5d4809968c6a05971d9cc9dc7eff0122f2c`, main vivo al crear la rama `codex/ci-windows-paquete`, 2026-11-19. El workflow es idéntico al de main614 (SHA-256 `91c49ef9fcf5fc7be719902fbd1d06006fc6be103fce201905074027ade352b8`).

## Autorización y problema observado

El propietario respondió explícitamente **«Autorizar el reparto en otro PR»** a la propuesta de dos líneas de matriz para separar el paquete Windows. La excepción autoriza esta entrega independiente; no amplía plazos ni permite recortar pruebas, cambiar otros sistemas o fusionar/publicar sin la revisión prevista.

En [main614, job Windows 135873674588](https://github.com/ruzer/freyalab/actions/runs/44612844417/job/135873674588), GitHub canceló el job tras 60:16 y anotó «The job has exceeded the maximum execution time of 1h0m0s». Las rápidas y perf/solo terminaron; CSV empaquetado quedó incompleto con 91 casos aprobados y uno omitido, sin resumen final. No es una aserción fallida de datos. [PR196, otro head](https://github.com/ruzer/freyalab/actions/runs/44518404831/job/135540526098), había completado Windows en 57:58 con 114 casos empaquetados aprobados y uno omitido.

## Contrato de esta entrega

- Cambiar únicamente las dos listas de matriz de PR con paquete y push a main: Windows principal sin `executable`, más Windows `part: package` con el mismo ejecutable.
- Reutilizar los pasos y condiciones de `part: package` existentes para Mac. El principal conserva tipos, unitarias —incluida la nativa Windows—, experimentos, rápidas y perf/solo. El paquete conserva licencias, construcción explícita, empaquetado y el mismo comando/specs CSV empaquetados.
- Mantener PR sin paquete, schedule, Ubuntu, Mac/Intel, candidate, pasos, aserciones, workers, retries, permisos, dependencias y fórmula de plazos.
- Mantener 60 minutos por job Windows. Separar añade una preparación y un build; puede aumentar el cómputo total y no garantiza una mejora de cola.
- En PR, Gate conserva el resultado agregado de Verify y debe rechazar fallo o cancelación de cualquier parte. Gate no se ejecuta en push a main.

Los seams confirmados son el workflow real, la selección de partes/condiciones y el agregado de Gate. Se reutiliza `tests/helpers/ci-workflow.ts`; no se fabrica otro workflow esperado para hacerlo pasar.

## Siete respuestas del ADR 0021

1. **Herramienta existente.** La matriz de GitHub Actions y `part: package` ya separan la construcción/pruebas Mac. Reutilizar ese contrato en Windows.
2. **Habilidad reutilizable.** TDD sobre la matriz y los pasos reales, con el helper CI existente y oráculos literales de tareas; rojo antes del cambio y ninguna aserción anterior debilitada.
3. **Integración CLI/API/IPC.** Solo la matriz de Actions. Node 24/Vitest evalúan las condiciones y la unión de tareas; no cambia API, IPC ni aplicación.
4. **Madurez, seguridad y licencia.** Sin acciones, dependencias, secretos o permisos nuevos. Se conserva lockfile, entorno de runners y licencia del repositorio.
5. **Costo de mantenimiento.** Un job Windows adicional en los eventos con paquete, con preparación y build propios. Los artefactos se distinguen por `matrix.part`; ningún plazo individual aumenta.
6. **Pegamento mínimo.** Dos líneas de matriz y un archivo nuevo de pruebas que reutiliza el helper; no modificar pasos, selector de áreas, grupos de specs ni candidate.
7. **Valor del código propio.** Hacer verificable que el reparto conserva todas las tareas y que un paquete fallido/cancelado no produce un Gate verde. El ejecutor y la ejecución real siguen siendo responsabilidad de Actions.

## Cierre previsto

Primero registrar el rojo de la unión/partes Windows sobre esta base; después aplicar las dos líneas autorizadas y ejecutar el foco nuevo y las pruebas CI existentes. Tipos/build y cualquier suite completa se coordinan con la única GUI de raíz. La futura CI debe calificar el SHA final y las dos partes Windows; los datos anteriores no se transfieren. Esta fase no lanza GUI ni relanza main614, no publica una rama/PR y no modifica el checkout del propietario.
