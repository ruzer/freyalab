# SIM-2d · Información más clara · Evidencia local

Información conserva los mismos datos e informe y reduce el espacio repetido cuando el resultado está completo. La línea del archivo y las fichas de tipos permanecen; el anuncio completo sigue disponible para asistencia y la revisión pasa a «Cómo interpretar esta vista». Los alcances filtrado, marcado, parcial o de muestra siguen visibles. Columna/Tipo probable se alinean a la izquierda, las cifras a la derecha; los detalles conservan teclado y acciones, con chevron posterior y «Explorar ›».

El buscador aparece desde 21 columnas y la paginación desde 51, con páginas de 50. Se reutilizan `CsvColumnsOverview`, `Icon`, los catálogos actuales y el informe del menú Exportar de A. No se modifica cálculo, parser, perfiles, orden de columnas, puente, persistencia, límites ni originales. Véanse [alcance y siete ADR](../stories/sim-2d-alcance-adr-0021.md) y [manifest verificable](sim-2d-informacion-clara-2026-11-20/proof.json).

**Estado:** calificación local por fases y 16 capturas completas; CI del head final pendiente. Los 94 casos integrados preceden a la última corrección visual de una clase. La fuente final beaf15f pasó build, el caso enfocado de sombra/teclado/datos y ocho capturas nuevas después. La comprobación de un build o de las pruebas locales no acredita paquete, instalador, otras plataformas ni el `main` resultante.

## Fuente y fases

| Fase | Commit | Fuente `src` |
| --- | --- | --- |
| Base A | `4e3289fee36702935c3be9de4eecf420f16225d4` | `aea145d17ed183895aadca5fd3ae953cc58b8ff7` |
| Historia y pruebas antes de producto | `67e0bf7a469990fc26d7c0bf22d63c422c4455d1` | idéntica a la base |
| Implementación D | `233a739a658f2403943f5af03b2768ea39e2419c` | `03d36ff36ddbe724a1e61b4d70005045f3f96200` |
| Integración normal de main | `00b4329ca786c7c026b3b4f2abf4876a8184d1d4` | idéntica a 233a739 |
| Corrección visual final | `beaf15fed13225399a67119a74ddd770ff4004a6` | `5bbede9487bc7647a86df587f95b42ac86eed0db` |

La integración 00b4329 incorpora la observación C5 y su documentación ya publicadas; no cambia la fuente de D respecto de 233a739. La corrección final añade únicamente `btn-ghost` al botón Explorar, reutilizando el estilo existente. El manifest compara SHA-256 del componente, catálogos, helper del informe, explicaciones heredadas, fixture y spec. Los seis casos nuevos conservaron el SHA `baf9815aceb84e4491cb54e2d47ec387daae3fb88ce773f26a840768267217c0` hasta 00b4329; el único oráculo de sombra añadido deja el SHA final `7f18f3c2b4d08fb6de0359bd3f9de4614db0307cedc6795a8cff7b6a8a2f6971`. La fixture `analysis-auto-info.csv` conserva `18b9271c08cd81d3fb80c18fda6c41d152a6a13dddf6c77134327fc9c0eb9a8a`.

## Rojo antes de producto

Sobre 67e0bf7, la primera tanda terminó con cinco rojos de conducta y un fallo de preparación, **no seis rojos funcionales**. Los tres idiomas y el caso ocupado→completo observaron 32,5 px de flujo donde el estado completo debe ocupar como máximo 1 px; el caso de detalles no encontró el chevron posterior. Se conservan los seis resultados y errores en [log inicial](sim-2d-informacion-clara-2026-11-20/logs/red-red.log) y el manifest. La tanda duró 55,913 s según Playwright, sin reintentos.

El primer caso de umbral encontró «Nuevo Proyecto» abierto transitoriamente sobre Welcome. La grilla alcanzó sus dos filas y el primer clic de Analizar fue interceptado. La traza no muestra una acción previa de la prueba que abriera el diálogo; **su causa no está demostrada**. No se añadió Escape, espera fija, nuevo plazo ni parche de preparación para ocultarlo. Se conservan la [observación](sim-2d-informacion-clara-2026-11-20/logs/threshold-setup-observation.md) y su [cronología con hashes](sim-2d-informacion-clara-2026-11-20/logs/threshold-setup-observation.json).

La ejecución aislada del mismo caso y fuente alcanzó después el rojo real: con 20 columnas había un buscador cuando se esperaban cero. El caso duró 16,946 s y Playwright 17,311 s, con un intento. [Log y reporte aislados](sim-2d-informacion-clara-2026-11-20/logs/threshold-isolated.log). Así, los seis casos tienen rojo funcional demostrado por fases; no se atribuye el fallo de preparación a producto ni se elimina del historial.

## Validación local de la implementación

Sobre **233a739**, raíz ejecutó:

| Comprobación | Resultado |
| --- | --- |
| Tipos | 0 errores, 0 avisos; 9,866 s de proceso externo |
| Build | correcto; 2,133 s de proceso externo |
| Seis E2E nuevas | 6/6, 0 omitidas, 0 flaky, sin reintentos; 13,620 s Playwright / 13,942 s de proceso externo |
| Unitarias completas | 3008 aprobadas + 2 omisiones existentes; 169 archivos aprobados + 1 omitido; 20,72 s |

Los casos cubren es/en/en-XA, huella visual completa, alineación, ayuda/revisión, chevrons y teclado, 20/21/50/51 columnas, estado ocupado real y alcance filtrado/marcado con el mismo informe. Los resultados y hashes originales se comprueban al cerrar cada caso. [Tipos](sim-2d-informacion-clara-2026-11-20/logs/check.log), [build](sim-2d-informacion-clara-2026-11-20/logs/build.log), [E2E](sim-2d-informacion-clara-2026-11-20/logs/green.log) y [unitarias](sim-2d-informacion-clara-2026-11-20/logs/full-unit.log) conservan también sus avisos.

Sobre **00b4329**, el check integrado conserva 0 errores/0 avisos y el build es correcto. La tanda CSV terminó con **87/87**, 0 omitidas, 0 flaky y ningún reintento, en 154,226 s Playwright. Ejecutó ocho archivos: analysis-auto-info 6, analysis-describe 18, analysis-sections 9, analysis-tab 7, columns-overview 8, empty-values 20, information-clarity 6 y project-subset-analysis 13. [Log CSV](sim-2d-informacion-clara-2026-11-20/logs/consumers.log).

`project-source` pertenece a shell y no aparece en ese reporte CSV. Se ejecutó después en su proyecto real: **7/7**, 0 omitidas, 0 flaky y ningún reintento, en 12,992 s Playwright. [Log shell](sim-2d-informacion-clara-2026-11-20/logs/shell-consumers.log). Son 94 casos distintos de nueve archivos; los seis nuevos ya están incluidos en esos 87 y no se suman otra vez. El inventario literal inicial omitía los dos casos parametrizados por idioma de project-source; el manifest conserva esa corrección, sin modificar pruebas.

### Corrección visual después de esos 94 casos

La revisión de la captura en-XA a 1280 detectó que «Explorar» aún parecía un botón con borde por la sombra global U0, aunque las cuatro anchuras de borde ya eran cero. Las 87 pruebas CSV anteriores no comprobaban esa sombra. Se añadió únicamente `box-shadow: none` al caso existente de detalles, conservando todos sus oráculos y su identidad; el rojo sobre la fuente 00b4329 mostró la sombra heredada: **1 fallo**, sin reintentos, 17,354 s del caso / 17,813 s Playwright. [Rojo de la sombra](sim-2d-informacion-clara-2026-11-20/logs/ghost-red.log).

El commit **beaf15f** reutiliza `btn-ghost` en un solo botón, sin regla CSS, handler o cálculo nuevos. Raíz ejecutó build y el mismo caso: **1/1**, 0 omitidas/flaky y sin reintentos, 1,965 s Playwright. Este recorrido vuelve a comprobar borde/sombra, teclado, navegación a Explorar y datos; no se presenta como una repetición de los 94 consumidores, tipos o unitarias sobre el head final. [Build final](sim-2d-informacion-clara-2026-11-20/logs/ghost-green-build.log) · [Verde enfocado](sim-2d-informacion-clara-2026-11-20/logs/ghost-green.log). Las ocho capturas después se hicieron de nuevo; las ocho antes permanecen idénticas. Los hashes de las capturas previas a la sombra se conservan en el manifest y sus PNG originales quedan archivados privadamente.

## Consumidores adaptados, sin casos borrados

El diff real contiene **dos archivos, cinco reemplazos de línea** —diez líneas contando retiradas y añadidas—. Sus 15 identidades se conservan: ocho en columns-overview y siete en project-source. El manifest guarda el texto anterior y posterior completo por línea, con los datos originales.

| Archivo y línea antes → después | Cambio de navegación y oráculos conservados |
| --- | --- |
| `columns-overview.spec.ts:37` → 37 | La fixture de cinco columnas ya no ofrece búsqueda. Se exige su ausencia y cinco filas; permanecen Oaxaca 3/4, informe de cinco columnas, query, ID/Opcional, documento y bytes. La relación buscador→informe completo sigue en el caso existente de 62 columnas. |
| `columns-overview.spec.ts:90` → 90 | El alcance completo pasa de `.scope` a la ayuda. Permanecen 3000/100000/1000000 filas, seis contadores de calidad, valores distintos/repetidos, original, dirty y medición de respuesta. |
| `columns-overview.spec.ts:101` → 101 | El millón de filas se comprueba en la ayuda; siguen un valor distinto, 999999 repeticiones, original y dirty. |
| `project-source.spec.ts:147` → 147 | «Documento completo» pasa a la ayuda. Se conservan fuente protegida, anuncio, tres columnas y vista filtrada posterior. |
| `project-source.spec.ts:201` → 201 | La misma ubicación en la recuperación del documento completo; fuente, muestra, proyecto cerrado y bytes siguen iguales. |

Solo se sustituye el uso del buscador retirado deliberadamente para ≤20 columnas. No se reducen fixtures, casos de un millón, expectativas numéricas, protección de originales, rechazo de revisiones, cancelación, informes, filtros ni pruebas de error, muestra o cobertura parcial. No se añaden plazos ni reintentos.

## Capturas y pendientes

Raíz completó **ocho PNG por fase, 16 en total**: Información con la misma fixture de cuatro filas y seis columnas, es/en-XA × claro/oscuro × 1440×900/1280×720. Antes corresponde a A4e3289 y después a Dbeaf15f. Ambos grupos están completos y sus manifests conservan head, hash de la entrada del build y fixture; el manifest principal añade hash y dimensiones de cada PNG. Los dos casos de captura pasaron en cada fase: [antes, 3,1 s](sim-2d-informacion-clara-2026-11-20/logs/capture-before-corrected.log), y [después final, 2,9 s](sim-2d-informacion-clara-2026-11-20/logs/capture-after-ghost.log), según sus logs.

| Idioma · tema · ventana | Antes A4e3289 | Después Dbeaf15f |
| --- | --- | --- |
| es · claro · 1440×900 | [PNG](sim-2d-informacion-clara-2026-11-20/before/before-es-light-1440x900-info.png) | [PNG](sim-2d-informacion-clara-2026-11-20/after/after-es-light-1440x900-info.png) |
| es · oscuro · 1440×900 | [PNG](sim-2d-informacion-clara-2026-11-20/before/before-es-dark-1440x900-info.png) | [PNG](sim-2d-informacion-clara-2026-11-20/after/after-es-dark-1440x900-info.png) |
| es · claro · 1280×720 | [PNG](sim-2d-informacion-clara-2026-11-20/before/before-es-light-1280x720-info.png) | [PNG](sim-2d-informacion-clara-2026-11-20/after/after-es-light-1280x720-info.png) |
| es · oscuro · 1280×720 | [PNG](sim-2d-informacion-clara-2026-11-20/before/before-es-dark-1280x720-info.png) | [PNG](sim-2d-informacion-clara-2026-11-20/after/after-es-dark-1280x720-info.png) |
| en-XA · claro · 1440×900 | [PNG](sim-2d-informacion-clara-2026-11-20/before/before-en-XA-light-1440x900-info.png) | [PNG](sim-2d-informacion-clara-2026-11-20/after/after-en-XA-light-1440x900-info.png) |
| en-XA · oscuro · 1440×900 | [PNG](sim-2d-informacion-clara-2026-11-20/before/before-en-XA-dark-1440x900-info.png) | [PNG](sim-2d-informacion-clara-2026-11-20/after/after-en-XA-dark-1440x900-info.png) |
| en-XA · claro · 1280×720 | [PNG](sim-2d-informacion-clara-2026-11-20/before/before-en-XA-light-1280x720-info.png) | [PNG](sim-2d-informacion-clara-2026-11-20/after/after-en-XA-light-1280x720-info.png) |
| en-XA · oscuro · 1280×720 | [PNG](sim-2d-informacion-clara-2026-11-20/before/before-en-XA-dark-1280x720-info.png) | [PNG](sim-2d-informacion-clara-2026-11-20/after/after-en-XA-dark-1280x720-info.png) |

Se conserva un primer intento del probe con dos fallos de preparación: faltaba esperar el Locator de `analysisRegion`, por lo que apareció `panel.getByRole is not a function`. [Log del probe](sim-2d-informacion-clara-2026-11-20/logs/capture-before-setup.log). Este intento no califica el aspecto de D y no se suma a los rojos funcionales.

Pendiente: CI sobre el head final congelado. La suite completa local y las pruebas del paquete no se afirman a partir de esta selección de 94 casos.

**Límites conservados:** `columnSummary()` mantiene sus explicaciones heredadas en español; el componente sale de pendientes solo por sus textos propios. La clasificación heredada del límite de 100000 valores distintos por mensaje no se modifica. Ambos quedan fuera de D, junto con nuevas traducciones del motor, parser, cálculo, guardado y cambios de seguridad.

Para reproducir el bloque en cada checkout correspondiente: `npm run check`, `npm run build`, `npm test` y `node node_modules/@playwright/test/cli.js test tests/e2e/information-clarity.spec.ts --project=csv --workers=1 --retries=0`. El rojo de umbral añade `--grep 'buscador desde 21'`. Los logs publicados sustituyen únicamente rutas privadas y códigos de color; conservan fallos, mensajes, cifras y advertencias. Los SHA de origen y de la copia sanitizada quedan separados en el manifest.
