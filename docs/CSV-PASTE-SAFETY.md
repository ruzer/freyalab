# Pegado seguro en la vista CSV

Iteración de integridad posterior a la [auditoría de los tres editores y roadmap del PR #6](https://github.com/ruzer/freyalab/pull/6). Esta rama parte de `main` y no incorpora ni fusiona ese PR. No repite la auditoría ni cambia las librerías de edición.

## Problema reproducido

El pegado enviaba la identidad de la primera fila visible, pero el motor aplicaba las filas siguientes en el orden original del archivo. Un filtro podía dirigir parte del pegado a filas ocultas; una ordenación descendente podía rechazar un bloque que cabía en la vista. Tres regresiones del motor fallaron antes de la corrección.

## Cambio

- La interfaz conserva la consulta correspondiente a la página realmente mostrada y envía su revisión al pegar.
- El motor reutiliza los índices de búsqueda, filtros y ordenación existentes. Resuelve todas las filas destino en segundo plano, también fuera de la página cargada.
- Una revisión antigua, una fila fuera de la vista o un bloque que no cabe se rechazan completos antes de modificar datos. La comprobación final de revisión protege la preparación de cambios que ceden el control.
- El historial existente conserva un único paso de deshacer/rehacer y recuperación. Guardar conserva el orden original del documento.
- IPC valida la consulta y la revisión. Las llamadas sin vista conservan el contrato anterior de pegar en orden del documento.

No hay un nuevo motor de tablas, dependencias, formato de archivo ni cambios en exportación. Se mantienen las muestras de solo lectura y los presupuestos de archivo, celdas e historial.

## Aceptación y pruebas

- Motor: filtros combinados, búsqueda y orden descendente; filas ocultas intactas; 210 registros con página de un registro; rechazo por límites de filas/columnas, fila oculta y revisión antigua; cancelación por cambio concurrente; deshacer, rehacer y restauración de recuperación.
- Electron: pegado TSV en la tabla filtrada y ordenada; valores con ceros iniciales, comillas y campos multilínea; deshacer/rehacer desde la barra; rechazo sin cambio parcial; validación IPC; guardado CSV en orden original.
- Comprobaciones de entrega: `npm run check`, `npm test`, `npm run test:e2e` (incluye `npm run build`). La CI debe comprobar macOS Apple silicon/Intel, Windows y Linux antes de considerar la rama validada en esas plataformas.

El bloque debe caber en las filas de la vista y las columnas existentes. No añade filas automáticamente. Las pruebas automatizadas no sustituyen pruebas de instalación ni mediciones de rendimiento con hardware identificado. No se generan instaladores ni una nueva publicación en esta iteración.
