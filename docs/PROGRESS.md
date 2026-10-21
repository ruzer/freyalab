# Estado de implementación

[FreyaLab v0.1.0-alpha.1 publicada](https://github.com/ruzer/freyalab/releases/tag/v0.1.0-alpha.1).

Código de la versión: `7851ee284d3bc6a068cbeffc6088af8e5a3cf46a`. La documentación posterior puede avanzar sin cambiar los binarios ni esa etiqueta.

| Entrega | Resultado comprobado |
|---|---|
| 1. Repositorio y base visual | Repositorio público MIT; diseño conservado como referencia y recursos locales incluidos |
| 2. Archivos y recuperación | Apertura, edición, guardado, conflicto externo, protección entre pestañas y recuperación tras caída |
| 3. Markdown y PDF | Fórmulas, Mermaid e imagen local; PDF multipágina con imagen incrustada y texto del diagrama |
| 4. CSV/TSV | Motor independiente, virtualización, filtros, edición, valores textuales y límites; muestras grandes de solo lectura |
| 5. Diagramas y exportaciones | SVG, PNG, PDF, HTML autónomo y CSV/TSV; exportar conserva cambios pendientes |
| 6. Fidelidad y robustez | Capturas, rendimiento y revisión de integridad; 28 unitarias y 17 E2E en cuatro entornos de CI |
| 7. Alfa pública | Cinco binarios construidos, ejecutados e instalados/extraídos; hashes comprobados y prerelease pública |

La implementación se presentó en commits temáticos dentro de PR #1 y se cerró con PR #2 para licencias y PDF. No se afirma que cada commit intermedio compile por separado. PR #3 fue una operación temporal de transferencia, cerrada sin integrarse.

## Gates de esta publicación

- [x] Código integrado en main con revisión.
- [x] CI satisfactoria sobre el SHA de publicación.
- [x] Comprobaciones funcionales y de seguridad.
- [x] Capturas y rendimiento documentados.
- [x] Cinco formatos construidos y ejecutados.
- [x] Instalación o extracción comprobada según formato.
- [x] Licencias y avisos incluidos.
- [x] SHA-256 locales y remotos contrastados.
- [x] Prerelease publicada con límites y advertencias.

[Ver evidencia y entornos reales](evidence/release-v0.1.0-alpha.1.md). Siguen pendientes las comprobaciones manuales de Gatekeeper/SmartScreen e integración del escritorio, y una aprobación visual manual en todos los sistemas. La alfa no tiene firma comercial ni notarización. Los archivos de GB siguen siendo muestras limitadas; no hay edición ni análisis integral de ellos.

## Mejoras posteriores a alpha.1

Barra Markdown con formato e inserciones asistidas y menú CSV con limpieza y duplicación. La [guía de edición](EDITOR-MENUS.md) describe alcance, deshacer y límites; la [evidencia local](evidence/editor-menus-2026-10-20.md) separa las comprobaciones de esta entrega de los binarios ya publicados. Mover filas/columnas y transponer quedan para entregas posteriores.

## Evolución CSV: propuesta y primera iteración

La [auditoría CSV y roadmap](CSV-ADVANCED-ROADMAP.md) compara Modern CSV, bibliotecas y fases, sin ampliar implícitamente la alfa. La rama `codex/csv-column-statistics` añade un panel de consulta por columna; ver [evidencia y límites](evidence/csv-statistics-2026-10-20.md). Pendiente de revisión/integración; no modifica los binarios publicados. PR #6 y #7 se mantienen separados y abiertos.


La rama de evolución CSV incorpora la auditoría histórica y las correcciones de alcance de exportación y pegado de los PR #6/#7, junto con el panel del PR #8. No fusiona esos PR ni modifica los binarios publicados.

## Consulta avanzada y objetivo analítico

`codex/csv-advanced-editing` añade condiciones Y/O (texto, vacíos, números exactos, fechas ISO, regex RE2) y orden por múltiples columnas, con formulario y errores que conservan la última vista válida. Reutiliza el motor de vista para exportación y pegado. [Guía](EDITOR-MENUS.md), [pruebas/medición](evidence/csv-query-2026-10-21.md) y [seguimiento completo A–D](ANALYTICS-DELIVERY.md).

La entrega se apila sobre el PR #8 e incorpora los commits de corrección de #6/#7; ninguno se fusiona automáticamente. Local: check sin errores/advertencias, 41 unitarias, 28 E2E y licencias verificadas. El objetivo sigue activo: faltan rangos/edición masiva contextual, análisis restante, DuckDB y los seis gráficos ECharts. La alfa publicada conserva sus binarios y límites.

## Rangos y edición masiva CSV

La rama `codex/csv-range-editing`, apilada sobre el PR #9, añade selección rectangular por ratón/teclado, navegación virtual, menú contextual y acciones compartidas para copiar/cortar/pegar/rellenar/vaciar/limpiar/reemplazar. Los cambios pasan por vista previa y mantienen un único historial y recuperación. El portapapeles se gestiona mediante operaciones nativas validadas; se retiró la copia redundante de filas seleccionadas en el renderer.

Ver [guía](EDITOR-MENUS.md), [evidencia](evidence/csv-range-2026-10-21.md) y [objetivo completo A–D](ANALYTICS-DELIVERY.md). No se amplían los límites de archivos ni se declaran implementados DuckDB/ECharts o el análisis restante. Requiere revisión; sin fusión ni publicación automáticas.
