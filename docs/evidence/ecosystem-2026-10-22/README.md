# Evidencia de evaluación — 2026-10-22

[Evaluación y decisión](../../OPEN-SOURCE-ECOSYSTEM.md).

- `collection.json`: ventana, fecha de consulta y errores iniciales.
- `github.json`: snapshot de repositorios, issues de muestra, PR y conteos de historial.
- `active-authors.json`: primera paginación; DuckDB quedó incompleta por un fallo TLS, no usar su cifra como total.
- `duckdb-history.json`: recuperación separada con estado `complete`, autores de DuckDB y wrapper WASM. El informe solo usa el total cuando complete=true.
- `duckdb-head-comparison.json`: diferencia de 44 commits verificada; el cálculo de autores de DuckDB se alinea con el SHA inicial, sin repetir todo el historial.
- `effective-active-authors.json`: autores usados por el informe; guarda el límite inferior si no hay recuperación completa.
- `contributors-total.json`: contribuidores históricos de REST y método.
- `response-sample.json`: muestra censurada de primera respuesta de mantenedores.
- `npm.json`, `package-compatibility.json`: versiones/fecha/licencia/tamaños/dependencias/types/exports.
- `advisories.json`, `*-repository-advisories.json`: avisos públicos directos, no equivalen a vulnerabilidades de las versiones actuales.
- `baseline-npm-audit.json` y `prototype-npm-audit.json`: avisos sobre los árboles exactos, sin ejecutar fixes.
- `prototype-results.json`: cuatro montajes ya verificados, memoria observada y configuración.
- `integrity-results.json`: ensayo adicional de procesamiento/integridad, con datos sintéticos.
- `prototype-package-lock.json`: árbol temporal exacto; NO es el lockfile de FreyaLab.
- `prototype-source/*.txt`: fuentes del experimento como evidencia, NO entradas del build ni una aplicación distribuida. Los paths absolutos reflejan la máquina del ensayo; para reproducir, sustituir raíz de FreyaLab y carpeta temporal, usar los runtimes/versiones declarados y ejecutar únicamente en carpeta aislada. El montaje usa el Vite/Svelte/Playwright/Electron ya instalado en FreyaLab; no modifica su package.json.
- `scoring.json`: juicios explícitos, pesos y sensibilidad; no son métricas de GitHub.

Los scripts `*.py.txt` registran el método de recolección, no se ejecutan en la app ni en CI. No contienen credenciales; gh usa la sesión local autorizada. Las pruebas de red solo permiten loopback/blob. No se almacenaron documentos del usuario.
