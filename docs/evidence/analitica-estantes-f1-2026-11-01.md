# Historia 11 · F1: inferencia pura

## Plan y superficie de cambio (ECC / Ponytail)

Base: main `91abe2771ff61515d87c67d2df1457f4ec5bb26c`. Primer commit `591b39f`: copia literal de la historia de Claude; SHA256 del original y la copia `ff56ea9d32ed774ae58a259ebe5406113abccbd608178143d3d34d9f6dc098e4`.

Interfaces de prueba autorizadas por la tarea: `suggest(columns, shelves)` y `chartSQL(headers, options)`. La primera sólo propondrá opciones, una explicación traducible y alternativas. Los perfiles vienen de COLUMN-PROFILES; no se leen celdas ni se infieren tipos otra vez. Sin consumidores nuevos en la interfaz durante F1. Sin cambios de CSV, SQL, límites, exportación, IPC, guardado, persistencia, recuperación ni dependencias. Reversión: revertir el commit F1; el formulario actual no depende del módulo nuevo.

Secuencia: conservar historia → caso de regla en rojo → implementación mínima → siguiente regla y casos límite → equivalencia con opciones manuales y SQL existente → revisión de seguridad/calidad → comprobaciones del bloque y PR en borrador. No se construyen estantes, arrastre ni F2.

## ADR 0021 · siete respuestas antes de implementar

Referencia leída: `/Users/ruzer/Proyectos/LAB/docs/adr/0021-reuse-before-build.md` (no se modifica LAB).

1. **¿Existe una herramienta?** FreyaLab ya dispone de COLUMN-PROFILES, `ChartOptions`, `chartSQL`, DuckDB y ECharts. Se reutilizan. Falta únicamente elegir una configuración explicable a partir de perfiles/estantes. No se añade otro motor.
2. **¿Hay skills reutilizables?** Ponytail, TDD, ECC change-impact, coding-standards, security-review, accessibility y e2e-testing. Las guías de diseño se consultan para conservar explicaciones comprensibles y no introducir interfaz en F1. No se encontró una skill específica de Svelte en el catálogo ni en los directorios de skills consultados.
3. **¿CLI/API/MCP?** La integración mínima es una llamada TypeScript a tipos y funciones compartidos existentes. CLI/MCP no aportan nada a una decisión pura y local y no entran en el producto.
4. **¿Madurez, seguridad, mantenimiento y licencia?** No se adopta un componente externo ni se presume una versión nueva. Se conservan el código MIT del repositorio, las dependencias fijadas y sus avisos. La validación y el escape de identificadores permanecen en `chartSQL`; se comprobarán mediante su interfaz real. No se repite la auditoría del ecosistema aprobada.
5. **¿Coste de mantenimiento?** Un módulo puro y pruebas de reglas/contrato. Sin proceso, servicio, configuración, almacenamiento ni dependencia adicionales. No duplica el detector de tipos ni el generador SQL.
6. **¿Pegamento mínimo?** Leer el tipo ya calculado y los índices seleccionados, devolver `ChartOptions` compatibles, razón traducible y alternativas. Sin tocar los consumidores actuales en F1.
7. **¿Aporta valor escribirlo?** Sí: codifica sólo las reglas de producto solicitadas, que conectan perfiles y gráficos ya implementados. La alternativa sería seguir pidiendo al usuario combinaciones técnicas de selectores. No se reimplementa estadística, visualización o SQL.

## Contrato propuesto y decisiones a revisar antes de F2

- Entrada mínima: posición original, nombre y `ColumnProfile` existente (opcional si aún no hay perfil). No obliga a transportar frecuencias ni estadísticas que la inferencia no utiliza. Los tests obtienen los perfiles reales con `analyzeColumn`, sin un detector alternativo.
- `shelves` contiene sólo X/Y y la petición de distribución de F1. Color, filtros, estado Svelte, arrastre y persistencia de estantes no están implementados; no hay consumidor nuevo en `src/renderer`.
- Los perfiles individuales no prueban varios números dentro de cada grupo de otra columna. Se solicitó preferencia al propietario y se propone la lectura conservadora de la historia: `distribution:true` más `multipleValuesPerGroup:true`, aportado desde fuera para los mismos ejes/revisión/alcance. No se deduce de cardinalidades marginales ni se añade análisis. La ausencia o un falso mantienen barras y ofrecen histograma, con explicación. La preferencia solicitada no se presenta como aprobación recibida; este contrato queda para revisión antes de F2. F2 debe obtener e invalidar esa evidencia al cambiar fuente, ejes, revisión o alcance, nunca pedir al principiante que la invente.
- Se respetan X/Y cuando hay dos campos diferentes. Cuando Y no es una medida numérica se cuentan pares exactos en un mapa de calor, sin intercambiar ejes silenciosamente. Una sola variable numérica va al histograma, incluso si sólo se puso en Y; repetir el mismo campo no inventa una segunda variable.
- Sin columnas/selección o con posiciones inválidas/duplicadas: `options:null` y razón explícita, sin fabricar SQL. Los encabezados duplicados o vacíos sí son válidos: se identifican por posición. Las razones incluyen nombre original y posición para distinguirlos.
- `reason` es `{key, parameters}`, no un texto dependiente del idioma global. Usa los catálogos es/en y el pseudoidioma existente, sin importar `t()` en ejecución. F2 debe presentarlo como texto, no HTML.
- Las alternativas contienen opciones completas y válidas: conteo por X frente a la relación/medida sugerida, o inversión del orden de frecuencias cuando sólo hay una etiqueta. Caja ofrece suma por grupo e histograma sin agrupar. No ofrece identificadores como medidas numéricas.

## Tabla de reglas

| Entrada seleccionada | Propuesta |
| --- | --- |
| Fecha ISO en X + número en Y | Línea, suma mensual |
| Texto/categoría en X + número en Y | Barras, suma |
| Una columna textual | Barras, conteo de filas |
| Una columna numérica | Histograma, 10 intervalos (mismo valor inicial del formulario) |
| Dos columnas numéricas | Dispersión, pares sin agregar |
| Dos columnas textuales | Mapa de calor, conteo de combinaciones exactas |
| Texto + número, distribución y evidencia positiva de varios valores por grupo | Caja |
| Identificador/mixto/vacío/perfil ausente | Nunca se usa ese campo como medida numérica; explicación conservadora y alternativas compatibles |

Ningún límite cambia: `chartSQL` conserva sus validaciones, límites por tipo y calendario. No se generan SQL propios ni se leen filas en `suggest`.

## Rojo→verde real, por capacidad

Salidas completas conservadas en el archivo de evidencia de esta tarea; no se fabrican rojos para las regresiones que ya pasaban. Comando de cada paso: `npx vitest run tests/chart-suggest.test.ts`.

| Paso | Rojo | Verde |
| --- | --- | --- |
| Texto+número | 1 fallo funcional (`options:null` frente a barras/suma) | 1/1 |
| Fecha+número | 1 fallo +1 correcto | 2/2 |
| Número+número | 1 fallo +2 correctos | 3/3 |
| Texto solo | 1 fallo +3 correctos | 4/4 |
| Número solo | 1 fallo +4 correctos | 5/5 |
| Texto+texto | 1 fallo +5 correctos | 6/6 |
| Matriz 7×7 y precaución/alternativas | 33 fallos +22 correctos | 55/55 |
| Selecciones inválidas, sólo Y, campo repetido, sin columnas | 9 fallos +55 correctos | 64/64 |
| Razones es/en/en-XA | 3 fallos +65 correctos | 68/68 |
| Posición en razones para nombres vacíos/duplicados | 1 fallo +74 correctos | 75/75 |
| Distribución y evidencia explícita | 4 fallos +75 correctos | 79/79 |
| Razones de distribución traducibles | 3 fallos +79 correctos | 82/82 |

El primer sondeo, antes de existir el módulo, falló por importación y no se cuenta como rojo funcional; se creó un stub nulo y se conservó el fallo de comportamiento antes de implementar barras/suma.

## Equivalencia y revisión de seguridad/calidad

`tests/chart-suggest-sql.test.ts` usa la API Node bloqueante del DuckDB-Wasm ya instalado y su WASM local. No instala ni descarga otro motor, no cambia el motor de la app y no necesita red. Una instancia de memoria para el archivo de pruebas evita reiniciar Electron por cada combinación. DDL e inserciones parametrizadas sólo preparan datos sintéticos del test; las consultas propuestas son las de `chartSQL` sin editar. Esta prueba no sustituye la comprobación del aislamiento Chromium/IPC de los E2E existentes.

- 49 combinaciones de tipos por roles en la tabla pura y 64 combinaciones de columnas reales, con todas sus alternativas, aceptadas por el DuckDB real.
- Opciones manuales literales y SQL idénticos para las siete reglas. Valores contrastados independientemente: sumas 2/4.5, meses 1.5/5, conteos 1/2, pares (1.5,10)/(2,20)/(3,30), frecuencias conocidas de histograma, mapa de calor y medianas/cuartiles de cajas.
- Nombres con comillas, Unicode, duplicados, vacíos y una cadena `DROP TABLE` siguen siendo identificadores: después de consultar se comprueba que las filas y la tabla de memoria siguen intactas. No hay concatenación SQL de valores de usuario ni nuevo escape: se reutilizan `sqlColumns`/`quoteIdentifier` en el montaje y `chartSQL` en el resultado.
- Ceros iniciales y enteros inseguros conservan el perfil de identificador del motor real, incluidas las alternativas. Fechas ambiguas/inválidas no activan mes. Un perfil fallido no filtra su error técnico.
- `suggest` sólo tiene imports de tipos, no DOM/Svelte/Electron, disco, red, ejecución de SQL, reloj ni estado global. Arrays/perfiles congelados y cambio de idioma prueban estabilidad y ausencia de mutación. Las posiciones originales se conservan con 200 columnas.
- Accesibilidad/diseño aplicados aquí a explicaciones textuales, posiciones y razones localizables; no hay controles nuevos sobre los que afirmar contraste, teclado o lector de pantalla. La skill de UI basada en React/shadcn no autoriza incorporar esos componentes a este proyecto Svelte.
- No se usó Blueprint para generar varias entregas: F1 es un único PR. ECC change-impact delimitó consumidores y reversión; coding-standards y Ponytail mantuvieron el módulo en 55 líneas y reutilizaron perfiles/SQL. No se encontró skill Svelte específica. E2E conserva configuración, plazos, reintentos y todas las pruebas actuales.

## Comprobaciones locales

MacBook Pro M2 Max, 32GB; Node24.22.1; Pandoc externo3.12.1 para evitar omisiones de las unitarias. Los tiempos son observaciones, no garantías.

| Comando | Resultado real |
| --- | --- |
| `npx vitest run tests/chart-suggest.test.ts tests/chart-suggest-sql.test.ts` | 153/153, 2 archivos, cero omisiones; última ejecución 886ms |
| `npm run check` | Exit0, cero errores/advertencias |
| `FREYALAB_PANDOC_TEST_PATH=/opt/homebrew/bin/pandoc npm test` | 2258/2258, 115 archivos, cero omisiones,16.63s |
| `npm run build` | Exit0; renderer1.04s |
| `npm run test:e2e -- --workers=1 --retries=0` | Pendiente al congelar este commit; resultado y SHA se registran en el PR sin generar commits cosméticos |

SHA y resultado final de cada CI se registran en el PR sobre el head congelado; un verde anterior no se transfiere. Sin cambios en `src/renderer`, `charts.ts`, límites, exportaciones, dependencias, workflows ni pruebas anteriores.

## Lo no verificado / límites

F2–F5 no implementadas. Sin interfaz de estantes, arrastre, pruebas nuevas de controles visuales, a11y manual ni prueba con estudiantes/profesionales. No se implementa el cálculo/procedencia de evidencia por grupo; es responsabilidad del futuro consumidor antes de usar el indicador. Las sugerencias interpretan perfiles, no certifican significado semántico de las medidas. Los análisis sobre muestras seguirán necesitando su rótulo de alcance cuando F2 los integre. No se publican releases, no se fusiona y no se actualiza la app instalada.
