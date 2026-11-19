# SIM-1e · Proyecto desde el CSV abierto · Alcance y ADR 0021

Fecha: 2026-11-19. Rama `codex/sim-1e-proyecto-desde-csv`, base `origin/main 0260a5d05341e98a8ea97d5ced7330aa97f413c4`, obtenida mediante fetch con destino explícito. No incorpora los heads congelados de SIM-1c ni SIM-1d. La [historia SIM-1](historia-sim1-simplificar-flujos-diseno-para-codex.md) conserva SHA-256 `c0e45fd395cb147f9a278699b9f45c9a6da93f88a0ab72d87b91e7155afd257f`.

## Comportamiento autorizado

Si está seleccionada la pestaña de archivo de un CSV/TSV guardado y limpio, Nuevo proyecto ofrece marcada «Añadir «nombre.csv» como primera fuente». Antes de comprobar dirty, se prepara cualquier edición de celda y se vuelve a comprobar la misma pestaña, documento y ruta. `active` por sí solo no basta: conserva el CSV base mientras se muestra su análisis. Información, Gráficos, Estadísticas, SQL y subconjuntos analíticos no ofrecen candidata.

Crear conserva el formulario actual y abre después el mismo `ProjectSourceDialog`, con la ruta elegida y columnas detectadas, sin otro selector de archivo. La persona confirma «Añadir y calcular huella». Se conservan el aviso externo, los formatos, las validaciones, la huella y la protección de fuentes existentes. Crear el proyecto no registra ni calcula la huella completa de una fuente.

Con la casilla desmarcada, o sin candidata por cambios pendientes, falta de ruta o documento no CSV, el proyecto queda sin fuente. Cancelar/Escape conserva su comportamiento actual. Cancelar la fuente deja el proyecto creado sin fuentes; no se inventa un rollback de creación. La candidata y la casilla son efímeras y se reinician en cada apertura.

Inicio añade la cuarta tarjeta «Nuevo proyecto…» y Nuevo añade la misma entrada. Las dos entradas nuevas, el lateral y el menú nativo comparten un solo abridor. Se reutilizan las etiquetas y componentes existentes; cualquier texto nuevo nace en es/en y usa el generador vigente de en-XA.

## Conexión mínima y límites

El cambio previsto se limita a `App.svelte`, `ProjectDialog.svelte`, los catálogos es/en y pruebas/evidencia consumidoras. Se reutilizan `prepareDocumentAction`, `ProjectSourceDialog`, `projectPickSource(path)`, `projectState`, `receiveProject` y las guardas de PRJ-01. `projectCreate():Promise<void>` no devuelve la identidad del proyecto ni garantiza que el renderer haya terminado el evento: la transición debe usar el estado canónico existente, cerrar un modal antes de abrir el siguiente y conservar los errores reales.

Se revalida la candidata antes de preparar la fuente. Si falla después de crear, el proyecto queda creado/abierto sin fuente y se informa el error. Si la carpeta contiene un proyecto existente o futuro, se respetan su identidad, sus bytes y el modo de solo lectura. No se cambia el backend para acomodar una suposición del renderer.

No se cambia main/preload/IPC, motores, parser, manifiesto, permisos, formatos de archivo, protección, cancelación, límites, exportación ni PRJ-01c. No se añaden dependencias, cachés, ajustes, timers, retries ni workflows. No se guarda, copia, mueve o registra automáticamente el CSV. No se cambia la app instalada ni se fusiona ningún PR.

## Pruebas y evidencia

Primero se preparan fixtures sintéticas independientes CSV/TSV con Unicode, ceros iniciales, encabezados duplicados/vacío y terminadores conocidos. Los nuevos E2E deben comprobar el contexto limpio, ruta explícita sin segundo selector, confirmación manual de huella y bytes originales; fuente externa y aviso; desmarcar/cancelar; ausencia de candidata en contextos excluidos; entradas Inicio/Nuevo/lateral/nativo; y guardas de archivo/proyecto futuro que correspondan al flujo.

Las pruebas usan acciones de interfaz y respuestas reales del puente. Los observadores se instalan antes de la acción. Las barreras de lectura no introducen consultas de tabla ni respuestas falsas. No se borran ni relajan datos, límites, plazos o aserciones de consumidores existentes. Se reutilizan los helpers de menú y proyecto.

Raíz es la única ejecutora GUI. No se implementa la interfaz hasta que raíz confirme rojos válidos y capture el baseline. Después se ejecutan los casos nuevos, los consumidores afectados, tipos, unitarias completas y build sobre la fuente final. Las capturas cubren es/en-XA, claro/oscuro y 1440×900/1280×720. El uso de App exige la suite completa al cierre de integración y la CI del head exacto; un listado o build no acredita ejecución GUI ni paquete.

## Siete respuestas del ADR 0021

1. **¿Existe herramienta?** Sí: `ProjectDialog`, `ProjectSourceDialog`, la ruta opcional de `projectPickSource`, `ProjectSourceRegistry`, `ProjectStore` y el cálculo de huella ya resuelven creación, inspección, validación y registro. Falta transportar el contexto elegido entre los dos diálogos.
2. **¿Existe habilidad reutilizable?** Ponytail guía el cambio mínimo completo; el flujo rojo→verde y los patrones existentes de accesibilidad/modal/foco cubren la validación. Son herramientas de desarrollo, no dependencias del producto.
3. **¿Hay CLI, API o MCP suficiente?** Las APIs tipadas actuales del puente bastan. No se agrega un comando de backend ni se amplía el acceso del renderer.
4. **¿Madurez, seguridad, mantenimiento y licencia?** Son componentes internos MIT, con pruebas de proyectos/fuentes, permisos, cancelación, bytes y versiones futuras. Se conservan sus validaciones y mensajes. La inspección estática no se presenta como ejecución ni CI.
5. **¿Coste?** Una candidata efímera, una casilla local, un callback de éxito y un abridor para cuatro entradas. Sin nueva dependencia, persistencia, migración o motor paralelo.
6. **¿Pegamento mínimo?** Preparar la edición, comprobar la pestaña de archivo, transportar id/ruta/nombre, resolver el proyecto canónico y preparar la fuente con la ruta explícita. La persona confirma el registro en el diálogo existente.
7. **¿Qué valor tiene código propio?** Continuidad del contexto y menos pasos para crear el proyecto. Duplicar detección de columnas, guardas, hashing o registro no aporta valor.

## Estado de este primer commit

Solo alcance y decisiones. Fuente de producto sin cambios; no se han ejecutado pruebas nuevas, GUI ni build de E. Los resultados, hashes finales y límites de validación se añadirán después de sus ejecuciones reales. No hay push ni PR de E todavía.
