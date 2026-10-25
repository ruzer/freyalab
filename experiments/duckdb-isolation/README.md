# M3 — aislamiento, integración, memoria, empaquetado y firma de DuckDB nativo

Experimentos **aislados** (no son código de producto): `@duckdb/node-api` se instala en una carpeta temporal, no se toca `package.json` ni el lockfile. Resultados y conclusiones: [`docs/evidence/m3-aislamiento-2026-10-25.md`](../../docs/evidence/m3-aislamiento-2026-10-25.md). Flujo de CI: `.github/workflows/m3-duckdb-isolation.yml` (macOS ARM e Intel, Linux y Windows).

| Archivo | Qué hace |
|---|---|
| `lib/confine.mjs` | Ejecuta un programa dentro de una capa del sistema operativo: `sandbox-exec` (macOS), `bubblewrap` (Linux) o AppContainer + objeto de trabajo (Windows). `confinedRun` espera; `spawnConfined` deja un proceso persistente con líneas JSON por stdin/stdout. |
| `windows/appcontainer.ps1` | Lanzador de Windows (PowerShell + C# compilado en memoria): perfil de AppContainer sin capacidades, objeto de trabajo con tope de memoria opcional, concesiones de ACL, reenvío de tuberías (`-Relay`) y traza `launcher-trace.txt`. |
| `isolation.mjs` | Un proceso por operación dentro de la capa y sondeo de lo que aún puede hacer; en Windows, prueba del tope de memoria. |
| `integration.mjs`, `lib/integration-core.mjs`, `electron/main.mjs` | El proceso principal (Node o Electron, sin empaquetar o empaquetado) lanza el worker de M2 en la capa: sondeo, autocomprobación de M2, arranque en frío, matar a mitad de operación, memoria y reciclaje; `electron/main.mjs` añade el control del `utilityProcess`. |
| `confined-worker.mjs`, `lib/confined-host.mjs`, `lib/probes.mjs`, `utility-probe.mjs` | Worker con protocolo por líneas, anfitrión (Host de M2 con tiempo máximo de arranque y parada ordenada) y sondeos de acceso. |
| `schema-parallel.mjs` | Lector de DuckDB con esquema explícito (paralelo, no paralelo, un hilo) frente a `csv-parse`: 26 casos hostiles y un archivo de 64 MiB con varios tamaños de trozo. |
| `signing.mjs` | Inventario de binarios por firmar, fusible `RunAsNode`, variantes ad hoc (macOS) y, con `--identity`, variantes con un Developer ID real. **No firma de verdad.** |
| `installers.mjs` | Construye DMG, NSIS, AppImage y DEB de la mini-aplicación, los instala como `scripts/package-smoke.mjs` y ejecuta la autocomprobación. |
| `ci/` | Preparación de la mini-aplicación (`stage-app.mjs`), lanzador de Electron, localizador del ejecutable, resumen (`summarize.mjs`) y tablas (`aggregate.mjs`). |

**Aviso en macOS:** las variantes de `signing.mjs` con runtime reforzado y sin `disable-library-validation` hacen que macOS 27 muestre un informe de fallo (esperado). Ejecútalas en la CI.
