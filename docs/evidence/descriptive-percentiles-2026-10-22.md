# DW-04c — varianza y percentiles

Rama `codex/descriptive-percentiles`, sobre `b355ea41c7331f753bf3ad98d73f26645b57169c` del PR #37. Implementación probada: `6e82c9ea83ba2ffeaefdaec2eada673aa6cd4b72`. La corrección de concurrencia de #37 es una dependencia, no se duplica su diff en esta entrega. Objetivo DW-01–DW-10 abierto; sin fusión, publicación ni cambio de arquitectura analítica.

## Resultado y método

El helper `descriptive` añade varianza poblacional/muestral y P10/P25/P75/P90, compartidos por estadísticas de columnas, celdas del rango, rango por columnas y perfil individual. Simple Statistics 7.12.1 ya instalada calcula las varianzas; las desviaciones se derivan de ellas. Una llamada vectorial `quantile` calcula cinco percentiles, reutilizando P50 como mediana: misma copia temporal, sin otro mapa de frecuencias ni ordenamiento completo adicional. Se mantienen exclusiones y resultados aproximados, sin modificar el CSV.

Método lineal tipo 7 confirmado en la fuente instalada y con cálculos independientes: `[0,10,20,30]` produce P25=7,5 y P75=22,5; `[2,4,4,4,5,5,7,9]` produce varianza poblacional 4 y muestral 32/7. La documentación web consultada aún muestra 7.8.7 y no sustituye la versión fijada. [Reglas y valores no disponibles](../COLUMN-PROFILES.md).

General: casilla **Varianza y percentiles** cambia las columnas visibles sin recalcular. Perfil: sección desplegable accesible por teclado. Informes generales/perfil incluyen las seis medidas aunque la UI esté plegada; otros informes mantienen su alcance. Vacío → no disponible; un número → varianza poblacional 0, muestral no disponible y percentiles iguales al número.

## Verificación local integrada

Apple M2 Max, 32 GiB, macOS ARM64, Node 24.22.1, Electron 44.9.2, un worker nativo, datos sintéticos.

- `npm run check`: **0 errores, 0 advertencias**.
- `npm test`: **192 correctas**, 20 archivos. Tests independientes del helper, filtros/rangos/muestras, vacíos/negativos/decimales/constantes/singleton, resultados no finitos, IDs inseguros, snapshots/serialización y reportes completos con textos hostiles.
- `npm run test:e2e`: **108 correctas, 3,9 min**, sin reintentos, incluido `npm run build`. Incluye los tres nuevos flujos de percentiles: perfil filtrado, ayuda por teclado y procedencia; columnas marcadas/rango y presentación progresiva; vacío/singleton/muestra. Contrasta valores numéricos, informes y bytes originales; conserva apertura/guardado/recuperación, SQL/gráficos, cancelación y las regresiones de paginación de #37.
- Capturas inspeccionadas: [claro 1440×900](dw04c-percentiles-light-1440x900.png) y [oscuro 1280×800](dw04c-percentiles-dark-1280x800.png). Muestran ayuda, medidas, foco y grilla; no sustituyen lector de pantalla ni estudios con participantes.

Registros: `/private/tmp/freyalab-dw04c-integrated-check.log`, `/private/tmp/freyalab-dw04c-integrated-unit.log`, `/private/tmp/freyalab-dw04c-integrated-e2e.log`.

## Medición acotada del árbol integrado

[JSON reproducible de la suite](dw04c-column-overview-profile.json). Una ejecución por tamaño; una columna y 1 000 valores distintos repetidos. Incluye el helper nuevo al explorar columnas, junto con la eliminación de la consulta de preflight en #37. No es una comparación A/B que permita atribuir diferencias solo a los percentiles.

| Filas completas | Apertura (ms) | Exploración (ms) | Mayor separación observada del heartbeat UI (ms) |
|---|---:|---:|---:|
| 3 000 | 160,5 | 69,7 | 25,4 |
| 100 000 | 89,8 | 112,9 | 22,1 |
| 1 000 000 | 485,8 | 323,4 | 27,2 |

Heartbeat solicitado cada 20 ms; solo tres observaciones en el caso pequeño. No demuestra p95, arranque frío, picos de memoria ni latencia universal. No equivale a tablas anchas, alta cardinalidad o textos extensos ni amplía límites de edición. Los cálculos síncronos de la librería siguen siendo cooperativamente descartables al finalizar, no interrumpibles dentro de cada operación matemática.

## Gates y pendientes

Paquete e instalación local se registran por separado después. CI del commit exacto y otras plataformas pendientes. La moda sigue pendiente: no se presenta un único ganador cuando existen empates. DW-04 permanece abierto; DW-05 aún no ofrece recomendaciones automáticas. Sin Python, nuevos motores/dependencias, extractos persistentes ni cambios de guardado/recuperación.
