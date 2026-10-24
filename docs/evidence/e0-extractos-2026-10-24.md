# E0 — Mediciones de extractos, 24 de octubre de 2026

**Medido localmente; no es una capacidad de producto ni una certificación multiplataforma.** Base del ensayo `36c99766d62aca23792d1c28cabebd66422f069e`; banco de ventas/formatos `a1cd9fd` (snapshot local antes del rebase), con hashes de scripts en cada JSON. El mismo contenido del banco está publicado en `ebe64a2` sobre `main@3c3c9ac`; se verificó por esos hashes, no se repitió el benchmark por un cambio de menús. El sondeo de bordes registra sus propios hashes.

## Equipo y método

Apple M2 Max, 32 GiB de RAM; macOS-27.0.1-arm64-arm-64bit-Mach-O. Una repetición por combinación, procesos separados, caché caliente. Tiempo de pared del proceso (incluye arranque); RSS de `time -l` convertido a MiB. Verificación posterior excluida. No se ejecutó Electron durante las mediciones.

Versiones: python: `Python 3.15.0`; pandas: `3.12.14 2.2.3`; node: `v24.22.1`; duckdb: `v1.5.6 (Variegata) 069cc9f9b5`. Sin instalaciones/descargas. pandas procede del runtime ya disponible; usa otro intérprete.

Los seis trabajos y las limitaciones metodológicas se definen en [el diseño E0](../design/LARGE-DATA-EXTRACTS.md). pandas mide lectura por chunks y bucle Python; Node T1 no valida completamente CSV; escritura no compara durabilidad homogénea. No se infiere el mejor rendimiento posible de cada biblioteca.

## Fuentes y original intacto

| Archivo | Bytes | SHA-256 antes = después |
|---|---:|---|
| ventas_100MiB.csv | 104,878,987 | `826c9d2a98639425e02a09df97d909671bfd67ee4851f8c4f79aa046990d6a9d` |
| ventas_1GiB.csv | 1,073,832,889 | `c6e427b9fda544b580e049855086427b2472c55f4b96ac61c511abc5ffdb31a5` |

21 columnas, generador sintético con semilla 20261023, UTF-8/CRLF y notas multilínea. No son datos personales. [Generador reproducible](../../experiments/large-data-extracts/generate_sales.py); [resultados completos](../../experiments/large-data-extracts/results/ventas.json).

## Tiempo y RSS medidos

Cada celda: **segundos / MiB RSS**. T1 contar; T2 filtro; T3 extracción proyectada; T4 agrupación y suma exacta; T5 reemplazo a archivo nuevo; T6 búsqueda multilínea.

### ventas_100MiB.csv

| Comparador | T1 | T2 | T3 | T4 | T5 | T6 |
|---|---:|---:|---:|---:|---:|---:|
| python | 0.994 / 18.8 | 1.032 / 18.7 | 1.191 / 19.0 | 1.610 / 18.6 | 2.316 / 18.9 | 1.255 / 18.8 |
| node | 0.263 / 135.1 | 0.603 / 135.3 | 1.028 / 189.9 | 0.698 / 135.9 | 1.104 / 255.2 | 1.224 / 135.9 |
| duckdb | 0.343 / 125.0 | 0.344 / 124.1 | 0.379 / 125.3 | 0.692 / 127.1 | 0.817 / 127.3 | 0.518 / 126.3 |
| pandas | 1.425 / 242.7 | 1.471 / 238.0 | 1.627 / 240.1 | 2.129 / 243.2 | 2.730 / 242.4 | 1.751 / 243.1 |

### ventas_1GiB.csv

| Comparador | T1 | T2 | T3 | T4 | T5 | T6 |
|---|---:|---:|---:|---:|---:|---:|
| python | 10.092 / 18.7 | 10.480 / 18.8 | 11.877 / 18.7 | 16.598 / 19.0 | 23.365 / 19.0 | 12.706 / 18.8 |
| node | 1.959 / 191.7 | 5.767 / 221.5 | 9.425 / 320.3 | 6.652 / 222.0 | 10.481 / 263.3 | 11.833 / 221.8 |
| duckdb | 3.124 / 482.1 | 3.166 / 482.2 | 3.429 / 482.4 | 6.763 / 485.1 | 8.035 / 499.6 | 4.942 / 498.8 |
| pandas | 13.586 / 544.3 | 13.717 / 543.8 | 15.172 / 544.8 | 21.137 / 546.8 | 27.693 / 545.6 | 17.249 / 544.0 |

**48/48** resultados coinciden con el oráculo por recuento y SHA de resultados/valores. No se exige que un CSV normalizado tenga el mismo hash binario. SHA binario, SHA de valores y fidelidad por registro están separados en JSON.

| Fuente | T1 registros | T2/T3 coincidencias | T6 registros con texto |
|---|---:|---:|---:|
| ventas_100MiB.csv | 448,000 | 112,233 | 74,257 |
| ventas_1GiB.csv | 4,587,000 | 1,146,807 | 764,648 |

## El extracto no resuelve por sí solo la edición grande

T3 de 100 MiB produce **112.233 × 4 campos**, 4,55 MiB (Python/Node/pandas), dentro de los límites de bytes y celdas actuales. T3 de 1 GiB produce **1.146.807 × 4 = 4.587.228 celdas**, 46,49 MiB. Aunque ocupa menos de 50 MiB, **supera dos millones de celdas y no sería íntegramente editable con la ruta actual**. DuckDB produce 45,40 MiB por normalización; tampoco reduce el recuento de celdas. Se necesita una selección menor o L3, no cambiar silenciosamente el límite ni llamarlo completo.

En este ensayo T3 DuckDB tarda 3,429 s y Node 9,425 s para 1 GiB, pero el primero requiere ~482 MiB RSS frente a ~320 MiB y normaliza salida. El conteo Node tarda 1,959 s frente a 3,124 s de DuckDB, con validación distinta; T4 es 6,652 s Node y 6,763 s DuckDB. **No hay un ganador universal** ni motivo suficiente para introducir un runtime nuevo.

## Fidelidad y formatos

T5 de ventas cambia exactamente **1.145.084** registros en 1 GiB; el resto (3.441.917 incluyendo cabecera) coincide por valores. Node conserva sus bytes. Python/pandas también coinciden en los bytes intactos de este fixture concreto porque el escritor usa el mismo formato mínimo/CRLF; eso no demuestra preservación general. DuckDB conserva valores pero normaliza los registros. Ningún original cambia.

En los fixtures pequeños con todos los campos entrecomillados, los tres escritores normalizadores ya no conservan los bytes intactos; el PoC Node sí. BOM y codificación se comprueban aparte.

| Formato pequeño | Python csv | Node PoC | DuckDB CLI sin extensiones | pandas configurado |
|---|---|---|---|---|
| UTF-8 | 6/6 valores exactos | 6/6 | 6/6; salida normalizada | 6/6 |
| UTF-8+BOM | 6/6; conserva BOM | 6/6; conserva BOM | 6/6; salida sin BOM | 6/6; conserva BOM |
| UTF-16 LE+BOM | 6/6; conserva formato de salida configurado | 6/6; conserva BOM/bytes intactos T5 | 6/6 valores; salida UTF-8 sin BOM | 6/6 |
| Windows-1252 (incluye €) | 6/6 | 6/6 | **No compatible en esta configuración**, 6 rechazos; no se descargó extensión | 6/6 |

[Formatos JSON](../../experiments/large-data-extracts/results/formatos.json): **90 coincidencias y 6 casos no compatibles**, no 96 éxitos. T3 proyecta columnas; identidad del registro completo no aplicable. T5 compara valores de todas las filas y bytes sólo de las que no cambian.

## Sondeo negativo: límites que impiden adoptar directamente

[Sondeo JSON](../../experiments/large-data-extracts/results/bordes.json), doce combinaciones pequeñas. El programa termina **2**, deliberadamente: hay garantías incumplidas. No es un test positivo de producto ni se oculta como verde.

| Caso | Python csv | Node PoC | DuckDB CLI | pandas |
|---|---|---|---|---|
| Fila corta vs última celda vacía; T5 | Valores/aridad 21/20/21/21 conservados | Valores/aridad conservados | Rechaza al detectar dialecto; no demuestra soporte irregular | Rellena fila de 20 a 21: **pérdida de ausencia** |
| Comilla sin cerrar; T1 | Rechazo de parsing | **Acepta entrada inválida** | Error de enlace `force_not_null/notas`; no demuestra rechazo correcto del parser | Rechazo de parsing |
| UTF-16 de longitud impar; T1 | Rechazo de decodificación | **Timeout 2 s**, grupo terminado; no es rechazo correcto | Rechazo en detección CSV | Rechazo de decodificación |

No se incorpora el escáner permisivo del PoC a producción. E1 necesita validación estricta y pruebas de rechazo/terminación, reutilizando `csv-parse` instalado o endureciendo el lector. Tampoco se presupone que L2 ya la resuelva: `large-table.ts` de #57 declara `splitFields` tolerante y su indexado no rechaza genéricamente comillas abiertas al EOF (hallazgo por código, no nuevo ensayo de L2). Sus controles de tamaño no equivalen a esa validación. La ruta estricta no hereda automáticamente los tiempos del PoC. No se habilita `ignore_errors`, padding silencioso ni conversiones automáticas para fabricar paridad.

## Pruebas y alcance de la revisión

- Prueba roja inicial del banco: módulo de integridad ausente; después, siete pruebas Python pasan. Incluyen sumas independientes calculadas a mano, IDs, aridad, BOM, multilínea y rechazo de comillas.
- Prueba roja de extracción PoC: `bulkTransform` accedía a `null.length` antes de omitir una fila. Corrección mínima **sólo experimental**, ahora 41/41 tests Node. No hay cambio de `src/`.
- Sobre la base inicial `36c9976`: check sin errores/avisos, 249/249 unitarias, build correcto y 158/158 E2E. Tras incorporar `main@3c3c9ac` (#56), se repitieron las cuatro comprobaciones: **check sin errores/avisos, 249/249 unitarias (26 archivos), build correcto y 167/167 E2E (5,6 min)**. Una sola suite nativa a la vez. La CI del PR se consulta en GitHub; no queda certificada por este resultado local.
- La matriz de paridad es auditoría por código; no se reejecutó L2/#57 ni se certifican sus pruebas aquí. #58 fue fusionado por el usuario, no por E0.

Pendiente de producto: L3–L9, cancelación por IPC/latencias del motor, falta de disco/caída al extraer, seguridad de SO, firma/empaquetado y escala Windows/Linux/Intel; motor Python distribuido y alternativas no instaladas sin medición. La anomalía de transformación a 10 GiB del RFC sigue sin resolver.

## Limpieza y privacidad

Sólo datos sintéticos. Los CSV de cada tarea de ventas/formatos se eliminaron tras verificar; los sondeos negativos y temporales restantes se limpian con inventario explícito al cierre. El estado final se registra a continuación; no equivale a borrado forense de SSD. Fuentes y generador recibidos quedan intactos.

Limpieza completada: [inventario y hashes finales](../../experiments/large-data-extracts/results/cleanup.json). Se retiraron sólo los subdirectorios propios de las siete ejecuciones de preparación/finales; no quedaron CSV de esas tareas. Los originales 100 MiB/1 GiB volvieron a comprobarse contra sus SHA iniciales. El generador reutilizado se comprobó con 1.000 filas (234.767 bytes), idénticas al prefijo recibido, sin regenerar los archivos grandes.

Checkout del usuario verificado: `codex/descriptive-percentiles@d19e068198ffb3d13a9eccce92ada42fd566d2f8`, sólo `graphify-out/` sin seguimiento, igual que al inicio. `src/`, manifiestos/lockfile, CI y `AGENTS.md` no tienen diferencias frente a la base de E0. No se tocó la instalación local ni el proyecto LAB.
