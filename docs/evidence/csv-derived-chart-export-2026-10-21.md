# Exportación de gráficos desde muestras — 21 de octubre de 2026

Entrega de desarrollo `codex/csv-derived-chart-export`, sobre las entregas #16–#21 todavía pendientes de integración en main. No se fusiona automáticamente ni publica una nueva alfa. Mantiene el objetivo completo A–D.

## Comportamiento y límites

SVG, PNG y PDF pueden exportarse desde el panel Gráficos aunque el editor abra el CSV como muestra. El gráfico sigue calculándose sobre la fuente completa mediante DuckDB; no se convierte la muestra en un documento editable o exportable como CSV. Las vistas limitadas conservan sus avisos dentro de la imagen. La exportación es una instantánea del dibujo mostrado; no vuelve a leer el archivo para recalcularlo.

Se añade una operación explícita y validada para imágenes: UUID, formato SVG/PNG/PDF, SVG no vacío y revisión. Rechaza campos extra, tablas, HTML y formatos de datos. Requiere una fuente CSV abierta y vuelve a comprobar su revisión al elegir destino y antes de escribir. Una fuente cerrada o editada provoca un error, conservando los archivos. La invalidación del gráfico por cambios externos notificados sigue en el panel existente; no se afirma revalidación criptográfica del archivo en disco al exportar una imagen estática.

El guardián original de `exportDocument` sigue rechazando todos los formatos para una muestra. La nueva vía no llama al serializador tabular. Ambas usan el mismo escritor: selección de destino, extensión, protección de documentos abiertos/enlaces simbólicos, escritura atómica, saneado y ventana de exportación aislada. No se añaden dependencias ni otro motor gráfico.

La inspección del PNG detectó una sustitución de Inter al cargar el SVG como imagen. Se reutilizó la carga de fuentes que ya tenía el exportador HTML y se incorporaron las fuentes locales al propio SVG saneado. El PNG posterior conserva Inter; SVG/PDF/PNG comparten ese dibujo. Los SVG sin cierre reconocible se rechazan; no se presenta esta preparación como un validador XML general.

## Evidencia local

Node 24, Electron 44.9.2, macOS ARM. Tipos/componentes sin errores ni advertencias; 119 pruebas unitarias y 64 E2E sin reintentos, incluida compilación de producción. La suite de gráficos conserva seis casos; los dos nuevos verifican la nueva operación y sus rechazos. La revisión visual del PNG confirmó la corrección de fuentes.

Fixture real: CSV válido de más de 50 MiB, 2 400 filas y campos largos bajo el límite por registro. El editor mantiene una muestra de 200 filas; el gráfico usa las 2 400. Se exportan SVG/PNG/PDF, se comprueban dibujo/píxeles y contenido PDF, y el SVG incluye fuentes. La dispersión conserva el aviso de 2 000 de 2 400 puntos. SHA-256, fecha de modificación, documentos y recuperaciones confirman que el original sigue intacto. Se conservan resultados SVG/PNG/PDF como artefactos de la prueba.

Las pruebas de protocolo rechazan CSV/TSV/HTML, campos HTML/tabulares añadidos, SVG vacío, fuente no CSV, revisión antigua y destinos de documentos abiertos. Las unitarias comprueban también cancelación, cierre/cambio durante el diálogo y cambio de revisión durante el renderizado PDF, con liberación de la ventana. Exportar una imagen válida no guarda ni descarta cambios pendientes de un CSV editable.

## Distribución y pendientes

El PR registrará los resultados del mismo commit de CI y la copia instalada en el Mac. `charts.spec.ts` ya forma parte de los paquetes de los cuatro entornos: ahora hay 29 casos empaquetados en conjunto. Ejecución empaquetada no equivale a instalación manual de Windows/Linux/Intel ni a certificación de todas las complejidades posibles de CSV. Se mantienen los límites del análisis (256 MiB por fuente, dos millones de filas, 200 columnas y ocho millones de celdas), del dibujo y de la exportación PNG.

Fuera de esta entrega: exportación de resultados SQL como datos, navegación completa a filas faltantes, paleta y restantes criterios del objetivo. La consulta de GB y nuevas dependencias/motores no se incorporan.
