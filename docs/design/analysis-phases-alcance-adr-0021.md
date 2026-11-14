# Analítica: medición de fases y correcciones Intel

Base: `9308149778d9635440918d7d79a3add754243d6e`. Las unitarias Intel de la corrida `43545347398` pasaron antes de iniciar este bloque; se verifica por separado su resultado completo.

## Alcance y límites

Medir en Intel y ARM las cuatro rutas existentes: 200 campos, tendencia de 300.000 filas, constructor explícito y SQL de más de 50 MiB. Corregir trabajo redundante de la app y estados falsos con rojo previo. Conservar datos, revisiones, cancelación, sandbox, SQL de solo lectura, límites y exportaciones. Las esperas originales no cambian antes de disponer de medición. No se fusiona ni se publica.

## Siete respuestas del ADR 0021

1. **Does a tool already do this?** `performance.now`, User Timing, eventos de ECharts y Playwright permiten medir sin otro motor o biblioteca.
2. **Is there a skill we can reuse?** Se aplican diagnóstico por reproducción, rojo/verde y cambio mínimo. Se reutilizan los helpers de Electron y navegación existentes.
3. **Can it be integrated through CLI, API, or MCP?** La sonda usa Playwright de desarrollo y las APIs de archivos/análisis existentes. No añade comandos del producto ni un puente IPC genérico.
4. **How mature, secure, and maintained is it?** Se conservan las versiones bloqueadas de Electron, DuckDB-Wasm, Arrow, ECharts y Playwright. No hay nueva dependencia ni licencia. Siguen activos el sandbox, el origen aislado y la validación de resultados.
5. **What maintenance cost does it add?** Un callback interno opcional de medición SQL, medidas de navegador activadas por prueba y una sonda fuera de la suite normal. El callback solo se conecta con las dos banderas de prueba. Los registros son numéricos y acotados; no contienen SQL, valores, nombres ni rutas de documentos.
6. **What is the minimum glue LAB must write?** Acumular tiempos en los límites existentes, leerlos desde el proceso de prueba y comparar fixtures idénticos antes/después. LAB no se modifica; el trabajo pertenece a FreyaLab.
7. **Does writing our own code add value?** Las bibliotecas miden sus operaciones; solo falta relacionarlas con el ciclo real de FreyaLab. No se reimplementan SQL, perfiles, estadísticas, renderizado ni un profiler general.

## Semántica de las medidas

Cada proceso mide duraciones en su propio reloj. `window` abarca crear/cargar la ventana; `engine` espera la API lista, por lo que el arranque se compara sumando ambas y sin atribuir todo a WASM. `sourceLoad` contiene `sourceStart`, `sourceRead`, `sourceEncode` y `sourceAppend`: son medidas anidadas, no se suman otra vez al total. `query` incluye preparación/esquema/ejecución en DuckDB; `materialize` transforma Arrow a filas. `resultTransfer` es el tiempo de ida/vuelta menos la duración dentro del worker: aproxima despacho y serialización, no una medición aislada del transporte físico. No se restan timestamps de relojes distintos.

En navegador se separan creación de opciones, `setOption`, evento `rendered` y dos `requestAnimationFrame`. La última medida indica oportunidad de presentar el SVG, no una medición de píxeles en un monitor físico. Cada nombre conserva una entrada; el observador de la sonda registra la serie. Main conserva como máximo 100 registros por instancia de prueba.

Los fixtures, hashes, repeticiones, contexto desarrollo/paquete y versiones acompañan cada observación. La sonda diagnóstica puede observar hasta el límite real del producto; no sustituye ni relaja las aserciones originales de aceptación.

## Decisiones tras la medición inicial

Sonda `43550207123`, SHA `3fadd6ac5fc134b077c6ecaa94afffc09510f680`: 36 observaciones completas, tres por arquitectura/caso/contexto. Los seis fixtures mantienen hash y mtime.

- **200 campos:** Intel tarda 14,120 s en perfiles, de los que 0,573 s están dentro de los 200 handlers principales. Se conservan las llamadas existentes en serie (el motor cancela solicitudes paralelas del mismo documento) y se publican los perfiles, muestras y tipos juntos. No se añade IPC batch ni caché.
- **Tendencia:** se cargaban las 300.000 filas dos veces; 22,394 s de carga acumulada Intel frente a 1,325 s de consulta. Dispersión y líneas sin agrupación no tienen total: se omite solo su segunda consulta, cuyo resultado anterior siempre era nulo. Barras, fechas, histogramas, cajas y mapas conservan sus totales calculados por el motor.
- **SQL de 55.227.700 bytes:** Intel dedica 11,634 s al append y 0,057 s a la consulta. Se elimina el callback JavaScript por byte usando `Uint8Array.fromBase64`, disponible en el Chromium 152 del Electron 44.9.2 bloqueado. El append incluye transporte/Arrow/inserción; la medida no aísla el coste de decodificar. La comprobación real de bytes, Unicode y consultas decide la equivalencia; el mock de Node solo comprueba el adaptador.
- **Constructor:** los 14 motores de la ruta UI observada en la sonda acumulan 32,281 s de arranque Intel, frente a 2,881 s de consulta y 0,367 s hasta presentar los gráficos. Una actualización individual tarda 5–8 s en esta sonda. La prueba original también añadía ocho oráculos SQL dentro del mismo plazo global de 90 s; se separan oráculos y recorrido visual sin aumentar esperas, conservando las 31 aserciones originales y añadiendo dos de integridad al caso numérico. La sonda no repite la generación manual de B después de la automática; no se atribuyen sus 14 motores al caso original completo. No se añade un motor persistente: cambiaría el ciclo de aislamiento y memoria. Tampoco se unen consultas, pues dos resultados válidos separados podrían exceder juntos el límite de 8 MiB.
- **Estado visible:** carga, consulta y preparación de resultados tienen mensajes es/en/en-XA propios. La cancelación se comprueba antes de publicar avances tras un append; la prueba verifica que no haya eventos tardíos.

Estas cifras son medianas de tres observaciones en runners compartidos. No son garantías para equipos de usuarios ni califican por sí solas la CI del head de entrega.
