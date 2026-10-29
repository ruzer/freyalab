# TXT-01 · Corrección del oráculo binario en CI

El head f9c4a7e abrió el PR #90 y ejecutó CI 40816576329. Windows y Ubuntu fallaron en `csv-text-codec.test.ts:50`, **«detecta con el mismo prefijo y permite una secuencia UTF-8 incompleta al borde del prefijo»**, por agotar 5.000 ms. Los logs originales decodificados se conservan como txt-ci90-f9c4-windows.log y txt-ci90-f9c4-ubuntu.log. No se reintentó la CI para buscar un verde.

El fixture mantiene **1.048.583 bytes**: prefijo de 1 MiB + 4 con el euro empezando en su último byte, más el final restante. La comparación genérica `toEqual(Buffer)` enumera el buffer grande; en los runners agotó el tiempo. El resto de comprobaciones de codificación y solo lectura no falló. Se sustituye únicamente esa aserción por `Buffer.equals`, que compara **todos los bytes y la longitud** de ambos buffers. No se reduce el fixture, no se cambia la expectativa, no se omite el caso y se conserva el plazo de 5 s.

Resultados locales posteriores:

| Ejecución | Resultado |
|---|---|
| Archivo completo csv-text-codec | 57/57; 208 ms |
| `npm test` completo | 1.361/1.361, 69 archivos, 13,75 s |
| `npm run check` | salida 0; 0 errores y 0 avisos |

El cambio es exclusivamente del oráculo de prueba. **106 fuentes/archivos de paquete y 132 archivos compilados conservaron sus SHA-256** antes/después; no hay cambios en src, package, lockfile ni configuración de CI. Se conservan los manifiestos txt-ci90-testonly-before.json y txt-ci90-testonly-equivalence.json. No se reconstruyó el producto ni se repitieron las 414 E2E locales por este ajuste: sus resultados corresponden a las fuentes 8ac6f68, idénticas al producto actual.

El commit de prueba requiere una **CI nueva de las cuatro plataformas y del paquete sobre su propio head**. El fallo de f9c4a7e se mantiene como histórico. No se aplica la excepción de Apple silicon local del PR #86 a este PR.
