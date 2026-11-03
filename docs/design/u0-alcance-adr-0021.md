# U0 · Alcance publicado antes de escribir interfaz

Base: main `402151adb8d014e63e3a4cff66f50586b0e57249`, que fusionó #108. Rama `codex/ui-u0-base`, worktree independiente. Sin modificaciones al checkout del propietario.

Contrato completo copiado sin editar: [historia U0–U2](../stories/ui-u0-u2-diseno.md). Referencia exclusivamente visual, copiada sin editar en este primer commit: [kit propuesto](freyalab-ui-kit-propuesta.html), SHA-256 **25cf2090aa96ae3602802c7adbedd7924a968e9e4811547ad7c6f0ee46eac058**. No se reutilizan sus scripts ni sus manejadores.

## Alcance en bloques · Ponytail

1. Tokens sobre los nombres actuales: acento claro **#2563eb en una sola definición**, bordes, texto sobre acento, tintes, peligro, éxito, tipos de archivo y resaltados. Medición contra los fondos reales en ambos temas. Mantener el acento oscuro actual si pasa con su texto de botón. Sin modificar paleta de series ni reglas de gráficos: comprobar sus consumidores tras el cambio del token.
2. Escala y estados: controles/etiquetas 13 px; metadatos ≥11; densidad tabular y CodeMirror preservadas. Radios 6/8/12, controles 30/26 px, áreas de botón ≥24, tres elevaciones y movimiento 120/200 ms con reduced-motion. Clases globales, sin crear un componente Button.
3. Cinco jerarquías sobre los botones existentes, foco visible, pulsado, deshabilitado con motivo traducido y descrito, y progreso donde ya existe una operación asíncrona. Se conservan menús, iconos, atajos, roles, acciones y orden de tabulación. Los cambios de estado de Guardar son presentación del mismo flujo, sin alterar escritura, recuperación ni IPC.
4. Validación: prueba roja de contraste leyendo el CSS actual, estados observables de botones, prioridad Guardar/Exportar/Abrir, teclado, foco, claridad/oscuridad, es/en/en-XA, forced-colors y reduced-motion. Evidencia antes/después en los tamaños pedidos y los estados existentes. Pruebas enfocadas durante el bloque; check, unitarias completas, build e integral E2E al cierre por tocar App/style. CI del head final y omisiones registradas separadamente.

U0 no incluye progreso U1, buscadores/limpieza/placeholders/vacíos U1 ni pestañas/navegación U2. Tampoco vidrio U3. Se copia el contrato completo para conservarlo, sin implementar esas entregas. No instalar librerías, cambiar familias tipográficas, rediseñar la tabla, añadir red, fusionar, publicar ni actualizar la app instalada. Detenerse tras U0 para revisión del propietario.

## Dirección visual · ECC

Herramienta local de edición para universitarios y profesionales: densa, calmada, legible y directa. Jerarquía por contraste, tamaño y relieve funcional; el detalle distintivo es la prioridad de acción, sin decoración. Se reutilizan App, Icon, toolbars, diálogos, componentes de editores y los estados existentes. Vistas objetivo: 1440×900 y 1280×720, claro/oscuro y seudolocalización. La referencia es una biblioteca de decisiones visuales, no una segunda interfaz.

## ADR 0021 · Siete respuestas antes de interfaz

Se aplica la compuerta de reutilización solicitada por el propietario. El texto del ADR está disponible localmente en LAB, con estado Proposed; se consulta en modo lectura. No se copia código, configuración ni historial de LAB a FreyaLab.

1. **¿Ya existe una herramienta que lo haga?** Sí: CSS custom properties, pseudoclases, media queries y botones HTML nativos; Svelte y los componentes actuales gestionan estados. Se reutilizan tokens/clases/diálogos y el patrón de contraste ya presente. No hace falta otra biblioteca UI ni otro motor.
2. **¿Hay una skill reutilizable?** Ponytail y TDD; ECC frontend-design-direction, accessibility y e2e-testing; Data visualize-data para semántica y revisión de contraste de colores. No se encontró skill específica de Svelte ni un servicio de validación de color conectado. Se puede contrastar la medición con el comprobador local de color del paquete Data, sin incorporarlo como dependencia del producto.
3. **¿Se puede integrar mediante CLI, API o MCP?** El producto usa CSS/Svelte y sus API internas actuales. Node/Vitest/Playwright verifican y las herramientas GitHub publican el PR en el nivel de desarrollo; no se añade ninguna CLI, servidor, skill ni agente a la app.
4. **¿Madurez, seguridad, mantenimiento y licencia?** Se conservan librerías, versiones y licencias del lockfile. Botones nativos y CSS son capacidades de Chromium ya incluido en Electron. Mensajes mediante i18n y texto escapado; no HTML arbitrario, eventos en línea del prototipo ni permisos nuevos. No se repite la auditoría del ecosistema.
5. **¿Qué costo de mantenimiento añade?** Un conjunto acotado de tokens/clases y atributos de estado en controles actuales, con pruebas del CSS real y comportamiento. El costo real incluye motivos accesibles en los componentes que deshabilitan botones; no debe ocultarse en un observador global ni duplicarse en otro sistema de botones.
6. **¿Cuál es el pegamento mínimo?** Reglas globales que todos heredan, variantes explícitas y condiciones de presentación vinculadas al estado ya disponible; reutilizar i18n, sr-only, focus y los callbacks. No componente Button, motor de tema paralelo ni formato persistido nuevo. Usar solo un adaptador local pequeño si la descripción accesible compartida no puede resolverse con los mecanismos existentes.
7. **¿Aporta valor escribir código propio?** Solo la adaptación del diseño de FreyaLab y su jerarquía contextual. La base visual la resuelven CSS y controles nativos; el valor propio es explicar disponibilidad/progreso y mantener consistencia sin perder integridad ni rendimiento.

## Decisiones explícitas del propietario · barra superior

La regla inicial «un primario» chocaba con pedir Guardar primario al editar y Exportar siempre primario. Ambos comparten App.svelte:454. El propietario decidió:

- Con cambios o documento nuevo sin nombre: **Guardar primario**, Exportar secundario.
- Sin cambios: **Exportar primario**, Guardar secundario deshabilitado con motivo.
- Mientras guarda: conservar la variante, deshabilitar Guardar y mostrar progreso, sin alternar Exportar hasta terminar. Esta es la excepción explícita de un primario temporalmente ocupado.
- Mismas cajas, tamaño y posición; solo cambia estilo/estado. Nombre accesible de cada botón estable; no depender únicamente del color y respetar reduced-motion.
- Cuando la exportación de solo lectura ya sea admitida, Exportar es primario. **No habilitar una capacidad que el motor o el documento no permita.**
- Excepción resuelta después: Texto/CSV Texto guardado, vistas de solo lectura sin exportación admitida y ausencia de documento pueden dejar Guardar/Exportar ambos indisponibles. En esos casos, **Abrir es primario** y los otros dos secundarios, conservando sus restricciones y mostrando el motivo. Se mantiene una sola acción principal disponible sin cambiar contratos.

## Discrepancias comprobadas y límites

- El token actual claro es #007aff, pero el botón antiguo .primary usa además el color fijo #0a6cf0. La prueba roja medirá el **token real**, sin atribuir al botón un contraste que usa otro color. Se unificará detrás del token aprobado.
- Los fondos actuales difieren de los del prototipo. No se dan por válidas las ratios del documento sin medir los pares reales, incluido el fondo de los botones. Si hace falta ajustar un color sugerido, se registrarán antes/después y razón.
- Hay atributos disabled en 25 componentes (177 ocurrencias, que incluyen también campos/selectores). Los motivos se asocian al estado real, sin añadir un componente de botones ni un mensaje genérico que oculte la causa. No se cambia lógica del motor para hacer disponible una acción.
- Las alturas actuales compactas del panel de análisis y de las barras son parte del trabajo de F2b/Markdown. La nueva escala no debe volver a recortar Total, controles o texto; se verificará con casos consumidores y capturas.

**Este primer commit y PR solo publican referencias, alcance y las siete respuestas. No hay interfaz implementada ni validación declarada completa.**
