# Vista ampliada y ventanas estrechas del panel de análisis (F2c del espacio de trabajo flexible)

**Fecha:** 23 de octubre de 2026 · **Rama:** `codex/dock-expanded`, apilada sobre `codex/dock-resize-persist` (F2b, [#49](https://github.com/ruzer/freyalab/pull/49)), que a su vez lo está sobre F2a ([#48](https://github.com/ruzer/freyalab/pull/48)).
**Diseño:** `docs/design/FLEXIBLE-WORKSPACE-F2.md` del [PR #46](https://github.com/ruzer/freyalab/pull/46) (§5 vista ampliada y pantallas pequeñas; notas §9d). Sin ventana desacoplada.

## Problema

Con el área de trabajo estrecha (ventana de 1280 px o menos con el explorador por defecto) el panel acoplado dejaba a la tabla 519 px (2 columnas) a 1280×720 y 240 px (1 columna) a 900×600, y el panel quedaba apretado.

## Cambio

- **Modo del panel** (`lib/workspace-layout.ts`, funciones puras): `dockMode({visible, expanded, area})` devuelve oculto, acoplado o ampliado. **La persona decide** (abierto, ampliado); **el espacio manda**: por debajo de 1120 px (520 de panel + 600 de tabla) de área de trabajo el panel se abre ampliado, y al ensanchar la ventana vuelve a acoplarse sin perder pestaña ni contenido.
- **Vista ampliada:** el panel ocupa el área de trabajo y la tabla queda a la izquierda como una tira con el botón **«Volver a la tabla»**. La tabla **sigue montada** (ancho cero, `visibility: hidden`) y conserva búsqueda, filtros, selección y posición de desplazamiento.
- **Controles:** botón **Ampliar / Acoplar** junto a las pestañas (no se muestra con la ventana estrecha: no hay dónde acoplar); **Escape** acopla la vista ampliada antes de que el panel se cierre, y un segundo Escape lo cierra; con la ventana estrecha, «Volver a la tabla» y Escape **cierran** el panel y devuelven el foco a su botón. Dos comandos nuevos en la paleta («Ampliar panel de análisis», «Acoplar panel de análisis»), deshabilitados cuando no tienen sentido.
- **Aviso** en ventana estrecha: «Ventana estrecha: el panel ocupa toda el área. Oculta el explorador o amplía la ventana para verlo junto a la tabla.» Cambios de modo anunciados en una región `status` oculta.
- **`expanded` no se guarda** (solo vive en la sesión; cerrar el panel lo restablece): lo guardado sigue siendo exactamente `{version, dock:{visible,width,tab}}`.

No cambian `main`, el preload, `shared`, el IPC ni las dependencias.

## Pruebas (fallaban primero)

Sobre F2b fallaban 4 pruebas unitarias nuevas (`dockMode`, `isNarrow` y `NARROW_AREA` no existían) y las 7 de `tests/e2e/dock-expanded.spec.ts`. Ahora pasan.

| Prueba | Qué comprueba |
|---|---|
| Ampliar y volver | A 1920×1080, con búsqueda `C1`, una celda seleccionada y la tabla desplazada: al ampliar la tabla se oculta, el divisor desaparece, se anuncia «Panel de análisis ampliado» y el panel ocupa el área; al volver, **búsqueda, selección y desplazamiento (±1 px) son los mismos**, el foco está en la tabla y el panel recupera 520 px con su pestaña |
| Escape | Ampliado → Escape acopla (el panel sigue abierto); otro Escape lo cierra y devuelve el foco a «Gráficos» |
| No se guarda | Ampliado y reiniciado con el mismo perfil: el panel vuelve acoplado; lo guardado no contiene `expanded` |
| Ventana estrecha | A 1280×720 se abre ampliado con el aviso y sin botón Ampliar/Acoplar; al ensanchar a 1920×1080 se acopla con la misma pestaña y la columna X elegida; al estrechar otra vez, ampliado de nuevo |
| Volver con la ventana estrecha | Cierra el panel y el foco vuelve a «Estadísticas» |
| 900×600 | Gráficos, SQL y Resumen: el control principal (`Generar gráfico`, `Ejecutar consulta`, `Analizar`) queda totalmente a la vista y el panel mide ≥ 500 px (antes quedaban 140 px junto a la tabla) |
| Comandos | Deshabilitados con el panel cerrado; «Ampliar» solo acoplado; «Acoplar» solo ampliado |

Con Node 24 en macOS: `npm run check` sin errores ni avisos; `npm test` 222 (218 + 4); `npx playwright test` 130 (123 + 7): 129 pasaron en la ejecución completa y la restante, ajustada abajo, pasa (`selection-statistics.spec.ts` 4/4). La CI queda por verificar.

## Efecto en una prueba existente

`selection-statistics.spec.ts` («estadísticas del rango…») hace capturas a 1440×900 y a 1280×800 y **sigue usando la tabla** después, con el panel abierto. A 1280 px el área mide 1039 px y el panel pasa a ampliado, ocultando la tabla (comportamiento previsto). Se añade una línea que devuelve la ventana a 1440×900 tras el bucle de capturas; no se cambia ninguna aserción.

## Medidas

Con el explorador por defecto (240 px), el área de trabajo mide 1679 / 1199 / 1125 / 1039 / 659 px a 1920 / 1440 / 1366 / 1280 / 900 px de ventana: **acoplado hasta 1366 px** (1125 ≥ 1120, justo) y **ampliado a 1280 px y por debajo**. Ocultar el explorador devuelve ~240 px y permite acoplar a 1280 px. Capturas: [vista ampliada a 1440×900](dock-ampliado-1440x900-claro.png) y [ventana estrecha a 900×600](dock-estrecho-900x600-oscuro.png).

## Límites

- A 900×600 las filas de la barra de herramientas se envuelven y dejan unos 270 px al panel: es utilizable (cada control principal queda a la vista tras desplazarse), pero justo. No se oculta el explorador automáticamente (sería sorprendente); queda el aviso.
- El umbral de 1120 px sale de una sola configuración de columnas y no se ha probado con personas.
- La cota `min-width: 360 px` del panel (F2a) queda sin efecto práctico: por debajo de 1120 px el panel ya está ampliado.
- Solo macOS; Windows y Linux por la CI.
