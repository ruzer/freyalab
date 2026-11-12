# Distintos sin vacíos — Información y su informe

Fecha: 2026-11-11. Base `a8dfc7f8b27871f3a7288cc8b3f536a583859c8e` (AN-2 fusionado). Rama `codex/distintos-sin-vacio`. macOS 27.0.1, arm64, Node.js 24 LTS.

## Contrato aprobado por el propietario

Información y su informe excluyen los campos ausentes, los valores vacíos y los compuestos solo por espacios de «Distintos». Los demás valores siguen comparándose literalmente: `a`, ` a` y `a ` son distintos. Se conservan las estadísticas avanzadas y las repeticiones, explicando que estas sí incluyen los casos vacíos.

## Cambio mínimo

- `CsvColumnsOverview.svelte` y únicamente `columnOverviewReport` usan `profile.distinctNonEmpty`, ya calculado por el motor. No se crean detector, campo, contrato ni recorrido nuevos.
- El nombre accesible explica «sin vacíos». La ayuda distingue este recuento del de repeticiones. Los textos nuevos/cambiados tienen catálogo es/en y se comprueban también en en-XA.
- El informe rotula «Distintos sin vacíos» y «Repeticiones adicionales (incluidos vacíos)» y conserva su resto de números, precisión, procedencia y protección frente a contenido hostil.
- Motor, tipos, IPC, archivos originales, estadísticas avanzadas, frecuencias, límites, dependencias y workflows no cambian. No se aplica ninguna transformación del CSV.

| Fixture | Distintos anteriores → nuevos | Repeticiones adicionales, conservadas |
| --- | --- | --- |
| Mixta del fixture de AN-2 | 3 → 2 | 3 |
| Opcional del fixture de calidad | 3 → 1 | 1 |
| Mixta unitaria con ausente, vacío y espacios separados | 4 → 2 | 2 |

## Rojo → verde real

Las pruebas rojas se ejecutaron antes de cambiar las fuentes del producto, construidas desde main más las nuevas expectativas.

| Comprobación | Rojo | Verde |
| --- | --- | --- |
| Informe con Mixta, ausente, vacío y espacios | 1 falla / 7 pasan: muestra 4 en vez de 2; faltan la rotulación y la explicación | 8/8 del archivo; incluidas en 28/28 enfocadas de informe, describe y estadísticas anteriores |
| Información: Mixta de AN-2 y Opcional de calidad | 2 E2E fallan: muestran 3 en vez de 2 y de 1 | Ambas pasan dentro de 26/26 E2E afectadas |
| es/en/en-XA | Nuevas comprobaciones de presentación y salida, mismo defecto de recuento | 3/3: nombre accesible, ayuda, repeticiones, informe y bytes del original |

Salidas en [distintos-sin-vacio](distintos-sin-vacio/). Las trazas rojas adicionales permanecen fuera del repositorio en `/private/tmp/freyalab-distintos-evidence/e2e-red-artifacts/`.

## Comandos y resultados locales

Con Node.js 24 en PATH:

- `npx vitest run tests/column-overview-report.test.ts`: rojo, 1 fallo y 7 aprobadas.
- `npm run build`: construcción previa aprobada para las E2E rojas.
- `npx playwright test tests/e2e/analysis-describe.spec.ts tests/e2e/columns-overview.spec.ts --project=csv --grep 'AN-2 Información|panorámica: tipos' --workers=1 --retries=0`: rojo, 2 fallos.
- `npx vitest run tests/column-overview-report.test.ts tests/describe-summary.test.ts tests/statistics-report.test.ts`: 28/28 aprobadas, 413 ms.
- `npm run check`: aprobado, 0 errores y 0 avisos.
- `npm test`: 143 archivos aprobados; 2.689 pruebas aprobadas y 1 omisión preexistente, 14,95 s. La omitida es `tests/package-smoke.test.ts:18`, exclusiva de Windows. No es la prueba HTTP de Pandoc, que se ejecuta e imprime su limitación.
- `npm run build`: aprobado con el cambio de presentación.
- `npx playwright test tests/e2e/analysis-describe.spec.ts tests/e2e/columns-overview.spec.ts --project=csv --workers=1 --retries=0`: 26/26 aprobadas, 37,6 s, sin reintentos ni omisiones. Incluye cancelación, revisión, muestra, cardinalidad, cien columnas, presupuesto agregado y aperturas de 3.000/100.000/1.000.000 de filas.
- `git diff --check` sobre código, pruebas y documento (excluyendo las salidas `.log`): sin incidencias. Los logs se conservan crudos y contienen espacios finales/líneas vacías del ejecutor; no se normalizaron para ocultarlos.

El primer intento de `npm test` bajo permisos restringidos falló en dos archivos porque sus servidores locales no podían abrir `127.0.0.1` (`listen EPERM`): 26 fallos, 2.654 aprobadas y 10 omisiones. Se conservó esa salida y se repitió la suite con acceso a red local autorizado: el resultado final es el verde anterior. No se modificaron pruebas ni plazos para obtenerlo.

## Trazabilidad de pruebas

Se añade una unitaria y tres E2E, sin borrar casos. La expectativa de distintos de Mixta se actualiza de 3 a 2 y Opcional se comprueba explícitamente como 1; los números de las estadísticas avanzadas y del motor permanecen intactos. La E2E «AN-2 Información presenta dimensiones, tipos y calidad sin modificar los distintos anteriores» se renombra a «AN-2 Información presenta dimensiones, tipos y calidad con distintos sin vacíos», porque el contrato cambió expresamente ese recuento.

## No verificado y límites

Sin CI, empaquetado, instaladores ni pruebas manuales de Windows/Linux en esta entrega local. No se repitió la suite E2E completa: se ejecutaron los dos archivos afectados; la calificación remota del head final corresponde al PR posterior. No se publica ni se instala una app, ni se modifican historias de LIM-1 o TEN-1.

El informe anterior conserva sus otros textos históricos en español; solo los encabezados y la explicación nuevos siguen el idioma, como se comprueba en es/en/en-XA. No se afirma una traducción integral del informe legado. El límite de 100.000 claves exactas y los avisos de cobertura parcial continúan siendo los actuales.
