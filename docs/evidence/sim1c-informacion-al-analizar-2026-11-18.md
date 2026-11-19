# SIM-1c · Información al pulsar Analizar

Analizar solicita una sola exploración inicial de Información mediante el motor existente. Abrir el CSV conserva cero solicitudes de análisis. Volver a una pestaña existente con los mismos datos y alcance conserva el resultado; volver al CSV y paginar la misma vista permite terminar el cálculo pendiente.

Después de un resultado, el botón pasa a Actualizar información. Cambiar datos o alcance invalida y avisa, sin recalcular automáticamente; el montaje inicial deja de mostrar el aviso de datos cambiados. El informe aparece cuando existe un resultado válido y la paginación cuando las columnas visibles superan la página de 50.

## Base, conexión y límites

Rama `codex/sim-1c-informacion-al-analizar`, iniciada en `main 7bda2e9`. El merge normal `a3c0f06d` incorpora únicamente el prerrequisito #189 (`1a639b6`); el commit documental `f7b7c91` fija [alcance y siete respuestas del ADR 0021](../stories/sim-1c-alcance-adr-0021.md). Esta base no incorpora SIM-1f ni modifica sus heads congelados.

El producto y sus pruebas se registran en `a212fb5`; la observabilidad se mantiene separada en `a480927`. Después se incorpora por merge normal `main 0260a5d`, que ya contiene #189 y #190: integración `d98e7c3c4fadc69f5df062a0471c5390bf8d00d0`. La validación final y las capturas posteriores corresponden a esta integración; no se reescribe la historia.

La implementación conecta `AnalysisWorkspace` con `CsvColumnsOverview` mediante la sección solicitada, independientemente de que la pestaña esté visible. Consume la petición inicial incluso si termina cancelada, limitada o con error. Mantiene la noción de resultado previo al invalidarlo. El caller legado sin esa señal conserva su entrada manual.

El traspaso a otra sección cancela Información en curso mediante el `cancel()`, requestId y serial existentes; un resultado ya completado se conserva. La prueba retiene una respuesta real y exige cancelación de ese mismo requestId, estado cancelado y exactamente siete llamadas: Información columna 0 y después las seis columnas de Gráficos. El retorno no inicia otra tanda ni produce automáticamente un gráfico, Estadísticas o SQL.

`explore()` conserva íntegros validación, recorrido, ReportContext, presupuesto, respuestas tardías y tratamiento de cardinalidad; solo registra el éxito para la etiqueta del botón. Se conservan 2 000 columnas, dos millones de posiciones, límite temporal existente de 120 s, cardinalidad exacta de 100 000 y cobertura de muestras/resultados parciales. App, motores, IPC, parser, cachés, dependencias, plazos, retries, workflows y `pending-files.json` permanecen intactos. Una clave nueva es/en define Actualizar información; el aviso de cambios pierde el imperativo anterior. en-XA usa el generador existente.

## Fixture y rojo previo

Fixture independiente: seis columnas y cuatro filas, con ceros iniciales, un entero superior al seguro de JavaScript, acentos, un campo vacío y un espacio entre comillas. No se modifican las fixtures anteriores de cinco columnas.

| Columna | Tipo esperado | Con contenido | Vacíos | Distintos sin vacíos |
| --- | --- | --- | --- | --- |
| ID | Posible identificador | 4 | 0 | 4 |
| Ciudad | Categórico | 4 | 0 | 2 |
| Edad | Numérico | 4 | 0 | 4 |
| Ingreso | Numérico | 3 | 1 | 3 |
| Fecha | Fecha ISO | 4 | 0 | 4 |
| Opcional | Categórico | 2 | 2 | 1 |

Los conteos se comprobaron independientemente con lectura CSV; los tipos coinciden con las reglas y casos existentes del perfilador. El spec inicial de cinco casos tiene SHA-256 `bb8fe5d5f96781c01158af3e0a466ec5b787a04e37e2a110539978befa9c1d9a`; la fixture, `18b9271c08cd81d3fb80c18fda6c41d152a6a13dddf6c77134327fc9c0eb9a8a`.

El spec final de seis casos conserva SHA-256 `26a63363eeb1b1b0b4c55cada8269a5809078f18c5893d371987f35ed35ea716`.

Raíz ejecutó los cinco rojos sobre fuente sin interfaz SIM-1c y build nuevo: cuatro esperaban resultado o progreso inicial y recibían el aviso «Datos o alcance actualizados…»; el quinto encontraba un informe que debía estar ausente. El intento de preparación de capturas sin dependencias no ejecutó esas pruebas y no se cuenta como rojo. Los logs, traces, hashes y observadores reales se conservan en evidencia privada.

## Consumidores y validación

Se migran seis specs y el helper existente `panel.ts`. Cálculo inicial manual pasa a esperar su mismo resultado; las actualizaciones posteriores usan Actualizar información. Informe inválido deshabilitado pasa a ausente, y las dos expectativas de paginación con dos columnas pasan a ausencia del paginador. Se conservan las páginas de 50+12 y todos los oráculos de filas, columnas, tipos, vacíos, muestras, bytes, revisión e historial. No se elimina ningún caso.

Los observadores de cancelación, sustitución y resultados provisionales se instalan antes de Analizar. Las mediciones de cálculo también comienzan antes de esa petición. La antigua barrera sin uso de filas pasa de una consulta de tabla a una lectura de documentos.

El helper mantiene Información, pestañas existentes y la confirmación Guardar/Descartar/Cancelar de CSV Texto. Únicamente al pedir otro destino, sin pestaña previa y con la barra de tabla visible, usa el comando real existente de la paleta. El inventario AST distingue 32 importadores del módulo, 26 callers de esa entrada y 94 llamadas. La comparación antes/después conserva fixtures, `readFile`, `expectCounts`, aserciones de datos, títulos y plazos. Los inventarios y las identidades completas quedan en evidencia privada.

macOS, Node `24.22.1`, Pandoc real `3.12.1`. Raíz es la única ejecutora GUI.

| Comprobación | Resultado y alcance |
| --- | --- |
| Tipos y build finales tras merge de main | Sin errores ni advertencias; tipos 9.48 s y construcción nueva 1.87 s. |
| Unitarias completas finales | 167 archivos, 2972 aprobadas y una omisión específica de Windows, 16.87 s; Pandoc real `3.12.1`. |
| Contratos de vista/pestañas y catálogos | 79/79 enfocadas durante el bloque; también incluidos en la suite completa final. |
| Nuevas E2E | Primer candidato 5/5 en 7.6 s; con la regresión de modo corregida, 6/6 en 9.1 s antes de integrar main. Los seis se repiten dentro del verde final siguiente. |
| GUI final tras merge de main | 8/8 en 20.6 s, sin retries: seis casos nuevos y los dos recorridos originales que habían fallado en la corrida amplia. |
| Regresiones enfocadas antes del merge | 10/10 en 27.3 s sobre el segundo candidato, incluidos los dos recorridos originales, columnas, guardas de AN-1 y Cancelar desde CSV Texto. No equivale a repetir las 210 identidades sobre la integración final. |
| Capturas finales | Antes 2/2 y después 2/2, 2.9 s por fase. Ocho estados por fase; antes cero perfiles, después una sola tanda `[0,1,2,3,4,5]` y seis filas de Información en cada estado. |
| Corrida amplia histórica del primer candidato | 208/210 aprobados y dos fallos de causa no demostrada, 12.6 min, sin retries. La selección contiene 206 casos existentes y cuatro nuevos. Los dos casos que fallaron pasan después aislados y en las ejecuciones enfocada y final; las corridas se informan por separado. El pool completo de esos archivos contiene 285 casos y no equivale a una ejecución aprobada. |
| Revisiones independientes finales | Especificación y estándares: cero hallazgos pendientes después de corregir el ciclo de vida. Son revisiones estáticas; no sustituyen GUI ni CI. |

Los dos fallos históricos se conservan sin modificar sus aserciones ni plazos: cierre de página/contexto al pulsar Crear en el recorrido de fuente protegida (`project-source`, título sobre fuente completa y muestra) y consulta todavía en curso al agotar el plazo existente de la captura U0 (`ui-u0`). Sus cuerpos y aserciones pasaron aislados antes de la corrección posterior: 2/2 en 12.2 s, sin retries ni cambios de plazo. Volvieron a pasar en las ejecuciones enfocada y final descritas arriba. La causa de los fallos de la corrida amplia sigue sin demostrarse. Se reutiliza `traceElectronFailure` solo para esos dos casos, antes de cerrar Electron, con reinicio de su colector en cada preparación. Es observabilidad de pruebas, en commit separado; no se presenta como una corrección de causa ni como ausencia histórica de fallos.

La revisión independiente detectó además un cambio de ciclo de vida no cubierto por los cinco casos iniciales: tras completar Información, cambiar de Tabla a Texto y volver a Tabla desmontaba y recreaba el componente. Una reproducción privada y el sexto caso público confirmaron una séptima solicitud de perfil, con el mismo documento, la misma pestaña existente y solo una petición inicial de Analizar. La corrección conserva únicamente Información montada durante Texto, oculta y sin petición activa; las otras secciones se desmontan como antes. Reutiliza su estado local y la invalidación de revisión para exigir Actualizar después, sin otra caché. El sexto caso pasa junto a los cinco originales, también sobre la integración final.

## Capturas

Las dieciséis imágenes finales usan la fixture nueva. Las anteriores se vuelven a capturar con el build `a8288f5` de SIM-1f, cuyas fuentes y paquete son idénticos a `main 0260a5d`, todavía sin SIM-1c. Las posteriores usan el build nuevo de `d98e7c3`. Los hashes de fuentes, bundles y PNG se conservan en evidencia privada; las capturas antiguas del primer candidato quedan archivadas aparte.

| Idioma | Tema | Tamaño | Antes | Después |
| --- | --- | --- | --- | --- |
| es | Claro | 1440×900 | [Antes](sim1c-before-es-light-1440x900.png) | [Después](sim1c-after-es-light-1440x900.png) |
| es | Oscuro | 1440×900 | [Antes](sim1c-before-es-dark-1440x900.png) | [Después](sim1c-after-es-dark-1440x900.png) |
| es | Claro | 1280×720 | [Antes](sim1c-before-es-light-1280x720.png) | [Después](sim1c-after-es-light-1280x720.png) |
| es | Oscuro | 1280×720 | [Antes](sim1c-before-es-dark-1280x720.png) | [Después](sim1c-after-es-dark-1280x720.png) |
| en-XA | Claro | 1440×900 | [Antes](sim1c-before-en-XA-light-1440x900.png) | [Después](sim1c-after-en-XA-light-1440x900.png) |
| en-XA | Oscuro | 1440×900 | [Antes](sim1c-before-en-XA-dark-1440x900.png) | [Después](sim1c-after-en-XA-dark-1440x900.png) |
| en-XA | Claro | 1280×720 | [Antes](sim1c-before-en-XA-light-1280x720.png) | [Después](sim1c-after-en-XA-light-1280x720.png) |
| en-XA | Oscuro | 1280×720 | [Antes](sim1c-before-en-XA-dark-1280x720.png) | [Después](sim1c-after-en-XA-dark-1280x720.png) |

La suite E2E completa y la CI del head final siguen pendientes. La entrega puede publicarse como PR en borrador contra `main`, con #189 y #190 ya incorporados mediante el merge normal de `main 0260a5d`. Las fusiones quedan a cargo del propietario; no se cambia un head mientras CI lo califica ni se actualiza la app instalada.
