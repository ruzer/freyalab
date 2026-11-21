# Estabilidad: alta de fuentes y limpieza consecutiva de columnas

Esta evidencia cubre el helper de creación de proyecto y la recarga de una edición CSV. La cabeza local es `92b7d13808e4ac0a1bff057a93faec02e347a4c0` (espera del diálogo `7687`; cambio de producto `8313`). Los resultados siguientes pertenecen a sus fases indicadas; la CI de otro head no califica esta cabeza.

En Windows, run `44719848991` / head `8e321d3`, fallaron inicialmente «Delimitador» al añadir fuente y la vista previa «3 de 5 celdas cambiarán» de Minúsculas; sus retries pasaron. Las trazas recuperadas no incluyen DOM ni IPC principal. Las reproducciones locales conservaron esas firmas con barreras sobre operaciones reales; no prueban retrospectivamente el mismo orden interno en Windows. El archivo exterior de artefactos se interrumpió tras recuperar las entradas pertinentes y no tiene digest exterior verificado.

## Cambios y reproducción

La creación publica el panel antes de que su respuesta retire el diálogo modal. El panel montado no basta para accionar «Añadir». La probe retuvo la respuesta real ya resuelta: el Enter original no produjo pickSource y faltó Delimitador; esperar la retirada del diálogo permitió el mismo gesto y sus comprobaciones. El arreglo es una espera `toHaveCount(0)` al final de `create()`, sin cambios de producto para esta ruta.

Después de Quitar espacios, la lectura explícita ya devolvía la revisión 1 y las cinco ciudades correctas. La revisión también programaba otra lectura 150 ms después, con la misma consulta, revisión y resultado. Si entraba durante el siguiente clic, busy deshabilitaba Minúsculas y su guard descartaba el gesto. La regresión permanente conserva el caso existente: pausa el reloj antes de Aplicar, comprueba Trim renderizado y Minúsculas habilitado, retiene solo la siguiente respuesta de paginación real con límite 200, y realiza down → 150 ms → up. Libera y restaura siempre; no espera que exista una segunda petición ni inventa respuestas.

`editNow` ahora espera tick y cancela esa recarga programada antes de la lectura explícita existente. Se mantienen la lectura, estadísticas y manejo de errores, consultas y las otras rutas de recarga. Dos controles nuevos es/en-XA usan edición de celda y búsqueda reales: la búsqueda escrita durante la respuesta retenida se aplica sin avanzar el reloj; otra búsqueda posterior mantiene su propia recarga 150 ms. Se exige una sola edición real, sin contar un número fijo de lecturas page.

No se borraron casos. El caso Lower conserva sus oráculos originales; se añaden dos identidades de consulta. Invertir los cambios acotados recupera los tres archivos anteriores byte por byte, según [proof.json](windows-source-column-2026-11-20/proof.json).

## Resultados locales

| Fase | Resultado | Playwright / proceso |
| --- | --- | --- |
| Fuente: respuesta real retenida / control espera diálogo | Rojo exacto / 1 PASS, sin retry | 16.566825/16.865607s; 1.698092/2.041860s |
| Archivo original project-source con helper corregido | 7/7 PASS, sin retry; previo al cambio CsvTable |13.674494/14.198639s |
| Lower permanente, producto `43913e2` | 1 rojo exacto, sin retry |17.247809/17.738608s |
| Mismo Lower con coalescencia local | 1/1 PASS, sin retry |1.610703/1.900594s |
| Lower y consultas es/en-XA | 3/3 PASS,0 skip / 0 flaky / 0 retry |4.605596/4.888111s |
| Check final `92b7d138` | 0 errores / 0 warnings |14.154563s de proceso |
| Unitarias completas final `92b7d138` | 3096 PASS + 2 skip, 0 fallos |21.006728s de proceso |
| Build final `92b7d138` | exit 0 |3.864431s de proceso |

Check, unitarias y build se ejecutaron en paralelo. La fase rápida CSV terminó en el mismo código `92b7d138`: **421/421 aprobadas, 0 omisiones, 0 flaky y 0 reintentos**; 1060.227 s Playwright y 1060.515 s de proceso. No se acredita aquí una suite nativa completa, un paquete, Windows actual ni CI sobre `92b7d138`. El 7/7 de fuente no se presenta como una repetición de shell sobre el cambio posterior de CsvTable.

## Datos y capturas

Los únicos datos son los literales sintéticos ya públicos de ambos tests: 22 bytes (fuente con ID repetido y CRLF) y 130 bytes (cinco ciudades, Folio con ceros e Importe). Se conservan los arrays exactos de ciudades, Folio/Importe, dirty y bytes del archivo original. Sus hashes y los hashes antes/después de fuente y pruebas están en proof.json.

Se adjuntan ocho PNG originales copiados sin recomprimir: es/en-XA × claro/oscuro × 1440×900/1280×720. Muestran el estado posterior a la segunda búsqueda «mérida», Folio `00125`, Importe `30` y 1 de 5 filas. Las ocho se revisaron individualmente; no muestran rutas personales ni documentos reales. Son capturas posteriores, no una comparación antes/después. Los datos del CSV conservan su idioma original y esta entrega no completa la traducción heredada de la tabla.

[Español claro 1440](windows-source-column-2026-11-20/captures/query-es-light-1440x900.png) · [Español oscuro 1280](windows-source-column-2026-11-20/captures/query-es-dark-1280x720.png) · [en-XA claro 1440](windows-source-column-2026-11-20/captures/query-en-XA-light-1440x900.png) · [en-XA oscuro 1280](windows-source-column-2026-11-20/captures/query-en-XA-dark-1280x720.png). El inventario completo de 8 incluye SHA256, tamaño, dimensiones y revisión visual en proof.json.

## Reproducción canónica

Con Node 24, dependencias existentes y un build de la misma fuente, estos comandos equivalentes reproducen la calificación; no contienen rutas privadas. La regresión Lower se ejecuta primero sobre el producto anterior, antes de aplicar el arreglo.

```sh
npm run check
npm test
npm run build
npx playwright test tests/e2e/project-source.spec.ts --project=shell --workers=1 --retries=0
npx playwright test tests/e2e/column-menu.spec.ts --project=csv --workers=1 --retries=0 --grep 'quitar espacios y minúsculas|una búsqueda cambiada'
```

No se cambiaron plazos ni retries del producto, tests o CI. El reloj de renderer controla exclusivamente la ventana existente de 150 ms; sus cifras no miden latencia real. Los originales de logs, trazas y fallos de setup permanecen privados; proof.json contiene solo una proyección explícita de resultados y huellas, con sus límites.

El control de selección E1 está documentado por separado en [E1: selección visible y foco real](e1-seleccion-foco-2026-11-20.md). No hubo un cambio de producto E1, de codificación ni de guardado; el fallo histórico H13-2 no se presenta como resuelto por estas correcciones.
