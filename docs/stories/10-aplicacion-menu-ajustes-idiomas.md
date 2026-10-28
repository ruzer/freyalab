# Iteración 10 · La aplicación: menú, ajustes, idiomas y actualizaciones

Origen (el propietario, 2026-10-28): «preparemos multilengua, opciones de configuración general de la app, el menú de la app con información de la app y actualización tipo *check updates*», con la barra de menús de una aplicación de macOS como referencia (nombre de la app, Archivo, Edición, Ver, Ir, Ventana, Ayuda). Este documento diseña las cinco piezas y sus decisiones. **Es diseño: no cambia código de producción.**

| ID | Contenido | Tamaño | Depende de | Estado |
|---|---|---|---|---|
| **I18N-01** | Infraestructura de idiomas (catálogos `es` y `en`, `t()`, formato regional, cambio en caliente) y piloto con lo que crean APP-01 a APP-04 | S a M | — | **Lista** (abajo) |
| **APP-01** | Menú nativo de la aplicación (macOS, Windows y Linux) con Archivo, Edición, Ver, Ir, Ventana y Ayuda | M | I18N-01 | **Lista** (abajo) |
| **APP-02** | «Acerca de FreyaLab» con versión real, compilación, versiones de Electron/Chromium/Node, avisos de terceros y copiar información para un informe | S | I18N-01 | **Lista** (abajo) |
| **APP-03** | Ajustes (⌘,): modelo versionado, migración de lo que hoy vive en `localStorage` y ventana de ajustes | M a L | I18N-01 | **Lista** (abajo) |
| **APP-04** | Buscar actualizaciones: manual, opcional al iniciar, solo avisa y abre la página de descarga | M | APP-02, APP-03 | **Lista** (D7 confirmada el 2026-10-28) |
| I18N-02 | Migrar el resto de la interfaz de Markdown, Mermaid y el shell | L | I18N-01; carril de render/Preview cerrado | Esbozada |
| I18N-03 | Migrar la interfaz de CSV (≈ 700 cadenas) | L | I18N-01; L4a y L5a cerradas | Esbozada |
| I18N-04 | Idioma de los informes y exportaciones que la aplicación genera | M | I18N-02, I18N-03; decisión D10 | Esbozada |

Recomendación de entrega: **un bloque de integración** con I18N-01 → APP-01 → APP-02 → APP-03 (todo lo nuevo nace traducible) y, aparte, APP-04 cuando se confirme D7. La migración de cadenas existentes (I18N-02 a I18N-04) es mecánica y grande: va en etapas, sin mezclarse con las historias que hoy tocan los mismos archivos.

## 1. Lo que existe hoy (verificado)

Evidencia y método en [`docs/evidence/app-auditoria-2026-10-28.md`](../evidence/app-auditoria-2026-10-28.md), medida sobre `main` `33a5dfd` (build y paquete de directorio de macOS arm64).

| Tema | Hallazgo |
|---|---|
| Menú | El código **no define ningún menú**: se ve el de Electron por omisión, **en inglés** (File, Edit, View, Window) y con el título **«freyalab»**. «File» solo tiene «Close Window»: no hay Abrir, Guardar, Nuevo ni Exportar. **El paquete expone «Reload» y «Toggle Developer Tools» (⌥⌘I)**. No hay menú Ayuda. Los atajos de la aplicación existen solo en el renderer y el menú no los muestra. |
| Acerca de | Cuadro dentro de la aplicación con **la versión escrita a mano** («v0.1.0-alpha.1 · Licencia MIT»); `app.getVersion()` ya devuelve el valor correcto y no se usa. Sin versiones de Electron/Chromium/Node, avisos de terceros ni «copiar información». |
| Ajustes | Cinco claves de `localStorage` (tema, ancho y pestaña de la barra, visibilidad, división) y archivos en la carpeta de datos (`recents.json`, `chart-presets.json`). **Sin pantalla de ajustes.** |
| Idioma | Todo en español, escrito en el código, sin catálogo: **≈ 1.300 cadenas visibles en 51 archivos** (heurístico); **40 de 41 specs E2E localizan por texto en español** (≈ 2.000 usos). Los errores del proceso principal llegan como texto en español con el prefijo crudo de Electron. |
| Actualizaciones | No existe nada. Repositorio público; una versión publicada, `v0.1.0-alpha.1`, **pre-release** con instaladores por plataforma, `SHA256SUMS.txt` y `VERIFICATION.json`. La API `releases/latest` de GitHub **no devuelve pre-releases**. Sin firma ni notarización: la actualización automática dentro de la aplicación **no es viable** en macOS hoy. |
| Política | `AGENTS.md`: «sin telemetría ni cargas remotas». `SECURITY.md`: «sin telemetría, cuentas o servicios remotos **obligatorios**». CSP del renderer: `connect-src 'self'`. |

## 2. Decisiones por confirmar (propuestas, con mi recomendación)

| ID | Decisión | Recomendación |
|---|---|---|
| **D1** | Idiomas iniciales | **Español (base, es-MX) e inglés.** Otros después, con el mismo catálogo. Claude redacta el inglés; el propietario lo revisa. |
| **D2** | Idioma por omisión | **«Sistema»**: si el sistema está en español → español; en inglés → inglés; cualquier otro → inglés. La persona puede fijarlo en Ajustes. |
| **D3** | ¿Mostrar el selector de idioma con la traducción incompleta? | **Sí, desde I18N-02, rotulado «(parcial)»** hasta cerrar I18N-03; antes, oculto. En alfa el propietario es el principal usuario y necesita probarlo. |
| **D4** | Dónde viven los ajustes | **Un diálogo dentro de la aplicación** (⌘, / Ctrl+,) con lista de secciones a la izquierda; los cambios se aplican al instante, sin «Aceptar». No una pestaña ni una ventana aparte. |
| **D5** | Almacén de ajustes | **Un `settings.json` versionado en la carpeta de datos**, validado con zod, gestionado por el proceso principal; migración única desde `localStorage`. |
| **D6** | Herramientas de desarrollo | **Fuera del paquete por omisión:** «Reload» y «Toggle Developer Tools» solo en desarrollo o con Ajustes → Avanzado → «Mostrar herramientas de desarrollo». |
| **D7** | Política de actualizaciones | **CONFIRMADA por el propietario el 2026-10-28.** **Manual, opcional al iniciar (desactivada por omisión), solo avisa y abre la página de descarga.** Una petición HTTPS a `api.github.com` desde el proceso principal, sin telemetría ni identificadores. Exige **ajustar `AGENTS.md` y `SECURITY.md`**: «la única conexión de red de la aplicación es la comprobación de actualizaciones, que haces tú o activas tú». Instalación automática solo cuando haya firma y notarización (decisión posterior). |
| **D8** | Canal | **Seguir el de la versión instalada:** una alfa ve pre-releases; una estable, solo estables. Sin selector en la v1. |
| **D9** | Atajos nuevos | **⌘1 / ⌘2 / ⌘3 para Editar, Dividido y Vista previa**, previa comprobación de que no chocan con ninguno existente. |
| **D10** | Idioma de lo que la aplicación genera (informes de estadísticas, texto de exportaciones) | **El idioma de la interfaz en el momento de generarlo**; el contenido del documento del usuario nunca se traduce. |
| **D11** | «Informar de un problema» | **Abre la página de incidencias de GitHub** en el navegador; la aplicación no envía nada. «Copiar información del sistema» es manual y sin datos personales. |
| **D12** | Barra de menús en Windows y Linux | **Visible**, como en cualquier aplicación de escritorio de esas plataformas (no autoocultar). |

## 3. Diseño UX común

### 3.1 El menú (referencia: macOS; Windows y Linux reubican lo marcado †)

Barra: **FreyaLab · Archivo · Edición · Ver · Ir · Ventana · Ayuda**.

```text
FreyaLab                              Archivo
  Acerca de FreyaLab †                  Nuevo documento Markdown   ⌘N
  Buscar actualizaciones… †             Nuevo diagrama Mermaid     ⇧⌘N
  ─────────────────────                 Nueva tabla CSV            ⌥⌘N
  Ajustes…                   ⌘,         ─────────────────────
  ─────────────────────                 Abrir…                     ⌘O
  Servicios ▸                           Abrir carpeta…             ⇧⌘O
  ─────────────────────                 Abrir reciente ▸  (hasta 10 · Borrar lista)
  Ocultar FreyaLab           ⌘H         ─────────────────────
  Ocultar otros              ⌥⌘H        Cerrar pestaña             ⌘W
  Mostrar todo                          Guardar                    ⌘S
  ─────────────────────                 Guardar como…              ⇧⌘S
  Salir de FreyaLab          ⌘Q         Exportar ▸  (formatos del tipo de documento)
                                        † Ajustes… (Ctrl+,) y Salir (Ctrl+Q)

Edición                               Ver
  Deshacer                   ⌘Z         Modo ▸   ● Editar ⌘1   ○ Dividido ⌘2   ○ Vista previa ⌘3
  Rehacer                    ⇧⌘Z        Barra lateral              ⌘B
  ─────────────────────                 Índice del documento
  Cortar                     ⌘X         Tema ▸   ● Sistema   ○ Claro   ○ Oscuro
  Copiar                     ⌘C         ─────────────────────
  Pegar                      ⌘V         Tamaño real ⌘0 · Acercar ⌘+ · Alejar ⌘-
  Pegar sin formato          ⌥⇧⌘V       Pantalla completa          ⌃⌘F
  Seleccionar todo           ⌘A         (solo en desarrollo o con Ajustes → Avanzado:
  ─────────────────────                  Recargar · Herramientas de desarrollo)
  Buscar ▸  En el documento ⌘F · Reemplazar ⇧⌘F · Archivo en la carpeta

Ir                                    Ventana                         Ayuda
  Ir a la fila…              ⌘G         Minimizar          ⌘M           Documentación
  Pestaña siguiente          ⌃⇥         Zoom                            Atajos de teclado
  Pestaña anterior           ⌃⇧⇥        Traer todo al frente            Notas de la versión
  ─────────────────────                 ─────────────────────           Informar de un problema
  Mostrar Archivos                      (documentos abiertos, ✓ activo) ─────────────────────
  Mostrar Índice                                                        Licencias de terceros
                                                                        Política de seguridad
                                                                        † Acerca de FreyaLab · Buscar actualizaciones…
```

† Windows y Linux: «Acerca de FreyaLab» y «Buscar actualizaciones…» van al final de Ayuda; «Ajustes…» y «Salir» van en Archivo.

Reglas de contenido:

1. **No hay elementos de desarrollo en el paquete** (D6). Desaparecen «Reload», «Force Reload» y «Toggle Developer Tools»; «Servicios», «Sustituciones» y «Voz» de macOS se conservan solo donde el sistema los espera (menú de la aplicación y Edición) y con textos del sistema.
2. **Cada elemento es un comando.** Los atajos que hoy atiende el renderer (⌘O, ⇧⌘O, ⌘S, ⇧⌘S, ⌘N, ⇧⌘N, ⌥⌘N, ⌘B, ⌘W, ⌘G, ⌘K) no se duplican: el menú muestra el atajo y la acción se ejecuta **una sola vez**.
3. **Los elementos se habilitan según el contexto:** Guardar, Guardar como y Cerrar pestaña requieren un documento activo; «Exportar ▸» ofrece solo los formatos del tipo de documento; «Ir a la fila» solo en CSV; «Índice del documento» y «Modo» solo en Markdown; «Pegar sin formato» solo en un editor.
4. **Deshacer y Rehacer son los de la aplicación**, no los del sistema (CodeMirror y la tabla CSV mantienen su propio historial).
5. **Todo el texto sale del catálogo** (I18N-01) y el menú se reconstruye al cambiar de idioma, sin reiniciar.

### 3.2 Acerca de FreyaLab

```text
┌──────────────────────────────────────────┐
│               [icono]                    │
│              FreyaLab                    │
│      Documentos, tablas y diagramas.     │
│      Una herramienta local, de código abierto.
│                                          │
│   Versión 0.1.0-alpha.1 (alfa) · compilación a1b2c3d
│   Electron 44.9.2 · Chromium {x} · Node {y}
│   {sistema} · {arquitectura} · Licencia MIT │
│                                          │
│ [Buscar actualizaciones] [Notas de la versión]
│ [Licencias de terceros] [Copiar información]
│                          [Cerrar]        │
│            Para Freya. 🐾                │
└──────────────────────────────────────────┘
```

### 3.3 Ajustes (⌘,)

```text
┌ Ajustes ─────────────────────────────────────────────────────────┐
│ General            │ Idioma            [ Sistema ▾ ]  (Español · English)
│ Apariencia         │ Se aplica al instante. Español e inglés.        │
│ Archivos           │                                                 │
│ Actualizaciones    │ Tema              (●) Sistema ( ) Claro ( ) Oscuro
│ Privacidad         │ Barra lateral     [✓] Mostrar   Ancho ─●────── 240 px
│ Avanzado           │ Markdown          Vista inicial [ Dividido ▾ ]  │
│                    │                          [Restablecer esta sección]
└──────────────────────────────────────────────────────────────────┘
```

| Sección | Contenido de la v1 (solo lo que ya existe o se necesita ahora) |
|---|---|
| General | Idioma (Sistema / Español / English) |
| Apariencia | Tema; barra lateral (visible, ancho); vista inicial de Markdown |
| Archivos | «Borrar la lista de archivos recientes» |
| Actualizaciones | «Buscar actualizaciones…»; «Buscar al iniciar» (desactivado); última comprobación; versiones omitidas (APP-04) |
| Privacidad | Texto fijo: sin telemetría ni cuentas, todo se procesa en este equipo; la única conexión posible es la comprobación de actualizaciones; enlace a `SECURITY.md` |
| Avanzado | «Mostrar herramientas de desarrollo»; «Mostrar la carpeta de datos»; «Restablecer todos los ajustes» (con confirmación) |

Regla para ajustes futuros (tipo de letra, ortografía, valores por omisión de CSV…): **un ajuste es una entrada del esquema + su valor por omisión + una fila en la ventana + una prueba**. No se añaden ajustes sin comportamiento que los respalde.

### 3.4 Buscar actualizaciones

```text
 Buscando…                       Hay una versión nueva                    FreyaLab está al día
 ──────────                      ─────────────────────                    ─────────────────────
 Comprobando github.com…         FreyaLab 0.1.0-alpha.2                   Tienes la versión más reciente
 [Cancelar]                      Publicada el 29 oct 2026                 (0.1.0-alpha.1).
                                 Tienes la 0.1.0-alpha.1.                 [Cerrar]
                                 [Notas de la versión] [Descargar]
                                 [Recordármelo después] [Omitir esta versión]
                                 No se instala nada solo: «Descargar» abre la página en tu navegador.
                                 Comprueba el SHA-256 con SHA256SUMS.txt.
```

Y los errores, sin bloquear nada: «No se pudo comprobar las actualizaciones (sin conexión o servicio no disponible). [Reintentar]».

## 4. I18N-01 · Infraestructura de idiomas y piloto

**1. Historia de usuario.** Como persona que usa FreyaLab en inglés o en español, quiero elegir el idioma de la aplicación y que cambie al instante, para trabajar en el idioma que entiendo.

**2. Problema y evidencia.** §1: cadenas en el código, sin catálogo; 40 de 41 specs dependen del texto en español; los errores del proceso principal llegan como texto compuesto. Migrar todo de golpe es inviable y arriesgado; hace falta la infraestructura y un piloto con lo nuevo.

**3. Diseño.**

- **Módulo compartido** `src/shared/i18n/` (lo usan el proceso principal y el renderer; sin dependencias): catálogos `es.json` y `en.json` con claves planas por espacio de nombres (`menu.archivo.guardar`, `ajustes.idioma.titulo`), marcadores `{nombre}`, plurales con `Intl.PluralRules` (`filas.one` / `filas.other`), y funciones de formato de números, fechas y listas con `Intl` en el idioma activo.
- **Idioma activo:** ajuste `idioma` (`sistema`, `es`, `en`; D2). «Sistema» usa `app.getPreferredSystemLanguages()` en el proceso principal. El renderer lo recibe al arrancar y se actualiza en caliente (`<html lang>` incluido); el proceso principal reconstruye el menú y usa el mismo `t()` en diálogos nativos.
- **Errores del proceso principal:** se **traducen en el momento de lanzarlos**, con el idioma activo; el renderer los muestra tal cual. El prefijo crudo «Error invoking remote method…» se elimina en un único lugar (el contenedor `invoke` del preload).
- **Piloto:** solo las cadenas que **crean o reescriben** APP-01 a APP-04 y los diálogos nativos del proceso principal («Guardar / Cancelar / Descartar cambios», títulos de abrir y guardar). El resto sigue con literales y consta en una **lista de archivos pendientes** que solo puede encogerse.
- **Pruebas:** el E2E existente se ejecuta con `FREYALAB_LANG=es` (solo con `FREYALAB_TEST=1`) y no se edita; un **pseudo-idioma** (`en-XA`: acentos y +30 % de longitud entre corchetes) revela texto sin catalogar y desbordes; un conjunto pequeño de E2E en `en`.

**4. Criterios de aceptación.**
- **I1.** Existen `es.json` y `en.json` y `t(clave, parámetros)` en `src/shared/i18n/`, sin dependencias nuevas. Una clave inexistente se ve como la propia clave en desarrollo y cae al español en producción, con un registro en la consola solo en desarrollo.
- **I2.** Plurales y formatos con `Intl` (`filas.one`/`other`; números, fechas y listas en el idioma activo); ninguna concatenación de fragmentos traducibles.
- **I3.** Prueba unitaria de paridad: mismas claves en `es` y `en`, mismos marcadores en cada par, formas plurales completas.
- **I4.** Resolución del idioma: `sistema` → español en `es-*`, inglés en `en-*`, inglés en cualquier otro (D2); el ajuste explícito gana al sistema. Pruebas con cadenas de idioma simuladas.
- **I5.** Cambiar el idioma actualiza **en caliente** la interfaz (de lo migrado), `<html lang>`, el menú nativo y los diálogos nativos nuevos, sin reiniciar y sin perder el estado de los documentos.
- **I6.** Los errores nuevos del proceso principal llegan traducidos y sin prefijo crudo; los antiguos siguen igual salvo el prefijo, que se elimina en un solo punto con su prueba.
- **I7.** Pseudo-idioma `en-XA` disponible en pruebas: una captura 1440×900 del shell (barra, menú de apertura, diálogo de ajustes) sin cadenas sin corchetes entre lo migrado y sin textos cortados.
- **I8.** Lista de archivos pendientes (`allowlist`) en el repositorio y una prueba que **falla** si un archivo migrado vuelve a tener literales visibles o si un archivo nuevo aparece fuera de la lista; la lista solo puede encogerse.
- **I9.** El E2E existente pasa **sin edición** con `FREYALAB_LANG=es`; la variable se ignora fuera de `FREYALAB_TEST=1`.
- **I10.** Formato regional: los números y fechas de lo migrado salen con el idioma activo, no con el del sistema; la prueba lo demuestra con idioma distinto del sistema.
- **I11.** Ningún texto traducible en `src/main` usa el idioma del sistema directamente (`app.getLocale()`): todo pasa por el idioma activo.
- **I12.** Regla documentada (en `CONTRIBUTING.md`): **desde que esta historia esté en `main`, toda cadena nueva visible usa `t()`**, también las de L4a, L5a y demás historias en curso.
- **I13.** Capturas 1440×900 en claro y oscuro con el idioma `es` y con `en-XA` de las pantallas piloto.
- **I14.** Sin dependencias nuevas.

**5. Casos límite.** Idioma de sistema compuesto (`es-419`, `en-GB`, `pt-BR` → inglés); idioma guardado que ya no existe; clave faltante en `en`; marcador sin parámetro; plural de 0 y de 1; cambio de idioma con un diálogo nativo abierto; cadenas con HTML (no se admite HTML en catálogos: se compone en la interfaz).

**6. Prompt ejecutable para Codex.**

```text
Tarea: I18N-01 · Infraestructura de idiomas y piloto (primera historia del bloque «Aplicación»). Sin dependencias nuevas.
Lee AGENTS.md, CONTRIBUTING.md, docs/stories/10-aplicacion-menu-ajustes-idiomas.md (§1 a §4) y docs/evidence/app-auditoria-2026-10-28.md. Rama de integración codex/integracion-aplicacion desde main actualizado, worktree propio, PR en borrador con base main.
1) Reproduce primero: pruebas que fallan porque no existe src/shared/i18n/, ni catálogos, ni paridad, ni resolución de idioma, y un E2E del pseudo-idioma que muestra texto sin catalogar en una pantalla piloto.
2) Implementa I1–I14 con el menor cambio: módulo compartido, catálogos es/en, idioma activo en settings (el almacén definitivo llega con APP-03: aquí basta un ajuste en memoria con el mismo esquema), t() en el proceso principal y el renderer, cambio en caliente, errores traducidos en origen, lista de archivos pendientes con prueba de «solo encoge». No migres cadenas existentes fuera del piloto.
3) Evidencia: rojo→verde, capturas es y en-XA, casos NO probados. Si necesitas una dependencia o un cambio de contrato IPC fuera de lo previsto, detente y pregunta.
```

**7. Plan de pruebas.** Unitarias de paridad, resolución, plural y formato; E2E del cambio en caliente y del pseudo-idioma; la prueba de la lista de pendientes; regresión de que todo el E2E actual pasa sin editar.

**8. Criterios de revisión.** Paridad automatizada; sin literales nuevos; el E2E existente intacto; errores traducidos en origen; la lista de pendientes solo encoge; sin dependencias.

## 5. APP-01 · Menú de la aplicación

**1. Historia de usuario.** Como persona que usa FreyaLab, quiero un menú de la aplicación completo y en mi idioma, con sus atajos, para encontrar y ejecutar cada acción sin memorizar teclas.

**2. Problema y evidencia.** §1: menú por omisión en inglés, «File» con un solo elemento, título «freyalab», «Reload» y DevTools expuestos, atajos invisibles.

**3. Diseño UX.** El de §3.1. Implementación esperada: un único módulo del proceso principal construye el menú desde una tabla de comandos (id, clave del catálogo, atajo, contexto de habilitación, plataformas) y envía el comando al renderer por **un solo canal** con identificadores validados; el renderer ejecuta las funciones que ya existen.

**4. Criterios de aceptación.**
- **M1.** El menú se define en el proceso principal a partir de una **tabla de comandos**; el nombre de la aplicación es «FreyaLab» (no «freyalab») en el menú, «Acerca de», «Ocultar» y «Salir».
- **M2.** macOS: menú de la aplicación (Acerca de, Buscar actualizaciones…, Ajustes… ⌘,, Servicios, Ocultar, Ocultar otros, Mostrar todo, Salir). Windows y Linux: Acerca de y Buscar actualizaciones… en Ayuda; Ajustes… y Salir en Archivo.
- **M3.** Cada elemento ejecuta un comando por un único canal IPC con una lista cerrada de identificadores (esquema zod); la interfaz ejecuta la función existente. **Cada atajo se ejecuta exactamente una vez** (sin duplicar el manejador del renderer): el atajo se muestra en el menú y la acción se dispara por una sola vía; prueba por atajo.
- **M4.** Archivo: Nuevo documento Markdown, Nuevo diagrama Mermaid, Nueva tabla CSV, Abrir…, Abrir carpeta…, Abrir reciente ▸ (hasta 10 desde `recents.json` + «Borrar lista»), Cerrar pestaña, Guardar, Guardar como…, Exportar ▸ con los formatos del tipo de documento activo.
- **M5.** Edición: Deshacer y Rehacer **sin rol del sistema**, con el comportamiento de la aplicación en cada contexto (editor de Markdown, editor de Mermaid, campos de texto, rejilla y editor de celda de CSV, editor SQL); Cortar, Copiar, Pegar y Seleccionar todo equivalen a sus atajos en cada contexto (la copia de la rejilla CSV usa la copia de la tabla); Pegar sin formato en los editores; Buscar ▸ (en el documento, reemplazar, archivo en la carpeta). Prueba por contexto.
- **M6.** Ver: Modo ▸ (Editar, Dividido, Vista previa) con el modo actual marcado y ⌘1/⌘2/⌘3 **si no chocan** (D9; prueba de ausencia de conflictos), Barra lateral ⌘B, Índice del documento, Tema ▸ (Sistema, Claro, Oscuro, con el actual marcado), Tamaño real, Acercar, Alejar y Pantalla completa. **Sin «Reload», «Force Reload» ni «Toggle Developer Tools»** en el paquete (D6); sí en desarrollo o con Ajustes → Avanzado.
- **M7.** Ir: Ir a la fila… (⌘G, solo CSV), Pestaña siguiente y anterior, Mostrar Archivos, Mostrar Índice.
- **M8.** Ventana: Minimizar, Zoom, Traer todo al frente y la lista de documentos abiertos (el activo marcado; elegir uno lo activa).
- **M9.** Ayuda: Documentación, Atajos de teclado (diálogo de la aplicación generado desde la **misma tabla de comandos**), Notas de la versión (página de la versión actual en GitHub), Informar de un problema (incidencias de GitHub; no se envía nada, D11), Licencias de terceros, Política de seguridad. Los enlaces externos usan el mecanismo `link` existente (solo `https`).
- **M10.** **Estado por contexto:** Guardar, Guardar como y Cerrar pestaña deshabilitados sin documento activo; Exportar solo con los formatos del tipo; Ir a la fila solo en CSV; Índice y Modo solo en Markdown; el estado se actualiza al cambiar de pestaña o de modo (comprobable leyendo `enabled` de cada elemento).
- **M11.** El idioma cambia en caliente: el menú se reconstruye sin reiniciar (I5).
- **M12.** Prueba E2E que vuelca el árbol del menú (`Menu.getApplicationMenu()` desde `app.evaluate`: etiquetas, atajos, estado) y ejecuta cada elemento con `click()` comprobando la misma acción que el atajo.
- **M13.** Evidencia: volcado del menú en `es` y `en`, y capturas del menú hechas con el sistema (las pruebas de Playwright no ven la barra de menús de macOS; se declara cuáles se hicieron a mano).
- **M14.** Windows y Linux: barra de menús visible (D12), «Salir» con Ctrl+Q; sin comprobación manual en esas plataformas **se declara**.

**5. Casos límite.** Sin ventana (macOS mantiene el menú con lo que se pueda hacer: Nuevo, Abrir); documento de solo lectura (Guardar deshabilitado); abrir reciente cuyo archivo ya no existe (aviso y se quita); cambio de idioma con el menú abierto; varias ventanas (hoy hay una); archivo recién eliminado.

**6. Prompt ejecutable para Codex.**

```text
Tarea: APP-01 · Menú de la aplicación (segunda historia del bloque «Aplicación»). Sin dependencias nuevas.
Lee docs/stories/10-aplicacion-menu-ajustes-idiomas.md (§3.1 y §5). Parte de la rama codex/integracion-aplicacion con I18N-01 verde.
1) Reproduce primero: pruebas que fallan porque el menú actual es el de Electron (volcado con app.evaluate: «File» con un solo elemento, «Toggle Developer Tools» presente, nombre «freyalab»).
2) Implementa M1–M14: tabla de comandos en el proceso principal, un canal IPC con lista cerrada, atajos que se disparan una sola vez, deshacer/rehacer y copiar/pegar con el comportamiento de la aplicación, estado por contexto, Abrir reciente, Ayuda, menú que se reconstruye al cambiar de idioma. No cambies las funciones que ejecutan los comandos.
3) Evidencia: volcado es/en, tabla comando ↔ atajo ↔ elemento ↔ botón, rojo→verde, casos NO probados (Windows y Linux a mano). Si algo exige una dependencia o un atajo nuevo que choque, detente y pregunta.
```

**7. Plan de pruebas.** Volcado y clic de cada elemento; prueba de ejecución única por atajo; un contexto por prueba para Edición; estado por contexto; Abrir reciente con archivo ausente; menú en `en` y `en-XA`.

**8. Criterios de revisión.** Ningún atajo se ejecuta dos veces; Deshacer/Rehacer no usan el rol del sistema; sin elementos de desarrollo en el paquete; todo el texto del catálogo; tabla de comandos como única fuente de menú y de «Atajos de teclado».

## 6. APP-02 · Acerca de FreyaLab

**1. Historia de usuario.** Como persona que usa o prueba FreyaLab, quiero ver con exactitud qué versión tengo y poder copiar esa información, para informar un problema o saber si estoy al día.

**2. Problema y evidencia.** §1: versión escrita a mano; sin versiones del motor, avisos de terceros ni «copiar información».

**3. Diseño UX.** El de §3.2. Un cuadro de la aplicación (igual en las tres plataformas), abierto desde el menú, desde el pie de la barra lateral y desde la pantalla de bienvenida. Valores calculados, nunca escritos a mano.

**4. Criterios de aceptación.**
- **A1.** La versión sale de `app.getVersion()` y el canal («alfa», «beta», «estable») de su sufijo; no queda ninguna versión escrita a mano en la interfaz (prueba que busca la cadena `0.1.0` fuera de `package.json` y de las pruebas).
- **A2.** La compilación muestra un identificador corto (el commit) inyectado al construir; «desarrollo» si no existe. Sin dependencias nuevas.
- **A3.** Se muestran Electron, Chromium, Node, sistema operativo y arquitectura (de `process.versions` y la plataforma).
- **A4.** «Copiar información» pone en el portapapeles un texto con versión, compilación, canal, Electron/Chromium/Node, sistema, arquitectura e idioma activo. **No incluye** rutas, nombre de usuario, nombres de documentos ni contenido; la prueba lo comprueba con un perfil con rutas reconocibles.
- **A5.** «Licencias de terceros» muestra el `THIRD_PARTY_NOTICES.txt` incluido en el paquete (comprobado con la aplicación empaquetada); «Notas de la versión» y «Código fuente» abren GitHub por el mecanismo `link` existente.
- **A6.** «Buscar actualizaciones» abre el flujo de APP-04 (hasta entonces, deshabilitado y lo dice).
- **A7.** Foco atrapado en el cuadro, Esc lo cierra, el foco vuelve al origen; lector de pantalla: título y contenido anunciados; claro y oscuro con contraste correcto.
- **A8.** Textos del catálogo `es` y `en`; capturas 1440×900 en claro y oscuro, en los dos idiomas.

**5. Casos límite.** Versión con sufijo (`-alpha.1`); compilación sin commit; portapapeles sin permiso (mensaje claro); ventana pequeña (720 px).

**6. Prompt ejecutable para Codex.**

```text
Tarea: APP-02 · Acerca de FreyaLab (tercera historia del bloque «Aplicación»). Sin dependencias nuevas.
Lee docs/stories/10-aplicacion-menu-ajustes-idiomas.md (§3.2 y §6). Rama codex/integracion-aplicacion, con APP-01 verde.
1) Reproduce primero: prueba que falla porque la versión está escrita a mano en App.svelte (comprueba que cambiar package.json no cambia lo mostrado) y E2E de «Copiar información» inexistente.
2) Implementa A1–A8: versión y compilación calculadas, versiones de Electron/Chromium/Node, copiar información sin datos personales, avisos de terceros desde el paquete.
3) Evidencia: rojo→verde, capturas es/en claro/oscuro, casos NO probados. Detente si necesitas una dependencia.
```

**7. Plan de pruebas.** Unitaria del formateo de información; E2E del cuadro, del portapapeles y de que no hay datos personales; prueba con la aplicación empaquetada para los avisos de terceros.

**8. Criterios de revisión.** Ningún valor escrito a mano; información copiada sin datos personales; avisos de terceros desde el paquete.

## 7. APP-03 · Ajustes

**1. Historia de usuario.** Como persona que usa FreyaLab a diario, quiero una ventana de ajustes donde cambiar el idioma, el tema y otras opciones generales, y que mis preferencias se conserven, para que la aplicación se adapte a mí.

**2. Problema y evidencia.** §3 y §1: cinco claves en `localStorage` que el proceso principal no ve, sin pantalla de ajustes, tema en un selector del pie.

**3. Diseño.**

- **Modelo (D5):** `settings.json` en la carpeta de datos, versionado (`version: 1`), con esquema zod estricto, **propiedad del proceso principal** (`settings:get`, `settings:set(parche)`, evento de cambio), escritura atómica con la utilidad existente. Contenido inicial: `idioma`, `tema`, `barraLateral {visible, ancho, pestana}`, `markdown {modoInicial}`, `actualizaciones {buscarAlIniciar, ultimaComprobacion, versionesOmitidas}`, `avanzado {herramientasDeDesarrollo}`; más los valores de `freya-split`.
- **Migración única** de las cinco claves de `localStorage` (el renderer las envía una vez y las borra); un valor inválido se descarta con su valor por omisión.
- **Archivo dañado o de una versión más nueva:** si no se puede leer, se guarda una copia `settings.json.bak`, se usan los valores por omisión y se avisa; si su `version` es mayor que la soportada, se usa **solo lectura** con aviso y no se sobrescribe.
- **Ventana (D4):** el diálogo de §3.3 (⌘, / Ctrl+,), con las secciones de la tabla de §3.3, cambios inmediatos, «Restablecer esta sección», y en Avanzado «Restablecer todos los ajustes» con confirmación. El selector de tema del pie de la barra se mantiene y se sincroniza.

**4. Criterios de aceptación.**
- **S1.** Existe `settings.json` con esquema zod estricto y valores por omisión documentados en una sola tabla; el proceso principal es la única fuente de verdad.
- **S2.** Cambios validados: un valor fuera de rango o de tipo se rechaza con mensaje claro y no se escribe.
- **S3.** Escritura atómica; un fallo de escritura no corrompe el archivo anterior (prueba con fallo simulado).
- **S4.** Migración única de las cinco claves, con valores inválidos descartados; tras migrar, las claves de `localStorage` se borran y no se vuelven a leer. Prueba con perfil previo.
- **S5.** Archivo ilegible: copia `.bak`, valores por omisión y aviso. Archivo con versión mayor: solo lectura, aviso, sin sobrescribir.
- **S6.** ⌘, / Ctrl+, y «Ajustes…» abren el diálogo; Esc lo cierra y devuelve el foco; navegación por teclado entre secciones y controles.
- **S7.** Idioma: Sistema / Español / English; cambia al instante (I5) y se conserva tras reiniciar. El aviso «(parcial)» según D3.
- **S8.** Tema, barra lateral (visible y ancho entre 180 y 420) y vista inicial de Markdown se aplican al instante y se conservan tras reiniciar; el selector de tema del pie sigue funcionando y queda sincronizado.
- **S9.** Archivos: «Borrar la lista de archivos recientes» vacía `recents.json` y el menú; con confirmación o con deshacer visible.
- **S10.** Avanzado: «Mostrar herramientas de desarrollo» añade al menú Ver las de desarrollo (D6) y se conserva; «Mostrar la carpeta de datos» la abre en el sistema; «Restablecer todos los ajustes» pide confirmación y restaura los valores por omisión sin tocar documentos, archivos recientes ni configuraciones de gráficos.
- **S11.** Privacidad: el texto fijo de §3.3 en el idioma activo, con el enlace a `SECURITY.md`.
- **S12.** Actualizaciones: la sección existe con sus controles deshabilitados y rotulados hasta APP-04.
- **S13.** Los ajustes **no contienen** rutas de documentos, nombres de usuario ni contenido; la prueba revisa el JSON escrito.
- **S14.** Regla de ajustes futuros documentada en `CONTRIBUTING.md` (esquema + valor por omisión + fila + prueba).
- **S15.** Accesibilidad: etiquetas, foco atrapado, anuncio de los cambios, contraste en claro y oscuro; ventana de 720 px sin desbordes.
- **S16.** Capturas 1440×900 y 720×600, claro y oscuro, en `es` y `en`, de cada sección; casos NO probados declarados.

**5. Casos límite.** Dos copias de la aplicación a la vez (última escritura gana, sin corrupción); disco lleno; carpeta de datos de solo lectura; `localStorage` vacío o bloqueado; ancho guardado fuera de rango; idioma guardado que ya no existe.

**6. Prompt ejecutable para Codex.**

```text
Tarea: APP-03 · Ajustes (cuarta historia del bloque «Aplicación»). Sin dependencias nuevas.
Lee docs/stories/10-aplicacion-menu-ajustes-idiomas.md (§3.3 y §7) y las decisiones D4, D5, D6 y D12. Rama codex/integracion-aplicacion, con APP-02 verde.
1) Reproduce primero: pruebas que fallan porque no existe settings.json, la migración ni el diálogo (E2E de ⌘, sin efecto).
2) Implementa S1–S16: modelo y almacén en el proceso principal, migración única, diálogo, secciones de la v1, integración con idioma, tema, barra lateral, Markdown, archivos recientes y herramientas de desarrollo. No añadas ajustes sin comportamiento que los respalde.
3) Al cierre del bloque: check, npm test completo, test:e2e completo y build; CI de las 4 plataformas y el paquete. Evidencia: rojo→verde, capturas, casos NO probados.
```

**7. Plan de pruebas.** Unitarias del esquema, la migración, el archivo dañado y de versión mayor; E2E de cada sección, de persistencia tras reiniciar, del restablecer y de la sincronía con el selector de tema; prueba de que el JSON no contiene datos personales.

**8. Criterios de revisión.** Una sola fuente de verdad; migración probada con un perfil previo; ningún ajuste sin comportamiento; sin datos personales; el archivo de una versión más nueva nunca se sobrescribe.

## 8. APP-04 · Buscar actualizaciones

**1. Historia de usuario.** Como persona que usa una versión alfa, quiero saber cuándo hay una versión nueva y llegar a su descarga, sin que la aplicación se conecte a Internet si yo no lo pido.

**2. Problema y evidencia.** §1: no existe ningún mecanismo; hay una versión publicada (pre-release) con instaladores y sumas SHA-256; sin firma ni notarización, la instalación automática no es viable; la política actual dice «sin cargas remotas» (decisión D7).

**3. Diseño.** El de §3.4 y D7/D8.

- **Qué hace:** una sola petición HTTPS `GET` a `https://api.github.com/repos/ruzer/freyalab/releases?per_page=10` desde el **proceso principal** (la CSP del renderer no cambia), con `Accept: application/vnd.github+json` y `User-Agent: FreyaLab/<versión>`, **sin cookies, sin credenciales, sin cuerpo, sin identificadores**, con tiempo máximo de 10 s y respuesta de hasta 1 MiB. Se valida con zod solo lo necesario: `tag_name`, `name`, `draft`, `prerelease`, `published_at`, `html_url`, `assets[].name`.
- **Qué decide:** ignora borradores; el canal sigue al de la versión instalada (D8); compara versiones con una comparación propia de `MAJOR.MINOR.PATCH[-prerelease]` (`0.1.0-alpha.1 < 0.1.0-alpha.2 < 0.1.0-beta.1 < 0.1.0`) sin dependencias.
- **Qué muestra y qué no hace:** diálogo de §3.4. «Descargar» abre la **página de la versión** en el navegador (solo si empieza por `https://github.com/ruzer/freyalab/releases/`); la aplicación **no descarga ni instala nada**. Recuerda comprobar el SHA-256 con `SHA256SUMS.txt`.
- **Comprobación automática (opcional):** «Buscar al iniciar», **desactivada por omisión**; si se activa, como máximo una vez cada 24 h, en silencio si no hay novedades y con un aviso discreto si las hay («Ver», «Recordármelo después», «Omitir esta versión»). Los fallos en automático son silenciosos.
- **Fuera de la v1:** descarga e instalación dentro de la aplicación, actualización automática (exige firma y notarización), actualizaciones delta, notas de la versión dentro de la aplicación, telemetría de cualquier tipo, un servidor propio.
- **Política (D7, confirmada el 2026-10-28):** `AGENTS.md` y `SECURITY.md` se ajustan con el texto de U14, en el PR que implemente esta historia.

**4. Criterios de aceptación.**
- **U1.** «Buscar actualizaciones…» (menú, Ajustes, Acerca de) abre el diálogo con estados «Buscando…», «Hay una versión nueva», «Estás al día» y «No se pudo comprobar», con «Cancelar» durante la búsqueda.
- **U2.** **Sin red por omisión:** con la configuración inicial, durante un arranque y una sesión de prueba **no se produce ninguna petición de red** (prueba contra un servidor local de pruebas que cuenta las peticiones: cero).
- **U3.** La petición solo sale del proceso principal; al host `api.github.com`; con los encabezados de §3; sin cookies ni credenciales; con tiempo máximo y límite de tamaño. Pruebas contra un servidor local de pruebas (variable solo con `FREYALAB_TEST=1`, que el producto ignora).
- **U4.** Respuesta validada con zod; una respuesta inválida, demasiado grande, con redirección a otro host o con tiempo agotado se trata como «No se pudo comprobar» sin excepciones visibles.
- **U5.** Comparación de versiones propia, con pruebas de los casos de §3 y de `-alpha.10` frente a `-alpha.2` (numérico, no textual).
- **U6.** Canal (D8): una alfa instalada considera pre-releases; una estable, solo estables; ignora borradores. Prueba con respuestas simuladas.
- **U7.** «Descargar» y «Notas de la versión» abren solo URL `https://github.com/ruzer/freyalab/releases/…`; cualquier otra URL de la respuesta se rechaza.
- **U8.** La aplicación **no descarga, no ejecuta ni instala** nada; la prueba confirma que no se escribe ningún archivo fuera de `settings.json`.
- **U9.** Sin conexión, límite de peticiones (403/429), servicio caído y respuesta lenta muestran un mensaje claro y «Reintentar»; nunca bloquean la aplicación.
- **U10.** «Buscar al iniciar» (desactivada) hace como máximo una comprobación cada 24 h con `ultimaComprobacion` en los ajustes; en automático, solo avisa si hay novedades; «Omitir esta versión» y «Recordármelo después» se respetan y se conservan.
- **U11.** El aviso automático no roba el foco ni interrumpe la edición.
- **U12.** Los ajustes de actualizaciones (§3.3) quedan activos; la sección muestra la última comprobación y las versiones omitidas, con «Olvidar omitidas».
- **U13.** Los textos están en el catálogo `es` y `en`, con fechas en el idioma activo.
- **U14.** `AGENTS.md` y `SECURITY.md` se actualizan **en el mismo PR que implementa APP-04** (no antes), con este texto aprobado el 2026-10-28:
  - `AGENTS.md` (línea de recursos locales), tras «sin telemetría ni cargas remotas»: «Única excepción: la comprobación de actualizaciones (APP-04), una petición HTTPS a `api.github.com` desde el proceso principal que la persona hace o activa en Ajustes; sin identificadores, sin descarga ni instalación automática.»
  - `SECURITY.md`, nuevo punto bajo el de «sin telemetría, cuentas o servicios remotos obligatorios»: «La única conexión de red de la aplicación es la comprobación de actualizaciones: una petición HTTPS `GET` a `api.github.com` desde el proceso principal, que la persona inicia o activa en Ajustes (desactivada por omisión). No envía identificadores ni datos de documentos, no descarga ni instala nada, y el renderer sigue sin acceso a la red (`connect-src 'self'`).»
- **U15.** Accesibilidad: el diálogo anuncia cada estado, foco atrapado, Esc cancela, contraste en claro y oscuro.
- **U16.** Capturas 1440×900 en claro y oscuro de los cuatro estados; casos NO probados declarados (red real, Windows y Linux).

**5. Casos límite.** Reloj del sistema mal; la versión instalada es mayor que la publicada (desarrollo); dos pre-releases; una versión publicada sin los instaladores de mi plataforma; etiqueta con formato inesperado (se ignora); proxy corporativo; la petición tarda justo 10 s; el usuario cambia el idioma durante la comprobación.

**6. Prompt ejecutable para Codex.**

```text
Tarea: APP-04 · Buscar actualizaciones. Sin dependencias nuevas. D7 fue confirmada por el propietario el 2026-10-28: aplica el texto aprobado de U14 a AGENTS.md y SECURITY.md en este mismo PR y cítalo en la descripción.
Lee docs/stories/10-aplicacion-menu-ajustes-idiomas.md (§3.4 y §8) y SECURITY.md. Rama nueva codex/aplicacion-actualizaciones desde main (con el bloque «Aplicación» ya en main) o desde la rama de integración si aún no se fusionó, con PR en borrador y base main.
1) Reproduce primero: pruebas que fallan porque no existe el servicio, y la prueba U2 (cero peticiones por omisión) con un servidor local que cuenta peticiones.
2) Implementa U1–U16: servicio en el proceso principal, comparación de versiones, canal, validación zod, diálogo, aviso opcional, ajustes, textos es/en. No descargues ni instales nada.
3) Evidencia: rojo→verde, tabla de pruebas por criterio, capturas, casos NO probados. Detente si necesitas una dependencia, si hay que tocar la CSP o si hay que tocar el empaquetado.
```

**7. Plan de pruebas.** Unitarias de comparación de versiones, canal y validación; integración contra un servidor local (respuestas válidas, inválidas, lentas, 403, redirecciones, grandes); E2E del diálogo y del aviso; la prueba de cero peticiones por omisión; verificación de que la CSP no cambió.

**8. Criterios de revisión.** Cero tráfico por omisión demostrado; solo `api.github.com` y solo desde el proceso principal; sin identificadores; nada se descarga ni se instala; URL abiertas restringidas; política actualizada con la confirmación del propietario.

## 9. Esbozadas

- **I18N-02 · Shell, Markdown y Mermaid (L).** Migrar al catálogo el resto de la interfaz del shell y de los editores de Markdown y Mermaid (`App.svelte` ≈ 82 cadenas, barra de formato, `Preview`, `Editor`, `Diagram`, errores de `documents.ts` y `export.ts`), por componentes, con la lista de pendientes encogiendo en cada PR. Espera a que el carril de render y `Preview` esté cerrado y a I18N-01. Cada componente: cadenas → claves → inglés → capturas `en` y `en-XA`.
- **I18N-03 · CSV (L, ≈ 700 cadenas).** `CsvTable` 180, `CsvCharts` 127, `table-engine` 120, `CsvTransform` 65, `CsvSql` 62, `CsvColumnAnalysis` 54, `CsvColumnsOverview` 48, `statistics-report` 53, `charts.ts` 43. Un PR por grupo de componentes. **Espera a L4a y L5a** (tocan `CsvTable` y el motor); cuando I18N-01 esté en `main`, esas historias ya usan `t()` en lo nuevo (I12).
- **I18N-04 · Informes y exportaciones generados (M).** El informe de estadísticas, el texto de las vistas previas de extracción y de las exportaciones siguen el idioma activo en el momento de generarlos (D10); nunca se traduce el contenido del usuario; el encabezado de un informe dice en qué idioma se generó.
- **Después, a pedido:** más idiomas (portugués, francés…), directorio de traducciones para colaboradores, actualización dentro de la aplicación (cuando haya firma y notarización), ajustes de tipo de letra, ortografía (FL-MD-006) y valores por omisión de CSV.

## 10. Qué no se ha comprobado

- Windows y Linux (menú, atajos, ubicación de Ajustes y Acerca de, paquete); el DMG instalado; qué hace hoy el «Undo» nativo con cada editor.
- La cifra de ≈ 1.300 cadenas es heurística; la del número de pruebas que dependen del texto, un recuento de patrones.
- No se probó una petición real a `api.github.com` desde la aplicación; el diseño de APP-04 se basa en la API pública y en que `releases/latest` no devuelve pre-releases (hoy solo existe una).
- No se evaluó el coste real de traducir `CsvTable` y el motor, ni la calidad de un inglés redactado por Claude sin revisión del propietario.
