# SIM-1b · Barra de la tabla con texto

Fecha: 2026-11-18. Base inicial `main 23121eda41fb9380c533a25ef86723046b6d7639`; después se integró `main 1bdf88c437079fadaf8ff9e121102ab370fae614` mediante el merge normal `2ac65ed233bf5a93ec735b8ec1e34951c29c0cae`. Código comprobado: `ea19b6cdb23595b94fe879104f81232b84b78f4e`, en la rama independiente `codex/sim-1b-barra-tabla`. macOS arm64, Node 24.22.1; perfiles y CSV sintéticos.

Los rojos iniciales se ejecutaron con HEAD documental `f0f9c5c84e13328ef173e87a7dc95d7e44942e11`: solo el alcance añadido a main, con el mismo árbol de código `3b7462046e4ca52d38732bce460486b172decd4a`. No se presenta como una corrida de CI de main.

## Cambio y alcance

Limpiar y Filas y columnas conservan sus iconos y muestran sus nombres. Limpiar ofrece primero seis operaciones sobre la columna de la celda activa; con una marca en Ciudad y la celda activa en Ingreso, el destino es Ingreso. Sin celda activa se explica el motivo de bloqueo. Las tres operaciones sobre filas marcadas conservan su alcance anterior; Transformar documento queda al final.

Los constructores pequeños de comandos comparten guardas y ejecución con el registro existente. No cambia el destino de la paleta ni del menú de columna: `targetColumn` y `emptyTarget` conservan sus definiciones. El adaptador de la barra pasa el índice explícito. Duplicados prepara la columna elegida sin modificar las marcas del encabezado; no hay un motor de limpieza nuevo.

Ir a la fila conserva su nombre accesible y su atajo, con [Hash de Lucide 1.61.0](https://github.com/lucide-icons/lucide/blob/1.61.0/icons/hash.svg), incorporado al registro local bajo la licencia ISC ya incluida. Buscar acción muestra el atajo que proporciona la aplicación; no se añade un detector de sistema ni se cambia el acelerador.

La adaptación mide el ancho real de los controles y oculta las etiquetas en orden Filtrar → Limpiar → Filas y columnas. No añade un breakpoint. Una regla local impide comprimir los botones por debajo de su texto; otra oculta el tooltip del disparador mientras su menú está abierto para que no tape la primera acción al usar teclado. No cambia otras barras.

Sin dependencias, IPC, motor, guardado, exportación, límites, plazos o CI nuevos. El archivo original no se escribe por abrir menús o cancelar las vistas previas. La historia original y las siete respuestas de reutilización están en [el alcance previo](../stories/sim-1b-alcance-adr-0021.md).

## Rojo y correcciones del oráculo

| Estado comprobado | Resultado real | Qué demuestra |
|---|---|---|
| Base main, ocho casos iniciales | 5 fallos / 3 aprobadas, 43,7 s; sin reintentos | Faltan seis acciones, texto Limpiar, orden de ocultación e icono Hash; las tres operaciones de filas ya preservaban el alcance |
| Base main, celda activa sin marcas de encabezado | 1 fallo | Espera diez acciones y encuentra cuatro; no basta depender de una columna marcada |
| Ayudas nuevas en en-XA, antes de localizarlas | 1 fallo | Cuatro detalles seguían en español aunque las etiquetas eran traducibles; se trasladaron a cuatro claves completas es/en |
| Primera comprobación de `6ab74f2` | 9/9, 13,4 s, **insuficiente** | La revisión visual encontró texto de Analizar recortado; aquel oráculo solo comprobaba cajas de elementos |
| Comprobación adicional de cajas y viewport | 1/1, 2,4 s, **insuficiente** | La barra y los botones cabían, pero sus glifos se salían de los botones comprimidos |
| DOM Range sobre texto visible en `6ab74f2` | 1 fallo | En en-XA a 1280 px, el texto de Analizar llegaba a x=1293,359, fuera de la ventana y de su botón |
| Capturas y geometría final de `ea19b6c` | **2/2, 5,4 s; ocho estados** | Cajas y glifos caben dentro de cada control y del viewport |

El verde inicial no se presenta como cierre. Las cajas de Reemplazar y Analizar se habían reducido a unos 58 px, con `clientWidth=56`, `scrollWidth=80` y `flex-shrink:1`. Medir esos anchos comprimidos daba un espacio necesario falso. La corrección es una sola regla local: `.csv-toolbar[role=toolbar]>button{flex-shrink:0}`. La medición existente puede entonces ocultar etiquetas según el ancho necesario real.

[Extractos de las salidas reales](sim1b-resultados-2026-11-18.txt), separados por ejecución y con los ensayos insuficientes identificados.

La prueba final recorre nodos de texto visibles con DOM Range, excluye menús desplegados y texto accesible oculto, y comprueba los glifos contra el botón y la ventana. Espera fuentes, tema aplicado y distribución estable; no añade pausas fijas.

## Medidas finales

Cada fila se comprobó en claro y oscuro. La barra conserva una sola fila de 38 px.

| Idioma | Ventana | Barra clientWidth / scrollWidth | Filtrar / Limpiar / Filas y columnas | Glifos dentro del control y la ventana |
|---|---|---|---|---|
| es | 1440×900 | 1199 / 1199 px | visibles / visibles / visibles | Sí |
| es | 1280×720 | 1039 / 1039 px | visibles / visibles / visibles | Sí |
| en-XA | 1440×900 | 1199 / 1199 px | visibles / visibles / visibles | Sí |
| en-XA | 1280×720 | 1039 / 1039 px | ocultas / ocultas / ocultas, conservando nombre accesible | Sí |

[Geometría y nodos medidos](sim1b-geometria-2026-11-18.json). En la fotografía inicial, los campos `width/height` describen la barra, no el viewport; los tamaños de las imágenes están verificados por IHDR en [el manifiesto de capturas](sim1b-capturas-2026-11-18.json).

## Capturas antes y después

Las ocho imágenes finales proceden exclusivamente del código `ea19b6c`, no del verde insuficiente de `6ab74f2`.

| Idioma y tema | 1440×900 antes / después | 1280×720 antes / después |
|---|---|---|
| es · claro | [antes](sim1b-before-es-light-1440x900.png) / [después](sim1b-after-es-light-1440x900.png) | [antes](sim1b-before-es-light-1280x720.png) / [después](sim1b-after-es-light-1280x720.png) |
| es · oscuro | [antes](sim1b-before-es-dark-1440x900.png) / [después](sim1b-after-es-dark-1440x900.png) | [antes](sim1b-before-es-dark-1280x720.png) / [después](sim1b-after-es-dark-1280x720.png) |
| en-XA · claro | [antes](sim1b-before-en-XA-light-1440x900.png) / [después](sim1b-after-en-XA-light-1440x900.png) | [antes](sim1b-before-en-XA-light-1280x720.png) / [después](sim1b-after-en-XA-light-1280x720.png) |
| en-XA · oscuro | [antes](sim1b-before-en-XA-dark-1440x900.png) / [después](sim1b-after-en-XA-dark-1440x900.png) | [antes](sim1b-before-en-XA-dark-1280x720.png) / [después](sim1b-after-en-XA-dark-1280x720.png) |

## Comandos y validación

| Comprobación ejecutada | Resultado y atribución |
|---|---|
| `npm run check` | 0 errores/advertencias Svelte y TypeScript; ejecutado otra vez tras el oráculo y la regla CSS final |
| `npm test`, completo e incluido CSV | 165 archivos; 2961 aprobadas / 1 omisión, 20,84 s, antes de las cuatro ayudas localizadas y de la regla CSS final; no se transfiere como una corrida completa de `ea19b6c` |
| `npx vitest run tests/i18n.test.ts tests/i18n-audit.test.ts tests/i18n-pending.test.ts` | 56/56, 810 ms, después de localizar las cuatro ayudas |
| `npm run build` | Correcto después del commit `ea19b6c`; la compilación incluye ese identificador |
| E2E de capturas de `table-toolbar.spec.ts` | 2/2, 5,4 s, sin reintentos, sobre `ea19b6c` |
| Siete casos nuevos restantes y consumidores | **137 aprobadas / 1 omisión, 3,9 min; sin reintentos**, sobre `ea19b6c` |
| Integración de #185: `csv-text.spec.ts` | **22/22, 34,4 s, sin reintentos**, sobre el merge `2ac65ed`; compilación correcta de ese mismo commit |
| CI | Pendiente; no se atribuye verde de otra rama o SHA |

Las capturas se obtuvieron con `npx playwright test tests/e2e/table-toolbar.spec.ts --project=csv --grep 'SIM-1b capturas' --workers=1 --retries=0`. Se usaron los parámetros de evidencia para separar las imágenes iniciales, las insuficientes y las finales. Las pruebas de acciones añaden teclado, celda activa sin marcas, celda activa distinta de las marcas y las tres operaciones sobre filas y columnas marcadas, con oráculos independientes y deshacer.

La segunda corrida ejecutó table-toolbar, compact-toolbar, ordering, structure, ui, large-search, column-menu, empty-values, large-file, structural-context, commands e icons, excluyendo únicamente los dos casos de capturas ya ejecutados. Se incluyeron los casos de tamaño y portapapeles en un solo worker. La unión tiene **140 identidades distintas: 139 aprobadas / 1 omisión; nueve casos nuevos aprobados y 130 consumidores anteriores aprobados**. Se contrastaron los 140 resultados detallados: un único resultado por caso y `retry=0` en todos. [Inventario y resultados](sim1b-validacion-2026-11-18.json).

```sh
npx playwright test tests/e2e/table-toolbar.spec.ts tests/e2e/compact-toolbar.spec.ts tests/e2e/ordering.spec.ts tests/e2e/structure.spec.ts tests/e2e/ui.spec.ts tests/e2e/large-search.spec.ts tests/e2e/column-menu.spec.ts tests/e2e/empty-values.spec.ts tests/e2e/large-file.spec.ts tests/e2e/structural-context.spec.ts tests/e2e/commands.spec.ts tests/e2e/icons.spec.ts --grep-invert 'SIM-1b capturas' --workers=1 --retries=0
```

Se omiten del ejemplo las rutas locales del intérprete, del informe HTML y de los resultados; los argumentos de selección son los ejecutados.

Se integró #185 con un merge normal, sin reescribir historia. El árbol de `src` de `ea19b6c` y `2ac65ed` es idéntico (`b9947622ca9263b84658da727b4a5a590ee8fec4`). Fuera de documentación, solo se añadió la espera de `Guardar aria-busy=false` de `tests/e2e/csv-text.spec.ts`, procedente de main; se conservaron todas sus aserciones. Se compiló `2ac65ed` y se ejecutaron sus 22 casos de CSV Texto: 22 aprobados, 34,4 s, un resultado por caso y `retry=0`. No se presenta la corrida anterior de 140 casos como una ejecución del merge. [Prueba de equivalencia e inventario de integración](sim1b-integracion-main-2026-11-18.json).

La omisión E2E es `commands.spec.ts:49`, «APP-01 M4: Word se descubre al iniciar y el menú exporta un DOCX real sin abrir la barra». Su guard exige `FREYALAB_PANDOC_TEST_PATH`, que no se proporcionó a esta corrida. No significa que Pandoc no esté instalado y no se cuenta como caso aprobado.

La única omisión de unitarias es el caso de `package-smoke.test.ts` específico de Windows («un hijo sobreviviente al timeout bloquea el paquete hasta cerrarlo»); no se presenta como aprobado en macOS.

## Pruebas existentes y límites

No se borra ninguna prueba. Se añaden nueve casos en `table-toolbar.spec.ts`, separados de la fixture histórica de la barra compacta. En compact-toolbar, ordering, structure, ui, large-search y panel.ts solo cambia el nombre de navegación Limpiar datos → Limpiar; las aserciones de datos, límites y guardado siguen intactas. En panel.ts el cambio es de tipo y comentario: su ejecución no cambia.

La combinación textual del código final `ea19b6c` con SIM-1a `cf7aeeb393ed94bcd75d0eea87cabb155f69ef47` se comprobó con `git merge-tree`, sin aplicar un merge: sin conflictos. No demuestra una integración ejecutada ni transfiere pruebas entre ramas.

No se han verificado todavía Windows, Linux, Intel, paquete o instaladores en esta entrega. La comprobación visible del atajo es macOS local; la variante Windows debe quedar demostrada en su CI. No se afirma rendimiento con archivos grandes a partir de las capturas de 240 filas. Solo SIM-1b: no se fusiona, publica ni actualiza la app instalada.
