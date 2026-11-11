# AN-1b · Análisis a petición y retirada del panel lateral

Código final de las correcciones: `d2109ba14adc2314f911d3d5da982b97f34ea227`, rama local `codex/alpha4-an-1b`. Base restaurada de alpha.4: `fb2c73c493842b1985647b63f6b6d4114471f910`. Se incorporaron por merge la versión alpha.4 preparada en `10c70399` y el main `238b3874`, antes de congelar el código y construirlo.

La historia se conserva sin editar respecto de la fuente autorizada (SHA-256 `c38bf3d0f1b2983924ec328d1de5ef54ae31aa433650d3857cb3c960a2825d75`). El [alcance y las siete respuestas del ADR 0021](../../stories/an-1b-alcance-adr-0021.md) se registraron antes de escribir la interfaz. Se aplicaron las guías disponibles de cambio mínimo, TDD, accesibilidad y E2E; no se encontró una skill específica de Svelte. No se añade ninguna dependencia, motor, capacidad de red ni canal IPC.

Sesión de validación del 10 al 11 de noviembre de 2026. La suite integral se ejecutó una sola vez sobre el código congelado `26a5e1bc5bb24646941a15d4c59bef7f99430685`; sus fallos se corrigieron después y se repitieron únicamente los recorridos afectados.

## Resultado

El CSV conserva Tabla y Texto. «Analizar» y los comandos existentes abren una pestaña única del CSV, en la sección y alcance pedidos. Se reutilizan los cinco componentes existentes; desaparecen AnalysisDock, su divisor, ancho y estado persistente, los comandos Ampliar/Acoplar y «Resumen y gráfico». Información, Estadísticas y SQL esperan una acción; Gráficos prepara campos pero espera Crear antes de dibujar. La exportación de resultados continúa en su cabecera.

Desde Texto con cambios, botón, paleta y pestaña ya abierta pasan por el mismo diálogo de Guardar/Descartar/Cancelar. Cancelar no crea análisis ni pierde el texto. La paleta nativa se habilita en CSV Texto, con el mismo acelerador; las operaciones exclusivas de Tabla conservan sus bloqueos. Se conserva el resto del contrato AN-1a: foco, cancelación, revisión, filtros, rangos, configuraciones, grandes y exportaciones.

La paginación mantiene válido el análisis solo si revisión y clave semántica de consulta coinciden; búsqueda, filtros, orden, alcance, metadatos desconocidos o error lo invalidan. La vista general se invalida por una firma primitiva de esos datos, evitando cancelar por la identidad de una prop durante el scroll del mismo snapshot. La carrera real de 10.000 filas queda en la suite, con la cuadrícula visible mientras calcula.

Se corrige además la clasificación demostrada de fuentes protegidas/cerradas: solo lectura controla escritura; no significa muestra. Los componentes reciben el indicador real del motor y esperan a conocerlo. La paleta presenta primero el motivo de protección/cierre, o la advertencia real del archivo grande. El original no se reinterpreta ni se modifica.

## Rojo → verde

Las salidas completas anteriores se conservan en [rojo](rojo/). Las salidas enfocadas están en [verde](verde/). Estas copias de consola normalizan únicamente blancos al final de línea y el salto final; los originales y las trazas se conservan intactos en las rutas temporales de esta sesión. No se cambian mensajes, aserciones ni resultados.

| Conducta | Rojo observado | Verde comprobado |
| --- | --- | --- |
| Retirada del modo Resumen | El selector aún tenía tres modos | Dos modos y Analizar a petición |
| Alcance de estadísticas | El modelo no conservaba rango/columna | Caso puro y recorridos con mismos resultados |
| Perfil antiguo | El dock guardado volvía a aparecer | Se ignora sin perder preferencias ajenas |
| CSV Texto | No tenía disparador; paleta nativa deshabilitada; pestaña existente omitía la barrera | Tres entradas por el mismo diálogo, Cancelar conserva texto |
| Ventana estrecha y opciones | Sidebar y cabeceras consumían el área; opciones o zonas quedaban fuera | Análisis a ancho completo; opciones, seis campos y cuatro zonas visibles |
| Consulta y paginación | Una paginación del mismo snapshot invalidaba el análisis | 10 casos puros y carrera real con fila 10.000; búsqueda/revisión nuevas siguen invalidando |
| Fuente completa protegida | Se mostraba como muestra; la paleta de un archivo grande completo decía Muestra | 7 casos puros y 2 recorridos de proyecto; metadatos reales y motivos de protección |

Tanda enfocada amplia inicial: **93 pasaron, 3 fallaron, 1 omitida y 85 no ejecutadas**, de 182 previstas; se detuvo a los tres fallos. No se declara verde esa tanda. Sus causas fueron: construcción anterior al último commit (About mostraba un SHA anterior), falta de petición explícita tras editar una revisión y cuatro zonas recortadas. Se reconstruyó el head congelado, se conservó la actualización a petición y se compactó solo la cabecera. La repetición de esos tres casos y los recorridos de disposición/idiomas afectados pasó **16/16**, sin reintentos. Las cifras, bytes y cajas exigidas no se relajaron.

## Validación integral y correcciones finales

macOS 27.0.1 arm64, Node.js v24.22.1, Pandoc 3.12.1. Instancias y perfiles temporales, archivos sintéticos. El código no cambió entre la construcción y la suite completa de 26a5. La construcción de d2109ba se hizo después de su commit, para que la identificación del ejecutable coincidiera con el código. No se declara verde una suite completa que falló.

| Comando | Resultado real |
| --- | --- |
| `npm run check` en d2109ba | 0 errores, 0 avisos; TypeScript completado |
| `npm test` en d2109ba | 140 archivos; 2.669 pruebas pasaron y 1 omitida; 17,03 s |
| `npm run build` en d2109ba | Completado |
| `npm run test:e2e` en 26a5 | **601 pasaron, 7 omitidas y 5 fallaron**, 22,6 min; 0 reintentos |
| Playwright enfocado en d2109ba, 1 worker y `--retries=0` | **10/10 pasaron**, 40,7 s; cinco fallos corregidos y cinco controles relacionados |

La omisión unitaria es `tests/package-smoke.test.ts:18`, exclusiva de Windows y omitida en macOS por su `skipIf(platform !== 'win32')` previo. Pandoc real se ejecutó: el binario local no tiene soporte HTTP y su prueba deja explícitamente pendiente medir la eficacia del sandbox HTTP con otro binario; ese aviso no es la prueba omitida.

Las siete omisiones E2E son los seis casos de `academic-word.spec.ts` y el caso APP-01 M4 de Word de `commands.spec.ts`: requieren la variable explícita `FREYALAB_PANDOC_TEST_PATH`, que no se configuró en esta tanda. No se añadieron omisiones. Su ejecución E2E con Pandoc queda pendiente; no se confunde con la ejecución unitaria real de Pandoc.

### Cinco fallos observados en la suite integral

| Caso | Causa comprobada | Cambio mínimo y verificación |
| --- | --- | --- |
| Markdown sidebar P5 | El perfil ya había migrado sus preferencias. `blocked.reads > 0` solo se cumplía por la lectura incondicional del dock ahora eliminado, no por la migración que pretendía probar. | Esperar `migrationPending=false`, borrar únicamente `settings.json` del perfil temporal y recargar con Storage bloqueado. La migración real intenta las lecturas; todas las aserciones originales permanecen. Pasó en 1,2 s. |
| Gráfico CSV >50 MiB | El sample canónico es false en un archivo grande completo; el backend rechaza vistas de tabla pero la UI había dejado de bloquearlas. Es una regresión real del cambio de clasificación. | Conservar `doc.large` en alcances filtrados/guardados; presets reciben la bandera independiente `large` y el motivo existente `largeUnsupported`, nunca el aviso de muestra. El nuevo check de preset también falló antes del fix (enabled). El recorrido entero pasa en 19,1 s con SVG/PNG/PDF y hashes intactos. |
| Menú Estadísticas de la columna | Aún buscaba el tablist Herramientas de análisis y Resumen, ambos retirados. | Región real de Estadísticas, mismo alcance seleccionado, volver por helper a la tabla y conservar exactamente Ciudad marcada/Folio no marcado. Pasó en 1,0 s. |
| Overview cancelar/revisión | `requestSubmit()` se ejecutaba antes de disponer de los metadatos del alcance; la nueva barrera impedía comenzar. | Esperar que Explorar columnas esté habilitado antes de invocar el formulario; conserva fase, cancelación, regex, revisión, resultados y archivo. Pasó en 1,2 s. |
| Informes del explorador | La pestaña conserva el explorador abierto al volver de un informe; su summary ya decía Volver a estadísticas generales. El helper buscaba de nuevo el texto cerrado. | Helper común acotado al análisis activo, idempotente: abre el explorador solo si aún no se ve y conserva su estado. El recorrido de perfil/distribución/Pearson/frecuencias pasa en 2,4 s; el informe de muestra en 1,3 s. |

[Salida integral roja](rojo/cierre-integral-26a5.log), [rojo del preset](rojo/preset-filtrado-grande.log) y [diez recorridos corregidos](verde/cinco-correcciones.log). Las trazas íntegras del fallo integral se conservaron localmente en `/private/tmp/freyalab-an1b-full-fallos/`; no se sustituyeron sus resultados por el verde posterior. No se repitió la suite completa tras estas correcciones; la CI final permanece pendiente.

El [inventario exacto](inventario-pruebas.md) identifica proyecto, archivo, suites y título antes/después: **629 → 613 E2E** (19 retiradas por conducta eliminada, 8 títulos reescritos y 3 casos nuevos). El diseño decía 16 unitarias del layout; el AST encuentra **16 casos ordinarios + 14 de it.each = 30 expandidos**. Se retira ese archivo y una fila del mapa que clasificaba la ruta eliminada. No se añade test.skip, ni se cambian plazos, reintentos, workflows ni aserciones de datos.

El [registro por línea](cambios-por-linea.json), el [ledger de cuatro specs](navegacion-cuatro-specs.md) y el [control AST independiente](aserciones-75bf731.json) distinguen los cambios de navegación/foco de las aserciones conservadas. Search y commands no requieren cambios de spec. La aserción de cuadrícula visible de statistics-reports se traslada al ayudante, no desaparece.

## Disposición y capturas

A 1280×720, antes: el área de zonas tenía 135,5 px pero contenía 199,30 px; su último borde llegaba a 744,80 px fuera del panel (689 px). Después de compactar solo la cabecera: área de zonas 200 px; último borde 680,30 px dentro del panel (689 px). La lista de campos conserva 256 px y al menos seis campos visibles. [Medición anterior](campos-antes.json) y [posterior](campos-despues.json). No se achican esa lista ni sus comprobaciones.

| Contexto | Claro | Oscuro |
| --- | --- | --- |
| Español, 1440×900 | [Captura](an-1b-es-light-1440x900.png) | [Captura](an-1b-es-dark-1440x900.png) |
| Español, 900×900 | [Captura](an-1b-es-light-900x900.png) | [Captura](an-1b-es-dark-900x900.png) |
| en-XA, 1440×900 | [Captura](an-1b-en-XA-light-1440x900.png) | [Captura](an-1b-en-XA-dark-1440x900.png) |
| en-XA, 900×900 | [Captura](an-1b-en-XA-light-900x900.png) | [Captura](an-1b-en-XA-dark-900x900.png) |
| Gráfico, 1440×900 | [Captura](graficos-after-light-1440x900.png) | [Captura](graficos-after-dark-1440x900.png) |
| Gráfico, 1280×720 | [Captura](graficos-after-light-1280x720.png) | [Captura](graficos-after-dark-1280x720.png) |

Las capturas corresponden a 26a5; d2109ba no cambia la disposición ni la paleta, solo las guardas de archivos grandes y los montajes/navegación de pruebas. Las pruebas conservan teclado, foco, en/en-XA, contraste y tramas/ticks del gráfico, error, truncado, total y ventana de 800×720. Los JSON `marks-*` conservan colores y marcas reales extraídos del SVG. No se cambió la paleta.

## Límites y pendientes

No se verificaron CI remota de alpha.4, Windows, Linux, Intel, instalación del paquete, los siete E2E opt-in de Word con Pandoc ni lector de pantalla manual. La suite integral no se volvió a ejecutar en d2109ba: se conservaron sus cinco fallos y se comprobaron los recorridos corregidos de forma enfocada. No se publicó ni actualizó la aplicación instalada. No se ejecutó AN-2: Información/Estadísticas conservan su presentación anterior y algunos textos heredados; ese rediseño se desarrolla aparte. Se pierde intencionadamente la vista simultánea de CSV y estadísticas hasta una futura vista dividida. El análisis permanece temporal y no se restaura al reiniciar, según contrato.

## Comandos de la tanda corregida

Se ejecutaron `npm run check`, `npm test` y `npm run build` en d2109ba. La suite integral anterior se lanzó con `npm run test:e2e` en 26a5. El nuevo fallo del preset se guardó antes de cambiar el producto, con `playwright test --project=csv tests/e2e/charts.spec.ts --grep 'gráficos de un CSV mayor de 50 MiB' --workers=1 --retries=0`.

La repetición enfocada final fue:

```sh
playwright test --project=shell --project=md --project=csv \
  tests/e2e/markdown-sidebar.spec.ts tests/e2e/charts.spec.ts \
  tests/e2e/column-menu.spec.ts tests/e2e/columns-overview.spec.ts \
  tests/e2e/statistics-reports.spec.ts tests/e2e/project-source.spec.ts \
  --grep 'P5: almacenamiento bloqueado|gráficos de un CSV mayor de 50 MiB|Estadísticas de la columna|panorámica: cancelar o cambiar revisión|informes del explorador|informe de muestra|configuraciones:|el análisis distingue una fuente completa protegida|una muestra conserva su alcance' \
  --workers=1 --retries=0
```

[Las 30 identidades unitarias retiradas](unitarias-layout-retiradas.json) se extrajeron del AST de la base; se distingue cada entrada de la tabla de datos, sin ejecutar una prueba borrada ni inventar el recuento.
