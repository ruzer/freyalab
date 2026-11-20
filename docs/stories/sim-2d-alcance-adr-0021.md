# SIM-2d · Información más clara · Alcance y ADR 0021

Base `4e3289fee36702935c3be9de4eecf420f16225d4`, rama `codex/sim-2d-informacion-clara`. Se aplica únicamente el [apartado SIM-2d](historia-sim2-analisis-graficos-diseno-para-codex.md#sim-2d--información-más-clara) y sus reglas comunes. La historia ya está copiada por SIM-2a y no se reescribe.

## Comportamiento y conexión mínima

Se conserva la línea del archivo —filas × columnas, tamaño, codificación, separador y encabezado— y las fichas de tipos. El estado ocupa espacio visual mientras calcula, ante error o resultado parcial. Su anuncio final puede conservarse para tecnología de asistencia mediante la presentación `sr-only`, sin una línea vacía ni márgenes residuales. El alcance permanece visible en vista filtrada, selección de columnas, muestra o cobertura parcial; la revisión pasa a «Cómo interpretar esta vista». Un resultado completo sobre todo el archivo no añade una segunda línea de alcance.

«Columna» y «Tipo probable» se alinean a la izquierda en encabezados y celdas; las columnas numéricas, a la derecha. Explicación del tipo, desglose de vacíos y distintos conservan cifras, contenido, teclado, nombres accesibles y acciones. Se reutiliza `Icon` para el chevron decorativo posterior al valor y se elimina el marcador nativo. El botón visible pasa a «Explorar ›», sin borde, conservando `info.inspect` y su navegación actual. No se cambia el orden de columnas ni los valores del informe.

El buscador aparece solo con más de 20 columnas del resultado; la paginación conserva su tamaño de 50 y aparece solo cuando hace falta. El informe continúa en el menú «Exportar» de A y ejecuta la misma función `columnOverviewReport`. No vuelve al formulario de Información.

Fuente prevista: `CsvColumnsOverview.svelte`, textos propios es/en y su salida de `pending-files.json` cuando termine su migración. Se conserva el cálculo secuencial, revisión, cancelación, selección, consulta, resultados, límites y exportación existentes. No cambian `App`, puente, backend, motor, parser, perfiles, persistencia ni esquemas de datos.

**Límite de traducción explícito:** `columnSummary()` en `src/shared/column-profile.ts` conserva sus explicaciones heredadas en español; no se amplía esa migración global. También se conserva la clasificación heredada del límite de 100 000 valores distintos por su mensaje, señalada en el comentario del componente. Retirar este componente de pendientes significa catalogar sus textos propios, incluidos sus dos rechazos «Los datos cambiaron. Vuelve a explorar.», no afirmar que todos los helpers o errores del motor están traducidos.

## Pruebas primero y consumidores

`tests/e2e/information-clarity.spec.ts` prepara seis casos: tres idiomas para el resultado compacto/alineación/ayuda, detalles y teclado, umbrales 20/21/50/51 y ocupado→completo→alcances filtrado/seleccionado con el informe existente. Reutiliza `analysis-auto-info.csv` y crea únicamente CSV pequeños de umbral durante el caso. Las cifras esperadas se fijan a partir del fixture; los bytes y hashes originales se comprueban al cerrar cada caso. Una pausa de respuesta real permite observar ocupado: se delega el análisis, se retiene solo su respuesta y se libera también al fallar, sin fabricar perfiles ni fallos.

La ausencia visual se comprueba con la huella de flujo —caja y márgenes, excluyendo posición absoluta— y el hueco antes de la tabla. No se exige `not.toBeVisible()` a un anunciador de un píxel. Los casos nuevos deben fallar por la capacidad pendiente sobre un build de esta base, no por dependencias, imports o un control que no se intentó alcanzar.

El choque deliberado existente es `columns-overview.spec.ts`, caso de cinco columnas: se retira el uso del buscador y su expectativa de una fila, porque ese control deja de existir a ≤20. Se mantienen su fixture de cinco columnas, vista filtrada por Oaxaca, todas las comprobaciones del informe de cinco columnas, datos y hash. La relación búsqueda de columnas→informe de todas las columnas queda en el escenario ya existente de 62 columnas de `analysis-auto-info.spec.ts`; no se cambian los cinco encabezados para conservar un control retirado. Ningún caso se borra en esta preparación.

Los consumidores de estados y detalles se inventarían por selector, sin relajar cifras: `columns-overview`, `analysis-auto-info`, `analysis-tab`, `analysis-sections`, `analysis-describe`, `project-source`, `project-subset-analysis` y `empty-values`. Los avisos de error, muestra y cobertura parcial con sus datos reales ya se ejercitan en esos consumidores; permanecen. Un estado final mantenido en `sr-only` conserva los lectores actuales. Si se retira su nodo, se migra solo la espera de finalización a resultado/botón listo, no sus aserciones de datos.

Las expectativas de `.scope` para «Documento completo» en `project-source` y de filas completas en los casos de volumen de `columns-overview` deben pasar a la ayuda o a la línea del archivo según el dato que comprueban; no justifican conservar una línea visual repetida. Las expectativas de vista filtrada, columnas marcadas, muestra, provisionalidad y cobertura parcial conservan su espacio visible y sus cifras. El estado de cancelación/error y la continuación en segundo plano siguen teniendo los mismos oráculos.

## Siete respuestas del ADR 0021

1. **¿Existe herramienta?** Sí: el componente ya tiene estados, alcance, resultados, `details`, búsqueda, paginación e informe. `Icon`, `controlHint`, `sr-only` y el menú de exportación de A aportan la presentación necesaria.
2. **¿Habilidad reutilizable?** Flujo rojo→verde y cambio mínimo sobre contratos existentes; pruebas de teclado, geometría y datos reales. No se crea otro sistema de tablas o avisos.
3. **¿CLI, API o IPC suficiente?** Se conservan los callbacks y las llamadas actuales. Playwright/Electron y sus ayudantes existentes preparan las pruebas; no se añade operación IPC ni acceso de archivos al renderer.
4. **¿Madurez, seguridad, mantenimiento y licencia?** Componentes internos MIT y dependencias ya fijadas. Las pruebas usan datos sintéticos y preservan originales, revisión, protecciones y rechazos. No se incorpora dependencia ni carga remota.
5. **¿Coste?** Condiciones de presentación, CSS local, iconos y textos propios. Los límites y las traducciones heredadas ajenas quedan documentados; no hay caché, timer, estado persistente o modelo de resultados nuevo.
6. **¿Pegamento mínimo?** Mostrar u ocultar el espacio visual según el estado/contexto ya capturados, alinear celdas, decorar sus controles nativos y condicionar búsqueda/páginas por el número actual de columnas. La función de informe y las acciones permanecen donde están.
7. **¿Valor del código propio?** Reducir información repetida y hacer legibles los controles manteniendo los mismos datos. Reescribir perfiles, interpretación CSV, analítica o exportación no aporta valor a D.

## Estado de preparación

Solo alcance y pruebas propuestas; fuente de producto intacta. Raíz es la única ejecutora GUI y preservará rojo real, build y capturas antes de autorizar la interfaz. No se ejecutaron aquí GUI, build, tipos, unitarias, benchmarks, CI, commits ni publicación. El cierre posterior conserva los plazos/retries existentes, comprueba consumidores y capturas es/en-XA claro/oscuro a 1440×900 y 1280×720, y registra la calificación del SHA real sin transferir verdes.
