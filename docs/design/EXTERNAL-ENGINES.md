# Motores open source para archivos grandes — recomendación tras M1

Fecha: **25 de octubre de 2026**. Estado: **propuesta para revisar; no cambia el producto** (no hay cambios en `src/`, `package.json`, el lockfile, la CI ni el instalador). Base: `main` en `22d936c` (incluye E0 y L2). Continúa [E0](LARGE-DATA-EXTRACTS.md) y el [RFC](LARGE-FILE-EDITOR-RFC.md); las mediciones están en la [evidencia M1](../evidence/m1-motores-externos-2026-10-25.md) y sus JSON en `experiments/large-data-extracts/results/m1-*.json`.

Etiquetas: **[M1]** medido en M1; **[E0]** medido en E0; **[RFC]** medido en el RFC; **[V]** verificado en GitHub o en la documentación del proyecto el 24-oct-2026; **[ND]** no medido ni verificado.

## 0. Resumen

1. **Ningún proyecto revisado edita un CSV conservando sus bytes.** Todos reescriben el archivo: normalizan el comillado (DuckDB escribe `""` para una cadena vacía), cambian el fin de línea (qsv y Miller escriben LF salvo que se configure) y descartan el BOM **[M1]**. Por eso el índice, la copia de registros intactos, la capa de cambios con diario y el guardado atómico siguen siendo de FreyaLab. Es poco código y es lo que protege los datos.
2. **Lo que sí conviene dejar a un motor externo** es el cálculo derivado: filtrar, extraer, agrupar, ordenar fuera de memoria, estadísticas, deduplicar, unir, varios archivos. Es lo que el RFC planeaba escribir en L4–L8.
3. **Recomendación: un solo motor externo, DuckDB nativo**, en un proceso auxiliar propio con lista cerrada de operaciones y **solo después de superar la puerta del RFC §7.4**. Con el lector paralelo, DuckDB 1.5.6 hace una pasada de 1 GiB en 0,41–1,23 s con 180–1400 MiB de memoria **[M1]**. La velocidad que se atribuía a Polars frente a DuckDB en las primeras cifras era una diferencia de configuración, no de motor (sección 3).
4. **qsvlite** queda como **candidato secundario** para operaciones en flujo con muy poca memoria (0,92–4,19 s por pasada de 1 GiB con 13–14 MiB **[M1]**), no como segundo motor de producción: no tiene binario para macOS Intel, solo lee UTF-8 y acepta una comilla sin cerrar. **Miller, Polars (Python y Node) y VisiData no entran en producción**; los motivos están en la sección 3.
5. **Los motores no son el validador.** qsv, qsvlite y Polars aceptan una comilla sin cerrar; Polars rellena en silencio una fila corta y acepta UTF-16 de longitud impar; Miller cambia saltos de línea dentro de campos; con Windows-1252 buscar texto con acentos devuelve 0 sin error **[M1]**. La regla central: **FreyaLab valida estructura y codificación antes de dar un archivo a un motor y reconcilia el recuento de registros del motor con el de su índice** (sección 4).
6. **Primera entrega:** la interfaz de operaciones y E1 con la implementación propia estricta (sin puertas de seguridad que superar); **primera integración de un motor externo:** DuckDB tras medirlo en su forma nativa (M2) y superar §7.4 (sección 8).
7. **Pendiente de medir:** DuckDB nativo 2.0.0 por `@duckdb/node-api` (no se descargó: la autorización de M1 cubría qsv, Miller y Polars), y macOS Intel, Windows y Linux.

## 1. Alcance de la evaluación

| Pedido | Qué se hizo |
|---|---|
| Revisar el estado actual | `main@22d936c`, #57 (L2) y #59 (E0) fusionados, RFC, índice disperso, motor CSV, DuckDB-Wasm |
| Evaluar qsv, Miller, DuckDB, VisiData, Polars | Matriz de la sección 2. Medidos: qsv, qsvlite, Miller, Polars Python y nodejs-polars. DuckDB: CLI 1.5.6 **[M1]**. VisiData: solo documental |
| Prototipos aislados con los mismos archivos y operaciones | Adaptadores en `experiments/large-data-extracts/` (T1–T6, 100 MiB y 1 GiB, formatos, casos límite, copia sin transformar, cancelación, ordenación). Sin dependencias permanentes |
| Integridad en tres niveles | Sección 4 |
| Arquitectura, procesos auxiliares | Sección 5 |
| Código eliminable, riesgos, roadmap, primera integración | Secciones 6 a 8 |

No se repitió el RFC §6 (otros archivos, 230 columnas) ni se volvieron a medir las tareas de E0 salvo como línea base en la misma sesión: el oráculo y las líneas base se ejecutaron otra vez para que todas las cifras compartan máquina y estado.

## 2. Matriz de reutilización

| Criterio | qsv (qsvlite) | Miller | DuckDB | VisiData | Polars |
|---|---|---|---|---|---|
| **1. Qué podemos reutilizar** | `count`, `search`, `select`, `replace`, `slice`, `sort`, `extsort`, `dedup`, `frequency`, `stats`, `index`, `join`; `sqlp` solo en el completo **[V]** | Verbos (`cut`, `head`, `sort`, `count-distinct`…) y un DSL **[V]** | SQL completo: filtro, agrupación, ordenación externa, uniones, varios archivos | Exploración interactiva; su registro de comandos como modelo de recetas | Consultas lazy en flujo, `sink_csv`, agrupación, ordenación |
| **2. Ejecutable o librería** | Solo ejecutable (Rust); `qsv` completo, `qsvlite`, `qsvmcp`, `qsvpy3xx` **[M1]** | Solo ejecutable (Go) | Bindings Node `@duckdb/node-api`, CLI y Wasm **[V]** | Aplicación de terminal (Python) | Python 2.0.0 y `nodejs-polars` 0.26.1 **[V]** |
| **3. Licencia** | MIT (antes MIT/Unlicense) **[V]** | BSD-2-Clause **[V]** | MIT **[V]** | **GPL-3.0** **[V]** | MIT **[V]** |
| **4. Mantenimiento** | 26.0.0 (19-oct-2026) **[V]** | 6.22.0 (25-sep-2026) **[V]** | 2.0.0 (21-oct-2026) **[V]** | 3.4 (1-jul-2026) **[V]** | `py-2.0.0` (6-oct-2026); `nodejs-polars` 0.26.1 (14-sep-2026) embebe `polars-*` 0.55.2 **[V]** |
| **5. Electron** | Proceso hijo con `spawn` sin shell | Proceso hijo | Binding nativo en un `utilityProcess` (no probado en este repositorio) o proceso hijo; Wasm ya en el producto | No aplica | Binding N-API (probado con Node 24, **no** con Electron); Python exigiría distribuir un intérprete |
| **6. macOS ARM · Intel · Windows x64 · Linux x64** | ✓ · **sin binario precompilado** · ✓ · ✓; los x64 exigen CPU con AVX2 **[V]** | ✓ · ✓ · ✓ · ✓ **[V]** | ✓ · ✓ · ✓ · ✓ (CLI **[V]**; bindings **[E0]** documental) | Windows solo con WSL o MSYS2 **[E0]** | Binding declara los cuatro **[E0]**; Python: wheels de cada paquete **[ND]** |
| **7. Rendimiento con 1 GiB** (6 tareas) | qsvlite 0,92–4,19 s, 13–14 MiB; qsv completo 0,39–4,04 s **[M1]** | 4,80–16,56 s, ~1 GiB; ordenar 31,9 s con 10,8 GiB **[M1]** | Paralelo 0,41–1,23 s, 180–1402 MiB; 1 hilo 2,99–7,81 s, ~480 MiB; ordenar 3,3 s (3,7 GiB) o 5,0 s con 1 GB de límite y 0,95 GiB de derrame **[M1]** | No aplica | Multihilo 0,25–0,62 s, 1,1–1,6 GiB; 1 hilo 0,22–4,07 s **[M1]** |
| **8. Preservación** | Valores ✓. Estructura ✓ (rechaza fila corta con registro y byte). **Acepta comilla sin cerrar.** Bytes: normaliza comillado, LF y BOM. UTF-16 falla; Windows-1252 da resultados equivocados **[M1]** | **Cambia el CRLF/LF dentro de campos** (valores ✗). Estructura ✓. Bytes: no **[M1]** | Valores ✓, estructura ✓ (rechaza, sin posición). Bytes: no (`""`, LF, sin BOM). UTF-16 ✓; no lee Windows-1252 **[M1][E0]** | No aplica | Valores ✓ si se configura. **Rellena fila corta, acepta comilla sin cerrar y UTF-16 impar**; en Node, opciones ignoradas y pérdida de precisión **[M1]** |
| **9. Coste de distribución** | `qsvlite` 17 MB; `qsv` 167 MB; zip publicado de 315 MiB **[M1]**. macOS Intel: habría que compilarlo | `mlr` en un `.tar.gz` de 5,3 MiB **[M1]** | CLI 18–23 MiB comprimida **[V]**; paquete nativo darwin-arm64 64 MB descomprimido **[RFC]** | Intérprete y dependencias | Wheel de runtime 45,7 MiB **[M1]**; `nodejs-polars` **[ND]** |
| **10. Código propio eliminable** | Poco: DuckDB lo cubre | Ninguno | Los recorridos de L4–L6 y L8; a medio plazo la ventana de DuckDB-Wasm | Ninguno (referencia de UX) | Lo mismo que DuckDB, como segundo motor |

## 3. Qué dicen las mediciones de M1

Las cifras completas y la configuración de cada motor están en la [evidencia](../evidence/m1-motores-externos-2026-10-25.md). Lo que cambia las conclusiones:

- **La velocidad no distingue entre DuckDB y Polars; la configuración sí.** La primera pasada comparaba Polars (todos los núcleos) con el DuckDB de E0 (`threads=1`, `parallel=false`). Con 12 hilos y el lector paralelo, DuckDB queda en el mismo orden que Polars y usa mucha menos memoria en cinco de seis tareas. Con 12 hilos pero el lector no paralelo no mejora nada.
- **Con un solo hilo, qsvlite y Polars de 1 hilo superan a DuckDB de 1 hilo**, y qsvlite lo hace con 13–14 MiB. Es el único motor cuyo coste de memoria no depende del tamaño del archivo en las tareas de flujo.
- **Miller es el más lento de los nuevos, usa ~1 GiB siempre y ordena en memoria** (10,8 GiB para 1 GiB de CSV); además cambia valores. No hay motivo para llevarlo a producción.
- **Polars es el más rápido y el menos estricto por defecto.** Sus rechazos son los más débiles de los medidos y, en Node, la API tiene dos trampas que alteran valores sin avisar. Es un buen comparador de laboratorio, no un motor del que depender para integridad.
- **DuckDB es estricto pero poco informativo**: rechaza filas irregulares y bytes UTF-16 incompletos con «Error when sniffing file», sin registro ni byte; qsv sí da el registro y el byte.
- **Cancelar un proceso hijo funciona y es barato** (≤ 10,1 ms para que desaparezca el grupo, sin huérfanos), pero **deja la salida parcial en disco** (16–429 MiB) y, con `qsv extsort`, un índice junto al archivo de entrada si no se toma una precaución.

## 4. Integridad: tres niveles y las reglas que salen de M1

| Nivel | Qué exige | Resultado en M1 |
|---|---|---|
| **Valores** | Mismas cadenas en las mismas posiciones; ceros iniciales; ausente ≠ vacío | 142 de 142 mediciones de los motores contra el oráculo en el fixture regular. Fallan los casos hostiles: Miller (saltos de línea dentro de campos), Polars (fila corta), Windows-1252 y UTF-16 en qsv, Miller y Polars |
| **Estructura** | Mismo número de campos por registro y mismo orden | qsv, qsvlite, Miller y DuckDB rechazan filas irregulares; **Polars las rellena** |
| **Bytes sin modificar** | Los registros que no cambian salen idénticos | Con LF y comillado mínimo, qsv, qsvlite, Miller y Polars devuelven el archivo idéntico; con CRLF solo si se configura (Polars) o se usa `--ors crlf` (Miller, que corrompe los LF internos). **Con todos los campos entrecomillados ninguno lo conserva, y ninguno conserva el BOM.** DuckDB nunca |

Reglas (sin excepciones):

- **R1. El original es de solo lectura y su SHA-256 no cambia.** Ninguna operación lo usa como destino.
- **R2. FreyaLab valida antes de delegar.** Codificación, BOM y estructura (comillas cerradas, número de campos) se comprueban con el índice y un analizador estricto (`csv-parse`, ya instalado) antes de dar un archivo a un motor. El motor no es el validador.
- **R3. Reconciliar el recuento.** El número de registros que informa el motor debe igualar el del índice de FreyaLab; si no, la operación falla. Detecta comillas sin cerrar, UTF-16 mal leído y relleno de filas.
- **R4. UTF-8 como contrato.** Si la fuente no es UTF-8, se transcodifica a un archivo de trabajo o se rechaza la operación; nunca se pasan bytes crudos (Windows-1252 da resultados equivocados sin error). DuckDB lee UTF-16 pero no Windows-1252.
- **R5. Cada resultado declara su fidelidad:** «bytes conservados» (solo si FreyaLab copia los registros desde el original), «valores y estructura conservados; formato normalizado (comillado, fin de línea, BOM)» o «agregado».
- **R6. Pruebas de contrato por motor y versión fijada** con los fixtures hostiles de M1 (ceros iniciales, enteros mayores que 2^53, fila corta, comilla sin cerrar, CRLF dentro de campo, UTF-16, Windows-1252). Una opción ignorada en silencio o un cambio de versión rompe la prueba, no los datos del usuario.

## 5. Arquitectura propuesta

### 5.1 Capas

1. **Capa canónica (FreyaLab):** detección de codificación, BOM y saltos de línea; índice por posición (L2); lectura de páginas; copia de registros intactos; capa de cambios con diario (L3); guardado atómico.
2. **Interfaz de operaciones:** unión cerrada y tipada, validada con `zod` (ya instalado). La interfaz de usuario nunca envía argumentos, SQL ni expresiones.
3. **Motores detrás de la interfaz:** (A) **propio**: índice + `csv-parse` estricto + copia de bytes; (B) **DuckDB nativo** en un proceso auxiliar. Nada más en producción.
4. **Banco independiente (fuera del instalador):** Python `csv` como oráculo; qsv, Miller y Polars como comparadores.

### 5.2 Operaciones (v1, lista cerrada)

| Operación | Entrada → salida | Motor | Fidelidad |
|---|---|---|---|
| `count` | fuente, condiciones → número | A o B (+R3) | n/a |
| `preview` | fuente, condiciones → primeras 20 coincidencias | A | bytes |
| `filter_extract` | fuente, condiciones, columnas → archivo nuevo | A (registros completos) o B (proyección) | A: bytes; B: valores y estructura |
| `aggregate` | fuente, agrupar, medidas → tabla pequeña | B | agregado |
| `sort_to_file` | fuente, claves → archivo nuevo | B | valores y estructura |
| `search_positions` | fuente, patrón → posiciones paginadas | A o B | n/a |
| `replace_literal_to_file` | fuente, columna, buscar, reemplazar → archivo nuevo | A | bytes en los registros intactos |
| `stats` / `dedup` | fuente, columnas → tabla o archivo | B | agregado / valores |
| (después) `union_files`, `join` | varias fuentes → archivo | B | valores y estructura |

La fuente la describe FreyaLab (ruta resuelta por el proceso principal, codificación, separador, encabezado, BOM, índice); el motor no infiere nada. Las condiciones son estructuras tipadas con columnas por posición.

**Patrón a evaluar, no resultado:** «DuckDB decide, FreyaLab copia los bytes». Para extraer registros completos con sus bytes originales, B calcularía las posiciones y A copiaría esos registros. Exige comprobar que ambos cuentan los mismos registros en el mismo orden en todos los fixtures hostiles y rechazar la operación si no coinciden (R3).

### 5.3 Proceso auxiliar: qué protege cada control y qué no

| Control | Cómo | Qué evita | Qué **no** evita |
|---|---|---|---|
| Lista cerrada | Esquema `zod` con la unión de operaciones | Que algo inexistente se ejecute | Un fallo del propio motor |
| Validación | Columnas por índice; literales como parámetros enlazados (sentencias preparadas de `node-api`, **a confirmar en M2**) | Inyección de SQL o de DSL | — |
| Sin shell | `utilityProcess` para DuckDB; `spawn(ruta, [argumentos], {shell: false})` para cualquier binario | Inyección por el intérprete | Lo que el binario haga por sí mismo (`foreach` de qsv, `system` de Miller) |
| Rutas | La fuente sale del registro de documentos del proceso principal; la salida solo en una carpeta de trabajo propia con permisos restrictivos; no seguir enlaces simbólicos; `allowed_paths` exacto en DuckDB. **`qsv index` escribe junto al archivo de entrada**: indexar un enlace simbólico dentro de la carpeta de trabajo **[M1]** | Lecturas y escrituras fuera de lo previsto **por la aplicación** | Un hijo corre con los permisos del usuario: **no es un sandbox** (RFC §7.3) |
| Cancelación | `AbortSignal` → `interrupt()` de DuckDB (2–3 ms **[RFC]**) o SIGTERM al grupo y SIGKILL de reserva; el grupo desaparece en ≤ 10,1 ms **[M1]**; **borrar la salida parcial** | Procesos huérfanos | Archivos parciales: los deja el motor |
| Límites | Tiempo máximo; espacio libre antes de escribir (la ordenación necesitó 0,95 GiB de derrame con 1 GB de límite); `memory_limit`, `max_temp_directory_size`, `threads` | Llenar el disco | `memory_limit` **no es un tope del proceso**: +34 % medido **[M1]**; macOS no ofrece un límite de memoria fácil para un hijo |
| Temporales | Carpeta por operación; borrar al terminar, cancelar o fallar; barrido de huérfanos al arrancar | Acumular copias de datos sensibles | Borrado forense en SSD |
| Red y ejecución | DuckDB: `autoinstall`/`autoload` desactivados, `enable_external_access=false`, `lock_configuration` **[RFC]**. Si se usara qsv: solo `qsvlite` (no trae `fetch`, `foreach`, Luau ni `sqlp` **[M1]**). Miller: nunca con expresiones del usuario | Descargas y ejecución **desde la configuración de la aplicación** | Una vulnerabilidad del motor |
| Procedencia | Versión fijada y SHA-256 comprobado al arrancar; avisos de licencia en `THIRD_PARTY_NOTICES.txt` | Binario sustituido | — |

Conclusión del RFC §7.3, confirmada: **un proceso separado da aislamiento de fallos, no de seguridad.** La defensa real es no aceptar código del usuario (SQL libre, DSL, Luau) en estas rutas.

## 6. Código propio que podría eliminarse

| Candidato | Cuándo | Condición |
|---|---|---|
| Recorridos propios de búsqueda (L4), filtro, ordenación externa y estadísticas (L5), transformaciones en flujo (L6) y SQL grande (L8) | Antes de escribirlos | Motor B aprobado y operaciones de 5.2 con pruebas de contrato (R6) |
| `splitFields` tolerante de `large-table.ts` (L2) | Ya | Sustituir por `csv-parse` sobre el texto de cada registro, con rechazo de comillas mal cerradas |
| Lectura de varios archivos y uniones propias | Antes de escribirlas | Globs de DuckDB con lista congelada y esquema revisado (E0 §6) |
| Ventana oculta de DuckDB-Wasm, `analysis-source.ts` y el puente Arrow | Después | DuckDB nativo aprobado, una sola versión y paridad de resultados con las pruebas actuales (RFC L9) |

**No se puede eliminar:** el índice, la copia de bytes, la capa de cambios, el guardado atómico, la detección de codificación ni la interfaz. M1 refuerza que ningún motor ofrece conservación de bytes.

## 7. Riesgos

1. **Normalización silenciosa:** un resultado parece idéntico y no lo es. Mitigación: R5 y su etiqueta en la interfaz.
2. **El motor acepta lo inválido** (qsv, Polars) o lo lee mal (Windows-1252, UTF-16). Mitigación: R2, R3 y R4.
3. **Desajuste de límites de registro** entre FreyaLab y DuckDB con CSV malformados (patrón 5.2). Mitigación: R3.
4. **Puerta §7.4 sin superar:** sin aislamiento del sistema operativo demostrado en Windows y Linux, DuckDB nativo no se adopta. Plan alternativo: la implementación A (más lenta, estricta) o una única alternativa elegida con los datos de M1.
5. **Empaquetado nativo:** la aplicación va sin firmar (`identity: null`); un `.node` bajo *hardened runtime* puede exigir firma; el paquete darwin-arm64 pesa 64 MB.
6. **qsv:** sin binario para macOS Intel, AVX2 en x64, zip de 315 MiB y comandos de red y ejecución en la variante completa.
7. **Miller:** corrompe saltos de línea dentro de campos, ordena en memoria y tiene un DSL con `system`/`exec`.
8. **Polars:** el binding de Node ignora opciones con nombres de Python y pierde precisión; sus valores por defecto son los más laxos.
9. **Dos versiones de DuckDB** (Wasm 1.33.1-dev57 en el producto; 1.5.6 y 2.0.0 en las mediciones): dialecto y resultados podrían diferir.
10. **Datos en carpetas de trabajo:** extractos, índices y temporales conservan información sensible; hace falta política de ubicación, retención y limpieza (E0 §6).
11. **Mediciones de un equipo, una repetición, caché caliente:** no es un SLA ni cubre otros sistemas.
12. **Anomalía abierta del RFC (R12):** el cambio masivo a 10 GiB tardó 813 s sin explicación. No prometer 10 GiB.

## 8. Roadmap incremental y primera integración

| Paso | Contenido | Puerta de salida |
|---|---|---|
| **M1** (este PR) | Mediciones, matriz, recomendación | Revisión del usuario |
| **M2** | DuckDB nativo 2.0.0 (`@duckdb/node-api`) con el mismo banco, en un `utilityProcess`: `interrupt()`, derrame, sentencias preparadas, Windows-1252/UTF-16, y los 27 controles del RFC §7 | Cifras comparables entre motores con la misma versión. **Requiere tu autorización para descargar el paquete** |
| **I0** | Interfaz de operaciones y esquema de validación con **una** implementación: la propia con `csv-parse` estricto, R2–R4 y R6 | Pruebas de contrato; rechazo de comillas abiertas y UTF-16 impar |
| **E1** | «Extraer a un documento nuevo» sobre I0 (`count`, `preview`, `filter_extract`) | Original intacto (SHA-256); cancelación; extracto editable si cabe en 50 MiB y 2 M de celdas |
| **P1** | Proceso auxiliar de DuckDB nativo con las puertas del §7.4 y pruebas automáticas | Aislamiento, empaquetado en 4 destinos, una sola versión |
| **B1** | Segunda implementación de las mismas operaciones con DuckDB y comparación con la propia | Misma salida validada (R3); elegir por operación con datos |
| **A1** | `aggregate`, `sort_to_file`, `stats`, `dedup` (solo motor B) | Memoria y temporales acotados con 1 GiB y 5 GiB |
| **U1** | Varios archivos (`union_files`) | Esquemas y encabezados con decisión visible |

**Primera integración recomendada:** I0 + E1 con la implementación propia estricta, porque no depende de ninguna puerta y fija el contrato que cualquier motor tendrá que cumplir. **La primera integración de un motor externo es B1, con DuckDB**, y solo después de M2 y P1. Si P1 no supera la puerta, B1 se sustituye por **una** alternativa elegida con los datos de M1; hoy sería `qsvlite` bajo las condiciones de la sección 0 (compilación para macOS Intel, transcodificación a UTF-8 y R2/R3).

## 9. Decisiones que necesito de ti

1. ¿Autorizas M2 (descargar `@duckdb/node-api` 2.0.0-r.1 en una carpeta temporal aislada y medirlo con el mismo banco)?
2. ¿Un extracto o resultado ordenado puede declararse «valores y estructura conservados; formato normalizado», o exiges bytes originales siempre que sea posible (y entonces solo el motor A puede escribirlos)?
3. ¿Los destinos siguen siendo macOS ARM e Intel, Windows x64 y Linux x64? qsv no tiene binario para macOS Intel.
4. ¿Cuándo se firma y notariza la aplicación? Afecta al binario nativo de DuckDB.

## 10. Qué no está verificado

- DuckDB nativo 2.0.0 por `node-api` (solo la CLI 1.5.6 de Homebrew en M1; el nativo 2.0.0 se midió en el RFC con otros archivos).
- macOS Intel, Windows y Linux: ninguna cifra ni empaquetado.
- La latencia de cancelación por IPC de la aplicación y `interrupt()` de DuckDB en este banco.
- Que las sentencias preparadas de `node-api` cubran todos los literales de la sección 5.3.
- `qsv index` como sustituto del índice de L2 (solo se midió su coste de 1 s y 35 MiB en 1 GiB).
- VisiData (solo licencia y descripción), el tamaño y el arranque del instalador con cualquier motor, y la caché fría.
