# SIM-2e · Estadísticas legibles — 2026-11-18

Base `main d17cc81cd279f3e8a0938077d0b8d55294f05e83`. Rama independiente `codex/sim-2e-estadisticas-legibles`. Código de interfaz verificado: `f8c111d39d1b1ac71ec507a3ed2fbffb23cd2842`.

Historia original copiada sin editar en `docs/stories/historia-sim2-analisis-graficos-diseno-para-codex.md`, SHA-256 `c0fa99ec6c788ca4316d8cf1531dd69c1a88dcbfdccd2d1492b903b375f08273`. Decisiones del propietario de 2026-11-18 y siete respuestas de ADR 0021 en `docs/stories/sim-2e-alcance-adr-0021.md` (primer commit `7e49551`).

## Resultado

Las once filas de pandas tienen etiquetas en es/en y generación en-XA. El título y nombre accesible conservan su identificador pandas y ayuda. La pantalla usa máximo dos decimales y no añade decimales a enteros. Cada `title` conserva el valor completo; el informe mantiene `String(value)` y etiqueta «Media (mean)», etc. La matriz y los cálculos del motor permanecen iguales.

La tabla ajusta su ancho al contenido. El caption solo muestra alcance; revisión pasa a «Cómo se calcula». Los mensajes de inicio y éxito permanecen disponibles al lector de pantalla sin ocupar una línea. Carga, error, cancelación y cobertura parcial siguen anunciándose. CsvStatistics se traduce y sale de pending-files. No hay cambios de motor, IPC, guardado, dependencias, plazos ni reintentos.

## Rojo → verde real

| Comprobación | Rojo | Resultado posterior |
| --- | --- | --- |
| Pipeline Markdown de informe, etiquetas es/en/en-XA | 3/3 fallan por nombres count/mean/std sin localizar | 75/75 unitarias enfocadas, 8 archivos, con i18n y guard de pendientes |
| E2E nueva es/en-XA sobre el build anterior | 2/2 fallan en las etiquetas; conserva 8 capturas de antes | Las tres nuevas es/en/en-XA pasan sin reintento; 12 capturas de después |
| Tipos | — | `npm run check`: 0 errores y 0 avisos |
| Construcción | — | `npm run build`: terminó correctamente |
| E2E enfocadas de estadísticas | — | Primera corrida: 27/29 pasan, 2 fallan por expectativas de presentación pendientes de adaptar, detalladas abajo |

Comandos ejecutados:

```sh
npx vitest run tests/describe-readable.test.ts tests/describe-table.test.ts tests/statistics-report.test.ts tests/describe-engine.test.ts tests/describe-summary.test.ts tests/descriptive-statistics.test.ts tests/i18n.test.ts tests/i18n-pending.test.ts
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

No se borró ninguna prueba ni aserción. La repetición enfocada de las dos adaptaciones y las nuevas está pendiente al escribir este documento; no se presenta la primera corrida 27/29 como verde completo.

## Capturas

`sim-2e-antes-*.png` y `sim-2e-despues-*.png`, en esta carpeta: claro/oscuro, es/en-XA, 1440×900 y 1280×720. También se conservan las cuatro de inglés posteriores. Fixture sintético, sin datos de documentos del propietario.

## No verificado

- Repetición de las dos adaptaciones, suite unitaria completa, E2E completa, perf/solo, paquete y CI de las tres plataformas/Intel.
- No se probaron instalación manual, Gatekeeper, SmartScreen ni integración del escritorio.
- Sin push ni PR hasta revisión de la raíz; sin fusionar, publicar ni actualizar la app instalada.
