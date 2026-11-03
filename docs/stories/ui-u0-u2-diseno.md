OBJETIVO · FreyaLab · Mejora de UX/UI y «look and feel» · entregas U0, U1 y U2

Autor del diseño: Claude. Implementa Codex. Decide y fusiona el propietario.
Referencia visual (solo visual, no reutilizar su código): /private/tmp/freyalab-design-refs/freyalab-ui-kit-propuesta.html
Primer commit: cópiala SIN editar a docs/design/freyalab-ui-kit-propuesta.html y anota su SHA-256.
PRERREQUISITO: espera a que #108 (F2b) esté fusionado; U0–U2 tocan los mismos archivos (style.css, CsvTable, CsvCharts, App) y habría conflictos.

## 0. Por qué
La app funciona pero se siente plana y poco clara: casi todos los botones son iguales (solo «Exportar» destaca), las barras de carga son las nativas del sistema (pista gris + relleno verde nativo, no el azul de la app), hay placeholders repetidos o escritos en español directo en el código, y existen tres estilos de pestañas distintos. El propietario quiere que se lea y se entienda mejor, con botones «más reales» y navegación más clara. Regla: **mejorar jerarquía, tamaño, contraste y claridad antes que decoración.** Sin librerías nuevas (ADR 0021), sin cambiar la tipografía (Inter y JetBrains Mono se quedan), sin rediseñar la tabla.

## 1. Entregas (un PR en borrador cada una, base main, DETENTE entre ellas)
- **U0 Base de diseño y botones.** Tokens, escala tipográfica, botones en 5 jerarquías.
- **U1 Progreso, búsqueda, placeholders y vacíos.** Un solo componente de progreso, un solo patrón de búsqueda, barrido de placeholders (con es/en) y estados vacíos con acción.
- **U2 Navegación.** Un solo estilo de pestañas de vista, barra de herramientas con nombres, barra lateral con acción clara.
- **U3 Vidrio (macOS): NO se hace ahora.** Solo se deja aquí diseñado (§8) para que el propietario decida después.
Antes de escribir interfaz en cada entrega, publica el alcance en bloques y las siete respuestas del ADR 0021.

## 2. U0 · Base de diseño

### 2.1 Tokens (mantén los nombres existentes y AÑADE; no renombres masivamente)
Existentes: --bg --panel --canvas --border --text --muted --hover --accent --input --code. Mapa: --bg=fondo de contenido, --panel=superficie (barras laterales y paneles), --input=superficie elevada (botones/campos).
Añade (valores sugeridos y medidos por mí; si cambias alguno, mide y justifica):
| Token | Claro | Oscuro |
| --control (borde de botones y campos, ≥3:1) | #848b9a (3,42 sobre blanco; 3,19 sobre #f6f7fa) | #6b7385 (3,73 sobre #16181d) |
| --accent-strong (texto de acento sobre tinte) | #1d4ed8 (5,82 sobre #e8efff) | #86b4ff (6,49 sobre #1e2d4d) |
| --tint (fondo de acento suave) | #e8efff | #1e2d4d |
| --danger / --danger-tint | #c4301f / #fdecea (4,85) | #ff7a6b / #3a2322 (5,71) |
| --ok | #1a7f45 (5,04) | #4cc382 (7,98) |
| --track (pista de progreso) | #e3e6ed | #343944 |
| --focus | = --accent |
HALLAZGO A CORREGIR: el acento claro actual #007aff da **4,0:1** con texto blanco (botón «Exportar» y texto de acento) y no llega a 4,5:1 para texto pequeño. Propuesta: --accent claro #2563eb (5,17 con blanco). **DECIDIDO por el propietario (2026-11-02): azul nuevo #2563eb.** Impleméntalo detrás del token (un solo lugar) y señálalo en el informe. Oscuro: conserva el actual si mide ≥4,5:1 con su texto de botón (mídelo; #4c8dff con texto #0b1220 da 5,85).
Elimina los colores fijos en el CSS y sustitúyelos por tokens: #007aff15, #007aff60, #c0392b/#f97066 (error), #15803d/#4ade80 (csv), #9333ea/#c084fc (mermaid), #fff1f0/#821b19/#d6a6a2 (aviso de diagrama), #e3ad20 (resaltado). Si una de estas es semántica (tipo de archivo), cámbiala a --kind-csv, --kind-md, --kind-mermaid con su par claro/oscuro medido.

### 2.2 Escala y forma
- Tipografía de interfaz: **13 px** para controles y etiquetas (hoy 12), 12 px para celdas de la tabla y texto denso, 11 px solo para metadatos, nunca menos. Títulos: 14/16/20 px. No cambies la tipografía de las celdas ni de CodeMirror.
- Radios: 6 px (compactos), 8 px (controles), 12 px (tarjetas y diálogos). Hoy todo es 5 px.
- Espaciado: múltiplos de 4 px. Alto de control: 30 px (26 px compacto, dentro de barras de herramientas). Áreas de clic ≥24×24 px.
- Elevación en 3 niveles: reposo (sombra sutil de 1 px), flotante (menús, popovers), diálogo. Sin sombras decorativas.
- Movimiento: 120 ms para estados, 200 ms para paneles; todo respeta `prefers-reduced-motion` (sin animación, estados por color).

### 2.3 Botones (5 jerarquías)
| Variante | Uso | Aspecto |
| Primario | LA acción principal de esa superficie (máx. uno visible por vista/diálogo) | relleno --accent, texto sobre acento ≥4,5:1 |
| Secundario | acciones normales | relleno --input, borde --control, relieve sutil |
| Suave (tint) | sugerencias, acciones recomendadas no críticas | relleno --tint, texto --accent-strong |
| Fantasma | acciones terciarias y de barra | sin borde ni relleno; hover --hover |
| Peligro | quitar/descartar | texto --danger sobre --danger-tint |
Estados obligatorios en todas: reposo, hover, pulsado (1 px abajo, sin sombra), foco visible (anillo 2 px --focus, offset 2 px), deshabilitado (opacidad .45 **y motivo**: `title` + `aria-describedby`; nunca un botón apagado sin explicación), cargando (spinner 12 px + `aria-busy="true"`, el texto pasa a «Calculando…»).
Implementación mínima: cambia la regla global `button{…}` de style.css y añade clases `.btn-primary .btn-tint .btn-ghost .btn-danger .btn-icon .btn-sm`. **No crees un componente Svelte si bastan clases.** Todo botón existente hereda el nuevo aspecto secundario; luego asigna variante explícita a: Exportar (primario), Guardar (primario cuando hay cambios sin guardar, secundario si no), confirmaciones de diálogo (primario), «Cancelar» de diálogo (fantasma), «Quitar/Descartar» (peligro), botones de barra de herramientas (fantasma compacto).
Los botones solo-icono llevan `aria-label` y tooltip con nombre y atajo.

## 3. U1 · Progreso, búsqueda, placeholders y vacíos

### 3.1 Progreso (un solo aspecto)
Hoy hay 8 sitios con `<progress>` nativo (CsvRangePreview, CsvExtract, CsvSql, CsvColumnsOverview, CsvStatistics, CsvTable, CsvCharts, CsvTransform; verifica con `rg "<progress"`). Sustitúyelos por UN componente/estilo:
- Barra de 6 px, radio completo, pista --track, relleno --accent. Sin verde nativo.
- **Determinada** (`max/value`): etiqueta a la izquierda (qué se hace: «Buscando en 842 000 filas…») y porcentaje o recuento a la derecha («40 %» o «120 000 de 842 000 filas»).
- **Indeterminada:** relleno de 35 % que se desliza (1,2 s); con movimiento reducido, relleno fijo al 100 % con opacidad .5 y el texto lo dice.
- Siempre con **qué se hace** y, si se puede, **cómo cancelar** (botón fantasma «Cancelar» al lado; ya existe en casi todos).
- Conserva la semántica: `role="progressbar"` con `aria-valuenow/min/max` (o `<progress>` con estilo `appearance:none` si lo prefieres, que es más simple; elige lo más pequeño que funcione en Windows, Linux y macOS) y `aria-label` real; el cambio de estado se anuncia con `role="status"` sin repetir cada porcentaje (anuncia cada 10 %).
- Forzado de colores de Windows (`forced-colors: active`): barra visible con colores de sistema.
- Cargas cortas (<2 s esperadas: primer panel de campos, primera vista del resumen): **esqueleto** (3 barras grises animadas) en vez de pantalla en blanco.

### 3.2 Búsqueda (un patrón)
Campo de 32 px: icono de lupa a la izquierda, placeholder que dice QUÉ se busca, botón × para limpiar cuando hay texto, **recuento** a la derecha mientras hay texto («3 de 842») y el **atajo** (⌘F / Ctrl+F) cuando está vacío. Esc limpia. Sin resultados: mensaje vacío con acción («Sin resultados para «norte». Prueba con menos letras o quita los filtros.» + «Quitar filtros»). Aplica a: buscar archivo (explorador), buscar en la tabla, buscar columnas, buscar campo (F2b), buscar herramienta (acciones), buscar/reemplazar.

### 3.3 Placeholders (reglas y barrido)
Reglas: 1) describe lo que se busca o se escribe, no repite la etiqueta; 2) sin puntos suspensivos de relleno («Buscar archivo...» → «Buscar en la carpeta»); 3) ejemplo real solo si ayuda («Ej. 2026-01-31»); 4) siempre hay etiqueta accesible aparte (el placeholder no es etiqueta); 5) **todo texto pasa por i18n** (es/en/en-XA).
Barrido: `rg "placeholder="` en src/renderer. Hay unos 9, varios en español literal en el código (CsvTable «Contiene…», «Buscar en la tabla...», CsvColumnsOverview «Nombre o posición», CsvCommands «Buscar, reemplazar, filtrar, duplicar…», CsvQueryTools/CsvExtract valores de condición, App «Buscar archivo...»). Propón el texto de cada uno en una tabla del informe (antes → después → clave i18n). Textos sugeridos:
- Explorador: «Buscar en la carpeta» · Tabla: «Buscar en la tabla» · Columnas: «Buscar por nombre o número» · Acciones: «Buscar herramienta: filtrar, duplicar, reemplazar» · Filtro de columna: «Contiene…» (traducido) · Valor de condición: «Valor» / «Ej. 2026-01-31» para fechas.
Alcance: solo placeholders y las cadenas visibles de los controles que toques. Cuenta cuántas otras cadenas en español literal quedan (aria-label, title) y repórtalo como número; NO las corrijas aquí. Prueba: ningún `placeholder=` literal fuera de i18n y paridad es/en de las claves nuevas.

### 3.4 Estados vacíos con una acción
Patrón: icono en cuadro de acento suave 34 px, título en negrita, una línea que dice qué hacer, botón (primario si es la acción natural). Sustituye:
- Explorador sin carpeta («Explora tus archivos en un solo lugar.» es vago): «Aún no hay una carpeta abierta» / «Abre una carpeta para ver sus documentos aquí.» + **Abrir carpeta** (primario) y, debajo, «También puedes arrastrarla a la ventana.»
- Búsqueda sin resultados (3.2). CSV sin filas: «Este archivo no tiene filas» + «Mostrar encabezados»/«Cerrar». Panel de gráficos vacío: ya existe (F2b); alinéalo al patrón.
La pantalla de bienvenida actual está bien: no la rediseñes, solo aplica tokens.

## 4. U2 · Navegación
- **Un solo estilo de pestañas de vista** (control segmentado): Tabla | Resumen y gráfico | Texto; Editar | Dividido | Vista previa; Archivos | Índice. Seleccionada = relleno --input, texto --text, relieve; no seleccionada = --muted. Las pestañas de DOCUMENTO (ventas.csv ×) siguen siendo pestañas: añade punto de «sin guardar» y × visible al pasar/foco; ya hay scroll si no caben.
- **Barra de herramientas con nombres** (CSV): a ≥1280 px muestran icono + nombre: Buscar, Reemplazar, Filtrar, Limpiar datos, Acciones, Estadísticas y SQL; entre 900 y 1280 solo icono con tooltip; <900 px, menú «Más». Fantasma compacto de 26 px, separadores finos entre grupos. Los iconos solos sin nombre (flecha, ⌘) desaparecen. (F2b ya añadió tooltips: reutilízalos.)
- **Barra lateral:** «EXPLORADOR» con el mismo estilo de encabezado de sección que el resto; botón «+» con tooltip «Nuevo archivo en la carpeta»; el estado vacío de 3.4. Sin cambiar su comportamiento ni su ancho redimensionable.
- Barra de estado: texto en --muted 11 px, sin cambios de contenido; «Todo se procesa en este equipo» conservado.
No cambies atajos, orden de tabulación ni estructura de roles; solo aspecto y etiquetas.

## 5. Accesibilidad y calidad (obligatorio)
- Contraste de texto ≥4,5:1 y de bordes de control/iconos ≥3:1, en claro y oscuro, comprobado por una prueba que lee los tokens reales del CSS (los pares de la tabla de 2.1 más foco y el texto de los botones primario/peligro). Una prueba roja primero con el acento actual (#007aff) que demuestre los 4,0:1.
- Foco visible en todo control; orden de tabulación sin cambios; áreas ≥24 px; es/en/en-XA sin textos cortados; `prefers-reduced-motion` y `forced-colors`.
- Los E2E existentes deben pasar SIN relajar aserciones; si un texto cambia a propósito (p. ej. un placeholder), actualiza la prueba y lístalo en el informe.

## 6. Criterios de aceptación
1. Una pantalla cualquiera tiene como máximo un botón primario y se distingue a simple vista qué es principal.
2. Ninguna barra de progreso usa el estilo nativo; todas dicen qué hacen (y cancelar si aplica).
3. Ningún placeholder está en español literal en el código ni repite su etiqueta; paridad es/en.
4. Buscadores con icono, ×, recuento/atajo y mensaje de sin resultados con acción.
5. Un solo estilo de pestañas de vista; barra CSV con nombres a ≥1280 px.
6. Pares de contraste de 2.1 cumplidos y probados.
7. Sin cambios en datos, guardado, IPC, motor ni dependencias; sin red; sin librerías.
8. Capturas antes/después de: vacío, Markdown, CSV, Resumen y gráfico, un diálogo (Ajustes), carga (progreso), búsqueda sin resultados; a 1440×900 y 1280×720, claro y oscuro, y en-XA donde aplique.

## 7. Proceso
Rama por entrega (`codex/ui-u0-base`, `codex/ui-u1-progreso-busqueda`, `codex/ui-u2-navegacion`), PR en borrador base main, prueba roja primero (tokens/contraste, ausencia de `<progress>` nativo y de placeholders literales, aria/estados de los botones), informe con capturas y **lista honesta de lo no verificado** (Windows/Linux visual, lector de pantalla, Intel). Usa de verdad las skills de diseño/UX/accesibilidad/visualización, TDD y ponytail; si alguna no existe, dilo. DETENTE tras cada entrega; no fusiones; no publiques versiones. Si algo choca con el código real, dilo con evidencia, no lo resuelvas en silencio.

## 8. U3 (diseñado, NO implementar) · Vidrio opcional en macOS
Solo marco: barra lateral y barra superior; contenido (tabla, editor, gráficos, diálogos) siempre opaco. Respaldo a color sólido sin soporte, en Windows/Linux, o con «Reducir transparencia» del sistema. Vía CSS (`backdrop-filter`) o un paquete nativo como electron-liquid-glass (macOS 26+, API privada, riesgo a largo plazo): requiere decisión explícita del propietario y las siete preguntas del ADR 0021. No es prerrequisito de nada.
