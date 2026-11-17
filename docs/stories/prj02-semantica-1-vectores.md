# PRJ-02a · Semántica 1: vectores de referencia con semilla 7

Fecha: 2026-11-16. Documento matemático anterior al motor de conjuntos. No importa, ejecuta ni copia código del motor de FreyaLab; no modifica el producto ni genera pruebas desde sus salidas.

Estos vectores fijan el comportamiento de **reservoir de tres filas** y **muestra aproximada del 50 %** sobre los siete registros del fixture de la historia. Dependen de las convenciones exactas siguientes; cambiar una de ellas requiere recalcular y revisar la referencia, no ajustar el test para aceptar el motor.

## Convenciones necesarias

- Aritmética sin signo de 64 bits; módulo `M = 2^64 = 18446744073709551616` después de sumas y productos. Desplazamientos lógicos.
- La semilla es el int32 con signo validado, convertido módulo M. Aquí es 7.
- SplitMix64 suma primero `gamma = 0x9e3779b97f4a7c15` al estado. Mezclador: xor con desplazamiento 30 y producto por `0xbf58476d1ce4e5b9`; xor con desplazamiento 27 y producto por `0x94d049bb133111eb`; xor final con desplazamiento 31. Es la variante de la [referencia pública de Sebastiano Vigna](https://prng.di.unimi.it/splitmix.c).
- Algorithm R llena los primeros K slots sin consumir una palabra. Para el registro i posterior se obtiene j uniforme en `[0,i)`: aceptar r solo si `r < M − (M mod i)` y usar `j = r mod i`. Sustituir el slot j únicamente si `j < K`.
- Los slots del depósito son 0-based; los ordinales de registros son 1-based. La salida recupera el orden de llegada al paso, no el orden de los slots.
- Para porcentaje, `H(seed,p) = mix64((uint64(seed) + p × gamma) mod M)`, donde p es el ordinal del registro CSV en la **fuente raíz**, excluido el encabezado. No es línea física de texto, byte offset ni índice tras filtrar.
- El 50 % usa el umbral exacto `T = M / 2 = 9223372036854775808 = 0x8000000000000000`. Se incluye si `H < T`, con comparación sin signo. Este cálculo no consume el generador del reservoir: es otra ejecución del paso.

## Fixture e identidad

Copia de referencia: `prj02-censo-reference.csv`, UTF-8 sin BOM, LF, con salto final. **211 bytes**, SHA-256 `bde31aec296f4b09823b940e59f4cf1cdf4cddf66882578d3128d3fff2aa8bb8`.

| Posición raíz | ID como texto | Particularidad que no se normaliza |
|---:|---|---|
| 1 | `00123` | Nota con un salto de línea dentro del campo entrecomillado |
| 2 | `00124` | Nota presente y vacía; la fila tiene cinco campos |
| 3 | `9007199254740993` | Identificador largo, permanece texto |
| 4 | `00126` | Ingreso presente y vacío |
| 5 | `00127` | Cinco campos presentes |
| 6 | `00128` | Nota ausente; la fila tiene cuatro campos |
| 7 | `00129` | Cinco campos presentes |

La posición raíz 1 ocupa dos líneas de texto. Eso no desplaza a la posición raíz 2. No se convierten los identificadores a números ni se rellena la Nota ausente con una cadena vacía.

## Palabras de referencia

El estado inicial es `0000000000000007`. La primera palabra se obtiene tras sumar gamma, no mezclando directamente la semilla.

| Sorteo / p | Estado tras sumar gamma | Palabra de 64 bits | Decimal sin signo |
|---:|---|---|---:|
| 1 | `9e3779b97f4a7c1c` | `63cbe1e459320dd7` | 7191089600892374487 |
| 2 | `3c6ef372fe94f831` | `044c3cd7f43c661c` | 309689372594955804 |
| 3 | `daa66d2c7ddf7446` | `e6984080bab12a02` | 16616101746815609346 |
| 4 | `78dde6e5fd29f05b` | `953aeb70673e29cb` | 10753165928301472203 |
| 5 | `1715609f7c746c70` | `73d33b666a1e21da` | 8346079845500723674 |
| 6 | `b54cda58fbbee885` | `3fdabe86cbbeaa11` | 4601199455465548305 |
| 7 | `538454127b09649a` | `77cbc4a133c2d0f6` | 8632209307422871798 |

Para porcentaje, la columna p identifica la posición raíz. Para reservoir, identifica el número de **sorteo**, que no es la posición del registro: el sorteo 1 se consume al llegar al registro 4 porque K=3.

## Reservoir: tres filas, semilla 7

Tras los registros 1, 2 y 3, el depósito es `[1,2,3]`; no se ha consumido ninguna palabra.

Cálculo explícito de los restos, por división entera:

- i=4: `7191089600892374487 = 4 × 1797772400223093621 + 3`.
- i=5: `309689372594955804 = 5 × 61937874518991160 + 4`.
- i=6: `16616101746815609346 = 6 × 2769350291135934891 + 0`.
- i=7: `10753165928301472203 = 7 × 1536166561185924600 + 3`.

Los límites de aceptación son respectivamente M, M−1, M−4 y M−2. Las cuatro palabras son menores que su límite: ninguna se rechaza y no se consume una palabra adicional.

| Registro que llega, i | Palabra usada | j | Acción | Slots después |
|---:|---|---:|---|---|
| 4 | `63cbe1e459320dd7` | 3 | No sustituye: j ≥ 3 | `[1, 2, 3]` |
| 5 | `044c3cd7f43c661c` | 4 | No sustituye: j ≥ 3 | `[1, 2, 3]` |
| 6 | `e6984080bab12a02` | 0 | Sustituye el slot 0 por la posición 6 | `[6, 2, 3]` |
| 7 | `953aeb70673e29cb` | 3 | No sustituye: j ≥ 3 | `[6, 2, 3]` |

Slots finales: **`[6,2,3]`**. Recuperando el orden de llegada, el resultado es:

1. Posición **2**, ID **`00124`**, Nota presente y vacía.
2. Posición **3**, ID **`9007199254740993`**, identificador largo intacto.
3. Posición **6**, ID **`00128`**, Nota ausente.

**Vector esperado:** posiciones raíz **`[2,3,6]`**, IDs **`["00124","9007199254740993","00128"]`**. Siete registros examinados, siete candidatos a la muestra, tres registros finales. Si se recorrió y verificó toda esta fuente, la cobertura es una muestra completa; no una lectura parcial.

## Porcentaje: aproximadamente 50 %, semilla 7

Se compara cada palabra con `0x8000000000000000`. Los valores cuyo primer byte es menor que `0x80` entran. No se redondea la cantidad a tres o cuatro registros: es un criterio por fila y su cantidad es aproximada.

| Posición raíz | ID | H(7,p) | H < umbral |
|---:|---|---|---|
| 1 | `00123` | `63cbe1e459320dd7` | Sí |
| 2 | `00124` | `044c3cd7f43c661c` | Sí |
| 3 | `9007199254740993` | `e6984080bab12a02` | No |
| 4 | `00126` | `953aeb70673e29cb` | No |
| 5 | `00127` | `73d33b666a1e21da` | Sí |
| 6 | `00128` | `3fdabe86cbbeaa11` | Sí |
| 7 | `00129` | `77cbc4a133c2d0f6` | Sí |

**Vector esperado:** posiciones raíz **`[1,2,5,6,7]`**, IDs **`["00123","00124","00127","00128","00129"]`**. Son cinco filas de siete, no un 50 % exacto. Se conserva el campo multilínea de la posición 1; la Nota vacía de la posición 2 sigue siendo distinta de la ausente de la posición 6.

El texto de cobertura debe decir «aproximadamente 50 %», acompañado de cinco filas finales y siete candidatas/examinadas. No debe presentar cinco de siete como una fracción exacta de 50 % ni como una lectura parcial.

## Verificación independiente realizada

1. `splitmix64-reference.c`: función pública de Vigna más un driver mínimo que inicializa el estado en 7 e imprime siete palabras. No incluye FreyaLab.
2. `verify-arithmetic.py`: cálculo separado con enteros arbitrarios, estados de la forma `(7 + p × gamma) mod M` y reducción explícita después de cada producto. Comprueba que sus siete estados, palabras y valores decimales coinciden con la salida C. Conserva también los dos productos intermedios en `seed7-vectors.json`.
3. Las cuatro divisiones y la evolución del depósito se exponen arriba para poder revisar los resultados sin ejecutar ningún motor. El comparador del 50 % se puede comprobar directamente en las palabras hexadecimales.

Comandos ejecutados, desde `experiments/prj02-reference/`:

```sh
clang -std=c11 -Wall -Wextra -Werror splitmix64-reference.c -o splitmix64-reference
./splitmix64-reference > reference-c-output.txt
python3 verify-arithmetic.py > arithmetic-verification.log
```

Resultado real: **siete palabras coincidentes**, cuatro restos coherentes, reservoir `[2,3,6]` y porcentaje `[1,2,5,6,7]`. El SHA de cada archivo textual se conserva en `SHA256SUMS.txt`; no se incorpora el ejecutable de referencia al producto.

## Límites y decisiones que este vector no adelanta

- Se respetan las tres aclaraciones del propietario: first sin orden puede leer el prefijo con cobertura parcial, sin afirmar un hash completo de esa ejecución; los planes que exigen materializar el orden completo se rechazan, sin intercambiar orden y muestra; los proyectos futuros solo pueden probar conjuntos completamente validados con semántica 1, conservando lo desconocido sin ejecutarlo ni escribirlo.
- Estos dos vectores usan el orden original y no resuelven la colación de texto, fijada por el propietario como Unicode ordinal. No contienen un paso order; el comparador se define en el contrato de semántica 1.
- No se ejecutó el motor de conjuntos, ninguna prueba del producto, una medición de 1 GB ni CI. Tampoco se afirma todavía una implementación correcta: estos valores son la referencia previa contra la que comprobarla.
