# PRJ-02a · Semántica 1, previa al motor

Fecha: 2026-11-16. Base `a30988ea4dff4e23891b219ba468ce6e9aa1d569`. Esta definición se registra antes de programar el ejecutor. La historia original se conserva sin editar en `historia-prj02-conjuntos-diseno-para-codex.md` (SHA-256 `8012a58ce476cb4aa3c2d8546c74224e5be5a4f34816d82c11481a91abb51050`). PRJ-02a cubre 1–12, 14 y 15; analizar un conjunto es PRJ-02b.

## Decisiones del propietario

Además de las cuatro decisiones E0 §8 confirmadas el 2026-11-16:

- `first` sin orden permite lectura de prefijo, con cobertura parcial y sin afirmar SHA-256 completo en esa ejecución. La comprobación rápida sigue sin probar identidad.
- Se rechaza un plan que exija materializar un orden completo no acotado. No se intercambia `order` con `random rows` para cambiar sus filas deterministas en silencio.
- Un proyecto futuro permanece sin escrituras; solo puede probar conjuntos que se validen por completo como semántica 1 conocida. Lo desconocido se conserva, no se ejecuta ni se degrada a una versión inferior.
- Texto: orden Unicode ordinal fijo, independiente del idioma y equipo. Puede diferir del alfabético habitual con acentos. No se cambia el orden del editor CSV existente.

## Aritmética y posiciones

Sea `M=2^64`. Sumas y productos del generador se reducen módulo M. Desplazamientos lógicos, comparación sin signo. La semilla int32 con signo se convierte módulo M: −1 se convierte en `ffffffffffffffff`, no en `00000000ffffffff`. No se convierte una palabra aleatoria a Number para elegir una fila.

Cada registro de datos CSV tiene un ordinal raíz desde 1, excluido el encabezado. Un campo multilínea sigue siendo un solo registro. Este ordinal nunca se renumera al filtrar, ordenar, proyectar o encadenar. Un segundo ordinal de llegada al paso permite devolver el depósito en el orden lógico correcto.

Los contadores públicos deben permanecer en el intervalo entero seguro de JavaScript; se rechaza el desbordamiento, no se aproxima. Las columnas conservan `{position,name}` de la raíz, aun después de proyectar; su ausencia en una fila no se rellena.

## Generador y depósito

SplitMix64 de la [referencia de Vigna](https://prng.di.unimi.it/splitmix.c), de dominio público. Estado inicial = semilla convertida; cada `next` suma primero `9e3779b97f4a7c15`, luego mezcla:

1. `(z xor (z >> 30)) * bf58476d1ce4e5b9`, módulo M.
2. `(z xor (z >> 27)) * 94d049bb133111eb`, módulo M.
3. `z xor (z >> 31)`.

Algorithm R, depósito K: los primeros K elementos se incorporan sin consumir aleatoriedad. En el elemento i posterior, se consume r hasta que `r < M − (M mod i)`; entonces `j=r mod i`. Si j<K, reemplaza el slot j. El rechazo evita el sesgo del módulo y fija el consumo del generador. Cada paso de depósito reinicia su propio generador con su semilla. La salida se ordena por llegada a ese paso, no por slot ni por sorteo. Si llegan menos de K, se devuelven todos y se comunica solo cuando se conoce esa cantidad.

Vectores literales trabajados antes del motor, semilla 0:

| next | Estado tras sumar | Palabra |
|---:|---|---|
| 1 | `9e3779b97f4a7c15` | `e220a8397b1dcdaf` |
| 2 | `3c6ef372fe94f82a` | `6e789e6aa1b965f4` |
| 3 | `daa66d2c7ddf743f` | `06c45d188009454f` |

K=2, entrada `[A,B,C,D,E]`: llena `[A,B]`; para C, primera palabra módulo 3 =1 → `[A,C]`; para D, segunda módulo 4 =0 → `[D,C]`; para E, tercera módulo 5 =4 → no reemplaza. Salida **`[C,D]`**. La entrada inversa `[E,D,C,B,A]` produce **`[C,B]`**: no autoriza adelantar el muestreo antes de ordenar.

## Porcentaje

`H(seed,p)=mix64((uint64(seed)+p*gamma) mod M)`. Es un hash de muestreo, no una huella de identidad ni un generador criptográfico. No consume el generador de depósito.

`T=floor(percent*M/100)`, usando aritmética racional exacta de la representación decimal canónica guardada del porcentaje. Se conserva si H<T. Para 100 %, T=M y no se reduce a cero. No se redondea a una cantidad fija de filas.

Semilla 0, posiciones raíz `[1,2,3]`: 25 % (T=`4000000000000000`) conserva **`[3]`**; 50 % (T=`8000000000000000`) conserva **`[2,3]`**; 100 % conserva **`[1,2,3]`**. Tras un filtro que deja `[2,3]`, el 50 % conserva ambas. Si llegan como `[3,2,1]`, el 50 % devuelve `[3,2]`.

El [desarrollo manual de semilla 7](prj02-semantica-1-vectores.md) fija el fixture completo: depósito de 3 → posiciones **`[2,3,6]`**, IDs **`00124`, `9007199254740993`, `00128`**; 50 % → **`[1,2,5,6,7]`**. Incluye divisiones, estados intermedios y una comprobación independiente C/Python anterior al motor. Las pruebas del producto usarán literales, no sus propias salidas como oráculo.

## Filas, orden y planes ejecutables

Se conservan valores como texto, normalización Unicode ninguna y espacios tal como están. Los operadores estrictos y límites de expresiones regulares se reutilizan de `compileTableQuery`. En conjuntos, el plegado sin distinción de mayúsculas usa `toLowerCase`, independiente del locale del sistema; los números usan Decimal y las fechas las reglas estrictas existentes. La comparación textual ordinal usa las unidades UTF-16 de la cadena, sin `localeCompare`. Los números inválidos quedan al final como hoy; los empates conservan el orden de llegada anterior. Estos comportamientos se documentan para conjuntos; las consultas del CSV conservan su comportamiento actual.

La interfaz guarda `filter → order → sample → select`, sin pasos vacíos. Un manifiesto manual conserva la secuencia original; el panel puede quedar solo para lectura. El plan se valida antes de abrir el flujo. Las condiciones no pueden referirse a una columna eliminada por un select anterior.

En un segmento de entrada no acotada se aplican filtros y porcentajes manteniendo sus contadores lógicos; el orden solo puede resolverse con una selección de los N primeros si después viene `first N`, o de las 100 primeras filas para la vista previa final. Un depósito previo o un first ya resuelto acotan la entrada de los siguientes pasos. Un orden no acotado seguido de un depósito aleatorio se rechaza antes de leer; no se cambia su semántica por conmutar operaciones. No hay archivos temporales, caché ni ordenación ilimitada en memoria. Contar no exige ordenar.

## Identidad y cobertura

Antes del recorrido: comprobación rápida, referencias y esquema completo de la cadena contra la fuente registrada. Si un nombre o posición cambió, se detiene antes de leer registros y se identifican los campos afectados. No se adivinan renombres.

Una ejecución completa calcula SHA-256 en el mismo recorrido de la versión en disco y compara con la fuente registrada. Si no coincide, descarta la vista previa y marca la fuente como cambiada. Si sí coincide, pero difiere del `sourceSha256` guardado en el conjunto, informa versión distinta sin impedir repetir las instrucciones.

Una ejecución de prefijo o cancelada conserva `complete:false`: no afirma identidad completa ni total global. Debe mostrar comprobación rápida y la falta de verificación completa, además de la cobertura parcial. Se mide el número real de bytes leídos, no solo el offset del último registro usado; una lectura adelantada de un bloque cuenta como bytes leídos. EOF significa haber examinado y validado todos los registros, no solo que una lectura adelantada haya obtenido los últimos bytes. Solo entonces, y tras verificar la huella, puede declararse completa.

Se distinguen registros raíz examinados, candidatos que llegan a cada muestra, filas seleccionadas por esa muestra y filas finales. En cadenas con varios pasos, se conserva esa información por paso; no se renombra un total intermedio como total de la fuente. La vista previa contiene hasta 100 filas, sin alterar el recuento final. Una cancelación informa parcial y no escribe nada.

## Límites de esta entrega

Sin analizar conjuntos, exportarlos, resultados físicos, obsolescencia, caché, SQL ni dependencias nuevas. Las fuentes y sus huellas no se modifican al probar. Persistir la definición reutiliza la escritura atómica y el conflicto de PRJ-01. Los tres límites del análisis existente permanecen intactos: esta entrega no conecta los conjuntos a DuckDB.
