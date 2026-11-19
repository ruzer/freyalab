# H13 · Sonda de Undo nativo en Windows · Alcance y ADR 0021

Fecha: 2026-11-19. Rama `codex/h13-undo-sonda-windows`, desde `origin/main 39c2000936f1b03c00daee45bc0a257132fb26ab`, actualizado mediante fetch explícito. Es una rama temporal de diagnóstico: **no corrige producto y no se fusionará**. Calibración local, publicación de un posible borrador y análisis de resultados corresponden a raíz; aún no se han ejecutado.

## Alcance y límites

Reutilizar la sonda privada ya revisada sobre `tests/e2e/editor-status.spec.ts`, adaptando solo el contexto del parche que cambió con #187 y conservando `stopTrace`/`traceElectronFailure`. Activarla dentro del spec en Windows o con `FREYALAB_H13_UNDO_PROBE=1` para calibración local. La CI existente ya ejecuta el área Markdown en Windows: no se cambian workflows, variables externas ni selección de plataformas.

La sonda retiene únicamente el primer `edit.undo` real enviado por Electron y, al liberarlo, reenvía sus argumentos originales. No fabrica un comando, una respuesta ni una segunda pulsación. Conserva las acciones, aserciones, datos, identidades, plazos y reintentos del baseline. Reutiliza exclusivamente los registros de eventos DOM y del envío nativo previstos por el parche; no añade otra observabilidad ni un refactor.

`nativeOnly` es una lectura instantánea, tentativa y no concluyente: no demuestra que solo exista una ruta de Undo. `seen=0` tampoco refuta una duplicación. La sonda puede alterar el orden de entrega del comando real para observar el mecanismo; no demuestra por sí sola la causa de un fallo histórico ni constituye una corrección. No observa llamadas update/save, revisión, dirty ni errores de guardado. Los resultados y el contexto real de Electron deben informarse con esos límites; un borrador diagnóstico puede cerrarse sin fusionar.

## Siete respuestas del ADR 0021

1. **Herramienta existente:** sí, parche revisado, `webContents.send`, Playwright y `traceElectronFailure`; reutilizarlos sin otra capa.
2. **Habilidad reutilizable:** diagnóstico acotado con comandos reales, evidencia y separación entre hipótesis y conclusión. No se incorpora herramienta al producto.
3. **CLI, API o IPC:** bastan Electron y el spec existentes. No se amplía el puente, el backend ni una API del producto.
4. **Madurez, seguridad y licencia:** mecanismos locales ya instalados y código interno del proyecto; sin dependencias nuevas ni acceso adicional. Fixtures sintéticos y registros de diagnóstico delimitados.
5. **Coste:** una instrumentación temporal del test; conserva los plazos existentes. No añade timers, retries, configuración ni infraestructura.
6. **Pegamento mínimo:** adaptar el hunk de contexto a #187, activar la condición Windows/flag y etiquetar la observación tentativa. Mantener intacto el tracing existente y los cuerpos originales de comprobación.
7. **Valor del código propio:** distinguir la entrega del Undo nativo real de la observación del documento, sin presentar una instantánea como prueba de exclusividad ni alterar producto.

## Estado inicial

Este primer cambio solo documenta alcance. Sonda, calibración, resultados y CI siguen pendientes. No modifica las ramas ni heads de PR192, PR193 o PR194. Un resultado local no se transfiere a un futuro SHA de CI; cualquier publicación de diagnóstico debe identificar la fuente exacta.
