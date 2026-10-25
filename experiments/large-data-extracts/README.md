# E0 — Banco manual de extractos grandes

Evaluación del 24-oct-2026. **No es una CLI de FreyaLab ni código de producto.** No instala nada y no contiene los CSV grandes. [Decisión](../../docs/design/LARGE-DATA-EXTRACTS.md), [evidencia](../../docs/evidence/e0-extractos-2026-10-24.md), [paridad](PARITY.md), [reutilización](REUSE.md), [recetas/privacidad](RECIPES-PRIVACY.md).

## Requisitos y fuentes

Medido sólo en macOS ARM64, Apple M2 Max/32 GiB. `benchmark.py` usa `/usr/bin/time -l` y rechaza otro SO para no inventar las unidades de RSS. Usar Python `csv` estándar, Node 24 con las dependencias ya instaladas del repositorio, DuckDB CLI y un intérprete que **ya tenga pandas**. No ejecutar `pip`, `uv install`, `npm install` ni descargar extensiones como parte del banco. Pedir autorización si faltan herramientas.

En la ejecución registrada: Python sistema 3.15.0; pandas 2.2.3 en Python 3.12.14 del runtime local; Node 24.22.1; DuckDB CLI 1.5.6. Los intérpretes distintos y el arranque forman parte del tiempo. No se añadió dependencia a `package.json`/lockfile.

Se reutilizan los archivos existentes en `/private/tmp/FreyaLab-pruebas/`: ventas de 100 MiB y 1 GiB; el de 10 MiB aporta el encabezado a los fixtures pequeños. **No regenerarlos si existen.** Para otra máquina, `generate_sales.py` conserva el algoritmo/semilla 20261023 del generador recibido (sólo cambia la elección/validación del destino). Crea una carpeta nueva, fuera del repo, exige 3 GiB libres y usa creación exclusiva:

```sh
python3 experiments/large-data-extracts/generate_sales.py --output /private/tmp/FreyaLab-pruebas
```

Genera cuatro fixtures sintéticos (~1,2 GiB en total) y valida estructura, referencias, importes y fechas; no se han vuelto a generar los grandes en E0. El ensayo mide sólo ventas 100 MiB/1 GiB. Verificar hashes y recuentos contra `results/ventas.json`; versiones distintas del generador/runtime podrían producir otros bytes. Borrar una generación interrumpida sólo después de comprobar que esos archivos son propios.

## Comprobación rápida

```sh
python3 -m unittest discover -s experiments/large-data-extracts -p 'test_*.py'
node --test experiments/large-file-editor/tests/overlay.test.mjs
```

Siete pruebas Python; 41 Node. Primero se reprodujeron fallos del módulo ausente y de `bulkTransform(null)`; se corrigió únicamente el helper experimental para reutilizar su operación de omitir filas. No es E1.

## Reproducir mediciones

Cambiar las rutas de ejecutables si corresponde. Cada `--output` debe ser nuevo, externo al repositorio y a la carpeta de fuentes. El banco comprueba espacio libre y rechaza sobrescribir una salida. No lanzar simultáneamente Electron, otra suite nativa o un benchmark.

```sh
python3 experiments/large-data-extracts/benchmark.py --micro \
  --output /private/tmp/freyalab-e0-formatos-repeticion \
  --node /Users/ruzer/.npm/_npx/387698761821791d/node_modules/node/bin/node \
  --pandas-python /Users/ruzer/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3

python3 experiments/large-data-extracts/benchmark.py \
  /private/tmp/FreyaLab-pruebas/ventas_100MiB.csv \
  /private/tmp/FreyaLab-pruebas/ventas_1GiB.csv \
  --output /private/tmp/freyalab-e0-ventas-repeticion \
  --node /Users/ruzer/.npm/_npx/387698761821791d/node_modules/node/bin/node \
  --pandas-python /Users/ruzer/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3
```

Un proceso por motor/tarea/archivo, una repetición, caché caliente por hash previo. T1–T6 y el contrato de importes de dos decimales se describen en el diseño. `time -l` proporciona RSS en bytes; pared incluye arranque/importaciones y escritura, excluye verificación. Salidas CSV se verifican y eliminan por tarea; en excepción pueden quedar temporales, que no deben presentarse como resultados completos. El timeout termina el grupo de procesos propio; no equivale a demostrar cancelación nativa/IPC de producto.

`results.json` contiene versiones, equipo, fecha UTC, SHA Git/hashes de scripts, fuentes antes/después, recuentos, hashes de resultado, hash binario de salida, hash de valores, BOM y fidelidad. Las sumas se contrastan entre Decimal/BigInt/DECIMAL, nunca flotantes. El hash de valores incluye ancho de fila y longitudes de campos. T3 cambia estructura: no se exige igualdad binaria de registros completos; T5 separa registros intactos y transformación de ciudad.

**Límites:** pandas es lectura chunked más iteración Python/escritor estándar, no una prueba vectorizada óptima; Node T1 no realiza validación completa; la durabilidad de los escritores no está homogeneizada; `memory_limit` de DuckDB no es tope RSS ni sandbox. SQL fijo y rutas/identificadores escapados, extensiones y autoinstalación desactivadas. No embeber la CLI en la app a partir de estos números.

## Sondeos negativos

```sh
python3 experiments/large-data-extracts/probe_edges.py \
  --output /private/tmp/freyalab-e0-bordes-repeticion \
  --node /Users/ruzer/.npm/_npx/387698761821791d/node_modules/node/bin/node \
  --pandas-python /Users/ruzer/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3
```

**Se espera código 2 en las versiones evaluadas:** documenta garantías incumplidas, no una prueba positiva. Tres fixtures pequeños × cuatro motores: fila corta frente a vacío, comillas sin cerrar y UTF-16 impar. Node acepta comillas inválidas en T1 y llega a timeout de 2 s con UTF-16 impar; pandas rellena la posición ausente; DuckDB rechaza o da un error de enlace según el caso. JSON distingue rechazo correcto, incompatibilidad, timeout y fallo del banco; no declarar los doce casos como correctos.

## Resultados y limpieza

- [`results/ventas.json`](results/ventas.json): 48/48 coinciden en el fixture regular; originales intactos.
- [`results/formatos.json`](results/formatos.json): 90 coincidencias y seis Windows-1252 no compatibles en DuckDB con extensiones desactivadas.
- [`results/bordes.json`](results/bordes.json): límites negativos explícitos; no paridad universal.

Los JSON y documentación se conservan; los CSV nunca se suben. Tras copiar evidencia, retirar **sólo los subdirectorios propios** `artifacts`, `fixtures`, `outputs` y `scratch` de esa ejecución, comprobando que no son enlaces ni fuentes. Conservar cualquier original y las carpetas de otras tareas. No borrar por comodín/prefijo. Registrar que no queden datos/temporales; si falla la limpieza, indicar la ruta.

El banco no garantiza limpieza automática ante toda interrupción ni borrado forense SSD/APFS/snapshots. En E0 se registró limpieza explícita de sus ejecuciones; los fixtures de usuario permanecen en su carpeta. La política de extractos de producto (ubicación, vida, presupuesto, cierre/recuperación) sigue pendiente de decisión antes de E1.

Las comprobaciones generales (`check`, `test`, `test:e2e`, `build`) y su CI se documentan en evidencia. El benchmark grande y los sondeos Python **no forman parte de la CI**; la CI existente sí ejecuta los 41 tests del PoC. No se certifica empaquetado/instalación de un motor nuevo ni se actualiza la app instalada. E0 se detiene en el PR en borrador.

## M1 — qsv, Miller y Polars (25-oct-2026)

Amplía el banco con qsv, qsvlite, Miller y Polars (Python y Node). [Evidencia](../../docs/evidence/m1-motores-externos-2026-10-25.md), [recomendación](../../docs/design/EXTERNAL-ENGINES.md), procedencia y SHA-256 en [`results/m1-procedencia.json`](results/m1-procedencia.json). **Nada de esto es una dependencia de FreyaLab**: las herramientas se instalan en una carpeta temporal externa al repositorio, con autorización explícita, versiones y hashes fijados. No se toca `package.json`, el lockfile ni el instalador. Medido solo en macOS ARM64.

```sh
M=/private/tmp/freyalab-m1 ; mkdir -p $M/dl-qsv $M/dl-miller $M/qsv-bin $M/miller-bin $M/polars-py $M/node-polars

# qsv 26.0.0 (macOS ARM64): comprobar el SHA-256 antes de extraer; solo se extraen qsv y qsvlite
gh release download 26.0.0 -R dathere/qsv -p 'qsv-26.0.0-aarch64-apple-darwin.zip' -D $M/dl-qsv
shasum -a 256 $M/dl-qsv/*.zip      # feb85ad07a84564e947813b3b847c7628bc7fa56f145c2509bca719541fb9b06
unzip -q $M/dl-qsv/*.zip qsv qsvlite COPYING LICENSE-MIT THIRD_PARTY_NOTICES.md -d $M/qsv-bin

# Miller 6.22.0
gh release download v6.22.0 -R johnkerl/miller -p 'miller-6.22.0-darwin-arm64.tar.gz' -p 'miller-6.22.0-checksums.txt' -D $M/dl-miller
shasum -a 256 $M/dl-miller/*.tar.gz  # b99af86bf902c4fd269c28ec4142111dc27815b3ae63801baceaa001d09b9fd7
tar -xzf $M/dl-miller/miller-6.22.0-darwin-arm64.tar.gz -C $M/miller-bin

# Polars 2.0.0 (Python) en un entorno aislado, con hashes de las dos ruedas
cat > $M/polars-py/requirements.txt <<'REQ'
polars==2.0.0 --hash=sha256:35d62f3541b7a6d4c360a2e2f07fccc0c2bcbd33b0ea51c83a25417a47a3f3ad
polars-runtime-32==2.0.0 --hash=sha256:7012d8a0201bd95638545ce8f256c0efe2c5cab0f806eb043021dddde5a9498b
REQ
UV_CACHE_DIR=$M/uv-cache uv venv --python python3.12 $M/venv-polars
UV_CACHE_DIR=$M/uv-cache uv pip install --python $M/venv-polars/bin/python --require-hashes --no-deps -r $M/polars-py/requirements.txt

# nodejs-polars 0.26.1 (sin scripts de instalación)
cd $M/node-polars && npm init -y && npm install nodejs-polars@0.26.1 --save-exact --ignore-scripts --no-audit --no-fund --cache $M/npm-cache
```

El banco necesita `iconv-lite` para el PoC de Node: ejecutarlo desde un worktree con `node_modules` instalado.

```sh
ARGS="--node $(which node) --qsv $M/qsv-bin/qsv --qsvlite $M/qsv-bin/qsvlite --miller $M/miller-bin/miller-6.22.0-darwin-arm64/mlr \
      --polars-python $M/venv-polars/bin/python --polars-node-dir $M/node-polars"
cd experiments/large-data-extracts

# T1–T6, 100 MiB y 1 GiB (unos 30 min; no lanzar nada más durante la medición)
python3 benchmark.py /private/tmp/FreyaLab-pruebas/ventas_100MiB.csv /private/tmp/FreyaLab-pruebas/ventas_1GiB.csv \
  --output $M/out/ventas --engines python,node,duckdb,duckdb-mt,qsv,qsvlite,miller,miller-1t,polars,polars-1t,polars-node,polars-node-1t $ARGS
python3 benchmark.py <las mismas fuentes> --output $M/out/ventas-duckdb-par --engines python,duckdb-par $ARGS

# Formatos, casos límite y copia sin transformar (salen con código distinto de 0 a propósito si hay discrepancias)
python3 benchmark.py --micro --output $M/out/formatos --engines python,node,duckdb,qsv,qsvlite,miller,polars,polars-node $ARGS
python3 probe_edges.py --output $M/out/bordes --engines python,node,duckdb,qsv,qsvlite,miller,polars,polars-node $ARGS
python3 probe_m1_integrity.py --output $M/out/integridad --qsv ... --qsvlite ... --miller ... --polars-python ... --polars-node-dir ... --node ...

# Cancelación y ordenación completa (1 GiB)
python3 probe_m1_resources.py cancel /private/tmp/FreyaLab-pruebas/ventas_1GiB.csv --output $M/out/cancelacion --engines duckdb,node,qsv,qsvlite,miller,polars,polars-node --after 0.3 ...
python3 probe_m1_resources.py sort   /private/tmp/FreyaLab-pruebas/ventas_1GiB.csv --output $M/out/ordenacion  --engines duckdb,qsv-extsort,qsvlite-extsort,polars,polars-node,qsv-sort,miller ...
```

Variantes: `duckdb-mt` y `duckdb-par` (12 hilos, lector no paralelo y paralelo), `-1t` (un hilo: `POLARS_MAX_THREADS=1`; `miller-1t` usa `GOMAXPROCS=1` y **no limita** a Miller). `benchmark.py` registra también `cpu_user_seconds` y `cpu_sys_seconds` por medición. Las tuberías de qsv se encadenan sin shell y el RSS informado es el mayor de una etapa. `probe_m1_resources.py` termina el grupo de procesos con SIGTERM o SIGKILL y, para `qsv extsort`, indexa un enlace simbólico dentro de la carpeta temporal (`qsv index` escribe `<entrada>.idx` junto a la entrada). Limpieza: retirar `/private/tmp/freyalab-m1` entera al terminar.
