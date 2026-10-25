# M1 — Mediciones de motores externos, 25 de octubre de 2026

**Medido localmente; no es una capacidad de producto ni una certificación multiplataforma.** Continúa [E0](e0-extractos-2026-10-24.md) con las herramientas que E0 dejó sin medir (qsv, Miller y Polars), con el mismo banco (`experiments/large-data-extracts/`) y los mismos archivos de ventas. Decisión y arquitectura: [`docs/design/EXTERNAL-ENGINES.md`](../design/EXTERNAL-ENGINES.md).

## Equipo, método y procedencia

Apple M2 Max (12 núcleos), 32 GiB de RAM, macOS 27.0.1 ARM64. Una repetición por motor, tarea y archivo; un proceso por medición; caché caliente (cada fuente se lee entera para calcular su hash antes de cada medición); tiempo de pared del proceso, **con arranque y escritura de la salida y sin la verificación posterior**; RSS de `/usr/bin/time -l`. Las tareas T1–T6, el oráculo (Python `csv` estricto) y el contrato de importes son los de E0. No se ejecutó Electron ni otra carga mientras se medía.

Las herramientas se descargaron **solo en `/private/tmp/freyalab-m1`, fuera del repositorio**, con la autorización del usuario para M1. Ninguna entra en `package.json`, el lockfile ni el instalador. Procedencia, SHA-256 y licencias: [`m1-procedencia.json`](../../experiments/large-data-extracts/results/m1-procedencia.json). El SHA-256 de cada archivo descargado coincide con el que publica el proyecto (qsv, Miller) o está fijado por hash (wheels de PyPI, `integrity` de npm). Los binarios de qsv y Miller están firmados *ad hoc*, no notarizados.

| Herramienta | Versión | Licencia | Tamaño |
|---|---|---|---|
| qsv | 26.0.0 (19-oct-2026) | MIT | zip de 315 MiB con `qsv` (167 MB), `qsvlite` (17 MB), `qsvmcp` y cuatro `qsvpy` (~155 MB cada uno) |
| Miller | 6.22.0 (25-sep-2026) | BSD-2-Clause | `mlr` en un `.tar.gz` de 5,3 MiB |
| Polars (Python) | 2.0.0 (6-oct-2026) | MIT | wheel `polars` de 0,8 MiB + `polars-runtime-32` de 45,7 MiB |
| nodejs-polars | 0.26.1 (14-sep-2026), crates `polars-*` 0.55.2 | MIT | paquete de Node + binario nativo por plataforma |
| DuckDB CLI | 1.5.6 (Homebrew, ya instalado; no se descargó nada) | MIT | — |

`qsv --version` confirma que el binario completo incluye `fetch`, `foreach`, Luau, `geocode`, `magika`, `to`, `viz` y Polars 0.55.1 embebido; `qsvlite` solo trae `jemalloc` y `self_update`.

### Configuración de cada motor

- **Node PoC y Python:** los de E0 (el escáner de Node es permisivo; Python es el oráculo).
- **DuckDB:** SQL fijo del banco con `all_varchar=true`, `strict_mode=true`, `force_not_null`, extensiones y autoinstalación desactivadas. Tres variantes: la de E0 (1 hilo, `memory_limit=512MB`, `parallel=false`); 12 hilos con `parallel=false` (`duckdb-mt`); y 12 hilos con el lector paralelo (`duckdb-par`, `memory_limit=4GB`).
- **qsv / qsvlite:** T1 `count`; T2 y T3 son tuberías de dos o tres procesos (`search --exact` por `ciudad` y por `estado`, después `select`); T4 `sqlp` (solo qsv completo; qsvlite no lo trae); T5 `replace --literal -s ciudad`; T6 `search --literal` con `--count`. Sin índice.
- **Miller:** `-S` (sin inferencia de tipos), salida por defecto (LF). T2, T4 y T6 usan expresiones fijas del banco. `GOMAXPROCS=1` (`miller-1t`) **no cambió** ni el tiempo ni la relación CPU/pared: no limita a Miller.
- **Polars:** `scan_csv(infer_schema=False)`, `collect(engine='streaming')`, `sink_csv(line_terminator='\r\n')`. La variante de 1 hilo usa `POLARS_MAX_THREADS=1` y la relación CPU/pared de 1,0 confirma que se aplica. **nodejs-polars:** `scanCSV({inferSchemaLength: 0})` y `sinkCSV({lineTerminator: '\r\n'})`; la suma de T4 se convierte a texto dentro del motor (ver «Trampas»).
- Los motores con varias etapas (qsv T2/T3) informan el **mayor** RSS de una etapa, no la suma.

## Resultado: valores iguales al oráculo en todo lo medido

**142 de 142** mediciones de motores distintos del oráculo coinciden con él por recuento y hash de resultado (y de valores en T3 y T5). Las únicas ausencias son 100MiB/qsvlite/T4, 1GiB/qsvlite/T4 (qsvlite no incluye agrupación con suma). Los dos archivos de ventas conservan su SHA-256 antes y después.

## Rendimiento: segundos / MiB de RSS máximo / CPU÷pared

«CPU÷pared» es (usuario+sistema)/pared: ≈1,0 es un solo hilo; 9 son nueve núcleos ocupados.

### ventas_1GiB.csv (1 073 832 889 bytes, 4 587 000 registros)

| Motor | T1 | T2 | T3 | T4 | T5 | T6 |
|---|---:|---:|---:|---:|---:|---:|
| Python `csv` (oráculo) | 10.06 / 19 / 1.0 | 10.40 / 19 / 1.0 | 11.62 / 19 / 1.0 | 16.48 / 19 / 1.0 | 23.00 / 19 / 1.0 | 12.55 / 19 / 1.0 |
| Node PoC de E0 | 1.81 / 191 / 1.0 | 5.62 / 222 / 1.0 | 9.20 / 324 / 1.0 | 6.54 / 222 / 1.0 | 10.30 / 263 / 1.1 | 11.50 / 222 / 1.0 |
| DuckDB CLI 1.5.6, 1 hilo (config. E0) | 2.99 / 482 / 1.0 | 3.10 / 482 / 1.0 | 3.43 / 482 / 1.0 | 6.65 / 484 / 1.0 | 7.81 / 500 / 1.0 | 4.81 / 499 / 1.0 |
| DuckDB, 12 hilos, lector no paralelo | 3.04 / 1049 / 2.0 | 3.14 / 1050 / 1.0 | 3.43 / 1190 / 2.0 | 6.81 / 1053 / 2.0 | 8.83 / 4075 / 2.0 | 4.89 / 1073 / 2.0 |
| DuckDB, 12 hilos, lector paralelo | 0.41 / 180 / 9.2 | 0.47 / 182 / 8.6 | 0.49 / 245 / 9.0 | 0.85 / 220 / 10.0 | 1.23 / 1402 / 9.3 | 0.66 / 206 / 9.7 |
| qsv 26.0.0 (completo) | 0.48 / 1067 / 5.4 | 1.63 / 22 / 1.0 | 1.86 / 22 / 1.1 | 0.39 / 1058 / 9.3 | 4.04 / 22 / 1.0 | 1.75 / 22 / 1.0 |
| qsvlite 26.0.0 | 0.92 / 13 / 1.0 | 1.67 / 14 / 1.1 | 1.91 / 14 / 1.1 | no disponible | 4.19 / 14 / 1.0 | 1.68 / 14 / 1.0 |
| Miller 6.22.0 | 4.80 / 1011 / 1.8 | 4.84 / 1024 / 2.0 | 4.87 / 1030 / 2.1 | 6.10 / 1070 / 2.6 | 5.45 / 1082 / 3.6 | 16.56 / 1064 / 1.7 |
| Miller, `GOMAXPROCS=1` | 4.77 / 1007 / 1.8 | 4.82 / 1025 / 2.0 | 4.87 / 1025 / 2.1 | 6.16 / 1075 / 2.6 | 5.51 / 1080 / 3.6 | 16.59 / 1062 / 1.7 |
| Polars Python 2.0.0 | 0.25 / 1087 / 1.7 | 0.37 / 1401 / 4.8 | 0.40 / 1503 / 5.4 | 0.36 / 1204 / 5.3 | 0.62 / 1556 / 8.5 | 0.52 / 1580 / 6.3 |
| Polars Python, 1 hilo | 0.22 / 1080 / 1.0 | 1.55 / 1091 / 1.0 | 1.77 / 1094 / 1.0 | 1.60 / 1091 / 1.0 | 4.07 / 1114 / 1.0 | 2.60 / 1098 / 1.0 |
| nodejs-polars 0.26.1 | 0.22 / 1089 / 1.8 | 0.34 / 1224 / 5.3 | 0.34 / 1216 / 6.4 | 0.56 / 1348 / 3.5 | 0.56 / 1470 / 9.9 | 0.51 / 2084 / 6.9 |
| nodejs-polars, 1 hilo | 0.18 / 1089 / 1.0 | 1.55 / 1148 / 1.0 | 1.75 / 1122 / 1.0 | 1.66 / 1325 / 1.0 | 4.05 / 1174 / 1.0 | 2.70 / 1979 / 1.0 |

### ventas_100MiB.csv (104 878 987 bytes, 448 000 registros)

| Motor | T1 | T2 | T3 | T4 | T5 | T6 |
|---|---:|---:|---:|---:|---:|---:|
| Python `csv` (oráculo) | 0.99 / 19 / 1.0 | 1.03 / 19 / 1.0 | 1.17 / 19 / 1.0 | 1.65 / 19 / 1.0 | 2.24 / 19 / 1.0 | 1.24 / 19 / 1.0 |
| Node PoC de E0 | 0.26 / 135 / 1.0 | 0.59 / 135 / 1.0 | 1.01 / 189 / 1.1 | 0.66 / 136 / 1.0 | 1.08 / 259 / 1.1 | 1.18 / 136 / 1.0 |
| DuckDB CLI 1.5.6, 1 hilo (config. E0) | 0.33 / 124 / 0.9 | 0.34 / 124 / 1.0 | 0.37 / 124 / 1.0 | 0.69 / 126 / 1.0 | 0.81 / 127 / 1.0 | 0.51 / 126 / 1.0 |
| DuckDB, 12 hilos, lector no paralelo | 0.33 / 124 / 1.8 | 0.34 / 125 / 0.9 | 0.37 / 135 / 1.0 | 0.70 / 128 / 1.9 | 0.87 / 427 / 1.4 | 0.52 / 131 / 1.9 |
| DuckDB, 12 hilos, lector paralelo | 0.10 / 127 / 4.2 | 0.10 / 129 / 4.4 | 0.10 / 147 / 4.3 | 0.16 / 137 / 5.4 | 0.19 / 426 / 6.3 | 0.13 / 151 / 4.9 |
| qsv 26.0.0 (completo) | 0.06 / 145 / 4.0 | 0.17 / 22 / 1.0 | 0.20 / 22 / 1.0 | 0.06 / 157 / 5.6 | 0.41 / 22 / 1.0 | 0.18 / 22 / 0.9 |
| qsvlite 26.0.0 | 0.10 / 13 / 0.8 | 0.17 / 14 / 1.0 | 0.20 / 14 / 1.0 | no disponible | 0.42 / 14 / 1.0 | 0.17 / 14 / 0.9 |
| Miller 6.22.0 | 0.53 / 877 / 1.7 | 0.53 / 787 / 1.9 | 0.54 / 897 / 2.0 | 0.64 / 915 / 2.6 | 0.57 / 849 / 3.5 | 1.65 / 1044 / 1.8 |
| Miller, `GOMAXPROCS=1` | 0.53 / 804 / 1.7 | 0.53 / 816 / 1.9 | 0.54 / 782 / 2.0 | 0.64 / 890 / 2.6 | 0.58 / 926 / 3.5 | 1.65 / 1035 / 1.8 |
| Polars Python 2.0.0 | 0.11 / 163 / 1.2 | 0.14 / 261 / 2.0 | 0.14 / 279 / 2.1 | 0.14 / 268 / 2.1 | 0.16 / 382 / 3.9 | 0.15 / 341 / 2.9 |
| Polars Python, 1 hilo | 0.11 / 155 / 0.9 | 0.24 / 165 / 0.9 | 0.26 / 167 / 1.0 | 0.25 / 165 / 0.9 | 0.49 / 192 / 1.0 | 0.35 / 174 / 1.0 |
| nodejs-polars 0.26.1 | 0.05 / 165 / 1.3 | 0.08 / 210 / 2.7 | 0.08 / 232 / 3.1 | 0.11 / 236 / 2.3 | 0.11 / 339 / 5.1 | 0.10 / 352 / 4.0 |
| nodejs-polars, 1 hilo | 0.06 / 164 / 0.8 | 0.19 / 177 / 0.9 | 0.22 / 184 / 1.0 | 0.21 / 198 / 1.0 | 0.44 / 212 / 1.0 | 0.31 / 263 / 1.0 |

Lecturas que se sostienen con estos números (una repetición, un equipo):

1. **Con varios hilos, Polars y DuckDB con lector paralelo están en el mismo orden**: 0,25–0,62 s y 0,41–1,23 s por pasada de 1 GiB. DuckDB usa mucha menos memoria en cinco de las seis tareas (180–245 MiB frente a 1,1–1,6 GiB de Polars Python); en T5, que reescribe el archivo entero, sube a 1,4 GiB.
2. **La configuración de E0 de DuckDB no era lenta por el motor, sino por `threads=1` y `parallel=false`**: con 12 hilos y el lector no paralelo (`duckdb-mt`) los tiempos no cambian (CPU÷pared de 2,0 como mucho). Quien compare «DuckDB 3,4 s» con «Polars 0,4 s» está comparando configuraciones.
3. **Con un solo hilo**, qsvlite (0,92–4,19 s con 13–14 MiB) y Polars de 1 hilo (0,22–4,07 s con ~1,1 GiB) quedan por delante de DuckDB de 1 hilo (2,99–7,81 s con ~480 MiB), de Miller (4,80–16,56 s con ~1 GiB), del escáner de Node (1,81–11,50 s) y de Python (10,06–23,00 s).
4. **qsv completo**: `count` y `sqlp` (T1 y T4) usan varios núcleos y ~1 GiB de memoria, coherente con la documentación de que usan Polars; `search`, `select` y `replace` (T2, T3, T5, T6) van en flujo con 22 MiB.
5. **Miller** ocupa entre 1,7 y 3,6 núcleos y no baja de ~1 GiB de memoria; T6 (buscar en todos los campos con `joinv`) es su peor caso: 16,6 s.

## Fidelidad al reemplazar (T5, 1 GiB)

| Motor | Valores | Registros intactos, byte a byte | Ídem ignorando solo el fin de línea final | Registros cambiados |
|---|---|---|---|---:|
| Python `csv` (oráculo) | sí | sí | sí | 1,145,084 |
| Node PoC de E0 | sí | sí | sí | 1,145,084 |
| DuckDB CLI 1.5.6, 1 hilo (config. E0) | sí | no | no | 1,145,084 |
| qsv 26.0.0 (completo) | sí | no | sí | 1,145,084 |
| qsvlite 26.0.0 | sí | no | sí | 1,145,084 |
| Miller 6.22.0 | sí | no | sí | 1,145,084 |
| Polars Python 2.0.0 | sí | sí | sí | 1,145,084 |
| nodejs-polars 0.26.1 | sí | sí | sí | 1,145,084 |

«Valores» compara lo que lee un analizador independiente. qsv, qsvlite y Miller escriben LF (4 587 001 bytes menos que el original, uno por registro); Polars y nodejs-polars respetan CRLF porque se configuró; DuckDB además cambia el comillado (escribe `""` para una cadena vacía) y no conserva el BOM.

## Copiar sin transformar: valores, estructura y bytes por separado

Seis fixtures pequeños (`probe_m1_integrity.py`) atraviesan «copiar todas las columnas» en cada herramienta. **V** = valores iguales según un analizador independiente; **E** = mismo número de campos en cada registro; **B** = bytes de los registros: ✓ idénticos, ~ idénticos salvo el fin de línea final, ✗ distintos.

| Herramienta | minimal_crlf | minimal_lf | quote_all | hostile | ragged | bom_utf8 |
|---|---|---|---|---|---|---|
| qsv | V✓ E✓ B~ | V✓ E✓ B✓ | V✓ E✓ B✗ | V✓ E✓ B✗ | error | V✓ E✓ B~ |
| qsvlite | V✓ E✓ B~ | V✓ E✓ B✓ | V✓ E✓ B✗ | V✓ E✓ B✗ | error | V✓ E✓ B~ |
| Miller | V✓ E✓ B~ | V✓ E✓ B✓ | V✓ E✓ B✗ | V✗ E✓ B✗ | error | V✓ E✓ B~ |
| Miller `--ors crlf` | V✓ E✓ B✓ | V✓ E✓ B~ | V✓ E✓ B✗ | V✗ E✓ B✗ | error | V✓ E✓ B✓ |
| Polars | V✓ E✓ B~ | V✓ E✓ B✓ | V✓ E✓ B✗ | V✓ E✓ B✗ | V✗ E✗ B✗ | V✓ E✓ B~ |
| Polars CRLF | V✓ E✓ B✓ | V✓ E✓ B~ | V✓ E✓ B✗ | V✓ E✓ B✗ | V✗ E✗ B✗ | V✓ E✓ B✓ |
| nodejs-polars | V✓ E✓ B~ | V✓ E✓ B✓ | V✓ E✓ B✗ | V✓ E✓ B✗ | V✗ E✗ B✗ | V✓ E✓ B~ |
| nodejs-polars CRLF | V✓ E✓ B✓ | V✓ E✓ B~ | V✓ E✓ B✗ | V✓ E✓ B✗ | V✗ E✗ B✗ | V✓ E✓ B✓ |
| DuckDB | V✓ E✓ B✗ | V✓ E✓ B✗ | V✓ E✓ B✗ | V✓ E✓ B✗ | error | V✓ E✓ B✗ |

- **Miller cambia valores**: en `hostile`, un CRLF *dentro* de un campo entrecomillado sale como LF; y con `--ors crlf` ocurre lo contrario, los LF internos salen como CRLF (495 registros en una muestra de 3 000). No hay opción para evitarlo.
- **Ninguna herramienta conserva un archivo con todos los campos entrecomillados** (`quote_all`) ni el BOM de UTF-8. Los bytes solo se conservan cuando el comillado ya era el mínimo y se configura el fin de línea.
- **Polars (Python y Node) rellena en silencio una fila corta** (`1,01000,Ana` → `1,01000,Ana,`); qsv, qsvlite, Miller y DuckDB la rechazan con error. qsv da el número de registro y el byte («record 1 (line: 1, byte: 19): found record with 3 fields, but the previous record has 4 fields»).
- Con LF en el original, qsv, qsvlite, Miller y Polars (Python y Node) devuelven el archivo **byte a byte** (`minimal_lf`).
- En `bom_utf8` la columna B compara los registros ya sin el BOM; **ninguna herramienta conserva el BOM** (`bom_preserved` es falso en todas).

## Codificaciones (`--micro`, cuatro fixtures de cuatro registros)

✓ coincide con el oráculo · ✗ resultado distinto sin error · E error del motor · n/c no compatible.

| Codificación | Motor | T1 | T2 | T3 | T4 | T5 | T6 |
|---|---|---|---|---|---|---|---|
| utf-8 | Python `csv` (oráculo) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| utf-8 | Node PoC de E0 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| utf-8 | DuckDB CLI 1.5.6, 1 hilo (config. E0) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| utf-8 | qsv 26.0.0 (completo) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| utf-8 | qsvlite 26.0.0 | ✓ | ✓ | ✓ | n/c | ✓ | ✓ |
| utf-8 | Miller 6.22.0 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| utf-8 | Polars Python 2.0.0 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| utf-8 | nodejs-polars 0.26.1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| utf-8-sig | Python `csv` (oráculo) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| utf-8-sig | Node PoC de E0 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| utf-8-sig | DuckDB CLI 1.5.6, 1 hilo (config. E0) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| utf-8-sig | qsv 26.0.0 (completo) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| utf-8-sig | qsvlite 26.0.0 | ✓ | ✓ | ✓ | n/c | ✓ | ✓ |
| utf-8-sig | Miller 6.22.0 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| utf-8-sig | Polars Python 2.0.0 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| utf-8-sig | nodejs-polars 0.26.1 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| utf-16 | Python `csv` (oráculo) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| utf-16 | Node PoC de E0 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| utf-16 | DuckDB CLI 1.5.6, 1 hilo (config. E0) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| utf-16 | qsv 26.0.0 (completo) | E | E | E | E | E | E |
| utf-16 | qsvlite 26.0.0 | E | E | E | n/c | E | E |
| utf-16 | Miller 6.22.0 | E | E | E | E | E | E |
| utf-16 | Polars Python 2.0.0 | ✗ | E | E | E | E | E |
| utf-16 | nodejs-polars 0.26.1 | ✗ | E | E | E | E | E |
| cp1252 | Python `csv` (oráculo) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| cp1252 | Node PoC de E0 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| cp1252 | DuckDB CLI 1.5.6, 1 hilo (config. E0) | n/c | n/c | n/c | n/c | n/c | n/c |
| cp1252 | qsv 26.0.0 (completo) | ✓ | ✓ | E | E | E | E |
| cp1252 | qsvlite 26.0.0 | ✓ | ✓ | E | n/c | E | E |
| cp1252 | Miller 6.22.0 | ✓ | ✓ | E | ✗ | E | ✗ |
| cp1252 | Polars Python 2.0.0 | ✓ | E | E | E | E | E |
| cp1252 | nodejs-polars 0.26.1 | ✓ | E | E | E | E | E |

- **UTF-8 y UTF-8 con BOM**: todos coinciden.
- **UTF-16 LE con BOM**: qsv, qsvlite y Miller fallan con error. **Polars (Python y Node) devuelve un recuento (4) que no coincide, sin error**, y falla en las demás tareas.
- **Windows-1252**: DuckDB lo rechaza (como en E0). qsv y Miller leen los bytes tal cual: contar y filtrar por columnas ASCII da el resultado correcto. Polars cuenta, pero falla al filtrar. **Buscar «Primera línea» devuelve 0 sin error en Miller y «sin coincidencias» en qsv (código de salida 1)**, porque la `í` de Windows-1252 no es la `í` de UTF-8; y la salida de T3 y T5 no es UTF-8 válida. Es un resultado equivocado sin aviso.

## Casos límite (`probe_edges.py`; sale con código 2 a propósito)

| Caso | Python `csv` | Node PoC de E0 | DuckDB CLI 1.5.6, 1 hilo | qsv 26.0.0 | qsvlite 26.0.0 | Miller 6.22.0 | Polars Python 2.0.0 | nodejs-polars 0.26.1 |
|---|---|---|---|---|---|---|---|---|
| Fila corta (T5) | conserva | conserva | rechaza | rechaza | rechaza | rechaza | **rellena/pierde** | **rellena/pierde** |
| Comilla sin cerrar (T1) | rechaza | **la acepta** | error sin causa clara | **la acepta** | **la acepta** | rechaza | **la acepta** | **la acepta** |
| UTF-16 de longitud impar (T1) | rechaza | **se cuelga (2 s)** | rechaza | rechaza | rechaza | error sin causa clara | **la acepta** | **la acepta** |

**El lector paralelo de DuckDB (`duckdb-par`) mantiene los mismos rechazos y la misma compatibilidad de codificación** en estos fixtures ([`m1-bordes-duckdb-par.json`](../../experiments/large-data-extracts/results/m1-bordes-duckdb-par.json), [`m1-formatos-duckdb-par.json`](../../experiments/large-data-extracts/results/m1-formatos-duckdb-par.json)); sus rechazos ocurren al detectar el dialecto («Error when sniffing file») y no dan registro ni byte. Python, Node y DuckDB se volvieron a medir con el mismo banco. Miller y qsv rechazan la fila corta con un mensaje claro; ninguno rechaza la comilla sin cerrar con una causa atribuida al parsing de comillas (qsv la acepta; Miller la rechaza por «header/data length mismatch»).

## Cancelación (T5 sobre 1 GiB, a 0,3 s de empezar)

Se lanza cada motor en su propio grupo de procesos y se envía SIGTERM o SIGKILL al grupo. Es una prueba de **proceso hijo con grupo propio**, no de la cancelación por IPC de la aplicación ni de `interrupt()` de DuckDB.

| Motor | Señal | El grupo desaparece en | Procesos que quedan | Salida parcial que queda | Temporales |
|---|---|---:|---|---:|---:|
| DuckDB CLI 1.5.6, 1 hilo (config. E0) | SIGTERM | 2.6 ms | ninguno | 31 MiB | 0 B |
| DuckDB CLI 1.5.6, 1 hilo (config. E0) | SIGKILL | 2.6 ms | ninguno | 29 MiB | 0 B |
| Node PoC de E0 | SIGTERM | 5.0 ms | ninguno | 16 MiB | 0 B |
| Node PoC de E0 | SIGKILL | 5.0 ms | ninguno | 16 MiB | 0 B |
| qsv 26.0.0 (completo) | SIGTERM | 2.5 ms | ninguno | 71 MiB | 0 B |
| qsv 26.0.0 (completo) | SIGKILL | 2.5 ms | ninguno | 70 MiB | 0 B |
| qsvlite 26.0.0 | SIGTERM | 2.5 ms | ninguno | 67 MiB | 0 B |
| qsvlite 26.0.0 | SIGKILL | 2.5 ms | ninguno | 69 MiB | 0 B |
| Miller 6.22.0 | SIGTERM | 7.6 ms | ninguno | 45 MiB | 0 B |
| Miller 6.22.0 | SIGKILL | 9.5 ms | ninguno | 45 MiB | 0 B |
| Polars Python 2.0.0 | SIGTERM | 10.1 ms | ninguno | 344 MiB | 0 B |
| Polars Python 2.0.0 | SIGKILL | 10.1 ms | ninguno | 349 MiB | 0 B |
| nodejs-polars 0.26.1 | SIGTERM | 10.1 ms | ninguno | 429 MiB | 0 B |
| nodejs-polars 0.26.1 | SIGKILL | 7.6 ms | ninguno | 396 MiB | 0 B |

Todos terminan en menos de 11 ms y ninguno deja procesos. **Todos dejan la salida parcial** (16–429 MiB): quien lanza el proceso debe borrarla. Los temporales de este banco son 0 porque estas tareas no usan carpeta temporal.

## Ordenar el archivo entero por `fecha_pedido` (1 GiB, a un archivo nuevo)

Memoria: suma de RSS del grupo de procesos, muestreada cada 0,25 s (puede subestimar picos). El banco corta la ejecución si el grupo supera 20 GiB. «Correcto» = mismos 4 587 000 registros (hash independiente del orden), ordenados por la clave.

| Motor | Estado | Tiempo | RSS pico (grupo) | Temporales pico | Correcto |
|---|---|---:|---:|---:|---|
| duckdb | medido | 3.3 s | 3.68 GiB | 0.00 GiB | sí |
| qsv-extsort | error de uso | 0.0 s | 0.00 GiB | 0.00 GiB | — |
| qsvlite-extsort | error de uso | 0.0 s | 0.00 GiB | 0.00 GiB | — |
| polars | medido | 1.4 s | 3.77 GiB | 0.00 GiB | sí |
| polars-node | medido | 1.6 s | 5.61 GiB | 0.00 GiB | sí |
| qsv-sort | medido | 4.6 s | 2.58 GiB | 0.00 GiB | sí |
| miller | medido | 31.9 s | 10.84 GiB | 0.00 GiB | sí |

Con memoria suficiente nada usa temporales (DuckDB con 4 GB ordena 1 GiB en RAM). Para forzar el derrame:

| Motor | Estado | Tiempo | RSS pico (grupo) | Temporales pico | Correcto |
|---|---|---:|---:|---:|---|
| duckdb-1gb | medido | 5.0 s | 1.34 GiB | 0.95 GiB | sí |
| qsv-extsort | medido | 44.9 s; índice 1.0 s, 35 MiB | 0.28 GiB | 0.18 GiB | sí |
| qsv-extsort-256mb | medido | 44.9 s; índice 0.9 s, 35 MiB | 0.28 GiB | 0.18 GiB | sí |
| qsvlite-extsort-256mb | medido | 45.0 s; índice 0.9 s, 35 MiB | 0.27 GiB | 0.19 GiB | sí |

- El modo CSV de `qsv extsort` **exige un índice y `qsv index` lo escribe junto al archivo de entrada** (`<entrada>.idx`, 35 MiB). Aquí se indexó un enlace simbólico dentro de la carpeta temporal y no apareció ningún `.idx` en la carpeta de las fuentes. La primera invocación (sin índice) terminó con código 2.
- Miller ordena en memoria: 31,9 s y 10,8 GiB de RSS para 1 GiB de CSV. Con 5 GiB superaría la RAM de este equipo.
- `memory_limit=1GB` de DuckDB dejó un RSS de 1,34 GiB (+34 %), como en el RFC §6: no es un tope del proceso.

## Trampas de configuración encontradas

1. **nodejs-polars 0.26.1 ignora `inferSchema: false`** (el nombre de la opción de Python) sin avisar: infiere Int64, `01000` pasa a `1000` y `9007199254740993` a `9007199254740992`. Hay que usar `inferSchemaLength: 0` ([`m1-nodejs-polars-opciones.json`](../../experiments/large-data-extracts/results/m1-nodejs-polars-opciones.json)).
2. **nodejs-polars devuelve Int64 como `number` de JavaScript**: la suma de céntimos 900719925474099501 salió como 900719925474099500 (primera pasada del adaptador: [`m1-formatos-nodejs-polars-sin-cast.json`](../../experiments/large-data-extracts/results/m1-formatos-nodejs-polars-sin-cast.json), T4 en UTF-8). Hay que convertirla a texto dentro del motor.
3. **Miller `--ors crlf`** reescribe saltos de línea dentro de campos (ver arriba).
4. **Miller `GOMAXPROCS`** no limita los hilos.
5. **qsv `search -c`** escribe el recuento en `stderr`, no en `stdout`; **qsv `extsort`** exige índice.

## Pruebas del propio banco

`python3 -m unittest test_experiment`: 8 pruebas Python (7 de E0 más la nueva que separa el fin de línea del comillado; falló primero con `KeyError`). Los adaptadores y sondeos nuevos (`m1_engines.py`, `polars_worker.py`, `polars_node_worker.mjs`, `probe_m1_integrity.py`, `probe_m1_resources.py`) **no tienen pruebas unitarias propias**: se validan comparando con el oráculo en una muestra de 3 000 filas antes de cada corrida y con los hashes de resultado de las corridas.

## Límites

- Un equipo (M2 Max, macOS ARM64), una repetición por celda, caché caliente. No es un SLA, no hay intervalos ni distribución, y no se midió con caché fría.
- **No se midió** macOS Intel (qsv no publica binario precompilado para x86_64-apple-darwin en 26.0.0 y los x64 exigen CPU con AVX2), Windows ni Linux. Tampoco el arranque ni el tamaño del instalador con ninguno de estos motores.
- **No se descargó DuckDB nativo 2.0.0** (`@duckdb/node-api`): la autorización de M1 cubría qsv, Miller y Polars. Las cifras de DuckDB son de la CLI 1.5.6 de Homebrew; el RFC §6 midió el nativo 2.0.0 con otros archivos (230 columnas). Dos versiones de DuckDB siguen sin compararse entre sí.
- La CLI de DuckDB y los binarios de qsv y Miller se ejecutaron como procesos hijo. **Ejecutar un binario externo no es un aislamiento**: ninguno se probó bajo un sandbox del sistema operativo.
- Las tuberías de qsv se midieron con procesos encadenados sin shell; el RSS es el de la etapa mayor.
- La ordenación y la cancelación son una repetición; la memoria de la ordenación es una muestra a 4 Hz.
- qsv `index` no se evaluó como sustituto del índice de L2: solo se midió su coste (≈1 s y 35 MiB en 1 GiB) por requerirlo `extsort`.
- No se evaluó VisiData (aplicación de terminal, GPL-3.0).

## Limpieza

Las tareas escriben sus salidas en carpetas del banco y las eliminan tras verificar cada una. Al cerrar la evaluación se retira `/private/tmp/freyalab-m1` completa (binarios, entornos, salidas); este documento y los JSON de `results/` conservan lo medido.
