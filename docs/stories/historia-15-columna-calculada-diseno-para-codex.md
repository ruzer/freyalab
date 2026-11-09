# Historia 15 — Columna calculada en CSV («como en una hoja, sin dejar de ser CSV»)

Diseño: Claude. Implementa: Codex. Decide y fusiona: el propietario.
Alcance: CSV/TSV editables en vista Tabla. Las muestras de archivos grandes quedan fuera (la orden aparece desactivada, con su motivo).
Decisión D1 (propietario, 2026-11-09): la fórmula usa expresiones de DuckDB, el motor que ya usa Análisis. No se escribe un intérprete de fórmulas propio.

## Historia
Como persona que llega desde Excel o Google Sheets, quiero añadir una columna calculada a partir de otras («Precio unitario × Cantidad», «año de la fecha», «Mayorista si Cantidad > 10») y ver el resultado antes de aplicarlo, sin salir de FreyaLab y sin estropear mi CSV.

## Evidencia (app real, macOS arm64, `main` f431edc; el sondeo está fuera del repo)
- **No hay forma de añadir una columna derivada.** Transformar documento ofrece ocho operaciones (dividir, combinar, duplicados, NFC, encabezados, mover filas, mover columnas, fijar orden), y «combinar» solo junta texto. Operaciones solo limpia y duplica.
- **Análisis SQL calcula, pero el resultado no vuelve al documento.** Solo pagina y abre un informe Markdown. Además se corta en 10 000 filas (`limited`) y no se puede exportar como CSV.
- **Lo que tendría que escribir una persona** en `ventas.csv` (`Producto,Precio unitario,Cantidad,Fecha`):
  - `"Precio unitario" * Cantidad` falla con un mensaje técnico en inglés: «No function matches the given name and argument types '*(VARCHAR, VARCHAR)'».
  - Con `CAST(… AS DOUBLE)` falla en la primera celda vacía: «Could not convert string '' to DOUBLE».
  - Solo funciona con `TRY_CAST(NULLIF(TRIM(col),'') AS DECIMAL(38,2))` en cada columna: 10.10 × 3 → `30.3000`, 0.1 × 3 → `0.3000` (exacto), vacío → NULL, `1e2` × 1 → `100.0000`.
- **Fechas.** `TRY_CAST(Fecha AS DATE)` acepta `2026-01-05`, mientras que `05/01/2026` y `2026-02-30` dan NULL sin aviso. `year()` e `if(condición, a, b)` funcionan en DuckDB-Wasm.
- El archivo quedó intacto después de las consultas.

## Diseño UX
### Dónde se abre
- Operaciones → **Añadir columna calculada…**
- Paleta de comandos (Ctrl/⌘ + K).
- Menú contextual del encabezado: **Calcular columna a la derecha**.

Todos abren un diálogo modal con el patrón de Transformar documento: opciones → **Vista previa** → **Aplicar**. Escape cierra el diálogo y devuelve el foco a donde estaba.

### El diálogo, de arriba abajo
1. **Nombre** de la columna nueva. Por defecto «Calculada»; si ese nombre ya existe, propone «Calculada 2». Posición: a la derecha de la columna desde la que se abrió, o al final si se abrió desde el menú.
2. **Fórmula** en una línea. Los nombres de columna se escriben tal cual. Junto a la línea, una lista **Columnas** inserta cada nombre ya entrecomillado (`"Precio unitario"`), así que lo básico no exige saber SQL. Los nombres son los del mapa de columnas de SQL directo (encabezados vacíos, repetidos o largos).
3. **Cómo leer cada columna usada.** Aparece en cuanto la fórmula usa una columna, con tres opciones:
   - **Texto**, la opción por defecto.
   - **Número**, con 0–12 decimales, como en Agrupar. Se traduce en `TRY_CAST(NULLIF(TRIM(col),'') AS DECIMAL(38,s))`.
   - **Fecha AAAA-MM-DD**. Se traduce en `TRY_CAST(col AS DATE)`.

   FreyaLab propone la opción a partir del «tipo probable» del perfil de columnas, pero el usuario la confirma: nada se convierte en silencio.
4. **Ejemplos.** Botones que escriben la fórmula con columnas reales del documento: multiplicar, porcentaje (`a / b * 100`), redondear (`round(x, 2)`), año y mes de una fecha, juntar textos (`a || ' ' || b`), condición (`if(Cantidad > 10, 'Mayorista', 'Minorista')`) y valor si está vacío (`coalesce(x, 0)`). Cada ejemplo lleva una línea de explicación en es y en.
5. **Si una fila no se puede calcular.** Dos opciones: «dejar la celda vacía» (por defecto) o «no aplicar si alguna fila falla».
6. **Vista previa.** Muestra:
   - el total de filas;
   - cuántas filas quedan vacías;
   - cuántos valores no se pudieron leer, por columna;
   - hasta ocho ejemplos con la forma «fila · valores usados → resultado».

   Los errores de DuckDB se traducen a un mensaje claro que nombra la columna, por ejemplo: «"Precio unitario" se está leyendo como texto. Elige "Número" en Cómo leer cada columna.». El texto original queda en «Ver detalle técnico», como en SQL.
7. **Aplicar** añade la columna en un solo paso que se puede deshacer. El documento queda con cambios sin guardar; Guardar sigue siendo una acción aparte.

### Qué se escribe en el CSV
- Solo el valor, como texto, sin fórmula viva: el CSV sigue abriéndose en cualquier programa. El diálogo lo dice en una línea: «Se guardan los valores. Si cambian las columnas de origen, vuelve a calcular».
- Los números se escriben con punto decimal y sin notación exponencial. La escala la decide DuckDB (por ejemplo, `30.3000`); para fijarla, el usuario usa `round(x, 2)` o elige los decimales al leer la columna.
- Las fechas se escriben en formato AAAA-MM-DD; los booleanos, como `true` y `false`; NULL, como celda vacía.
- Las demás columnas no cambian ni un byte.

## Contrato
- **Operación.** Transformar documento recibe una nueva operación, `calculate`, con estos campos: `name`, `position`, `expression`, `columns:[{index, read:'text'|'number'|'date', scale?}]` y `onError:'empty'|'abort'`. Se valida con zod en `main/index.ts`, como las demás, y comparte con ellas revisión, `requestId`, progreso, cancelación, vista previa y aplicación.
- **Dónde se evalúa.** En DuckDB-Wasm, en la ventana aislada de Análisis, sobre **todas las filas actuales del documento**, con los cambios pendientes incluidos y sin filtros ni orden de la vista. Cada fila viaja con un número de fila interno, y el resultado vuelve a su fila por identidad: nada depende del orden en que DuckDB devuelva las filas.
- **Solo una expresión.** FreyaLab construye la consulta (`SELECT __fila, (<expresión>) FROM <vista con columnas leídas> ORDER BY __fila`) y acepta una única expresión escalar. Se rechazan:
  - varias sentencias;
  - subconsultas;
  - otras tablas;
  - funciones de tabla (`read_csv` y similares);
  - agregados y funciones de ventana (los cálculos entre filas son H15-3).

  La validación usa el analizador de DuckDB o el mecanismo que ya valida SQL directo, no expresiones regulares sobre el texto. Mantiene las mismas protecciones: sin archivos, red ni extensiones, y un límite de 2 minutos.
- **Resultado completo, sin el tope de 10 000 filas.** El resultado vuelve en lotes hasta los límites del documento: 2 M de celdas, 50 MiB, registros de 1 MiB, 200 columnas y 20 MiB de presupuesto de deshacer. Si se supera alguno, se rechaza con un mensaje claro y sin cambios parciales.
- **Valores exactos.** Llegan como el texto que produce DuckDB. JavaScript no los reinterpreta: nada de `Number` ni de redondeos.

## Entrega en 3 PR (borrador, base `main`, pruebas rojas primero)
- **H15-1 Columna calculada (M).** La operación `calculate`, la conexión con DuckDB, y el diálogo con nombre, fórmula, cómo leer cada columna, vista previa, aplicar y deshacer. También los mensajes de error traducidos para los fallos más comunes (columna leída como texto, columna inexistente, tipo incompatible, división por cero si DuckDB la señala). Entrada desde Operaciones.
- **H15-2 Ayuda para escribir (S).** Los ejemplos con columnas reales, la entrada desde el menú contextual del encabezado y desde la paleta, y la ayuda «Cómo escribir fórmulas» en `docs/EDITOR-MENUS.md`.
- **H15-3 Cálculos entre filas (M, después, con decisión).** Diferencia con la fila anterior, media móvil y % del total, sobre el orden del documento o un orden explícito. Antes hay que decidir qué orden se usa cuando la vista está ordenada.

## Aceptación de H15-1
- **Prueba roja.** En `Producto,Precio unitario,Cantidad`, con Precio leído como Número(2) y Cantidad como Número(0), `"Precio unitario" * Cantidad` añade «Total» con `30.30` para 10.10 × 3 y `0.30` para 0.1 × 3, nunca `0.30000000000000004`.
- **Vacíos e ilegibles.** Las celdas vacías y los textos no numéricos dan celda vacía y se cuentan por columna en la vista previa. Con «no aplicar si alguna falla», nada cambia.
- **Bytes intactos.** Al guardar, la única diferencia por registro es el campo añadido. Se comprueba con `000124`, `9007199254740993`, comillas, saltos dentro de comillas, CRLF, BOM, delimitador `;`, TSV, Windows-1252 y UTF-16 LE.
- **Vista filtrada.** Con búsqueda, filtros y orden descendente activos se calculan todas las filas y cada valor cae en su fila.
- **Cambios pendientes.** Si se edita una celda sin guardar, el cálculo usa el valor nuevo.
- **Deshacer.** Quita la columna en un paso y rehacer la repone. Guardar después conserva el orden del documento.
- **Rechazos sin cambios** y con mensaje claro:
  - varias sentencias, `SELECT`, `read_csv('…')`, `sum(x)`, `avg(x) OVER ()` y una columna inexistente;
  - un documento que pasaría de 200 columnas, un registro de más de 1 MiB y un cambio que supera el presupuesto de deshacer.
- **Cambio en disco** durante la vista previa: se comporta como Transformar, que invalida y pide revisar el documento.
- **Muestras parciales:** la orden aparece desactivada y explica por qué.
- **Cancelar** la vista previa o la aplicación no deja ningún cambio.
- **Tiempo:** medir con 200 000 filas × 6 columnas en ARM y en Intel, e informarlo. Si pasa de 10 s en ARM, proponer un límite en el PR antes de seguir.
- **Accesibilidad:**
  - el diálogo tiene nombre y todos los controles tienen etiqueta;
  - se usa entero con teclado;
  - anuncia «vista previa lista» y «columna añadida»;
  - textos en es, en y en-XA;
  - funciona con colores forzados y con movimiento reducido;
  - la fórmula admite IME y acentos.

## Casos límite
- **Documento sin fila de encabezados:** solo se añaden valores. El nombre no se escribe, y el diálogo lo indica.
- **Nombre repetido:** se permite, porque CSV lo admite, pero se avisa y se propone un sufijo.
- **División por cero:** comprobar qué hace DuckDB con DECIMAL. Si devuelve NULL, la celda queda vacía y se cuenta. Si da error, se trata como fila fallida.
- **Resultados no escalares** (listas o structs): «La fórmula debe dar un valor por fila».
- **Fechas en otro formato:** dan celda vacía, se cuentan y se avisa de que no tienen formato AAAA-MM-DD. No se adivina el formato.
- **Encabezados raros:** los vacíos, repetidos o de más de 128 unidades se escriben con el nombre SQL inequívoco del mapa.
- **Documento de solo lectura** o con conflicto externo pendiente: la orden está desactivada y explica por qué.

## Plan de pruebas
- **Unitarias:**
  - el esquema;
  - el constructor de la consulta, incluida la prueba de que la expresión no puede salir del `SELECT`;
  - cada rechazo;
  - la correspondencia por número de fila;
  - NULL → celda vacía;
  - los límites y el presupuesto de deshacer.
- **E2E, proyecto `csv`:**
  - el flujo del diálogo, la vista filtrada y ordenada, y los cambios pendientes;
  - deshacer y rehacer;
  - el diff de bytes al guardar con las codificaciones de la aceptación;
  - los rechazos y la cancelación;
  - la accesibilidad y las capturas en 1440×900, claro y oscuro, y en-XA.
- **Medición:** 200 000 filas en ARM y en Intel, con la mediana de tres ejecuciones.

## Reglas comunes
Sin dependencias nuevas (ADR 0021; las 7 preguntas en cada PR). Se reutilizan DuckDB-Wasm, el diálogo y el motor de Transformar documento, zod, el mapa de columnas SQL y el perfil de tipos. No se cambian SQL directo ni sus límites ni la protección de fórmulas de la exportación. Una historia por PR, en borrador, base `main`. Informa head, rojo → verde, qué verificaste y qué no.

## Fuera de alcance
- Fórmulas vivas que se recalculan solas y referencias a celdas como `A2`.
- Sobrescribir una columna existente.
- Cálculos entre filas (H15-3).
- Usar otras tablas.
- Convertir fechas que no están en AAAA-MM-DD (otra historia).
- Funciones definidas por el usuario.

## Riesgos que Codex debe dejar escritos en el PR
1. **Velocidad.** DuckDB-Wasm está en una ventana aislada, y llevar todas las filas allí y traer el resultado puede ser lento cerca de 2 M de celdas. Hay que medirlo y proponer el límite si no cabe.
2. **El dialecto no es el de Excel** (`||`, `if()`, `round()`). Lo compensan los ejemplos y los mensajes; anotar qué errores siguen saliendo en inglés.
3. **Una expresión podría intentar leer otras tablas o archivos.** El constructor tiene que impedirlo, y las pruebas tienen que demostrarlo.

## Informa
Head; rojo → verde; tiempos con 200 000 filas en ARM y en Intel; qué fórmulas de ejemplo probaste; qué errores de DuckDB tradujiste y cuáles quedan en inglés; capturas; las 7 preguntas del ADR 0021.
