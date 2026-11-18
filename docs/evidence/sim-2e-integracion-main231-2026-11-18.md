# SIM-2e · Integración necesaria con main 23121eda

Fusión normal, sin reescribir historia, de `6383aa178abd242de2ae64be2b76305a4644fe3d` con `main 23121eda41fb9380c533a25ef86723046b6d7639`; base común `fd4e2a46845de95d7f7274f52fbd26cb0f63fcbc`. Main ya contiene las entregas del propietario #182, #183 y #184. El nuevo árbol requiere su propia calificación: no se trasladan verdes del head anterior ni se describe la cancelación de aquella CI como fallo de infraestructura.

Solo hubo conflictos en `es.json`, `en.json` y `pending-files.json`. La unión mecánica de tres vías dio **cero valores divergentes**. Cada catálogo conserva las 85 claves añadidas por main y las 73 añadidas por estadísticas; la retirada propia de `describe.provisional` se mantiene. Resultado: 1695 claves por idioma, sin duplicados. Se usaron las líneas originales sin recodificar escapes; se conserva la sangría de un espacio y el orden de main, añadiendo las claves propias en su orden anterior. No se ordenó ni reformateó todo el archivo.

La lista de pendientes conserva ambas retiradas: `CsvStatistics.svelte` y `CsvSql.svelte`. Pasa de 52 a 50 rutas, sin añadir ninguna ni cambiar las restantes o su orden. No se modifica metadata, dependencias, CI, límites ni reintentos.

Los bytes de los tres archivos de producto estadístico (`CsvStatistics.svelte`, `CsvDescribe.svelte`, `statistics-report.ts`) coinciden con los de `6383aa1`; sus hashes y el censo de catálogos están en [la prueba estructurada](sim-2e-integracion-main231-prueba.json). El código y las pruebas entrantes de main se conservan.

La evidencia anterior de SIM-2e corrige únicamente la identidad de la omisión unitaria: es la prueba exclusiva de Windows de `package-smoke`, omitida en Mac. Los recuentos 2936/1 y 2956/1 y todos los tiempos permanecen iguales. Pandoc 3.12.1 sin HTTP sigue siendo una limitación separada: ese caso retorna normalmente y no es el skipped contado por Vitest. Los logs y metadata históricos no se editan.

Estado al crear este commit: resolución y prueba estática terminadas; check, unitarias enfocadas y build del nuevo árbol pendientes. Unitarias completas se coordinarán cuando quede libre la GUI de consumidores grandes. La raíz ejecutará las 29 E2E enfocadas y comparará los bytes de las capturas antes de publicar un único head. Sin push ni PR nuevo, fusión del PR o publicación en esta fase.
