# SIM-1e · Proyecto desde el CSV abierto

Con la pestaña de archivo de un CSV/TSV guardado y limpio seleccionada, Nuevo proyecto ofrece marcada «Añadir «nombre.csv» como primera fuente». Crear abre el diálogo de fuente existente, con la ruta elegida y columnas detectadas. El registro y la huella siguen requiriendo la confirmación de la persona. Desmarcar la casilla crea el proyecto sin fuentes; Cancelar conserva el comportamiento actual.

Inicio incorpora una cuarta tarjeta y Nuevo una entrada de proyecto. Tarjeta, menú Nuevo, lateral y menú nativo usan el mismo abridor. La candidata es efímera; no se guarda, copia, mueve ni registra automáticamente el archivo. Los documentos con cambios, sin ruta, no CSV, las pestañas de análisis y los subconjuntos analíticos no ofrecen candidata.

## Base y alcance

Rama `codex/sim-1e-proyecto-desde-csv`, creada desde `origin/main 0260a5d05341e98a8ea97d5ced7330aa97f413c4` tras fetch explícito. El primer commit `529f9ac817398ebbd986952859b03af0782201e1` registra [alcance y siete respuestas del ADR 0021](../stories/sim-1e-alcance-adr-0021.md). La historia conserva SHA-256 `c0e45fd395cb147f9a278699b9f45c9a6da93f88a0ab72d87b91e7155afd257f`.

El commit de función es `2348221296675469f730af7260fbdd587b9e61bf`. Cambia cuatro fuentes: App, ProjectDialog y los catálogos es/en; en-XA usa el generador vigente. Main, preload, IPC, motores, parser, ProjectSourceDialog, manifiesto, permisos, protección, cancelación, límites, exportación y dependencias permanecen intactos. `prepareDocumentAction`, `addProjectSource` y `receiveProject` conservan sus cuerpos anteriores.

Después se incorpora `main 39c2000936f1b03c00daee45bc0a257132fb26ab` mediante merge normal sin conflictos. El head de fuente validado es `aba1415129a2389318d708b8264672d6a3a15220`, con padres `2348221` y `39c2000`. Frente a ese main, los catálogos añaden exclusivamente `project.firstSource` y `project.startDescription`: no se traducen los textos anteriores de App que siguen pendientes ni se rediseña el centrado del modal.

Se transportan id/ruta/nombre del archivo elegido. Después de crear, se cierra un modal antes de abrir el siguiente, se obtiene el proyecto canónico mediante las APIs existentes y se prepara la fuente con su ruta explícita. No se interpreta `projectCreate():Promise<void>` como ProjectInfo ni se espera que el helper void de fuente represente una operación terminada. Los errores de preparación siguen el canal existente; un fallo posterior a la creación deja el proyecto creado y sin fuente, sin rollback inventado.

## Rojo, verde y revisión

Raíz ejecutó **dos rojos representativos** sobre fuente de main sin interfaz E y build nuevo: el CSV limpio no mostraba la casilla; Inicio en español tenía tres tarjetas cuando se esperaban cuatro. Los otros siete casos nuevos **no se ejecutaron en rojo**. Las capturas iniciales de esa base pasaron 2/2 en 3.3 s y produjeron dieciséis imágenes.

El primer candidato pasó los nueve casos nuevos en 9.9 s, sin reintentos, con App SHA-256 `e218a68e6e9a8b4df4e203ae613093414bcde352e574f19fe3ee0616d414ccbf`. Cubren CSV interno, TSV externo y aviso, ruta explícita sin segundo selector, confirmación manual, huella independiente y bytes originales; cancelación y desmarcar; exclusiones de contexto y edición de celda pendiente; entradas en es/en/en-XA; cambio de disco después de preparar el draft; y proyecto futuro sin sobrescribir sus bytes.

La fuente final incorpora dos precisiones de revisión estática: los controles id/ruta/dirty del traspaso se hacen después de recibir el proyecto canónico; al abrir se captura la ruta como escalar antes de preparar la edición y se exige la misma ruta al terminar esa espera, además de la misma pestaña y documento. Se reutilizan los mensajes existentes. **No se presenta esta última guarda como una carrera reproducida en GUI.** App final SHA-256: `f4f1ec4e152dd335e1647907ffcdd4daa32d50f3fe76176fa2674207a26a48a4`. El verde del primer candidato, la integral privada y el cierre tras merge se informan por separado. Raíz y Standards revisaron `aba1415` con cero hallazgos pendientes.

## Fixtures y consumidor heredado

Las dos fixtures nuevas son sintéticas. El CSV usa `;`, CRLF, encabezados duplicados y vacío, Unicode, un entero superior al seguro de JavaScript, ceros iniciales, un espacio y una celda multilínea. El TSV usa tabulador, LF, ceros iniciales y una celda con tabulador entre comillas. Los oráculos de filas/encabezados se comprobaron independientemente con Python CSV; la huella esperada en E2E se calcula desde sus bytes con Node crypto.

| Archivo | SHA-256 |
| --- | --- |
| `project-from-open.csv` | `7101ed363dfac344f96ff4e6ad8925e7b3787fa55b53a8c7d17f42377494d20a` |
| `project-from-open.tsv` | `8a63f5149fda4396a967be726d2b0ee0f4d20c895cc86013c7d3b9e671a25f19` |
| Spec público de nueve casos | `4b3fa91a8372f2170cd6acdbecc1a59b5f7d751c3109a4d9871fb127af5e9c1a` |

Dos entradas `-text` en los atributos de Git protegen exclusivamente estas fixtures. Los blobs y una extracción con `core.autocrlf=true` conservaron exactamente sus bytes. Esa comprobación no es una ejecución nativa en Windows. El chequeo de diferencias pasa con `core.whitespace=cr-at-eol`; el chequeo genérico marca los CRLF intencionales del CSV.

Se adapta **un consumidor heredado**: «una muestra conserva su alcance al protegerla y al cerrar el proyecto», en `project-source.spec.ts`. Ese caso vuelve a la pestaña del CSV y necesita un proyecto vacío antes de su registro manual. El helper local admite desmarcar la primera fuente usando una etiqueta traducida con el nombre original del documento; solo ese caller opta por ello. Tras el merge, frente a main39c2, el helper está en la línea 32, la nueva desmarcación en la 38 y el caller pasa de la 218 a la 219. Los otros cinco callers conservan su comportamiento.

El helper de registro manual, las fixtures anteriores, los datos, aserciones y parámetros de datos, protección/alcance, títulos y plazos permanecen idénticos. El ledger por línea, los hashes antes/después y la comparación AST quedan en evidencia privada. No se cambia ningún helper global ni panel de análisis.

## Comprobaciones realizadas y pendientes

macOS, Node `24.22.1`, Pandoc real `3.12.1`. Raíz es la única ejecutora GUI.

| Comprobación | Resultado y fuente |
| --- | --- |
| Rojos previos | Dos fallos representativos sobre main0260/scope529 y build nuevo; no nueve rojos. |
| E2E del primer candidato | 9/9 en 9.9 s, sin reintentos, App `e218a68e…`; anterior a las precisiones estáticas finales. |
| Tipos finales de E | Cero errores y advertencias, 8.28 s, fuente del commit `2348221`. |
| Unitarias completas finales de E | 167 archivos, 2972 aprobadas y una omisión de la prueba específica de Windows, 16.27 s; Node/Pandoc reales indicados arriba. |
| Build final de E | Nuevo y correcto, 1.66 s. |
| Integración privada de cierre | `f8906fb94f06e5d06e71c4233a6923169f642a0a`: combina E `2348221`, C `225048c` y D `de92524`, sin conflictos y sin publicar. Comprobaciones siguientes ejecutadas por raíz sobre ese mismo head. |
| Tipos de la integración | Cero errores y advertencias, salida 0, 8.19 s. |
| Unitarias de la integración | 2987 aprobadas y una prueba exclusiva de Windows omitida en macOS; salida 0. Vitest: 16.50 s; proceso: 16.79 s. |
| E2E completa de la integración | `npm run test:e2e -- --workers=1 --retries=0`, salida 0. El reporte indica **782 passed** en 27.4 min; proceso de 1646.8 s. **Incluye SEG-S2e como fallo esperado mediante `test.fail`, no 782 verdes ordinarios.** |
| Build de la integración | `npm run build`, salida 0, 2.07 s. |
| Tipos del cierre E tras merge | Head `aba1415`, cero errores y advertencias; 9.31 s. |
| Unitarias completas del cierre E | Head `aba1415`, 167 archivos, 2972 aprobadas y una prueba exclusiva de Windows omitida en macOS; salida 0. Vitest: 16.92 s; proceso: 17.23 s. No se usa aquí el conteo de la composición con D. |
| Build del cierre E | Head `aba1415`, salida 0; 1.91 s. |
| E2E enfocadas del cierre E | Head `aba1415`, `project-from-csv`, `project-source` y `menu-alignment`: 18/18, sin reintentos. Reporte: 26.3 s; proceso: 26.89 s. |
| Capturas posteriores finales | Head `aba1415`, 2/2; reporte 3.4 s y proceso 3.86 s. Dieciséis PNG finales, hashes y dimensiones verificados. |
| SHA de publicación, CI y fusión | **SHA de publicación pendiente**; también la publicación y CI de E. La integración privada no se publica como head combinado. Esta documentación no acredita paquete, instalador ni app instalada. Las fusiones corresponden al propietario. |

SEG-S2e conserva una limitación real, marcada de antemano con `test.fail`. Su fallo esperado queda contabilizado por Playwright dentro del reporte satisfactorio; **la limitación no está resuelta**. Los comandos, head, códigos de salida y tiempos de proceso constan en el `run.json` privado de la integración; los logs y el reporte crudo conservan el resultado observado.

`f8906fb` y `aba1415` son composiciones distintas: D aún no está fusionado en main. La comparación Git encuentra diecisiete diferencias de producto/pruebas, todas correspondientes a D, además de sus treinta y siete archivos documentales. App, ProjectDialog, el spec nuevo, el consumidor de fuente, las fixtures E y sus atributos son idénticos entre ambas composiciones. Esto no afirma equivalencia total ni transfiere las 782 del reporte integral al head de E; el cierre propio de `aba1415` es el indicado en sus filas.

Los logs crudos, informes, traces, manifests y hashes de ejecución se conservan privados. Las pruebas instrumentan respuestas reales del puente y usan el mecanismo existente de carpetas de prueba; no se atribuye a ellas una validación manual del selector del sistema ni del acelerador físico del menú.

## Capturas iniciales y finales

Se versionan **treinta y dos imágenes**: dieciséis iniciales de main0260 sin interfaz E y dieciséis finales de `aba1415`. Cubren Inicio y Nuevo proyecto, es/en-XA, claro/oscuro, 1440×900/1280×720. Las copias coinciden por SHA-256 con los originales y sus dimensiones PNG coinciden con los tamaños indicados. El [manifest público](sim1e-evidencia-2026-11-19.json) registra fuentes, resultados, hashes y dimensiones sin rutas privadas.

| Idioma | Tema | Tamaño | Inicio antes | Inicio después | Proyecto antes | Proyecto después |
| --- | --- | --- | --- | --- | --- | --- |
| es | Claro | 1440×900 | [Antes](sim1e-before-welcome-es-light-1440x900.png) | [Después](sim1e-after-welcome-es-light-1440x900.png) | [Antes](sim1e-before-project-es-light-1440x900.png) | [Después](sim1e-after-project-es-light-1440x900.png) |
| es | Oscuro | 1440×900 | [Antes](sim1e-before-welcome-es-dark-1440x900.png) | [Después](sim1e-after-welcome-es-dark-1440x900.png) | [Antes](sim1e-before-project-es-dark-1440x900.png) | [Después](sim1e-after-project-es-dark-1440x900.png) |
| es | Claro | 1280×720 | [Antes](sim1e-before-welcome-es-light-1280x720.png) | [Después](sim1e-after-welcome-es-light-1280x720.png) | [Antes](sim1e-before-project-es-light-1280x720.png) | [Después](sim1e-after-project-es-light-1280x720.png) |
| es | Oscuro | 1280×720 | [Antes](sim1e-before-welcome-es-dark-1280x720.png) | [Después](sim1e-after-welcome-es-dark-1280x720.png) | [Antes](sim1e-before-project-es-dark-1280x720.png) | [Después](sim1e-after-project-es-dark-1280x720.png) |
| en-XA | Claro | 1440×900 | [Antes](sim1e-before-welcome-en-XA-light-1440x900.png) | [Después](sim1e-after-welcome-en-XA-light-1440x900.png) | [Antes](sim1e-before-project-en-XA-light-1440x900.png) | [Después](sim1e-after-project-en-XA-light-1440x900.png) |
| en-XA | Oscuro | 1440×900 | [Antes](sim1e-before-welcome-en-XA-dark-1440x900.png) | [Después](sim1e-after-welcome-en-XA-dark-1440x900.png) | [Antes](sim1e-before-project-en-XA-dark-1440x900.png) | [Después](sim1e-after-project-en-XA-dark-1440x900.png) |
| en-XA | Claro | 1280×720 | [Antes](sim1e-before-welcome-en-XA-light-1280x720.png) | [Después](sim1e-after-welcome-en-XA-light-1280x720.png) | [Antes](sim1e-before-project-en-XA-light-1280x720.png) | [Después](sim1e-after-project-en-XA-light-1280x720.png) |
| en-XA | Oscuro | 1280×720 | [Antes](sim1e-before-welcome-en-XA-dark-1280x720.png) | [Después](sim1e-after-welcome-en-XA-dark-1280x720.png) | [Antes](sim1e-before-project-en-XA-dark-1280x720.png) | [Después](sim1e-after-project-en-XA-dark-1280x720.png) |

Raíz inspeccionó visualmente tres finales: modal en-XA oscuro a1280×720, Inicio es claro a1440×900 e Inicio en-XA oscuro a1280×720. Encontró las acciones nuevas y la casilla visibles; el modal inspeccionado cabe. No se atribuye a estas muestras una inspección manual de los treinta y dos estados.

Las dieciséis posteriores antiguas (2/2 en 3.9 s) se mantienen archivadas en privado como **provisionales históricas**, fuera del manifest y de las imágenes finales versionadas. El SHA de publicación y su CI siguen pendientes del cierre documental y la publicación de raíz.
