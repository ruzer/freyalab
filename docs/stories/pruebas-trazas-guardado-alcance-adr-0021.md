# Trazas de guardado H13/C2 · alcance y reutilización

Base: `main 23121eda41fb9380c533a25ef86723046b6d7639`, rama independiente `codex/pruebas-trazas-guardado`. Decisión del propietario coordinada el 2026-11-18: observar dos fallos históricos de guardado sin afirmar todavía su causa ni corregir el producto.

## Alcance antes de implementar

Las trazas automáticas de las pruebas de Electron no contienen el DOM del contexto que crea la aplicación. Se usa la API pública de Playwright `app.context().tracing` solo en H13-2 (posición y finales de línea de los cuatro formatos) y C2 (guardar no borra el historial). La captura empieza al principio de esos casos, después del lanzamiento existente; termina en `afterEach` antes de cerrar Electron. Si la prueba falla, guarda y adjunta un ZIP. Si pasa, descarta la traza. Si iniciar, terminar o adjuntar la captura falla, añade una anotación sin sustituir el resultado de la prueba ni impedir el cierre existente.

No se cambian aserciones, títulos, proyectos, datos, guardado, IPC, producto, dependencias, plazos, reintentos ni workflows. No se incorporan observadores propios, wrappers de IPC, capturas adicionales ni esperas al escenario. El ayudante pequeño comparte el ciclo de vida de las dos llamadas y tiene pruebas en la interfaz pública de tracing y adjuntos. Las demás pruebas conservan su ejecución actual.

## Siete respuestas del ADR 0021

1. **Does a tool already do this?** Sí: `BrowserContext.tracing` de Playwright ya captura snapshots y fotogramas del contexto real. La configuración automática de Playwright Test se mantiene, pero en esta aplicación no observa ese contexto de Electron.
2. **Is there a skill we can reuse?** Diagnóstico con una señal real y TDD delimitan el problema; Ponytail limita la adaptación a la API instalada, dos llamadas y su cierre común. No se crea otra plataforma de observabilidad.
3. **Can it be integrated through CLI, API, or MCP?** Se usa exclusivamente la API pública existente `start`, `stop` y `testInfo.attach`. No hay CLI nueva, red ni IPC de la aplicación.
4. **How mature, secure, and maintained is it (release cadence, maintainers, license)?** Playwright está fijado en el lockfile existente y conserva su licencia. Solo se usan fixtures sintéticos y el directorio de resultados de cada prueba. No se capturan documentos del propietario ni credenciales. No se añade dependencia.
5. **What maintenance cost does it add?** Un ayudante de tracing de pruebas, dos consumidores y comprobaciones de éxito, fallo y errores del artefacto. No modifica el ciclo de vida ni las aserciones de las pruebas restantes.
6. **What is the minimum glue LAB must write?** En FreyaLab: iniciar el tracing del contexto real, conservar su cierre antes de Electron y adjuntar el ZIP únicamente cuando el resultado es inesperado. LAB no cambia.
7. **Does writing our own code add value?** Solo conectar el contexto que ya existe con los artefactos del corredor. La captura y el formato ZIP los implementa Playwright, sin un registro paralelo de eventos.

## Señal previa y límites

La calibración privada ejecutada por raíz en main `23121ed`, Node 24.22.1 y macOS arm64 provoca un rechazo EACCES real al cambiar a 0555 el directorio temporal del documento sintético. La aserción original de persistencia queda roja. El ZIP explícito tiene 30 snapshots DOM y 34 fotogramas; el automático no tiene ninguno. El aviso real aparece ya en el snapshot posterior al clic Guardar, antes de esperar el aviso. No hace falta añadir esperas al caso público.

Esto valida que la observación recupera estado visual. No reproduce la pérdida histórica de Windows, no demuestra EACCES en Windows, no valida una hipótesis de Undo tardío y no registra entrada/salida de IPC principal. Un fallo sin señal visible aún podría dejar su motivo desconocido. El coste y el comportamiento multiplataforma no están medidos todavía. H13 y C2 siguen abiertos; esta entrega no se presenta como su arreglo.

## Validación prevista

Pruebas unitarias rojas primero sobre la interfaz pública de tracing: descarte al pasar, ZIP y adjunto al fallar, y errores de inicio/cierre/adjunto que no enmascaran el resultado. Comprobar las identidades y las aserciones antes/después. Raíz ejecutará los dos archivos afectados y una calibración privada de permiso real contra el ayudante. Tipos, unitarias completas y build sobre la fuente final; CI posterior sobre el head congelado si se autoriza publicar. Sin GUI ni publicación por parte del implementador durante esta preparación.
