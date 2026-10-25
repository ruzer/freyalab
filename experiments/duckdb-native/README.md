# M2 — DuckDB nativo (`@duckdb/node-api`) en un proceso auxiliar

Experimento **desechable** que respalda [`docs/evidence/m2-duckdb-nativo-2026-10-25.md`](../../docs/evidence/m2-duckdb-nativo-2026-10-25.md) y las puertas del [RFC §7.4](../../docs/design/LARGE-FILE-EDITOR-RFC.md). No lo importa nada del producto, **no añade dependencias a `package.json` ni al lockfile** y no usa DuckDB como almacén canónico: el índice, la copia de bytes y el guardado siguen siendo de FreyaLab.

## Requisitos

- Node 24 y las dependencias del repositorio (`npm ci`) para `csv-parse`, `iconv-lite` y Electron; Python 3 para los verificadores.
- Una carpeta **aislada, fuera del repositorio**, con el paquete nativo (no se añade al proyecto):

```sh
M2=/ruta/fuera/del/repo/freyalab-m2 ; mkdir -p $M2/duckdb-native && cd $M2/duckdb-native
npm init -y && npm install @duckdb/node-api@2.0.0-r.1 --save-exact --ignore-scripts --no-audit --no-fund --cache $M2/npm-cache
```

Procedencia, versiones, integridad y licencias: `results/m2-procedencia.json`. Los fixtures son los de M1 (`/private/tmp/FreyaLab-pruebas/`, ver `experiments/large-data-extracts/README.md`).

## Qué hay

| Archivo | Para qué |
|---|---|
| `lib/engine.mjs` | Prototipo del motor con **lista cerrada de operaciones** (`count`, `filter_count`, `search_count`, `aggregate`, `filter_extract`, `sort_to_file`, `replace_literal_to_file`, `positions`). Esquema explícito (sin *sniffing*), columnas por posición, literales enlazados, una instancia por operación con `allowed_paths` exacto, `enable_external_access=false`, extensiones desactivadas, límites de memoria y de temporales y `lock_configuration=true`. Salida siempre a un archivo nuevo dentro de la carpeta de trabajo. |
| `lib/worker-core.mjs`, `node-worker.mjs`, `electron/worker.mjs` | Proceso auxiliar: el mismo núcleo como hijo de Node (`child_process.fork`) y como `utilityProcess` de Electron. |
| `lib/host.mjs`, `lib/modes.mjs`, `lib/scenarios.mjs`, `lib/battery.mjs`, `lib/security.mjs`, `lib/selftest.mjs` | Anfitrión (mide RSS y CPU con `ps`), batería T1–T6 + ordenación + posiciones, cancelación, fugas, derrame a disco, matar y relanzar, comprobaciones de aislamiento y autocomprobación portátil. |
| `run-host.mjs` · `electron/main.mjs` | Ejecutan los modos con el motor en un hijo de Node o en un `utilityProcess`. |
| `integrity.mjs` | Recuento del índice de FreyaLab (L2) frente a `csv-parse` estricto y a DuckDB (lector paralelo y no paralelo). |
| `pattern.mjs` · `verify_pattern.py` | «DuckDB decide, FreyaLab copia los bytes». |
| `verify_outputs.py` | Verifica con el oráculo de Python los archivos que deja la batería y los borra. |
| `os-layer.mjs` · `confined.mjs` | Capa de aislamiento del sistema operativo (macOS `sandbox-exec`, Linux `bubblewrap`; Windows pendiente). |
| `ci/*`, `.github/workflows/m2-duckdb-native.yml` | Empaquetado y autocomprobación en las cuatro plataformas. El flujo solo se dispara con cambios en este directorio. |

## Cómo repetirlo

```sh
cd experiments/duckdb-native
# Binding frente a la CLI con el banco de M1 (necesita DUCKDB_NODE_DIR o --duckdb-node-dir)
python3 ../large-data-extracts/benchmark.py /private/tmp/FreyaLab-pruebas/ventas_100MiB.csv /private/tmp/FreyaLab-pruebas/ventas_1GiB.csv \
  --output $M2/out/ventas-node --engines python,duckdb,duckdb-par,duckdb-node,duckdb-node-par --node $(which node) --pandas-python $(which python3) --duckdb-node-dir $M2/duckdb-native
# Proceso auxiliar (hijo de Node) y utilityProcess de Electron, mismos modos
node run-host.mjs --install $M2/duckdb-native --work $M2/work-host --out $M2/out/host-node.json --modes battery,security,cancel,leak,spill,kill
M2_ARGS='{"install":"'$M2'/duckdb-native","work":"'$M2'/work-electron","out":"'$M2'/out/host-electron.json","modes":"battery,security,cancel,leak,spill,kill"}' ../../node_modules/.bin/electron electron/main.mjs
python3 verify_outputs.py $M2/out/host-node.json ../large-data-extracts/results/m1-ventas.json
# Integridad, patrón y capa del sistema operativo
node --experimental-transform-types --no-warnings integrity.mjs --install $M2/duckdb-native --work $M2/work-integridad --out $M2/out/integridad.json
node --experimental-transform-types --no-warnings pattern.mjs --install $M2/duckdb-native --work $M2/work-patron --source /private/tmp/FreyaLab-pruebas/ventas_100MiB.csv --out $M2/out/patron.json
python3 verify_pattern.py /private/tmp/FreyaLab-pruebas/ventas_100MiB.csv $M2/work-patron/patron-bytes.csv $M2/out/patron.json
node os-layer.mjs --install $M2/duckdb-native --work $M2/work-os --out $M2/out/os-layer.json
```

Medido en macOS ARM64 (Apple M2 Max, 32 GiB). Las otras tres plataformas se comprueban en la CI del PR. Limpieza: borrar `$M2` al terminar.
