# PRJ-01c: dos llamadores adicionales encontrados en el cierre integral

Base de esta comparación estática: `a14079b`. Los cambios de estos dos archivos son exclusivamente de navegación y observables equivalentes de la interfaz. La [tanda integral roja](integral-a14079b-rojo.log) registró ambos fallos; la [tanda enfocada verde](llamadores-adicionales-green.log) pasó los dos casos afectados, 2/2 en 4,5 s, sin reintentos. No se cambiaron plazos ni aserciones de datos.

Estos dos archivos son adicionales a las cuatro specs de proyecto: no sustituyen el recuento 51→51 de esas cuatro specs. `playwright --list --reporter=json` conserva exactamente las 24 identidades de estos dos archivos (título, spec y proyecto csv).

| Archivo:línea antes | Antes | Archivo:línea después | Después y motivo |
|---|---|---|---|
| empty-values.spec.ts:197 | «Verificada · 🔒 Protegida» visible | empty-values.spec.ts:199–204 | La fuente no muestra problemas changed/missing; la nota de protección existe exactamente una vez y es visible; Abrir está habilitado en su menú. El estado normal y sus botones en línea desaparecen a propósito en PRJ-01c. |
| empty-values.spec.ts:198 | Botón Abrir en el panel | empty-values.spec.ts:203–205 | `projectTreeRow` → `openProjectRowMenu` → `chooseProjectAction`, reutilizando el ayudante común. |
| project-subsets-perf.spec.ts:122 | Analizar deshabilitado dentro de .actions | project-subsets-perf.spec.ts:122–124 | El mismo Analizar sigue deshabilitado, ahora como menuitem. |
| project-subsets-perf.spec.ts:123 | Motivo de límite contenido en toda la fila | project-subsets-perf.spec.ts:125 | Descripción accesible exacta del menuitem, vinculada mediante aria-describedby. El motivo ya no ocupa una línea permanente del árbol. Escape cierra el menú antes de seguir. |

Comparación AST (llamadas estáticas de expect; no son conteos de aserciones ejecutadas): 175→179, de las cuales 172 se conservan literalmente; los tres matchers sustituidos son exclusivamente los de interfaz de la tabla anterior. Nuevos o equivalentes: siete. Por archivo: empty-values 139→143, project-subsets-perf 36→36.

Todas las comprobaciones de datos, fuente protegida, rechazo del puente, digest del original, límite analítico `256 MiB`, ausencia de documentos/proceso CSV y mtime se conservan literalmente. No cambian fixtures, perfiles, motor, cancelación, opciones ni límites.

La comparación estática ejecutó lista de Playwright antes/después (24→24, igualdad exacta), TypeScript Node sin emitir y git diff --check. El [JSON de comparación](inventario-llamadores-adicionales.json) conserva los tres matchers migrados y las 172 llamadas intactas. La ejecución de Electron posterior confirmó únicamente los dos casos afectados, no las 24 identidades completas de estos dos archivos ni la suite integral del próximo head.
