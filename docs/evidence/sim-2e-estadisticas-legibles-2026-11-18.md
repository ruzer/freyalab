# SIM-2e · Estadísticas legibles — 2026-11-18

Base inicial `main d17cc81cd279f3e8a0938077d0b8d55294f05e83`; actualizada mediante merge local con `main fd4e2a46845de95d7f7274f52fbd26cb0f63fcbc` tras #180. Rama independiente `codex/sim-2e-estadisticas-legibles`. Código de interfaz verificado: `f8c111d39d1b1ac71ec507a3ed2fbffb23cd2842`. Las dos adaptaciones E2E y sus capturas se guardan por separado en `5c704da8e8c3d6d19d75cd127bdc192106834981`.

Historia original copiada sin editar en `docs/stories/historia-sim2-analisis-graficos-diseno-para-codex.md`, SHA-256 `c0fa99ec6c788ca4316d8cf1531dd69c1a88dcbfdccd2d1492b903b375f08273`. Decisiones del propietario de 2026-11-18 y siete respuestas de ADR 0021 en `docs/stories/sim-2e-alcance-adr-0021.md` (primer commit `7e49551`).

## Resultado

Las once filas de pandas tienen etiquetas en es/en y generación en-XA. El título y nombre accesible conservan su identificador pandas y ayuda. La pantalla usa máximo dos decimales y no añade decimales a enteros. Cada `title` conserva el valor completo; el informe mantiene `String(value)` y etiqueta «Media (mean)», etc. La matriz y los cálculos del motor permanecen iguales.

La tabla ajusta su ancho al contenido. El caption solo muestra alcance; revisión pasa a «Cómo se calcula». Los mensajes de inicio y éxito permanecen disponibles al lector de pantalla sin ocupar una línea. Carga, error, cancelación y cobertura parcial siguen anunciándose. CsvStatistics se traduce y sale de pending-files. No hay cambios de motor, IPC, guardado, dependencias, plazos ni reintentos.

## Validación final tras integrar main

Código integrado y verificado: `5280a2d12792fe951540ebedb772500d72ce72b9`. El commit posterior añade solo esta evidencia. Se ejecutó con Node.js 24.22.1 en macOS Apple silicon; el build corresponde a ese código.

Los únicos conflictos fueron `src/shared/i18n/es.json` y `en.json`: bloques finales de 73 claves de estadísticas y 8 de Proyecto. Se conservaron los textos de ambos bloques, con 1.610 claves por idioma. La comparación de tres vías dio cero claves modificadas por ambos lados, cero valores divergentes, cero duplicados y cero claves o valores inesperados. Ningún componente ni prueba se editó manualmente en esta integración.

| Comprobación final | Resultado real |
| --- | --- |
| `npm run check` | 0 errores, 0 avisos |
| Las ocho unitarias enfocadas del comando inferior | 81/81, 8 archivos, 0,746 s; main añadió casos de i18n respecto a los 75 iniciales |
| `npm test` completo | 2.956 aprobadas / 1 prueba exclusiva de Windows omitida en Mac, 165 archivos, 17,48 s; incluye CSV |
| `npm run build` | Correcto |
| Los cinco archivos E2E enfocados del comando inferior | 29/29 en una corrida de 50,8 s, `--workers=1 --retries=0`; cero reintentos |
| Capturas posteriores | Las 12 capturas es/en/en-XA, claro/oscuro y ambos tamaños coinciden byte por byte con las ya guardadas; no se sustituyen por duplicados |

La raíz ejecutó la GUI en exclusiva. Se revisaron las capturas es/claro a 1440×900 y en-XA/oscuro a 1280×720, sin recortes observados en la tabla y sus controles. Esto no sustituye las comprobaciones geométricas y de precisión de las pruebas.

El primer `npm test` de esta integración, sin permiso para abrir el servidor local de pruebas, terminó con `listen EPERM 127.0.0.1`: 26 fallos y un error de suite en updates/Pandoc. Se conserva como intento fallido ambiental, no como un verde ni una regresión del producto. El comando completo se repitió con permiso de loopback, sobre el mismo código y sin modificar aserciones, plazos o reintentos; dio el resultado de la tabla. Su única omisión es la prueba exclusiva de Windows de `tests/package-smoke.test.ts`, omitida en Mac; no corresponde a Pandoc HTTP.

## Rojo → verde real

| Comprobación | Rojo | Resultado posterior |
| --- | --- | --- |
| Pipeline Markdown de informe, etiquetas es/en/en-XA | 3/3 fallan por nombres count/mean/std sin localizar | 75/75 unitarias enfocadas, 8 archivos, con i18n y guard de pendientes |
| E2E nueva es/en-XA sobre el build anterior | 2/2 fallan en las etiquetas; conserva 8 capturas de antes | Las tres nuevas es/en/en-XA pasan sin reintento; 12 capturas de después |
| Tipos | — | `npm run check`: 0 errores y 0 avisos |
| Construcción | — | `npm run build`: terminó correctamente |
| E2E enfocadas de estadísticas | — | Primera corrida: 27/29 pasan y 2 fallan por expectativas de presentación, detalladas abajo; tras adaptarlas, los dos casos y los tres nuevos pasan 5/5 en 7,4 s, sin reintento |
| Unitarias completas (`npm test`) | — | 2.936 pasan / 1 prueba exclusiva de Windows omitida en Mac, 163 archivos, 19,41 s; incluye CSV |

Comandos ejecutados:

```sh
npx vitest run tests/describe-readable.test.ts tests/describe-table.test.ts tests/statistics-report.test.ts tests/describe-engine.test.ts tests/describe-summary.test.ts tests/descriptive-statistics.test.ts tests/i18n.test.ts tests/i18n-pending.test.ts
npm test
npm run check
npm run build
npx playwright test tests/e2e/statistics-readable.spec.ts tests/e2e/analysis-describe.spec.ts tests/e2e/descriptive-percentiles.spec.ts tests/e2e/statistics-reports.spec.ts tests/e2e/selection-statistics.spec.ts --grep-invert '@perf|@solo' --workers=1 --retries=0
```

La GUI la ejecutó la raíz, en Mac Apple silicon, de forma coordinada y exclusiva. No se atribuyen esos resultados a otros sistemas.

## Adaptaciones de pruebas, sin borrar aserciones

- `describe-table.test.ts`: cambia solo el rótulo del informe, conservando los mismos números y null.
- `analysis-describe.spec.ts`: etiquetas del informe, nombre accesible y texto con dos decimales; el título de la desviación estándar conserva la comparación exacta con `15.811388300841896`.
- Primera corrida, `analysis-describe.spec.ts:150`: seguía buscando Revisión 1 en caption. Se conserva la aserción, abriendo «Cómo se calcula» y comprobándola allí. No cambia la prueba de respuesta obsoleta ni el valor actual 32.
- Primera corrida, `descriptive-percentiles.spec.ts:25`: el título real era `3.0000000000000004`, el redondeo binario que ya entregaba el motor. La nueva comprobación literal `String(3)` era incorrecta. Se mantiene el oráculo de valores y se comprueba título presente, `Number(title)` a 12 decimales y texto visible a dos decimales. El criterio anterior comparaba únicamente 12 cifras significativas visibles. No se modifica el motor ni ningún dato esperado.
- El perfil de columna, ajeno a esta presentación, conserva su formato anterior. Selección, límites, informes, recuperación, guardado e integridad del archivo conservan sus aserciones.
- Nuevas: tres unitarias de informe y tres E2E de etiquetas/ayuda, teclado, precisión completa, alcance, estado accesible, geometría, colores forzados y archivo intacto.

No se borró ninguna prueba ni aserción. La repetición enfocada posterior dio 5/5 en 7,4 s; la primera corrida sigue registrada como 27/29, no como un verde completo. No se repitieron los otros 24 casos sin cambios: las 29 conductas quedaron cubiertas entre ambas corridas, sin atribuir el resultado de un SHA a la CI de otro.

La única omisión unitaria corresponde al caso exclusivo de Windows de `tests/package-smoke.test.ts` («Windows: un hijo sobreviviente al timeout bloquea el paquete hasta cerrarlo»), omitido en Mac. Por separado, Pandoc local 3.12.1 carece de soporte HTTP: esa comprobación retorna normalmente e informa una limitación de lo medido, pero no es el skipped que cuenta Vitest. El resto de las pruebas reales de Pandoc se ejecutó; no se acredita la eficacia del sandbox ante un binario con HTTP.

## Capturas

`sim-2e-antes-*.png` y `sim-2e-despues-*.png`, en esta carpeta: claro/oscuro, es/en-XA, 1440×900 y 1280×720. También se conservan las cuatro de inglés posteriores. Fixture sintético, sin datos de documentos del propietario.

## CI anterior y nueva calificación pendiente

La [corrida 44380410486](https://github.com/ruzer/freyalab/actions/runs/44380410486), SHA `320b2266ea3403aa326fd48e0f00bfdc10db629a`, terminó **failure**, no verde integral:

| Job | Resultado | Duración | Reintentos de pruebas |
| --- | --- | --- | --- |
| Ubuntu | success | 42m04s | 0 |
| Windows | success | 49m49s | 1 flaky |
| macOS | success | 42m59s | 1 flaky |
| macOS package | cancelled, sin runner ni pasos | 15m02s en cola, no tiempo de pruebas | No ejecutó pruebas |
| Gate | failure, matriz abandoned | 5s | No aplica |

La anotación del paquete fue «The job was not acquired by Runner of type hosted even after multiple attempts», con avisos de capacidad de macOS arm64. No se contó como paquete probado.

Windows: `project-source.spec.ts:216:45`, diálogo y fuente protegida [es], no encontró «Añadir fuente…» en 15 s tras Enter; pasó al reintento. macOS: `mermaid-export-theme.spec.ts:138:1`, esquina PNG transparente `[0,0,0,0]` frente al blanco esperado `[255,255,255,255]`; pasó al reintento. Los logs identifican las señales, pero no demuestran su causa raíz ni que sean efecto de SIM-2e. No se arreglan fuera del alcance de esta entrega.

Tras fusionarse #180, GitHub detectó conflicto con main. No se relanzó el paquete del SHA anterior: se integró main mecánicamente y el nuevo head requiere su propia CI. Los resultados de aquella corrida no se transfieren al código integrado. La CI del head final se enlaza y actualiza en el PR, sin crear otro commit solo para declarar su estado.

## No verificado

- Suite E2E completa, perf/solo, paquete y CI del head final en las tres plataformas. Intel no corre en PR por la política existente; no se lanzó una sonda Intel en esta entrega.
- No se probaron instalación manual, Gatekeeper, SmartScreen ni integración del escritorio.
- Entrega autorizada en PR en borrador con base main; no fusionar, publicar ni actualizar la app instalada. La CI se enlaza y se actualiza en el PR, sin otro commit solo para declarar su estado.
