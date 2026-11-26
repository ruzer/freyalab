# CI · C: experimento de dos workers rápidos (2026-11-25)

Base: `2e9e2d87c110377da93c875dd4b056b67ba59887`. Rama independiente: `codex/ci-fast-dos-workers`. El reparto de #221 ya está integrado y validado con PR, push y manual Intel; todas sus partes conservaron al menos 15 minutos de margen.

## Tratamiento propuesto, todavía sin adopción

Solo el número de workers de las rápidas cambia de 1 a 2 en Ubuntu y Windows. ARM conserva 2, Intel 1, perf/solo 1 y el paquete 1. Matrices, pruebas, proyectos, plazos, reintentos, `fullyParallel:false`, dependencias y producto permanecen intactos.

Las expectativas unitarias de la configuración y la frase de CONTRIBUTING se preparan en este borrador desde el principio: de otro modo el guard que exige un worker impediría ejecutar las E2E del experimento. Comprueban la configuración propuesta sin relajar aserciones de datos; Intel, serial y paquete siguen protegidos con un worker. Así las tres mediciones pueden usar un solo SHA congelado. Estos cambios solo se incorporarán a main si se decide adoptar el resultado; si se descarta, se cierra el PR y main mantiene un worker.

No se emplean flags para omitir pruebas, elevar plazos o alterar reintentos. El selector por áreas ya soporta dos workers rápidos. Las lecturas de portapapeles real revisadas continúan en `@solo`.

## Validación local

macOS ARM, Node 24.22.1, dependencias existentes del lockfile.

| Comando | Resultado real |
| --- | --- |
| `npm test -- --run tests/ci-int.test.ts tests/ci-windows-package.test.ts tests/ci-arm-package.test.ts`, antes del workflow | 2 fallidas, 47 aprobadas; 11,77 s; checkpoint `bd9623e5` |
| El mismo grupo más `tests/ci-areas.test.ts`, tras el cambio | 99 aprobadas; 15,40 s |
| `npm run check` | Código 0; Svelte 0 errores y 0 avisos; TypeScript aprobado |
| `npm test` completo, incluido CSV | Código 0; 3.317 aprobadas, 2 omisiones existentes; 23,42 s |
| `npm run build` | Código 0 |

No se ejecutó la suite gráfica completa local para simular hardware remoto: las mediciones válidas serán las de CI. Los guards conservan la igualdad exacta de identidades completas, las áreas, los specs del paquete y la fase serial.

## Referencia: tres últimas CI con un worker Linux/Windows

Tiempos del paso fast de la API de GitHub, no del portátil. Se verificó que app, E2E, Playwright, package.json y lockfile son iguales en los tres SHA. Los cambios de reparto serial no alteran sus comandos fast.

| Corrida / SHA | Estado global | Linux SMD | Linux CSV | Windows SMD | Windows CSV |
| --- | --- | --- | --- | --- | --- |
| [45731008252](https://github.com/ruzer/freyalab/actions/runs/45731008252) · `2e9e2d87` | Success | 11:33 | 21:27 | 16:03 | 30:20 |
| [45720390692](https://github.com/ruzer/freyalab/actions/runs/45720390692) · `18e40b8f` | Success | 11:37 | 22:40 | 18:30 | 29:38 |
| [45716356371](https://github.com/ruzer/freyalab/actions/runs/45716356371) · `865fc2c8` | Cancelled | 11:29 | 30:16 | 14:24 | 28:38 |

Los doce pasos fast completaron con éxito. La tercera corrida se canceló después, durante el paquete Ubuntu a los 45:18: su fase fast sigue siendo una medición completa y se conserva sin presentar su CI global como verde.

## Criterio fijado antes de medir

Cada plataforma tiene dos partes paralelas. Para comparar el tramo rápido se toma, por corrida, la mayor duración fast entre SMD y CSV y, después, la mediana de las tres corridas. Se publican también los valores por parte y las sumas; no se elige la métrica después de ver el resultado.

- Linux: referencia 22:40 (1.360 s); mejora de al menos 30 % exige mediana ≤15:52 (952 s).
- Windows: referencia 29:38 (1.778 s); exige mediana ≤20:44,6 (1.244,6 s).
- La decisión usa segundos sin redondear porcentajes. Tres corridas completas del mismo SHA, sin flaky nuevos de la plataforma. Los fallos y los casos que aprueben al reintentar se conservan con sus nombres.
- Windows ya tuvo flaky con un worker en la referencia: `empty-values.spec.ts:156` y `ui.spec.ts:284` en main `2e9e2d87`. Se contrastará el inventario completo de los tres runs antes de clasificar novedades; su existencia previa no demuestra una causa del experimento.
- Si Windows introduce flaky nuevos y Linux cumple, la propuesta se limita a Linux. Si ninguna cumple, se cierra sin fusionar y main conserva un worker.

La primera CI arranca con el PR. **Cada relanzamiento requiere autorización del propietario**; no se interpreta el tiempo transcurrido como autorización. Las corridas 2 y 3 y la adopción siguen pendientes. Los resultados y enlaces se registrarán en el PR sin commits de estado que invaliden el SHA congelado.

El camino crítico observado del último push fue ARM CSV (50:07), que este experimento no modifica. Un ahorro Linux/Windows no garantiza reducir el tiempo total de esa corrida. No se fusiona, publica ni actualiza la app instalada.
