# Alcance publicado antes de la interfaz

Fotografía histórica del cuerpo inicial del PR108, head4263002. Las discrepancias se resolvieron después con la decisión explícita del propietario (ver README y la historia). Este texto no sustituye esa decisión.

## Problema y alcance F2b, antes de escribir interfaz
Cambiar qué se representa aún exige el formulario avanzado de F2a. Esta entrega añade Campos y cuatro zonas accesibles como vistas de ChartOptions, conserva el resultado primero y todos los controles existentes. Base main c5db752, F2a #107 ya fusionada. **BORRADOR de trabajo, todavía sin implementación ni pruebas aprobadas.**

Contrato literal en docs/stories/11-f2b-campos-zonas.md. Referencia visual principal copiada SIN editar en el primer commit4263002: docs/design/freyalab-pivot-combinado.html, SHA256 1e358c5a42ed62ce25fa6f7a74860a6db740d27fb26b91968757313c0bddc1d3. No reutilizar su JavaScript.

### Ponytail: cinco bloques completos reutilizando componentes
1. Acciones puras sobre options: añadir/reemplazar/quitar, zona recomendada, inicio suggest, intercambio. No segundo estado de zonas.
2. Presentación Top10 + Otros aditivo, nunca truncado; tabla con todos los grupos recibidos y paginación5/10/25/50.
3. Campos/zonas reutilizando perfiles, CsvQueryTools, suggest y ChartPresets; clic y teclado, sin arrastre.
4. Integración CsvCharts: arranque sugerido, resultado primero y controles avanzados intactos, mensajes es/en/en-XA, estados, navegación/foco.
5. Barra superior legible con tooltips, evidencia visual y validación final.

### ADR0021 · siete respuestas
1. ¿Ya existe? Sí: suggest, chartSQL, chartPivot, ECharts, CsvQueryTools y ChartPresets. Ofrecen cálculo, filtros y render; falta solo la interacción de campos/zonas.
2. ¿Skill reutilizable? Ponytail, TDD, ECC frontend-design-direction/accessibility/e2e-testing y Data visualize-data. No se encontró skill específica Svelte ni validador dataviz; reutilizar pruebas propias de contraste contra fondos reales.
3. ¿CLI/API/MCP? Usar las APIs internas existentes del producto y las herramientas de desarrollo para evidencia/PR. Ningún agente, CLI ni servicio pasa al producto.
4. ¿Madurez/seguridad/licencia? Se mantienen versiones fijadas del lockfile y licencias ya evaluadas, sin nuevas dependencias ni red. No se repite auditoría del ecosistema. Columnas se identifican por posición, no por nombre ambiguo; conservar SQL validado y puente.
5. ¿Costo? Un adaptador puro de comandos y presentación, más controles Svelte y pruebas; no motor paralelo ni formato persistido nuevo.
6. ¿Pegamento mínimo? Derivar chips desde options; handlers únicos compartidos por menú/teclado; Top10 en copia de los resultados, sin modificar tabla ni datos fuente.
7. ¿Valor propio? Sí: vocabulario llano y acceso directo al análisis de FreyaLab conservando cálculo, exportación, historial y archivo canónico.

### Discrepancias verificadas, no decisiones silenciosas
chartTimeGroups solo none/day/month/year, sin Semana; heatmap fuerza COUNT(*) aunque options.aggregate diga otra cosa. Se consultó al propietario si conservar motor mostrando Semana deshabilitada y Cuenta exclusivamente en ese tipo. Pendiente su respuesta, sin ampliar chartSQL.
ColumnProfile no ofrece muestras ni indicador de monto/porcentaje: no añadir detector. Usa Texto donde falte evidencia.
bar100/heatmap400 son límites existentes. Para842grupos, tabla contiene TODOS los devueltos, mantiene truncado y NO inventa Otros global. No ampliar motor ni límites.

### TDD y validación prevista
Prueba roja antes de cada corte: acciones puras/ChartOptions, recomendación/reemplazo, Top10 aditivo/noaditivo/truncado, traducciones, equivalencia normal67SHA ampliada. E2E observable para arranque, ≤2acciones, teclado/aria-live, 842grupos, foco, estrecho y en-XA. Capturas antes/después1440×900/1280×720 claro/oscuro y estados. check, unitarias completas, build y E2E completa al cierre; CI real de tres sistemas y sus omisiones/reintentos por head.

**No F2c, F2b-2, dependencias, red, cambios de motor/IPC/guardado, ni fusión, release o app instalada. Detenerse tras F2b para revisión.**

