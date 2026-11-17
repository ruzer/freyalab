# PRJ-02b · Analizar un conjunto

Base `main 3960648e8757c16ae27431f126d04c5b84e528f1`, después de #177. Rama independiente, PR en borrador y sin fusión. Criterios 13 y 15 de la historia PRJ-02, más los cuatro ajustes de texto pedidos el 2026-11-17. No se modifican dependencias, límites, fuente ni manifiesto al analizar.

## Cambio mínimo completo

«Analizar» abre la pestaña del conjunto y reutiliza Información, Estadísticas, Gráficos y SQL. El ejecutor existente aplica la cadena guardada y crea un snapshot analítico de solo lectura en memoria dentro del proceso de datos. El preview de cien filas no es la fuente del análisis. No se crea un CSV intermedio, ni se abre/indexa la tabla raíz, ni se añade otro motor.

La fuente raíz debe cumplir los límites analíticos existentes **antes de filtrar o muestrear**: 256 MiB, dos millones de filas, ocho millones de celdas y 200 columnas. La ejecución de análisis recorre y verifica la fuente completa; primeras N de «Probar» sigue leyendo solo el prefijo. Un límite, cambio de fuente/proyecto o cancelación descarta el snapshot parcial. Los datos llegan a la interfaz solo mediante las páginas y metadatos existentes.

La pestaña lleva el nombre del conjunto, su recuento, la protección de la fuente y su cobertura; el gráfico conserva esa cobertura. Se mantienen texto original, ceros iniciales, identificadores largos, campos multilínea y ausentes. Al cerrar el análisis se liberan sus datos; cerrar el proyecto cierra estos análisis. La interfaz reutiliza navegación por pestañas y devuelve el foco al contexto del proyecto.

Los textos de cobertura se comparten con el panel: sin números de paso, nombre del conjunto si hay varias muestras, operadores simbólicos cuando existen y bytes solo en cobertura parcial. El orden aleatorio no acotado explica la alternativa ya admitida: guardar una muestra y ordenar en otro conjunto basado en ella. Se prueba esa cadena.

## Siete respuestas del ADR 0021

1. **Herramienta existente:** el ejecutor de conjuntos ya aplica filtro, orden, selección y muestreo; TableEngine resuelve perfiles/estadísticas; Arrow, DuckDB-Wasm y ECharts resuelven SQL y gráficos. Se reutilizan.
2. **Método reutilizable:** cambio mínimo, TDD en interfaces públicas y pruebas reales de teclado/cobertura. La historia y el fixture fijan las interfaces y resultados esperados.
3. **Integración:** una operación explícita por ids validados en el puente existente. Main resuelve la fuente autorizada; el worker mantiene las filas. Sin red, rutas del renderer ni comandos externos.
4. **Madurez, seguridad y licencia:** mismas versiones bloqueadas y avisos. Ninguna dependencia, permiso, protocolo de red ni licencia nuevos. El snapshot es inmutable y no concede acceso general al disco.
5. **Mantenimiento:** una salida analítica del mismo ejecutor y un contexto adicional del documento. Se evita un segundo parser, SQL para recetas, serialización CSV y cuatro motores de análisis independientes.
6. **Pegamento mínimo:** validar la cadena/identidad/límites, instalar y liberar el snapshot, enlazar la pestaña y compartir cobertura. Los componentes analíticos y sus consultas se conservan.
7. **Valor del código propio:** preservar fidelidad y cobertura de un conjunto nombrado, impedir que una muestra salte los límites de la raíz y presentar el resultado a estudiantes sin exponer detalles técnicos innecesarios.

## Interfaces de prueba y rojo → verde

- Ejecutor público: fixture literal de siete filas, salida completa frente a preview, preservación y límites de la raíz antes de filtrar; prefijo existente intacto.
- TableEngine: snapshot inmutable → perfiles, estadísticas y Arrow de las mismas filas; rechazo de mutaciones y cierre.
- Coordinador/registro: ids, proyecto/fuente/cadena, cancelación, respuestas tardías y limpieza; sin escribir datos o manifiesto.
- Cobertura/resumen puros: es, en, en-XA; una/varias muestras, nombres Unicode, operadores y ejecución completa/parcial.
- App real: «Oaxaca, adultos» → 3 filas y 3 columnas; Edad 34/52/61 en histograma; consulta/estadísticas sobre el conjunto; fuente >256 MiB bloqueada, teclado/anuncios, cierre y fuente intacta.
- Cadena muestra → orden: vector semilla 7 y orden conocidos a mano, sin cambiar la semántica v1.
- Capturas: claro/oscuro, es/en-XA, 1440×900 y 1280×720.

Se guardará salida roja antes de cada cambio y el resumen real de check, unitarias, E2E y build. El SHA final se congela para CI; los resultados se actualizan en el PR sin crear commits solo para cambiar el estado. Windows solo separará su paquete si esta entrega supera 55 minutos, según autorización expresa del propietario; sin subir plazos, workers o retries. La calificación incluye las tres plataformas y una sonda Intel completa sin retry #1.

Fuera de alcance: exportar conjuntos, gráficos/informes guardados, cachés, ampliar límites, PRJ-03 a PRJ-06, nuevas dependencias, fusiones, releases o actualizar la app instalada. La evidencia anterior de #177 se conserva como histórica, no se transfiere al nuevo head.

## Aclaración del propietario · 2026-11-17

Se extiende la excepción de proyectos de una versión futura a **Analizar solo conjuntos v1 reconocidos íntegramente**. La ejecución y su snapshot permanecen en memoria, el manifiesto futuro conserva sus bytes y no se amplían límites. Las definiciones o cadenas desconocidas siguen bloqueadas. La prueba conserva una copia de los bytes del manifiesto y comprueba su igualdad después de analizar.

## Continuación de la implementación

El propietario fusionó #178 (solo documentación) durante el desarrollo. La implementación continúa desde `main 561ff098a13ef0bbf656d617cd44c62ef77d3d90`, sin diferencias de producto respecto a la base original, en `codex/prj-02b-analizar-conjunto-implementacion`, con otro PR en borrador y el mismo alcance.
