# H15-1 · Columna calculada en CSV

La entrada vive en «Filas y columnas», el menú estructural actual de FreyaLab. En la vista de archivo grande aparece deshabilitada junto a la búsqueda, con la explicación de solo lectura. El diálogo reutiliza «Transformar documento» y la ventana aislada de Análisis. «Aplicar» añade valores de texto en un paso de deshacer. «Guardar» sigue siendo una acción separada. La decisión sobre filas cortas se aplica antes de evaluar la fórmula y conserva los campos ausentes.

El [diseño original](../stories/historia-15-columna-calculada-diseno-para-codex.md) se comprobó con `cmp` y tiene SHA-256 `03b24fe8702865f86544abb588d87349391667931ab904ef371c748cc51d992b`. Las [siete respuestas del ADR 0021](../stories/h15-1-alcance-adr-0021.md) quedaron en el borrador antes del trabajo de interfaz.

## De rojo a verde

| Comprobación | Rojo reproducido | Verde observado |
| --- | --- | --- |
| Decimales exactos y cinco fórmulas fuera del contrato | `b7f6d42` rechazaba la operación de IPC | `30.30` y `0.30` exactos. Se rechazan varias sentencias, subconsultas, `read_csv`, agregados y ventanas. Las lecturas del documento y del archivo siguen iguales. |
| Guardado de 200.000 × 6 | El serializador normalizaba comillas existentes y el SHA-256 del archivo guardado difería | Tres guardados en ARM y tres en Intel con el SHA-256 exacto esperado. El archivo conservó su hash hasta Guardar. |
| Conservación léxica en el motor | Cinco casos con cambios, comillas o estructura anterior fallaron con el guardado normal. Otro rojo reprodujo comillas perdidas tras deshacer una eliminación después de guardar. | Pruebas de UTF-8 con BOM, Windows-1252, UTF-16 LE con BOM, delimitadores, saltos mixtos, recuperación, filas movidas y deshacer/rehacer. |
| Cancelación y archivo reemplazado | Los tres casos del nuevo spec fallaron sobre `b7f6d42` | Electron verificó cancelación durante progreso real de vista previa y aplicación, rechazo de un reemplazo externo, validación de IPC y guardados de TSV, Windows-1252 y UTF-16 LE sin encabezados. |
| Interfaz | Los dos recorridos iniciales fallaron al buscar «Añadir columna calculada…» sobre el núcleo sin interfaz | Navegación por teclado, sugerencia con confirmación explícita, búsqueda/filtro/orden activos, cálculo de cambios pendientes, explicación de la fila corta, muestra deshabilitada, mensajes en español, inglés y `en-XA`. |

La prueba del analizador ejercita multiplicación, porcentaje, `round`, `coalesce`, año, mes, concatenación, `if`, fechas inválidas, división por cero, valores no escalares, Unicode y escape de identificadores. Los números de origen siguen como texto y se interpretan solo al elegir Número o Fecha para la fórmula. Los errores conocidos se presentan en el idioma del diálogo. El texto del motor, que puede estar en inglés, queda en «Ver detalle técnico». El vocabulario de funciones permitido se limita a operaciones escalares locales. Las funciones ausentes de esa lista, los nombres calificados y ciertos comentarios adjuntos a tokens se rechazan.

## Medición

Tres procesos de Electron por equipo, archivo sintético de 200.000 filas × 6 columnas y multiplicación decimal. El reloj de cálculo empieza con el documento abierto e incluye el arranque de DuckDB, la transferencia de datos, la vista previa y la aplicación. Guardar y la comparación SHA-256 se verifican aparte. Corrida del commit `9e16e1fe5429abdeb7ab58ec1df596475b368a31`. [Medición ARM e Intel](https://github.com/ruzer/freyalab/actions/runs/42685087172)

| Equipo | Vista previa y aplicación, tres repeticiones | Mediana | Mediana de guardado |
| --- | --- | ---: | ---: |
| Runner macOS Apple silicon | 4,99 / 4,54 / 4,44 s | 4,54 s | 0,47 s |
| Runner macOS Intel | 15,12 / 16,27 / 18,24 s | 16,27 s | 3,27 s |

ARM quedó por debajo de 10 s. En Intel se observa más espera para esta carga. El diálogo muestra progreso y permite cancelar. El workflow y el spec temporal de medición se retiraron en `04f12b6`. Los resultados son del ejecutable de desarrollo, con datos sintéticos y esas imágenes de runner.

## Comprobaciones locales y capturas

- `npm run check` pasó con cero errores y advertencias.
- `npm test` pasó 2.612 casos en 132 archivos. Quedó omitida la prueba preexistente que necesita Pandoc con soporte HTTP.
- `npm run test:e2e:csv -- tests/e2e/structure.spec.ts tests/e2e/calculated-column.spec.ts --retries=0` pasó 13 casos en macOS Apple silicon. El comando también construyó la aplicación.
- Capturas a 1440×900 en [español claro](h15-1-claro-1440x900.png), [inglés oscuro](h15-1-oscuro-en-1440x900.png), [`en-XA` oscuro](h15-1-oscuro-en-XA-1440x900.png) y [`en-XA` con colores forzados](h15-1-colores-forzados-en-XA-1440x900.png).

La inserción de Unicode y acentos se verificó en Electron. La composición con un IME físico y la medición de rendimiento del paquete instalado quedan pendientes. Los resultados de CI de cada plataforma se registran en el PR. Los ejemplos asistidos, los accesos adicionales al diálogo y los cálculos entre filas quedan para H15-2 y H15-3.
