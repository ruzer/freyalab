# FL-MD-002 · Corrección del contexto de referencias y revisión de seguridad

Tarea 0 del lote. Base actual: `7955b68a82e53949466f39e61439e72b693372f1` (PR #67 ya fusionado antes de empezar). Rama: `codex/md-002-correcciones-render`, worktree independiente `/private/tmp/freyalab-md-002`. No se toca el checkout del usuario. Se leyó la historia en `origin/claude/historias-markdown-mermaid` sin editarla ni fusionarla.

## Decisiones

- Un PR fusionado no puede volver a borrador: la corrección se entrega en un PR correctivo nuevo contra main, conservando la rama solicitada; el #67 y sus cuatro commits históricos no se alteran. Esta adaptación administrativa permite corregir el defecto y mantener las bases de las tareas 6–8 del lote.
- Cada fragmento consulta un índice de definiciones por identificador CommonMark. Sin `[` no recibe contexto; si hay corchetes solo se añaden las definiciones cuyos rótulos aparecen en el fragmento. Se conserva la primera definición y se limpia el índice entre documentos. No se reescribe la fuente.
- Se incluye la recomendación de seguridad: `mailto:` fue añadido en el #67 por B5; ahora se rechazan parámetros `attach` y `attachment`, sin distinguir mayúsculas y usando la decodificación estándar de URLSearchParams, incluso vacíos. HTTP/HTTPS y mailto con subject/body conservan su comportamiento. No se cambian otros protocolos, IPC, guardado, CSV, render de Mermaid ni dependencias.
- El caso del cierre details huérfano seguido de `~~~` queda como observación de la revisión, sin cambios de alcance.

## Rojo → verde

| Cambio | Rojo real antes de modificar | Verde |
| --- | --- | --- |
| Contexto proporcional al fragmento | `npx vitest run tests/remark-details-context.test.ts`: 6 fallos y 4 guardas aprobadas (`/private/tmp/freyalab-lote/0-context-red.log`). Con 400 definiciones: resumen sin corchetes 17.387 caracteres frente a 7; rótulo 17.427 frente a 47; nota 17.416 frente a 36. | 98/98 en contexto, helper, render y export (`0-context-green-final.log`), incluyendo referencias reales, Unicode ß/SS, escapes, espacios y referencias anidadas/colapsadas. |
| Mailto sin adjuntos | B E2E falla porque `attach=archivo.txt` es aceptado (`0-mailto-red.log`, 1 fallo/5,1 s). La primera selección de filtro que no encontró pruebas se guardó aparte y no cuenta como rojo. | B E2E 1/1, 5,4 s (`0-mailto-green.log`): ocho variantes peligrosas rechazadas y enlaces permitidos conservados. Build correcto. |

Las pruebas nuevas de complejidad cuentan caracteres recibidos por un `this.parse` falso sobre un AST real de remark; no usan umbrales de tiempo ni imitan el algoritmo de selección. Las guardas semánticas reutilizan el canal real. Los tres casos originales de render permanecen intactos.

## Medición real del render con plegables y definiciones

Medición vigente ejecutada el 27 de octubre de 2026, 07:42:41–07:42:44 UTC, en Apple M2 Max, 12 CPU lógicas, 32 GiB de RAM, Darwin 27.0.0 arm64, Node v24.22.1. Sin otra prueba pesada de esta sesión en paralelo.

## Por qué se repitió y qué se conserva

La primera medición se ejecutó con helper `25500d9fd8d94bd10202eaf27c8ce08a9e13c321090924e50ab6832e617a9969`. Después apareció una prueba roja nueva: `collect` retornaba al indexar una footnoteDefinition y no visitaba una definición de enlace anidada en ella. Se retiró ese retorno para conservar la referencia anidada. La repetición se debe a ese cambio real de código, no a buscar mejores tiempos ni ocultar un fallo de benchmark.

Antes de repetir se preservaron, sin sobrescribir, `/private/tmp/freyalab-lote/0-details-benchmark-initial.json`, `0-details-benchmark-initial.log` y `MD002-BENCHMARK-RESULTS-initial.md`. Las medianas iniciales baseline/corregida fueron 10,78/12,51 ms, 25,51/35,52 ms y 96,47/436,34 ms. Son históricas del hash anterior y no se atribuyen al helper actual. El corpus y su hash no cambiaron entre ambas ejecuciones; se repitió el mismo comando y método completo.

## Comparación y método

Baseline: fuente exacta de `src/renderer/lib/render.ts` en `61d0e05b1d87ba30186a7a8f1908f1c9ed06d73a`, anterior a MD-002. Comparador: árbol de trabajo corregido con HEAD `ab66ec162233a2319e7dac474514d0eafe6df6ca` y cambios pendientes; hash del helper corregido `c1a7865741426a5a59fe026f24d1a82313829ca58e6ef501b78e8a99a665cc34`; hash del render actual `a600da47134b04c72c3ac8e4b051fa9a26f0f3f3a834d1e3e00ce1a30864588b`.

**7955b68 por sí solo contiene el defecto. No se midió ese código defectuoso**, ni se repitió el caso de 208 segundos. El hash del helper identifica el arreglo medido pese a que aún no estaba en un commit.

Mismas dependencias instaladas y mismo proceso para las dos fuentes. Una ejecución de calentamiento por versión y tamaño, seguida de tres muestras por versión. Orden: baseline/corregida en muestra 1, corregida/baseline en muestra 2, baseline/corregida en muestra 3. Tiempo medido: exclusivamente `await markdownHTML(source)`, sin IO ni comprobaciones del resultado dentro del intervalo. `performance.now()`, sin forzar GC.

El comentario de Claude especifica tamaños y formas, pero no publica su generador. Este corpus es reproducible y conserva esas dimensiones, sin atribuirle identidad byte a byte con el suyo. Incluye una referencia global usada por plegable; cada resumen no contiene `[`. Los compactos requieren resolver su referencia dentro del fragmento. Las definiciones se ubican al final del documento.

| Caso | Caracteres | Bytes UTF-8 | Muestras baseline (ms) | Mediana baseline | Muestras corregida (ms) | Mediana corregida |
|---|---:|---:|---|---:|---|---:|
| 30 estándar + 120 definiciones | 8.589 | 8.649 | 20,02; 14,40; 9,76 | 14,40 ms | 14,74; 18,67; 14,66 | 14,74 ms |
| 100 estándar + 400 definiciones | 28.539 | 28.739 | 28,63; 28,31; 29,90 | 28,63 ms | 47,85; 48,76; 35,13 | 47,85 ms |
| 1.600 compactos + 1.600 definiciones | 232.039 | 235.239 | 112,38; 108,38; 116,58 | 112,38 ms | 496,06; 456,66; 443,24 | 456,66 ms |

La muestra máxima corregida del caso 1.600 fue 496,06 ms, por debajo del criterio de 5 s de la revisión. Esta medición por sí sola no demuestra complejidad asintótica; la prueba de caracteres procesados del helper aporta la comprobación determinista contra el crecimiento plegables × definiciones.

## Invariantes comprobadas en la versión corregida

| Caso | Details / summary / enlaces de referencia | href locales / destinos ausentes | Ids duplicados | Referencias sin resolver | Fuente intacta |
|---|---|---|---:|---:|---|
| 30 + 120 | 30 / 30 / 30 | 1 / 0 | 0 | 0 | Sí, SHA-256 idéntico |
| 100 + 400 | 100 / 100 / 100 | 1 / 0 | 0 | 0 | Sí, SHA-256 idéntico |
| 1.600 + 1.600 | 1.600 / 1.600 / 1.600 | 1 / 0 | 0 | 0 | Sí, SHA-256 idéntico |

Los baseline se registran también en JSON: no conservan plegables (función ausente antes de MD-002), y su enlace `#Inicio` no coincide con `heading-inicio`. No se afirma equivalencia funcional con la versión actual. En la forma compacta, baseline descarta el contenido HTML crudo; la versión corregida realiza más trabajo útil al conservar y renderizar los 1.600 plegables y sus 1.600 referencias.

## Comando y archivos

```sh
env PATH=/Users/ruzer/.npm/_npx/387698761821791d/node_modules/node/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin node /private/tmp/freyalab-lote/run-md002-benchmark.mjs --run
```

Resultado real de Vitest: **1 archivo, 1 prueba aprobada; duración total 3,10 s**. Log: `/private/tmp/freyalab-lote/0-details-benchmark.log`. Muestras sin redondear, calentamientos, hashes de corpus, versiones e invariantes: `/private/tmp/freyalab-lote/0-details-benchmark.json`. Generador: `/private/tmp/freyalab-lote/md002-benchmark.test.template.txt`.

Los archivos temporales `tests/md002-bench.tmp.test.ts` y `src/renderer/lib/renderbaseline.tmp.ts` fueron retirados por el ejecutor. No se modificó código de producto para medir.

## No verificado aquí

Sin comparación de memoria aislada, interfaz Electron, imágenes, Mermaid, exportaciones, empaquetado, instaladores ni otros sistemas operativos. No se ejecutó el helper defectuoso de 7955b68. Los tamaños del corpus y equipo difieren de los de Claude, por lo que sus cifras de revisión son contexto histórico y no muestras propias. La comparación conserva las dependencias instaladas actuales para ambos fuentes y no reconstruye el lockfile histórico del baseline.

## Validación global de la tarea

| Comando | Resultado real |
| --- | --- |
| `npm run check` | 0 errores, 0 advertencias; `0-check-final.log`. |
| `npm test` | 541/541, 32 archivos, 5,48 s; `0-unit-final.log`. |
| `FREYALAB_MD_EVIDENCE=1 npm run test:e2e` | **234/234**, 9,6 min, salida 0; `0-e2e-final.log`. A–D, 17 Mermaid, render progresivo y documento de 10 MiB pasan, sin reintentos. |
| `npm run build` | Correcto, salida 0, ejecutado después de E2E; `0-build-final.log`. |

Capturas nuevas del mismo render sin cambios visuales: [claro](md-002-contexto-light-1440x900.png), [oscuro](md-002-contexto-dark-1440x900.png); capturadas en la ejecución real del runner a 1440×900, inspeccionadas en ambos temas. Se restauraron los PNG históricos que el flag de pruebas había regenerado.

La CI del head correctivo se informará en el PR con enlaces y conteos reales. La CI histórica del #67 no prueba este cambio. No se ejecutan instaladores ni lectores de pantalla manuales, ni se publica una versión o se actualiza la app instalada.

## Generador del corpus reproducible

Este es el generador ejecutado, sin datos privados ni valores aleatorios. Los tamaños, hashes y todas las muestras sin redondear se conservan en el JSON indicado.

```ts
const id=(value:number)=>String(value).padStart(4,'0')
function corpus(blocks:number,definitions:number,compact:boolean){
 const start='# Inicio\n\n[Volver al inicio](#Inicio)\n\n'
 const content=Array.from({length:blocks},(_,index)=>{
  const n=id(index+1),summary=`Versión ${n}`,body=`Cambio ${n}: consulta [documentación][ref-${n}].`
  return compact?`<details><summary>${summary}</summary>${body}</details>`:`<details>\n<summary>${summary}</summary>\n\n${body}\n\n</details>`
 }).join('\n\n')
 const refs=Array.from({length:definitions},(_,index)=>`[ref-${id(index+1)}]: https://example.org/cambios/${id(index+1)}`).join('\n')
 return `${start}${content}\n\n${refs}\n`
}
```

## Conteo determinista de la versión corregida

Registro real `0-context-counts.json`, ejecutado con Node24 y el mismo AST de remark:

| Fragmento | Con 0 definiciones ajenas | Con 400 ajenas |
| --- | ---: | ---: |
| `Resumen` | 7 caracteres | 7 caracteres |
| `[rótulo]` (una definición usada) | 47 | 47 |
| `Texto[^nota]` (una nota usada) | 36 | 36 |

El caso de SQL que falló en la ejecución histórica del #67 pasó esta vez dentro de la suite completa, sin reintentos y sin modificar código de CSV/SQL. No se atribuye una causa al fallo histórico.

## Regresión anidada detectada antes del cierre

La comparación del helper anterior de `7955b68` con la selección indexada encontró una definición de enlace dentro de una nota al pie que quedaba sin resolver en un plegable compacto. El recorrido retornaba al indexar la nota y no visitaba sus definiciones hijas. La prueba nueva falló realmente (`0-nested-definition-red.log`); se retiró solo ese retorno y el grupo pasó **98/98** (`0-context-green-final.log`). Se comprobaron además títulos en definiciones anidadas, citas e inicio de nota: salida idéntica al helper previo.

Por ese cambio real se repiten los cuatro comandos y la CI sobre un nuevo head; no se reutiliza la CI del primer commit `ab66ec1`. La primera medición permanece como histórica en `*-initial.*`; la tabla anterior identifica el hash nuevo.
