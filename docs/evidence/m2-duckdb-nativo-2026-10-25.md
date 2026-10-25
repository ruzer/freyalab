# M2 — DuckDB nativo (`@duckdb/node-api` 2.0.0) en un proceso auxiliar, 25 de octubre de 2026

**Medido localmente en macOS ARM64 y comprobado en la CI en las cuatro plataformas; no certifica rendimiento ni seguridad fuera de lo descrito.** Continúa [M1](m1-motores-externos-2026-10-25.md) con la autorización del usuario para `@duckdb/node-api` 2.0.0. Decisión y puertas: [`docs/design/EXTERNAL-ENGINES.md`](../design/EXTERNAL-ENGINES.md). Código del experimento: `experiments/duckdb-native/` (desechable, no es código de producto).

Etiquetas: **[M2]** medido aquí; **[CI]** resultado del flujo experimental de este PR; **[RFC]** medido en el RFC.

## 1. Qué se instaló y dónde

`@duckdb/node-api` 2.0.0-r.1 se instaló **solo** en una carpeta temporal fuera del repositorio, con `--ignore-scripts`; `package.json` y el lockfile de FreyaLab no cambian. Procedencia, `integrity` e licencias en [`m2-procedencia.json`](../../experiments/duckdb-native/results/m2-procedencia.json): `node-api` y `node-bindings` MIT, un paquete nativo por plataforma (`darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-x64-musl`, `linux-arm64`, `linux-arm64-musl`, `win32-x64`, `win32-arm64`; MIT) y `detect-libc` (Apache-2.0). En macOS ARM64 el motor son dos archivos: `duckdb.node` (0,5 MB) y `libduckdb.dylib` (62,6 MB).

Electron 44.9.2 (Node 24.22.0, ABI 149, N-API 10) carga el módulo nativo sin recompilar. Tres versiones de DuckDB conviven en el proyecto: **nativo 2.0.0**, **DuckDB-Wasm del producto 1.33.1-dev57 = DuckDB v1.5.4** y la **CLI 1.5.6** de E0 y M1.

## 2. Binding nativo frente a la CLI ya medida

Mismo banco, mismas seis tareas y **el mismo SQL** de E0 (esquema por *sniffing*, `strict_mode=true`; 1 hilo con `parallel=false` y `memory_limit=512MB`, o 12 hilos con el lector paralelo y 4 GB). El binding se ejecuta en un proceso de Node; la CLI, en su proceso. Segundos de pared (incluye el arranque del proceso) / MiB de RSS máximo / CPU÷pared. **48 de 48 resultados de los motores coinciden con el oráculo** (recuentos, sumas exactas y hash de valores en T3 y T5).

### ventas_1GiB.csv

| Motor | T1 | T2 | T3 | T4 | T5 | T6 |
|---|---:|---:|---:|---:|---:|---:|
| Python `csv` (oráculo) | 10.23 / 19 / 1.0 | 10.60 / 20 / 1.0 | 12.00 / 20 / 1.0 | 16.90 / 20 / 1.0 | 23.73 / 20 / 1.0 | 12.84 / 19 / 1.0 |
| CLI 1.5.6, 1 hilo | 3.07 / 483 / 1.0 | 3.19 / 482 / 1.0 | 3.49 / 483 / 1.0 | 6.84 / 484 / 1.0 | 8.18 / 500 / 1.0 | 5.04 / 499 / 1.0 |
| binding 2.0.0, 1 hilo | 1.41 / 564 / 1.0 | 1.57 / 564 / 1.0 | 1.89 / 564 / 1.0 | 1.70 / 566 / 1.0 | 5.08 / 586 / 1.0 | 3.25 / 581 / 1.0 |
| CLI 1.5.6, lector paralelo | 0.42 / 210 / 9.3 | 0.45 / 213 / 8.9 | 0.47 / 250 / 9.5 | 0.85 / 190 / 9.9 | 1.15 / 1358 / 9.7 | 0.61 / 237 / 10.2 |
| binding 2.0.0, lector paralelo | 0.28 / 460 / 6.3 | 0.29 / 432 / 6.5 | 0.33 / 505 / 7.2 | 0.31 / 472 / 6.7 | 0.84 / 1609 / 8.4 | 0.50 / 457 / 8.3 |

### ventas_100MiB.csv

| Motor | T1 | T2 | T3 | T4 | T5 | T6 |
|---|---:|---:|---:|---:|---:|---:|
| Python `csv` (oráculo) | 1.01 / 19 / 1.0 | 1.05 / 19 / 1.0 | 1.18 / 20 / 1.0 | 1.65 / 19 / 1.0 | 2.29 / 19 / 1.0 | 1.29 / 19 / 1.0 |
| CLI 1.5.6, 1 hilo | 0.34 / 124 / 1.0 | 0.35 / 124 / 1.0 | 0.38 / 124 / 1.0 | 0.70 / 126 / 1.0 | 0.82 / 127 / 1.0 | 0.52 / 127 / 1.0 |
| binding 2.0.0, 1 hilo | 0.25 / 189 / 1.0 | 0.27 / 189 / 1.0 | 0.30 / 190 / 1.0 | 0.29 / 191 / 1.0 | 0.62 / 195 / 1.0 | 0.44 / 192 / 1.0 |
| CLI 1.5.6, lector paralelo | 0.10 / 127 / 4.1 | 0.10 / 129 / 4.2 | 0.11 / 147 / 4.3 | 0.16 / 137 / 5.2 | 0.22 / 427 / 5.1 | 0.13 / 151 / 4.8 |
| binding 2.0.0, lector paralelo | 0.15 / 192 / 1.9 | 0.15 / 195 / 2.0 | 0.15 / 213 / 2.2 | 0.16 / 204 / 2.2 | 0.23 / 528 / 3.9 | 0.19 / 216 / 2.9 |

- **El binding 2.0.0 es más rápido que la CLI 1.5.6** en 1 GiB: 1 hilo: 1.6–4.0×; lector paralelo: 1.2–2.7× (razón de tiempos CLI÷binding sobre las seis tareas). **La comparación mezcla versión y binding** (2.0.0 frente a 1.5.6): no se descargó la CLI 2.0.0, así que no se puede atribuir la mejora a una u otra.
- Con el lector paralelo el binding usa menos núcleos (6–8 frente a 9–10) y **más memoria en las tareas ligeras** (430–510 MiB frente a 190–250): incluye el motor de Node (~60 MiB) y una reserva mayor.
- Con la configuración de E0 (1 hilo) el RSS del binding es ~560 MiB frente a ~480 MiB de la CLI.
- **En 100 MiB con el lector paralelo el binding no gana** (0,15–0,23 s frente a 0,10–0,22 s): el arranque de Node pesa más que el trabajo.

## 3. Operaciones cerradas en un proceso auxiliar

El prototipo (`lib/engine.mjs`) ofrece solo ocho operaciones tipadas; **nadie envía SQL**, las columnas se nombran por posición, el esquema es explícito (sin *sniffing*), los valores van como parámetros enlazados, y cada operación abre su propia instancia con `allowed_paths` exacto (fuente y salida), `enable_external_access=false`, extensiones y repositorio desactivados, `memory_limit`, `max_temp_directory_size` y `lock_configuration=true`. Se ejecutó igual en un **hijo de Node** (`child_process.fork`) y en un **`utilityProcess` de Electron**.

### ventas_1GiB.csv · ms de pared de la operación · CPU del proceso auxiliar · RSS máximo con un proceso nuevo por operación

| Operación | Hijo de Node, proceso ya caliente | utilityProcess, proceso ya caliente | Hijo de Node, proceso nuevo | utilityProcess, proceso nuevo |
|---|---:|---:|---:|---:|
| `count` (T1) | 184 ms · CPU 1.6 s | 218 ms · CPU 1.8 s | 201 ms · 292 MiB · CPU 1.6 s | 201 ms · 203 MiB · CPU 1.7 s |
| `filter_count` (T2) | 201 ms · CPU 1.8 s | 251 ms · CPU 2.0 s | 221 ms · 294 MiB · CPU 1.8 s | 216 ms · 244 MiB · CPU 1.9 s |
| `filter_extract` (T3) | 240 ms · CPU 2.2 s | 284 ms · CPU 2.5 s | 268 ms · 391 MiB · CPU 2.2 s | 261 ms · 387 MiB · CPU 2.3 s |
| `aggregate` (T4) | 218 ms · CPU 2.0 s | 236 ms · CPU 2.1 s | 233 ms · 303 MiB · CPU 2.0 s | 234 ms · 387 MiB · CPU 2.1 s |
| `replace_literal_to_file` (T5) | 776 ms · CPU 6.9 s | 871 ms · CPU 7.3 s | 879 ms · 1589 MiB · CPU 6.8 s | 785 ms · 1404 MiB · CPU 6.9 s |
| `search_count` (T6) | 413 ms · CPU 4.1 s | 448 ms · CPU 4.3 s | 443 ms · 441 MiB · CPU 4.0 s | 436 ms · 360 MiB · CPU 4.2 s |
| `sort_to_file` (sort) | 1535 ms · CPU 10.3 s | 1754 ms · CPU 10.8 s | 1355 ms · 4192 MiB · CPU 10.0 s | 1668 ms · 4172 MiB · CPU 10.7 s |
| `positions` (positions) | 1655 ms · CPU 1.7 s | 1674 ms · CPU 1.8 s | 1694 ms · 357 MiB · CPU 2.0 s | 1670 ms · 246 MiB · CPU 2.0 s |

### ventas_100MiB.csv

| Operación | Hijo de Node, proceso ya caliente | utilityProcess, proceso ya caliente | Hijo de Node, proceso nuevo | utilityProcess, proceso nuevo |
|---|---:|---:|---:|---:|
| `count` (T1) | 45 ms · CPU 0.2 s | 49 ms · CPU 0.2 s | 41 ms · 95 MiB · CPU 0.2 s | 43 ms · 108 MiB · CPU 0.2 s |
| `filter_count` (T2) | 41 ms · CPU 0.2 s | 62 ms · CPU 0.2 s | 42 ms · 96 MiB · CPU 0.2 s | 45 ms · 108 MiB · CPU 0.2 s |
| `filter_extract` (T3) | 50 ms · CPU 0.2 s | 60 ms · CPU 0.3 s | 50 ms · 96 MiB · CPU 0.2 s | 51 ms · 108 MiB · CPU 0.2 s |
| `aggregate` (T4) | 47 ms · CPU 0.2 s | 57 ms · CPU 0.2 s | 46 ms · 95 MiB · CPU 0.2 s | 48 ms · 108 MiB · CPU 0.2 s |
| `replace_literal_to_file` (T5) | 121 ms · CPU 0.8 s | 127 ms · CPU 0.8 s | 112 ms · 539 MiB · CPU 0.7 s | 128 ms · 468 MiB · CPU 0.7 s |
| `search_count` (T6) | 73 ms · CPU 0.4 s | 85 ms · CPU 0.5 s | 70 ms · 96 MiB · CPU 0.4 s | 95 ms · 108 MiB · CPU 0.5 s |
| `sort_to_file` (sort) | 189 ms · CPU 0.9 s | 208 ms · CPU 1.0 s | 202 ms · 501 MiB · CPU 0.9 s | 200 ms · 473 MiB · CPU 1.0 s |
| `positions` (positions) | 186 ms · CPU 0.2 s | 188 ms · CPU 0.2 s | 179 ms · 168 MiB · CPU 0.2 s | 180 ms · 181 MiB · CPU 0.2 s |

- **Todas las respuestas coinciden con el oráculo** y los **24 archivos de salida** (T3, T5 y ordenación, de las dos fuentes y en las cuatro ejecuciones) se verificaron con Python: valores idénticos, ordenados y con los mismos 4 587 000 / 448 000 registros (0 fallos). T5 conserva los valores. Con el esquema explícito y **sin** `force_not_null`, los registros intactos salen idénticos salvo el fin de línea (LF) —y un campo vacío entrecomillado en el original (`""`) sale sin comillas—; con el SQL del banco, que usa `force_not_null`, DuckDB escribe `""` para las cadenas vacías (CLI y binding por igual). El formato de salida de `COPY` fue **idéntico en la CLI 1.5.6 y en el binding 2.0.0** con un fixture de campos vacíos, espacios, comillas, saltos de línea y Unicode ([`m2-formato-copy-entre-versiones.json`](../../experiments/duckdb-native/results/m2-formato-copy-entre-versiones.json)).
- El `utilityProcess` y el hijo de Node rinden igual; un `count` de 100 MiB en un proceso nuevo tarda ~40 ms.
- **El RSS de un proceso caliente se queda en su máximo**: tras una ordenación de 1 GiB el proceso conserva ~4,3–4,6 GiB aunque se cierre la instancia, con `allocator_flush_threshold` en 1 MB o con hilos del asignador (3,9 GiB) **[M2]**. Hay que **reciclar el proceso auxiliar tras operaciones pesadas** o limitar `memory_limit`.
- Arranque del proceso auxiliar más la carga del módulo nativo y de la primera instancia: hijo de Node 97–99 ms; utilityProcess 138–205 ms. Primer `count` de 100 MiB tras arrancar: 39–43 ms y 44–58 ms.

## 4. Cancelación, liberación de recursos y recuperación

- **Cancelación con `interrupt()`** (5 ordenaciones de 1 GiB canceladas a los 300 ms): hijo de Node, 6.8–9.2 ms desde que se envía la cancelación hasta que llega la respuesta; 5 de 5 canceladas; salida parcial que queda: 0; archivos o bytes temporales que quedan: 0; utilityProcess, 36.1–41.6 ms desde que se envía la cancelación hasta que llega la respuesta; 5 de 5 canceladas; salida parcial que queda: 0; archivos o bytes temporales que quedan: 0. Tras cancelar, el motor sigue atendiendo. La latencia dentro del proceso, sin IPC, es de 1 ms en la prueba del RFC **[RFC, reproducida]**.
- **Fugas:** 40 operaciones seguidas (`count` y `filter_extract` de 100 MiB) en un proceso nuevo. RSS al arrancar, tras la 1.ª, la 20.ª y la 40.ª: hijo de Node 95 → 208 → 228 → 230 MiB; utilityProcess 108 → 121 → 139 → 142 MiB. Crece ~20 MiB al principio y se aplana (menos de 3 MiB entre la 20.ª y la 40.ª): no hay una fuga evidente en 40 operaciones.
- **Matar el proceso** a los 400 ms de una ordenación: el proceso desaparece en 60 ms (hijo de Node) y 44 ms (utilityProcess); queda una salida parcial de 226 bytes que **borra quien lo lanzó**; sin temporales; el motor se relanza y responde.
- **Disco temporal.** `sort_to_file` de 1 GiB con 4 hilos en un proceso nuevo:

| Anfitrión | `memory_limit` | Tiempo | RSS pico (proceso nuevo) | Temporales pico | Temporales que quedan | Salida correcta |
|---|---|---:|---:|---:|---:|---|
| Hijo de Node | 4GB | 2.1 s | 3977 MiB | 0 MiB | 0 B | sí (hash independiente del orden) |
| Hijo de Node | 1GB | 3.8 s | 1490 MiB | 1028 MiB | 0 B | sí (hash independiente del orden) |
| Hijo de Node | 512MB | 7.4 s | 856 MiB | 1295 MiB | 0 B | sí (hash independiente del orden) |
| utilityProcess | 4GB | 2.2 s | 3654 MiB | 0 MiB | 0 B | sí (hash independiente del orden) |
| utilityProcess | 1GB | 4.1 s | 1241 MiB | 1048 MiB | 0 B | sí (hash independiente del orden) |
| utilityProcess | 512MB | 7.2 s | 708 MiB | 1244 MiB | 0 B | sí (hash independiente del orden) |

  El límite de memoria **no es un tope del proceso**: el RSS superó el límite entre un 21 % y un 67 % (1 GB: 1241 y 1490 MiB; 512 MB: 708 y 856 MiB). Con 4 GB no hay derrame; con 1 GB y 512 MB el derrame fue de ~1,0 y ~1,2–1,3 GiB y se borró al terminar.

## 5. Aislamiento de archivos, red y extensiones

**Dentro del proceso auxiliar** ([`lib/security.mjs`](../../experiments/duckdb-native/lib/security.mjs)), con la misma configuración que usa el motor:

- 42 de 42 comprobaciones cumplen lo esperado en el `utilityProcess` de Electron (24 con SQL libre contra la instancia bloqueada y 18 contra las operaciones cerradas); lo mismo en el hijo de Node. También en la CI en las cuatro plataformas (dentro de la autocomprobación).
- Con SQL libre contra la instancia bloqueada se deniega: leer otro archivo de la misma carpeta, leer fuera, `../`, un enlace simbólico, `read_text('/etc/hosts')`, `glob`, `COPY` fuera o a otro archivo de la carpeta, `ATTACH`, `read_csv` por HTTP (0 peticiones recibidas por el servidor local), `INSTALL`/`LOAD httpfs`, y cualquier cambio de configuración tras el bloqueo (`enable_external_access`, `allowed_paths`, `memory_limit`, `temp_directory`, `autoinstall`, `lock_configuration`). Se permite lo previsto: leer la fuente y escribir el archivo de salida autorizado.
- La capa de **operaciones cerradas** rechaza: una operación que no está en la lista, SQL en lugar de una operación, columnas fuera de rango o con texto, operadores no permitidos, fuente fuera de las carpetas autorizadas, fuente que es un enlace simbólico o una ruta relativa, separador o codificación no admitidos, salida fuera de la carpeta de trabajo, salida que ya existe o con `../`, valores con NUL o de más de 1 000 caracteres. Un valor con comillas y `; DROP TABLE` se **enlaza como literal** y no tiene efecto.
- El script del RFC §7 se **reproduce sin cambios** con una instalación nueva de `@duckdb/node-api` 2.0.0-r.1: 29 de 29 comprobaciones cumplen y el servidor local recibe 0 peticiones ([`m2-seguridad-rfc-reproduccion.json`](../../experiments/duckdb-native/results/m2-seguridad-rfc-reproduccion.json)).

<details><summary>Lista completa de comprobaciones (utilityProcess de Electron)</summary>

| Comprobación | Esperado | Resultado |
|---|---|---|
| SQL libre contra la instancia bloqueada: leer la fuente autorizada | permitido | permitido |
| SQL libre contra la instancia bloqueada: leer otro archivo de la misma carpeta | denegado | denegado |
| SQL libre contra la instancia bloqueada: leer un archivo fuera de la carpeta | denegado | denegado |
| SQL libre contra la instancia bloqueada: recorrido con ../ | denegado | denegado |
| SQL libre contra la instancia bloqueada: enlace simbólico dentro de la carpeta que apunta fuera | denegado | denegado |
| SQL libre contra la instancia bloqueada: read_text de /etc/hosts | denegado | denegado |
| SQL libre contra la instancia bloqueada: glob de /etc | denegado | denegado |
| SQL libre contra la instancia bloqueada: listar la carpeta autorizada | denegado | denegado |
| SQL libre contra la instancia bloqueada: COPY fuera de lo autorizado | denegado | denegado |
| SQL libre contra la instancia bloqueada: COPY al archivo de salida autorizado | permitido | permitido |
| SQL libre contra la instancia bloqueada: COPY a otro archivo de la misma carpeta | denegado | denegado |
| SQL libre contra la instancia bloqueada: ATTACH de una base en disco | denegado | denegado |
| SQL libre contra la instancia bloqueada: read_csv por HTTP a un servidor local | denegado | denegado |
| SQL libre contra la instancia bloqueada: INSTALL httpfs | denegado | denegado |
| SQL libre contra la instancia bloqueada: LOAD httpfs | denegado | denegado |
| SQL libre contra la instancia bloqueada: reactivar el acceso externo tras bloquear | denegado | denegado |
| SQL libre contra la instancia bloqueada: ampliar allowed_paths tras bloquear | denegado | denegado |
| SQL libre contra la instancia bloqueada: subir memory_limit tras bloquear | denegado | denegado |
| SQL libre contra la instancia bloqueada: cambiar temp_directory tras bloquear | denegado | denegado |
| SQL libre contra la instancia bloqueada: activar autoinstall tras bloquear | denegado | denegado |
| SQL libre contra la instancia bloqueada: desbloquear la configuración tras bloquear | denegado | denegado |
| SQL libre contra la instancia bloqueada: ordenar 200 M de filas con 512 MB y 1 GB de temporales | denegado | denegado |
| SQL libre contra la instancia bloqueada: cancelar con interrupt() una consulta de 10^11 filas | cancelada | cancelada |
| SQL libre contra la instancia bloqueada: peticiones HTTP recibidas por el servidor local | 0 | 0 |
| Operaciones cerradas: operación válida | permitido | permitido |
| Operaciones cerradas: operación que no está en la lista | rechazado | rechazado |
| Operaciones cerradas: SQL en lugar de operación | rechazado | rechazado |
| Operaciones cerradas: valor con comillas y punto y coma (se enlaza como literal) | permitido | permitido |
| Operaciones cerradas: valor con NUL | rechazado | rechazado |
| Operaciones cerradas: columna fuera de rango | rechazado | rechazado |
| Operaciones cerradas: columna con texto en vez de entero | rechazado | rechazado |
| Operaciones cerradas: operador no permitido | rechazado | rechazado |
| Operaciones cerradas: nombre de columna con comillas (se cita) | permitido | permitido |
| Operaciones cerradas: fuente fuera de las carpetas autorizadas | rechazado | rechazado |
| Operaciones cerradas: fuente que es un enlace simbólico | rechazado | rechazado |
| Operaciones cerradas: fuente con ruta relativa | rechazado | rechazado |
| Operaciones cerradas: separador no admitido | rechazado | rechazado |
| Operaciones cerradas: codificación no admitida (Windows-1252) | rechazado | rechazado |
| Operaciones cerradas: salida fuera de la carpeta de trabajo | rechazado | rechazado |
| Operaciones cerradas: salida que ya existe (nunca se sobrescribe) | rechazado | rechazado |
| Operaciones cerradas: salida con ../ que sale de la carpeta | rechazado | rechazado |
| Operaciones cerradas: texto de 2 000 caracteres | rechazado | rechazado |

</details>

**Capa del sistema operativo** alrededor del proceso que ejecuta DuckDB (`os-layer.mjs`). Un proceso de control puede leer un archivo ajeno y `/etc/hosts`, escribir fuera de la carpeta de trabajo y abrir una conexión TCP; el mismo proceso dentro de la capa, no. La instancia de DuckDB del sondeo **no** usa la configuración restrictiva, así que se ve lo que impide el sistema operativo por sí solo. La capa rodea un proceso de Node lanzado por la aplicación; **no se probó rodear un `utilityProcess`**, que lo crea Chromium:

| Plataforma | Mecanismo | La operación cerrada funciona dentro | El control puede todo | Denegado por el sistema | Sigue permitido |
|---|---|---|---|---|---|
| macOS ARM64 (local, perfil corregido) | sandbox-exec (perfil SBPL) | sí | sí | Node lee el archivo ajeno; Node lee /etc/hosts; Node abre una conexión TCP a un servidor local; Node escribe fuera de la carpeta de trabajo; DuckDB sin restricciones lee el archivo ajeno | — |
| Linux x64 (CI) | bubblewrap (--ro-bind / /, --unshare-net, tmpfs sobre la carpeta ajena, /dev/null sobre /etc/hosts) | sí | sí | Node lee el archivo ajeno; Node lee /etc/hosts; Node abre una conexión TCP a un servidor local; Node escribe fuera de la carpeta de trabajo; DuckDB sin restricciones lee el archivo ajeno | — |
| Windows x64 (CI) | — | — | — | — | **Sin mecanismo probado (pendiente)** |
| macOS ARM64 (CI) | sandbox-exec (perfil SBPL) | sí | sí | Node lee el archivo ajeno; Node lee /etc/hosts; Node abre una conexión TCP a un servidor local; Node escribe fuera de la carpeta de trabajo; DuckDB sin restricciones lee el archivo ajeno | — |
| macOS x64 (CI) | sandbox-exec (perfil SBPL) | sí | sí | Node lee el archivo ajeno; Node lee /etc/hosts; Node abre una conexión TCP a un servidor local; Node escribe fuera de la carpeta de trabajo; DuckDB sin restricciones lee el archivo ajeno | — |

## 6. Integridad frente al oráculo y al índice de FreyaLab

Recuento del índice de L2 (`buildIndex`, importado directamente de `src/main/large-table.ts`) frente a `csv-parse` estricto y a DuckDB con esquema explícito. **R2** (validar antes de delegar) y **R3** (reconciliar el recuento) son las reglas de `docs/design/EXTERNAL-ENGINES.md`.

| Fixture | Registros de datos (índice L2) | `csv-parse` estricto | DuckDB, lector paralelo | DuckDB, lector no paralelo | Qué ocurre |
|---|---:|---|---|---|---|
| `regular` | 3 | 3 | 3 | 3 | se delega y el recuento cuadra |
| `campos_entrecomillados_multilinea` | 3 | 3 | 3 | 3 | se delega y el recuento cuadra |
| `fila_corta` | 2 | rechaza | error con posición | error con posición | se rechaza antes de delegar (R2) |
| `campo_de_mas` | 2 | rechaza | error con posición | error con posición | se rechaza antes de delegar (R2) |
| `comilla_sin_cerrar_a_mitad` | 2 | rechaza | error con posición | 1 | se rechaza antes de delegar (R2) |
| `comilla_sin_cerrar_en_el_ultimo_registro` | 2 | rechaza | error con posición | 1 | se rechaza antes de delegar (R2) |
| `sin_salto_de_linea_final` | 2 | 2 | 2 | 2 | se delega y el recuento cuadra |
| `bom_utf8` | 2 | 2 | 2 | 2 | se delega y el recuento cuadra |
| `utf16_le_con_bom` | 2 | 2 | 2 | 2 | se delega y el recuento cuadra |
| `utf16_longitud_impar` | 2 | rechaza | error | error | se rechaza antes de delegar (R2) |

- **El lector no paralelo de DuckDB descarta en silencio el registro con la comilla sin cerrar y devuelve 1** donde el índice cuenta 2; el paralelo lo rechaza con la línea y el texto del registro («CSV Error on Line: 3»). E0 forzaba `parallel=false` «por estrictez»: **era lo contrario**. Pasa igual en la CLI 1.5.6 y en el DuckDB-Wasm del producto (v1.5.4) **[M2]**.
- Con *sniffing*, un archivo irregular pequeño (`fila_corta`, `campo_de_mas`) se interpretó con el separador `|`, una sola columna llamada `id,zip,nombre,nota` y 2 filas, **sin error** ([`m2-sniffing.json`](../../experiments/duckdb-native/results/m2-sniffing.json)). **El esquema explícito es obligatorio.**
- **El índice de L2 acepta lo que `csv-parse` rechaza:** una comilla sin cerrar (el registro llega hasta el final del archivo) y un UTF-16 de longitud impar (cuenta un registro fantasma). La validación estricta es parte de R2, no de DuckDB ni del índice actual.
- Todos los demás fixtures (campos multilínea, BOM, UTF-16 con BOM, sin salto final) cuadran en las tres fuentes.

### «DuckDB decide, FreyaLab copia los bytes»

DuckDB calcula las posiciones de los registros que cumplen la condición y el índice de FreyaLab (`readRecords`, por bloques de 1024) los copia del original. Se compara con los registros originales leídos por Python:

| Archivo | Índice L2 | Posiciones (DuckDB) | Coincidencias | Copia de bytes | Salida | Extracto de DuckDB (registro completo) | Bytes idénticos al original |
|---|---:|---:|---:|---:|---:|---:|---|
| ventas_100MiB.csv | 0.21 s | 0.18 s | 112,233 | 0.74 s | 25 MiB | 0.08 s | sí |
| ventas_1GiB.csv | 2.14 s | 1.66 s | 1,146,807 | 7.52 s | 254 MiB | 0.46 s | sí |

El recuento de DuckDB coincide con el del índice (R3). **La copia de bytes es 16 veces más lenta que el extracto normalizado de DuckDB** (7,5 s frente a 0,47 s con 1 GiB) y no está optimizada: `readRecords` decodifica y vuelve a codificar cada registro y no conserva el fin de línea de cada uno (el experimento supone CRLF uniforme). Es la única vía medida que da **bytes idénticos** en un extracto.

## 7. Paridad con el DuckDB-Wasm que ya usa el producto

Las mismas 12 sentencias (esquema explícito, 10 MiB de ventas y los fixtures irregulares, con el lector paralelo y el no paralelo) en el Wasm del producto (**v1.5.4**) y en el nativo (**v2.0.0**): **12 de 12 resultados y mensajes de error idénticos**, incluida la pérdida silenciosa del lector no paralelo. Diferencias conocidas: la versión (1.5.4 frente a 2.0.0) y el rendimiento (el binding 2.0.0 fue de 1,2 a 4 veces más rápido que la CLI 1.5.6). El formato de salida de `COPY` fue idéntico entre la CLI 1.5.6 y el nativo 2.0.0 en el fixture comprobado; **no se midió la salida de `COPY` del Wasm ni la disponibilidad de extensiones**.

## 8. Empaquetado y autocomprobación en las cuatro plataformas

Flujo `.github/workflows/m2-duckdb-native.yml` (solo experimental, se dispara con cambios en `experiments/duckdb-native/`): `npm ci`, una mini-aplicación de Electron preparada **fuera del repositorio** con `@duckdb/node-api` instalado solo allí, `electron-builder --dir` con `asarUnpack: node_modules/@duckdb/**`, y la autocomprobación (11 comprobaciones: las ocho operaciones, el aislamiento y el matar y relanzar) en un hijo de Node, en Electron sin empaquetar y **en la aplicación empaquetada**.

| Plataforma | Hijo de Node | Electron sin empaquetar | **Aplicación empaquetada** | DuckDB / Electron / ABI | Paquete completo | Nativo desempaquetado (`app.asar.unpacked`) |
|---|---|---|---|---|---:|---:|
| Linux x64 | ✅ 11/11 | ✅ 11/11 | ✅ 11/11 | v2.0.0 · 44.9.2 · 149 | 375 MiB | 92 MiB |
| Windows x64 | ✅ 11/11 | ✅ 11/11 | ✅ 11/11 | v2.0.0 · 44.9.2 · 149 | 428 MiB | 60 MiB |
| macOS ARM64 | ✅ 11/11 | ✅ 11/11 | ✅ 11/11 | v2.0.0 · 44.9.2 · 149 | 546 MiB | 64 MiB |
| macOS x64 (Intel) | ✅ 11/11 | ✅ 11/11 | ✅ 11/11 | v2.0.0 · 44.9.2 · 149 | 566 MiB | 66 MiB |

En local, macOS ARM64: paquete 546 MiB, de los cuales 64 MiB son el motor desempaquetado; la autocomprobación del paquete pasa.

**No se probó la firma.** La aplicación va sin firmar (`identity: null`); no se probó el *hardened runtime* de macOS (la carga de una biblioteca nativa sin firmar puede exigir firmarla o el permiso `disable-library-validation`), la notarización ni la firma de Windows. Los paquetes de Linux se probaron como directorio (`--dir`), no como AppImage ni DEB.

## 9. Las cuatro puertas del RFC §7.4

| Puerta | Estado | Evidencia y lo que falta |
|---|---|---|
| **(a)** Proceso auxiliar dedicado con `allowed_paths` exacto, `enable_external_access=false`, `lock_configuration`, extensiones y repositorio desactivados, límites de memoria y de disco temporal e `interrupt`, con pruebas automáticas | **Aprobada** | Secciones 3 a 5: 42 de 42 comprobaciones en el `utilityProcess` y la autocomprobación en las cuatro plataformas. Reservas: el límite de memoria no es un tope del proceso (de +21 % a +67 % medido), el RSS no se libera (reciclar el proceso), las rutas de `COPY … TO` se validan e insertan como literal (no admiten parámetro) y el lector no paralelo pierde registros (se usa el paralelo y R2/R3). |
| **(b)** Una capa de aislamiento del sistema operativo demostrada en cada plataforma publicada, o riesgo residual aceptado por escrito | **Pendiente** | Demostrada en macOS (`sandbox-exec`, API obsoleta) y en Linux (`bubblewrap`). **Windows: sin mecanismo probado.** Tampoco se probó rodear un `utilityProcess`: la vía viable es lanzar DuckDB en un hijo propio. Hace falta construir la capa de Windows o **aceptar el riesgo residual por escrito**. |
| **(c)** Empaquetado y firma comprobados en las cuatro plataformas en la CI | **Pendiente (parcial)** | Empaquetado y arranque comprobados en las cuatro (sección 8). **Firma y notarización: no probadas.** |
| **(d)** Una sola versión de DuckDB en el producto, o diferencias documentadas | **Aprobada con diferencias documentadas** | Tres versiones (1.5.4 Wasm, 1.5.6 CLI, 2.0.0 nativo); 12 de 12 sentencias idénticas entre Wasm y nativo; diferencias en la sección 7. Condición: fijar la versión y repetir la prueba de paridad en cada actualización (R6). |

**Conclusión:** DuckDB nativo es viable técnicamente en un proceso auxiliar de Electron, pero **no se adopta todavía** porque las puertas (b) y (c) no están superadas. Las decisiones para cerrarlas están en `docs/design/EXTERNAL-ENGINES.md`.

## 10. Límites

- Un equipo (M2 Max, macOS ARM64) con otras aplicaciones abiertas (carga media de 3–4 durante las mediciones), una repetición por celda, caché caliente. No es un SLA.
- La CLI 1.5.6 y el binding 2.0.0 difieren en versión: no se aísla el efecto del binding. No se descargó la CLI 2.0.0.
- El RSS de los procesos calientes mide el máximo acumulado; los valores «proceso nuevo» son los comparables. La memoria del derrame es una muestra a 10 Hz.
- La latencia de cancelación por IPC incluye el mensaje; la de `interrupt()` dentro del proceso es de la prueba del RFC.
- La capa del sistema operativo: macOS y Linux sí, Windows no; no se probó rodear un `utilityProcess`; en Linux se usó `sudo` si hizo falta.
- Los experimentos de CI se ejecutaron en los ejecutores alojados de GitHub y no prueban el rendimiento.
- No hay pruebas de un renderer: el prototipo recibe operaciones ya tipadas del proceso principal. La regla de que el renderer nunca envía rutas ni SQL es de diseño, no se probó con una interfaz real.
- Windows y Linux se comprobaron solo en la CI (autocomprobación pequeña); las cifras de rendimiento son de macOS ARM64.

## 11. Limpieza

Las salidas de la batería se verificaron y se borraron; las carpetas de trabajo y la instalación de `@duckdb/node-api` están en `/private/tmp/freyalab-m2` y se retiran al cerrar la evaluación. Los JSON de `experiments/duckdb-native/results/` conservan lo medido.
