# Integración de la pila DW-02b a DW-04c en `main`

Fecha local: 23 de octubre de 2026. Base: `main` `e62a535` (fusión del PR #29). Rama: `codex/integrate-dw-stack`. Estado: PR de integración **sin fusionar**; no publica una versión ni actualiza la aplicación instalada.

## Por qué hace falta

Los PR #30 a #38 constan como «Merged» en GitHub, pero cada uno tenía como base la rama del anterior. Tras fusionar #29 en `main`, esas ramas no se eliminaron ni se redirigieron, así que los PR se fusionaron en ramas intermedias y su contenido nunca llegó a `main`. Además, el contenido del #34 quedó en una cabeza distinta (`39714c0`) que la punta de la pila (`d19e068`) no contiene. Ver el hallazgo UX-01 de [la auditoría](../audit/UX-UI-CONTINUOUS-IMPROVEMENT.md) (PR #39).

| PR | Contenido | Base real | Cabeza que lo contiene |
|---|---|---|---|
| #30 | DW-02b agrupar fechas | `codex/chart-category-series` | `d19e068` |
| #31 | DW-02c filtros propios del gráfico | `codex/chart-time-groups` | `d19e068` |
| #32 | DW-03a configuraciones guardadas | `codex/chart-local-filters` | `d19e068` |
| #33 | DW-03b exportar resultados | `codex/chart-presets` | `d19e068` |
| #34 | Sondeo de extractos y bases congeladas | `codex/chart-result-exports` | `39714c0` |
| #35 | DW-04a tipo probable de columna | `codex/chart-result-exports` | `d19e068` y `39714c0` |
| #36 | Corrección de foco al desplazar | `codex/column-profile-types` | `d19e068` |
| #37 | DW-04b comprender todas las columnas | `codex/focus-restoration` | `d19e068` |
| #38 | DW-04c varianza y percentiles | `codex/column-overview` | `d19e068` |

## Qué hace este PR

Dos fusiones sin conflictos sobre `e62a535`, sin reescribir historia ni reordenar commits:

1. `9ebae6d` fusiona `codex/descriptive-percentiles` (`d19e068`): 15 commits de #30 a #38.
2. `9e2330d` fusiona `39714c0` (cabeza de `codex/chart-result-exports`, que incluye el #34): añade `docs/ANALYSIS-DATASETS.md`, `experiments/analysis-datasets/` y su evidencia. La corrección de foco de #34 (`2c9108c`) coincide con la de #36 (`2aef4c0`): Git la integró sin cambios en `CsvTable.svelte` ni en `range-cancellation.spec.ts`.

El árbol resultante es el de `d19e068` más exactamente 8 archivos de #34 (1 157 líneas, todos en `docs/` y `experiments/`):

- **`src/`, `tests/`, `package.json` y `package-lock.json` son idénticos a `d19e068`** (`git diff d19e068 HEAD` sin diferencias en esas rutas). No hay dependencias nuevas.
- Contra `main` cambian 82 archivos (44 en `src/` y `tests/`). `.github/workflows/ci.yml` solo sube `timeout-minutes` de 30 a 45 (cambio de la pila, para ejecutores lentos).
- El experimento de #34 es opt-in: vive en `experiments/analysis-datasets/` con su propia configuración de Playwright y **no** forma parte de `npm test`, `npm run test:e2e` ni de `npm run check` (`vitest.config.ts` solo incluye `tests/**`; los `tsconfig` no incluyen `experiments/`).

## Comprobaciones locales sobre `9e2330d`

Worktree aislado, macOS Apple silicon, Node v26.11.1 (el repo declara `engines >= 24`; `.nvmrc` indica 24).

| Comprobación | Resultado |
|---|---|
| `npm run check` | 889 archivos, 0 errores, 0 advertencias |
| `npm test` | 20 archivos, 192 pruebas aprobadas |
| `npm run test:e2e` | 108 aprobadas, sin reintentos (4,2 min) |
| `npm run build` | Correcto |

Los mismos resultados se obtuvieron antes sobre `d19e068` (192 unitarias y 108 E2E), como se esperaba por ser idéntico en `src/` y `tests/`.

## Qué no demuestra

- No sustituye la CI del commit de este PR en los cuatro sistemas: `check`, pruebas y E2E locales no prueban paquete, instalador ni Windows/Linux. Esperar la CI antes de fusionar.
- No valida el experimento de #34 más allá de su propia evidencia (`docs/evidence/pr34-linux-focus-2026-10-22.md`); no se repitió aquí.
- No prueba que la aplicación instalada (`0.1.0-dev.20261022.6208e6b`) sea equivalente a este árbol: se compiló sobre un commit anterior de la pila.
- Los documentos `PROGRESS.md` y `WORKSPACE-EVOLUTION.md` conservan los nombres de las ramas intermedias como registro histórico de cada fase («dependiente del #30», etc.); no se reescriben aquí.

## Tras fusionar (no se hace en este PR)

- Fusionar con **merge commit** (no *squash*) para conservar la historia de los 15+ commits y que `git merge-base --is-ancestor d19e068 origin/main` y `... 39714c0 origin/main` sean ciertos.
- Eliminar las ramas intermedias de #30 a #38 (`codex/chart-time-groups`, `codex/chart-local-filters`, `codex/chart-presets`, `codex/chart-result-exports`, `codex/column-profile-types`, `codex/focus-restoration`, `codex/column-overview`, `codex/analysis-dataset-probe`) solo cuando el propietario lo confirme.
- En lo sucesivo, abrir cada PR contra `main` o redirigirlo al fusionar su base.

## Cómo revertir

Revertir el commit de fusión del PR en `main` con `git revert -m 1 <commit de fusión>`; las dos fusiones internas quedan revertidas juntas. No afecta a la aplicación instalada, a la prerelease ni a las ramas de origen, que se conservan.
