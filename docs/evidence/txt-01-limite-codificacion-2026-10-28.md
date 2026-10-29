# TXT-01 · El límite cuenta los bytes del formato original

X9 conserva la codificación/BOM; X13 y los casos límite definen el archivo de 10 MiB como **10.485.760 bytes**, incluido un ejemplo de UTF-16 LE grande. `updateNow` contaba siempre los bytes UTF-8: un CSV UTF-16 o Windows-1252 podía abrirse editable por tener menos de 10 MiB en disco y luego rechazar un cambio, porque el mismo texto ocupa más en UTF-8. El BOM tampoco se contaba al editar.

Rojo `txt-c-encoding-limit-red.txt`: 2 rechazos reales de UTF-16 y Windows-1252. `txt-c-encoding-limit-red-complete.txt`: **4 fallos reales**, añadiendo los límites exactos y su exceso de un carácter con BOM UTF-8/UTF-16.

El helper del codec CSV cuenta su buffer codificado con el BOM. Sólo CSV Texto utiliza ese conteo; Markdown, Mermaid, texto normal, el contrato IPC y el límite de 10 MiB permanecen iguales. El conteo no acepta ni guarda sustituciones: la validación estricta de caracteres sigue en `encodeCsvText` al guardar. Por tanto sigue permitiendo corregir un carácter no representable y mostrar su error posicionado al guardar.

El primer verde enfocado agotó 5 s en las comparaciones genéricas de Buffers de varios MiB. Se conserva `txt-c-integrity-focused.txt`; no se aumentó ningún tiempo límite. Las dos aserciones nuevas usan ahora `Buffer.equals`, que compara **todos los bytes**, con igual garantía. No se cambió una prueba anterior ni se redujo el fixture.

`txt-c-integrity-focused-verified.txt`: **169/169 en 8 archivos, 2,31 s**, incluidos serialización, codificaciones, transacciones, el modelo CM y la lista i18n que sólo encoge. Check: 0 errores y 0 avisos. Build: código 0. La fuente se congela después del verde nativo del buffer rechazado y se repetirá una única medición final, seguida del cierre completo.
