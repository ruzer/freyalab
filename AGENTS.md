# FreyaLab
Electron + TypeScript estricto + Svelte. Mantener la distribución del render en docs/design/reference.html. Todos los recursos se incluyen localmente; sin telemetría ni cargas remotas.
No mezclar funciones de importación Office/PDF, OCR, multimedia, SQL o archivos de GB con la alfa.
Validar IPC, aislar renderer y vista de exportación, conservar valores CSV y originales ante errores. No declarar una muestra como archivo completo.
Comprobaciones: npm run check, npm test, npm run test:e2e, npm run build. Cada entrega: rama codex/, PR revisable, evidencia verificable. CI faltante bloquea publicación; no confundir build con prueba del paquete o instalador.
