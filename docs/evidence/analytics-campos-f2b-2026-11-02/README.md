# Historia 11 F2b · Campos y zonas

Fecha: 2026-11-02. PR: [#108, borrador](https://github.com/ruzer/freyalab/pull/108). Base: `c5db752`. Worktree independiente; no se modificó el checkout del propietario.

Implementación consolidada: `00de74c8a253f94977c7c493b0806a83dd958e5c` (incluye la revisión6e9cea6).
Árbol `src`: `7eab4be2154c781b83f1418be6e8603c4837f540`.
Árbol `tests`: `2c1bf0125f285d7de2518c2d3292aa564412aa85`.

La comprobación integral y la CI del head de entrega se registran al terminar en el cuerpo del PR, sin crear otro commit para actualizar estados, según CONTRIBUTING. Al crear este registro todavía estaban pendientes. No heredar un verde de F2a ni de un head anterior.

## Contrato y límites de la entrega

Se leyó completo y conservó literal [el diseño entregado](../../stories/11-f2b-campos-zonas.md). Las correcciones expresas del propietario están [en la historia](../../stories/11-analitica-excel-f2.md): Día/Mes/Año, sin Semana; mapa de calor con Cuenta fija, otros resúmenes deshabilitados y explicación; incluir Cuenta distintos. Las ampliaciones de motor quedan propuestas, no aprobadas.

La referencia principal se copió sin editar en el primer commit `4263002`: [HTML visual](../../design/freyalab-pivot-combinado.html), SHA-256 `1e358c5a42ed62ce25fa6f7a74860a6db740d27fb26b91968757313c0bddc1d3`. No se reutilizaron sus manejadores ni se carga desde la app. [Alcance y siete respuestas ADR0021 publicados antes de interfaz](alcance-publicado.md).

Solo interfaz y adaptadores puros. Sin dependencias, red de producto, motor nuevo, cambios de `chartSQL`, IPC, guardado, límites, workflows, plazos o reintentos. F2c y F2b-2 no se implementan. No fusión, publicación ni actualización de la app instalada.

## Qué cambió y qué se reutilizó

- `ChartFields.svelte`: buscador insensible a acentos/mayúsculas, grupos por perfil existente, hasta 200 campos, menú nativo accesible por campo y cuatro zonas. Clic, doble clic recomendado y teclado comparten la misma validación. No hay arrastre.
- Las zonas se derivan de `ChartOptions`. Filtros deriva del `where` existente, que también usa ChartPresets; no se añadió otro modelo de análisis. Un valor por zona simple; varios filtros mediante CsvQueryTools ya existente, con borrador hasta Aplicar.
- Arranque con `suggest()`: primera categoría comprobada y primera medida numérica; los identificadores no son medidas automáticas. Sustituir, quitar, intercambiar, limpiar y reiniciar una sugerencia anuncian el cambio.
- Campos de texto permiten Cuenta y Cuenta distintos; los demás resúmenes requieren Número explícito. El mapa solo cuenta. Se mantienen todos los controles avanzados, bibliotecas de configuraciones, consulta, zoom, datos accesibles y exportaciones.
- La figura, la tabla y los totales siguen usando DuckDB y ECharts. Totales de promedio/mediana/mínimo/máximo/distintos se recalculan con el motor; no se suman sus grupos. Porcentaje solo aditivo.
- Barras/mapa: Top10 sobre los resultados recibidos; Otros solo aditivo y nunca si el motor truncó. Nulos no se inventan como cero, incluso con valores negativos. La tabla conserva todos los resultados recibidos y permite 5/10/25/50 por página.
- No se convierte `$`, `%` ni formatos ambiguos. La señal de monto usa ejemplos ya devueltos por el análisis; no es otro detector de tipos. La interpretación numérica explícita conserva la ruta existente y no reescribe el archivo.
- Resultado a la izquierda, campos a la derecha (280/240 px), panel plegable a ancho completo en estrecho. Se retiró el encabezado con X. Texto corriente, una línea visible de estado e información técnica en el popover.
- Anuncios separados para acciones y estado del cálculo, ambos sin ocupar espacio visual, para no borrar una confirmación con el progreso. Foco vuelve al campo al cerrar filtros y a un control válido al cerrar avisos.
- La barra conserva Filtrar/Reemplazar visibles a partir de 1280 px, añade ayuda inmediata al foco/hover con atajos y cambia Analizar por Estadísticas y SQL. Se conservó el dock y su enlace secundario a Gráficos.

## Diferencias frente a un motor de tablas dinámicas completo

El motor existente devuelve como máximo 100 puntos para barras y 400 para mapa. Con 842 grupos, se conserva el aviso de truncado, la tabla guarda los 100 recibidos y NO se fabrica un Otros global. No se afirma haber mostrado 842 filas de resumen.

Con series, el recuento global acotado del motor corresponde a combinaciones; no incorpora un nuevo recuento global de valores de Filas. No se añadió una consulta propia para cambiar esa semántica.

Cuenta significa contar filas como en el formulario anterior; Cuenta distintos conserva `COUNT(DISTINCT y)`. No se cambió silenciosamente a la semántica de celdas no vacías de otras aplicaciones.

Los perfiles automáticos mantienen el mismo guard de F2a: hasta 3000 filas, 1 MiB y 200000 posiciones. En cálculo manual, los campos sin tipo comprobado permanecen como Texto y el control explícito de Número sigue en Más opciones. No se promete inferencia completa automática para archivos grandes. La información de alcance distingue la muestra de la fuente grande completa.

El perfil heredado puede clasificar un porcentaje repetido como Categoría. La insignia y el aviso con un ejemplo no lo convierten en Número. No se introduce una política de moneda, porcentaje o separadores.

Al intercambiar una fecha agrupada por otra dimensión, se usan Barras sin agrupación temporal: el motor solo agrupa fechas en Filas, no en series. Los valores se conservan. Agrupación temporal está deshabilitada con explicación en tipos que no la admiten.

La zona vacía de Valores usa el centinela temporal `y=-2` solo en la interfaz. No se envía a chartSQL ni se guarda como preset: la consulta y Guardar configuración quedan inhabilitadas. Evita mantener un segundo estado de zonas.

## Rojo → verde observado

| Comportamiento | Reproducción roja conservada | Verde observado |
|---|---|---|
| Arranque sugerido puro | `01-fields-red.log` (módulo ausente) | `01-fields-green.log` |
| Recomendación/reemplazo/quitar/intercambiar | `02-zones-red.log` (13 fallos) | `02-zones-green.log` |
| Top10 y Otros | `03-top-red.log` | `03-top-green.log` |
| Lenguaje llano es/en/en-XA | `05-language-red.log` (4 fallos) | `05-language-green.log` |
| Arranque real suma7200, antes conteo8 | `06-ui-red.log` | `36-closure-e2e.log` |
| Edición de celda conserva Promedio | `16-revision-red.log` | `36-closure-e2e.log` |
| Valor textual no se mueve a Columnas | `18-text-zone-red.log` | `35-closure-unit.log` |
| Preferir categoría a ID y contar grupos, no series | `20-initial-groups-red.log` | `35-closure-unit.log` |
| No borrar el anuncio de Intercambiar | `21-candidate.log` | `36-closure-e2e.log` |
| Bordes con contraste suficiente | `23-colors-red.log` | `25-focus-green.log`, `36-closure-e2e.log` |
| Foco al campo tras filtros | `24-focus-red.log` | `25-focus-green.log`, `36-closure-e2e.log` |
| Fecha intercambiada / fecha en mapa sin time inválido | `28-engine-capabilities-red.log` | `35-closure-unit.log` |
| Doble clic respeta Cuenta fija y Limpiar vacía el mapa | `29-map-red.log` | `36-closure-e2e.log` |
| Nulo no supera a un negativo como cero ficticio | `30-null-top-red.log` | `35-closure-unit.log` |
| No sumar promedios por serie sin total recalculado | `32-no-mean-sum-red.log` | `35-closure-unit.log` |
| Vacío sin campo inventado (0) | `33-empty-title-red.log` | `36-closure-e2e.log` |
| Error llano, detalle técnico plegado | `34-error-copy-red.log` | `36-closure-e2e.log` |
| Limpiar no produce falso aviso de campo desaparecido | `37-empty-reason-red.log` | `38-empty-reason-green.log` |

Las primeras pruebas también detectaron selectores antiguos, valores iniciales cambiados y ubicación nueva del detalle; se adaptaron sus acciones/etiquetas, conservando sus aserciones numéricas, de exportación y preservación. No se aumentaron plazos ni retries. Una primera ejecución unitaria encontró EPERM al abrir el servidor local; se repitió con permiso para ese servidor, sin cambiar código de esas pruebas.

## Comandos y resultados reales hasta el cierre de fuente

Node24, Electron44.9.2, macOS27.0.1 arm64. Pandoc local3.12.1 para pruebas heredadas. CPU/RAM no se verificaron en esta corrida; no hay nueva promesa de rendimiento.

| Comando | Resultado y alcance |
|---|---|
| `npm run check` | 0 errores, 0 avisos (`check-final-source.log`) en00de74c |
| `npm run build` | salida0 (`build-final-source.log`) en00de74c |
| `npm test` con Pandoc real local | 2390/2390, 122 archivos, sin omisiones sobre cfd747b; `unit-cfd747b.log`; faltaban aún cuatro pruebas añadidas en la revisión posterior |
| `npm test -- tests/chart-fields.test.ts tests/chart-top.test.ts tests/chart-equivalence.test.ts tests/chart-language-f2b.test.ts tests/i18n.test.ts tests/i18n-pending.test.ts` | 145/145 en6archivos, incluidas67equivalencias literales SQL (`35-closure-unit.log`) |
| E2E de F2a, F2b y barra compacta | 32/32, cero retries en cfd747b (`27-final-focused-cfd747b.log`) |
| E2E de correcciones y estados finales | 13/13, cero retries; fuente que se consolidó en6e9cea6 (`36-closure-e2e.log`) |
| `playwright test --list` en main y F2b | 531→543; ninguna identidad previa perdida, duplicada ni trasladada, 12casos nuevos (`test-identities.json`) |
| Validador de contraste de Data | 24nodos por tema; texto mínimo13.65/12.65, UI4.08/3.38, ocho series3.59/4.84 (claro/oscuro); `colors-verified.json` |

Los comandos previos a6e9cea6 que prueban sus últimas correcciones se ejecutaron con cfd747b y cambios de trabajo; no se atribuyen esos resultados al cfd limpio. Los hashes de los árboles de6e9 identifican la fuente consolidada. Las salidas rojas son resultados esperados de TDD, no checks verdes.

La ejecución integral de543E2E, la suite completa actualizada, check/build del head definitivo y los tres sistemas de CI quedan pendientes aquí hasta el cierre real del PR. Los resultados se publican allí sobre su SHA exacto. SEG-S2e conserva su prueba de fallo esperado de Word; F2b no corrige ese defecto.

## Corrección de consumidores detectada al cierre integral

El head4eb30a2 pasó check y2394unitarias completas, pero la suite integral detectó cinco fallos deterministas antes de detenerse:350pasaron,5fallaron y188no se ejecutaron, salida130 porSIGINT. Se canceló la CI41494708149 de ese head; no se declara verde. [Salida roja literal](39-integral-consumers-red.log).

Al renombrar el acceso superior «Analizar» por «Estadísticas y SQL» se habían renombrado también selectores del botón interno de estadísticas, que conserva «Analizar». Se restituyeron exclusivamente esas referencias en cinco specs. El gráfico ahora tiene anunciadores separados para acciones y resultado; el consumidor del dock pasa a seleccionar el del resultado y comprobar el mensaje real exacto «Resultado actualizado:5grupos» (con espacio tras los dos puntos en la app), manteniendo intactas sus aserciones de visibilidad y desplazamiento.

La primera comprobación de los seis specs dio46/47; el único restante era el texto heredado «Gráfico listo» ([detalle rojo](40-status-message-red.md), [ejecución](41-consumers-46-green-1-red.log)). Tras corregirlo, los seis casos de analysis-dock pasaron6/6, cero retries ([verde](42-analysis-dock-green.log)). No cambia src, datos, expectativas numéricas, plazos, tags, grupos ni workflows. La validación integral/CI debe repetirse sobre el nuevo head y se registra en el PR, sin heredar estos resultados parciales.

## Capturas reales

Mismo CSV sintético, antes compilado de mainc5db752 en un worktree desechable; después en6e9. En el antes el arranque contaba filas; en el después elige Ventas/Suma, cambio intencional del objetivo. Equivalencia de opciones explícitas se verifica aparte.

| Tamaño | Claro | Oscuro |
|---|---|---|
| 1440×900 | [Antes](before-light-1440x900.png) · [Después](after-light-1440x900.png) | [Antes](before-dark-1440x900.png) · [Después](after-dark-1440x900.png) |
| 1280×720 | [Antes](before-light-1280x720.png) · [Después](after-light-1280x720.png) | [Antes](before-dark-1280x720.png) · [Después](after-dark-1280x720.png) |

[Vacío](state-empty.png), [cargando con cancelar](state-loading.png), [error](state-error.png), [842grupos/truncado](state-842-groups.png), [resultado manual con límites](state-result-limits.png), [estrecho](state-narrow.png), [inglés](state-en.png), [200campos](state-200-fields.png), [en-XA1440](state-en-XA-1440.png), [en-XA1280](state-en-XA-1280.png), [en-XA800](state-en-XA-800.png).

Carga y resultado manual provienen de cfd747b; esas superficies no cambiaron en6e9. El resto de capturas provienen de6e9; la del estado vacío se actualizó en00de74c para corregir la invitación. Las superficies con resultados no cambiaron en ese último ajuste. El error captura el detalle abierto deliberadamente; la prueba verifica primero que no aparece sin desplegarlo. No son escenas simuladas. Se desactivan transiciones para capturar el tema asentado. Sin retoque de imágenes.

## Skills utilizadas y revisión

Ponytail: un adaptador puro y un componente específico, reutilizando CsvCharts, ChartPresets, CsvQueryTools y perfiles existentes. TDD: cortes rojo→verde. ECC frontend-design-direction: contrato de estados, distribución y capturas. ECC accessibility/e2e-testing: roles, menús, orden DOM, foco, tamaños, teclado y localización. ECC security-review: no HTML arbitrario, no SQL construido con valores del usuario, límites y validación existentes intactos, errores técnicos confinados al detalle, sin nuevos permisos o rutas. No auditoría de dependencias nueva ni afirmación de seguridad absoluta.

Data visualize-data: unidades, marcas y series redundantes por color/trama o símbolos. No se encontró skill específica llamada dataviz ni Svelte. Sí se encontró y ejecutó su calculadora de contraste incluida en Data (`chrome-contrast.js`), solo como herramienta de desarrollo; no se incorporó a la app. Tests previos preservan ocho trazos/símbolos distintos y el contraste de números sobre el gradiente del mapa. Graphify no aportaba una dependencia desconocida: se reutilizó el mapa ya verificado de los componentes, sin otra auditoría completa.

## Propuestas posteriores · NO aprobadas

- Semana: definir semana ISO con lunes inicial, etiqueta con año de semana y cruce diciembre/enero; fechas ISO sin hora, invalidas/ausentes excluidas con recuento explícito, calendario de huecos y límites existentes. Contrastar sumas y totales por semana antes de ampliar chartTimeGroups/chartSQL.
- Medida numérica en mapa: separar dos dimensiones y un campo de medida; operación explícita y tipo validado; totales recalculados, nulos y ausentes preservados. Definir migración/versionado de presets para que mapas antiguos sigan siendo Cuenta y sus opciones antes ignoradas no cambien de significado. No implementar sin historia y decisión del propietario.
- El acceso Estadísticas y SQL se conserva: sigue siendo útil para análisis avanzado. El enlace Gráficos del dock es secundario y puede parecer redundante; retirarlo corresponde a otra decisión del propietario.

## No verificado

Lector de pantalla manual, auditoría WCAG completa, Intel, instalación manual de artefactos, equipo de menor capacidad, todos los archivos reales de usuarios ni nuevo benchmark de archivos grandes. No existe nueva política de monedas/porcentajes. Las advertencias de tipos no son reconocimiento exhaustivo de símbolos. No se verificó render idéntico entre SO mediante inspección visual manual; la CI cubre sus pruebas y paquetes cuando termine.
