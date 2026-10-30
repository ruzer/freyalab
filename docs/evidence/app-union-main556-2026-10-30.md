# D2: unión con main556 y edición Markdown

## Alcance de la unión

El propietario fusionó PR91 en `5562523ecdc2167bf331439b38ce3d0d8f14d519`. Esta unión parte de84d82a4 (D2, main912 y las tres sincronizaciones E2E aprobadas) e incorpora ese main. No se mueve aún la rama pública93; el candidato se revisa antes de publicar.

La Source cambia respecto a c9437a6: Editor.svelte, markdown-editing.ts, markdown-tasks.ts y los dos catálogos. Son cambios existentes de ED-01 que entraron en main, sin implementación nueva en esta resolución. No se conserva la afirmación de identidad5f8 para la combinación resultante.

## Resolución mínima

Sólo en.json/es.json tenían conflictos. Los156valores comunes entre ambas versiones son idénticos. Cada catálogo conserva las341claves de D2 y añade seis de main: editor.foldedSection, editor.foldSection, editor.unfoldSection, editor.foldedLines, editor.unfoldedLines y editor.rangeTo. Resultado:347claves por idioma, sin pérdida/cambio de valores existentes ni reformatear todo el archivo.

App.svelte, src/main, src/preload, los contratos application-* y package/lock/workflows permanecen byte a byte iguales a c9437a6. Se conservan el inventario inicial, las dos fases de cierre y ACK, CSV Texto, Word/Pandoc y los límites autorizados. Su identidad no prueba por sí sola las interacciones nuevas con Editor.

Los tests existentes de D2 permanecen íntegros. Se incorporan los dos E2E de edición Markdown, las tres unitarias de formato/plegado/multicursor y sus dos entradas de grupo desde main. Se conservan los tres casos bootstrap y las postcondiciones de Nuevo, Gráficos y panel de análisis; no se reduce ninguna aserción.

## Validación pendiente

Esta resolución sólo ejecutó Git y verificaciones JSON con Python. No se ejecutó Node/Electron mientras B3 mantenía la reserva de la máquina. La combinación nueva requiere check, unitarias completas, build, E2E, paquete y CI de las cuatro plataformas sobre el head definitivo. El full469 y paquete88 de27df250 y el foco charts de0ffa136 son históricos y no califican esta Source combinada.

La CI258 de c9437a6 se conserva como calificación parcial del head anterior; una sustitución deberá registrar su conclusión/cancelación y los logs disponibles. No hay fusión de PR, release, instalación ni cambio de CI/dependencias.
