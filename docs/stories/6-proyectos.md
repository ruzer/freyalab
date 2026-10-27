# Iteración 6 · Proyectos de análisis

Pilar de producto aprobado el 2026-10-27: trabajar con datos originales, crear conjuntos derivados y guardar análisis y gráficos de forma organizada y reproducible, sin que la persona tenga que usar Python, R o SQL. **Es una capa opcional**: abrir un archivo o una carpeta sigue sin pedir ningún proyecto (`product-prompt.md` §2). Este archivo contiene PRJ-00, un **documento de decisión sin código**, y el desglose de PRJ-01 a PRJ-07.

Líneas de desarrollo (decisión del propietario): **CSV escalable L3–L9** (RFC existente), **vistas Texto y Tabla TXT-01–TXT-05** (`docs/stories/7-csv-texto.md`, en su propio PR) y **proyectos PRJ-00–PRJ-07** (este archivo). Esta iteración reutiliza lo ya diseñado en [LARGE-DATA-EXTRACTS.md](../design/LARGE-DATA-EXTRACTS.md), [RECIPES-PRIVACY.md](../../experiments/large-data-extracts/RECIPES-PRIVACY.md) y [ANALYSIS-DATASETS.md](../ANALYSIS-DATASETS.md); no los repite, los cita y fija lo que falta para poder implementarlos.

## PRJ-00 · Contrato de proyecto, receta y procedencia

### 1. Historia de usuario

Como persona que trabaja con datos originales, quiero crear conjuntos derivados, gráficos e informes que recuerden de dónde salieron y cómo repetirlos, sin modificar la fuente, para poder repetir un análisis cuando cambien los datos o explicar un resultado a otra persona.

### 2. Qué existe hoy (verificado el 2026-10-27 sobre `main` en `6362e2d`)

| Componente | Estado | Papel en este contrato |
|---|---|---|
| `TableFilter`, `TableConditionGroup`, `TableSort` (`src/shared/types.ts`) | Existen: columna por **posición**, operador (`contains`, `equals`, `notEquals`, `starts`, `ends`, `empty`, `notEmpty`, `greater…`, `date…`, `regex`), valor como texto, `caseSensitive`; modo `all` o `any` | Pasos `filter` y `order` de la receta |
| I0, `OperationRequest` (`src/shared/operations.ts`) | Implementado: lista cerrada `count`, `preview`, `filter_extract`; sin SQL ni rutas de salida; `ExtractResult` con `fidelity` (`bytes` o `values`), `normalization`, `matched`, `scanned`, `irregularRows` | Motor de ejecución de las recetas v1 y base de la procedencia |
| E1, `CsvExtract.svelte` y `ExtractOrigin` | Implementado: extracto no destructivo; la procedencia (fuente, N de M, condición, columnas, fidelidad) se muestra mientras el documento está abierto, **no se guarda** | PRJ-03 la persiste |
| Presets de gráficos (`ChartPreset`, `userData/chart-presets.json`) | Existen a nivel de **aplicación**: encabezados, opciones, condiciones y vista; se reconocen por lista de encabezados, sin fuente ni huella | PRJ-04 los liga a una fuente y a un proyecto |
| SQL y análisis (DuckDB-Wasm aislado) | Límite de **256 MiB por fuente y 8 millones de celdas**, contadas antes del filtro (E0 §1) | Define lo que la v1 puede prometer |
| Resumen del archivo al abrir | Una tabla de hasta 50 MiB ya calcula un resumen completo del archivo (`digest`) y lo compara tras abrirla | Antecedente de la huella; la v1 la extiende |
| `Documents.open`, `recents.json` | Un documento por ruta, tipo por extensión; recientes en `userData` | Los proyectos recientes siguen el mismo patrón |
| L3 (capa de cambios y diario) | **No existe** en `src` | PRJ-07 y TXT-03 esperan a L3 |
| Formato de proyecto, recetas persistentes, procedencia guardada, obsolescencia, informes | **No existen** | Lo que define este documento |

### 3. Decisiones del propietario (2026-10-27)

1. **Manifiesto único `proyecto.freyalab`**: JSON versionado, con rutas relativas cuando sea posible. La estructura de carpetas (`01_raw`, `02_datasets`, …) es una **plantilla opcional**, nunca una obligación.
2. **Las fuentes están protegidas contra modificaciones hechas por FreyaLab.** No se promete protección frente a otros programas.
3. **La primera versión respeta los límites actuales del motor.** Todo análisis indica si usa datos **completos, filtrados o una muestra**.
4. **SHA-256 completo al registrar una fuente**, con progreso y cancelación. Las comprobaciones rápidas detectan posibles cambios, pero **no son prueba de identidad**; antes de una operación que exija identidad exacta se vuelve a verificar la huella completa.

### 4. El contrato

#### 4.1 Proyecto y carpeta

Un proyecto es una carpeta que contiene `proyecto.freyalab`. Abrir esa carpeta (o el manifiesto) lo activa. El resto del contenido es libre. «Crear estructura sugerida» crea las carpetas numeradas y no se vuelve a pedir; borrar o renombrar carpetas nunca invalida un proyecto, porque el manifiesto guarda las rutas exactas.

#### 4.2 Manifiesto `proyecto.freyalab` (versión 1)

Claves en inglés (coinciden con los tipos del código); la interfaz habla español.

```json
{
  "format": "freyalab-project", "version": 1,
  "id": "6f1c…", "name": "Análisis de población 2020", "createdAt": "2026-10-27T18:00:00Z",
  "sources": [{
    "id": "src1", "path": "01_raw/poblacion.csv", "external": false, "protection": "readonly",
    "bytes": 5369182394, "sha256": "…64 hex…", "registeredAt": "2026-10-27T18:02:11Z",
    "quick": {"mtimeMs": 1793123456789, "headSha256": "…", "tailSha256": "…"},
    "format": {"encoding": "utf8", "bom": false, "delimiter": ",", "header": true, "eol": "\n", "finalEol": true},
    "schema": {"sha256": "…", "columns": [{"position": 1, "name": "ID"}, {"position": 3, "name": "ENTIDAD"}]}
  }],
  "recipes": [{
    "id": "rec1", "name": "Oaxaca, adultos", "sourceId": "src1", "sourceSha256": "…", "semantics": 1,
    "steps": [
      {"op": "filter", "mode": "all", "conditions": [{"column": {"position": 3, "name": "ENTIDAD"}, "op": "equals", "value": "20", "caseSensitive": false}]},
      {"op": "select", "columns": [{"position": 1, "name": "ID"}, {"position": 7, "name": "POBTOT"}]},
      {"op": "order", "by": [{"column": {"position": 7, "name": "POBTOT"}, "descending": true, "numeric": true}]}
    ],
    "createdAt": "2026-10-27T18:10:00Z"
  }],
  "results": [{
    "id": "res1", "kind": "extract", "recipeId": "rec1", "path": "02_datasets/poblacion_oaxaca.csv",
    "bytes": 91234, "sha256": "…", "createdAt": "2026-10-27T18:12:40Z",
    "provenance": {
      "sourceSha256": "…", "executedAt": "2026-10-27T18:12:40Z",
      "engine": {"app": "0.1.0", "contract": "operations/1", "semantics": 1},
      "coverage": {"kind": "filtered", "matched": 1250, "scanned": 72465, "total": 72465, "complete": true},
      "fidelity": {"level": "values", "normalization": ["comillas"], "irregularRows": 0},
      "warnings": []
    }
  }]
}
```

| Campo | Regla |
|---|---|
| `format`, `version` | Obligatorios. Una `version` mayor que la que entiende la aplicación abre el proyecto **solo para lectura**, conserva los campos desconocidos y **no ejecuta nada**. No se migra en silencio |
| `sources[].path` | Relativa al manifiesto si el archivo está dentro de la carpeta del proyecto; si está fuera se guarda absoluta con `"external": true` y la interfaz lo señala («otra persona no podrá abrir esta ruta») |
| `sources[].protection` | Siempre `readonly` en la v1 (ver 4.3) |
| `sources[].sha256` | Identidad del contenido: lo único que prueba que es «esa» fuente. Se calcula una sola vez al registrar (4.3) |
| `sources[].quick` | Detector de cambios (tamaño, `mtime`, SHA-256 de los primeros y últimos 64 KiB). **No es prueba de identidad** |
| `sources[].format` y `schema` | Se **fijan** al registrar y no se vuelven a autodetectar al ejecutar (RECIPES §3, «Formato»): codificación, BOM, delimitador, encabezado, saltos de línea, y columnas por posición (desde 1) y nombre exacto, incluidos vacíos y duplicados |
| `recipes[]`, `results[]` | Ver 4.4 y 4.5 |
| Sin valores de celdas | El manifiesto nunca guarda filas ni muestras; solo constantes de filtro escritas por la persona |

#### 4.3 Fuentes: registro, protección y huellas

**Registrar** una fuente es una acción explícita («Añadir al proyecto»): se lee el archivo una vez, se calcula el SHA-256 completo, se fija el formato y el esquema, y se guarda en el manifiesto. Muestra progreso, se puede cancelar y **una cancelación no registra nada** (no hay fuente a medias).

**Protección.** Mientras una fuente pertenece a un proyecto, FreyaLab no la escribe: se abre en solo lectura dentro del proyecto, no ofrece guardar, reemplazar ni transformar sobre ella, y «Guardar como» o «Extraer» crean un archivo nuevo. El texto de la interfaz es exacto: *«Protegida contra cambios hechos por FreyaLab. No impide que otro programa la modifique; FreyaLab lo detecta y avisa.»* Quitarla del proyecto la devuelve a un documento normal.

**Cuándo se comprueba qué:**

| Momento | Comprobación | Si algo no coincide |
|---|---|---|
| Abrir el proyecto o la fuente | Rápida (tamaño, `mtime`, extremos) | Aviso «la fuente cambió desde que se registró»; los resultados pasan a «posiblemente desactualizados» |
| Antes de **ejecutar una receta, extraer, exportar con procedencia o generar un informe** | **SHA-256 completo otra vez**, con progreso y cancelación | La operación se detiene; se ofrece «volver a registrar la fuente» (crea una versión nueva) |
| Mostrar el estado de un resultado | Rápida, indicativa | «Posiblemente desactualizado»; se confirma con la completa si la persona lo pide |
| Fuente que no está en su ruta | A petición de la persona, búsqueda en la carpeta del proyecto de un archivo con el mismo tamaño y confirmación con SHA-256 completo | Si no coincide, «fuente no encontrada»; nunca se enlaza por nombre ni se recorren otras carpetas |

El coste de la huella completa **no se promete**: E1 midió unos 30 s por GiB validando cada registro, que no es el coste de calcular un hash. PRJ-01 mide el suyo y lo publica.

#### 4.4 Receta (versión 1)

Una receta es una lista **ordenada y cerrada** de pasos sobre una fuente registrada. Reutiliza los tipos que ya existen (`TableFilter`, `TableSort`) y se ejecuta con el contrato I0; **no se añade motor, SQL ni lenguaje**.

| Paso | Contenido |
|---|---|
| `filter` | `mode` (`all` o `any`) y condiciones: columna `{position, name}`, operador de la lista de `FilterOperator`, valor **como texto**, `caseSensitive` |
| `select` | Columnas `{position, name}` en el orden de salida |
| `order` | Lista de `{column, descending, numeric}` |

Reglas del contrato:
- **Columnas por posición y nombre, nunca solo por nombre.** Si el esquema de la fuente cambió, la ejecución se detiene y pide una correspondencia confirmada por posición y nombre; nunca se adivina una columna renombrada.
- **Valores como texto.** `00123` y los identificadores largos (`9007199254740993`) no se convierten; los números y fechas se interpretan solo en operaciones explícitas (`greater`, `numeric`, `date…`).
- **Semántica versionada** (`semantics: 1`): igualdad, mayúsculas, normalización Unicode, espacios, orden y desempates se definen por la versión, no por valores por omisión del motor. La v1 equivale al comportamiento del motor propio estricto de `src/main/table-query.ts` y `operations.ts`; cualquier cambio de comportamiento sube `semantics`.
- **Receta importada = entrada no confiable.** Se valida versión, operaciones permitidas, posiciones, constantes y límites antes de leer o escribir. Un operador `regex` se valida y limita antes de usarse. Nunca se ejecutan comandos, SQL arbitrario ni código.
- Una receta **guarda instrucciones, no datos**. Reproducir exactamente los valores exige la fuente exacta (misma `sourceSha256`); sin ella solo se promete repetir las instrucciones. La interfaz distingue ambos casos.
- Los **conjuntos derivados** son recetas con nombre humano («Ventas pagadas de Oaxaca»); no crean ningún archivo hasta que la persona pide «Exportar extracción».
- Se ejecuta sobre la **versión guardada en disco**. Un documento con cambios sin guardar avisa y no se analiza en la v1 (RECIPES §3, «Cambios pendientes»).

#### 4.5 Resultados y procedencia

| `kind` | Qué es | Historia |
|---|---|---|
| `extract` | Archivo físico creado por «Exportar extracción» | PRJ-03 |
| `chart` | Configuración editable de un gráfico ligada a una receta, más sus imágenes y datos exportados | PRJ-04 |
| `report` | Documento Markdown con gráficos y su procedencia | PRJ-05 |

Todo resultado lleva `provenance`: fuente y huella, receta, fecha, motor (aplicación, contrato y `semantics`), **cobertura**, **fidelidad** (`bytes` o `values`, con las normalizaciones, como ya devuelve I0) y advertencias. La interfaz muestra la frase de RECIPES §5: *«Extracto de [fuente] · [N] de [M] registros · [condición legible] · [columnas] · fuente [versión] · [fidelidad]»*; `M` solo aparece si se examinó y verificó toda la fuente. Una vista previa no crea resultado.

#### 4.6 Cobertura

Todo análisis, gráfico, extracto e informe declara una de tres coberturas, visible en la interfaz y en `provenance.coverage`:

| `kind` | Significa | Ejemplo de rótulo |
|---|---|---|
| `full` | Toda la fuente, sin filtros | «Todos los registros (72.465)» |
| `filtered` | Un subconjunto definido por una receta, con toda la fuente examinada | «1.250 de 72.465 · Entidad = Oaxaca» |
| `sample` | Solo una parte examinada (límite del motor, muestra de solo lectura o cancelación) | «Muestra: 200 filas; total no determinado» |

Si la lectura se canceló o solo hay muestra, se dice «parcial» y **no se escribe un «N de M» inventado**. En la v1, las fuentes por encima de los límites del motor (256 MiB y 8 millones de celdas para SQL y gráficos) solo se analizan a través de un extracto que quepa, con su cobertura declarada.

#### 4.7 Obsolescencia y actualización

El estado de un resultado es `current`, `maybe-stale` (la comprobación rápida de la fuente cambió), `source-missing` o `recipe-changed`. **Actualizar crea una ejecución nueva y explícita** con resumen de qué cambió; no reemplaza ni borra resultados anteriores y nunca presenta uno viejo como actual (ANALYSIS-DATASETS, decisión 3). Si cambió el esquema, se detiene y pide la correspondencia por posición y nombre. El comparador de versiones y «aplicar cambios al original» son PRJ-06 y PRJ-07.

#### 4.8 Escritura del manifiesto y versión del formato

El manifiesto se escribe de forma atómica (archivo temporal y renombrado) y, antes de escribir, se comprueba que no cambió fuera de FreyaLab desde que se leyó; si cambió, se avisa y se deja elegir (recargar o conservar). Es texto JSON con sangría estable y claves ordenadas, para que los cambios se lean en un control de versiones. `version` es un entero; los cambios compatibles añaden campos opcionales y los incompatibles suben la versión con una migración explícita y una copia `proyecto.freyalab.bak`.

#### 4.9 Privacidad y retención

Se adopta [RECIPES-PRIVACY.md §7](../../experiments/large-data-extracts/RECIPES-PRIVACY.md) con estas reglas concretas:

- **Todo es local.** Sin red, sin telemetría, sin descargas por una receta, sin ejecutar comandos y sin credenciales en los metadatos.
- **Qué puede revelar el manifiesto:** nombres de columnas, constantes de filtro, rutas, huellas y fechas. Por eso no guarda celdas, usa rutas relativas siempre que puede y «Exportar proyecto para compartir» ofrece quitar rutas absolutas y constantes, avisando de que **quitar metadatos no anonimiza los datos**.
- **Carpetas sincronizadas o con copias de seguridad:** FreyaLab no las controla; la interfaz lo dice una vez al crear el proyecto y no promete privacidad por llamarse «local».
- **Retención:** no hay caducidad ni borrado automático de nada. «Quitar del proyecto» (olvida la referencia) es distinto de «Eliminar archivo» (lista exacta de lo que borra y no sigue enlaces). Una receta nunca puede ordenar un borrado. Borrar una fuente no revoca copias, informes o exportaciones ya compartidos, y la interfaz lo advierte.
- **Sin promesas forenses:** no se ofrece «irrecuperable» ni «borrado certificado» (NIST SP 800-88 r2, citado en RECIPES §7).

#### 4.10 Relación con los componentes actuales

| Componente | Cambio por esta línea | Historia |
|---|---|---|
| `TableFilter`, `TableSort`, I0 | Sin cambios: la receta los reutiliza y la ejecución pasa por el mismo contrato cerrado | PRJ-02 |
| E1, `ExtractOrigin` | La procedencia deja de ser solo visible y se guarda en el manifiesto | PRJ-03 |
| Presets de gráficos | Se conservan; un gráfico de proyecto se liga a receta y fuente. Importar un preset existente a un proyecto es opcional y no lo borra | PRJ-04 |
| DuckDB-Wasm y `analysis-source` | Motor de cálculo dentro de los límites actuales; nada nuevo | PRJ-02, PRJ-04 |
| Markdown, Mermaid y la política de activos de FL-DRW-001 (`<documento>.assets/`) | Los informes usan esa política para las imágenes de los gráficos | PRJ-05 |
| `Documents`, `recents.json` | Un proyecto **no es un tipo de documento**; los proyectos recientes siguen el patrón de `recents.json` | PRJ-01 |
| L3 y la capa de cambios | Sin ella la v1 solo lee versiones guardadas; con ella se podrá comparar y aplicar cambios | PRJ-07 |
| Barra lateral (FL-MD-007) | El proyecto aparece como una pestaña de la barra izquierda cuando hay uno activo | PRJ-01 |

### 5. Criterios de aceptación del contrato

Lo que PRJ-01 a PRJ-07 deben cumplir y que Claude comprobará al revisar cada PR:

- C1. **Un manifiesto v1 es válido solo si cumple la sección 4.2**; se publica un esquema JSON y un validador con pruebas, incluida una versión mayor desconocida (solo lectura, campos conservados, sin ejecutar).
- C2. **La fuente no se modifica nunca** desde FreyaLab: una prueba compara su SHA-256 antes y después de cada operación del proyecto, y los atajos de guardar, reemplazar y transformar sobre una fuente registrada están deshabilitados.
- C3. **Una cancelación en el registro no deja fuente a medias**; el SHA-256 se calcula con progreso y es cancelable.
- C4. **Antes de ejecutar, extraer o generar un informe se verifica el SHA-256 completo**; una huella rápida distinta nunca se presenta como prueba.
- C5. **Misma receta, misma fuente verificada y misma `semantics` producen el mismo subconjunto y el mismo orden** (prueba contra un oráculo independiente, no solo por el hash de un CSV).
- C6. **Ninguna receta contiene SQL, expresiones ni comandos.** Una receta con un paso desconocido o fuera de la lista se rechaza completa.
- C7. **Los ceros iniciales y los identificadores largos sobreviven** (`00123`, `9007199254740993`), así como los campos multilínea y la diferencia entre ausente y vacío.
- C8. **Cada resultado declara su cobertura** (`full`, `filtered`, `sample`) y su fidelidad; nunca aparece un «N de M» que no se verificó.
- C9. **Un cambio de esquema detiene la ejecución** y exige una correspondencia confirmada; no hay renombrados adivinados.
- C10. **Actualizar crea una versión nueva**; no hay reemplazo silencioso de resultados.
- C11. **El manifiesto se escribe de forma atómica** y detecta un cambio externo; no guarda celdas; las rutas son relativas cuando la fuente está dentro del proyecto.
- C12. **Nada de red ni telemetría**, comprobado; «Eliminar» lista lo que borra, no sigue enlaces y no puede alcanzar la fuente.
- C13. **Sin dependencias nuevas** salvo aprobación expresa en la historia correspondiente.

### 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| Prometer análisis de varios GB que el motor no soporta | Cobertura obligatoria y límites visibles; la v1 solo sobre extractos y archivos dentro de los límites (4.6). DuckDB nativo sigue detrás de la puerta del RFC §7.4 (L8) |
| Una huella completa de un archivo de GB tarda | Se calcula una vez, con progreso y cancelación; se mide y se publica (PRJ-01). La comprobación rápida es solo orientativa |
| Un proyecto movido o compartido pierde sus rutas | Rutas relativas, reenlace por tamaño y huella con confirmación completa, nunca por nombre |
| Confundir receta con copia congelada | Dos rótulos distintos en la interfaz (instrucciones y datos) y el estado de obsolescencia |
| Fuga de datos sensibles por el manifiesto | Sin celdas, rutas relativas, exportación para compartir con opción de quitar metadatos y la advertencia de que no anonimiza |
| Alcance: siete historias grandes | PRJ-01 a PRJ-03 forman un núcleo usable; PRJ-04 a PRJ-07 se programan solo tras revisar el núcleo |

### 7. Desglose

| ID | Contenido | Depende de | Tamaño | Criterio principal |
|---|---|---|---|---|
| PRJ-01 | Crear y abrir un proyecto, registrar una fuente (SHA-256 con progreso y cancelación), fuente protegida, pestaña «Proyecto», plantilla de carpetas, proyectos recientes | PRJ-00 aprobado | M | C1 a C4, C11 |
| PRJ-02 | Guardar vistas filtradas como recetas con nombre y ejecutarlas | PRJ-01 | M a L | C5 a C7, C9 |
| PRJ-03 | «Exportar extracción» con procedencia guardada (interfaz sobre E1) | PRJ-01 | M | C8, C10 |
| PRJ-04 | Gráficos guardados ligados a su fuente, con exportación de imagen y de datos | PRJ-02 | M | C8 |
| PRJ-05 | Informe Markdown con gráficos y su procedencia | PRJ-04 y FL-DRW-001 | M | C8 |
| PRJ-06 | Detectar obsolescencia y volver a ejecutar | PRJ-02 | L | C4, C10 |
| PRJ-07 | Comparar versiones y aplicar cambios al original | L3 | L | C2 |

Cada historia lleva su prompt para Codex, su plan de pruebas y sus criterios de revisión cuando se detalla; **PRJ-00 no se implementa**.

### 8. Decisiones por confirmar

El propietario aprobó Q1 a Q4. E0 §8 pide además cuatro decisiones antes de implementar; propongo estos valores por defecto y los registraré como decididos cuando se confirmen:

| Decisión | Propuesta |
|---|---|
| Ubicación de los resultados | Dentro de la carpeta del proyecto, en la ruta que elija la persona; no hay carpeta administrada oculta |
| Duración | Nada caduca ni se borra solo; cerrar una pestaña no borra ni retiene datos en silencio |
| Presupuesto de disco | Comprobar el espacio libre antes de escribir (como ya hace E1) y avisar; sin reservas ni cuotas |
| Reproducibilidad y fidelidad | Receta sobre la versión guardada en disco; normalizaciones declaradas en `provenance.fidelity`; sin «contexto de presencia» adicional en la v1 |

### 9. Criterios de revisión de este documento (Claude)

Cada campo del manifiesto tiene regla; las cuatro decisiones del propietario están reflejadas sin ampliarlas; no hay promesas que el motor actual no cumple; los límites y la cobertura aparecen donde corresponde; todo lo reutilizado cita su origen; no hay código ni dependencias nuevas.
