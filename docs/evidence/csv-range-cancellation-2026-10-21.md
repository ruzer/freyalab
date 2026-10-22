# CSV: cancelación de edición masiva por rangos

Entrega `codex/csv-range-cancellation`, continuación de los PR #16/#17. Sin dependencias nuevas, otro motor, comandos CLI de usuario ni cambios de formato de recuperación. No cierra el objetivo A–D.

## Comportamiento

Las siete operaciones (rellenar, vaciar, recortar espacios, mayúsculas, minúsculas, reemplazar y pegar) preparan cambios con un identificador propio. Reutilizan el canal de progreso/cancelación de transformaciones y ceden el control cada 512 celdas, incluso en una sola fila muy ancha. Cancelar descarta la preparación sin cambiar datos, revisión, estado de guardado, deshacer o rehacer.

El diálogo muestra progreso, permite cancelar y volver a calcular, y bloquea una aplicación obsoleta. Cerrar/Escape durante la preparación cancela inmediatamente; durante aplicación solicita cancelación y espera el resultado real. El cambio final es completo y un cambio ya confirmado se puede deshacer.

Cortar copia antes de vaciar. Si se cancela o cierra mientras se espera el portapapeles, la copia puede terminar pero el borrado no se inicia. Si falla la copia tampoco se borra. No se deja una edición cancelable en cola detrás de otro guardado/edición: se rechaza con un mensaje para reintentar.

El motor usa la consulta y revisión capturadas; paginar por otra vista no cancela esa preparación ni cambia sus filas. Un cambio de revisión o una solicitud nueva descarta la anterior; cancelar un identificador antiguo no afecta a una nueva solicitud. El campo opcional `requestId` se valida como UUID en el puente; los consumidores anteriores pueden seguir omitiéndolo.

## Pruebas locales

Node.js 24, macOS ARM64.

- `npm run check`: sin errores/advertencias.
- `npm test`: 95 pruebas en 12 archivos. Siete nuevas cubren las siete operaciones, cancelación durante vista previa/aplicación, historial futuro intacto, fila de 2 000 columnas, cancelación inicial, revisiones, paginación concurrente, contrato anterior y muestras de solo lectura. Recuperación/deshacer mantiene campos ausentes y valores originales.
- `npm run test:e2e`: 53 pruebas; incluye construcción completa. Tres nuevas cubren controles reales, reintento, alcance de 100 000 celdas, cancelación del motor en marcha, rechazo de una segunda edición en cola, validación IPC y portapapeles demorado con Cancelar/Cancelar preparación.
- Capturas en claro/oscuro a 1280×800 y 1440×900. Los controles de aplicar/cancelar siguen visibles en el diálogo verificado.

La CI añade estas tres pruebas a las comprobaciones del paquete, junto a SQL, gráficos, transformaciones y orden: 18 pruebas de paquete por entorno. El resultado del mismo commit y la copia instalada en macOS se registran en el PR después de ejecutarse. No se confunde ejecución de un paquete con instalación manual en Windows/Linux/Intel.

## Límites

La cancelación es cooperativa durante la preparación. No interrumpe a mitad una mutación ya confirmada ni revierte una copia al portapapeles. Se mantienen los límites de edición y de historial de 20 MiB; las estadísticas, SQL y gráficos no cambian. Las mediciones amplias de rendimiento, lector de pantalla y las siguientes capacidades del roadmap siguen pendientes.
