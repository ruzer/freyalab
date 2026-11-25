# SIM-3d · Esperar la publicación completa del CSV

Producto sin cambios respecto de `89946d939949917996ebfd306a37ddd417366191`. Esta corrección modifica únicamente la prueba `tests/e2e/sim3d-decimals.spec.ts` y su evidencia. No cambia dependencias, datos, IPC, guardado, plazos, reintentos ni workflows.

## Rojo real y causa

En la CI [45330334502, intento 2](https://github.com/ruzer/freyalab/actions/runs/45330334502/attempts/2), head `7a4944debd7001822760895fdcf0a98e1ca7b2a2`, el caso auto/en-XA leyó un CSV cuya primera fila todavía era `undefined`; pasó al reintento.

`exportResult` reserva CSV y contexto JSON con nombres nuevos, inicialmente vacíos, y publica primero el contexto y después el CSV (`src/main/export.ts:214–216`). La prueba esperaba al JSON, pero eso no certifica que la pareja haya terminado. No se demostró un CSV final corrupto.

Se reprodujo en Electron construido, Node 24.22.1 y macOS ARM, con los mismos datos/aserciones y una demora artificial de 1.000 ms solo en el `rename` final de `precision.analisis.csv`. El envoltorio se instaló mediante `app.evaluate` únicamente bajo `FREYALAB_TEST=1`, se sincronizaron los exports nativos de Node y se restauró después. No existe ese gancho en el producto ni en la suite de CI.

## Cambio mínimo

`waitForCompleteCsv` espera por condición a la matriz completa de encabezados y valores, utilizando `expect.poll` y su plazo existente. Un destino que aún no existe devuelve `null`; otros errores de lectura o parseo siguen fallando. Después se conservan todas las aserciones originales de encabezados, valores completos, nulos/contexto y presentación. Se usa en las dos rutas nuevas de CSV: describe y estadísticas detalladas. El caso anterior de Gráficos queda intacto.

## Rojo → verde y comandos

Todos desde el worktree independiente `sim3d-continuacion`, con Node 24.22.1. La sonda privada copia el spec con imports absolutos y su propio `package.json` de tipo módulo, sin dependencias nuevas. El manifiesto conserva hashes de las fuentes y logs ejecutados; los logs publicados sustituyen el prefijo de ruta local por `/workspace/recovery` y eliminan espacios al final de línea, conservando los resultados.

| Ejecución | Resultado real |
| --- | --- |
| Sonda anterior, auto/es y auto/en-XA, misma demora de publicación | 2 fallos por `csv[0] === undefined`; 7,307 s; sin reintentos |
| Sonda corregida, mismos dos casos y demora | 2/2 aprobadas; 8,447 s; sin reintentos |
| Spec real, seis exportaciones CSV/JSON | 6/6 aprobadas; 11,3 s; sin reintentos |
| `npm run check` tras el helper | 0 errores y 0 avisos |

```sh
node node_modules/@playwright/test/cli.js test --config ../sim3d-evidence/csv-publication-race-probe/playwright.config.ts --project=csv --workers=1 --retries=0
node node_modules/@playwright/test/cli.js test --config ../sim3d-evidence/csv-publication-race-probe/playwright.green.config.ts --project=csv --workers=1 --retries=0
node node_modules/@playwright/test/cli.js test tests/e2e/sim3d-decimals.spec.ts --project=csv --grep 'SIM-3d exportación:' --workers=1 --retries=0
npm run check
```

Antes de la ejecución válida se corrigieron dos errores de preparación de la sonda: límite ESM y un filtro `grep` anclado que descubría cero casos. Ninguno se cuenta como rojo funcional ni como verde. Sus logs permanecen privados junto a la sonda.

[Rojo](sim-3d-2026-11-23/csv-publicacion-red.log), [verde con demora](sim-3d-2026-11-23/csv-publicacion-green.log), [seis casos reales](sim-3d-2026-11-23/csv-publicacion-green-real-six.log), [tipos](sim-3d-2026-11-23/csv-publicacion-check-final.log) y [manifiesto](sim-3d-2026-11-23/csv-publicacion-manifest.json).

## CI y límites pendientes

La CI de `7a4944de` no califica este cambio de prueba. El segundo intento terminó con 847 aprobadas, 2 intermitentes, 1 fallo definitivo y 7 omisiones en fast; solo 1/74 de serial llegó a reportar resultado antes del corte del job. El fallo definitivo heredado `charts:399` sigue esperando 15 s el resultado inicial, antes de exportar. También hubo una consulta cancelada durante recarga en `csv-text:82`. Esos dos casos no se modifican aquí.

No se repite una suite local completa ni las unitarias/build por un cambio exclusivo del spec: sus resultados anteriores sobre el mismo producto permanecen en el [informe principal](sim-3d-2026-11-23.md). El nuevo head necesita su propia CI. No se verificaron aquí las plataformas remotas, Intel, el instalador ni la prueba con estudiantes. La pareja de archivos continúa siendo la implementación existente con reservas y rollback; no se presenta como una transacción de dos archivos.
