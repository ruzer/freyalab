# Contribuir

Usa Node.js 24 LTS y `npm ci`. Lee `AGENTS.md`, `docs/PLAN.md` y el render de referencia antes de cambiar la interfaz.

1. Crea una rama `codex/<cambio>` desde `main` actualizado.
2. Mantén el cambio pequeño y enlaza la entrega del plan que resuelve.
3. Añade pruebas que comprueben el comportamiento: especialmente persistencia, CSV, IPC y exportación. Usa datos sintéticos; no publiques documentos privados.
4. Trabaja por bloques: conserva la prueba roja antes del cambio y ejecuta pruebas enfocadas hasta verde. Al cierre de la rama de integración ejecuta `npm run check`, `npm test` completo (incluye CSV), `npm run test:e2e` completo y `npm run build`. Documenta plataforma, comandos y resultados reales; repite una suite ya verificada solo si un cambio o hallazgo lo justifica.
5. Abre un PR describiendo problema, resultado y comprobaciones. Conserva la referencia visual; explica cualquier diferencia.

## Comprobaciones locales

Durante cada bloque ejecuta las unitarias y E2E de los archivos o flujos afectados. Los scripts `npm run test:e2e*` construyen la app; una ejecución enfocada directa con `npx playwright test` requiere un build actualizado de la misma fuente. No valides cambios nuevos contra un build antiguo.

| Cambio | Pruebas durante el desarrollo del bloque |
| --- | --- |
| Solo Markdown o Mermaid (`render.ts`, `Preview`, `Diagram`, `markdown-commands`, `MarkdownToolbar`) | Casos afectados; `npm run test:e2e:md` (`shell` + `md`) para comprobar el área |
| Solo CSV (`Csv*.svelte`, motor de tablas) | Casos afectados; `npm run test:e2e:csv` (`shell` + `csv`) para comprobar el área |
| Archivos compartidos (`App.svelte`, `Editor.svelte`, `style.css`, `src/main/**`, `src/preload/**`, `src/shared/**`, `Icon.svelte`, `Tree.svelte`) | Flujos consumidores afectados; suite completa al cerrar la integración |
| Render, editor o motor de tablas con efecto en rendimiento | Además los límites afectados; `npm run test:e2e:perf` cuando corresponda |

Al cierre de la rama de integración y de la última tarea del lote: `npm run check`, `npm test` completo, `npm run test:e2e` completo y `npm run build`. La CI conserva todas las pruebas, las comprobaciones críticas y la ejecución del paquete en las cuatro plataformas; las pruebas enfocadas de desarrollo no sustituyen ese cierre.

Congela el SHA enviado a CI. Mientras se califica, continúa el código en otra rama y worktree; no cambies el head evaluado ni sus fuentes de medición. Un nuevo SHA o una integración diferente necesita su propia calificación. Registra el resultado de CI en el PR sin crear un commit solo para cambiar su estado en la evidencia.

`npm run test:e2e:fast` ejecuta todo salvo `@perf` y `@solo`; sirve para una comprobación amplia, pero no sustituye la fase serial. `npm run test:e2e:perf` ejecuta los límites de tamaño y los casos `@solo`, con un único worker. La CI ejecuta ambas fases consecutivamente: fast con dos workers sólo en macOS Apple silicon y con uno en Windows, Linux y macOS Intel, y después perf/solo aislados con un worker; conserva la suite completa en macOS Apple silicon e Intel, Windows y Linux cuando cambian entradas del producto, pruebas o construcción. Los PR sólo documentales pueden omitirla según los filtros auditados de `ci.yml`. Un verde de otra base o head es histórico, no el cierre de la entrega actual.

Los grupos están en `tests/e2e/groups.ts`. `shell` y `md` enumeran archivos; `csv` contiene los demás. Cada prueba pertenece a un único proyecto en la ejecución completa. Registra los archivos nuevos en su área; un archivo sin registrar cae en `csv` y sigue protegido en CI. Cambiar de grupo no permite borrar ni debilitar aserciones.

Marca con `{tag:'@perf'}` solo pruebas cuyo propósito sea un límite de tamaño: documentos Markdown/texto de al menos 10 MiB, tablas con al menos un millón de filas de datos o archivos de más de 50 MiB. Un caso lento por sí solo no es `@perf`. Los CSV multicolumna menores de esos umbrales conservan su cobertura en `fast`, aunque prueben navegación o complejidad.

Reserva el literal `@perf` en nombres de archivo, títulos y bloques `describe`: Playwright lo interpreta como etiqueta dentro del nombre, aunque no aparezca en el objeto de metadatos. Usa la anotación del caso; no añadas un filtrador alternativo ni renombres casos existentes para segmentarlos.

Al cambiar grupos o etiquetas, conserva el listado previo y compara las identidades completas (proyecto, archivo, suites y título): misma cantidad, ninguna pérdida ni duplicado ni traslado entre proyectos. Comprueba también que `fast` y `perf/solo` son disjuntos y su unión es el completo. `@solo` se añade como metadata, conservando el nombre, sólo para recursos globales que no toleran instancias concurrentes; no significa omitir la prueba. Una cifra histórica nunca autoriza quitar casos del baseline actual.

La CI obligatoria debe pasar sobre el commit que se integra. Que compile no demuestra que el paquete abra ni que su instalador funcione. Si una comprobación no está disponible, indícalo; no la marques como aprobada. Una CI obligatoria ausente bloquea la publicación.

No añadas funciones fuera de la alfa, dependencias grandes, ejecución de contenido de documentos ni acceso genérico al sistema desde la interfaz. Las modificaciones deben preservar los valores de CSV y permitir recuperar el trabajo ante errores de guardado.

No se requieren cesiones de copyright. Al contribuir aceptas distribuir tu contribución bajo la licencia MIT de este repositorio. Los avisos de terceros no se eliminan.

## Idiomas

Desde que I18N-01 esté en `main`, toda cadena nueva visible usa `t()`, incluidas las historias de CSV y de reportes que ya estén en curso. El proceso principal importa de `src/shared/i18n`; los componentes Svelte importan de `src/renderer/lib/i18n.svelte` para actualizarse al cambiar el idioma. Los parámetros contienen datos, no fragmentos de frases traducibles; los documentos del usuario nunca se traducen. Usa `plural()` e `Intl` mediante los formatos compartidos.

Los catálogos planos `es.json` y `en.json` deben tener las mismas claves y marcadores, sin HTML. Español usa `es-MX`, inglés `en-US`. `en-XA` es solo para pruebas. El selector de idioma seguirá oculto hasta I18N-02; el almacén permanente llega con APP-03.

`src/shared/i18n/pending-files.json` es la lista de fuentes anteriores a la adopción que todavía no están completamente traducidas. Su fotografía inicial documenta `main` y los carriles que ya estaban en curso; no reserva archivos futuros. Solo se retiran rutas: no se añaden para saltarse la comprobación. Al terminar de migrar un archivo, retíralo y comprueba que no vuelvan los literales visibles. Los archivos nuevos nacen traducibles.

El guard usa los AST de Svelte y TypeScript instalados: texto y atributos visibles, expresiones de plantilla, variables locales simples y puntos de salida conocidos de mensajes, errores y diálogos. No trata los identificadores, CSS ni unidades técnicas como frases; los datos no vinculados a una salida visible conocida no se catalogan. No hace análisis semántico de flujos arbitrarios: las cadenas construidas mediante funciones ajenas o accesos dinámicos, los nombres sombreados y los valores reutilizados como dato y etiqueta requieren también revisión de código. Esta limitación no permite añadir literales nuevos ni ampliar la lista pendiente.

## Ajustes

Un ajuste nuevo requiere una entrada en el esquema versionado de `src/shared/settings.ts`, su valor por omisión en la tabla `defaultSettings()`, una fila accesible y traducida en el diálogo y una prueba de su comportamiento y persistencia. No añadas opciones sin un comportamiento que las respalde ni otra fuente permanente de preferencias en el renderer.

El proceso principal valida y guarda `settings.json`; los componentes solicitan parches mediante el puente limitado. No incluyas rutas de documentos, nombres de usuario ni contenido. Conserva los archivos de una versión futura en modo de sólo lectura y las copias de recuperación existentes; una migración debe comprobarse con un perfil anterior.
