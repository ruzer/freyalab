# Historia CI-1 — Pruebas por área en los PR (menos tiempo, misma red de seguridad)

Diseño: Claude. Implementa: Codex. Decide y fusiona: el propietario (incluida cualquier regla de protección de rama en GitHub).
Va en paralelo al trabajo del editor; no depende de H13 ni H14. No toca el producto, solo `.github/`, `scripts/`, `tests/` y documentación.

## Historia
Como mantenedor, quiero que un PR corra las pruebas de lo que cambió (Markdown/Mermaid, CSV o la base) y que la prueba completa quede para cambios transversales y para `main`, para no agotar los plazos del CI ni tropezar con pruebas ajenas, sin perder la protección de la rama principal.

## Evidencia (lectura de `main` ed38479 y de los CI de #117–#121)
- `ci.yml` en `pull_request` corre en **ubuntu, windows y macos-15**: `check`, `npm test` (≈125 archivos, ≈2.4 mil casos), E2E «rápidas» (`--grep-invert "@perf|@solo"`), E2E `@perf|@solo`, `electron-builder --dir` y otra tanda de E2E sobre la app empaquetada. Plazo: 60 min en macOS y Windows, 45 en Linux.
- macOS tarda 30–47 min y #117 se canceló en 1 h 01 min. Ubuntu: ≈21 min solo en E2E rápidas.
- `playwright.config.ts` ya define tres proyectos (`shell`, `md`, `csv`; `tests/e2e/groups.ts`) y `package.json` ya tiene `test:e2e:md` y `test:e2e:csv`. **Hoy el CI no los usa**: siempre corre todo.
- Una prueba inestable de Markdown (`markdown-selection.spec.ts:123`, de #116) puso en rojo cuatro PR, incluidos los que no tocaban selección: es el coste de no separar por área.
- `Editor.svelte` lo comparten md, mmd, txt y CSV Texto: es transversal aunque viva en un componente «de Markdown».

## Principios
1. **Ante la duda, completo.** Lo que no esté en el mapa cae en «transversal» (prueba completa). Nunca en «nada».
2. **`main` conserva la prueba completa** en las tres plataformas, y Intel de noche (como hoy). El PR gana velocidad; `main` conserva garantía. `candidate.yml` ya exige un CI completo en `main` y no cambia.
3. **Un solo mapa, probado**, sin dependencias nuevas (ADR 0021: ni `dorny/paths-filter` ni otra acción de terceros; un script de Node con `git diff --name-only`, pinned como el resto del repo).
4. Un spec modificado en el PR **siempre** corre, aunque su área no se haya tocado.
5. Ninguna prueba se borra ni se relaja en esta historia.

## Entrega en 3 PR pequeños (pruebas rojas primero; borrador; base `main`)

### CI-1a Medir y mapear (sin tocar workflows)
- Informe de tiempos por proyecto (`shell`, `md`, `csv`), por fase (check, unitarias, E2E rápidas, perf/solo, empaquetado, E2E del paquete) y por sistema, tomado de los registros de al menos 5 corridas recientes de `main` y de PR. Va a `docs/evidence/ci-tiempos-AAAA-MM-DD.md`, con fecha y SHA. Sin esto no se decide el umbral.
- `scripts/ci-areas.mjs` (o `.ts` según el repo): recibe la lista de rutas cambiadas y devuelve `{checks:true, unit:true, e2e:['shell'|'md'|'csv'...], full:boolean, package:boolean, specs:[...]}`.
- Mapa inicial (Codex lo verifica con los imports reales y lo corrige; lo desconocido es transversal):

| Rutas | Área |
|---|---|
| `Markdown*`, `Preview`, `Diagram`, `Outline`, `TextStats`, `PandocDialog`, `AssetWarnings`, `lib/markdown*`, `lib/mermaid*` y lo que importen solo ellos; specs de `mdFiles` | `md` (+ `shell`) |
| `Csv*`, `Chart*`, `AnalysisDock`, `lib/csv*`, motor y workers de CSV; specs que no estén en `shellFiles` ni `mdFiles` | `csv` (+ `shell`) |
| `Editor.svelte`, `App.svelte`, `style.css`, `lib/i18n*`, `src/shared/**`, `src/main/**` salvo módulos exclusivos de un área, `src/preload/**`, `electron.vite.config.ts`, `playwright.config.ts`, `tests/e2e/groups.ts`, `package.json`, `package-lock.json`, `.github/**`, `scripts/**` | **completo** |
| `docs/**` ya se omite hoy | nada |
| `package`: `package.json`, configuración de `electron-builder`, `build/**`, `src/main/**`, `src/preload/**`, `electron.vite.config.ts` | además, empaquetado y E2E del paquete |

- **Pruebas (rojas primero, unitarias):** (a) cada `*.spec.ts` pertenece a exactamente un proyecto; (b) rutas conocidas dan el área esperada (tabla de casos); (c) una ruta desconocida da `full`; (d) un PR que cambia un spec lo incluye aunque su área no se toque; (e) cambiar `groups.ts` o este script da `full`.

### CI-1b Workflow por áreas con una compuerta
- `ci.yml` ejecuta el script al inicio del PR y condiciona los pasos: `check` y `npm test` siempre; E2E `shell` siempre; `md` o `csv` según el mapa; ambos si `full`.
- Empaquetado y E2E del paquete solo si `package` o `full`.
- Un job final **«Gate»** (siempre corre, `if: always()`) que falla si cualquier parte requerida falló o fue cancelada y pasa cuando las omitidas fueron intencionales. Es el único check que el propietario marcará como requerido. Codex documenta el cambio; **no toca la protección de rama** (decisión del propietario).
- `push` a `main`, `schedule` y `candidate.yml`: sin cambios; siempre completo.
- Los comandos locales se mantienen: `npm run test:e2e:md`, `test:e2e:csv`. Añadir `test:e2e:area` que reciba el resultado del script (para reproducir un PR en local).
- Aceptación: tres PR de prueba con el mismo contenido de código que el real (uno solo de `md`, uno solo de `csv`, uno que toca `Editor.svelte`): el primero corre `shell`+`md`, el segundo `shell`+`csv`, el tercero todo. Informar los tiempos de cada uno contra el de hoy.

### CI-1c Reducir sistemas en el PR
- En PR: la E2E por área corre en **Ubuntu**; Windows y macOS corren `check`, unitarias, `shell` y una verificación de empaquetado/arranque (smoke) **solo cuando `package`**. En `main`: matriz completa como hoy.
- Si el informe CI-1a muestra que Ubuntu por sí sola tarda más de ≈30 min en un PR `full`, proponer partir `md` y `csv` en dos jobs paralelos.
- Aceptación: un PR `md` termina sin pasar de la mitad del plazo actual en macOS (medir); un PR `full` conserva las tres plataformas. Documentar cómo se reproduce un fallo de Windows/macOS que solo aparezca tras fusionar (hoy sería un `main` rojo: pasos de aviso y reversión).

## Qué NO entra
- No se relajan ni borran pruebas, ni se suben plazos por comodidad (el cambio de 75 min de #119 es aparte).
- No se hace «solo las pruebas relacionadas» por análisis estático de imports del test (frágil); el mapa por carpetas es explícito y revisable.
- No se cambia la protección de rama, ni secretos, ni permisos del workflow.
- Estabilizar la prueba de selección es #121, independiente.

## Riesgos que Codex debe dejar escritos en el PR
1. Un cambio de área que rompe otra se verá en `main`, no en el PR. Mitigación: lista transversal conservadora y `main` completo.
2. Dos fuentes de verdad (grupos de `groups.ts` y el mapa de rutas): la prueba (a)/(e) las ata.
3. Si el job Gate se omite por error, el PR no queda protegido: la compuerta debe fallar si el cálculo de áreas falla.

## Informa
Head de cada PR, tiempos medidos antes y después con SHA y número de corrida, qué rutas del mapa verificaste con imports reales y cuáles son suposiciones.
