# Auditoría del menú, ajustes, idioma y actualizaciones de la aplicación

2026-10-28 · medido por Claude sobre `main` `33a5dfd` para orientar [`docs/stories/10-aplicacion-menu-ajustes-idiomas.md`](../stories/10-aplicacion-menu-ajustes-idiomas.md). macOS arm64, Node del sistema; build limpio (`npm ci`, `npm run build`) y **paquete de directorio** (`npx electron-builder --dir`, sin firma). No se modificó ninguna fuente de la aplicación.

## 1. Menú nativo

Se lanzó la aplicación (en desarrollo y empaquetada) con Playwright y se leyó `Menu.getApplicationMenu()` con `app.evaluate`. **El código no define ningún menú** (`rg "Menu\.|setApplicationMenu|buildFromTemplate" src` sin resultados), así que se ve el menú por omisión de Electron:

```text
app: FreyaLab 0.1.0-alpha.1 · locale=es-419 sysLocale=es-MX · empaquetada=true
freyalab [appmenu]                    <- el título del menú es «freyalab», no «FreyaLab»
  About freyalab · Services · Hide freyalab ⌘H · Hide Others ⌥⌘H · Show All · Quit freyalab ⌘Q
File [filemenu]
  Close Window ⌘W                     <- único elemento: no hay Abrir, Guardar, Nuevo ni Exportar
Edit [editmenu]
  Undo ⌘Z · Redo ⇧⌘Z · Cut · Copy · Paste · Paste and Match Style ⌥⇧⌘V · Delete · Select All
  Substitutions ▸ (Smart Quotes, Smart Dashes, Text Replacement) · Speech ▸
View [viewmenu]
  Reload ⌘R · Force Reload ⇧⌘R · Toggle Developer Tools ⌥⌘I
  Actual Size ⌘0 · Zoom In ⌘+ · Zoom Out ⌘- · Toggle Full Screen ⌃⌘F
Window [windowmenu]
  Minimize ⌘M · Zoom · Bring All to Front
(sin menú Ayuda)
```

Consecuencias comprobadas o directas:

- **Todo en inglés**, con la interfaz en español. El menú por omisión no se traduce.
- **El paquete expone «Reload» y «Toggle Developer Tools»** (⌥⌘I) a cualquier persona usuaria. Se comprobó en el paquete de directorio de macOS arm64; no se comprobó en el DMG, Windows ni Linux.
- Los atajos de la aplicación (⌘O, ⇧⌘O, ⌘S, ⇧⌘S, ⌘N, ⇧⌘N, ⌥⌘N, ⌘B, ⌘W, ⌘G, ⌘K) existen **solo en el renderer** (`src/renderer/App.svelte`, `CsvTable.svelte`); el menú no los muestra ni los ofrece con el ratón.
- Hay un «Undo/Redo» nativo por rol que no pasa por el deshacer propio de la aplicación (CodeMirror y la tabla CSV mantienen su historial); no se probó qué hace con el foco en cada editor.
- No hay «Acerca de» nativo propio ni «Ajustes…» ni «Buscar actualizaciones…».

## 2. Acerca de

Existe un cuadro en la aplicación (`src/renderer/App.svelte:215`) con el icono, el lema, **«v0.1.0-alpha.1 · Licencia MIT» escrito a mano** y un botón «Cerrar». `app.getVersion()` del paquete devuelve `0.1.0-alpha.1`, pero la interfaz no lo consulta. Se abre desde el pie de la barra lateral («FreyaLab alfa») y desde la pantalla de bienvenida. No muestra versiones de Electron/Chromium/Node, avisos de terceros ni forma de copiar los datos para un informe de error.

## 3. Preferencias

Cinco claves de `localStorage` (`freya-sidebar`, `freya-sidebar-tab`, `freya-sidebar-width`, `freya-split`, `freya-theme`) más archivos en la carpeta de datos (`recents.json`, `chart-presets.json`). **No hay pantalla de ajustes**; el tema se cambia con un selector en el pie de la barra lateral. Lo que vive en `localStorage` no lo ve el proceso principal.

## 4. Idioma

- **Todo el texto visible está en español**, escrito en el código (sin catálogo): `<html lang="es">`, sin biblioteca de internacionalización.
- Estimación heurística (script de 40 líneas: texto de plantillas, `aria-label`/`title`/`placeholder`/`alt` y literales con acentos o palabras españolas): **≈ 1.300 cadenas visibles en 51 archivos** (renderer 945: 218 de plantilla, 129 de atributos, 598 literales; proceso principal 285; compartido 81). Los mayores: `CsvTable.svelte` 180, `CsvCharts.svelte` 127, `table-engine.ts` 120, `App.svelte` 82, `CsvTransform.svelte` 65, `CsvSql.svelte` 62. Es un orden de magnitud: subestima los mensajes compuestos y sobrestima algún literal que no se muestra.
- **Pruebas:** 40 de 41 specs E2E localizan elementos por su texto en español (≈ 2.000 usos de `name:`, `getByLabel`, `getByText`, `toContainText`, `toHaveText`).
- Los mensajes de error del proceso principal llegan al usuario como texto ya compuesto en español (con el prefijo crudo `Error invoking remote method…` que añade Electron).
- Formato regional: 37 usos de `Intl`/`toLocaleString`/`localeCompare`, con y sin configuración regional explícita; con el sistema en es-MX, `72000` se ve «72,000».
- Los informes que la aplicación **genera** (informe de estadísticas, vista previa de extracción, texto de exportaciones) también están en español dentro del código.

## 5. Actualizaciones

- **No existe** ningún mecanismo ni dependencia de actualización (`autoUpdater`, `electron-updater`: sin resultados).
- Repositorio **público**. Una versión publicada: `v0.1.0-alpha.1`, **pre-release** del 2026-10-21, con instaladores para macOS arm64 y x64 (DMG), Windows (EXE), Linux (AppImage y DEB) y los archivos `SHA256SUMS.txt`, `VERIFICATION.json` y `RELEASE-EVIDENCE.md`. La API `releases/latest` de GitHub **no devuelve pre-releases**: hoy no habría «última versión» por esa vía.
- Empaquetado **sin firma** (`mac.identity: null`) y sin notarización (`docs/DISTRIBUTION.md`): una actualización automática dentro de la aplicación (Squirrel/electron-updater) no es viable en macOS sin firmar.
- Política: `AGENTS.md` dice «sin telemetría ni cargas remotas»; `SECURITY.md`, «sin telemetría, cuentas o servicios remotos obligatorios». La CSP del renderer es `connect-src 'self'`.

## 6. Qué no se comprobó

Windows y Linux (menú, convenciones, paquete); el DMG instalado; qué hace el «Undo» nativo con cada editor; la cadena de formato regional en otros idiomas del sistema; la cifra de cadenas es heurística. Sin ejecución de pruebas del repositorio en esta auditoría.
