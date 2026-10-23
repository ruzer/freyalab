# Fuente, preparación y resultados: evaluación de extractos

Fecha: 22 de octubre de 2026. Estado: propuesta evaluada mediante experimento aislado; **arquitectura productiva sin modificar**. Complementa el roadmap DW y la evaluación open source aprobada; no los sustituye. No incorpora Python ni dependencias.

## Dictamen

Conservar una base analítica por versión y reutilizar preparaciones es una dirección razonable para varios análisis relacionados. No justifica copiar físicamente cada filtro, obligar a crear proyectos ni afirmar que cualquier extracto acelera el trabajo. La prueba de 100 000 filas demuestra que una ruta de captura ineficiente puede costar más que tres cargas actuales.

Separar fuente, preparación y resultados ayuda con trazabilidad y reutilización. No resuelve por sí solo la elección comprensible de ejes, medidas o gráficos; esos controles siguen siendo necesarios, con el motor actual o con Python.

## Qué hace ya FreyaLab

Confirmado en el código de la rama basada en `d70472e2874ef174e623dc55e75b497e6ce84e0f`:

- `table-engine.ts` conserva el documento textual y ofrece `analysisStart`/`analysisNext` con revisión y límites. Para documentos editables se incluyen cambios pendientes; para un editor en modo muestra, el análisis completo usa su fuente en disco bajo comprobaciones de integridad.
- `analysis-source.ts` convierte valores a Arrow UTF-8, distinguiendo ausente (`NULL`) de vacío (`''`) y evitando tipado destructivo. El formato CSV original permanece bajo el motor textual.
- `sql-service.ts` crea un proceso aislado, carga una representación privada, ejecuta consultas y lo destruye. Cada consulta nueva repite preparación y carga. Tiene límites, timeout y cancelación por destrucción del motor.
- `analytics.ts` utiliza transacciones READ ONLY, configuración restringida y sin acceso externo. El análisis no guarda cambios en el CSV.
- Las configuraciones de gráficos guardadas conservan instrucciones y filtros, **no** una copia congelada de los datos. Un mismo preset sobre otra versión puede producir otro resultado.
- Las estadísticas de selección/perfiles también tienen lógica ya probada fuera de DuckDB; una futura base compartida debe integrar o mantener explícitamente esos alcances, no suponer que todo análisis pasa hoy por SQL.

La mejora propuesta es reutilización/versionado de preparaciones y bases. La protección del original durante análisis ya existe; no sería correcto presentar la aplicación actual como destructiva.

## Distinguir cuatro objetos

| Objeto | Ejemplo | Qué conservar |
|---|---|---|
| Fuente | `ventas.csv` en disco o revisión abierta con cambios pendientes | Identidad, formato, origen elegido y huella/versionado explícitos |
| Base analítica | Valores capturados de la revisión 7 | Una captura por versión, cobertura completa/muestra y límites; no se edita desde gráficos |
| Preparación | Oaxaca, pagadas, fecha→mes | Receta reversible sobre esa base; reutilizable por varias salidas |
| Resultado | Ventas mensuales, estadísticas o exportación | Receta + versión + alcance + definición de cálculos |

Una vista SQL es una consulta, no una copia congelada: DuckDB vuelve a ejecutarla al referenciarla. Necesita una base estable si queremos reproducibilidad. Los CTE ofrecen preparaciones dentro de cada consulta, sin garantizar caché entre consultas. Referencias oficiales consultadas: [CREATE VIEW](https://duckdb.org/docs/stable/sql/statements/create_view), [WITH](https://duckdb.org/docs/stable/sql/query_syntax/with). La documentación actual redirige a DuckDB 2.0; el motor realmente ejecutado en este ensayo se registra como **v1.5.4**, sin asumir funciones nuevas de 2.0.

Un subconjunto filtrado puede contener todos los registros que cumplen la condición. Eso es diferente de una muestra incompleta: «18 420 ventas de Oaxaca de 100 000 registros» frente a «200 registros observados de un total desconocido».

## Experimento reproducible

[Prueba opt-in y metodología](../experiments/analysis-datasets/README.md), sin cambios de aplicación. Datos sintéticos, dos repeticiones en orden alterno, tres consultas idénticas por variante, dos preparaciones, cálculos independientes con BigInt y el runtime productivo. Equipo: Apple M2 Max, 32 GiB, macOS ARM64; Node 24.22.1, Electron 44.9.2. [Mediciones brutas](evidence/analysis-datasets-2026-10-22.json).

| Filas | Actual: tres cargas + consultas | Base congelada: captura + una carga + tres consultas | Lectura |
|---|---:|---:|---|
| 3 000 | 1,62–1,65 s | 0,66–0,70 s | El arranque repetido pesa más |
| 100 000 | 3,506–3,509 s | 4,877–4,879 s | La captura experimental por páginas consume 3,130–3,137 s y empeora el total |

Tras cargar 100 000 filas, cada consulta sobre la base tarda aproximadamente 0,15–0,19 s, frente a 1,14–1,18 s con preparación completa actual. Esto demuestra amortización de cargas, **no** que la propuesta completa sea más rápida para cualquier tarea. Con tres consultas la captura pierde; el punto de amortización depende del trabajo y no se midió de forma general.

El máximo observado del working set del proceso analítico es similar: aproximadamente 374 MiB para 3 000 filas y 437–443 MiB para 100 000 en ambas variantes. No hay evidencia de ahorro de memoria. La captura añade además memoria en el proceso de pruebas; no es un diseño de memoria recomendado. Sumas de working sets pueden contar páginas compartidas, no equivalen a RSS exclusivo; el JSON conserva observaciones y método.

No son tiempos universales, arranque frío de la app ni un estudio estadístico. Dos repeticiones, archivos estrechos, consultas simples, sin concurrencia y una ruta de transferencia experimental. No se midió aquí ECharts, interacción del constructor, archivos grandes ni tiempos de instalación.

## Decisiones que sí conviene adoptar

1. Mantener edición y análisis como acciones comprensibles dentro del mismo editor. «Analizar» puede abrir un espacio temporal automáticamente; no pedir al principiante crear un proyecto para obtener una suma.
2. Proponer una base por versión y preparaciones con nombres humanos: «Ventas pagadas de Oaxaca». Varios gráficos y estadísticas pueden compartirlas. No generar CSV físicos para cada paso.
3. Mostrar siempre origen y versión: «Revisión 7 · incluye cambios sin guardar · 100 000 registros». Si cambia la fuente: «Hay datos nuevos; actualizar crea una versión nueva». Nada de reemplazos silenciosos ni de conservar resultados viejos como si fueran actuales.
4. Ofrecer guardar el análisis como ampliación opcional. Guardar recetas/configuraciones permite repetir instrucciones; reproducir exactamente los valores requiere conservar o verificar la versión de la fuente. No prometer equivalencia entre ambos casos.
5. Reutilizar DuckDB para cálculos y ECharts para presentación mientras cumplan el objetivo. Cambiar a Python no elimina el coste de extracción, selección de campos, versionado ni diseño de interacción.

## Condiciones antes de una migración

| Riesgo | Condición de aceptación |
|---|---|
| Captura lenta o copias repetidas | Reutilizar transferencia interna existente, sin pasar la base completa por el renderer. Medir total desde captura, memoria y respuesta al usuario |
| Fuente cambiante | Captura consistente con revisión/huella; distinguir disco de cambios pendientes; refresco explícito; inválidos o cambios concurrentes nunca generan mezcla de versiones |
| Cancelación de un motor compartido | Destruir una consulta no puede dejar otras esperando ni presentar una base perdida como disponible. Definir cola/reconstrucción y comprobar timeout, cierre y error |
| Fuentes grandes/muestras | Conservar límites actuales y lectura completa validada; nunca convertir una muestra en una base «completa» |
| Pérdida de fidelidad | Base analítica tipada o columnar no sustituye al CSV textual. Mantener orden, fila irregular, ausencia/vacío y formato en el documento; transformaciones explícitas/reversibles |
| Persistencia de copias | Definir ubicación, versión de formato, recuperación, limpieza y tamaño. Una copia conserva datos sensibles aunque se borre la fuente; no almacenarla indefinidamente sin control visible |
| Compatibilidad | Revalidar macOS, Windows y Linux y empaquetado del mismo commit antes de declarar adopción |

El experimento permite mantener V1 durante ediciones y crear V2 explícita, rechaza mutaciones por la ruta de consultas y bloquea red/disco. No convierte el runtime en almacenamiento inmutable: `seal()` bloquea configuración y la interfaz interna de carga sigue siendo privilegiada. V1/V2 son efímeras y no sobreviven a cerrar el motor.

## Siguiente iteración recomendada

Primero una prueba interna que **retenga la carga productiva existente** para dos o tres análisis, con captura consistente y liberación explícita. No usar la ruta por `tablePage` del experimento en producción. Comparar con los mismos fixtures y medir coste total y cancelación antes de decidir.

Después, si supera esas condiciones, una primera función pequeña: «Preparación guardada» con nombre, filtros y versión elegida, compartida por gráfico y estadística. Luego refresco/versionado y proyectos opcionales. No iniciar a la vez una migración a Python, nuevos motores visuales y persistencia de bases.

Verificación local: `npm run check` (0 errores/advertencias), `npm test` (154 pruebas en 18 archivos), `npm run build`, tipos del experimento y sus dos pruebas nativas (25,8 s), todos satisfactorios. La primera ejecución del prototipo se interrumpió al detectar que destruir la ventana no resolvía por sí solo su promesa pendiente; se añadió la carrera de rechazo por cierre que ya utiliza el servicio productivo y se repitió completa. El JSON adjunto corresponde únicamente a esa segunda ejecución. No se repitió la suite E2E general ni se empaquetó/instaló una nueva app en esta iteración de documentación/experimento.

Validaciones y límites del ensayo se detallan en su README. La decisión de migrar la arquitectura sigue pendiente; esta evidencia no amplía la alfa ni cambia la instalación de FreyaLab en el Mac.
