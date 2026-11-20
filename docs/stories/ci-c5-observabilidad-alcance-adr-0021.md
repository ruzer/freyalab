# C5 · contexto de Electron y tiempos IPC · Alcance y ADR 0021

Base `main 056d28f3ad1177a1fd2bf393f27e7ac77e82af8d`, rama `codex/ci-c5-observabilidad`. Seguimiento de estabilidad autorizado: **observación de un fallo todavía sin causa demostrada; no es su arreglo**. Este alcance acompaña el parche de pruebas aplicado en el worktree, antes de su calificación de interfaz y publicación.

## Señal y alcance

En CI main `44650561529`, ARM, C5 falló dos veces al esperar que desapareciera `.node-progress`; se agotó el caso de 90 segundos. Los ZIP automáticos contienen acciones de prueba, fuentes y adjuntos, pero ningún snapshot DOM ni fotograma del contexto Electron. El paso rápido terminó con un fallo persistente y dos flaky en 67 minutos; posteriormente el job agotó sus 75 minutos. Ambos hechos se conservan separados.

La sonda privada posterior pasó cinco controles locales: uno individual, dos concurrentes y dos concurrentes con reducción de CPU solicitada por CDP al renderer. Sus trazas manuales sí contienen DOM y fotogramas. Esto valida la captura, no reproduce el fallo ARM ni acredita un arreglo de C5.

El cambio de 23 líneas añadidas y una retirada en `project-tree.spec.ts` activa solo para el título C5 exacto el ayudante existente `traceElectronFailure`, recoge stdout/stderr de su proceso principal y registra inicio, fin/error y duración de `project:reregisterSource` y `project:cancelSource`. Delega una vez al handler original con sus argumentos y `this`, y devuelve el mismo resultado o Promise. El cierre ocurre antes de `closeElectron`; el callback se reinicia por caso. El wrapper existe únicamente dentro del proceso de prueba que se cierra al terminar.

No cambian cuerpos de pruebas, aserciones, títulos, datos, grupos, etiquetas, plazos, reintentos, workflows, dependencias, producto ni contratos IPC. No se añade sondeo permanente ni la capa de 117 líneas usada en la sonda privada. No se crean pruebas que dupliquen estáticamente esta implementación.

## Siete respuestas del ADR 0021

1. **¿Existe herramienta?** Sí: `app.context().tracing`, `testInfo.attach`, los streams del proceso de prueba y el ayudante `tests/e2e/electron-trace.ts` ya existen. El tracing automático no captura este contexto creado por Electron.
2. **¿Habilidad reutilizable?** Diagnóstico desde evidencia real y cambio mínimo. Se reutilizan el ciclo de captura y las pruebas del ayudante; no se crea otra plataforma de observación.
3. **¿CLI, API o IPC?** Se usa Playwright para la traza y Node para stdout/stderr. La envoltura del registro interno `_invokeHandlers` sigue el patrón de otras E2E existentes, sin añadir operaciones o accesos al IPC del producto.
4. **¿Madurez, seguridad y licencia?** Son dependencias instaladas y fijadas en el lockfile. Solo se usan fixtures sintéticos y el directorio de resultados del caso. `_invokeHandlers` es una interfaz interna de Electron: puede requerir adaptación al actualizarlo; su ausencia produce un error explícito de preparación. No se añade dependencia ni se cambia licencia.
5. **¿Coste?** Un consumidor condicional del ayudante existente y marcas de dos operaciones. Los logs y la traza añaden carga; no son medición sin interferencia. Los logs brutos quedan privados para su revisión y saneamiento.
6. **¿Pegamento mínimo?** Iniciar la captura del contexto correcto, observar los dos handlers conservando su retorno y adjuntar la salida antes del cierre existente. Los demás casos usan el callback vacío; no se cambia LAB.
7. **¿Valor del código propio?** Conservar el estado que faltó al diagnosticar C5 y saber si sus IPC terminaron, evitando atribuir una causa sin observarla. El valor es diagnóstico, no una capacidad nueva ni una corrección supuesta.

## Validación y límites

Los ocho cuerpos de declaraciones directas de prueba permanecen idénticos; el reporte CI de base enumera diez identidades por parametrización. Las siete expectativas del cuerpo C5 se conservan. Check y las ocho unitarias existentes del ayudante pasaron; interfaz con el parche actual, build y CI del futuro head siguen pendientes hasta registrarse en la [evidencia](../evidence/ci-c5-observabilidad-2026-11-19.md).

Las cinco ejecuciones de la sonda no califican por transferencia el parche actual. Foco DOM no demuestra foco nativo; aceptar el comando CDP no mide una ralentización efectiva de cuatro veces. Los artefactos anteriores tampoco prueban bloqueo del motor, corrupción ni una causa OS. La captura puede cambiar los tiempos de una carrera y puede quedar incompleta si se pierde el contexto.
