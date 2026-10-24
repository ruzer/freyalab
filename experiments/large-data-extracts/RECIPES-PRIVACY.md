# Recetas reproducibles, extractos y privacidad — evaluación E0

Fecha de consulta: **24 de octubre de 2026**. Estado: **PROPUESTA, NO IMPLEMENTADA**. Este documento evalúa decisiones para E1; no crea un formato de proyecto, persistencia, interfaz, motor ni política de limpieza en FreyaLab. No incluye nuevas mediciones ni autoriza E1.

Se apoya en [la evaluación anterior de datasets](../../docs/ANALYSIS-DATASETS.md) y el [RFC del editor grande, §§4–7 y L1–L9](../../docs/design/LARGE-FILE-EDITOR-RFC.md). Sus experimentos son evidencia histórica con sus propios equipos, versiones y límites, no mediciones nuevas de E0. La edición mediante capa/diario y el resto de L3–L9 siguen vigentes: **extraer es una capacidad adicional, no el sustituto obligatorio de editar, buscar o reemplazar en cualquier tamaño**.

## 1. Qué significa cada objeto

| Objeto | Qué conserva | Coste y límite |
|---|---|---|
| Vista temporal | Condiciones y orden sobre una fuente/revisión durante la sesión | No exige otro CSV. Puede necesitar recorrido, índice, memoria o derrame. No es una versión congelada ni una garantía de consulta instantánea. |
| Dataset derivado reutilizable | Nombre y receta validada, ligada a una versión de fuente y a una semántica | Puede reutilizarse en varias estadísticas o gráficos. Guardar instrucciones no guarda necesariamente sus datos; sin la fuente exacta no se promete reproducir sus valores. Una caché sería opcional, identificada y prescindible. |
| Extracto físico | Archivo nuevo materializado por acción explícita, con nombre, ubicación, contenido y procedencia | Ocupa disco, puede sobrevivir al original y conservar datos sensibles. Será otro documento con sus límites de edición; no debe presentarse como el original ni como automáticamente pequeño. |

Una vista SQL vuelve a ejecutar su consulta; no conserva por sí sola datos materializados. Esto es una propiedad documentada de [DuckDB CREATE VIEW](https://duckdb.org/docs/2.0/sql/statements/create_view), no una garantía de compatibilidad con cualquier versión candidata de E0. La elección de motor continúa en la compuerta de reutilización; este documento no adopta DuckDB nativo ni Python.

**Propuesta de experiencia:** filtrar una vista no crea una copia física. «Guardar preparación» conservaría instrucciones; **«Extraer a un documento nuevo»** escribiría datos, con confirmación visible de destino y duración. No exigir un proyecto para consultar una tabla o crear un subconjunto. Un extracto filtrado completo y una muestra incompleta son objetos distintos.

## 2. Qué existe y qué falta

Confirmado por lectura del checkout E0, sin ejecutar la app:

- [`TableQuery` y `TableConditionGroup`](../../src/shared/types.ts) describen condiciones, búsqueda, filtros y orden; `offset`, `limit` y `requestId` son controles de consulta, no una receta de extracción completa.
- [`compileTableQuery`](../../src/main/table-query.ts) y [`TableEngine.indices`](../../src/main/table-engine.ts) contienen las reglas del editor en memoria. Reutilizar sus tipos no demuestra que otro motor ejecute condiciones equivalentes.
- [`analysis-source.ts`](../../src/main/analysis-source.ts) conserva valores textuales en Arrow y separa ausencia de cadena vacía. El documento textual sigue siendo canónico. La evaluación anterior documenta una base efímera experimental, no datasets persistentes de producto.
- El [RFC §4](../../docs/design/LARGE-FILE-EDITOR-RFC.md) propone identificadores por ordinal original, capa y diario, y copia en flujo de bytes no tocados. No equivale a una capacidad productiva ya disponible para toda operación ni a una política de retención aprobada.

**Pendiente:** contrato versionado de recetas, fidelidad de cada motor/escritor, actualización de fuentes, almacenamiento, presupuesto, recuperación, eliminación y consentimiento de E1. Lo siguiente son requisitos propuestos para evaluar esa entrega, no descripción de funciones implementadas.

## 3. Contenido mínimo de una receta — PROPUESTA

| Elemento | Información necesaria y comportamiento esperado |
|---|---|
| Versiones | Versión del formato de receta y de sus reglas semánticas; versión/commit de FreyaLab, parser, motor y escritor realmente utilizados. Una versión desconocida se conserva sin ejecutar ni migrar silenciosamente. |
| Fuente | Identificador local; origen elegido —archivo en disco o revisión con cambios pendientes—; tamaño, huella criptográfica completa, formato y esquema. Ruta/mtime ayudan a localizar y detectar cambios, pero no sustituyen la identidad del contenido. |
| Cambios pendientes | Si se admite analizar una revisión editada, vincular también la revisión y la capa/diario correspondiente. El hash del archivo en disco por sí solo no identifica esos valores. E1 debe indicar expresamente si solo trabaja sobre la versión en disco. |
| Formato | Codificación, BOM, delimitador, encabezado presente/ausente y su posición, saltos de línea y salto final, reglas de comillas/escape, política de filas irregulares y límites. No volver a autodetectar y aceptar un resultado distinto al repetir. |
| Columnas | Posición original y nombre exacto, incluido nombre vacío o duplicado; esquema ordenado completo o su huella. Mostrar posición desde 1 a la persona y fijar la base de índices de la receta. Nunca resolver solo por nombre ni adivinar una columna renombrada. |
| Operaciones | Pasos estructurados en su orden real: condiciones, proyección, transformación y orden de salida. Conservar constantes como texto; no almacenar código ejecutable, comandos, macros o SQL arbitrario como sustituto del modelo validado. |
| Valores | Campo ausente, presente vacío `''`, solo espacios y texto literal `NULL` son casos distintos. Ceros iniciales e identificadores largos siguen como texto; tipos numéricos/fechas se usan únicamente en operaciones explícitas. |
| Semántica | Igualdad, mayúsculas, normalización Unicode, espacios, decimal, fecha, regex, nulos, orden y desempates; versiones del motor/entorno relevantes. El significado no depende de valores predeterminados implícitos del motor elegido. |
| Cobertura | Fuente completa, subconjunto completo o muestra; columnas solicitadas; recuento de registros lógicos examinados/coincidentes/omitidos y estado completo/parcial. Una vista previa no acredita esos totales. |
| Procedencia | Receta y fuentes/versiones anteriores cuando haya encadenamiento; fecha de ejecución, motor, avisos, normalizaciones y límites; formato y SHA-256 del resultado físico verificado. Los metadatos sensibles también requieren protección. |

Una receta importada es entrada no confiable: validar versión, operaciones permitidas, posiciones, constantes y límites antes de leer o escribir. Los nombres y valores son datos, no fragmentos SQL ni comandos; un futuro adaptador debe usar parámetros para valores y escape de identificadores validado. No reactivar red, extensiones o acceso general a archivos al restaurarla.

Antes de capturar, durante la lectura y antes de publicar el resultado debe comprobarse que la fuente sigue correspondiendo a la versión esperada. Una huella parcial o una comparación final de metadatos no elimina todas las carreras con procesos externos. Una ejecución concurrente no acreditada se rechaza, en vez de publicar una mezcla de versiones como reproducible. Guardar un hash no guarda una copia de la fuente ni impide que otro programa la modifique.

Actualizar una preparación crea una ejecución/versión nueva explícita, con resumen del cambio. No reemplaza los valores congelados ni las columnas seleccionadas de una ejecución anterior. Si cambió el esquema, detenerse y permitir una correspondencia confirmada por posición y nombre. Si ya no existe la fuente exacta, conservar la receta como no reproducible por ahora; no buscar automáticamente archivos parecidos en otras carpetas.

## 4. Paridad de condiciones y orden — evaluación, no traductor implementado

El objetivo de E1 es reutilizar las condiciones existentes, no introducir dos filtros con el mismo rótulo y resultados distintos. Hay diferencias que una traducción directa a SQL puede ocultar:

| Regla del editor actual | Consecuencia para una receta reproducible |
|---|---|
| Búsqueda global: coincidencia en alguna celda; filtros simples por columna: todos deben cumplirse; ambos se combinan con el grupo de condiciones | Guardar estos tres niveles. `filterMode:'any'` solo aplica al grupo de condiciones, no convierte todos los filtros de la tabla en un OR. |
| `equals`, `notEquals`, `contains`, `starts`, `ends` no recortan el valor; ausencia se consulta como `''` | Preservar esta regla de comparación aunque la representación conserve presencia/ausencia. No sustituir `equals ''` por `IS NULL`; no recortar ni normalizar acentos automáticamente. |
| Texto sin distinción de mayúsculas usa `toLocaleLowerCase`; el orden textual usa `localeCompare` | Registrar locale/entorno de comparación o definir una semántica explícita versionada y probar la migración. El `LOWER`/orden predeterminado de otro motor no demuestra equivalencia Unicode entre plataformas. |
| `empty`/`notEmpty` usan presencia de contenido tras `trim`; ausente, vacío exacto y solo espacios comparten el resultado de «Está vacío» | Mantener la semántica visible anterior, sin fusionar estos casos en los datos. Si se añaden condiciones «ausente»/«vacío exacto», deben tener nombres y versión propios. |
| Comparaciones numéricas aceptan la gramática decimal/exponente existente y usan `decimal.js`; recortan espacios exteriores; un texto inválido no coincide | No convertir toda la columna ni pasar primero por `Number`. Registrar precisión, escala y redondeo de operaciones derivadas. Separadores de miles/decimal local requieren una elección explícita, nunca una conjetura. |
| Fechas de filtro aceptan calendario `AAAA-MM-DD`, recortando espacios en la celda; no son timestamps | No inferir `DD/MM` ni aplicar la zona horaria del equipo. Documentar la validación exacta y probar bordes de año: filtros, perfiles y gráficos no se presuponen idénticos. |
| Regex usa RE2JS, búsqueda de coincidencia (`find`), sensibilidad configurable y límites existentes | Conservar patrón, flags, motor/versión, anclas y límites. No sustituir por regex JavaScript/Python ni coincidencia completa. Las construcciones no soportadas se rechazan; no se descargan motores alternativos. |
| Se permiten hasta 20 condiciones y hasta 20 criterios de orden; las regex se limitan en patrón, programa y campo | Son límites actuales de esos helpers, no mediciones de rendimiento ni autorización para ampliarlos en E0. E1 debe comprobarlos antes del recorrido. |
| Empates del orden actual se resuelven por posición original; el orden numérico coloca inválidos al final | Conservar desempate por identificador/ordinal de la versión fuente, ubicación de ausentes/inválidos y dirección. `sort` de compatibilidad no debe competir con `order` por una precedencia nueva. |

La receta completa no debe conservar paginación accidental. «Las primeras coincidencias» exige una selección deliberada y etiquetada; no confundir las primeras filas mostradas con todo el subconjunto. Por defecto propuesto, una extracción conserva el orden original y la proyección de columnas elegida. Aplicar el orden de la vista será otra elección visible. Un ordinal depende de su versión fuente; no es un identificador universal al cambiar el archivo.

Para gráficos/agrupaciones, registrar operación, tratamiento de ausentes/vacíos, unidad y conversiones explícitas. Una futura operación temporal debe fijar si usa fecha sin zona o timestamp, la zona IANA, granularidad y reglas de horario estacional; la primera extracción puede limitarse a los filtros de fecha actuales. No ampliar E1 a columnas calculadas ni agregaciones sin su propia aceptación.

La documentación primaria de [DuckDB sobre no determinismo](https://duckdb.org/docs/2.0/operations_manual/non-deterministic_behavior) advierte de variaciones de orden y de agregaciones flotantes. Por ello, una receta igual no garantiza bytes iguales entre motores, versiones o arquitecturas: exigir orden explícito, desempates y precisión; declarar tolerancia numérica cuando corresponda. La documentación consultada es 2.0 y no certifica los motores distintos que E0 compare.

## 5. Fidelidad: valores, estructura y bytes son pruebas diferentes

**Propuesta de tres verificaciones separadas:**

1. **Valores:** oráculo independiente verifica textos, Unicode, comillas escapadas y campos multilínea; nunca convierte `00123` ni un ID largo para comparar. Se conserva también el indicador de presencia de cada campo.
2. **Estructura y alcance:** número de registros lógicos —no saltos de línea físicos—, orden, proyección, filas irregulares, encabezado y ausente frente a `''`. No omitir registros malformados sin error posicionado o decisión explícita documentada.
3. **Bytes:** hash del original antes/después, hash de cada salida y comparación de registros/campos originales que se declaren conservados. Coincidencia de valores no acredita fidelidad byte a byte.

Filtrar filas conservando todas las columnas permite evaluar copia de registros originales completos, con BOM una sola vez y encabezado declarado. Proyectar, reordenar columnas o reemplazar un campo puede cambiar el registro: el motor debe declarar qué bytes preserva y qué normaliza. Si el escritor cambia comillas, codificación o terminadores, el documento nuevo debe indicarlo antes de crearse; no etiquetarlo «idéntico al original». Al modificar texto no representable en la codificación elegida, rechazar o pedir conversión explícita, sin sustituciones silenciosas.

CSV no aporta por sí solo un tipo `NULL` interoperable: la [gramática de RFC 4180](https://www.rfc-editor.org/rfc/rfc4180.html) describe campos textuales y escape, no ese contrato de presencia. **Inferencia para FreyaLab:** una proyección que rectangulariza filas irregulares puede perder la diferencia ausente/vacío al reabrir solo el CSV. E1 debe demostrar que conserva esa estructura o declarar la pérdida y ofrecer un acompañante de contexto/presencia validado. CSV + JSON es una alternativa a evaluar, coherente con las exportaciones existentes, no una solución ya implementada para extractos. El archivo JSON también ocupa espacio y puede contener información sensible; no basta un marcador literal `NULL`, que podría ser un valor real.

Propuesta de procedencia visible: «Extracto de [nombre] · [N] de [M] registros · [condición legible] · [columnas] · fuente [versión] · [fidelidad/normalizaciones]». `N` es el recuento final verificado; `M` solo aparece si se examinó y verificó toda la fuente. Si se canceló o solo se cargó una muestra, indicar «parcial» y total no determinado, sin fabricar «N de M». La vista previa de coincidencias tiene su propio rótulo y no crea un extracto final.

## 6. Costes y presupuestos — solo fórmulas ESTIMADAS

**No hay cifras medidas nuevas en este documento.** Las magnitudes siguientes son un modelo de planificación; sus parámetros y límites deben aprobarse y luego medirse con los motores y formatos reales. No trasladar tasas del RFC a E1 como promesas ni extrapolar la anomalía pendiente de cambios masivos de 10 GiB.

| Recurso | Modelo estimado, no resultado experimental |
|---|---|
| Disco retenido | `D_retenido = suma(bytes de extractos/versiones conservados) + índices + diarios + contexto + cachés`. Una receta lógica solo añade su definición y metadatos salvo caché/materialización elegida. |
| Espacio adicional de una tarea | `D_tarea = salida temporal + derrame máximo + índice nuevo + diario/contexto/verificación + margen`. No contar dos veces temporal y final si es el mismo archivo renombrado en el mismo volumen. Si hay una segunda copia o volúmenes distintos, presupuestar cada volumen por separado. |
| Memoria | `M_tarea ≈ buffers de lectura/escritura + registro máximo + estado de condiciones + claves/grupos/capa en uso + sobrecarga del motor`. Ordenar o agrupar no es automáticamente constante en memoria; si exige derrame, este entra en disco. |
| Tiempo de planificación | `T_total ≈ preparación + lectura/decodificación + evaluación + escritura + orden/derrame + huellas/verificación + publicación`. Algunas etapas pueden solaparse; la fórmula enumera costes, no una cota garantizada. |
| Conveniencia de materializar | Comparar `T_creación + k×T_consulta_derivada` con `k×T_consulta_actual`, incluyendo validación de fuente, actualización y limpieza. También comparar memoria y disco. No elegir solo por una consulta caliente. |

El tamaño del extracto no se deduce solo de la fracción de filas: longitudes variables, proyección, escape y codificación lo alteran. Una vista previa no da un máximo seguro. **Propuesta:** mostrar «estimado» si se usa una muestra y exigir un presupuesto de bytes de salida/temporales; detenerse limpiamente al alcanzarlo, sin truncar el resultado y presentarlo como completo. Si no puede acotarse o verificarse el espacio necesario, ofrecer otra ubicación, menos datos o cancelar, no asumir que cabe.

Antes de crear una tarea: elegir destino y presupuesto, comprobar espacio disponible por volumen y las versiones ya retenidas, reservar el trabajo cuando sea posible y volver a vigilarlo durante la escritura. Una comprobación inicial no reserva disco frente a otras apps. La concurrencia entre tareas también consume el mismo presupuesto. El margen y número de versiones no quedan fijados aquí; los decide el usuario antes de E1 con información visible de sus costes. Un límite configurado del motor no acredita por sí solo el RSS máximo de su proceso.

## 7. Almacenamiento, retención y privacidad — PROPUESTA pendiente de elección

Nada de esta sección está implementado por E0 ni cambia los ajustes actuales. Se proponen dos destinos, sin elegir por el usuario:

| Destino posible | Decisión que debe quedar explícita |
|---|---|
| Carpeta privada administrada por la app | Ruta visible, acceso restringido comprobado por plataforma, presupuesto, política de sesión/recuperación/retención y botón para gestionar/borrar copias. No asumir permisos POSIX en Windows. |
| Carpeta elegida por la persona | Archivo nuevo con nombre visible y permisos definidos; explicar que puede quedar en una unidad compartida, respaldada o sincronizada. No borrar automáticamente un documento exportado al cerrar su pestaña. |

**Propuesta de ciclo de vida:**

- Una vista de sesión no materializa datos por cada filtro. Si necesita disco temporal, mostrarlo en el trabajo y aplicarle limpieza propia; «temporal» no significa «solo RAM».
- Guardar una preparación conserva receta y referencias únicamente, salvo elección explícita de conservar una versión/copia. Si persiste alguna caché con valores, identificarla, contabilizarla y permitir borrarla sin destruir la fuente ni la receta.
- Crear extracto exige nombre, ubicación y elección de permanencia. Cerrar la pestaña no debe decidir silenciosamente entre perder cambios y retener datos indefinidamente. Hasta que se apruebe la política de E1, no hay caducidad ni número de versiones automáticos acordados.
- El usuario decide si las copias administradas viven solo durante la sesión, hasta borrado manual o con una caducidad que elija. Vencimiento y presión de espacio nunca borran originales, exportaciones propias o cambios sin guardar; avisar y ofrecer guardar/conservar o cancelar. Explicar qué retención permite recuperar tras cierre inesperado.
- Al cambiar o eliminar la fuente, avisar de que sus extractos y versiones siguen existiendo. Borrar la fuente no revoca ni limpia copias anteriores, informes o exportaciones ya compartidos.

**Cancelación, error y publicación propuestas:** escribir con identificador de tarea y creación exclusiva en temporal propio; cancelar/errores detienen lectura y escritura, cierran manejadores y retiran únicamente los temporales que esa tarea posee. Verificar fuente y salida antes de publicar un nombre final. Si se acompaña con contexto, no afirmar atomicidad de dos archivos: definir recuperación/publicación conjunta verificable y reconocer un acompañante incompleto. Tras caída, un manifiesto de trabajo debe permitir identificar huérfanos sin ejecutarlos ni borrarlos indiscriminadamente. Si falla la limpieza, informar ruta/tamaño/estado y ofrecer reintentar; no responder «cancelado y limpio» sin verificarlo. Cancelar a mitad no abre una salida parcial como documento completo.

**Acceso y datos sensibles propuestos:** procesamiento local, permisos mínimos, sin enlaces remotos ni descargas de extensiones por una receta, sin ejecución de comandos y sin credenciales en metadatos. Validar rutas canónicas, destino diferente del original y enlaces/cambios de destino antes de escribir o limpiar. No recorrer carpetas ni ampliar permisos de lectura por restaurar una receta. Los permisos del motor no sustituyen la puerta de aislamiento/empaquetado del [RFC §7.4](../../docs/design/LARGE-FILE-EDITOR-RFC.md).

Recetas, nombres de columna, constantes de filtro, muestras, huellas, rutas y registros de error pueden revelar información. Propuesta: guardar lo necesario localmente, no registrar celdas ni rutas completas en evidencia pública, ocultarlas al compartir un informe cuando se solicite, y advertir que quitar metadatos no anonimiza los datos. Las carpetas sincronizadas y los respaldos del sistema quedan fuera del control de FreyaLab; no prometer que una carpeta sea privada solo por llamarse «local». No se incorpora cifrado propio ni gestión de claves en E0.

### Eliminación segura de copias: qué se puede prometer

Propuesta de interfaz: **«Eliminar copia local»**, con lista exacta de archivos administrados, dependencias y bytes; diferenciar eliminar archivo, quitar referencia y conservar resultado. Antes de borrar, comprobar pertenencia al trabajo y que no se haya sustituido por un archivo ajeno; no seguir enlaces ni borrar por un prefijo de nombre. Una receta no debe poder ordenar borrado recursivo. La retirada se limita a copias elegidas y temporales propios, nunca al original. Una eliminación fallida se conserva como pendiente visible.

Esto es seguridad operativa frente a borrado accidental, **no borrado forense garantizado**. Sobrescribir desde una app no alcanza necesariamente todas las ubicaciones de un SSD con celdas reasignadas; NIST explica esas limitaciones y las condiciones de sanitización en [SP 800-88 Rev. 2, §3.1.1 y §4.2](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-88r2.pdf). Eliminar una referencia o un archivo tampoco controla instantáneas, respaldos o copias remotas. No ofrecer «irrecuperable», «borrado certificado» ni pasadas de sobrescritura como garantía; la sanitización del medio es un procedimiento distinto, dependiente del dispositivo y de la política de quien lo administra. FreyaLab no lo ejecutará como efecto lateral de cerrar un análisis.

## 8. Decisiones del usuario y compuerta antes de E1

E0 debe entregar su comparativa y permanecer en borrador; **E1 no empieza por aprobar este documento implícitamente**. Antes de implementar, pedir y registrar la elección de:

1. **Ubicación:** carpeta de trabajo administrada o destino elegido por extracto; qué carpetas compartidas/sincronizadas acepta.
2. **Duración y cierre:** vida de sesión, conservación manual o caducidad elegida; qué sucede al cerrar pestaña/app y cómo se recuperan cambios pendientes.
3. **Presupuesto:** espacio para extractos/versiones/temporales y avisos al acercarse al límite; qué hacer si no cabe o se cancela.
4. **Reproducibilidad y fidelidad:** versión en disco o cambios pendientes; conservar fuente exacta o solo receta; qué normalizaciones acepta y si necesita contexto de presencia/procedencia adicional.

Propuesta de aceptación posterior: misma receta + misma fuente verificada + mismo contrato produce el mismo subconjunto y orden; nulos/vacíos/IDs y campos multilínea sobreviven; cambio de fuente/esquema exige decisión; cancelar, falta de disco y caída no dañan el original ni publican una salida completa falsa; limpieza solo alcanza archivos propios; presupuesto/retención son visibles y ensayados por plataforma. Los importes/estadísticas se contrastan con un oráculo independiente, con exactitud o tolerancia documentadas, no solo por hash de CSV normalizado.

El usuario solicitó **proponer la actualización de la restricción de alfa de `AGENTS.md` después de E0**. Este documento la deja intacta y no convierte capacidades de GB, recetas o motores candidatos en parte de la alfa distribuida.

**No comprobado aquí:** ejecución de recetas, coste, recuperación, eliminación, aislamiento de motores candidatos o compatibilidad de empaquetado. Se requiere evidencia propia antes de presentarlos como disponibles; la edición completa con capa/diario y L3–L9 no se da por cumplida mediante extractos.
