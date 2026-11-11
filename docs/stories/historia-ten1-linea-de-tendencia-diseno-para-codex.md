# TEN-1 — Línea de tendencia en la dispersión (regresión lineal simple)

Público (decisión del propietario, 2026-11-11): prepa, universidad y maestría, sin complicar. Con esta historia, el nivel universidad deja de tener huecos en lo descriptivo: dispersión, correlación y recta de regresión con su ecuación y R². Las pruebas con valor p (t, chi², ANOVA) quedan fuera: la librería instalada no trae las distribuciones t ni F, y se decidirán aparte con el ADR 0021.

## Historia
Como estudiante que compara dos variables numéricas, quiero añadir a la dispersión una línea de tendencia con su ecuación, su R² y una frase que explique qué significa, calculadas con todos mis datos, para describir la relación sin salir de FreyaLab ni usar otra herramienta.

## Qué hay hoy (main a8dfc7f)
- **La dispersión** se construye en `src/shared/charts.ts`: el CTE `base` con `nx` y `ny` ya numéricos, y los puntos con `nx` y `ny` no nulos.
- **Se dibujan como mucho 2.000 puntos** (`chartLimit`: `scatter` → 2000), con la marca `limited`. **Por eso la tendencia no puede calcularse sobre los puntos dibujados.**
- **DuckDB, ya instalado**, tiene los agregados `regr_slope`, `regr_intercept`, `regr_r2`, `regr_count` y `corr`: exactos y sobre todo el alcance.
- **`simple-statistics`, ya instalada**, tiene `linearRegression`, `rSquared` y `sampleCorrelation`. Sirve de oráculo en las pruebas.
- **El análisis por columna** ya calcula una correlación con `sampleCorrelation` (`src/main/table-analysis.ts:95`).

## Diseño UX
**Opción a petición.**
- En Gráficos, con el tipo Dispersión, aparece la casilla **«Línea de tendencia»**, desmarcada al empezar. En los demás tipos no aparece.
- Con «Separar por» activo, la casilla está desactivada con el motivo «La tendencia se calcula sin “Separar por” en esta versión».

**Al marcarla.**
- La línea recta va sobre los puntos, entre el X mínimo y el máximo de los datos usados.
- En la leyenda aparece «Tendencia».
- Bajo el gráfico, y no solo dentro de él, va un bloque de texto que se lee y se copia:
  - «y = 2,13·x + 3,40»
  - «R² = 0,64 · r = 0,80 · 1.250 puntos»
  - Frase en lenguaje llano: «La recta explica el 64 % de la variación de Ventas. A más Precio, más Ventas.» Si la pendiente es negativa: «A más Precio, menos Ventas.»
  - Nota fija y breve: «Relación no es causa.»
- **Alcance**, con el rótulo habitual del gráfico: los mismos filtros del gráfico y de la vista. Si los datos son una muestra, se dice: «Calculada sobre la muestra».
- **Si se dibujaron menos puntos de los usados:** «Dibujados 2.000 de 1.250.000 puntos; la tendencia usa todos».

**Cuándo no hay línea.** La casilla se queda marcada y el texto dice por qué:
- Menos de 3 puntos con X e Y numéricos: «Hacen falta al menos 3 puntos».
- Todas las X iguales: «Todas las X son iguales: no hay una recta única».
- Todas las Y iguales: se dibuja la recta horizontal y se dice «Y no varía: R² no aplica».

**Formato.** Hasta 4 cifras significativas en pantalla, con el mismo criterio que AN-2. Los valores completos van en el título accesible del bloque y en las exportaciones.

**Exportar.**
- **SVG y PNG:** incluyen la línea y la ecuación.
- **Resultados en CSV y JSON del análisis:** añaden `trend: {slope, intercept, r2, r, n}`.
- **Informe Markdown del gráfico:** incluye el bloque de texto.

## Contrato técnico
- **Cálculo:** una consulta de agregados sobre el mismo `base` y el mismo alcance que los puntos:
  `regr_count(ny,nx)`, `regr_slope(ny,nx)`, `regr_intercept(ny,nx)`, `regr_r2(ny,nx)` y `corr(ny,nx)`, con `nx` e `ny` no nulos. Nunca sobre los puntos limitados.
- **Lectura de valores:** los mismos `nx` e `ny` que ya usa la dispersión: la misma conversión y las mismas exclusiones. Los textos y números fuera de rango no participan y se cuentan como hoy.
- **Casos límite del SQL.** Comprobado por Claude en el motor de la app (DuckDB-Wasm, main a8dfc7f), con el fixture de 5 puntos:
  - Normal: n 5, pendiente 0,6, ordenada 2,2, `regr_r2` 0,5999999999999999, `corr` 0,7746.
  - **X constante:** `regr_slope` = `nan`, `regr_intercept` y `regr_r2` = NULL, `corr` = `nan`.
  - **Y constante:** `regr_slope` 0, `regr_intercept` = Y, **`regr_r2` = 1,0** (estándar SQL) y `corr` = `nan`.

  **No muestres ese 1,0 como «explica el 100 %»:** cuando la varianza de Y es 0, el texto dice «Y no varía: R² no aplica». Trata `nan` y NULL como «no disponible». Deja estos tres casos en una prueba.
- **Cuándo se calcula:** solo cuando la casilla está marcada y el gráfico se genera. Nada se calcula al entrar (regla de AN-1).
- **Sin dependencias nuevas.** El dibujo, con las series de ECharts que ya se usan.

## Aceptación
1. **Fixture de 5 puntos** (x, y) = (1, 2), (2, 4), (3, 5), (4, 4), (5, 5):
   - pendiente 0,6, ordenada 2,2, R² = 0,6, r = 0,7746 (√0,6), n = 5.
   - Coincide con `simple-statistics` (`linearRegression`, `rSquared`, `sampleCorrelation`) con tolerancia de 1e-12.
   - El texto dice «y = 0,6·x + 2,2» y «R² = 0,6 · r = 0,7746 · 5 puntos».
2. **Con 300 000 filas generadas** (y = 3x + 1 más ruido determinista): la tendencia usa las 300 000 y la marca de dibujo dice que se dibujaron menos. La pendiente y R² coinciden con el oráculo sobre todas las filas, no sobre las dibujadas.
3. **Casos sin línea:**
   - X constante → «Todas las X son iguales…».
   - Y constante → recta horizontal y «R² no aplica».
   - 2 puntos → «Hacen falta al menos 3 puntos».
4. **Filtro del gráfico** («Grupo = A»): la tendencia y n cambian a ese subconjunto, y el rótulo de alcance lo dice.
5. **«Separar por» activo:** casilla desactivada con su motivo.
6. **Pendiente negativa:** la frase dice «menos».
7. **Al entrar en Gráficos** no hay consultas de tendencia. Al marcar la casilla, una sola, junto con la generación del gráfico.
8. **Exportaciones:** SVG y PNG con la línea y la ecuación, CSV y JSON con `trend`, y el informe Markdown con el bloque.
9. **Teclado y lector de pantalla:** la casilla, el bloque de texto (que se anuncia al actualizarse) y la leyenda. Capturas en claro y oscuro, en es y en-XA, a 1440×900.

## Fuera de alcance
- Regresión con varias variables, polinómica, logarítmica o exponencial.
- Intervalos de confianza de la recta y valores p.
- Una tendencia por serie con «Separar por».
- Residuos y diagnóstico.

## Entrega
Un PR en borrador, base `main`, rojo primero con el fixture de 5 puntos. Copia esta historia a `docs/stories/`. Informa: SHA, pruebas rojas y verdes con su salida, capturas, la comparación con el oráculo y la CI de las tres plataformas.
