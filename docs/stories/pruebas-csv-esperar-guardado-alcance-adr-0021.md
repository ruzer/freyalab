# Pruebas CSV · Esperar el final visible del guardado

Base verificada mediante fetch explícito, ls-remote y API: `main 23121eda41fb9380c533a25ef86723046b6d7639`. Rama `codex/pruebas-csv-esperar-guardado`, worktree independiente. No se toca el checkout del propietario, LAB, PR cerrados ni ramas de otras entregas.

## Alcance mínimo aprobado

Añadir una sola espera de estado existente, `aria-busy=false` del botón Guardar, antes del clic Tabla en el cuerpo compartido de los tres CSV malformados de `tests/e2e/csv-text.spec.ts`. Conservar todas las comprobaciones de main, bytes, filas, ids, modo y documento anterior. No añadir helpers ni duplicar pruebas. El atributo ya forma parte de la interfaz de U0.

La observación privada ejecutó el handler real de guardado y retuvo únicamente la entrega de su respuesta. Main y disco podían estar limpios mientras Guardar seguía ocupado; el clic prematuro abría la confirmación. Se reprodujo en main anterior y en #183. El guard iniciado antes de liberar la respuesta permaneció pendiente y después permitió la tabla y los mismos datos. Los cuatro controles reales, sus logs y dos capturas se conservan como evidencia, sin incorporar el wrapper a la suite.

Las funciones save, chooseCsvView, updateText y savingActive son textualmente idénticas, mediante AST TypeScript y SHA-256, entre main 711, el control 895 y main 231. El caso público, la configuración de Playwright y el lock tampoco cambiaron entre el control y la base actual. No se repite la auditoría ni se cambia la interpretación del CSV.

## Siete respuestas ADR 0021

1. **¿Existe una herramienta?** Sí: `expect(locator).toHaveAttribute` de Playwright y el estado accesible `aria-busy` que Guardar ya publica. No hace falta otra biblioteca o capacidad.
2. **¿Qué método se reutiliza?** La espera por condición que U0 ya usa, con rojo causal antes del cambio y validación del consumidor real. Se reutiliza el caso de CSV malformados.
3. **¿Cómo se integra?** Un await antes del clic Tabla en el mismo caso compartido; sin cambios de producto, IPC, guardado, arquitectura o archivos del usuario.
4. **¿Madurez, seguridad y licencia?** Misma versión bloqueada de Playwright y licencia del proyecto. Solo datos sintéticos y metadatos públicos de fuente; no se publica ninguna URL temporal de artefacto, secreto o documento real.
5. **¿Qué mantenimiento añade?** Una condición existente y explícita. No hay estado o helper permanente nuevo, capturas automáticas nuevas en la suite ni otro detector de guardado.
6. **¿Cuál es el pegamento mínimo?** Esperar el final visible de la operación que el test acaba de iniciar, conservando además main limpio y los bytes esperados. No cambiar plazos ni reintentos.
7. **¿Qué valor aporta código propio?** Ningún mecanismo propio: corregir el orden de observación del test evita confundir persistencia en main con final de la interacción en la interfaz.

## Validación y límites

Primero se conserva el rojo real privado y su control con la misma respuesta pendiente. Después: tipos, unitarias completas y build con Node 24 cuando no haya una medición GUI de rendimiento simultánea. La raíz ejecuta el archivo csv-text completo y ocho capturas de contexto (es/en-XA, claro/oscuro, 1440×900 y 1280×720). La lista de pruebas e identidades debe permanecer igual y todas las aserciones previas conservarse.

Sin dependencias, workflows, plazos, reintentos, cambios de producto, guardado, CSV o exportación. No se lleva la sonda privada a la suite. No se intenta resolver el C2 Markdown de Windows ni H13; son señales diferentes con el disco previo. La traza original de #183 carece de IPC y snapshot anterior al clic: el mecanismo se reproduce y explica una carrera posible, sin inventar el instante exacto de aquella corrida.

Entrega en un PR nuevo en borrador con base main, tras revisión y pruebas enfocadas de raíz. No fusionar, publicar ni actualizar la app instalada.
