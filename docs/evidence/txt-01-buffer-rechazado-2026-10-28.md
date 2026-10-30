# TXT-01 · Conservar el buffer tras una edición rechazada

Se reprodujo un riesgo de integridad en X15: `updateText` conserva primero la edición en la interfaz y la envía al proceso principal, pero eliminaba su promesa pendiente también al rechazarla. Más tarde, Cerrar podía considerar limpio el documento del proceso principal y eliminar la pestaña, con el borrador todavía visible sólo en la interfaz.

El test pega más de 10 MiB, espera el rechazo real del límite y comprueba el marcador del buffer después de Guardar, Cerrar pestaña y elegir Tabla. Comprueba el archivo original y el documento del proceso principal. Después usa Deshacer, aplica una edición válida y verifica su guardado. No hay hooks de producto ni demoras artificiales.

- `txt-c-boundary-red.txt`: error del arnés antes de reproducir este riesgo (csvOpen devuelve un documento, no un array). Esa corrida sí confirmó el caso independiente de la celda, en 1,7 s. Se conserva la salida.
- `txt-c-boundary-red-real.txt`: rojo real, 17 s. Guardar conservó el marcador en esa secuencia; **Cerrar eliminó el editor y la pestaña sin preguntar**. El archivo original mantuvo sus bytes. No se declara un fallo observado de Guardar.
- `txt-c-boundary-green.txt`: **1/1 en 2,6 s**, con los tres controles, el buffer conservado y la edición válida posterior guardada exactamente.

Corrección mínima: se elimina `pending` sólo cuando la edición se acepta. Si falla, permanece su promesa rechazada; Guardar/Cerrar/Exportar/Cambiar ya la esperan. La siguiente edición sigue encadenándose mediante `previous.catch`, por lo que Deshacer o corregir el texto permite continuar. No se cambian IPC, formato, guardado ni recuperación; tampoco se habilitan documentos mayores.

La prueba cubre cerrar la pestaña. No se verificaron manualmente el cierre del sistema operativo ni una caída con un buffer rechazado que excede el límite; ese buffer no fue aceptado por main y no se presenta como recuperable. La recuperación de cambios aceptados en modo Texto tiene sus pruebas propias en el bloque C. CI y paquete corresponden al cierre del SHA final.
