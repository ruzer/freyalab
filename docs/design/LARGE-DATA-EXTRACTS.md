# E0 — Editar archivos grandes y trabajar con extractos

Fecha: **24 de octubre de 2026**. Estado: **evaluación; no cambia el producto**. Rama `codex/e0-extractos`, worktree independiente. Base de producto `36c99766d62aca23792d1c28cabebd66422f069e`; el checkout del usuario y la aplicación instalada no se modifican.

## Decisión propuesta

Conservar el modelo textual de FreyaLab, el índice y la futura **capa de cambios con diario de L3**. La edición completa de CSV/TSV de varios GB sigue siendo el objetivo. Un extracto es una capacidad adicional para trabajar explícitamente con un subconjunto, no una sustitución del editor grande.

No adoptar otro motor ni distribuir Python en E0. Python `csv` proporciona un oráculo independiente; pandas ya instalado permite un comparador adicional. DuckDB CLI es sólo un comparador, no una propuesta de invocarlo desde la aplicación. Los resultados de velocidad no satisfacen por sí solos las puertas de aislamiento, cancelación, empaquetado y versiones del [RFC §7.4](LARGE-FILE-EDITOR-RFC.md#74-decisión).

Este documento y los experimentos implementan **únicamente E0**. Crear extractos desde la interfaz, guardar recetas, actualizar `AGENTS.md` y desarrollar L3–L9 requieren sus siguientes entregas. El usuario pidió **proponer la actualización de `AGENTS.md` después de E0**; aquí queda intacto.

## 1. Paridad y dependencias reales

La [matriz por acción](../../experiments/large-data-extracts/PARITY.md) inventaría apertura, navegación, selección, edición, portapapeles, búsqueda, filtros, ordenamiento, transformaciones, historial, estadísticas, gráficos, SQL, exportación y guardado. Se verificó contra SHA inmutables:

- `main@db9f462` y `main@36c9976` tienen el mismo producto; #58 sólo corrige una prueba de desplazamiento.
- #57/L2 `b5e379f` añade lectura grande paginada, no edición completa. Se describe por separado de `main`.
- SQL/gráficos tienen una ruta sobre el original completo, pero **256 MiB por fuente y ocho millones de celdas**, contabilizadas antes del filtro. Filtrar desde esos paneles no permite cargar un archivo de 1 GiB. Incluso el archivo de ventas de 100 MiB excede ese límite de celdas.
- E1 podría producir un documento pequeño editable; si el resultado supera 50 MiB o dos millones de celdas, continúa necesitando el modo grande y L3. «Extraído» no significa «editable íntegramente hoy».

| Capacidad sobre el documento grande | Entrega necesaria | Relación con extractos |
|---|---|---|
| Lectura paginada y posición | L2 / #57 | Base de navegación; no debe obligar a copiar |
| Edición puntual, diario, guardado y recuperación | **L3** | Sigue siendo necesaria, también para extractos grandes |
| Buscar y reemplazar en flujo | L4 / E2–E3 | Reemplazo masivo puede producir una versión nueva explícita |
| Filtros, ordenamiento, estadísticas globales | L5 | Una vista no exige un CSV físico |
| Transformaciones masivas reversibles | L6 | Versión materializada o receta por evaluar; no se implementa aquí |
| Altas/bajas de filas/columnas | L7 | Preservar identidades y reconstrucción del índice |
| SQL y gráficos grandes | L8 | Motor nativo condicionado; Wasm mantiene sus límites actuales |
| Robustez y escala multiplataforma | L9 | E0 macOS no certifica Windows/Linux/Intel ni 10 GiB |

## 2. Tres conceptos, sin copias por cada filtro

| Concepto | Qué guarda | Cuándo materializa datos |
|---|---|---|
| Vista filtrada temporal | Condiciones/orden y fuente/revisión durante la sesión | No por defecto; puede necesitar índices o temporales de cálculo |
| Dataset derivado reutilizable | Nombre y receta ligada a una versión de fuente | Sólo caché explícita/opcional; no se confunde con una copia congelada |
| Extracto físico exportado | Archivo nuevo con contenido y contexto de origen | Acción explícita con nombre, ubicación, recuento N de M y alcance |

Las recetas son viables conceptualmente, pero necesitan versionar semántica de filtros, tipos explícitos, columnas por posición/nombre y revisión de fuente. La implementación actual no demuestra un motor de recetas persistentes. [Evaluación y política propuesta](../../experiments/large-data-extracts/RECIPES-PRIVACY.md); [antecedente de datasets analíticos](../ANALYSIS-DATASETS.md).

## 3. Reutilización: qué se comparó y qué no

La [compuerta de reutilización](../../experiments/large-data-extracts/REUSE.md) documenta capacidades, licencias y costes de csv-parse/prototipo, DuckDB CLI/nativo/Wasm, Python `csv`, pandas, Polars, PyArrow, qsv/xsv, Miller, csvkit, VisiData, SQLite, ClickHouse-local y OpenRefine. Incluye bindings Node y lectura multifichero. Se usa documentación oficial fechada; no se repite la auditoría de popularidad.

Las mediciones del [RFC §6](LARGE-FILE-EDITOR-RFC.md#6-motor-analítico-poc-4) siguen siendo antecedentes, con sus versiones y fixtures anchos de 230 columnas. **No se repitieron**. E0 mide otras seis tareas sobre ventas de 21 columnas y añade extracción/escritura, comparación con Python y encodings. Los números no se mezclan en una misma tabla como si fueran del mismo ensayo.

Python tiene tres decisiones distintas:

1. **Oráculo/banco de pruebas:** adoptado para E0; no añade nada al instalador.
2. **Motor distribuido:** no adoptado. Intérprete y paquetes por destino, firma, aislamiento, cancelación, protocolo, tamaño y actualización sin demostrar.
3. **Bindings Node de motores nativos:** candidatos, no una razón para distribuir también Python. DuckDB Neo sólo después de §7.4; Polars no añade ahora una capacidad justificada frente a los motores existentes.

No se descargó ni instaló ninguna herramienta. Se encontraron pandas 2.2.3 y Python 3.12.14 en el runtime local existente, además de Python 3.15.0, Node 24.22.1 y DuckDB CLI 1.5.6. Las alternativas no instaladas se evalúan documentalmente, **sin tiempos inventados**.

## 4. Contrato de las mediciones

Seis tareas: T1 contar registros; T2 contar `ciudad='Oaxaca' AND estado='entregado'`; T3 exportar coincidencias con `venta_id,ciudad,producto,total_mxn`; T4 agrupar por ciudad, contar y sumar céntimos exactos; T5 reemplazar literalmente `Mérida` por `Merida` sólo en ciudad y escribir otro CSV; T6 contar registros con `Primera línea` en algún campo, incluido texto multilínea. T6 cuenta registros, no ocurrencias ni líneas físicas.

El oráculo usa `csv.reader(strict=True)`, listas posicionales y `Decimal` con precisión suficiente; los importes del fixture tienen dos decimales. Node usa `BigInt`; DuckDB usa `DECIMAL(38,2)` y devuelve sumas como texto. No se convierten IDs ni fechas. Esta semántica monetaria no es un inferidor numérico general.

Se distinguen tres pruebas de integridad:

- **Valores/estructura:** hash SHA-256 con longitud de fila y longitud UTF-8 de cada campo; conserva aridad, orden, ceros iniciales e identificadores largos. Los agregados tienen JSON canónico y hash independiente.
- **Bytes sin modificar:** T5 compara cada registro intacto contra su ordinal original y hash de todos esos registros; el BOM se comprueba aparte. T3 cambia la estructura mediante proyección: la igualdad del registro completo es **no aplicable**, no un fallo.
- **Exactitud de transformación:** T3 debe conservar exactamente los campos proyectados; T5 sólo puede cambiar la ciudad especificada. Conteos, sumas y salida se comparan con el oráculo, no sólo con el éxito del proceso.

Una repetición exploratoria por motor/tarea/archivo, procesos separados, caché caliente por lectura/hash previo, RSS de `/usr/bin/time -l` en bytes. Tiempo de pared incluye arranque/importación del motor y escritura; excluye hashes y verificación posterior. No es un SLA ni una distribución p50/p95. No se ejecutan simultáneamente benchmarks ni Electron.

La implementación pandas mide **lectura por chunks + iteración Python + `csv.writer`**, no el máximo rendimiento de sus operaciones vectorizadas. El conteo Node usa el escáner del PoC y no valida todo el CSV; los demás lectores hacen trabajo distinto. El PoC de escritura llama `sync`; no se ha homogeneizado la garantía de persistencia de todos los exportadores: estos tiempos **no comparan guardado seguro de producto**. DuckDB usa un hilo, límite declarado de 512 MB y extensiones/autoinstalación desactivadas; ese ajuste no constituye un límite RSS del proceso ni un sandbox del SO.

Resultados y limitaciones medidos se incorporan en la siguiente sección y en la evidencia reproducible.

## 5. Evidencia y recomendación por capacidad

Ver [mediciones E0](../evidence/e0-extractos-2026-10-24.md) y [comandos del banco](../../experiments/large-data-extracts/README.md). Las cifras pertenecen al equipo identificado en JSON, no a las cuatro plataformas del producto.

| Capacidad | Propuesta | Motivo / coste / pendiente |
|---|---|---|
| Modelo canónico, edición directa y bytes sin tocar | Motor textual + L2/L3; no dataframe rectangular como fuente canónica | Mantiene ausente/vacío, offsets, overlay/diario y la ruta existente; integración y recuperación de producto aún L3–L9 |
| E1: filtro/proyección a archivo explícito | Reutilizar lector **validado de L2**, serialización existente y comprobaciones independientes | Sin dependencia nueva. El PoC permisivo de E0 no es un extractor listo para producto; exigir rechazo de malformados, cancelación y limpieza |
| Búsqueda, reemplazo literal y copia de registros intactos | Recorrido en flujo existente, endurecido, con versión nueva para cambio masivo | Se evita reescribir registros sin cambios; coste de pasada completa y espacio de salida. La anomalía de 10 GiB del RFC sigue abierta |
| Agregaciones/ordenamiento/joins grandes | DuckDB nativo candidato para L8 | CLI mide capacidad del motor, no su embedding. MIT; binarios, firma, sandbox, límites/interrupt y versiones en cuatro destinos pendientes (§7.4) |
| Oráculo, ensayos y validación independiente | Python `csv` estándar | PSF; ya instalado, sin coste de distribución. No convertirlo automáticamente en un segundo runtime de la aplicación |
| Limpieza dataframe | No añadir pandas/Polars ahora | pandas comparado en una ruta concreta; no prueba una ventaja que compense el runtime. Polars/PyArrow y CLI adicionales sin medición local |
| SQL/gráficos actuales | Conservar DuckDB-Wasm/Arrow y ECharts | Sin cambio arquitectónico; mantienen sus límites. Un extracto sólo ayuda si realmente cabe |

**Cambio respecto a RFC §6/§12:** no cambia la adopción propuesta L2–L7 sin motor nuevo ni la puerta de L8. E0 añade la vía complementaria de extractos y demuestra que el lector del PoC no basta para aceptar archivos arbitrarios; el siguiente trabajo debe reutilizar la validación de L2 y conservar el objetivo L3. Las recetas se evalúan con más detalle; no se convierten en el almacén canónico ni en requisito para editar.

## 6. Almacenamiento, privacidad y cierre

Propuesta explícita: no generar extractos por cada filtro; materializar sólo por acción del usuario; nombrar ubicación, fuente/revisión, N de M, campos, codificación y normalizaciones; advertir sobre disco antes de escribir. Un reemplazo masivo nuevo puede necesitar otra copia completa. Presupuestos, retención y limpieza son decisiones previas a E1, **no una política ya aplicada por la app**.

El banco E0 usa sólo datos sintéticos locales. Crea una carpeta nueva fuera del repositorio y de la carpeta de fuentes, exige espacio de 3× fuente +128 MiB como presupuesto conservador del ensayo, y elimina sus CSV de salida tras verificar cada tarea. Conserva métricas/hashes, no datos en Git. Los fixtures de usuario se abren en lectura y sus hashes antes/después deben coincidir. Los temporales DuckDB y fixtures micro son propiedad del ensayo y se limpian al cierre documentado.

Borrar un archivo propio revoca su acceso normal; **no garantiza borrado forense en SSD/APFS, snapshots, copias o backups**. No se ofrecen promesas de sobrescritura segura. Para datos sensibles se requiere ubicación local controlada y cifrado del volumen; no telemetría, red ni subida de extractos. [Política propuesta y fuente NIST](../../experiments/large-data-extracts/RECIPES-PRIVACY.md).

E0 termina con documentación, experimentos y PR en borrador. No se implementa E1, no se instala una versión de FreyaLab, no se publica ni se fusiona. Después de E0 corresponde proponer la actualización de `AGENTS.md` que pidió el usuario y solicitar las decisiones de almacenamiento antes de implementar extractos.
