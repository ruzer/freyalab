# TXT-01 · Confirmar una celda antes de cambiar de vista

Hallazgo de X15 durante el cierre: `chooseCsvView` esperaba las ediciones de texto, pero la grilla solo confirmaba su input al perder foco o con Intro. Una activación del control sin trasladar el foco podía desmontar la celda antes de confirmar su borrador.

Rojo real `txt-c-focused-cell-red.txt`, build de 477883c: no aparece el diálogo; la captura de estado ya muestra Texto seleccionado y Guardado. El valor escrito seguía solo en el input. El test usa `HTMLButtonElement.click()` sobre el control real con la celda enfocada, sin demoras ni hooks. Simula activación sin traslado previo de foco; no acredita una prueba manual de AXPress ni de un lector de pantalla.

Corrección: `CsvTable.flushEditing()` utiliza el mismo foco/blur y la misma función de edición existente. Espera una operación ya empezada antes de localizar un input todavía pendiente, lo confirma y comprueba su resultado. `chooseCsvView` espera ese adaptador antes de decidir si hay cambios. No hay otra implementación de edición ni cambios en TableEngine. Una edición fallida devuelve su mensaje, el adaptador lo propaga y el input de celda solo se elimina en éxito; un nuevo intento con el borrador aún desenfocado vuelve a usar su mismo handler.

Verde del caso en `txt-c-boundary-red.txt`: **1 caso pasó en 1,7 s**. Esa corrida tenía otro caso que falló por un error de arnés antes de reproducir el límite; no se declara como corrida 2/2. El caso verde comprueba:

- Cancelar conserva el valor real de la celda tanto en la grilla como en TableEngine.
- Descartar abre el texto exacto del disco y deja el original intacto.
- Guardar y cambiar usa el serializador real de Tabla, con los identificadores y el campo multilínea conservados.
- El diálogo aparece antes de sustituir la representación; se mantiene el mismo documento.

Check enfocado: 0 errores y 0 avisos. Los builds enfocados terminaron con código 0. El primer intento de invocar check usó una ruta npm inexistente (127); se conserva aparte y la invocación correcta usa Node 24 en PATH. La validación completa se reserva para la fuente congelada. No se atribuyen aquí CI, paquete ni fusión.
