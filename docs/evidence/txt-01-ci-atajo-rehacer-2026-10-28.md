# TXT-01 · Atajo de Rehacer del arnés por plataforma

El head e9f6c5e ejecutó CI 40818015547. El trabajo Windows 123263714203 terminó con **413/414 E2E en 20,0 min**: falló únicamente `csv-text.spec.ts:31`, en la tercera aserción de la línea 38, después de pulsar Rehacer. El pegado exacto y Deshacer anteriores habían pasado. El reintento automático existente de CI reprodujo el fallo; no se lanzó otro intento manual. Log completo decodificado: txt-ci90-e9-windows.log.

La prueba pulsaba `ControlOrMeta+Shift+z` en todos los sistemas. Se comprobó la implementación instalada de `historyKeymap` en `@codemirror/commands/dist/index.js:565–574`, que Editor.svelte incorpora: `Mod-y`, sustituido por `Mod-Shift-z` en macOS; `Ctrl-Shift-z` adicional sólo en Linux. Windows necesita **Ctrl+Y**. Los E2E de markdown-paste, markdown-toolbar, markdown-date y markdown-tasks ya usan esa distinción.

Se corrige **sólo el atajo del test**: macOS conserva su secuencia anterior y Windows/Linux usan `ControlOrMeta+y`. No se cambia la fuente, el pegado, las tres comparaciones exactas, los bytes guardados, el fixture ni los plazos. El fallo no demuestra que el comando real de CodeMirror Rehacer pierda datos; se había invocado otra secuencia en Windows. La corrección tendrá que demostrarlo en la CI real de Windows.

Validación local de este ajuste:

- Comparación del archivo: deshacer únicamente la sustitución del atajo reproduce byte por byte el test anterior.
- `npx playwright test tests/e2e/csv-text.spec.ts --list`: salida 0, **15 casos**; sin lanzar Electron ni simular Windows.
- Manifiesto: **106 fuentes/archivos de paquete y 132 archivos compilados sin cambios de SHA-256**, frente a las mismas fuentes finales 8ac6f68. Raw: txt-ci90-redo-equivalence.json.
- No se repitieron las 414 E2E locales ni el build por este ajuste de arnés. La rama macOS del test es idéntica a la que pasó en el cierre 8ac6f68. Las unitarias completas 1.361/1.361 y check 0/0 posteriores al arreglo del oráculo siguen identificados como ejecuciones anteriores, no como ejecuciones nuevas del siguiente head.

La CI nueva debe ejecutar todas las pruebas y el paquete en las cuatro plataformas sobre el nuevo head. El verde completo de Linux en e9f6c5e no se transfiere. No se modifica CI, producto, IPC, dependencias ni datos para obtener un verde.

Hallazgo heredado fuera de este arreglo: el tooltip global de Rehacer en App.svelte todavía anuncia «Ctrl/Cmd Mayús Z» sin distinguir Windows. Se deja registrado para corregir la ayuda global en una tarea de UX/atajos; el botón usa directamente `redoEdit()` y el atajo admitido por CodeMirror en Windows es Ctrl+Y. No se modifica App.svelte dentro de esta corrección del arnés.
