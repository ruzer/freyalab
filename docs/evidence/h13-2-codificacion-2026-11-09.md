# H13-2 · Codificación de Markdown, TXT y Mermaid

Base `f2e3d7aa826c7d797261845373ef52a7ade111da`. Primera entrega de [H13-2](../stories/historia-13-editor-base-diseno-para-codex.md#h13-2-barra-de-estado-y-codificación). El selector de finales de línea y las métricas de la barra se revisan por separado.

| Caso | Rojo | Verde |
| --- | --- | --- |
| Lectura y guardado | 9 casos del servicio fallaron en la base. Electron rechazó Markdown legado y UTF-16 BE con el mensaje de UTF-8 no válido. | Markdown, TXT y Mermaid abren UTF-8 con/sin BOM y UTF-16 LE/BE con BOM. El respaldo Windows-1252 requiere confirmar la lectura y permite elegir Latin-1. |
| Integridad | El formato no se registraba aparte del texto. Una recuperación anterior podía mostrar el BOM como parte del contenido. | Se verifica la ida y vuelta de bytes con LF, CRLF y saltos mixtos. El BOM es metadato. Guardar como y recuperación conservan la codificación. La conversión se rechaza si habría pérdida, si el archivo cambió o si un destino legado no puede conservar su BOM. |
| Compatibilidad | Al aplicar al CSV el nuevo rechazo de Unicode irregular, una prueba mostró que dejaría de conservar un archivo que antes podía guardar. | El límite de Unicode se aplica a la codificación de documentos de texto. CSV Texto conserva su comportamiento y su recuperación, también en el caso UTF-16 irregular cubierto. |
| Interfaz | Los tres recorridos de Electron fallaron sobre el binario base antes de llegar al selector. | En español se confirma Windows-1252, se guarda sin cambiar bytes y se convierte de forma explícita a UTF-8. En inglés y en-XA se muestra UTF-16 BE con BOM y se conserva el archivo tras rechazar Latin-1. Se verifican teclado y foco. |

## Verificación local

| Comando | Resultado en macOS Apple silicon |
| --- | --- |
| `npm run check` | 0 errores y 0 avisos. |
| `npm run build` | Aprobado. |
| Vitest enfocado en codificación, documentos, CSV Texto, recuperación y activos | 167 aprobadas en nueve archivos, 14 de codificación. |
| `npx playwright test tests/e2e/text-encoding.spec.ts tests/e2e/markdown-assets.spec.ts --project=md --retries=0` | 13 aprobadas y 0 reintentos. |

El detector reutiliza la validación y la comprobación de ida y vuelta del códec de CSV Texto. Si el archivo carece de BOM y los bytes admiten más de una lectura, la elección se conserva durante la sesión abierta. Los guardados de Markdown con imágenes validan los bytes de destino antes de publicar los activos nuevos. El texto guarda la codificación actual hasta que se elige otra en el diálogo. Las muestras de más de 10 MiB siguen siendo de solo lectura.
