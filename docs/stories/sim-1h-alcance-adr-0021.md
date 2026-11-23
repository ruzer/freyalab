# SIM-1h · Alcance y ADR 0021

Base `main 6e70d54995a8975ce234cd1a759a46b3d72d385e`, tras la fusión de #206 por el propietario. Rama `codex/sim-1h-menus-contextuales`, worktree independiente. Historia actualizada conservada sin modificar: SHA-256 `f4e8944cfb4c948d68913cf413ccb1aea3042516707593823ad0d6d730851209` (21.662 bytes, 214 líneas). El original temporal ya no existe: se recuperó literalmente de su lectura anterior en esta conversación y se verificó contra la huella previamente registrada, sin reconstruir el contenido.

## Cambio mínimo completo

Unificar los menús de celda/rango, fila, texto, pestaña y Archivos con `ContextMenu.svelte`, conservando los comandos, guardas y confirmaciones actuales. Reutilizar el submenú y las filas de 30 px de columna, el formato de atajos, el encaminamiento de Edición y la revelación nativa confinada. Retirar únicamente las opciones duplicadas que la historia traslada a sus controles existentes; probar que las 22 acciones anteriores siguen alcanzables. No cambiar Proyecto, motor CSV, persistencia, límites, exportación ni CI.

El hallazgo 8 sigue vigente. Los seis componentes implicados coinciden con la línea base nativa ya observada: celda/rango y fila son listas planas propias; texto, pestañas y carpetas carecen de menú propio. La medición precisa es 33,5 px por fila frente a 30 px en columna; los 34 px de la historia son redondeados. Se reutiliza esa evidencia, sin repetir la auditoría.

## Siete respuestas ADR 0021

1. **¿Existe una herramienta?** Sí: `ContextMenu.svelte`, el submenú de columna, `formatApplicationShortcut`, `routeApplicationEdit`, `MenuNativeEdits` y `shell.showItemInFolder` ya resuelven las piezas. Sin biblioteca nueva.
2. **¿Qué método se reutiliza?** Adaptar las acciones existentes, con pruebas rojas de listas, geometría, teclado y comportamiento real antes de modificar cada bloque. No crear otro motor de comandos ni portapapeles.
3. **¿Cómo se integra?** Mismos componentes y comandos. Para texto, un enlace limitado al encaminamiento de Edición existente; para revelar, el proceso principal resuelve el documento por id o valida la ruta dentro de la carpeta actual. No se expone ejecución, shell arbitrario ni acceso genérico al portapapeles.
4. **¿Madurez, seguridad y licencia?** Se conservan las versiones y licencias instaladas. Se validan mensajes y remitente en el puente existente; los permisos acumulados para abrir no sustituyen el confinamiento al explorador actual. Se prueban traversal, enlaces simbólicos y referencias obsoletas. Sin red.
5. **¿Qué mantenimiento añade?** El componente compartido sustituye el menú manual de rango/fila. Las etiquetas nuevas van al catálogo es/en/en-XA; los motivos de bloqueo, edición nativa y cierres siguen teniendo una única implementación.
6. **¿Cuál es el pegamento mínimo?** Adaptadores de los menús, grupos y textos; dos entradas limitadas para Edición y revelación si las API existentes no admiten esas invocaciones. Tipos y pruebas de frontera junto a las entradas. No un registro genérico de acciones ni rutas privilegiadas suministradas sin validar.
7. **¿Qué valor aporta código propio?** Hace que el mismo gesto tenga las mismas opciones, estructura y teclado en toda la app. El código propio conecta piezas ya maduras y conserva las fronteras de seguridad; no reemplaza funcionalidades existentes.

## Decisión del propietario y validación

- Sin selección, Cortar/Copiar se desactivan **solo en el nuevo menú contextual**. El menú de aplicación Edición conserva su conducta actual. En solo lectura, Cortar/Pegar se bloquean como hoy. Esta decisión matiza la frase de la historia sobre igualar la disponibilidad de Edición.
- Pruebas rojas primero: listas exactas y separadores es/en-XA, clic derecho/Mayús+F10/tecla de menú, igualdad de alturas, submenú, foco, 22 acciones alcanzables, portapapeles real y cierre con cambios.
- Pruebas de frontera para revelar; atajos macOS/Windows desde el formateador existente. Ninguna ruta de documento se obtiene de texto libre del renderer.
- Capturas antes/después en claro y oscuro, es/en-XA, 1440×900 y 1280×720. Evidencia real y límites se completan durante la implementación; este documento no declara ninguna prueba nueva aprobada.
- Pruebas enfocadas por bloque; check, unitarias completas, build e integral al cierre. La CI del head final debe acreditar las tres plataformas. La CI de main tras #206 sigue en curso al iniciar esta entrega y cualquier fallo real tiene prioridad.
- Un PR en borrador, base main. Sin fusión, publicación ni actualización de la app instalada.
