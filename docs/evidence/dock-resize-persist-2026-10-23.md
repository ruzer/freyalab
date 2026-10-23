# Divisor y persistencia del panel de análisis (F2b del espacio de trabajo flexible)

**Fecha:** 23 de octubre de 2026 · **Rama:** `codex/dock-resize-persist`, apilada sobre `codex/analysis-dock` (F2a, [#48](https://github.com/ruzer/freyalab/pull/48)) con `main` fusionado.
**Diseño:** `docs/design/FLEXIBLE-WORKSPACE-F2.md` del [PR #46](https://github.com/ruzer/freyalab/pull/46) (§4 divisor, §6 persistencia; F2b). Sin vista ampliada ni pantallas pequeñas (F2c).

## Cambio

- **`lib/workspace-layout.ts`** (nuevo, funciones puras): valores (`DOCK_MIN` 520, `TABLE_MIN` 600, `DOCK_MAX` 3000), lectura segura del valor guardado, `dockRange` y `nextWidth` (los pasos del teclado).
- **`lib/workspace.svelte.ts`** (nuevo): estado compartido `{visible, width, tab}` que vive fuera de `CsvTable`, así que **el panel abierto pasa de un documento a otro**, y `saveWorkspace()`.
- **`AnalysisDock.svelte`**: divisor `role="separator"` enfocable en el borde izquierdo del panel (`aria-orientation`, `aria-valuemin/max/now`, `aria-controls`). Teclado: ← ensancha y → estrecha 16 px (64 con Mayús); Inicio al mínimo, Fin al máximo; Intro o doble clic restablecen 520 px. Puntero: el ancho se aplica una vez por fotograma y **se guarda una sola vez al soltar**. El ancho guardado es una preferencia; el mostrado se ajusta al espacio disponible.
- **`CsvTable.svelte`**: usa el estado compartido; mide el ancho del área (`bind:clientWidth`) y guarda al abrir, cerrar o cambiar de pestaña.
- **`CsvStatistics.svelte`**: propiedad opcional `autofocus` (por defecto `true`): un panel restaurado al abrir otro documento o al reiniciar no roba el foco.

Almacenamiento: `localStorage`, clave `freya-workspace`, exactamente `{"version":1,"dock":{"visible","width","tab"}}`. Nada de datos del documento. Versión, tipos o pestaña incorrectos, JSON roto o claves ajenas → valores por defecto o claves ignoradas, sin avisos. No cambian `main`, el preload, `shared`, el IPC ni las dependencias.

## Pruebas (fallaban primero)

Sobre el código de F2a: `tests/workspace-layout.test.ts` no podía importarse (módulo inexistente) y las 5 pruebas de `tests/e2e/dock-resize.spec.ts` fallaban (no había divisor). Ahora pasan.

| Prueba | Qué comprueba |
|---|---|
| Unitarias (23) | Lectura segura: 14 valores corruptos o de otra versión → por defecto; recorte y redondeo del ancho; claves ajenas ignoradas y no reescritas; rango según el área (1679 → 520–1079; 1199 → 520–599; 1039 → 520–520); pasos y teclas |
| Divisor con teclado | Atributos ARIA; 520 → 536 → 600 → 584 → 520; no baja del mínimo ni supera el máximo; la tabla conserva ≥ 540 px; Inicio, Fin e Intro; el ancho real del panel coincide con `aria-valuenow` |
| Divisor con puntero | Arrastrar 120 px ensancha 120 px (±2); 15 movimientos = **una** escritura; arrastrar a la derecha no baja del mínimo |
| Entre documentos | El panel abierto (Estadísticas, 584 px) sigue abierto, en la misma pestaña y ancho, al cambiar de documento, **sin llevar el foco al panel**; cerrado en uno, cerrado en todos |
| Reinicio con el mismo perfil | Se restauran visibilidad, pestaña (SQL) y ancho (600 px); cerrar también se recuerda; lo guardado es exactamente `{version:1,dock:{visible,width,tab}}` |
| Valor corrupto | Otra versión o JSON roto: panel cerrado, valores por defecto (520 px, Resumen), ningún aviso |

Con Node 24 en macOS: `npm run check` sin errores ni avisos; `npm test` 218 (195 + 23); `npx playwright test` 123 pruebas (118 + 5 nuevas): 122 pasaron en la ejecución completa y la que fallaba (la de `charts` descrita arriba) pasa tras el ajuste; `charts.spec.ts` completo 23/23.

## Efecto en las pruebas existentes

Como el panel ahora **recuerda que estaba abierto**, 13 pruebas existentes que abrían un segundo documento (o reiniciaban) y pulsaban otra vez el botón del panel para abrirlo lo cerraban en su lugar. No se debilitó ninguna aserción: se añade `tests/e2e/panel.ts` (`showPanel`: abre el panel o cambia a su pestaña solo si hace falta) y se usa en los puntos de apertura de `charts` (8), `columns-overview`, `descriptive-percentiles`, `selection-statistics`, `statistics-reports`, `sql` (1 cada una) y `ui` (2). Las pruebas que cierran el panel siguen usando el botón directamente. Una prueba de `charts` (configuraciones con columnas duplicadas) guardaba una configuración por IPC con el panel ya abierto y esperaba que el panel la leyera al abrirse: ahora cierra el panel antes de guardar, para conservar ese orden (no es un fallo del producto: el panel carga su lista al montarse).

## Decisiones y desvíos respecto al diseño

1. **Inicio = mínimo, Fin = máximo** (el diseño decía «máximo/mínimo» sin precisar): semántica de los controles deslizantes de WAI-ARIA.
2. **Nombre accesible del divisor: «Ancho del panel»**, para no coincidir con la etiqueta «Panel de análisis» del propio panel en las búsquedas por etiqueta.
3. **Se restaura `visible`** (la decisión que el diseño dejaba abierta): el panel abierto pasa de un documento a otro y tras reiniciar. Es un cambio de comportamiento visible: el botón de la pestaña activa cierra el panel también en el documento siguiente.
4. Cota absoluta de 3000 px al leer (solo seguridad ante valores corruptos) y zona de agarre del divisor de 6 px: valores de partida sin validar con personas.

## Límites

Solo macOS; Windows y Linux por la CI. Los pasos de 16/64 px son valores de partida. Con el área de trabajo menor de 1120 px el divisor no tiene recorrido (mínimo = máximo = 520 px) y el panel cede espacio por CSS hasta 360 px; lo resuelve F2c. La captura de pantalla del divisor enfocado no se incluye.
