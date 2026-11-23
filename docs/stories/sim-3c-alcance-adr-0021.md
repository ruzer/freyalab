# SIM-3c · Menús, barra de estado y explorador

Base `main f227`, con #209, #210 y #211 fusionados. Rama independiente `codex/sim-3c-menus-estado`; un PR en borrador, base main. La historia común se conserva íntegra en [historia-sim3-resultados-correctos-diseno-para-codex.md](historia-sim3-resultados-correctos-diseno-para-codex.md): 12.204 bytes, SHA-256 `5cb91ab53325d41d911668b9bb2bf3bcdc0740c6f1ca12ea17435f7f2b16c0a9`.

## Cambio mínimo completo

Solo los cuatro puntos de SIM-3c:

1. **Menús superiores accesibles.** La barra superior tiene z-index 20 y la barra CSV, 30: el dropdown superior queda dentro de la capa inferior aunque su propio z-index sea mayor. Subir solo la barra superior a 40, manteniendo diálogos en 100 y menús contextuales en 2000. Probar el elemento real bajo el centro de cada acción de Nuevo y Exportar; no basta comparar valores CSS.
2. **Contadores con singular y plural.** Corregir «1 celdas», «1 filas seleccionadas» y revisar los demás contadores visibles de la barra: «1 de 1 filas» y «1 filas × 1 columnas» en el desplegable de limpieza. Reutilizar `plural()` y los formatos compartidos, con frases completas es/en y su en-XA. Las cantidades y el alcance de las operaciones no cambian.
3. **Estado del documento activo.** Un CSV publica sus recuentos en una cadena global que no se restablece al activar Markdown, texto o diagrama. Asociar ese estado al documento/vista que lo emite y restablecerlo al cambiar la activación, sin ocultarlo meramente con CSS. Conservar las guardias existentes de solicitud/desmontaje y los mensajes de apertura, errores y notificaciones; una respuesta anterior no puede volver a publicar filas del CSV sobre otro documento. La vuelta al CSV conserva su recuento y sus filtros.
4. **Explorador alineado.** La regla general de botón centra los hijos flex de `.tree-item`; `text-align:left` no corrige esa distribución. Alinear el bloque a la izquierda manteniendo los iconos, chevrons y la sangría de cada nivel. Los nombres del mismo nivel deben empezar en la misma x, sin imponer coordenadas nuevas ni rediseñar el árbol.

La revisión de «Hoy» se hizo sobre la fuente actual: las cuatro causas siguen presentes. El portal inferior ya retira sus nodos al desmontarse y `CsvTable` ya invalida solicitudes anteriores; se reutilizan, no se sustituyen por un sistema nuevo.

## Siete respuestas ADR 0021

El ADR original está en `LAB/docs/adr/0021-reuse-before-build.md`, decisión 3. Se conservan sus siete preguntas exactas; las herramientas de desarrollo no pasan a ser dependencias de FreyaLab.

1. **Does a tool already do this?** Sí: CSS flex y capas, el estado reactivo de Svelte, App, CsvTable, Tree y las funciones `plural()`/`formatNumber()` ya resuelven estas piezas. Se configuran y conectan; no se añade un gestor de menús, árbol o biblioteca de interfaz.
2. **Is there a skill we can reuse?** Ponytail para el cambio mínimo completo; TDD, accesibilidad y E2E para la implementación y revisión. El preflight aplicó Ponytail delimitando cuatro causas y reutilizando sus consumidores. Las pruebas rojas deben registrarse antes de modificar cada conducta. Ninguna de estas herramientas se incorpora al producto.
3. **Can it be integrated through CLI, API, or MCP?** La integración usa CSS, props y estado ya existentes. No necesita CLI, API remota, IPC nuevo ni MCP en ejecución. Las comprobaciones usan Playwright y las ayudas instaladas.
4. **How mature, secure, and maintained is it (release cadence, maintainers, license)?** Se conservan las versiones y licencias instaladas de Svelte, TypeScript y Playwright; no hay una adopción nueva que investigar. Mantener la prioridad de los diálogos y las fronteras existentes del menú contextual. Sin red, HTML arbitrario ni permisos nuevos.
5. **What maintenance cost does it add?** Sobrescrituras CSS acotadas, frases plurales y pertenencia del estado al documento, con pruebas de esos cuatro comportamientos. Sin preferencias nuevas, detector, registro genérico de acciones ni segundo almacén permanente.
6. **What is the minimum glue LAB must write?** En FreyaLab: corregir capa y alineación, reutilizar traducciones/formatos y vincular el mensaje de CSV con su documento activo. Preservar los tokens de solicitud y desmontaje actuales; no cambiar main, preload ni el motor CSV.
7. **Does writing our own code add value?** Sí, únicamente el enlace local que impide menús tapados y mensajes de otro documento. La plataforma instalada sigue resolviendo layout, idiomas y reactividad; no se reimplementan sus capacidades.

## Rojo primero y consumidores

- E2E a 1440×900 y 1280×720: Nuevo y Exportar abiertos; cada acción visible supera el hit testing y permanece en la ventana. Para el selector nativo de Contenido se comprueba el control y sus valores, no una caja DOM inexistente de una opción nativa.
- Singular/plural: una y dos celdas; una y dos filas seleccionadas; una fila total; una fila por una columna en el desplegable. Casos es/en y comprobación de en-XA. Reutilizar las pruebas de paridad de catálogos y formas `.one/.other`.
- Estado: CSV → Markdown/TXT/MMD y vuelta; CSV Texto y Análisis conservan el estado de su vista. Una respuesta real retenida/liberada no debe contaminar el destino. No inventar respuestas ni considerar roja una protección que ya funciona.
- Árbol: nombres cortos/largos y Unicode, archivos y carpetas del mismo nivel, segundo nivel, expansión y navegación contextual. Medir la x del nombre con tolerancia de subpíxel; conservar iconos y sangría.
- `tests/e2e/ui.spec.ts:163` espera hoy «1 filas × 1 columnas». Se adaptará solo esa expectativa al singular correcto. Permanecen las mismas filas y aserciones de limpieza, deshacer, rehacer y guardado; no se borra el caso.
- Los archivos sintéticos conservan ceros iniciales, identificadores largos, bytes, revisión y estado de edición. No cambian datos, orden, filtros ni el contenido exportado.

Capturas antes/después: claro y oscuro, es y en-XA, 1440×900 y 1280×720. Esperar condiciones de tema, fuentes, foco y layout, sin pausas fijas ni clics forzados que oculten capas. Reutilizar `closeElectron` y `traceElectronFailure`.

Durante cada bloque, pruebas enfocadas; al cierre por tocar archivos compartidos, `npm run check`, unitarias completas, E2E completa y `npm run build`. CI del SHA final en las tres plataformas, con duración de cada job de Windows y reintentos informados. Este documento aún no declara pruebas nuevas ejecutadas ni aprobadas.

## Límites

No se amplían SIM-3a, SIM-3b, SIM-3d ni SIM-3e. Sin dependencias, cambios de CI, plazos, reintentos, guardado, motor CSV o exportaciones. Sin nuevas preferencias ni modificaciones de Edición nativo.

No existe un alcance preciso nuevo de contraste que añadir a esta entrega: se conservan los colores/tokens y los contratos históricos de U0/E1. La dependencia opcional de contraste de la historia no autoriza una paleta nueva ni una auditoría general. Se comprobará que la entrega no produzca regresiones visibles.

Sin fusión, publicación ni actualización de la app instalada.
