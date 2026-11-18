# SIM-2f · SQL claro: alcance y reutilización

Base: `d17cc81cd279f3e8a0938077d0b8d55294f05e83`. La historia completa se conserva sin cambios en `historia-sim2-analisis-graficos-diseno-para-codex.md`. Sus decisiones del propietario del 2026-11-18 están aprobadas. La entrega se limita a SIM-2f, que la historia permite adelantar a SIM-1.

## Alcance antes de implementar

Se simplifica `CsvSql.svelte`: una línea de solo lectura, alcance y límites plegados, fichas de columnas que insertan identificadores SQL escapados, acción principal y atajo de ejecución según el sistema, estados iniciales y de resultados honestos y catálogo completo es/en/en-XA. Se conservan asistentes, archivos adicionales, paginación, informes, estados de carga, cancelación y avisos de resultados parciales. Los valores, consultas y límites no cambian.

No se cambia el motor, el servicio SQL, el IPC, el guardado ni las fuentes originales. No se adelanta la cabecera/exportación común de SIM-2a ni las otras partes de SIM-2. La historia original se copia ahora porque SIM-2f es la primera parte preparada; SIM-2a podrá reutilizar esa copia.

Interfaces de prueba prescritas por la historia: sección SQL real (texto inicial, ayuda, fichas, botón, atajo, cambios tras ejecutar y traducciones), y la inserción en CodeMirror con selección real, foco y deshacer. Se reutilizan `sqlColumns` y `quoteIdentifier`; no se construyen identificadores mediante concatenación sin escapar.

`Editor.svelte` expone acciones de formato pero no inserción libre. Antes de tocarlo se coordina una API mínima `insertText(value)` con el responsable de la rama de estabilidad: una transacción de CodeMirror, guardas de solo lectura/IME y retorno de foco. No se duplicará el editor ni se accederá a sus detalles privados desde SQL.

## Siete respuestas del ADR 0021

1. **Does a tool already do this?** Sí: `Editor`, `sqlColumns`, `quoteIdentifier`, `controlHint`, `t` y los formatos compartidos ya resuelven edición, identificadores, motivos y traducción. El trabajo es conectar esas piezas con la disposición aprobada.
2. **Is there a skill we can reuse?** Se aplican Ponytail para limitar la adaptación, TDD para comprobar la conducta antes de implementarla, y accesibilidad/E2E para controles nativos, foco, anuncios y esperas por estado. No se introduce otro patrón de formularios ni un sistema de pruebas.
3. **Can it be integrated through CLI, API, or MCP?** La interfaz usa exclusivamente las operaciones tipadas `sqlRun`, `sqlPage` y `sqlCancel` existentes. La ficha usa la API acotada del componente de edición. No añade CLI, red ni canales IPC.
4. **How mature, secure, and maintained is it (release cadence, maintainers, license)?** Se conservan las versiones y licencias del lockfile de Svelte, CodeMirror y DuckDB-Wasm. La consulta mantiene aislamiento, validación, solo lectura, límites, cancelación y recursos locales. No hay nueva dependencia ni evaluación de motor.
5. **What maintenance cost does it add?** Una acción mínima de inserción reutilizable y las claves necesarias del catálogo. Se elimina texto duplicado a la vista sin quitar su ayuda ni validaciones; el estado sigue perteneciendo al componente existente.
6. **What is the minimum glue LAB must write?** En FreyaLab: mover la ayuda a un `details`, representar las columnas como botones, insertar el identificador escapado y presentar estados/traducciones. LAB no se modifica.
7. **Does writing our own code add value?** Solo la conexión con el flujo de FreyaLab: los usuarios pueden descubrir columnas y ejecutar sin leer límites técnicos antes. No se reimplementan SQL, formatos, edición, estadísticas ni controles de accesibilidad.

## Validación y límites de la entrega

Rojo previo por la conducta nueva; E2E enfocadas de SQL y sus consumidores, tipos, unitarias y construcción. La integración ejecutará las suites y CI exigidas sobre el head final. Capturas de la sección en claro/oscuro, es/en-XA y 1440×900/1280×720. Los resultados locales, CI, fusión e instalación se informarán por separado; no se fusiona ni se publica automáticamente.

Accesibilidad requerida al traducir SQL: el nombre accesible del mismo editor debe actualizarse al cambiar el idioma, conservando documento, selección e historial. Se comprueba es → en → es mediante la operación de idioma existente. El ajuste mínimo es un `Compartment` de atributos de CodeMirror y su reconfiguración al cambiar `label`; no se recrea el editor ni se escriben atributos por fuera de CodeMirror. Se coordina dentro del mismo perímetro de `Editor.svelte`; no añade capacidades del producto ni IPC.
