# SIM-1f · Formato del archivo: alcance y reutilización

Base: `main 1bdf88c437079fadaf8ff9e121102ab370fae614`. Rama independiente `codex/sim-1f-formato-archivo`, entrega posterior a la publicación de SIM-1b (#188), sin apilar su rama. La historia corregida se copia íntegra: SHA-256 `c0e45fd395cb147f9a278699b9f45c9a6da93f88a0ab72d87b91e7155afd257f`.

## Alcance previo a interfaz

Los controles existentes Codificación, Separador y Encabezado pasan al panel pequeño «Formato del archivo», detrás de un solo acceso en la barra de estado con el resumen confirmado por `DocumentInfo`: «UTF-8 · Coma · Con encabezado». No se duplican controles ni estado del formato. Se conserva `options()` y la ruta IPC/servicio/motor existentes, con las mismas opciones, guardas, rechazos y mensajes. El panel usa los patrones y estilos de `details` y controles nativos existentes; no añade una franja.

La aceptación retira el literal limpio «Guardado» de la barra inferior global. Se conserva el estado superior de Guardar y todos los demás estados: Solo lectura, Sin guardar, Cambios pendientes, texto de última acción, advertencias, apertura/cancelación, recuentos y estadísticas de selección. Las pruebas que verificaban el estado limpio se adaptan al indicador superior equivalente, conservando íntegramente sus aserciones de disco, datos, revisión, BOM, codificación, historial y errores.

## Corrección de la historia aprobada el 2026-11-18

El propietario decidió **conservar la conducta actual y documentar la diferencia**: hoy reinterpretar aplica inmediatamente y solo vuelve a leer el archivo. No existe una confirmación en esa ruta y no se añade una. Se mantienen los cuatro rechazos actuales: cambios pendientes, archivo sin ruta, archivo cambiado en disco y fuente protegida. Sin cambios de handlers, parser, guardado, IPC o límites.

El nuevo criterio con cambios pendientes se comprobará sin habilitar el control: la UI sigue deshabilitada. Una prueba explícita de frontera intentará un `change` sintético sobre el mismo selector, sin quitar `disabled`, para ejercitar el handler y el rechazo reales. No se afirma que un usuario pueda operar un control bloqueado. Si el evento no alcanza ese recorrido, se informa el resultado antes de escoger otro oráculo; no se fabrica un aviso. El resumen permanece derivado del formato confirmado, sin actualización optimista.

## Siete respuestas del ADR 0021

1. **Does a tool already do this?** Sí: `details/summary`, los tres controles de CSV, su portal al footer y el cierre por Escape/puntero ya existen. Se mueve ese markup y se deriva un resumen; no se incorpora otra biblioteca de popovers.
2. **Is there a skill we can reuse?** TDD y diagnóstico para conservar conducta y distinguir bloqueo real de un intento sintético; Ponytail para el cambio completo mínimo; accesibilidad para controles nativos, foco, teclado y condiciones de layout.
3. **Can it be integrated through CLI, API, or MCP?** Exclusivamente mediante `tableOptions` ya tipada y validada. La acción de formato sigue recorriendo el mismo handler. Sin CLI, red ni IPC nuevos.
4. **How mature, secure, and maintained is it (release cadence, maintainers, license)?** Svelte, controles del navegador y dependencias fijadas existentes. Licencias intactas. Se conservan las guardas de proyecto, dirty, archivo, hash y serialización; no se modifica la fuente al abrir o reinterpretar.
5. **What maintenance cost does it add?** Un acceso/resumen y textos del panel, con los mismos tres controles. No otro almacén de preferencias, motor o formulario paralelo. Se comprueban los consumidores del footer que conserva el estado superior.
6. **What is the minimum glue LAB must write?** Solo reubicar los controles en FreyaLab y retirar el estado limpio repetido, conservando los demás. LAB no cambia.
7. **Does writing our own code add value?** Conecta información y acciones existentes en un acceso compacto. No se reimplementan detección, lectura, confirmaciones, guardado, teclado nativo ni infraestructura de menús.

## Teclado, pruebas y límites

El panel es un formulario/grupo; no un menú de botones. ArrowUp/Down/Home/End deben seguir siendo nativos en los selects y Tab recorre los controles; Escape cierra y devuelve foco al disparador. Se revisarán los interceptores de `.dropdown` al integrar la interfaz, sin aplicar navegación de botones a controles de formulario. El popup se abre sobre la barra inferior y queda dentro del viewport.

Primero se conservan los rojos y las capturas anteriores; raíz es la única ejecutora GUI. Después se verifica el nuevo acceso, resumen, reinterpretación equivalente, dirty/rechazo y foco; los consumidores se actualizan sin debilitar aserciones de datos. Capturas es/en-XA, claro/oscuro, 1440×900/1280×720. Tipos, unitarias completas, construcción y flujos afectados sobre el código final; CI del head congelado por plataforma. Sin cambios de dependencias, plazos, retries o workflows; no se fusiona ni se actualiza la app instalada.

Observación fuera de alcance: el `header` local de CsvTable inicia en true y no se ha reproducido si puede desincronizarse de `doc.hasHeader`. No se afirma un defecto ni se modifica esa conducta sin prueba y revisión separada. El resumen nuevo siempre refleja el `DocumentInfo` confirmado.
