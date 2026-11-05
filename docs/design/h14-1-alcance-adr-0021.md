# H14-1 · Alcance y ADR 0021

Barra de Markdown en Editar y Dividido, con el selector de bloque y los cuatro formatos inline visibles. Orden de traslado a Más: Tarea, Tabla, Mermaid, Insertar, Buscar e Índice. El ancho disponible se mide dentro del espacio de trabajo, con el explorador visible u oculto. Se conserva una fila de 43 px. Se miden también TXT, Mermaid y CSV Texto para corregir únicamente posibles recortes en sus barras. [Historia original](../stories/historia-14-pulido-edicion-diseno-para-codex.md)

La base indicada por el propietario es main. En la base `97eca42`, E2 sigue en el borrador #117 y el orden de integración de la historia sigue pendiente. H14-1 reutiliza los manejadores existentes y se verifica de forma independiente. H14-2 y H14-3 quedan fuera de esta entrega.

## Respuestas al ADR 0021

1. **Herramienta existente.** Svelte y ResizeObserver cubren la medición y la actualización de la barra. Los botones nativos y el patrón de menú ya usado en FreyaLab sirven para la interacción.
2. **Skill reutilizable.** Ponytail acota el cambio al punto de desbordamiento. TDD comprueba el problema por geometría y acceso real en Electron antes de cambiar la interfaz.
3. **Integración.** La API de tamaño del navegador y los eventos de teclado se usan en el renderer existente. Playwright verifica el comportamiento en desarrollo.
4. **Madurez, seguridad y licencia.** Se conservan Chromium, Svelte y el lockfile. Etiquetas por i18n con texto escapado. Sin IPC nuevo, red, permisos ni código de documentos.
5. **Mantenimiento.** El orden vive en una sola lista, con una ruta de ejecución por acción. La prueba de anchos comprueba también traducciones y navegación con teclado.
6. **Pegamento mínimo.** Medir la fila y reubicar las acciones secundarias que no caben. Reutilizar el menú de inserción, los callbacks, los motivos de solo lectura y los tokens de foco.
7. **Valor del código propio.** Solo la prioridad y distribución de acciones de FreyaLab. Medición, dibujo y controles quedan en las APIs existentes.
