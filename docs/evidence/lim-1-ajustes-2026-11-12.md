# LIM-1 · Ajustes menores

Base: `main 052984378c1c1cce7d8785bd1150b0dc6fea56bc`, que incorpora #172. Worktree independiente y rama `codex/lim-1-ajustes-menores`. Los primeros rojos se prepararon mientras el propietario fusionaba #172; su fuente `6a5bb43` coincide con el código incorporado a esta base.

## Alcance

- Con «Un valor» exactamente vacío, Vista previa y Rellenar quedan deshabilitados. Ambos tienen título y descripción accesible «Escribe un valor para rellenar», también visible junto al formulario. El campo sigue editable; `0`, espacios literales, Valor anterior y Eliminar conservan su comportamiento. Los guards de preparar/aplicar también rechazan ese estado.
- Se reutilizan `plural()` y `formatList()`: concordancia de rellenar/eliminar, omisión de categorías cero y resumen sin lista cuando no hay cambios. También se comprueba «1 de 1 fila». El separador explícito evita que Svelte elimine el espacio: «Fila 4 / columna 5».
- Valor anterior se guarda y su hash debe diferir del original; tras deshacer se guarda de nuevo y se compara el hash original. No basta con comparar el archivo que aún no se había escrito.
- Solo cambian `CsvTransform.svelte`, los dos catálogos y su E2E. Sin cambios de motor, guardado, IPC, dependencias, CI ni plazos.

## Rojo → verde

| Criterio | Rojo real | Verde posterior |
| --- | --- | --- |
| 1 · Vacío y motivo accesible | [1 fallo](lim-1-ajustes/red-1.log): Vista previa estaba habilitada | Ambos botones bloqueados; motivo accesible; escritura, `0`, espacios y Anterior disponibles |
| 2 · Singular, categorías y posición | [2 casos fallidos es/en](lim-1-ajustes/red-2.log): «Se rellenarán 1 celda», categorías cero y «Row 4/ column 5» | Textos literales esperados en es/en para 0, 1 y 4 celdas, sin categorías cero y con espacios alrededor de `/` |
| 2 · Eliminación singular | [Fallo](lim-1-ajustes/red-2-delete.log): «Se eliminarán 1 de 7 filas» | «Se eliminará 1 de 7 filas» |
| 2 · Total de una fila | [Fallo](lim-1-ajustes/red-2-single-row.log): «Se eliminará 1 de 1 filas» | «Se eliminará 1 de 1 fila» / «Will delete 1 of 1 row» |
| 3 · Hash tras guardar/deshacer | Se fortalece la prueba existente, sin borrar aserciones de celdas | Guardar → hash distinto → deshacer → guardar → hash original |

Los nuevos casos observan la UI real y el puente existente, no un formateador duplicado. Los ejemplos previstos proceden de los CSV sintéticos; ninguna vista previa aplica cambios. Las comprobaciones heredadas de es, en, en-XA, temas, colores forzados, cancelación y fuente protegida se conservan.

## Comandos y resultados locales

macOS ARM, Node 24.22.1. Build actualizado antes de las ejecuciones directas de Playwright. Sin reintentos.

| Comando | Resultado |
| --- | --- |
| `npm run check` | [0 errores y 0 avisos](lim-1-ajustes/check-final.log) |
| `npm test` | [145 archivos; 2.739 aprobadas y 1 omitida](lim-1-ajustes/unit.log), 16,54 s |
| `playwright test tests/e2e/empty-values.spec.ts --project=csv --workers=1 --retries=0` | [20/20](lim-1-ajustes/final-focused.log), 25,4 s; 17 casos anteriores y 3 nuevos |
| `npm run build` | [Correcto](lim-1-ajustes/build-final.log) |

La omisión unitaria es el caso Windows-only de `package-smoke.test.ts:18`, no una nueva omisión. Pandoc real local 3.12.1 está disponible; ese binario no tiene soporte HTTP y la salida registra esa limitación.

## Verificación remota y límites

La validación completa y el paquete se delegan a la CI del nuevo head; sus resultados se registrarán en el PR sin crear commits solo para actualizar el estado. No se repitió localmente la suite E2E completa para estos ajustes; la tanda local cubre todos los recorridos de LIM-1.

Al preparar este documento todavía no se acredita CI del nuevo head, Intel, instalación manual ni actualización de la aplicación instalada. Sin fusión ni publicación.

Las copias de salida normalizan únicamente los blancos de final de línea y el cierre del archivo; los originales permanecen en `/private/tmp/freyalab-lim1-ajustes-evidence`. [Hashes de salidas](lim-1-ajustes/SHA256SUMS) y [fuentes verificadas](lim-1-ajustes/SOURCE-SHA256SUMS).
