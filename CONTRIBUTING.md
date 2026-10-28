# Contribuir

Usa Node.js 24 LTS y `npm ci`. Lee `AGENTS.md`, `docs/PLAN.md` y el render de referencia antes de cambiar la interfaz.

1. Crea una rama `codex/<cambio>` desde `main` actualizado.
2. Mantén el cambio pequeño y enlaza la entrega del plan que resuelve.
3. Añade pruebas que comprueben el comportamiento: especialmente persistencia, CSV, IPC y exportación. Usa datos sintéticos; no publiques documentos privados.
4. Ejecuta siempre `npm run check`, `npm test` completo (incluye CSV) y `npm run build`. Elige la E2E local con la tabla siguiente. Documenta plataforma, comandos y resultados reales. No repitas suites ya verificadas por CI sin un cambio que lo justifique.
5. Abre un PR describiendo problema, resultado y comprobaciones. Conserva la referencia visual; explica cualquier diferencia.

## Comprobaciones locales

Qué correr según lo que cambias; todos los comandos E2E incluyen la construcción.

| Cambio | E2E mínima local | Siempre |
| --- | --- | --- |
| Solo Markdown o Mermaid (`render.ts`, `Preview`, `Diagram`, `markdown-commands`, `MarkdownToolbar`) | `npm run test:e2e:md` (`shell` + `md`) | `check`, `test` completo, `build` y CI verde |
| Solo CSV (`Csv*.svelte`, motor de tablas) | `npm run test:e2e:csv` (`shell` + `csv`) | Ídem |
| Archivos compartidos (`App.svelte`, `Editor.svelte`, `style.css`, `src/main/**`, `src/preload/**`, `src/shared/**`, `Icon.svelte`, `Tree.svelte`) | `npm run test:e2e` completo | Ídem |
| Render, editor o motor de tablas con efecto en rendimiento | Además `npm run test:e2e:perf` | Ídem |
| Última tarea de una corrida o lote | `npm run test:e2e` completo | Ídem |

`npm run test:e2e:fast` ejecuta todo salvo `@perf`; sirve para una comprobación amplia, pero no sustituye los límites de tamaño cuando corresponden. `npm run test:e2e:perf` ejecuta esos límites. La CI conserva la suite completa en cada PR, en macOS Apple silicon e Intel, Windows y Linux. Un verde de otra base o head es histórico, no el cierre de la entrega actual.

Los grupos están en `tests/e2e/groups.ts`. `shell` y `md` enumeran archivos; `csv` contiene los demás. Cada prueba pertenece a un único proyecto en la ejecución completa. Registra los archivos nuevos en su área; un archivo sin registrar cae en `csv` y sigue protegido en CI. Cambiar de grupo no permite borrar ni debilitar aserciones.

Marca con `{tag:'@perf'}` solo pruebas cuyo propósito sea un límite de tamaño: documentos Markdown/texto de al menos 10 MiB, tablas con al menos un millón de filas de datos o archivos de más de 50 MiB. Un caso lento por sí solo no es `@perf`. Los CSV multicolumna menores de esos umbrales conservan su cobertura en `fast`, aunque prueben navegación o complejidad.

Reserva el literal `@perf` en nombres de archivo, títulos y bloques `describe`: Playwright lo interpreta como etiqueta dentro del nombre, aunque no aparezca en el objeto de metadatos. Usa la anotación del caso; no añadas un filtrador alternativo ni renombres casos existentes para segmentarlos.

Al cambiar grupos o etiquetas, conserva el listado previo y compara las identidades completas (archivo, suites y título), sin el prefijo nuevo del proyecto: misma cantidad, ninguna pérdida ni duplicado. Comprueba también que `fast` y `perf` son disjuntos y su unión es el completo. Una cifra histórica nunca autoriza quitar casos del baseline actual.

La CI obligatoria debe pasar sobre el commit que se integra. Que compile no demuestra que el paquete abra ni que su instalador funcione. Si una comprobación no está disponible, indícalo; no la marques como aprobada. Una CI obligatoria ausente bloquea la publicación.

No añadas funciones fuera de la alfa, dependencias grandes, ejecución de contenido de documentos ni acceso genérico al sistema desde la interfaz. Las modificaciones deben preservar los valores de CSV y permitir recuperar el trabajo ante errores de guardado.

No se requieren cesiones de copyright. Al contribuir aceptas distribuir tu contribución bajo la licencia MIT de este repositorio. Los avisos de terceros no se eliminan.
