# L4a/L5a · Corrección de arneses tras la primera CI

Fecha local: 2026-10-28. Base de la comprobación: `c78c9e88ee6568620114e315f294dc58ee52f5c8`, PR #89, siempre en borrador y con base `main`. No se cambia el producto, la interpretación del CSV, los límites ni la CI.

## Rojo real antes del cambio

[CI 40781808694](https://github.com/ruzer/freyalab/actions/runs/40781808694), sobre `c78c9e8`:

| Plataforma | Resultado observado | Paquete |
| --- | --- | --- |
| Windows 2025 | 1016 unitarias correctas, **34 fallidas**, 2 omitidas; tres archivos afectados | No ejecutado al fallar las unitarias |
| macOS Apple silicon | 1052 unitarias correctas; **366 E2E correctas y una fallida**, también falló su reintento | No ejecutado al fallar E2E |
| macOS Intel | Job completo correcto | Correcto |
| Ubuntu 24.04 | Job completo correcto | Correcto |

No se transfieren esos verdes al SHA de la corrección. Los logs y el artefacto original de Apple silicon se leyeron antes de editar, sin relanzar los jobs.

### Windows: imports externos del worker de pruebas

`large-search-bom-data.test.ts`, `large-search-runtime.test.ts` y `large-view.test.ts` construían su worker temporal con `external: id => !id.startsWith('.') && !id.startsWith('/')`. Un identificador absoluto de Windows resuelto por Rolldown, `C:\…\large-search-scan.ts`, cumple ese predicado y queda fuera del bundle. El registro real termina en `Cannot find module ...large-search-scan.ts ...worker.mjs`. Las esperas y aserciones de paridad fallan después por no haberse iniciado el worker.

Se utiliza `isAbsolute` de `node:path` en los tres predicados. Se conservan los mismos corpus, bucles y aserciones. La reproducción real en Windows está en el rojo remoto; la corrección en ese sistema necesita la CI del nuevo SHA. No se declara probada en Windows desde un Mac.

### Apple silicon: demora artificial y cantidad de trabajadores

El fallo pertenece a `large-search.spec.ts:82`, no al P7 histórico del índice. En ambos intentos el contexto de error muestra la consulta nueva correcta, `Cliente 9900`, y el panel aún trabajando: **67 % · 0 coincidencias · 14.3 s**. La prueba inyectaba 50 ms por lote de 25 sobre 10,000 registros. Un único worker requiere al menos 20 s para el recorrido, pero la aserción conserva un plazo de 15 s. El número de workers por omisión depende del equipo (`availableParallelism() - 2`, acotado).

Se fijan **dos workers exclusivamente en este caso E2E** para desacoplar el arnés del equipo. Siguen las 10,000 filas, lotes de 25, demora de 50 ms, cancelación, reemplazo de consultas, valor exacto de la fila 9900, recuento final, identidad de la consulta y conservación del archivo. Ninguna aserción ni plazo aumentó. No se cambió el valor por omisión del producto.

## Validación enfocada real

Mac Apple silicon; Node.js 24.22.1; Electron 44.9.2. Una única sesión Electron, sin reintentos locales.

| Comando | Resultado |
| --- | --- |
| `npm run check` | Exit 0; Svelte: 0 errores y 0 avisos; TypeScript del proceso principal correcto |
| `npm test -- tests/large-search-runtime.test.ts tests/large-search-bom-data.test.ts tests/large-view.test.ts` | **37/37**, tres archivos, 10.71 s, exit 0 |
| `npm run build` con los cuatro tests originales de `c78c9e8` | Exit 0 |
| `npm run build` con la corrección de los cuatro tests | Exit 0; **250/250 archivos compilados idénticos byte a byte** a la compilación anterior |
| `playwright test tests/e2e/large-search.spec.ts --project=csv --grep 'cancelar conserva un parcial honesto' --workers=1 --retries=0` | **1/1**, caso 14.6 s, ejecución 14.9 s, exit 0; todas sus aserciones originales correctas |

Se compararon **89 archivos rastreados** de `src`, `package.json`, `package-lock.json` y `.github` antes/después: todos conservan su SHA-256. Los hashes de los 250 recursos compilados coinciden. Los cuatro cambios de pruebas no alteran las fuentes de las mediciones de rendimiento, paridad, memoria o cancelación previas; no se repite esa matriz para calificar un producto distinto, porque el producto es idéntico.

Archivos locales de diagnóstico persistente: `recovery/pr89-ci/` dentro de la carpeta de visualizaciones de este chat. Incluyen los extractos rojos remotos, dos contextos/traces de error, logs enfocados, `product-before.json`, `product-after.json`, `build-baseline-sha256.json`, `build-fixed-sha256.json` y `compiled-identity.json`. No son una nueva ejecución de los resultados históricos.

## Límites y pendientes

- No se repitieron localmente la suite unitaria completa, toda E2E ni el paquete para esta corrección exclusivamente de arneses. El cierre anterior de `c78c9e8` y su fallo P7 se conservan en la evidencia; no se presenta aquella suite como totalmente verde.
- La CI completa de las cuatro plataformas y del paquete debe volver a calificar el **SHA final nuevo**. Su estado se registra en el PR, sin commits sólo para actualizar badges.
- El caso ARM original falló también al reintentar; queda como fallo real explicado del arnés y no se oculta como éxito por reintento.
- No se verificó aquí el número real de núcleos del runner remoto; la demora mínima con un worker y el avance observado son consistentes. La validación corregida fija dos workers y conserva los plazos.
- **P7 del índice Markdown sigue abierto**. Esta corrección no cambia `App.svelte`, `Outline` ni su prueba y no atribuye su causa a estos arneses.
- No se fusionó, publicó, instaló ni actualizó ninguna aplicación.
