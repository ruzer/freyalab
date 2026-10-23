# Panel restaurado en una ventana estrecha: arranca cerrado

**Fecha:** 23 de octubre de 2026 · **Rama:** `codex/dock-narrow-start` sobre `main` (con F2a, F2b y F2c integrados).
**Decisión:** la persona confirmó que el panel debe recordar si estaba abierto y que, **si se restaura al arrancar y la ventana es estrecha (menos de 1120 px de área de trabajo), debe arrancar cerrado en lugar de ampliado.** Notas en `docs/design/FLEXIBLE-WORKSPACE-F2.md`, §9e.

## Problema

Con el panel guardado como abierto, abrir un CSV en una ventana estrecha (típicamente 1280 px o menos con el explorador por defecto) mostraba el panel **ampliado y la tabla oculta**: justo lo que no se espera al abrir un archivo. La CI de F2c lo hizo visible: la ventana de arranque de los ejecutores es más estrecha que 1120 px y dos pruebas de reinicio no encontraban la tabla.

## Cambio

- **`restoreVisible(stored, area)`** (`lib/workspace-layout.ts`, función pura): un panel guardado como abierto se restaura si el área admite acoplarlo.
- **`settleStartup(area)`** (`lib/workspace.svelte.ts`): decide **una sola vez**, al medir el área de la primera tabla, y **no toca lo guardado**: la misma preferencia se restaura abierta en una ventana ancha. Cualquier acción de la persona (abrir, cerrar, cambiar de pestaña, mover el divisor) zanja la decisión.
- **`CsvTable.svelte`:** `$effect.pre` llama a `settleStartup` antes de pintar, y **el panel no se monta hasta medir el área**, así que un panel que va a empezar cerrado nunca llega a montarse (sin parpadeo ni trabajo desperdiciado).
- Después del arranque nada cambia: estrechar la ventana amplía el panel y ensancharla lo acopla (F2c); ensanchar una ventana que arrancó cerrada no lo abre solo.

No cambian `main`, el preload, `shared`, el IPC ni las dependencias.

## Pruebas (fallaban primero)

Antes del cambio fallaban 3 pruebas unitarias nuevas (`restoreVisible` no existía) y 2 de las 3 E2E de `tests/e2e/dock-startup.spec.ts`; la tercera (ventana ancha) ya pasaba y se conserva como guarda. Ahora pasan las cuatro E2E:

| Prueba | Qué comprueba |
|---|---|
| Ventana estrecha | Con el panel guardado como abierto, abrir el CSV a 1100 px de ancho deja la tabla visible, el panel cerrado, sin aviso ni alerta y `aria-expanded="false"`; **lo guardado sigue siendo `{visible:true,…}`**; y la persona puede abrirlo (se abre ampliado, con su aviso) |
| Ventana ancha | El mismo perfil, a 1920 px: panel abierto, acoplado, en la pestaña guardada |
| Después del arranque | Restaurado abierto en una ventana ancha: estrechar lo amplía y ensanchar lo acopla, sin cerrarlo |
| Arrancó cerrado | Ensanchar la ventana después no lo abre solo y no altera lo guardado |

Con Node 24 en macOS: `npm run check` sin errores ni avisos; `npm test` 237 (234 + 3); `npx playwright test` 145 (141 + 4), todos pasan. La CI queda por verificar.

## Efecto en pruebas existentes

Dos pruebas de reinicio abrían el CSV al arrancar con `FREYALAB_TEST_OPEN`, con la ventana de arranque (que en la CI es estrecha). Ahora fijan el tamaño y abren el CSV después (`dock-resize.spec.ts`: «tras reiniciar con el mismo perfil…»; `dock-expanded.spec.ts`: «la vista ampliada no se guarda…»). Ninguna aserción cambia.

## Límites

- La decisión se toma con la primera tabla de la sesión: si se abre primero un documento que no es CSV, se aplaza hasta el primero que lo sea.
- No hay aviso de que el panel quedó cerrado por la ventana estrecha; el botón de la barra lo refleja y la persona lo abre cuando quiera.
- El umbral de 1120 px sale de una sola configuración de columnas y no se ha probado con personas.
- Solo macOS; Windows y Linux por la CI.
