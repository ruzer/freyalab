# SIM-1d · Sugerencias de gráfico con sentido

Base: `main 0260a5d05341e98a8ea97d5ced7330aa97f413c4`. [Alcance y siete respuestas ADR 0021](../stories/sim-1d-alcance-adr-0021.md), primer commit `55d448f`. Historia corregida conservada íntegra. Código y pruebas: `6c5b97b013cd0e8c422432aebf864eb52a0b385e`; el commit posterior solo añade evidencia. La CI de su head final aún debe calificarse.

Sin campos elegidos, una categoría propone contar filas. Categoría/texto más número propone Promedio en ambos órdenes de incorporación: Filas→Valores y Valores→Filas. En el segundo se usa el histograma previo como señal de agregación provisional; una Suma elegida en Barras se conserva al cambiar Filas/Columnas. Fecha+número conserva Suma mensual; dispersión conserva observaciones crudas y su predeterminado. Los identificadores no se sugieren como medidas. «Número de filas» cambia solo la presentación; el selector «Cuenta» permanece.

Son cinco archivos de producto, 8 inserciones y 6 borrados. `chartSQL` y `chartTotalSQL` son **idénticas byte por byte** a la base, comprobadas mediante AST. [Huellas completas de fuente y funciones SQL](sim1d-fuente-2026-11-19.json): 197 fuentes, SHA-256 conjunto `499636af962c785bad3ff59bd03c2cd7ec757a133ed66bf2c9e0f755a23b09fa`. Sin cambios de motor, IPC, dependencias, límites, guardado ni originales.

## Oráculos y rojo previo

La [encuesta sintética](../../tests/fixtures/chart-suggestions-survey.csv) conserva sus cinco registros, identificadores con ceros/entero inseguro e ingreso vacío. Las medias esperadas se calculan aparte del motor; el vacío participa en el conteo y se excluye de la media.

| Ciudad | Filas | Suma | Promedio |
| --- | ---: | ---: | ---: |
| Oaxaca | 3 | 401 | 200,5 |
| Puebla | 2 | 1.200 | 600 |

Antes de producto: unitarias Node24 con 10 fallos esperados/103 aprobadas; dos rojos de presentación es/en. Se conservaron además un rojo de dispersión y un rojo de Valores→Filas antes de sus condiciones mínimas. Las 49 combinaciones y los datasets existentes permanecen; los escenarios numéricos previos preparan su medida y Suma explícitamente.

El primer arranque unitario con **Node26.11.1 no califica**; se conservó y repitió con Node24.22.1. Un espía inicial leyó el request SQL en `args[2]` en vez de `args[1]`, causando `undefined.sql` antes del handler real. Se aisló mediante DOM/calls y se corrigió solo el observador; el original y el diagnóstico quedaron preservados. El rojo GUI válido se repitió después: dos fallos esperados sobre base fresca y un tercer rojo de Valores→Filas sobre el candidato anterior. No se atribuye aquella falla del espía a la app.

## Validación real y pendiente

| Comprobación | Resultado |
| --- | --- |
| Focus previo, incluida equivalencia DuckDB y 49 combinaciones | 218/218; 1,15 s; anterior a la última condición de orden |
| Unitarias completas después del ajuste final | **2.987 aprobadas / 1 omisión específica de Windows en macOS**, 167 archivos; **23,41 s** |
| Runtime final | Node24.22.1; Pandoc real3.12.1 con ruta explícita |
| Tipos / build del candidato final | **0 errores, 0 avisos / correcto** |
| Dos E2E públicas antes del último ajuste de orden | **2/2**, 8,4 s; cero reintentos, raíz |
| GUI de consumidores y tres públicas, una tanda | **126 aprobadas / 1 fallo**, 127 casos; **8,3 min; cero reintentos** |
| Comprobación enfocada tras adaptar el oráculo de presentación | **1/1 aprobado**, es/en, **14,8 s**, cero reintentos. Unión de 127 identidades aprobadas; no una tanda 127/127. |
| Recapturas posteriores de la fuente final4996 | **2/2 aprobadas**, 7,5 s; 16 PNG finales, raíz, fuente `4996`. |
| Revisiones estáticas independientes SPEC/Standards | **0 hallazgos**, incluida la microdelta de orden |
| Suite E2E local completa / CI del commit final | **No ejecutada / no calificada** |

El [spec público de tres casos](../../tests/e2e/chart-sensible-suggestions.spec.ts) tiene SHA-256 `fddd806157751e508ff55d0af8cc23b09b0c1c6fc0793c6feadbf0400749caf1`. Los verdes anteriores no se transfieren por sí solos a otro commit.

El único fallo de aquella tanda fue `chart-review`: esperaba «Cuenta/Count» donde la nueva presentación dice «Número de filas/Number of rows». Raíz corrigió solo ese valor esperado; conservó totales, datos y la cadena de aserciones. La comprobación enfocada pasó en ambos idiomas; las recapturas finales también pasaron. La comparación por AST conserva los oráculos de datos, títulos y plazos; esa única expectativa de presentación queda registrada como cambio intencional. No hubo otro cambio de producto: las unitarias completas anteriores siguen correspondiendo a la misma fuente.

## Capturas

[Catálogo de 32 PNG con SHA-256 y dimensiones](sim1d-capturas-2026-11-19.json): antes/después, propuesta/medida, es/en-XA, claro/oscuro, 1440×900/1280×720. Copias verificadas byte por byte. Las 16 «después» corresponden a la fuente final `4996`, después del ajuste de orden. Este catálogo final sustituye al registro provisional del candidato `a6ae`.

- Propuesta, es claro1440: [antes](sim1d-before-proposal-es-light-1440x900.png) · [después](sim1d-after-proposal-es-light-1440x900.png).
- Medida, es claro1440: [antes](sim1d-before-measure-es-light-1440x900.png) · [después](sim1d-after-measure-es-light-1440x900.png).

[Comandos y resultados reproducibles](sim1d-pruebas-2026-11-19.json). Las 127 identidades públicas son 124 existentes y tres nuevas. No se eliminó ninguna prueba ni se cambió un plazo o reintento. La suite E2E local completa de cierre de integración y la CI del head final siguen pendientes. Sin comprobación de instalación manual, fusión, publicación ni actualización de la app instalada.
