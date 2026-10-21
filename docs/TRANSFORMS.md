# Transformaciones CSV con vista previa

Entrega de desarrollo `codex/csv-transformations`. Reutiliza el proceso tabular, las mutaciones de historial y la recuperación existentes; no añade dependencias, otro motor de edición ni comandos de usuario.

Abre **Operaciones → Transformar documento…**. También está en el menú contextual de un rango y en **Ctrl/⌘ + Mayús + T** desde la tabla. Selecciona operación y columnas, pulsa **Vista previa**, revisa los recuentos/ejemplos y confirma **Aplicar transformación**. Ninguna vista previa modifica datos ni historial.

## Alcance y operaciones

El diálogo trabaja sobre **todo el documento editable**, incluidas filas ocultas por filtros/búsqueda. La selección previa de columnas sirve como propuesta; el rango de filas no limita esta herramienta. El aviso permanece visible. Las operaciones sobre rangos existentes conservan su propio alcance y no se sustituyen.

| Operación | Comportamiento |
|---|---|
| Dividir | Una columna, separador literal de hasta 64 caracteres; admite coma, punto y coma, barra, tabulador, espacio y texto personalizado. Conserva la original y añade las partes al principio del documento. Conserva segmentos vacíos y caracteres de comillas; no interpreta CSV anidado ni regex. Rechaza más de 32 partes sin truncarlas. |
| Combinar | Une las columnas marcadas en su orden original mediante un separador literal, que puede estar vacío. Añade una columna al principio del documento. Conserva todas las originales, ceros iniciales, fechas y texto largo. Un campo ausente aporta texto vacío a la columna nueva; su ausencia original se conserva. Las columnas nuevas se anteponen para no rellenar huecos entre columnas originales. |
| Eliminar duplicados | Clave compuesta de las columnas marcadas, por texto exacto. Distingue campo ausente y vacío. Conserva la primera fila en el **orden original**, con sus identificadores; elimina filas repetidas completas, incluidas las otras celdas. La vista previa explica esta consecuencia y muestra la fila original con la que coincide. |
| Componer Unicode | Normalización NFC explícita en celdas presentes de las columnas elegidas. No convierte números/fechas, recorta espacios ni cambia mayúsculas. Las formas canónicamente equivalentes pueden verse iguales antes/después; el original se conserva en deshacer. |
| Normalizar encabezados | Todos los encabezados: NFC, quitar espacios exteriores, espacios internos a `_`, minúsculas, nombres para vacíos y sufijos únicos. Requiere primera fila como encabezados y no modifica datos. |

Los nombres generados al dividir conservan caracteres Unicode completos y usan hasta 128 puntos de código del encabezado original más un sufijo. Los campos originales no se recortan. La vista previa muestra hasta ocho ejemplos abreviados a 256 unidades UTF-16 y recuentos completos; el resultado y el historial mantienen los valores completos.

## Integridad, progreso y recuperación

La preparación ocurre en el proceso de datos. Emite progreso y cede el control entre bloques. **Cancelar preparación** interrumpe antes de aplicar; no modifica datos ni crea un paso de historial. El cambio final es atómico respecto a otras operaciones y no se interrumpe a mitad; después se puede deshacer en un solo paso. Cerrar el diálogo cancela su preparación activa. Si se pide cancelar durante la aplicación, se espera la respuesta real: un cambio ya confirmado se informa como aplicado y se puede deshacer. Un cambio de opciones invalida la vista previa; revisiones antiguas se rechazan. Un cambio externo bloquea este diálogo hasta revisar/recargar el documento.

Aplicar vuelve a preparar y validar con la misma revisión y opciones; no confía en los ejemplos del renderer. Si hay otro guardado/edición pendiente, rechaza la transformación con un mensaje para reintentar después, evitando dejarla en una cola cuya cancelación ya no llegue a tiempo.

Reutiliza las mutaciones de celdas, encabezados, filas y columnas de la recuperación versión 1. Guarda longitudes de filas irregulares para restaurar campos ausentes al deshacer. El borrado por grupos y su restauración se aplican mediante recorridos lineales cuando corresponde; no pasan cientos de miles de argumentos a `splice`. Guardar mantiene el delimitador, BOM, codificación y saltos de línea existentes. El CSV original permanece intacto hasta guardar. Guardado y exportación mantienen las protecciones de rutas, cambios externos y codificación.

Límites de esta herramienta: documento editable de hasta 50 MiB/dos millones de celdas, hasta 200 columnas de entrada y resultado, registro de hasta 1 MiB y presupuesto de historial de 20 MiB por cambio. Si un resultado no cabe en el historial o produciría un registro excesivo, se rechaza íntegramente, también desde la vista previa. La escritura completa sigue validando tamaño total y codificación; puede exigir reducir datos o guardar en otra codificación. No procesa muestras de solo lectura ni ofrece todavía alcance por rango/filas filtradas para estas cinco operaciones.

## Comprobaciones específicas

- `tests/table-structure.test.ts`: dividir/combinar, caracteres Unicode y encabezados derivados, claves compuestas, campos ausentes, EOL, texto exacto, rechazo íntegro, cancelación, recuperación JSON y deshacer/rehacer. Borrado de 50 000 grupos alternados y restauración de un grupo de 139 999 filas.
- `tests/e2e/structure.spec.ts`: cinco flujos visuales, documento completo con filtro activo, menú/contexto/atajo, foco, temas, cancelación real mediante IPC, revisión obsoleta, validación del puente, recuperación y guardado real.
- La CI ejecuta la regresión completa y vuelve a ejecutar SQL, gráficos y transformaciones desde los paquetes macOS ARM/Intel, Windows y Ubuntu. Compilar/empaquetar no equivale a probar manualmente un instalador.

Quedan para otras iteraciones mover filas/columnas, reordenación permanente asistida y ampliar el alcance de las operaciones. No se declara completado el objetivo A–D por esta entrega.
