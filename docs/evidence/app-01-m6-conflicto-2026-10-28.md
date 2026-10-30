# APP-01 · Condición de parada M6 / D9

Base D1: ec5330242663a8adec4e1a33065c606b558c91c1. Rama independiente `codex/integracion-aplicacion`; no se modificó producto.

Tras liberar B19 se ejecutó con Node24:

`npm test -- tests/application-menu.test.ts tests/application-shortcuts.test.ts`

Log original: `/private/tmp/freyalab-lote2/d2-menu-unit-red.log`.

- La suite del menú no carga porque aún no existe `src/main/application-menu.ts`. No son aserciones de comportamiento ejecutadas.
- M6 con los keymaps instalados default/history/search de CodeMirror: **1 aprobada**, sin Mod1/2/3.
- M6 en los manejadores actuales: **1 fallo real**. `src/renderer/components/Diagram.svelte:30` contiene `if(event.key==='1')void actualSize()` tras comprobar Ctrl/Meta en la línea29. Ctrl/⌘+1 ya significa Tamaño real de Mermaid.

Se detuvo D2 antes de implementar el menú o adoptar atajos de modo, como exige D9. La decisión se consultó al propietario por el coordinador; **sigue pendiente**. La prueba roja y los handlers existentes no se cambiaron para ocultar el conflicto.

Las opciones presentadas son conservar el atajo de Mermaid y no asignar los nuevos a modos, o autorizar reutilización contextual explícita. En esta última, `active.kind==='markdown'` no basta: Preview también monta Diagram en el diálogo de Mermaid ampliado dentro de un `.md`. Allí el foco/modal Mermaid debe conservar Tamaño real y los atajos de modo deben quedar inactivos. Este detalle se comunicó antes de recibir respuesta; no constituye aprobación.

No hay implementación verificada, dependencia nueva, cambio de CI ni PR D2. D1 y sus comprobaciones continúan por separado. Cuando llegue la decisión se registrará aquí y se ajustarán las pruebas a ese contrato antes del código.
