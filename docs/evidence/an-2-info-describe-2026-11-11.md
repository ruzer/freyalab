# AN-2 · Información y resumen estadístico

Código: `9ee37a9feabf9291a29387c783ec67e53e92c0c2`, rama local `codex/alpha4-an-2`. Base AN-1b `26a5e1bc5bb24646941a15d4c59bef7f99430685`; las correcciones finales de AN-1b `d2109ba14adc2314f911d3d5da982b97f34ea227` se incorporaron mediante merge normal `4d14483`. Sin push, PR, versión nueva, publicación ni modificación de la app instalada.

El contrato aprobado se conserva fielmente en `docs/stories/an-2-contrato-resumen-aprobado.md`; las siete respuestas del ADR 0021 están en `docs/stories/an-2-alcance-adr-0021.md`. No cambian dependencias, workflows, plazos, modelo CSV, escritura, permisos ni motor SQL.

## Resultado y límites semánticos

- Información reutiliza el análisis de columnas existente: dimensiones, tamaño **original** del archivo, formato y recuentos de tipos. La tabla tiene siete columnas. Los anteriores ausentes, vacíos exactos y espacios se conservan en una ayuda desplegable; también se conservan distintos exactos y repeticiones adicionales. Su informe detallado no cambia de cálculo.
- Estadísticas abre un resumen traspuesto de ocho filas numéricas. «Incluir texto y fechas» añade unique/top/freq y los extremos ISO. Los perfiles existentes deciden qué es número; no se promedian identificadores, mixtas ni números con coma decimal.
- Cada columna empieza por `profileOnly`; si es numérica sigue `stats`, y si se pide texto/fechas sigue el análisis completo. Nunca se hace un primer análisis fallido seguido de dos operaciones de recuperación. En el fixture aprobado se comprueban 7 llamadas para las dos numéricas y 10 para las cinco columnas incluidas.
- Describe excluye ausentes, vacíos y solo espacios de count/unique/top/freq textual. Los distintos anteriores de Información y del informe avanzado permanecen intactos. Fechas válidas con espacios exteriores se comparan por ISO sin alterar el valor original. Top/freq de fechas siempre quedan vacíos.
- Una cardinalidad textual mayor de 100.000 se identifica como no disponible; no se fabrica un resumen parcial exacto. La columna numérica de 100.001 distintos sigue mostrando media 50.000. El motor original conserva sus límites.
- «Más estadísticas» mantiene Suma, varianzas, P10/P90, percentiles y el informe detallado anteriores. Desplegar no consulta. Los rangos y el explorador mantienen su presentación completa, y la entrada contextual conserva su alcance. El cálculo avanzado y describe comparten el estado de ocupado; sustituir describe por rango/explorador cancela explícitamente su generación.
- La procedencia del resumen/informe dice documento completo, vista filtrada o columnas marcadas; el rango interno usado para la consulta numérica filtrada no se presenta como selección manual.

## Rojo → verde

Las salidas completas están en [an-2/rojo-verde](an-2/rojo-verde/). Los rojos del motor y las 68 pruebas iniciales se documentaron aparte en [an-2-core-2026-11-10.md](an-2-core-2026-11-10.md).

| Criterio | Rojo comprobado | Verde comprobado |
| --- | --- | --- |
| Resumen por petición | El botón Calcular no existía | Fixture numérico exacto, ocho filas, 4 decimales y precisión completa en title |
| Información | No existía Obtener información | 6 filas × 5 columnas; tipos 2/1/1/1 y cifras anteriores de contenido/vacíos/distintos |
| Cálculo concurrente | Calcular seguía habilitado mientras la respuesta avanzada real estaba retenida | Bloqueo mutuo, cancelación accesible, sin consulta al desplegar; sustitución por explorador cancela antes de su nueva petición |
| Paleta describe | Recuento de comandos específicos = 0 | Enter abre Estadísticas sin calcular; el comando SQL anterior conserva su comportamiento |
| Totales accesibles | Vacíos/Distintos no incluían la cifra visible en su nombre | Nombre accesible incluye cifra y ayuda; tabla con caption y scopes de fila/columna |
| Navegación anterior | La vista legacy quedaba plegada | Apertura explícita mediante helper; foco comprobado antes de esa acción, sin focus artificial |

Se corrigió además un espacio de presentación entre el mensaje de error traducido y el detalle: el E2E de revisión real recibió ambos textos pegados. Se conserva su misma causa y se volvió a comprobar la aserción original, sin ampliar los errores aceptados.

Durante la creación de pruebas hubo expectativas incorrectas del test: el filtro de Producto convierte Mixta en numérica legítimamente; el botón se enfocaba antes de tener metadatos; End no desplaza horizontalmente; y el selector de media con texto incluido apuntaba a unique. Se corrigieron esas expectativas y el último caso se repitió de forma aislada. No se presentan estos fallos del montaje como defectos del producto ni se borran las salidas previas.

## Ejecuciones reales

Equipo: macOS Apple silicon local, Node 24.22.1, Electron del lockfile. Todos los E2E siguientes usaron `--retries=0` y un worker. Las ejecuciones no son números de CI.

| Comando | Resultado |
| --- | --- |
| `npm run check` | 0 errores, 0 avisos |
| `npm test` | 143 archivos; 2.687 aprobadas, 1 omitida; 20,09 s |
| `npm run build` | Completado |
| `npx playwright test tests/e2e/analysis-describe.spec.ts tests/e2e/columns-overview.spec.ts tests/e2e/statistics-reports.spec.ts tests/e2e/descriptive-percentiles.spec.ts tests/e2e/project-source.spec.ts tests/e2e/analysis-tab.spec.ts tests/e2e/selection-statistics.spec.ts --grep-invert '@perf' --retries=0` | 37 aprobadas y 1 fallo del selector nuevo de unique/media; 1,5 min |
| `npx playwright test tests/e2e/analysis-describe.spec.ts --project=csv --grep 'cardinalidad textual' --retries=0` | Selector corregido: 1/1 aprobada; 3,1 s; producto sin cambio |
| `npx playwright test tests/e2e/ui.spec.ts tests/e2e/ui-u0.spec.ts --grep 'estadísticas\|Calculando' --retries=0` | 5/5 aprobadas; 7,6 s; incluye muestra, encabezados duplicados, límite, teclado y spinner en es/en/en-XA |

La primera ejecución completa de unitarias dentro de la restricción de puertos produjo EPERM al crear servidores de prueba locales: 26 fallos y 9 omisiones de Pandoc derivados de ese montaje. Se repitió **la suite completa**, sin cambiar pruebas ni configuración, con los puertos locales autorizados; el resultado de 2.687/1 es ese segundo comando real. La única omisión restante es el control de HTTP de Pandoc: el binario local 3.12.1 no lo soporta; no se atribuye cobertura HTTP a ese binario.

La comparación estática de navegación e Información está en [ledger-navegacion-legacy.md](an-2/ledger-navegacion-legacy.md) y [ledger-info-legacy.md](an-2/ledger-info-legacy.md). Todas las cifras originales, etiquetas, límites, archivos, seguridad, revisión y plazos se conservan. El montaje adicional P5 está en el commit propio `5f89dda`, con su [procedencia y reproducción](an-2/p5-readiness/README.md).

## Capturas y accesibilidad

Datos sintéticos: 250 filas y 100 columnas; 1440 × 900. Revisión visual local de las ocho capturas, sin desbordamiento de la página. La matriz desplaza horizontalmente con ArrowRight y la primera columna permanece fija. Información pagina 50 columnas; cada columna conserva el número, nombre y detalle completo.

| Vista | Español | en-XA |
| --- | --- | --- |
| Describe, claro | [Captura](an-2/an2-describe-100-es-light-1440x900.png) | [Captura](an-2/an2-describe-100-en-XA-light-1440x900.png) |
| Describe, oscuro | [Captura](an-2/an2-describe-100-es-dark-1440x900.png) | [Captura](an-2/an2-describe-100-en-XA-dark-1440x900.png) |
| Información, claro | [Captura](an-2/an2-info-100-es-light-1440x900.png) | [Captura](an-2/an2-info-100-en-XA-light-1440x900.png) |
| Información, oscuro | [Captura](an-2/an2-info-100-es-dark-1440x900.png) | [Captura](an-2/an2-info-100-en-XA-dark-1440x900.png) |

Se comprobó teclado real, encabezados scope, caption, nombres largos de abreviaturas, totales accesibles, estados anunciados y colores forzados. No se usó un lector de pantalla real. Se reutilizan los tokens existentes; no se efectuó una nueva medición de contraste ni se cambió la paleta.

## No verificado todavía

- Suite E2E completa del sucesor AN-2; la validación integral anterior pertenece a AN-1b y no se transfiere.
- CI de Ubuntu, Windows, macOS ARM e Intel, empaquetado o instalación de este código.
- Rendimiento multiplataforma nuevo: las unidades del núcleo cubren exactitud de 100.001 distintos, no una garantía universal de latencia.
- Los informes y explicaciones legacy mantienen su idioma/semántica anterior; la nueva matriz y sus textos tienen catálogo es/en y prueba en-XA.

No se subieron dependencias, no se cambiaron filtros/SQL, no se toca el CSV al consultar ni se saltan pruebas de integridad. El siguiente paso es la revisión del sucesor y su calificación integral; no hay fusión automática.
