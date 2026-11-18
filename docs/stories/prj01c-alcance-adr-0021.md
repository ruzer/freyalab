# PRJ-01c · Alcance y ADR 0021

Base `main d17cc81`, después de #179. Rama `codex/prj-01c-proyecto-arbol`, worktree aislado; no se modifica el checkout del propietario ni LAB. Historia copiada sin cambios, SHA-256 `4f0b9cd935469b80069014360cfcce3773822578f44c4302a044873d723d8e24`.

## Cambio mínimo completo

Sustituir la presentación de Proyecto por un árbol único de fuentes y conjuntos, reutilizando `.tree-item` y los iconos de Tree. Mover las acciones al menú, con el mismo comportamiento de CsvFileMenu para posición, teclado, foco y cierre; compartir ese comportamiento pequeño sin crear un segundo registro de comandos. No se cambia motor, manifiesto, datos, protección, límites ni confirmaciones. Se conservan los futuros de solo lectura y los conjuntos v1 reconocidos.

La única operación nueva es `project:show`: recibe un id de proyecto validado y revela `proyecto.freyalab` del proyecto activo. No recibe rutas ni abre proyectos ajenos. El esquema de proyecto admite ids de texto de 1–100 caracteres, también para futuros como `future`; si un futuro no trae id válido, `readProject()` usa la ruta como identidad de respaldo. Se admite el mismo límite de 32.768 caracteres que `project:close`, junto con la igualdad estricta con el proyecto activo. No se interpreta el argumento como ruta: siempre se revela el manifiesto resuelto por main. El `id=z.uuid()` global corresponde a documentos/fuentes y rechazaría proyectos válidos; no se modifica el formato del proyecto.

## Siete respuestas ADR 0021

1. **¿Existe una herramienta?** Tree aporta filas, iconos y estilo; CsvFileMenu aporta el menú y sus teclas; los servicios de Proyecto ya implementan todas las acciones, salvo revelar el manifiesto. No se añade un motor de árbol o menús externo.
2. **¿Qué método se reutiliza?** Cambio mínimo, TDD en interfaces públicas y revisión de accesibilidad. La historia fija las interfaces de prueba: panel real, sus menús, sus acciones y el puente explícito.
3. **¿Cómo se integra?** Svelte existente y un canal limitado en el puente actual. Main resuelve el manifiesto activo y llama a Electron Shell. Sin CLI, servidor, red ni ejecución de contenido.
4. **¿Madurez, seguridad y licencia?** Mismas dependencias bloqueadas y MIT. Validación de origen, argumentos e identidad del proyecto; sin aceptar una ruta del renderer y sin ampliar permisos de archivos.
5. **¿Qué mantenimiento añade?** Estado local de selección/expansión y presentación de las acciones existentes. Ninguna expansión se persiste; no se crean modelos de datos o settings nuevos.
6. **¿Cuál es el pegamento mínimo?** Conectar las acciones actuales a un menú accesible; enfocar y recorrer las filas visibles, mostrar problemas/progreso por fuente y revelar el manifiesto activo. Renombrado usa las mismas operaciones.
7. **¿Qué valor aporta código propio?** Reduce el ruido sin perder acciones ni protección y conserva la semántica de FreyaLab. Reutilizar los patrones existentes es menor que integrar otra biblioteca.

## Pruebas y equivalencias de interfaz

- Primero en rojo: dos botones de acción en reposo (criterio 1) y las catorce acciones actuales más Mostrar del proyecto (criterio 9), usando la app real y el fixture `prj02-censo.csv` con Adultos → Muestra estable → Identificador y nota.
- Las cuatro specs actuales suman **51 pruebas** antes del cambio: project 5, project-source 7, project-subsets 26 y project-subset-analysis 13. Se conservan sus identidades, datos, resultados, guardado, cancelación, límites y controles de seguridad; se adapta solo su acceso y los observables que el diseño cambia expresamente.
- Las comprobaciones antiguas de Listo/Verificada y de ausencia de Renombrar en futuros se sustituyen por sus equivalentes observables: protección única, estado de Abrir y motivos de menú con aria-disabled, y versión informativa en title. No se sustituye la validación de datos por aserciones más débiles ni por inspección de miembros privados. El PR registrará archivo/línea, antes/después y motivo de cada cambio.
- Añadir pruebas de teclado/menú, foco, desactivados enfocables, renombrado en fila, problemas/progreso, anchuras y capturas es/en-XA, claro/oscuro a 1440×900 y 1280×720. Las pruebas de IPC usan el puente y handler públicos, con Shell simulado para no abrir el explorador del usuario.
- Por bloque: enfocadas hasta verde. Cierre: check, unitarias completas, E2E completas y build; CI de las tres plataformas sobre head congelado. Sin cambios de CI ni plazos; no fusionar, publicar ni instalar.

Fuera de alcance: PRJ-03, archivos exportados, arrastre, selección múltiple, búsqueda del árbol y persistencia de su expansión. El propietario decidió mostrar «Protegida» una vez en la misma línea: «🔒 Protegida · FreyaLab no modifica las fuentes.». La historia original se conserva sin editar.
