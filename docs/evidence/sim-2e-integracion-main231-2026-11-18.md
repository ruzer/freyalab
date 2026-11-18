# SIM-2e · Integración necesaria con main 23121eda

Fusión normal, sin reescribir historia, de `6383aa178abd242de2ae64be2b76305a4644fe3d` con `main 23121eda41fb9380c533a25ef86723046b6d7639`; base común `fd4e2a46845de95d7f7274f52fbd26cb0f63fcbc`. Main ya contiene las entregas del propietario #182, #183 y #184. El nuevo árbol requiere su propia calificación: no se trasladan verdes del head anterior ni se describe la cancelación de aquella CI como fallo de infraestructura.

Solo hubo conflictos en `es.json`, `en.json` y `pending-files.json`. La unión mecánica de tres vías dio **cero valores divergentes**. Cada catálogo conserva las 85 claves añadidas por main y las 73 añadidas por estadísticas; la retirada propia de `describe.provisional` se mantiene. Resultado: 1695 claves por idioma, sin duplicados. Se usaron las líneas originales sin recodificar escapes; se conserva la sangría de un espacio y el orden de main, añadiendo las claves propias en su orden anterior. No se ordenó ni reformateó todo el archivo.

La lista de pendientes conserva ambas retiradas: `CsvStatistics.svelte` y `CsvSql.svelte`. Pasa de 52 a 50 rutas, sin añadir ninguna ni cambiar las restantes o su orden. No se modifica metadata, dependencias, CI, límites ni reintentos.

Los bytes de los tres archivos de producto estadístico (`CsvStatistics.svelte`, `CsvDescribe.svelte`, `statistics-report.ts`) coinciden con los de `6383aa1`; sus hashes y el censo de catálogos están en [la prueba estructurada](sim-2e-integracion-main231-prueba.json). El código y las pruebas entrantes de main se conservan.

La evidencia anterior de SIM-2e corrige únicamente la identidad de la omisión unitaria: es la prueba exclusiva de Windows de `package-smoke`, omitida en Mac. Los recuentos 2936/1 y 2956/1 y todos los tiempos permanecen iguales. Pandoc 3.12.1 sin HTTP sigue siendo una limitación separada: ese caso retorna normalmente y no es el skipped contado por Vitest. Los logs y metadata históricos no se editan.

Estado al crear este commit: resolución y prueba estática terminadas; check, unitarias enfocadas y build del nuevo árbol pendientes. Unitarias completas se coordinarán cuando quede libre la GUI de consumidores grandes. La raíz ejecutará las 29 E2E enfocadas y comparará los bytes de las capturas antes de publicar un único head. Sin push ni PR nuevo, fusión del PR o publicación en esta fase.


## Validación final del árbol integrado

Código integrado probado: `acdf0772b66eb38ebcaead60b60f110978abf415`. El commit de cierre agrega únicamente evidencia; conserva los árboles de producto y pruebas. Node 24.22.1, Mac Apple silicon. [Log curado](sim-2e-main231-validacion-2026-11-18.txt) y [huellas de las capturas](sim-2e-main231-capturas-prueba.json).

| Comprobación | Resultado real |
| --- | --- |
| Check | 0 errores y 0 avisos |
| Ocho unitarias enfocadas | 81/81, 0.963 s |
| Unitarias completas con loopback permitido | 2964 aprobadas / 1 exclusiva de Windows omitida en Mac; 166 archivos, 18.94 s |
| Build | Correcto, mismas fuentes |
| Cinco archivos E2E enfocados, GUI exclusiva de la raíz | 29/29 en 46.4 s, un worker, cero reintentos |
| Doce capturas posteriores | Comparadas contra blobs versionados: 12/12 idénticas byte por byte; es/en/en-XA, claro/oscuro, 1440×900 y 1280×720 |

No se duplican las capturas ni se modifica código estadístico, pruebas, dependencias, plazos o reintentos para obtener este resultado. Pandoc HTTP pendiente de otro binario sigue separado de la omisión Windows de package-smoke.

## Historial de CI conservado

La corrida anterior `44395790756` calificó `6383aa1`, antes de esta integración. En su intento 1: Ubuntu pasó en 40m31s, Windows pasó en 58m29s con el flaky C2 registrado, el paquete macOS pasó en 26m55s y macOS fast quedó cancelado tras 15m02s sin ejecutar pasos por falta de runner. Gate falló; no fue un verde integral. El intento 2 de macOS terminó cancelado a las 22:23:31 UTC del 2026-11-18 porque el avance real de main (SQL y menús) exigía resolver conflictos e integrar otro árbol. Esa cancelación no se atribuye a infraestructura; no se trasladan los jobs verdes reutilizados al nuevo head.

La CI del head final se actualizará en el mismo PR #181 sin otro commit. Su resultado, paquete y calificación de plataformas siguen pendientes; los verdes locales y de los SHA anteriores no se transfieren. Sin fusión del PR, publicación o instalación.
