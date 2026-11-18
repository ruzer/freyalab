# Pruebas intermitentes — 2026-11-18

Base de código: `d17cc81cd279f3e8a0938077d0b8d55294f05e83`. Rama: `codex/pruebas-intermitentes`. PR en borrador, base `main`. No cambia el producto, el motor, el guardado, dependencias, plazos, reintentos ni workflows.

## Diagnóstico y cambio mínimo

| Caso | Evidencia roja | Causa observada | Cambio |
| --- | --- | --- | --- |
| `app.spec.ts`, CSV con ceros y multilínea | Rechazo real de `tablePage`: «Consulta cancelada por una solicitud más reciente.» con las lecturas del test y del renderer alineadas mediante una barrera de diagnóstico | Dos consumidores del mismo documento consultaban simultáneamente. El motor cancela la lectura anterior por diseño | Extraer `readTablePage` del ayudante existente `readTableRows`; mantener su espera y su excepción exacta. Reutilizarlo para las dos lecturas del caso |
| `empty-values.spec.ts`, Cantidad | El menú se deshabilita entre pulsar y soltar el puntero al empezar la carga inicial de 150 ms; no aparece el diálogo Valor | El encabezado era visible antes de que terminara la primera carga de filas | Esperar las siete filas reales del fixture antes de usar sus acciones |
| `empty-values.spec.ts`, paleta después de cambiar codificación | Retener la respuesta de página deja el único resultado `fillna` deshabilitado. Enter no ejecuta la acción y Valor no aparece | La codificación confirmada no implica que la tabla haya terminado de cargar | Esperar el único resultado habilitado antes de pulsar Enter |
| `charts.spec.ts`, gráficos visuales | [CI 44134322627](https://github.com/ruzer/freyalab/actions/runs/44134322627), ARM sobre `3960648`: los seis tipos terminan a los 88,944 s; la captura comienza a los 89,523 s y el caso agota 90 s. En el reintento, la última generación empieza a los 89,119 s y solo alcanza a esperar 1,001 s | El caso acumulaba seis tipos, temas, capturas, exportaciones y otra generación dentro de un único presupuesto. Esa traza no demuestra un motor bloqueado | Separar las conductas: seis casos por tipo, temas/tabla accesible, exportación y regeneración/teclado. Todos conservan los 90 s existentes |

Las sondas solo modifican pruebas durante la reproducción: no se añaden canales ni ganchos al producto. Se conservan las fuentes/parches de reproducción y los registros rojo→verde; no permanecen activos en la suite final.

## Rojo → verde

| Reproducción controlada | Rojo | Verde con la misma barrera |
| --- | --- | --- |
| Lectura CSV de `app` | Cancelación específica | 1 aprobada, 1,4 s |
| Menú Cantidad | Valor ausente después de deshabilitarse la acción | 1 aprobada, 2,1 s |
| Paleta en-XA tras codificación | Resultado deshabilitado al pulsar Enter | 1 aprobada, 2,2 s |
| Gráficos separados, sin sondas | Rojo histórico citado y medido en la traza | 9 aprobadas, 23,2 s |

Se conservaron las 18 expresiones de aserción del caso anterior de gráficos. Ningún dato, guardado, protección, límite o comprobación numérica se eliminó. El listado gana ocho casos porque una prueba se reparte en nueve. No se encontró en este alcance una prueba de una conducta retirada que procediera borrar.

## H13-2: LF/CRLF en Windows sigue abierto

La [misma corrida 44134322627](https://github.com/ruzer/freyalab/actions/runs/44134322627) falló dos veces en el primer documento, Markdown. La consulta del inventario confirmó LF antes de pulsar Guardar; el archivo conservó su primer CRLF. La traza solo contiene acciones de prueba, sin una instantánea del aviso ni el resultado de la petición de guardado: no permite distinguir una escritura rechazada de una respuesta antigua o un evento tardío del editor. No se presenta como corrupción demostrada ni como corregido.

En esta Mac ARM, el caso original pasó 3/3 (7,6 s). Una sonda temporal con ralentización de CPU del renderer a 6×, registro de `update`/`save` y los cuatro formatos pasó 10/10 (41,7 s), sin errores del proceso principal y con LF en cada guardado confirmado. Esto no reproduce Windows ni demuestra su corrección. Se retiró la sonda y se dejó ese test y todo el guardado intactos.

Una segunda sonda retuvo únicamente mensajes `edit.undo` que Electron enviara realmente al pulsar el atajo. En Mac el caso pasó (2,5 s), con un `keydown` y **cero** órdenes nativas y cero `beforeinput historyUndo`: no reproduce una entrega duplicada. Las tres rutas existen en el código, pero su mera existencia no demuestra esa causa en Windows. Tampoco se inyectó una segunda orden para inventar una reproducción.

## Validación de la rama

Código de pruebas: `fd6de2c` (las mismas fuentes del worktree validado, sin cambios de aplicación).

| Comando | Resultado real local |
| --- | --- |
| `npm run check` | Éxito, 0 errores y 0 advertencias de Svelte/TypeScript |
| `npm test` | 162 archivos, 2.933 aprobadas y 1 omisión existente: el Pandoc instalado no soporta HTTP; 24,75 s |
| `npx playwright test tests/e2e/app.spec.ts tests/e2e/empty-values.spec.ts tests/e2e/charts.spec.ts tests/e2e/editor-status.spec.ts tests/e2e/search.spec.ts tests/e2e/structural-context.spec.ts --retries=0` | 77 aprobadas, 3,4 min, ningún reintento |
| `npm run build` | Éxito. Conserva los avisos previos de imports dinámicos/paquetes grandes |
| Capturas de contexto | 2 casos aprobados, 3,7 s; 8 PNG |

Registros y parches de las sondas en [la carpeta de evidencia](./pruebas-intermitentes-2026-11-18/). No se añadieron sondas a la app ni quedaron en la suite. Las capturas reflejan la interfaz existente, que no cambia en este PR.

| Idioma / ventana | Claro | Oscuro |
| --- | --- | --- |
| es · 1440×900 | [Captura](./pruebas-intermitentes-2026-11-18/estabilidad-es-light-1440x900.png) | [Captura](./pruebas-intermitentes-2026-11-18/estabilidad-es-dark-1440x900.png) |
| es · 1280×720 | [Captura](./pruebas-intermitentes-2026-11-18/estabilidad-es-light-1280x720.png) | [Captura](./pruebas-intermitentes-2026-11-18/estabilidad-es-dark-1280x720.png) |
| en-XA · 1440×900 | [Captura](./pruebas-intermitentes-2026-11-18/estabilidad-en-XA-light-1440x900.png) | [Captura](./pruebas-intermitentes-2026-11-18/estabilidad-en-XA-dark-1440x900.png) |
| en-XA · 1280×720 | [Captura](./pruebas-intermitentes-2026-11-18/estabilidad-en-XA-light-1280x720.png) | [Captura](./pruebas-intermitentes-2026-11-18/estabilidad-en-XA-dark-1280x720.png) |

La suite E2E local completa y el paquete no se ejecutaron en esta rama; la CI del head final queda pendiente. La evidencia local no sustituye la CI de otro SHA ni de otro sistema.

## Presupuesto Windows: propuesta, sin implementación

En #180, head `e2394b0`, [corrida 44364175150](https://github.com/ruzer/freyalab/actions/runs/44364175150), Windows terminó en 58:22. Pasos: rápidas 38:43, perf/solo 5:21, empaquetado 0:43, CSV empaquetado 8:50, unitarias 2:09. Hubo un reintento de `empty-values` (Precio), por lo que no es una corrida global sin intermitencias.

Si continúa cerca del límite, separar el paquete de Windows en otro trabajo paralelo, como ya sucede en ARM, apartaría 9:33 del camino actual: estimación de 48:49 para el trabajo principal y unos 11–12 minutos para el paquete con su preparación. Es aritmética sobre una corrida, no una medición de la propuesta; faltan variabilidad y espera de runner. No se modificó la CI ni su plazo.

## Siete respuestas del ADR 0021

1. **Herramienta existente.** Playwright ya proporciona esperas por condición y el ayudante CSV ya contempla la cancelación concreta de una consulta anterior.
2. **Prácticas reutilizadas.** Diagnóstico con reproducción controlada, TDD y cambio mínimo; se preservan las aserciones de usuario y de datos.
3. **Integración.** Se usan las API tipadas actuales de pruebas y del puente. No se añade CLI, IPC ni capacidad de producto.
4. **Madurez y seguridad.** Permanecen las versiones, licencias, validaciones y el aislamiento existentes; fixtures sintéticos y ejecución local, sin red del producto.
5. **Mantenimiento.** Un ayudante ya existente admite devolver la página completa; las pruebas largas se dividen por conducta sin otro sistema de ejecución.
6. **Pegamento mínimo.** Tres condiciones de disponibilidad, reutilizar la lectura de página y separar un caso acumulado.
7. **Valor propio.** Conectar la intención de cada prueba con el estado que realmente necesita, sin reimplementar tablas ni tolerar errores desconocidos.

## Límites de esta evidencia

- La causa de H13-2 en Windows no se reprodujo y permanece pendiente.
- «Preparando motor local» no prueba por sí solo bloqueo: la traza citada muestra agotamiento acumulado, no mide todas las subfases internas de DuckDB.
- Los tiempos locales son de esta Mac ARM; no se atribuyen a Intel ni a Windows.
- No se probaron instalación manual, Gatekeeper, SmartScreen ni integración de escritorio. No se fusionó, publicó ni actualizó la aplicación instalada.
