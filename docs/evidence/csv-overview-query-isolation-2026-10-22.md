# Panorámica: aislar análisis y paginación

Base: `ca453bf264ea7e6e39323b2d67307868e037de0b` (PR #37). Caso observado en CI `39884644453`, Linux job `120190086451`: la exploración inmediata de un millón de filas se cancelaba por una consulta posterior y no alcanzaba la primera columna. El retry también mostraba invalidación del alcance.

## Causa y corrección

La consulta adicional de `tablePage` para contar filas compartía el mecanismo de sustitución de consultas de la grilla. La carga inicial diferida podía cancelarla, y el propio análisis filtrado tampoco utilizaba su guardia existente al obtener índices.

La panorámica ahora usa `doc.rowCount` validado para el documento completo o metadatos de la página aceptada para la vista filtrada. Esta última exige una solicitud ya completada, la misma revisión/condición de muestra y los mismos filtros/orden, sin comparar offset, límite ni identificador de página. Los dos millones de posiciones se validan antes del primer análisis. No hay consulta adicional, IPC, dependencia o dataset nuevo.

El documento completo no depende de que la grilla termine su carga ni de sus filtros. Paginar la misma vista conserva el análisis. Los índices del análisis filtrado usan la guardia de la solicitud de análisis; esta cancela por cambio de revisión o solicitud, sin competir con la paginación.

## Evidencia local

- Regresión de motor antes del cambio: fallo `Consulta cancelada por una solicitud más reciente.` en `TableEngine.indices` → `analyzeColumn` (254 ms).
- Después: la misma regresión aprueba en 241 ms. Verifica ambos órdenes de concurrencia, cancelación durante filtrado, resultado exacto, snapshot y serialización original intactos.
- `npm run check`: 0 errores y 0 advertencias; `npm test`: 182 pruebas en 19 archivos aprobadas; `npm run build`: aprobado.
- Ocho E2E reales de panorámica aprobadas en 9,9 s: incluye los casos fallidos de CI, apertura fría y análisis inmediato de un millón de filas, bloqueo de metadatos viejos durante el debounce del filtro, paginación del mismo alcance, presupuesto, muestra, informe, cancelación y rechazo de revisión obsoleta.
- Cancelar se comprueba durante el primer análisis real, porque ya no existe una consulta de preflight. El caso de edición concurrente acepta el mensaje exacto de cancelación del motor y conserva las mismas comprobaciones de descarte, informe bloqueado, archivo y resincronización.

Las cifras son locales en macOS arm64. La suite completa integrada, el paquete y el nuevo CI del commit final requieren comprobación posterior. No se infiere compatibilidad de Windows/Linux/Intel a partir de este resultado local; no se fusionó ni publicó una versión.
