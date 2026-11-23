# PRJ-03 · Menos trabajo del analizador, sin cambiar los datos

Base `main@6e70d54995a8975ce234cd1a759a46b3d72d385e`, después de la fusión de #206 por el propietario. Código probado: `e9da15dd2407cbab3ff9afbaf94dbf919789546e`. Rama `codex/prj03-exportacion-estable`.

## Rojo real antes de modificar el producto

[CI main 45120143253](https://github.com/ruzer/freyalab/actions/runs/45120143253), [Intel CSV 137511797750](https://github.com/ruzer/freyalab/actions/runs/45120143253/job/137511797750): `project-subsets-perf.spec.ts:148` falla en ambos intentos; la exportación sigue pendiente cuando se agotan los 90 s del caso. La llamada de exportación ocupa 85,733 y 86,463 s antes del corte. No llegó a los oráculos posteriores ni a registrar un resultado. El error del cierre es posterior al corte, no su causa.

En `:183`, la muestra se exportó en 77.611 ms; sus comprobaciones posteriores consumieron aproximadamente 6,4 s y el análisis del resultado quedó sin presupuesto al final. El reintento exportó en 68.858 ms y completó el traspaso. No se atribuye el fallo a un aviso de carga, a la selección de la barra lateral ni a una pérdida de datos. La traza no separa las subfases internas del motor.

Artefacto Intel `14797366467`, ZIP SHA-256 `a9a2319ad9dd94d366b1445f8fbb5efb142575aee1ebe8aeaf65d17efc6cbf13`: tres trazas, sin snapshots del renderer. Se descargó y examinó antes del cambio. No se fabricó una regresión semántica: los 21 oráculos funcionales nuevos también pasan en main; el rojo es la prueba de rendimiento existente, que permanece intacta.

## Causa acotada y cambio mínimo

En una sonda privada del mismo fixture de 1.000.000.008 bytes, `fieldsOf` consumió 17.326 de 22.692 ms (76,4 % de la operación). Se llama al analizador existente `csv-parse` por lotes; con finales LF se comprobaban además CRLF y CR en cada posible final de registro.

Una condición en `operations.ts`: si el texto **ya decodificado** no contiene CR, `record_delimiter` es LF; si aparece cualquier CR —también dentro de un campo entrecomillado— se mantiene la lista completa anterior. No es un analizador nuevo. Se conservan la decodificación fatal de UTF-8, las comillas, la comprobación de cardinalidad del escáner y la localización del primer registro inválido.

El cambio alcanza el motor de recetas y las operaciones de CSV grande mediante el mismo `fieldsOf`. No cambia escáner, muestreo, orden, hashing, escritura, registro, IPC, guardado, interfaz, límites ni cancelación. No se toca ninguna espera ni reintento. Ninguna prueba eliminada.

## Medición local, sin extrapolar a Intel

Apple M2 Max, macOS ARM, Node 24.22.1. Sonda privada `runRecipe` con filtro ID > 500000; mismo fixture, oráculos y huellas. No es toda la app ni una calificación del plazo de Playwright. Una observación por variante, no una mediana.

| Fase | Antes, ms | Después, ms |
| --- | ---: | ---: |
| Operación completa | 22.692,336 | 20.398,839 |
| Interpretación de campos (501 lotes) | 17.326,392 | 14.958,566 |
| Lectura, escáner y huella de origen | 4.030,557 | 4.033,954 |
| Escritura (477 llamadas) | 364,450 | 410,106 |
| Publicación | 3,025 | 1,431 |
| Comprobación independiente de las huellas | 822,278 | 826,528 |

Reducción observada de la operación: **10,1 %**. Origen antes/después: `ad5e0f81fd1c132ed1347c7e717b14286aa7594294a9cd99df5d0bee756b4540`; salida de 500.000.008 bytes: `aa807009d987bc4d22f9a97d892edc5a43d6fe4cb38cd86574b5d6dbd863e81f`. El original no se modifica.

Sonda aislada adicional de csv-parse: doce pasadas intercaladas, 108 MB por pasada, 1.296 MB medidos, cuatro por variante. Medianas actual 2.631,8 ms; LF condicionado 2.114,9 ms (−19,6 %). Paridad de valores en 108.000 filas, 33 fixtures y 500 generados; otros 48 casos compararon los atributos del error salvo stack. Estas sondas solo justifican el cambio; no sustituyen el flujo de Electron ni Intel.

Se descartaron dos rutas: `quote:false` añadía otra condición por una mejora adicional pequeña, y entregar Buffer validado redujo solo 1,3 % con rangos solapados. No se incorporan.

## Verde local con la app real

Build actualizado de `e9da15dd`, `sourceModified:false`, un worker y cero reintentos. `npx playwright test tests/e2e/project-subsets-perf.spec.ts --workers=1 --retries=0`: **7/7**, 1,4 min. Incluye primeras filas, muestra, cancelación de preview, límite analítico de la raíz, filtro/exportación de medio millón, muestra/exportación de diez mil y cancelación/limpieza de exportación.

| Flujo público de Electron | Tiempo medido, ms | Salida | Pico observado de suma de Utility |
| --- | ---: | ---: | ---: |
| Exportación filtrada | 18.895,764 | 500.000.008 B | 314.352 KiB |
| Exportación de muestra | 16.494,293 | 10.000.008 B | 729.808 KiB |
| Añadir esa muestra como fuente → Información completa | 662,445 | 10.000 filas | fuera de la medición de exportación |
| Cancelar exportación a mitad | 8.276,467 | sin resultado/temporal | 679.856 KiB |

Los tiempos son los intervalos de los reportes del test, no la duración total del caso; los oráculos y las huellas posteriores se mantienen fuera del intervalo de exportación. El muestreo de memoria cada 50 ms es observacional, no una garantía de máximo. No se cambió ningún límite de memoria ni se afirma que un pico de proceso equivale a toda la app.

## Comprobaciones ejecutadas

| Comando | Resultado real |
| --- | --- |
| `npx vitest run tests/operations-fields.test.ts` antes del cambio | 21/21, 243 ms |
| `npx vitest run tests/operations-fields.test.ts tests/operations.test.ts tests/operations-search.test.ts tests/recipe-operation.test.ts tests/recipe-extract.test.ts tests/recipe-analysis.test.ts` | 109/109, 739 ms |
| `npm run check` | 0 errores, 0 avisos |
| `npm test` completo | 3.128 aprobadas, 2 omitidas existentes; 175 archivos aprobados y 1 omitido; 19,45 s |
| `npm run build` | exit 0 |
| E2E de 1 GB completa, comando anterior | 7/7, cero reintentos |

Las 21 pruebas verifican LF/CRLF/CR mixtos, CR dentro del contenido, utf8/utf16le/win1252, U+FEFF literal, campos ausentes frente a vacíos, filas irregulares, Unicode, identificadores largos, comillas inválidas, posición/cause del error, UTF-8 fatal y buffers intactos. BOM real y exportación atómica se cubren con las pruebas de recetas existentes.

## ADR 0021, siete respuestas

1. Herramienta existente: `csv-parse`, `fieldsOf` y `runRecipe`; se reutilizan, sin sustituir el motor.
2. Práctica reutilizable: diagnóstico de la traza, rojo real conservado, modificación mínima y oráculos de integridad.
3. API suficiente: opciones existentes del mismo parser; no se añade API o capacidad de usuario.
4. Madurez/seguridad/licencia: misma dependencia y licencia, sin relajar validación ni confinamiento de archivos.
5. Coste: una comprobación del texto que ya está decodificado; solo reduce alternativas imposibles.
6. Adaptación mínima: una condición y un comentario de semántica; el fallback conserva exactamente la ruta anterior.
7. Valor del código propio: escoger las opciones válidas para ese lote; no reproducir CSV, muestreo ni persistencia.

## Pendiente y no verificado

No se declara resuelto Intel hasta medir este código allí. La CI de las tres plataformas del PR y una validación Intel nueva están pendientes; resultados anteriores no se transfieren. No se ejecutó otra suite E2E local integral ni instaladores manuales. Las capturas existentes de PRJ-03 se reutilizan solo como referencia de una interfaz no modificada: no se presentan como capturas de este SHA.

La modificación temporal de CI propuesta para medir Intel requiere autorización específica del propietario y no forma parte del arreglo. Sin dependencias nuevas, fusión, publicación o actualización de la app instalada. Los otros dos reintentos independientes de main (reloj en column-menu y descripción accesible U0) siguen siendo seguimientos separados, no corregidos por este cambio.
