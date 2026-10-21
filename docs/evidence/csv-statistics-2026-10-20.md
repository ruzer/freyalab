# Panel estadístico CSV — evidencia local

Fecha local: 20 de octubre de 2026. Base `1ef4665bc22f359de08b32310cd34a6c818af165`, fuentes de `codex/csv-column-statistics` aún sin commit durante las mediciones. El JSON conserva hashes SHA-256 de los dos módulos de Main/worker compilados para identificar el código medido; no se atribuye a un instalador publicado.

## Funcionalidad y regresión

- Dos regresiones del motor fallaron antes de ampliar stats: todas las filas se interpretaban como selección vacía y las columnas inválidas de una tabla vacía no se rechazaban.
- `npm run check`: cero errores y advertencias. `npm test`: 34 satisfactorias. `npm run test:e2e`: 24 satisfactorias, incluye construcción completa.
- Nuevas pruebas: documento completo/selección vacía, datos pendientes, ceros iniciales, ID mayor que 2^53 excluido de cálculo sin alterar el texto, fórmula conservada sin evaluar, comillas, multilinea, encabezados duplicados por índice; revisión/historia y archivo original intactos.
- Interfaz: columnas marcadas/todas, alcance completo con búsqueda activa, invalidación después de editar, reanálisis, Escape/foco, cancelación sin mocks del puente, muestra explícita, argumentos IPC inválidos y rechazo por más de 100 columnas.
- Capturas claro/oscuro a 1440×900 y claro a 1280×800. Inspección visual local; no certificación de contraste ni prueba con lector de pantalla. Las pruebas nuevas reutilizan el motor tabular y no cambian guardado o recuperación.

## Medición exploratoria en Electron

Apple M2 Max, 32 GiB RAM, macOS 27.0.1 arm64, Node.js v24.22.0. Un perfil nuevo por caso. Archivos sintéticos: cuatro columnas (Código/Valor/Grupo/Nota, texto Unicode y algunos campos multilínea), y un caso adicional estrecho con una columna. Instrumentación temporal fuera del repositorio; no se añade CLI ni comando de producto.

Se mide apertura a través de la API real, filtro (Grupo A o búsqueda de `000` en una columna), orden descendente numérico de todas las filas cargadas y estadísticas de una columna sobre todas las filas cargadas. Heartbeat del renderer cada 25 ms desde antes de abrir; incluye espera de renderizado y estabilización. Son intervalos de temporizador, no latencia de entrada ni tiempo de cada interacción visual. Cada caso tiene una única observación: p95 en casos breves tiene pocas muestras y no permite garantías.

| Filas solicitadas × columnas | Bytes CSV | Modo real | Abrir ms | Filtrar ms | Ordenar ms | Estadística ms | RAM worker MiB al terminar | Heartbeat p95 / máximo ms |
|---|---:|---|---:|---:|---:|---:|---:|---:|
| 100 × 4 | 2,533 | Completo | 186.4 | 2.9 | 3.4 | 1.4 | 74.5 | 188.9 / 188.9 |
| 3,000 × 4 | 74,808 | Completo | 192.0 | 2.3 | 6.2 | 1.7 | 84.5 | 193.3 / 193.3 |
| 100,000 × 4 | 2,492,905 | Completo | 370.3 | 11.4 | 186.4 | 19.7 | 146.9 | 31.5 / 192.8 |
| 1,000,000 × 4 | 24,928,915 | Muestra (200 filas) | 998.3 | 1.7 | 2.6 | 1.2 | 258.5 | 26.2 / 191.7 |
| 1,000,000 × 1 | 8,000,008 | Completo | 932.3 | 82.3 | 1266.0 | 283.7 | 411.9 | 26.1 / 191.9 |

**Un millón × cuatro columnas es una muestra, no análisis global.** Supera dos millones de celdas aunque ocupe menos de 50 MiB. Tiempos de filtros/sort/estadísticas de esa fila solo abarcan 200 registros. El caso de un millón × una columna cabe en los límites; esto no demuestra capacidad equivalente con otras anchuras o textos. El encabezado cuenta para el límite de celdas.

RAM: workingSetSize del utility process «FreyaLab CSV», capturada al terminar las operaciones; no pico medido ni suma de toda la app. El JSON guarda métricas de procesos y muestras de heartbeat. El consumo al abrir una muestra puede reflejar trabajo de lectura previa antes de alcanzar el límite, no solo sus 200 filas retenidas. No se midió hardware de Windows/Linux, instaladores ni rendimiento bajo concurrencia. Las observaciones previas se conservan en `local-2026-10-20.md` y no se sustituyen.

[Datos brutos](csv-statistics-profile-2026-10-20.json).

## Límites de la entrega

Panel de hasta 100 columnas por consulta; cada columna se calcula con stats existente, en segundo plano. Cancelar descarta resultados y evita las siguientes columnas, sin interrumpir el cálculo actual. Operaciones numéricas aproximadas; los enteros no seguros se excluyen. No hay mediana, desviación, frecuencias, pivot, DuckDB, SQL ni formatos nuevos. Los PR #6 y #7 siguen siendo entregas separadas pendientes de integración. No se publican binarios.

CI de esta rama: consultar el PR; estos resultados locales no acreditan por sí solos las otras plataformas.
