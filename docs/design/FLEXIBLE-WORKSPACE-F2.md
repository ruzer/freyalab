# Espacio de trabajo flexible — diseño técnico de F2 (panel lateral acoplado y vista ampliada)

**Estado:** diseño para revisar; sin código de producto. **Fecha:** 23 de octubre de 2026, sobre `main` en `3028cbe` (incluye #42 iconos y #43 diseño del espacio de trabajo).
**Alcance:** panel lateral acoplado, vista ampliada, pestañas Resumen / Gráficos / SQL, redimensionamiento, persistencia del layout y adaptación a pantallas pequeñas. **No incluye la ventana desacoplada** (F4) ni cambia IPC, preload o `main`.
**Parte de:** [diseño del cierre arquitectónico](FLEXIBLE-WORKSPACE.md) (decisiones D1–D8, §7 UX) y de la cola de consultas de F1 (PR #44). Los criterios y mediciones se citan de allí; no se repiten estudios.

## 0. Resumen

1. **F2 es una reorganización del renderer, no una función nueva.** Los tres paneles existentes (`CsvStatistics`, `CsvCharts`, `CsvSql`) se reutilizan sin cambiar sus props ni sus llamadas a `window.freya`; solo cambia dónde se colocan y cómo se cambia entre ellos.
2. **Ya son mutuamente excluyentes.** Los comandos `sql`, `statistics` y `charts` cierran los otros (`CsvTable.svelte:43`–`:45`), así que la interfaz ya se comporta como pestañas; F2 lo hace explícito, accesible y lateral.
3. **El dock vive dentro de `CsvTable`**, donde ya están los datos que los paneles necesitan (rango, consulta, columnas, firma de vista). Por eso F2 no necesita el modelo de vista en `main` que sí exige F4.
4. **Un único contenedor nuevo (`AnalysisDock.svelte`)** aporta pestañas, divisor, modo ampliado y estado; el contenido de cada pestaña llega como fragmentos (*snippets*) de Svelte 5, de modo que F4 podrá reutilizar el mismo contenedor en otra ventana.
5. **Persistencia en `localStorage`** (patrón que ya usan `freya-sidebar`, `freya-sidebar-width` y `freya-split`), con una clave versionada y validada. Es una desviación consciente de F0 §6 (archivo en `main`): evita añadir operaciones al preload en F2; el archivo de `main` entra en F4, cuando hay que guardar posiciones de ventana (§6).
6. **Se entrega en tres PR pequeños** (F2a, F2b, F2c), cada uno verificable por separado (§9). Primera recomendada: **F2a**.

## 1. Punto de partida (hechos del código y mediciones)

| Hecho | Dónde | Consecuencia para F2 |
|---|---|---|
| Los paneles se apilan sobre la tabla dentro de `.csv-workspace` (columna flex) | `CsvTable.svelte:172`, `:204`–`:206` | El dock cambia la columna por una fila: tabla a la izquierda, dock a la derecha. |
| Con Gráficos abierto la tabla pasa de 19 a 2 filas (1440×900) y a 0 en 1366×768 y 1280×720 | auditoría UX-03 | Con el dock la tabla conserva **todas** las filas. |
| Botones «Análisis» (SQL), «Estadísticas» y «Gráficos» en la barra; cada uno llama a `runCommand` | `CsvTable.svelte:180`–`:182` | Se conservan: abren el dock en su pestaña. Las pruebas que los usan siguen válidas. |
| Los paneles se desmontan al cerrarse y cancelan sus solicitudes (`onDestroy`) | `CsvSql.svelte:23`, `CsvCharts.svelte:37` | Con F1 esto libera la cola. El dock debe seguir desmontándolos al cerrarse. |
| SQL guarda su borrador al desmontarse (`drafts`); Gráficos y Resumen no guardan nada | `CsvSql.svelte:23` | Si cambiar de pestaña desmontara, Gráficos perdería su configuración. **Las pestañas visitadas se mantienen montadas y ocultas** (§3.3). |
| `CsvTable` se recrea al cambiar de documento (`{#key active.id}`) | `App.svelte:75` | El estado del dock (abierto, pestaña, ancho) debe vivir **fuera** de `CsvTable` para sobrevivir al cambio de documento. |
| El divisor del editor es un `button` con `role="slider"`, flechas ±2 y puntero | `App.svelte:95` | Patrón de referencia para el nuevo divisor. |
| Ancho de la tabla (área de trabajo) según ventana, con el explorador por defecto (240 px): 1679 / 1199 / 1125 / 1039 px a 1920 / 1440 / 1366 / 1280 | M3 | Dimensionan los umbrales de §5. |
| Un gráfico generado no desplaza horizontalmente desde **520 px** de ancho de panel (480 sí) | M2 | Ancho mínimo del dock. |
| Controles actuales de Gráficos ≈ 502 px de alto y gráfico 340 px | M3 | El dock debe desplazarse por dentro; tras generar, el gráfico debe quedar a la vista (§3.5). |
| La ventana tiene `minWidth: 900` y `minHeight: 600` | `src/main/index.ts:86` | A 900 px el área de trabajo mide ~660 px: el dock no cabe (§5). |
| No hay lógica responsive ni consultas `@media` en la interfaz | búsqueda en `src/renderer` | La adaptación se calcula con la anchura del área de trabajo (no de la ventana), porque depende del explorador. |

## 2. Modelo de estado

```text
Layout persistido (localStorage, clave `freya-workspace`, versión 1)
  { version: 1, dock: { visible: boolean, width: number, tab: 'resumen' | 'graficos' | 'sql' } }

Estado de sesión (solo memoria)
  expanded: boolean              // vista ampliada; siempre empieza en false
  opener: HTMLElement | undefined // botón de la barra que abrió el dock, para devolver el foco

Modo efectivo (derivado, no se guarda)
  oculto     si !dock.visible
  acoplado   si visible && anchoDelArea − dock.width ≥ TABLA_MIN        (y !expanded)
  ampliado   si visible && (expanded || anchoDelArea < DOCK_MIN + TABLA_MIN)
```

- **Quien manda es la intención de la persona (`visible`, `expanded`); el modo efectivo se deriva del espacio.** Si la ventana se estrecha, un dock acoplado pasa a ampliado sin cambiar lo guardado; si vuelve a ensancharse, regresa a acoplado. Nada se "pierde" por redimensionar la ventana.
- El estado vive en un módulo del renderer (`workspace-layout.ts`, un `$state` compartido), no en `CsvTable`, para sobrevivir a `{#key active.id}`.
- `TABLA_MIN = 600 px` y `DOCK_MIN = 520 px` salen de las mediciones (M3: con 605 px de tabla se ven 3 columnas por defecto; M2: 520 px sin desplazamiento horizontal del gráfico). Son valores derivados de una sola configuración de columnas, no umbrales validados con personas.

## 3. Componentes

### 3.1 `AnalysisDock.svelte` (nuevo, presentacional)

Contenedor sin lógica de análisis. Recibe: pestaña activa, modo, ancho, `onclose`, `onexpand`, `onresize`, y un fragmento por pestaña. Aporta: cabecera con pestañas y botones «Ampliar»/«Acoplar» y «Cerrar», divisor y área desplazable.

```svelte
<AnalysisDock {tab} {mode} {width} onclose onexpand onresize ontab>
  {#snippet resumen()}<CsvStatistics …/>{/snippet}
  {#snippet graficos()}<CsvCharts …/>{/snippet}
  {#snippet sql()}<CsvSql …/>{/snippet}
</AnalysisDock>
```

### 3.2 Cambios en `CsvTable.svelte`

- La columna `.csv-workspace` pasa a contener una **fila** `.csv-body`: `.csv-main` (barra de operaciones, opciones, tabla) y el dock.
- `showSql`, `showStatistics` y `showCharts` dejan de ser tres booleanos y pasan a derivarse de `dock.visible` y `dock.tab` (los comandos `sql`, `statistics`, `charts` y los tres botones de la barra siguen existiendo y fijan la pestaña).
- Los tres paneles se pasan al dock como fragmentos con **las mismas props de hoy**.

### 3.3 Política de montaje

| Situación | Comportamiento |
|---|---|
| Dock cerrado | Nada montado (como hoy): se cancelan solicitudes y se libera memoria. |
| Primera visita a una pestaña | Se monta (Gráficos sigue con `import()` diferido). |
| Cambio de pestaña | La anterior queda montada y oculta (`hidden`); conserva configuración y resultado. |
| Cambio de documento | `CsvTable` se recrea: todo se desmonta (como hoy). |

Consecuencias que F2 debe comprobar: un gráfico oculto que cambia de tamaño debe redibujarse al mostrarse (`chart.resize()` al activar la pestaña); las solicitudes de una pestaña oculta siguen su curso en la cola de F1 y su aviso «En cola» se ve al volver (opcional: punto de actividad en la pestaña).

### 3.4 Pestañas (accesibilidad)

Patrón ARIA de pestañas con **activación manual**:

- `role="tablist"` con `aria-label="Herramientas de análisis"`; tres `role="tab"` con `aria-selected`, `aria-controls`, y *roving tabindex* (solo la activa en la secuencia de tabulación).
- Flechas ←/→ mueven el foco; Inicio/Fin van a la primera/última; Intro o Espacio activa (cambiar de pestaña puede lanzar trabajo, por eso no se activa al enfocar).
- Cada `role="tabpanel"` con `aria-labelledby` de su pestaña. Las regiones internas conservan sus nombres actuales (`Gráficos del CSV`, `Análisis SQL y asistentes`, etc.): las pruebas E2E y los lectores de pantalla siguen encontrándolas.
- Nombres de pestañas: **Resumen** (hoy `CsvStatistics`, que incluye vista general de columnas y análisis de columna), **Gráficos**, **SQL**.

### 3.5 Resultado a la vista en Gráficos

El dock se desplaza por dentro (`overflow: auto`). Tras «Generar gráfico» el gráfico se lleva a la vista del dock sin que la persona tenga que desplazarse (criterio de aceptación; la solución mínima es desplazar el contenedor del gráfico a la vista al terminar). **No se reordenan los controles de Gráficos**: eso pertenece al constructor guiado (UX-06/UX-07), fuera de F2. Esto vuelve obsoleta la corrección provisional de UX-03 (rama local `codex/chart-panel-keeps-table`, nunca publicada): conviene descartarla cuando llegue F2a.

## 4. Divisor y redimensionamiento

- Elemento enfocable con `role="separator"`, `aria-orientation="vertical"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax` y `aria-controls` del dock (patrón WAI-ARIA de divisor de ventana). El divisor existente del editor usa `role="slider"`; se deja como está para no tocar sus pruebas, y se anota para unificarlo más adelante.
- **Puntero:** arrastrar cambia el ancho; el cálculo se limita a `[DOCK_MIN, anchoDelArea − TABLA_MIN]`.
- **Teclado:** ← ensancha el dock, → lo estrecha; 16 px por pulsación, Mayús 64 px; Inicio/Fin llevan al máximo/mínimo. Los pasos son valores de partida a ajustar con uso real.
- Doble clic o Intro restablece el ancho por defecto (`DOCK_MIN`).
- Mientras se arrastra, la tabla no recalcula en cada píxel de forma costosa: el ancho se aplica con `requestAnimationFrame`.
- **Valor por defecto = mínimo medido (520 px):** es el único ancho validado como suficiente; la persona puede ensancharlo.

## 5. Vista ampliada y pantallas pequeñas

| Ancho del área de trabajo `W` | Qué ocurre al abrir un panel |
|---|---|
| `W ≥ 1120` (= 520 + 600) | Se acopla a la derecha. La persona puede ampliar. |
| `W < 1120` | No hay sitio para ambos: se abre **ampliado**, con un aviso breve «Ventana estrecha: el panel ocupa toda el área. Oculta el explorador o amplía la ventana para verlo junto a la tabla.» |
| Cualquier `W` | El botón «Ampliar» del dock lo amplía; «Volver a la tabla» (o Esc) lo acopla de nuevo. |

Con el explorador por defecto, `W` mide 1125 px en una ventana de 1366 px (acoplado, justo) y 1039 px en 1280 px (ampliado); ocultar el explorador devuelve ~240 px y permite acoplar. No se oculta el explorador automáticamente (sería sorprendente).

**Vista ampliada:** el dock ocupa el área de trabajo y la tabla se reduce a una franja de ancho fijo con el botón «Tabla». La tabla **permanece montada** (no se destruye) para conservar posición de desplazamiento, selección y consulta; es un criterio de aceptación comprobar que sobreviven a ampliar y volver (si ocultar con ancho cero las perdiera, se mantiene el contenedor con `visibility: hidden`). El estado `expanded` no se persiste: el dock siempre arranca acoplado.

**Altura:** el dock ocupa toda la altura bajo la barra de herramientas. A 900 px de alto eso son unas 660 px útiles de contenido frente a las 121 px de tabla que dejaba Gráficos apilado (auditoría).

## 6. Persistencia

- **Dónde:** `localStorage`, clave `freya-workspace`, igual que `freya-sidebar` y `freya-split`. Sin operaciones nuevas en el preload ni en `main`.
- **Qué:** solo `{version, dock:{visible,width,tab}}`. Nada de datos del CSV, rutas, identificadores de documento ni resultados.
- **Lectura segura:** `try/catch`; JSON inválido, versión distinta, tipos incorrectos, pestaña desconocida o ancho fuera de rango → valores por defecto (el ancho fuera de rango se recorta al rango válido). No se copia el valor inválido (es una preferencia sin datos).
- **Escritura:** al terminar un arrastre o una pulsación, no en cada píxel.
- **Por qué no el archivo de `main` ahora (F0 §6):** F2 no guarda posiciones de ventana; el patrón con escritura atómica y copia `.invalid` aporta garantías que una preferencia de tres campos no necesita, y evitaría ampliar el preload (hoy 40 operaciones) para guardar un ancho. En F4, cuando exista la ventana secundaria, se migra: se lee `freya-workspace` una vez y se pasa al archivo de `main`.
- **Entre documentos:** el layout es global; el contenido de los paneles es por documento (como hoy).
- **Decisión pendiente de confirmar:** `visible` se restaura al reiniciar si hay un CSV activo. Alternativa: iniciar siempre cerrado y persistir solo `width` y `tab`.

## 7. Foco, teclado y mensajes

- **Abrir** desde un botón de la barra o un comando: el foco pasa a la pestaña activa del dock; el botón recuerda que lo abrió (`opener`).
- **Cerrar** (botón, Esc con el foco dentro del dock): el foco vuelve al botón de la barra que lo abrió (comportamiento actual de los paneles, que `sql.spec.ts` comprueba).
- **Orden de tabulación:** barra de herramientas → tabla → divisor → pestañas → contenido del panel.
- **Comandos:** se añaden «Ampliar panel de análisis» y «Acoplar panel de análisis» al registro de comandos existente (Cmd/Ctrl+K); no se asignan atajos nuevos en F2 para evitar colisiones con los actuales (Cmd/Ctrl+F, +K, Mayús+T…).
- **Anuncios** (`role="status"` existente): «Panel de análisis acoplado», «Panel ampliado», «Vuelves a la tabla».
- **Estados vacíos y errores:** no cambian; los gestionan los paneles. El dock solo añade el aviso de ventana estrecha (§5).

## 8. Lo que F2 no hace

Ventana desacoplada, IPC nuevo, modelo de vista en `main`, caché o reutilización de trabajos, reordenar los controles de Gráficos, atajos nuevos, divisor del editor (`slider`) unificado, arrastrar el dock a otro lado, más de un dock.

## 9. Fases de entrega y criterios de aceptación

**F2a — contenedor y pestañas (sin redimensionar ni persistir).** `AnalysisDock` acoplado a la derecha con ancho fijo de 520 px; los tres paneles dentro; la barra y los comandos abren la pestaña; política de montaje (§3.3).
1. Con cualquier panel abierto la tabla conserva **las mismas filas visibles que sin panel** a 1440×900 y 1366×768 (referencia hoy: 19 / 15 filas sin panel; 2 / 0 con Gráficos).
2. A 1366×768 la tabla muestra ≥ 3 columnas con el dock abierto (en una tabla de 14 columnas con los anchos por defecto).
3. El gráfico generado a 520 px no tiene desplazamiento horizontal y queda a la vista tras «Generar» sin intervención.
4. Pestañas: teclado completo (flechas, Inicio/Fin, activación manual), roles y nombres ARIA, y `getByRole('tab', {name})` por pestaña.
5. Cambiar de pestaña conserva la configuración del gráfico y el borrador SQL; cambiar de documento desmonta todo y cancela solicitudes (comprobable con la cola de F1: sin trabajos huérfanos).
6. Sin cambios en `src/preload`, `src/main` ni `src/shared`. Las pruebas E2E existentes pasan, con los cambios mínimos y listados que exija el nuevo orden del DOM; ninguna prueba se debilita.
7. Tiempo de «Generar gráfico» (240 filas) no peor que la base medida (852–866 ms) + 20 % (margen provisional).

**F2b — divisor y persistencia.**
1. El ancho solo se mueve dentro de `[520, W − 600]`; `aria-valuenow/min/max` correctos; teclado (16 / 64 px, Inicio/Fin, restablecer) y puntero.
2. Tras reiniciar con el mismo perfil se restauran ancho, pestaña y visibilidad; con un valor corrupto o de otra versión se usan los valores por defecto sin error visible.
3. Lo guardado contiene exactamente `version` y `dock.{visible,width,tab}` (prueba que lo comprueba).

**F2c — vista ampliada y pantallas pequeñas.**
1. «Ampliar» / «Volver a la tabla» / Esc: posición de desplazamiento, selección y filtros de la tabla intactos; foco devuelto al control correcto.
2. A `W < 1120` el panel se abre ampliado con el aviso; al ensanchar la ventana vuelve a acoplarse sin perder la pestaña ni el contenido.
3. A 900×600 (mínimo de la ventana) todos los paneles son utilizables en vista ampliada.
4. `expanded` no se persiste.

**Transversales:** `npm run check`, `npm test`, `npm run test:e2e`, `npm run build` en Node 24 y CI de los cuatro sistemas en verde; sin dependencias nuevas; evidencia con capturas antes/después en claro y oscuro (los dos temas existentes).

## 10. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | `CsvTable.svelte` es un archivo denso y central; el cambio de columna a fila toca mucho marcado y CSS | F2a mueve solo el contenedor, sin tocar la lógica; revisar los PR abiertos antes de empezar |
| R2 | Pruebas E2E que asumen el apilado o la visibilidad de paneles cerrados | Inventariar antes (`rg` de `charts-panel`, `Gráficos del CSV`, `Análisis SQL`) y cambiar lo mínimo; no debilitar aserciones |
| R3 | ECharts oculto no se redibuja al mostrarse | `CsvCharts` ya observa su contenedor con un `ResizeObserver` (`:41`) que llama a `chart.resize()`; comprobar con una prueba de gráfico tras cambiar de pestaña |
| R4 | La tabla virtualizada no recalcula columnas al cambiar su ancho | TanStack Virtual observa el tamaño del contenedor (`CsvTable.svelte:126`–`:127`, ancho estimado de columna 180 px, de ahí las 3 columnas con ~605 px); comprobarlo en F2a (criterio 2) |
| R5 | Pestañas montadas y ocultas mantienen memoria y solicitudes vivas | Máximo tres paneles; la cola de F1 serializa; se desmontan al cerrar el dock |
| R6 | Umbrales 520 / 600 derivados de una sola configuración de columnas | Anotarlos como derivados; revisar tras F2a con tablas reales |
| R7 | `localStorage` puede fallar o estar vacío | Lectura con `try/catch` y valores por defecto; la interfaz funciona sin él |
| R8 | La ventana ampliada oculta la tabla y se pierde contexto | La tabla sigue montada; franja «Tabla»; anuncio de estado |

## 11. Siguiente iteración recomendada

**F2a**, en una rama `codex/` nueva sobre `main`, con la prueba que falla primero (filas visibles con el dock, tabs por rol) y PR en borrador. #42 ya está integrado y no hay otros PR abiertos que toquen `CsvTable`. Antes conviene integrar #45 (corrige dos pruebas E2E que hoy fallan en `main` y harían roja la CI de cualquier PR) y #44 (F1): F2a no depende de F1 en código, pero los paneles del dock usan la cola, y la validación de F1 ([evidencia](../evidence/f1-validation-2026-10-23.md)) es lo que garantiza que abrir y cerrar paneles no deja trabajos huérfanos. Antes de empezar conviene regenerar el grafo (Graphify) porque el renderer cambió con #42.
