# PRJ-03 · Exportar conjuntos con procedencia · Evidencia local

**Borrador completo preparado; CI e Intel pendientes.** El head local revisado en este corte es `fb8b260912341f026502272eb275c46c45fab61d`. Su producto es idéntico a `62bf3d8` y `32f531b`: comparten el árbol `src` `ec12107e61373bea9556e5540f8f966690037508`; los commits posteriores modifican solo E2E. Se conservan check, 3.065 unitarias aprobadas/2 omitidas y medidas ARM de 1 GB identificadas por fase. La integral fresca de **803 identidades sobre `c257980` terminó fallida**: 798 aprobadas ordinarias, un fallo esperado SEG-S2e y cuatro fallos de expectativas antiguas del menú. Sus 16 pruebas de exportación y siete casos de 1 GB sí pasaron. Los consumidores se cerraron después por **unión de 25 aprobadas en `07c15b4` y C9 aprobada aparte en `fb8b260`**, no una corrida de 26/26 ni una integral posterior verde. No está listo para fusión.

[Historia y 17 criterios](../stories/historia-prj03-exportar-conjunto-diseno-para-codex.md) · [Alcance y siete respuestas del ADR 0021](../stories/prj03-alcance-adr-0021.md) · [Identidad y resultados por fase](prj03-exportar-conjuntos-2026-11-19/qualification.json) · [Integral y cierres E2E](prj03-exportar-conjuntos-2026-11-19/local-e2e-closure.json) · [Logs enfocados saneados](prj03-exportar-conjuntos-2026-11-19/focused-runs-sanitized.log).

## Comportamiento y límites del cambio

Exportar desde una receta guardada crea el archivo dentro del proyecto y registra su procedencia. Se reutilizan el motor de recetas, la escritura por streaming, los controles de fuentes y la persistencia atómica. La interfaz envía ids; main elige y valida la ruta mediante el selector nativo. El resultado aparece como hijo del conjunto y permite Abrir, Mostrar, Añadir como fuente y Quitar del proyecto. Quitar retira el registro; conserva el archivo.

La exportación verifica el SHA completo de la fuente, incluso cuando Primeras N deja de interpretar registros. Preserva bytes cuando no se proyectan columnas; cuando se proyectan, conserva valores y ausencias finales, y cuenta las ausencias intermedias que se escriben vacías. No se deriva el archivo de la vista previa de cien filas. Se conservan las cuatro decisiones aprobadas: límites de orden, SHA completo, tratamiento explícito de ausencias y bloqueo de eliminación de recetas con resultados.

## Identidad y rojo → verde

Las fases se solapan: sus cantidades **no se suman** como pruebas distintas ni se transfieren entre commits. Los originales privados se conservan; el JSON enlazado registra sus SHA-256.

| Fase | Identidad | Resultado observado |
|---|---|---|
| Alcance inicial | `b151576b`, sobre main `614e2f37` | Historia/ADR antes de implementar. La posterior fusión documental #197 no contenía la función. |
| Primer rojo de motor | Mismo checkpoint documental, source base `614e2f37` | `recipe-extract` salió 1 en 0,395 s antes del cambio. Luego motor y regresiones: 88/88 en seis archivos, 1,039 s de proceso. |
| Primer rojo GUI | Bundle de `401713dd` | Falta la acción Exportar; exit 1, 17,614 s de proceso. |
| Candidato local anterior | HEAD base `4a95c22d`, **producto sin commit** | Check 0 errores/0 avisos, 9,285 s; **3.065 unitarias aprobadas y 2 omitidas**, 173 archivos aprobados/1 omitido, 17,673 s de proceso; build 1,906 s. Es evidencia histórica del árbol modificado, **no una corrida completa de `62bf3d8`**. |
| Doble Enter en Registrar de nuevo | Interfaz candidata antes del guard | Rojo real: dos llamadas y reaparición de Retry tras éxito. Se añadió exclusión por requestId y estado. La primera tanda posterior tuvo 10 aprobadas y 2 fallos del harness, no un verde global. |
| Correcciones del harness | Espera de documento abierto y helper de paleta nativa | Cuatro casos enfocados aprobados, 7,190 s, sin reintentos; no se relajaron oráculos de datos. Los selectores de diálogo/footer corregidos no se contaron como fallos de producto. |
| Implementación completa inicial | `a59075fefb313d4bd1bb6111982df8049da3dab6` | Incluye producto y pruebas; el primer intento ARM se detuvo por el rechazo de ids persistidos v1 válidos, antes de medir correctamente el motor. |
| IDs v1 opacos | Prueba conservada en `f57563c5`; rojo ejecutado sobre `a59075f` | `gb-project` y `gb-source` son válidos según el manifiesto, pero el IPC nuevo exigía UUID. Rojo real: «Datos de operación no válidos». Se reutilizó el validador canónico string 1..100; los ids temporales de solicitudes/documentos/borradores conservan su contrato UUID. |
| Cierre de IDs | `62bf3d81a2915b33821088da7cf50dd56ad27d2a` | 39/39 unitarias enfocadas, 1,937 s, sobre el mismo hash de `src/main/index.ts` que este commit; check 0/0 en 11,811 s; build 2,506 s; **13/13 E2E, 19,048 s de proceso, 0 omitidas, 0 retries, 0 flaky**. |
| 1 GB ARM, primera tanda con IDs corregidos | `62bf3d8` | Filtro y cancelación aprobados; muestra falló esperando la fila DOM a los 15 s mientras el progreso público aún mostraba procesamiento. Tanda exit 1; no se declara benchmark completo verde. |
| 1 GB ARM, sincronización con resultado registrado | `32f531b61809e89be3cf12001bccd252717e5237`, solo pruebas | Antes de comprobar DOM se espera el evento público `project` con resultado registrado. Sin elevar plazos, cambiar retries ni modificar producto. **3/3 aprobadas, 69,521 s de proceso, 0 omitidas, 0 retries, 0 flaky**; C15 completo. |
| Unitarias completas posteriores | `32f531b61809e89be3cf12001bccd252717e5237` | **3.065 aprobadas y 2 omitidas existentes**, 173 archivos aprobados/1 omitido de 174; Vitest 21,24 s y proceso 21,562 s, exit 0. Pandoc real 3.12.1 confirmado en esta calificación. Es una corrida nueva; no se hereda el resultado histórico del candidato sobre `4a95c22d`. |
| Primer intento C3/C16 | `32f531b`, con las tres nuevas pruebas antes de commit | Dos C16 aprobadas; C3 falló solo porque el oráculo de normalización omitía los cuatro mensajes base correctos del escritor. Se corrigió al arreglo exacto de cinco, conservando bytes, SHA y warning. No fue cambio de producto ni se declaró aprobado el origen antes de alcanzarlo. |
| C3/C16 con oráculo corregido | `c2579806407c92a4413727f77b60f167a318386f` | **3/3 aprobadas**, 4,353 s de proceso, sin omisiones/reintentos/flaky. C3 alcanza salida, aviso final, fila y origen; C16 alcanza panel y menú en changed/missing. |
| Intento integral interrumpido | HEAD `c257980`, bundle todavía `32f531b` | APP-02 detectó la identidad de build incorrecta; root interrumpió, exit 130, 368,854 s. Quedaron 194 aprobadas ordinarias + un fallo esperado, un fallo inesperado APP-02, una interrumpida y 606 sin ejecutar. No se cuenta como integral completa ni como verde. |
| Integral fresca completa | `c257980`, build fresco propio en 2,080 s | **803 identidades, 798 aprobadas ordinarias + un fallo esperado SEG-S2e + cuatro inesperadas**, 0 omitidas/reintentos/flaky, 1.788,047 s de proceso, exit 1. Las 16 de exportación y siete de 1 GB pasaron. |
| Menús actualizados, árbol + exportaciones | `07c15b452beba2e2e2b970c4a2d9692359e7946b` | **25 aprobadas/una fallida de 26**, 50,025 s. C9 exigía incorrectamente `aria-disabled="false"`; el componente omite ese atributo cuando está habilitado. |
| Oráculo de disponibilidad corregido | `968430fd38c7c7b18b533f4f66124e68fc365dee` | `toBeEnabled` conserva la comprobación real. C9 aún falló por el driver nuevo: `menu.press` reenfocaba el contenedor en cada flecha. Tanda enfocada exit 1, 17,058 s. |
| Driver de teclado corregido | `fb8b260912341f026502272eb275c46c45fab61d` | Build 1,927 s; **C9 1/1 aprobada**, 1,743 s de proceso, sin retries. Home comprueba Abrir y las flechas de teclado comprueban Analizar→Exportar. Producto sin cambios. |

La comprobación de tipos intermedia que encontró el error del harness `originalSource` posiblemente nulo también se conserva como fallida. La comprobación 0/0 de `62bf3d8` es posterior y separada. El verde de 13 E2E incluye el nuevo caso de ids v1, los tres idiomas y el caso de doble Enter; no equivale a la suite E2E completa.

La corrida completa posterior detectó Pandoc real 3.12.1. Ese binario declara carecer de soporte HTTP; la eficacia del sandbox HTTP no queda calificada por este resultado.

## Integral y migración de consumidores

Los cuatro fallos inesperados de la integral fresca pertenecen a `project-tree.spec.ts`: C9, C2/C3/C6 y C12 en es/en-XA. Sus arreglos esperaban el menú anterior sin Exportar. Se añadió «Exportar…» después de «Analizar», conservando todas las acciones y los oráculos de datos. El único cambio de título fue C9: «las quince acciones» pasó a «las acciones»; no se eliminó ninguna prueba.

Los dos fallos de C9 durante el cierre fueron de las aserciones nuevas. Primero se sustituyó la exigencia de un atributo literal por el estado habilitado. Después se corrigió el driver: `ContextMenu` obtiene el índice desde `document.activeElement`; reenfocar el contenedor antes de cada flecha dejaba ese índice en −1. Las flechas reales conservan el foco entre elementos. No se modificó `ContextMenu`, el producto, los plazos ni los retries para hacer pasar estas pruebas.

El cierre enfocado contiene 26 identidades únicas por unión **25 + 1 en ejecuciones y heads distintos**. No se volvió a ejecutar la integral completa sobre `fb8b260`; el resultado global registrado de `c257980` permanece fallido. El fallo esperado SEG-S2e también se conserva y ejecuta: el título heredado es «SEG-S2a · estilos y metadatos XML imposibles conservan el documento», con `test.fail` explícito por el límite de custom-style. No está omitido y un verde inesperado exige revisar ese límite. Este paquete no copia su payload XML ni ZIP de trazas.

## Cuatro reproducciones de fronteras de confianza

Las cuatro regresiones usan Store, Registry y/o I/O reales, con intercepción acotada al punto de fallo. Quedaron rojas antes de los cambios:

1. **Metadatos denegados después del rename real.** El archivo ya publicado conserva sus bytes y un resultado recuperable `unregistered`. Registrar de nuevo verifica la misma salida y conserva la ejecución histórica. Los metadatos proceden del descriptor del temporal publicado; no se inventa una fecha.
2. **Padre del destino sustituido por enlace externo.** Se reautoriza dentro de la reserva antes del motor y se comprueban confinamiento e identidad antes de crear/publicar. El caso rechaza sin archivo ni temporal fuera del proyecto.
3. **Cambio de A a B antes de preparar la fuente.** La petición antigua revalida id+ruta antes de preparar y no sustituye el borrador real de B.
4. **Cambio de A a B dentro de la preparación.** Una generación privada invalida la preparación antigua antes de asignar el borrador; se conservan id, ruta, columnas, manifiestos y bytes de B.

Los dos primeros casos pasaron enfocados y dentro de 26/26; los dos últimos pasaron enfocados y los cuatro quedaron incluidos en **37/37** de coordinador y fuentes, 2,438 s de proceso. Son fases del producto sin commit sobre `4a95c22d`, identificadas por hashes; no 37 pruebas adicionales a una suite global.

**Límite residual TOCTOU:** se comprueban pathname e identidad inmediatamente antes de las operaciones; no hay bloqueo kernel del directorio. Persiste una ventana entre la última comprobación y la syscall ante una sustitución externa arbitraria. Estas reproducciones acotadas no acreditan seguridad TOCTOU absoluta.

El watcher conserva evidencia de una ejecución restringida con unlink ausente/EMFILE y de una ejecución autorizada posterior sin esos fallos, con límites sin cambiar y cierre de todas las instancias. No se atribuye por inferencia una causa universal ni se presenta como validación nativa Windows.

## Correspondencia de los 17 criterios

«Cubierto local» identifica oráculos existentes y sus fases anteriores; solo la tabla de calificación atribuye una ejecución a un head concreto.

| Criterio | Prueba y evidencia | Estado de este corte |
|---|---|---|
| 1. Oaxaca adultos y manifiesto | [Motor](../../tests/recipe-extract.test.ts), [coordinador](../../tests/project-exports.test.ts) y E2E de menú: bytes literales, Nota ausente, tres filas, SHA, cobertura e instantánea. | Cubierto local. |
| 2. Conservación de bytes y formatos | `recipe-extract`: registros sin proyección, multilineal, registro corto, UTF-8/BOM/CRLF, win1252 y UTF-16LE. | Cubierto local de motor. |
| 3. Ausente antes de presente | Proyección Nota/ID y contador de normalización; aviso en final, fila y origen, con cinco normalizaciones exactas y salida de 50 B. | GUI C3 aprobada enfocada y dentro de la integral fresca `c257980`; `,00128` exacto. |
| 4. Muestra semilla 7 | Vector independiente de tres IDs en orden del archivo, con etapas de muestreo. | Cubierto local de motor; separado de las medidas de 1 GB. |
| 5. Primeras 2 y SHA completo | Cola CSV inválida que solo se drena para hash; cobertura parcial y total desconocido. | Cubierto local; no se interpreta la cola para inventar un total. |
| 6. Orden fuera del límite | Rechazo antes de publicar y excepción orden→Primeras N; orden→muestra y primeras posteriores. | Cubierto local de motor. |
| 7. 1 GB ARM/Intel | [Casos perf existentes](../../tests/e2e/project-subsets-perf.spec.ts): filtro de 500.000, muestra de 10.000 con semilla 7 y cancelación. | **3/3 ARM en `32f531b`; los siete casos del archivo pasaron también dentro de la integral `c257980`. Intel pendiente.** |
| 8. Destinos y espacio | Coordinador: fuera/protegido/abierto/enlace/extensión, resultado anterior y alias nativo válido. Motor: falta de espacio sin archivo/temporal. | Cubierto local; Windows/CI final pendiente. |
| 9. Árbol y acciones | E2E de menú/panel, procedencia al abrir, alta por diálogo de huella y Quitar confirmado sin borrar. | Cubierto por las 16 E2E de exportación en la integral; consumidores cerrados por unión de fases. |
| 10. Cambio/borrado externo | E2E del resultado nunca abierto y edición/guardado con advertencia histórica. | Cubierto por las 16 E2E de exportación en la integral. |
| 11. Eliminar receta con resultados | [Persistencia](../../tests/project-results.test.ts) y E2E de alta/quitar: bloqueo con motivo y desbloqueo tras retirar resultados. | Cubierto local. |
| 12. Exportar de nuevo | E2E conserva ambas instantáneas y rechaza reemplazar la primera; registro concurrente conserva ambos resultados. | Cubierto local. |
| 13. Cadena | Motor exporta Dos mayores; registro captura chain y hashes canónicos de recetas, no sus nombres/pasos vivos posteriores. | Cubierto local. |
| 14. Cobertura compartida | E2E compara como texto Probar, título de fila y aviso del archivo abierto; es/en/en-XA. | Cubierto por las 16 E2E de exportación en la integral. |
| 15. Fuente sobre límite→exportar→alta→análisis | El caso de muestra usa el botón asociado al mensaje, espera un resultado registrado y realiza alta/Información de 10.000 filas; mide ese recorrido por separado. | **Aprobado ARM en `32f531b`**, con huellas y procedencia intactas. |
| 16. Bloqueos y motivos | E2E dirty/futura y C16 changed/missing: archivo alterado/ausente, validación y eventos reales, panel y menú con motivo, manifiesto y fuente conservados. | Casos aprobados enfocados y dentro de las 16 E2E de exportación de la integral fresca. |
| 17. Teclado, anuncios e idiomas | Menús y formularios nativos, paleta, anuncio único comprobado por roles, 16 E2E de exportación con es/en/en-XA y 32 PNG archivadas. | Evidencia automatizada local y cierre C9 por fases; lector de pantalla manual no verificado. |

## Capturas archivadas

[Manifiesto de las 32 PNG](prj03-exportar-conjuntos-2026-11-19/captures.json), copiado con verificación SHA-256 y dimensiones. Son **16 antes + 16 después**: es/en-XA × claro/oscuro × 1440×900/1280×720 × dos vistas. Inglés tiene ejecución E2E, no una tercera serie de capturas. El antes corresponde al bundle `401713dd`; el después documenta el candidato de interfaz archivado, no las operaciones 1 GB ni la ejecución Intel.

- Antes: [árbol](prj03-exportar-conjuntos-2026-11-19/before/before-es-light-1440x900-tree.png) y [fuente](prj03-exportar-conjuntos-2026-11-19/before/before-es-light-1440x900-source.png).
- Después: [resultado en el árbol](prj03-exportar-conjuntos-2026-11-19/after/prj03-es-light-1440x900-tree.png) y [aviso de procedencia](prj03-exportar-conjuntos-2026-11-19/after/prj03-es-light-1440x900-origin.png).

El manifiesto conserva los 32 archivos aunque alguna vista anterior tenga píxeles idénticos a otra; no se presentan como 32 estados distintos.

## Medidas ARM de 1 GB

Equipo: **Apple M2 Max, arm64, 12 CPU lógicas, 32 GiB, Darwin 27.0.0**; Node de pruebas 24.22.1 y Electron 44.9.2. Fuente sintética de **1.000.000.008 bytes**, un millón de registros de mil bytes más encabezado. Huella antes/después: `ad5e0f81fd1c132ed1347c7e717b14286aa7594294a9cd99df5d0bee756b4540`. App fresca por caso; la creación/huella del fixture precalienta caché. La comprobación de integridad posterior queda fuera del tiempo de operación. Memoria: suma de working sets muestreada cada 50 ms; no es RSS exclusiva del motor ni una traza de syscalls.

| Caso en `32f531b`, bundle `62bf3d8` | Tiempo de operación | Tiempo del caso | Máximo app / utilities (KiB) | Resultado |
|---|---:|---:|---:|---|
| Filtro ID > 500000 | 20,347 s | 22,963 s | 852.512 / 326.256 | [Salida](prj03-exportar-conjuntos-2026-11-19/arm-filter-32f.json) de 500.000.008 B, 500.000 registros; SHA real = SHA esperado; fuente intacta. |
| Muestra 10.000, semilla 7 | 18,546 s | 32,687 s, incluye comprobaciones y C15 | 1.349.600 / 812.416 | [Muestra](prj03-exportar-conjuntos-2026-11-19/arm-random-32f.json) de 10.000.008 B: 10.000 IDs únicos en orden, datos exactos, cobertura y huellas preservadas. |
| Cancelar a mitad | 9,493 s | 11,249 s | 1.185.904 / 685.712 | [Cancelación](prj03-exportar-conjuntos-2026-11-19/arm-cancel-32f.json) solicitada a 503.316.480 B; sin salida, temporal ni cambio del manifiesto. |

El [recorrido C15](prj03-exportar-conjuntos-2026-11-19/arm-c15-32f.json) se mide **después de detener la medición y el muestreo de memoria de exportación**: menú Añadir como fuente→diálogo de registro con huella→fuente de 10.000.008 B→menú Analizar→Información completa de 10.000 filas, **0,698 s**. Es un tiempo E2E separado, no un benchmark adicional del motor. La fuente original, la salida y la procedencia permanecen intactas.

El intento anterior 2/3 sobre `62bf3d8` y sus dos medidas parciales se conservan como historia; el verde corresponde a la nueva tanda completa, no a una unión entre ejecuciones. La coincidencia de progreso bytesRead con el tamaño apoya una pasada pública de lectura; no demuestra el número exacto de syscalls de todo Electron. Una sola escala de fixture tampoco demuestra por sí misma una cota asintótica de memoria. No hay todavía medidas Intel.

## Borrador completo y pendientes de calificación

El worktree reúne ya implementación, pruebas, correcciones de consumidores, 32 capturas y evidencia para **un borrador completo de continuación**, no otra entrega solo documental. Este corte documental reúne los artefactos que acompañan al borrador de continuación. El cuerpo del borrador debe conservar los resultados por fase, incluida la integral fallida y la unión 25+1; no llamarlos una integral verde.

- **CI de tres plataformas:** pendiente sobre el head final que se publique; sin transferir verdes de main, otras ramas o SHA.
- **Intel:** pendientes la corrida completa sin retry #1 y las medidas de 1 GB. El propietario **ya autorizó** añadir temporalmente una única línea `workflow_dispatch:` y retirarla después, sin otros cambios de CI, retries o plazos. Elegibilidad y ejecución aún no probadas. Raíz prevé una rama sonda independiente con producto y pruebas idénticos para conservar congelado el head de P3 mientras califica su CI; deberá registrar ambos commits y la equivalencia de entradas. Si la API rechaza la elegibilidad, se detiene y consulta: no hay autorización para modificar main/candidate ni adoptar otro fallback.
- **Comprobaciones manuales:** lector de pantalla e instalación/instalador no verificados. Build y E2E locales no equivalen a esos resultados ni a la prueba de paquete de CI.
- **Límites conservados:** ventana residual TOCTOU, eficacia HTTP no comprobada con este Pandoc y fallo esperado SEG-S2e. No se relajan sus oráculos ni se ocultan resultados fallidos.

La redacción de este corte documental no ejecutó pruebas, build ni GUI adicionales. Las ejecuciones anteriores se identifican por fase; fusión y cambios de estado quedan a cargo del propietario.
