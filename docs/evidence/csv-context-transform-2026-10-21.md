# Menú de transformaciones durante la paginación — 21 de octubre de 2026

Entrega de desarrollo en `codex/csv-context-transform`, sobre `codex/csv-statistics-reports`. Las entregas #16–#20 siguen pendientes de integración en main; no se fusionan automáticamente.

## Problema y evidencia previa

La CI del commit `ebcc3ec` pasó en los cuatro entornos, pero Windows necesitó un reintento en la prueba anterior `structure.spec.ts:27`: tras cerrar Transformar con Escape, el clic en su entrada del menú no abrió el diálogo. [Ejecución de origen](https://github.com/ruzer/freyalab/actions/runs/39710299370). La traza conservada contiene pasos de prueba y un menú todavía abierto después del clic; no contiene una captura del estado `busy` durante ese clic. No se atribuye al registro una observación que no contiene.

El código sí confirma una diferencia: la barra y el atajo permiten abrir el asistente mientras carga la grilla; el menú lo deshabilitaba y su controlador descartaba la acción durante esa carga. Una nueva prueba con 300 filas reprodujo el bloqueo en la app instalada `0.1.0-dev.20261021.ebcc3ec`: observó `Procesando…` y comprobó `disabled: true`. El clic nativo sobre ese botón deshabilitado no ejecutó la acción. No necesita archivos grandes ni pausas arbitrarias.

## Corrección

- El comando compartido por el menú contextual y Rango permite abrir el asistente mientras se pagina. Conserva los bloqueos de solo lectura, vista inválida y falta de selección. Preparar/aplicar sigue validando revisión y alcance en el motor existente.
- Las otras acciones del rango siguen deshabilitadas y su controlador conserva el bloqueo durante la carga. Abrir un diálogo no modifica datos.
- El foco usa el menú montado y una acción disponible. Si el navegador pierde el foco al deshabilitar la acción enfocada, lo devuelve al menú; no busca botones de otro documento. Escape conserva el rango y devuelve el foco a la celda.
- Sin dependencias, APIs, formatos, motores o cambios de guardado/recuperación nuevos.

## Verificación local

Node 24, Electron 44.9.2, macOS ARM. Tipos/componentes sin errores ni advertencias; 110 pruebas unitarias; 62 E2E sin reintentos, incluida compilación de producción. Las cuatro pruebas de transformaciones se repitieron tres veces: 12 pasaron sin reintentos.

La nueva prueba abre el menú con ratón y Mayús + F10; provoca paginación real a otra parte de la tabla y observa el cambio del DOM a `Procesando…` antes de activar el comando. Comprueba que Transformar esté habilitado y las otras acciones bloqueadas. La rama de teclado comprueba foco y Enter reales. Después de cerrar comprueba selección, columna inicial del asistente, documento/revisión/estado pendiente, recuperación vacía y bytes originales. Captura del foco revisada. Las pruebas anteriores de transformaciones conservan los flujos de ratón/atajo, cancelación, deshacer y recuperación.

El PR registrará la CI del commit final y la copia instalada. La misma suite `structure.spec.ts` ya forma parte de las comprobaciones del paquete en los cuatro entornos; ahora añade esta regresión (27 casos empaquetados en total). La corrección del bloqueo reproducible no certifica la ausencia de cualquier otra intermitencia de Windows. Ejecutar el paquete en CI no equivale a probar manualmente instaladores en Windows/Linux/Intel. El objetivo A–D sigue activo.
