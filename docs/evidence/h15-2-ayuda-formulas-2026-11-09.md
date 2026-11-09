# H15-2 · Ayuda para escribir fórmulas

Base de la entrega `5a256a91bd454681f4e13b45ce9477f3eb4f1db1`. [Alcance y respuestas del ADR 0021](../stories/h15-2-alcance-adr-0021.md).

## Rojo → verde

| Caso | Rojo en la base | Verde en la rama |
| --- | --- | --- |
| Ejemplos y decimales | Faltaban el catálogo de ejemplos, los botones y la sugerencia de escala. | Los ocho ejemplos eligen columnas reales y calculan resultados comprobados en Electron. Las unitarias cubren escala decimal, nombres con comillas y columnas de tipo incompatible. |
| Encabezado y paleta | El encabezado y la paleta carecían de la acción de cálculo. La primera implementación reveló que Mayús+F10 abría el menú estructural sin el índice de la columna. | Mayús+F10 conserva el encabezado de origen e inserta a su derecha. El comando se encuentra en la paleta. Los nuevos accesos reutilizan el motivo de bloqueo de la barra para la muestra y el límite de 200 columnas. En archivos grandes, el menú y la paleta muestran el motivo de solo lectura. |
| Catálogo de funciones | No había lista visible ni una fuente compartida con el validador. | El desplegable contiene el mismo catálogo que usa el validador. Una unitaria compara el conjunto con la lista permitida en H15-1. |
| Valores usados | El resultado mostraba una lista JSON en vez de los nombres de columnas y los valores. | Se lee «Precio unitario: 10.10 · Cantidad: 3». Las pruebas distinguen «(vacío)» y «(sin campo)». Se conserva el límite de ocho muestras y un presupuesto de texto por muestra. |

Los ejemplos verifican multiplicación, porcentaje, redondeo, año, mes, concatenación, condición y valor alternativo. Se comprueban el anuncio de inserción, el foco restaurado, en-XA y colores forzados. La prueba de paleta verifica el acelerador configurado y ejecuta la acción del menú nativo de Electron. El texto de error que devuelve el motor puede seguir en inglés en el detalle técnico.

## Verificación local

| Comando | Resultado en macOS Apple silicon |
| --- | --- |
| `npm run check` | 0 errores y 0 avisos. |
| `npm test` | 2.617 pruebas aprobadas y una omitida porque el Pandoc local no admite HTTP. |
| `npm run build` | Compilación aprobada. |
| `npx playwright test tests/e2e/structure.spec.ts tests/e2e/calculated-column.spec.ts --project=csv --retries=0` | 17 aprobadas, 0 reintentos. |

[Claro, 1440×900](h15-2-claro-1440x900.png) · [Oscuro en-XA, 1440×900](h15-2-oscuro-en-XA-1440x900.png) · [Colores forzados en-XA, 1440×900](h15-2-colores-forzados-en-XA-1440x900.png).

## Límites de la verificación

No se volvió a medir la carga de 200.000 filas en esta fase. La [medición de H15-1](h15-1-columna-calculada-2026-11-09.md) registró una mediana de 4,54 s en ARM y 16,27 s en Intel para la vista previa y la aplicación. Esos tiempos corresponden a H15-1. El perfilado de ayuda depende de cuántas columnas haga falta explorar. La prueba de la paleta no equivale a pulsar el atajo en un teclado físico. Dividir y combinar conservan su vista previa, que compara texto antes y después.
