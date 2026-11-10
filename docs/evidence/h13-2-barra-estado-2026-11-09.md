# H13-2 · Barra de estado y finales de línea

Base `f2e3d7aa826c7d797261845373ef52a7ade111da`. La codificación de archivos se entrega por separado.

## Rojo → verde

| Caso | Antes | Después |
| --- | --- | --- |
| Líneas físicas en Markdown mixto | Un archivo con cuatro líneas físicas se mostraba en dos líneas. La sesión conservaba los bytes, pero el separador fijo CRLF no reconocía el resto de los saltos. | Se usa el modelo de finales exactos de CSV Texto también en Markdown, Texto y Mermaid. Las cuatro líneas se ven y la fuente se conserva. |
| Selección y estado | Electron encontró el editor de Markdown, pero faltaba la barra de estado. | Posición, selección, sangría, formato y LF/CRLF se prueban en los cuatro editores. El conteo usa unidades visuales para columnas y caracteres. |
| Conversión y guardado | No se podía elegir LF/CRLF. | El cambio conserva la selección, se deshace en un paso y se guarda solo al confirmar Guardar. Pruebas de lectura del archivo antes y después en los cuatro formatos. |
| Recarga externa | Después de recargar CRLF, el siguiente salto seguía siendo LF si ese era el final anterior. | Al adoptar todo el texto se usa el primer final de línea de la nueva fuente, también para el siguiente salto. |
| Inglés y en-XA | No existía el control. | En Electron a 800 × 720 el control es visible y enfocable, se anuncia el cambio y vuelve el foco al editor. La prueba usa la selección de opciones de Playwright, sin simular el selector nativo del sistema operativo. |

La barra mantiene los indicadores previos de codificación y estado de guardado. La conversión de CSV Texto incluye los saltos dentro de celdas entrecomilladas porque actúa sobre todos los finales del borrador. Los límites de edición siguen en el proceso principal.

## Medición local del modelo

Sondeo en Vitest con entradas sintéticas ASCII, Apple silicon, una ejecución por tamaño. El tiempo de conversión incluye el cambio, su incorporación al historial y reconstruir el texto resultante. El tiempo de selección se mide sobre Seleccionar todo. No son tiempos de la interfaz ni del disco.

| Tamaño y finales LF | Conteo de selección | Conversión a CRLF |
| --- | ---: | ---: |
| 8.170.000 bytes, 190.000 saltos | 62 ms | 302 ms |
| 2.000.000 bytes, 1.000.000 de saltos | 47 ms | 1.877 ms |

La conversión explícita tiene un costo mayor cuando el archivo contiene muchísimas líneas cortas. Mantener la selección y el historial requiere conservar los finales anteriores para deshacer.

## Validación

- `npm run check` · 0 errores, 0 avisos.
- `npm run build` · compilación correcta.
- `npm test` · 2.624 aprobadas y una omitida por la compilación local de Pandoc sin soporte HTTP.
- Electron, `--retries=0` · 126/126 en `editor-status`, `markdown-tasks`, `markdown-assets`, `markdown-editing`, `text-stats`, `outline`, `mermaid-diagnostics` y `csv-text`. Tras ajustar la preferencia al recargar y conectar los nombres LF/CRLF al catálogo, 5/5 en aceptación, recarga y CSV con saltos mixtos en la compilación final.
- Windows, Ubuntu, Intel, la suite E2E completa y el selector del sistema con teclado físico quedan fuera de la verificación local.
