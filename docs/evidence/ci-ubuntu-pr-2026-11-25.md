# CI · Cambio A: Ubuntu repartido en PR (2026-11-25)

Base: `83722db47db62b5acb3f4076174908bb4da0c19d`. Rama: `codex/ci-ubuntu-pr`.

Solo el cambio A autorizado por el propietario. B (Intel fuera del push) y C (experimento de workers) esperan su integración y no se implementan aquí.

## Resultado del reparto

| Parte Ubuntu en PR | Comprobaciones |
| --- | --- |
| `shell-md` | Tipos, unitarias completas, experimentos de fixtures y rápidas Shell/Markdown seleccionadas por el plan |
| `csv` o `csv-package` | Rápidas CSV seleccionadas, fase perf/solo completa del plan y, si se requiere, paquete Linux con sus mismas diez specs |

Se reutiliza el selector de proyectos existente. Si el plan no selecciona CSV, sus rápidas se omiten, pero la fase serial del plan sigue corriendo en esa parte: por ejemplo, las pruebas seriales de Shell/Markdown de un PR Markdown. Solo se acepta esa omisión con selector aprobado, intersección rápida vacía y selección serial no vacía. Cancelar sigue deteniendo la fase serial; un fallo rápido conserva sus comprobaciones.

Gate exige `ubuntu_shell_md` y `ubuntu_csv`, además de las cuatro confirmaciones de Windows/ARM y el éxito global de la matriz. Cada confirmación Ubuntu solo la emite su propia parte aprobada. La excepción para documentación sigue requiriendo un plan correcto y Verify omitido.

Las dos partes Ubuntu conservan 45 minutos. No cambian workers, reintentos, plazos de Playwright, specs de producto, dependencias, main/nocturna ni las otras plataformas. `test:e2e:perf` construye antes de probar: también prepara el paquete Linux cuando las rápidas CSV están vacías.

## Rojo → verde local (macOS ARM, Node 24.22.1)

| Comando | Resultado real |
| --- | --- |
| `npm test -- --run tests/ci-int.test.ts tests/ci-windows-package.test.ts tests/ci-arm-package.test.ts`, antes del YAML | 10 fallidas, 35 aprobadas; 9,46 s. Checkpoint rojo: `ad0f81d9` |
| El mismo comando, tras el YAML | 45 aprobadas; 11,42 s |
| `npm run check` | Código 0; Svelte: 0 errores, 0 avisos; TypeScript aprobado |
| `npm test` (completo, incluido CSV) | Código 0; 182 archivos aprobados, 1 omitido existente; 3.298 pruebas aprobadas, 2 omitidas existentes; 25,09 s |
| `npm run build` | Código 0 |

Las pruebas ejecutan el selector real del workflow para planes de unitarias, Shell, Markdown, CSV y completo, con y sin paquete. Comprueban selección vacía, fallo/cancelación, construcción previa del paquete y emisor exclusivo de cada confirmación. Las regresiones de Windows y ARM pasan sin cambios.

## Identidades E2E

Enumeradas con `playwright test --list --reporter=json`, conservando proyecto, archivo, suites y título:

| Selección | Casos |
| --- | ---: |
| Completa | 944 |
| Rápidas Shell/Markdown | 373 |
| Rápidas CSV | 497 |
| Perf/solo completa | 74 |
| Ausentes / extras / duplicados | 0 / 0 / 0 |

La unión ordenada de las tres selecciones coincide exactamente con la completa. SHA-256 del listado de identidades ordenadas y separadas por LF: `2edad9c399865f4de88c9f57b6fbeb6daeb1a113167c11e2800b6be66f757cef`.

## CI y límites de esta evidencia

La medición inicial de 46–48 minutos del job Ubuntu único procede del informe del propietario; no se presenta como una nueva medición local. La duración real por job y fase del nuevo head se registrará en el PR con enlaces a GitHub Actions, sin crear commits de estado que vuelvan a disparar la CI.

Pendiente al escribir este documento: CI del head final en las tres plataformas, pruebas empaquetadas remotas y comprobación de que la parte Ubuntu más larga no supere 40 minutos. No se ejecutó la suite gráfica completa local: el cambio es de reparto de CI y su validación de ejecución corresponde a la corrida completa del PR. Las omisiones de Pandoc ya existentes no se convierten en resultados verificados.
