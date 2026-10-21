# Auditoría y roadmap de los editores FreyaLab

Fecha local: 20 de octubre de 2026. Base inspeccionada: `1ef4665bc22f359de08b32310cd34a6c818af165`.

Estado: auditoría funcional focalizada y propuesta incremental. No equivale a certificación de seguridad ni a pruebas de todas las funciones futuras. El alcance de esta entrega es este documento y una corrección pequeña del alcance de exportación CSV; no autoriza fusionar el PR.

## 1. Contexto recuperado y método

Se reutilizaron `ARCHITECTURE.md`, `EDITOR-MENUS.md`, `PROGRESS.md` y las evidencias de publicación y menús. No se repitió el benchmark ni la auditoría de publicación. La CI existente del commit base es satisfactoria: [ejecución de main](https://github.com/ruzer/freyalab/actions/runs/39536836778). Su cobertura es de 32 pruebas unitarias y 20 E2E; no demuestra las funciones nuevas de esta misión.

Se inspeccionaron manifiesto, contratos IPC, los tres editores, motor tabular, renderizado, guardado, recuperación, exportación y pruebas. Se hizo una reproducción aislada con un CSV sintético y un perfil temporal. Las observaciones estáticas y las comprobaciones ejecutadas se distinguen abajo. No se instalaron bibliotecas candidatas. Ponytail: reutilizar antes de ampliar, corregir una responsabilidad por iteración y probar la interfaz que realmente usa el usuario.

No se generó un índice Graphify: el mapa directo de los módulos relevantes ya permitió seguir los flujos completos. Un grafo adicional no resolvía una incertidumbre de esta iteración.

## 2. Arquitectura y componentes existentes

Stack real: Electron 44.9.2; TypeScript estricto; Svelte 5.57.2; Tailwind 4.3.3; CodeMirror 6. Ventana principal aislada con `sandbox`, `contextIsolation` y sin Node en renderer. El desarrollo utiliza electron-vite; las pruebas, Vitest y Playwright para Electron. No hay Monaco, TipTap, ProseMirror, Milkdown, Papa Parse, AG Grid ni Tabulator instalados directamente.

| Responsabilidad | Implementación actual | Reutilización propuesta |
|---|---|---|
| Sesión, pestañas, herramientas comunes y notificaciones | `src/renderer/App.svelte` | Mantener Abrir, Guardar, Deshacer y Exportar en posiciones comunes; herramientas específicas según tipo |
| Texto Markdown, Mermaid y TXT | `src/renderer/components/Editor.svelte`, CodeMirror | Una interfaz de comandos de edición sobre el texto actual; conservar selección y deshacer |
| Markdown renderizado | `components/Preview.svelte`, `lib/render.ts` | unified/remark/rehype, GFM, KaTeX, resaltado y Mermaid; no un renderizador nuevo |
| Diagramas | `components/Diagram.svelte`, `lib/render.ts` | Mermaid 12.2.0; caché por contenido/tema y DOMPurify |
| Tabla | `components/CsvTable.svelte` | TanStack Svelte Table y Virtual; tabla paginada y virtualización de filas/columnas |
| Datos tabulares | `src/main/table-engine.ts`, `table-client.ts`, `table-worker.ts` | Utility process, csv-parse 7.0.3, csv-stringify 6.9.0, iconv-lite 0.7.3; historial y valores textuales |
| Documentos y recuperación | `src/main/documents.ts`, `files.ts` | Cola de operaciones por documento, guardado atómico, cambios externos y recuperaciones |
| Seguridad y exportación | `src/main/index.ts`, `export.ts`, `src/preload/index.ts`, `src/shared/types.ts` | Validación Zod, permisos de rutas, puente limitado y ventana de exportación aislada |

Los estilos, menús desplegables y notificaciones ya se comparten visualmente. Los menús son locales en App/CsvTable; todavía no existe un menú contextual o de comandos común con búsqueda, Escape y navegación completa. No conviene crear ahora un framework de acciones: extraer una pieza solo cuando haya dos usos reales con el mismo comportamiento.

## 3. Estado funcional y brechas

### CSV/TSV

**Existe:** editar celdas y encabezados; añadir filas al final o después de una fila; añadir columnas al final; eliminar filas y una columna; duplicar filas/columna; selección de filas y columnas; copiar TSV; pegar TSV dentro de las dimensiones existentes; deshacer/rehacer; búsqueda global; reemplazo literal; filtros «contiene» combinados con AND; orden textual o numérico explícito por una columna, estable; espacios exteriores y cambio de mayúsculas; estadísticas de selección; exportar CSV/TSV y copiar como Markdown. Reconoce/corrige delimitador, encabezados y UTF-8/UTF-16 LE/Windows-1252. Guardar preserva el orden del documento; ordenar/filtrar cambia una vista.

**Parcial o pendiente:** insertar arriba/izquierda/derecha mediante controles; mover filas/columnas; rangos de celdas y Shift continuo; cortar; navegación de hoja de cálculo con flechas/Tab; pegar fuera de dimensiones; resaltado de coincidencias; filtros exactos, prefijos/sufijos y comparaciones numéricas; orden múltiple; detección de tipo configurable sin conversión de valores; diagnóstico de vacíos, duplicados y estructura; normalizar encabezados; vista previa de operaciones masivas; importar/exportar JSON y importar tablas Markdown. La conversión CSV↔TSV existe como exportación, no como un comando de limpieza in situ. XLSX no tiene justificación suficiente para añadirse a esta entrega.

Límites actuales: 50 MiB, dos millones de celdas y registros de hasta 1 MiB. Excederlos produce una muestra de solo lectura, hasta 200 registros completos y 8 MiB leídos. No equivale a procesar íntegramente archivos de GB. El historial tabular tiene un presupuesto de 20 MiB.

### Markdown

**Existe:** código editable, vista previa y dividido; paneles redimensionables; sincronización proporcional desde editor hacia vista previa; índice; búsqueda/reemplazo de CodeMirror; negrita/cursiva con atajos; código en línea; inserción de tarea, tabla de ejemplo, Mermaid, H2, viñetas, cita, enlace y bloque `text`; renderizado GFM, fórmulas y resaltado; PDF/HTML autónomo. GFM instalado incluye tachado y notas al pie en el renderizador, aunque no tienen herramientas dedicadas.

**Falta:** modo visual editable; H1–H6 y párrafo en barra; listas numeradas, tachado y separador asistidos; menú `/` o `+` con búsqueda; selector Bash/Python/JavaScript/TypeScript/JSON/YAML/SQL/Go; copiar bloques; cuadrícula y edición visual de tablas; gestión de imágenes desde selector, arrastre o portapapeles; texto alternativo y dimensiones; callouts GitHub con presentación dedicada; modo enfoque, pantalla completa y copiar contenido renderizado. Ocultar el explorador no es un modo enfoque completo. El desplazamiento actual es proporcional y unidireccional, no por bloques ni bidireccional.

El texto es la fuente de edición; cambiar de modo solo oculta paneles y no serializa el HTML de vuelta a Markdown. HTML embebido se conserva en el texto pero no se representa como HTML arbitrario. No está comprobado aún un corpus completo de ida y vuelta entre un futuro modo visual y código.

### Mermaid

**Existe:** `.mmd`/`.mermaid` y bloques Markdown, edición directa, renderizado diferido, SVG saneado, zoom, desplazamiento con puntero, errores y SVG/PNG/PDF. Los diagramas integrados reutilizan el mismo renderizador. No hay formato propietario.

**Falta o es parcial:** galería de nueve tipos, miniaturas, descripciones y ejemplos; asistentes específicos por tipo para nodos/relaciones/participantes; copiar imagen; diagnóstico amigable y ubicación estructurada. «Ajustar» restablece zoom/desplazamiento; no calcula un encuadre geométrico universal. Ante error, Diagram borra el SVG y muestra el mensaje técnico. No conserva una última vista válida visible. En Markdown un bloque inválido se sustituye por un mensaje; la exportación puede incluir ese mensaje sin una confirmación de diagramas incompletos.

## 4. Hallazgos y riesgos de información

| ID / prioridad | Observación y evidencia | Implicación / siguiente acción |
|---|---|---|
| F01 — P1, reproducido | `CsvTable.exportOptions` envía columnas marcadas también al elegir «Documento completo». Con `Código,Nombre,Estado`, marcar Nombre exportó únicamente `Nombre\nAna\nBea\n`. El original quedó intacto. | Archivo exportado incompleto con una etiqueta que promete lo contrario. Primera corrección: solo «Selección» limita columnas/filas seleccionadas. «Filas filtradas» conserva todas las columnas y el orden de la vista. |
| F02 — P1, lectura estática | El pegado multirregistro del motor parte de rowId y sigue índices del documento, mientras la tabla puede estar filtrada/ordenada. | Puede alcanzar filas ocultas o distintas de las siguientes filas visibles. Antes de ampliar el pegado: usar IDs de destino explícitos o restringir el pegado múltiple en esas vistas; reproducción y pruebas pendientes. |
| F03 — P1, lectura estática | `{#key active.id}` recrea Editor al cambiar pestaña. CodeMirror tiene historial local; Main conserva otro historial de snapshots de texto. | El historial visible puede reiniciarse entre pestañas; no introducir un tercer historial visual. Verificar el flujo y conservar el estado por documento antes del modo visual. |
| F04 — P1, lectura estática | Cambiar a un modelo enriquecido y serializar el documento completo puede normalizar o perder sintaxis no representable. | Exigir corpus de preservación y edición de bloques sin tocar rangos desconocidos. No aprobar migración solo por aspecto visual. |
| F05 — P2, lectura estática | Las imágenes relativas se leen desde la carpeta del documento; Guardar como cambia esa carpeta. Recuperar crea un documento sin ruta y usa Documentos como raíz. | Los enlaces pueden dejar de resolver aunque el texto sobreviva. Diseñar traslado/copias de recursos antes de añadir importación de imágenes. |
| F06 — P2, lectura estática | Mermaid descarta el SVG al fallar; los errores pueden contener detalles del parser. | Mantener último render con aviso de desactualizado y bloquear exportación del estado inválido; no presentar el SVG antiguo como actual. |
| F07 — P2, lectura estática | Los comandos de limpieza se aplican sin previsualización; los cambios Unicode no siempre se revierten convirtiendo a minúsculas. | Vista previa con alcance, recuento y muestras; cancelar sin mutación; aplicar con revisión esperada y un deshacer. |
| F08 — P2, política pendiente | CSV almacena literalmente `=`, `+`, `-`, `@`, etc.; FreyaLab no evalúa fórmulas. | Una hoja de cálculo externa puede interpretar fórmulas. Guardar exacto debe conservar datos; ofrecer por separado una exportación explícita para hojas de cálculo con neutralización informada, nunca alterar silenciosamente el original. |
| F09 — P2, revisión estática | Cuadrícula con cada celda enfocable pero sin navegación completa de hoja de cálculo; foco/teclado de diálogos y menús no cubiertos integralmente. | Flechas, Tab, selección con teclado, Escape, retorno del foco y lectores de pantalla antes de declarar accesibilidad completa. |
| F10 — P2, revisión estática | Los límites por archivo no limitan la memoria total de muchas pestañas. La caché Mermaid se limita por 64 entradas, no por bytes; formar un cambio masivo precede a comprobar el presupuesto del historial. | Medir memoria y cancelación con casos extremos; limitar por bytes/progreso cuando la evidencia lo justifique. |

No se afirma pérdida física del original por F01. Sí hay omisión reproducida en la copia exportada. Los riesgos estáticos necesitan pruebas antes de presentarse como fallos ejecutados.

## 5. Guardado, recuperación y seguridad

Ya existen: temporal en la misma carpeta, sincronización del archivo, reemplazo, comprobación de hash antes de escribir y antes de reemplazar, cola por documento, detección externa, protección frente a otro archivo abierto y rechazo de enlaces simbólicos. Recuperación tras dos segundos de inactividad y restauración como documento nuevo. Las pruebas cubren conflictos, disco lleno simulado, operaciones serializadas, caída y recuperación. No hace falta reescribir este subsistema para añadir botones.

Límites: no hay garantía de pérdida cero ante cualquier fallo de hardware; verificar hash y renombrar no es un bloqueo coordinado con otros procesos. Las escrituras e importaciones nuevas deben reutilizar estas protecciones. Una recuperación incompatible se conserva, aunque su descubrimiento/explicación al usuario puede mejorarse. Recuperación no equivale a guardado ni a copia de seguridad del usuario.

Defensas existentes: rehype-sanitize sin ejecutar HTML embebido; Mermaid estricto más DOMPurify; saneado adicional en exportación; ventana de exportación sin preload y con red bloqueada; enlaces externos solo HTTP(S) por acción del usuario; imágenes locales confinadas con realpath y límites; IPC explícito validado con Zod, sin acceso general a disco o procesos. Producción bloquea recursos remotos. Se inspeccionaron estas rutas y sus pruebas existentes, no una exploración de todos los ataques posibles.

Políticas para ampliar:

- Imagen local importada: guardar en una carpeta persistente junto al documento, con nombre seguro sin colisiones y ruta relativa; si el documento no tiene ubicación, pedir destino antes de materializar recursos. Pegado/arrastre debe compartir ese flujo, no usar rutas temporales. Guardar como, recuperar y exportar deben tratar también los recursos.
- URL de imagen: permitir escribir la referencia no obliga a descargarla. Mantener el bloqueo por defecto; cualquier carga futura requiere una acción explícita, límites de bytes/tipo, controles de redirecciones y compatibilidad con uso sin conexión. SVG no se inserta como HTML privilegiado.
- Clipboard/JSON/Markdown importados son datos no confiables: validar forma, dimensiones, codificación, bytes y campos; conservar números largos como texto. JSON de objetos no representa sin ambigüedad encabezados duplicados: preferir matriz más encabezados explícitos o rechazar esa conversión con explicación.
- Callouts: priorizar `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]` en blockquote GitHub. No prometer compatibilidad total con títulos y plegado de Obsidian; preservar variantes desconocidas como texto fuente.

## 6. Evaluación de bibliotecas

Consulta de documentación oficial y metadatos públicos npm el 21 de octubre UTC. Las fechas son publicación de la versión consultada, una señal de mantenimiento, no garantía de calidad. Las licencias indicadas corresponden a esos paquetes; add-ons comerciales y dependencias conservan sus condiciones.

| Alternativa | Versión consultada / publicación UTC | Licencia | Encaje y decisión |
|---|---|---|---|
| CodeMirror `@codemirror/view` | 6.43.15 / 2026-10-19 | MIT | Ya integrado, modular; conservar código y comandos. Sus decoraciones/widgets permiten presentación contextual sin reemplazar todo el texto. No incluye por sí solo un editor visual completo. |
| Monaco | 0.57.0 / 2026-09-24 | MIT | Editor de código maduro, sustituiría algo que ya funciona; no resuelve la edición visual. No añadir. |
| TipTap core | 3.32.0 / 2026-10-13 | MIT | Integración headless/Svelte y ecosistema de extensiones. Candidato de prueba, no dependencia aprobada; Markdown documentado como beta y con limitaciones. Separar funcionalidades de pago. |
| ProseMirror view | 1.42.6 / 2026-09-25 | MIT | Base madura para edición enriquecida; su parser Markdown básico usa CommonMark sin HTML inline. Usarlo directamente implicaría más integración propia. Preferir evaluar una distribución existente antes de ensamblarlo desde cero. |
| Milkdown core | 7.22.3 / 2026-10-10 | MIT | Candidato prioritario para un prototipo visual por su orientación Markdown y reutilización de ProseMirror/remark. Evaluar también su UI existente; demostrar preservación, Svelte, teclado y tablas antes de adoptarlo. No añadir simultáneamente TipTap. |
| Papa Parse | 5.7.0 / 2026-08-24 | MIT | Parser/serializador con opciones de workers/tipos y escape de fórmulas. Duplicaría csv-parse/stringify e iconv ya probados. Mantener los existentes. |
| AG Grid Community | 36.2.0 / 2026-09-16 | MIT | Edición, filtros y virtualización maduros, con JavaScript utilizable desde Svelte. Varias capacidades deseadas de rangos/clipboard/contexto están en Enterprise comercial; Community no resuelve gratuitamente todo el alcance. No sustituir la tabla ahora. |
| Tabulator | 6.7.0 / 2026-10-21 | MIT | Candidato de prueba tabular: rangos, teclado, clipboard y operaciones ya documentados. Validar adaptación al proceso paginado sin cargar todos los datos en renderer ni duplicar historia/orden. La documentación 6.x consultada anuncia una versión menor anterior a la del registro; verificar las APIs exactas antes de integrar. |
| Mermaid | 12.2.0 / 2026-10-13 | MIT | Ya integrado; mantener motor, seguridad y exportación. Galería/asistentes generan Markdown/Mermaid estándar y validan ejemplos con la versión instalada. |

**Bundle y rendimiento:** el build local existente tiene un chunk principal de 3 037 612 bytes y ELK de 2 619 723 bytes, sin comprimir; hay carga diferida de diagramas. No se atribuye todo ese peso a un paquete ni se presenta como tiempo de inicio. Los tamaños npm sin comprimir consultados son contenido del paquete, no bundle de producción comparable: CodeMirror view ≈1.2 MiB, Monaco ≈97 MiB, TipTap core ≈3.1 MiB, ProseMirror view ≈0.86 MiB, Milkdown core ≈0.19 MiB, Papa ≈0.26 MiB, AG Community ≈20.6 MiB, Tabulator ≈28.5 MiB y Mermaid ≈116.7 MiB. No permiten decidir por sí solos: prototipos deben medir el bundle total con dependencias, arranque, memoria, teclado y renderer responsivo con los mismos archivos.

No se probó accesibilidad, rendimiento ni integración Svelte de candidatos no instalados. No se equipara una afirmación del proveedor con una comprobación de FreyaLab.

Fuentes primarias:

- [CodeMirror: decoraciones y widgets](https://codemirror.net/examples/decoration/).
- [Monaco: repositorio y licencia](https://github.com/microsoft/monaco-editor).
- [TipTap: Markdown, arquitectura y limitaciones](https://tiptap.dev/docs/editor/markdown).
- [ProseMirror Markdown: schema, parser y serializer](https://github.com/ProseMirror/prosemirror-markdown), con traslado de upstream enlazado en su README.
- [Milkdown: arquitectura](https://milkdown.dev/docs/guide/architecture-overview).
- [Papa Parse: configuración y serialización](https://www.papaparse.com/docs).
- [AG Grid: diferencias Community/Enterprise](https://www.ag-grid.com/javascript-data-grid/community-vs-enterprise/).
- [Tabulator: rangos y navegación](https://www.tabulator.info/docs/6.x/range/).
- [Mermaid: uso, configuración y seguridad](https://mermaid.js.org/config/usage.html).
- Metadatos npm: endpoints `https://registry.npmjs.org/<paquete>` y `/latest` de los paquetes de la tabla; no se instalaron ni se actualizaron dependencias.

## 7. Arquitectura propuesta y preservación

Mantener Main/Preload/Utility Process/Renderer y los contratos de documento y páginas existentes. La grilla nunca se convierte en dueña del archivo completo ni serializa el CSV de forma independiente. Toda edición tabular se expresa en IDs estables y revisión; filtrar/ordenar es una vista, y reordenar físicamente será un comando distinto, visible y reversible. Los comandos nuevos extienden el contrato existente y su validación en una misma entrega.

Para Markdown, un solo documento canónico textual por sesión, con revisión e historial coherente. Código y visual son formas de editar ese mismo documento; dividido combina una de ellas con la proyección renderizada. No tres documentos, serializadores ni historiales independientes. CodeMirror sigue como herramienta técnica y alternativa segura.

Dos rutas a contrastar en una prueba acotada: (a) presentación contextual mediante decoraciones y comandos de CodeMirror; (b) una UI visual existente, empezando por Milkdown y comparando TipTap si no satisface el corpus. La primera reduce normalización pero exige integración de widgets; la segunda ahorra UI madura pero necesita resolver conversión y preservación. No desarrollar un editor visual propio completo para evitar elegir biblioteca.

El prototipo debe cambiar solo el bloque/rango editado y conservar intacto el resto, o demostrar una conversión realmente sin pérdidas. Cuando una construcción no se pueda representar, mostrarla como bloque de código/fuente conservado, o restringir ese documento al modo código con explicación. No hacer un round-trip silencioso de todo el archivo. Una advertencia no justifica borrar sin opción de conservar/cancelar.

Corpus obligatorio: tablas con escapes y alineación; código indentado y fences anidados; Mermaid; HTML embebido; callouts; referencias definidas aparte; notas al pie; listas anidadas; enlaces e imágenes relativos; texto Unicode, CRLF y finales sin newline. Alternar modos sin editar debe conservar exactamente el texto. Editar un bloque debe conservar los bloques no tocados; deshacer, cambiar pestaña, guardar, reabrir y recuperar deben conservar contenido e historial esperado.

Toolbar, menús, diálogos y atajos pueden extraerse al repetirse comportamientos concretos, con foco/teclado y etiquetas comunes. Acciones de cada editor permanecen locales; Main conserva la autoridad de guardado y exportación. No migración amplia del estado en esta primera entrega.

## 8. Roadmap priorizado y complejidad

Estimación relativa, no calendario: **S** cambio local con contrato existente; **M** coordinación UI/contrato/pruebas; **L** bloque funcional transversal; **XL** riesgo de migración o preservación que exige prototipo antes de estimar entrega completa.

### Fase 1 — Integridad y base compartida (S inicial; M/L resto)

- Alcance: F01 primero; después verificar/corregir pegado filtrado, historia entre pestañas, operaciones de clipboard atómicas y política de recursos/fórmulas. Consolidar foco, errores y menús donde haya repetición real.
- Dependencias: contratos, guardado y recuperación actuales; sin nuevas bibliotecas en la primera corrección.
- Riesgos: cambiar qué significa una selección, duplicar historiales o convertir valores al intentar protegerlos.
- Aceptación: «Documento completo» no omite columnas/filas; filtrado respeta vista; selección es explícita; las correcciones posteriores no modifican filas ocultas ni pierden historial.
- Pruebas: E2E por la interfaz de exportación y lectura del archivo generado; pegado con orden/filtro y IDs; pestañas/deshacer; disco lleno/conflictos/recuperación ya existentes como regresión.
- Beneficio: resultados confiables antes de añadir herramientas nuevas.

### Fase 2 — Barra contextual Markdown (M)

- Alcance: ampliar la barra existente con tachado, H1–H6/párrafo, numeración y separador; acciones sobre selección, menús compactos y atajos consistentes.
- Dependencias: comandos CodeMirror actuales y revisión del historial de Fase 1.
- Riesgos: alterar listas anidadas, formato ya aplicado o saltos de línea; saturar la barra.
- Aceptación: acceso por teclado, modo solo lectura respetado, un deshacer por acción, claro/oscuro y ancho mínimo sin controles inaccesibles.
- Pruebas: selección vacía/multilínea, toggle, listas anidadas, foco, undo/redo y corpus de documentos existentes.
- Beneficio: escribir documentos comunes sin memorizar delimitadores.

### Fase 3 — Inserción y bloques especiales (L)

- Alcance: menú buscable `/` y `+` con los mismos comandos; selector de lenguajes y copiar código; cuadrícula inicial de tabla, enlaces, imágenes persistentes y callouts GitHub. Dividir en PRs por bloque.
- Dependencias: Fases 1–2; gramáticas/resaltador existentes; política de imágenes antes de importar binarios.
- Riesgos: activar `/` en rutas, URLs o bloques de código; romper indentación/fences; rutas temporales o recursos faltantes.
- Aceptación: activar solo en un contexto permitido mediante el árbol sintáctico, cerrar con Escape y devolver foco; imagen disponible tras reinicio/Guardar como; tabla dentro de las limitaciones GFM.
- Pruebas: rutas/URLs/código no disparan menú; búsqueda por teclado; los ocho lenguajes; fences anidados; escapes/alineación de tablas; portapapeles no confiable; imágenes relativas y exportación sin conexión.
- Beneficio: descubrir e insertar bloques con formularios breves y ejemplos.

### Fase 4 — Prueba de modo visual y preservación (XL, puerta de decisión)

- Alcance: prototipo aislado con corpus; elegir una ruta visual, no instalar dos stacks de producción. Solo después integrar edición de párrafos, listas y tablas por etapas.
- Dependencias: Fases 1–3 y documento/historial coherente; investigación Milkdown/TipTap/CodeMirror.
- Riesgos: normalización destructiva, pérdida de extensiones, doble undo, accesibilidad/IME y peso.
- Aceptación: corpus exacto al alternar sin editar; contenido desconocido conservado; cambios locales reversibles y una única autoridad del documento. Si falla, no migrar.
- Pruebas: comparación exacta antes/después, edición de un bloque, guardar/reabrir, recuperación tras caída, IME, teclado, lectores de pantalla y medición del bundle real.
- Beneficio: edición visual verdadera sin sacrificar archivos de usuarios avanzados.

### Fase 5 — CSV de hoja de cálculo ligera (L, PRs M)

- Alcance: decidir con prototipo si TanStack ampliado o Tabulator reduce trabajo sin romper el motor paginado; después rangos/teclado, insertar/mover, filtros avanzados y orden múltiple. Diagnósticos y limpieza con preview; JSON y tabla Markdown en PRs separados. XLSX aplazado hasta justificarlo.
- Dependencias: Fase 1; IDs estables y contrato paginado; no reemplazar csv-parse/stringify/iconv por el parser de una grilla.
- Riesgos: cargar todo el archivo en renderer, conversión automática, dos órdenes/historiales, pérdida de encabezados duplicados en JSON.
- Aceptación: mover físicamente distinto de ordenar vista; filtros combinados definidos; preview cancelable con revisión esperada; importar sin conversiones; exportar cada alcance explícito.
- Pruebas: ceros, IDs largos, comillas, multilinea, vacíos/ausentes, BOM/EOL y codificaciones, encabezados duplicados, orden estable múltiple, clipboard con vista filtrada, límites y consumo de memoria.
- Beneficio: manipular datos sin editar comas ni exponer filas equivocadas.

### Fase 6 — Galería y asistencia Mermaid (M/L)

- Alcance: primero último render válido y errores comprensibles; luego flowchart, sequence, class, ER, Gantt, state, mindmap, pie y journey, cada uno validado con Mermaid instalada. Asistentes específicos por tipo; copiar imagen con APIs existentes.
- Dependencias: renderizador/exportación actuales; Fase 3 para los mismos bloques dentro de Markdown.
- Riesgos: mostrar/exportar un SVG antiguo como actual, IDs duplicados, fechas/escapes inválidos y asistentes que no corresponden al tipo.
- Aceptación: nombre, descripción, miniatura y ejemplo editable por plantilla; comandos generan sintaxis válida; error conserva código y distingue preview antigua; exportación inválida se bloquea o requiere decisión explícita adecuada.
- Pruebas: parse/render de las nueve plantillas, cada asistente, errores iniciales e intermedios, edición rápida/tema, SVG/PNG/PDF y bloques Markdown. No asumir que un resultado Mermaid puede llamarse validado sin renderizarlo en la versión instalada.
- Beneficio: crear diagramas con ejemplos y formularios, conservando edición técnica.

### Fase 7 — Experiencia integrada y optimización (M/L, transversal)

- Alcance: foco/pantalla completa, scroll por bloques, copiar renderizado; auditoría de teclado/lectores y mediciones de rendimiento. Accesibilidad se aplica desde cada fase, no se difiere toda hasta aquí.
- Dependencias: flujos de las fases anteriores y corpus reproducible.
- Riesgos: optimizar sin medir, atajos conflictivos, pruebas de capturas usadas como certificación de accesibilidad.
- Aceptación: controles comunes estables entre tipos, temas y resoluciones; cancelar trabajos largos; latencia/memoria documentadas por equipo y tamaño, sin garantías universales.
- Pruebas: teclado sin ratón, IME, lector, zoom de interfaz, capturas 1280×800/1440×900 y contraste; archivos sintéticos de 50 MiB y muestras mayores; arranque/filtrado/orden/memoria con equipo identificado.
- Beneficio: comportamiento consistente para principiantes y usuarios técnicos.

## 9. Primera iteración recomendada

**F01: que el alcance de exportación CSV coincida con lo que dice el menú.** Complejidad S; no requiere migración, librerías nuevas ni cambios del formato de recuperación.

Modificar solo `CsvTable.exportOptions` y sus pruebas/caller documental: «Documento completo» exporta todos los valores en orden original, ignorando búsqueda/filtros/selección; «Filas filtradas» aplica búsqueda/filtros/orden y conserva todas las columnas; «Selección» conserva la limitación explícita de filas/columnas. No cambiar la semántica interna del motor para clientes que soliciten columnas explícitas.

Validación: reproducir el fallo por UI, añadir regresión con campo multilínea, comillas, ceros iniciales, filtros/orden activos y una columna marcada; verificar CSV y TSV fuera de la app, selección explícita, dirty y archivo original. Ejecutar `check`, unitarias, E2E/build y CI del PR. Preparar PR sin fusionarlo; no generar instaladores ni actualizar alpha.1 en esta entrega.

## 10. Resultado de la primera iteración

Implementación en `codex/editor-ux-audit`, pendiente de revisión e integración. Se modifica únicamente la preparación de opciones en `CsvTable.exportOptions`: filas/columnas marcadas solo se envían para `scope=selection`. El motor, contratos, parser, datos originales, dependencias e instaladores no cambian.

Prueba de regresión por la interfaz: filtro global y orden numérico activos, una columna y una fila marcadas, modificación sin guardar, comillas escapadas, campo multilínea CRLF y ceros iniciales. Se comprueban seis exportaciones: completo/filtrado/selección en CSV y TSV. La prueba falló antes de la corrección por columnas omitidas y pasó después. El archivo original y el indicador de cambios pendientes se mantienen.

Validación local (macOS 27.0.1 arm64; Node.js 24.22.0): `npm run check` sin errores/advertencias; `npm test` con 32 pruebas satisfactorias; `npm run test:e2e` con 21 satisfactorias, incluida construcción mediante `npm run build`; `git diff --check` sin incidencias. La CI del PR debe informar por separado los resultados de Ubuntu, Windows y ambas arquitecturas de macOS. Los controles locales no acreditan esos entornos.

F01 queda corregido en esta rama. Los demás hallazgos, el modo visual y el catálogo ampliado siguen pendientes; esta iteración no los presenta como implementados ni verificados. No se fusiona automáticamente y no se publica una versión descargable.
