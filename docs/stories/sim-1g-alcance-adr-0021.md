# SIM-1g · Alcance y ADR 0021

Base `main fd4e2a46845de95d7f7274f52fbd26cb0f63fcbc`, después de la fusión de #180 por el propietario. Rama `codex/sim-1g-menus-izquierda`, worktree privado. Historia original copiada sin cambios: SHA-256 `767ade59a0c705f37eab2d8e3ad805a402f44250dfe999a83d1f139e3e4dc446`.

## Cambio mínimo completo

Reutilizar para los demás menús la alineación izquierda que `ContextMenu.svelte` ya aplica a Proyecto y Archivos. Alcance visual: elementos de `role="menu"`, `.range-context`, los desplegables de la barra y Nuevo, incluidos títulos de grupo. Mantener acciones, orden, iconos, atajos, foco, motivos de bloqueo, tamaños y confirmaciones actuales. No implementar ninguna otra parte de SIM-1 ni cambiar datos, motor, contratos, guardado o exportaciones.

La causa está en `button { display:inline-flex; justify-content:center }`: `text-align:left` de `.dropdown button` y `.range-context button` no cambia la distribución flex. Se centraliza la regla que ya existe en ContextMenu, sin crear otro componente ni un registro de acciones.

## Siete respuestas ADR 0021

1. **¿Existe una herramienta?** Sí: el CSS de `ContextMenu.svelte` ya resuelve la alineación para Proyecto y Archivos; los menús existentes aportan el resto de su comportamiento. No se añade una biblioteca.
2. **¿Qué método se reutiliza?** Cambio mínimo, prueba roja de la geometría visible mediante DOM Range y comprobaciones de teclado existentes. La interfaz pública de prueba son los menús reales de Nuevo y de una columna.
3. **¿Cómo se integra?** Compartiendo la regla de alineación entre los menús y desplegables actuales. No se añaden IPC, capacidades de Electron, red, persistencia, comandos ni acciones.
4. **¿Madurez, seguridad y licencia?** Se conservan Svelte, Playwright y dependencias bloqueadas, con las licencias actuales. Un ajuste de presentación no interpreta documentos ni modifica las fronteras de confianza.
5. **¿Qué mantenimiento añade?** Una regla visual común sustituye la regla aislada de ContextMenu. Las pruebas observan el inicio del contenido visible, no una declaración CSS; se mantienen las desactivaciones y los motivos accesibles.
6. **¿Cuál es el pegamento mínimo?** CSS compartido, una E2E geométrica con un CSV sintético y capturas antes/después en los dos temas, idiomas y tamaños de la historia. Sin wrappers, detectores ni modelos nuevos.
7. **¿Qué valor aporta código propio?** Hace más fácil recorrer visualmente los menús sin cambiar sus acciones. Reutilizar la regla existente es menor y menos arriesgado que sustituir los menús o integrar otra biblioteca.

## Evidencia y límites

- Primero rojo de DOM Range en Nuevo y en el menú de columna; solo después se modifica la interfaz. No basta comprobar `text-align` ni `justify-content`.
- Capturas antes/después en claro y oscuro, es y en-XA, a 1440×900 y 1280×720. Se usan las mismas fuentes y fixtures sintéticos.
- Se conservan las pruebas de teclado, foco y acciones existentes de los menús afectados; no se elimina ninguna prueba en SIM-1g.
- Hay un punto del criterio geométrico pendiente de concretar antes de escribir la prueba: Nuevo muestra un icono delante del texto. El inicio de los glifos incluye ese ancho y separación; se ha comunicado a la coordinación para no interpretar en silencio el límite de 12 px.
- Sin dependencias nuevas, cambios de CI, plazos, motor ni contratos. No se fusiona, publica ni actualiza la aplicación instalada.
