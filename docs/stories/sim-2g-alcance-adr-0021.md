# SIM-2g · Un aviso por evento · Alcance y ADR 0021

Base de preparación `c2579806407c92a4413727f77b60f167a318386f` (PRJ-03), rama `codex/sim-2g-avisos-unicos`. Se aplica SIM-2g (§192–207) y las reglas comunes de la historia SIM-2 copiada por A. No se modifica el worktree de PRJ-03 ni se presenta esta composición previa como la integración final de las siete partes.

## Cambio mínimo previsto

`notify(message, kind)` distingue `success`, `info`, `warning` y `error`; todas sus llamadas reciben un tipo explícito. Se conserva el anuncio y el botón para cerrar, y los plazos actuales: 3,5 s para avisos ordinarios y 7 s para errores. Éxito usa `circle-check`; información, `info`; advertencia y error, `triangle-alert`. El icono `info` se copiará de la misma colección Lucide que `lock`, conservando su licencia ISC/MIT existente; es una constante SVG confiable, sin dependencia ni contenido del usuario.

`notify` deja de escribir en `status`. El pie conserva el estado del documento/tabla y los cambios de vista que ya lo actualizan deliberadamente. `error()` conserva su limpieza, rechazo y duración; no se convierte cada mensaje del pie en un aviso ni se cambia la franja de cierre de la aplicación.

Para un evento externo se decide con estado real si su documento está activo, sin pestaña de análisis delante y sin ser un documento de subconjunto: esa es la misma condición que permite presentar la franja dentro de `document-workspace`. Si su franja está a la vista, se conserva como único mensaje de cambio, junto a la protección existente, sin toast ni copia al pie. Si no lo está, aparece un `warning` con el nombre del documento: «encuesta.csv cambió fuera de FreyaLab.». Se catalogan ese aviso y la franja; se elimina la promesa de que al guardar se comprobarán los cambios. No se consulta el DOM para decidir la visibilidad lógica ni se cambian el watcher o las guardas de fuentes.

La clasificación propuesta conserva los avisos de guardado/exportación como éxito cuando completan su operación; los resultados con advertencias de activos mantienen su contenido y reciben advertencia. Peticiones previas, cambios de vista, cancelaciones y obstáculos informativos se tipan según el resultado que realmente anuncian. El inventario privado conserva cada expresión y su línea antes de cambiarla; no se elimina ninguna llamada ni mensaje de datos.

Solo se prevén `App.svelte`, el registro de iconos, estilos locales de tipos de aviso si hacen falta, textos es/en y consumidores de selectores de tipo. `App.svelte` continúa en pendientes: no se amplía la traducción al resto de sus textos heredados. No se modifican backend, fuentes protegidas, registro, huellas, motor, IPC, cálculos, ficheros ni temporizadores de análisis.

## Rojo primero y consumidores

`tests/e2e/single-event-notices.spec.ts` prepara cinco casos: fuente protegida visible en Tabla en es/en-XA; la misma fuente con Análisis delante en es/en-XA; y éxito/información/error con iconos, teclado y pie independiente. Se crean y registran fuentes sintéticas mediante los diálogos y ayudantes de Proyecto existentes. El cambio se hace realmente en disco y se espera el evento real y la marca «Cambió desde que se registró». La huella e historia del manifiesto permanecen intactas; no se registra de nuevo ni se recarga automáticamente el archivo.

Los casos de cambio externo comprueban el número de mensajes visibles y el pie anterior. Análisis mantiene su pestaña seleccionada, la franja de Tabla queda oculta por el contenedor existente y el aviso incluye el nombre; no promete guardar. Las cifras, bytes y protección se comprueban aparte. Los casos es usan claro/1440×900 y los en-XA oscuro/1280×720; la matriz completa de capturas de ambas fases queda pendiente de raíz.

La quinta prueba usa la vista CSV Texto como aviso informativo real, el rechazo vigente de reinterpretación de un CSV dirty como error y guardar la edición como éxito. Se conserva el bloqueo del control: el intento sintético de frontera no lo habilita y no se interpreta como una acción de usuario posible. El reloj de pruebas permite comprobar 3,5 s/7 s sin cambiar los plazos del producto o del runner. Los iconos se comparan con el registro confiable existente, conservando su carácter decorativo y el nombre del botón de cierre.

El consumidor deliberadamente afectado es `icons.spec.ts`, que hoy llama `.toast.info` al guardado exitoso: deberá pasar a `.toast.success`, manteniendo su texto, dos SVG y bytes. Los demás selectores `.toast.error`, texto de avisos, guardas y acciones siguen siendo válidos; se revisan los consumidores del pie sin relajar resultados ni borrar pruebas. Ningún consumidor se modifica en esta preparación.

## Siete respuestas del ADR 0021

1. **¿Existe herramienta?** Sí: `notify`, `error`, `toastKind`, `status`, los eventos existentes y la franja externa. Falta tipar y conectar su presentación sin duplicar mensajes.
2. **¿Habilidad reutilizable?** Cambio mínimo, rojo→verde, datos sintéticos y comprobaciones de teclado, anuncios y preservación de archivos; no otro sistema de notificaciones.
3. **¿API suficiente?** Se reutilizan los eventos de documentos, los diálogos de Proyecto y el puente cerrado actual. No se añade IPC, acceso genérico a archivos, timer o sondeo.
4. **¿Madurez, seguridad, mantenimiento y licencia?** Código interno MIT e iconos Lucide ya usados bajo ISC/MIT. El SVG es constante; nombres y mensajes se interpolan como texto. Fuentes, hashes y rechazos permanecen protegidos.
5. **¿Coste?** Cuatro valores de tipo, argumentos explícitos, selección de icono y una condición de visibilidad lógica; sin dependencia, estado persistente ni coordinador nuevo.
6. **¿Pegamento mínimo?** Separar aviso transitorio de estado, clasificar los callers y reutilizar la franja cuando ya está visible. El watcher y la interpretación del documento quedan intactos.
7. **¿Valor del código propio?** Decir una vez qué pasó, con el icono adecuado y sin promesas falsas sobre fuentes protegidas. Reescribir el guardado, las fuentes o el sistema de eventos no aporta valor a G.

## Estado inicial de preparación (primer checkpoint documental)

En ese checkpoint solo había alcance, inventario y nuevas pruebas sin ejecutar; el producto y los consumidores anteriores seguían intactos. Raíz es la única ejecutora GUI. La implementación y sus resultados posteriores se registran en la [evidencia de G](../evidence/sim-2g-avisos-unicos-2026-11-20.md); capturas, suite integral y CI del SHA de publicación siguen pendientes. La calificación pertenece al SHA real y conserva su separación de PRJ-03 y de las otras partes SIM-2.
