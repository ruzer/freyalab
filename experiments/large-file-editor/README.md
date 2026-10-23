# Experimentos: editor de archivos grandes (Fase 0)

Código **desechable** que respalda `docs/design/LARGE-FILE-EDITOR-RFC.md`. No lo importa nada del producto y no cambia su arquitectura. Todo se puede repetir.

Requisitos: Node 24 (`mise exec node@24 --`), las dependencias del repositorio (`npm ci`) y, solo para el motor nativo, una carpeta **aislada** con DuckDB nativo (el proyecto no añade esa dependencia):

```bash
mkdir /ruta/fuera/del/repo/duckdb-native && cd /ruta/fuera/del/repo/duckdb-native && npm init -y && npm i @duckdb/node-api@2.0.0-r.1
```

## Fixtures

`gen-fixture.mjs` genera CSV/TSV deterministas (semilla), con perfiles `wide` (230 columnas, ceros iniciales), `narrow` (identificadores largos) y `hostile` (multilínea, comillas, Unicode, filas irregulares, vacío frente a ausente, saltos mixtos), y codificaciones UTF-8, UTF-8 con BOM, UTF-16LE y Windows-1252. Comprueba el espacio libre antes de escribir (necesita tamaño × 1,25 + 512 MiB), escribe en flujo y **se niega a escribir dentro del repositorio**. Deja un `.meta.json` con filas, bytes y SHA-256.

```bash
node gen-fixture.mjs --size 5GiB --profile wide --eol lf --seed 11 --out /ruta/fuera/del/repo/fixtures
node gen-fixture.mjs --size 2MiB --profile hostile --eol mixed --seed 3 --out /ruta/fuera/del/repo/fixtures
```

## Qué se mide y cómo repetirlo

| Qué | Comando | Resultado |
|---|---|---|
| Corrección de la superposición, el diario, el guardado y el índice (formatos hostiles pequeños, 4 codificaciones, contra `csv-parse` como oráculo). **Es la prueba que corre en CI.** | `node --test experiments/large-file-editor/tests` | 30 pruebas |
| PoC 1 · superposición + guardado en flujo + recuperación + cambio masivo sobre 5 GiB | `node run-overlay-scale.mjs --file <5GiB.csv> --edits 1000 --results results/overlay-5GiB.json` | `results/overlay-5GiB.json` |
| PoC 2 · DuckDB nativo con controles de seguridad | `node duckdb-native-security.mjs --install <carpeta-aislada> --results results/duckdb-native-security.json` | `results/duckdb-native-security.json` |
| PoC 3 · desplazamiento de 1 M a 500 M de filas en el Chromium de Electron | `node scroll/run.mjs --results results/scroll.json` | `results/scroll.json` |
| PoC 4 · comparación de motores (recuento, filtro, agrupación, análisis de campos, ordenación) | `node run-engine-compare.mjs --plan plan.json --install <carpeta-aislada> --temp <carpeta-temporal> --results results/engines.json` | `results/engines.json` |

Los benchmarks de 1, 5 y 10 GiB **no corren en CI**: son manuales o nocturnos. La CI solo ejecuta `tests/` con fixtures de unos pocos cientos de bytes que fuerzan la lógica del modo grande (trozos de 6 bytes, puntos de control cada 2 registros).

## Límites de lo medido

Una sola máquina (macOS, arm64, SSD interno) y Node 24; cada cifra es una medición, no una garantía. Windows y Linux, sistemas de archivos de red, discos lentos y apagados bruscos del sistema (no solo del proceso) **no se probaron**. El RFC separa lo demostrado de lo estimado y lo pendiente.
