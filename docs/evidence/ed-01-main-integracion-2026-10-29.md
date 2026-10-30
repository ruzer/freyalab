# ED-01 · Integración local del main actualizado

El propietario fusionó en GitHub AC-00/01/02, D1 y B1. Main real avanzó a `a44eb895c7f6518106898af256dd7cff8ae88275`; el `base_sha` anterior mostrado por el PR conservaba `33a5dfd`. El refresco único autorizado cerró/reabrió el mismo PR #91 en borrador, sin cambiar head ni rama base. Tanto el merge-tree contra 33 como el nuevo contra a44 terminaron sin conflictos; no se inventó una resolución de código para el estado `dirty` remoto.

Por instrucción del coordinador se integra main mediante **merge local**, commit `f05d76cddff09a6d773a4acdd2f0879792851418`, sin fusionar el PR. Conserva los commits ED-01 `8572f29`/`c8b08c4`, B2/TXT `7488ef8`, B1 `46ae1da` y D1 `ec533024`. El checkout del propietario y los otros worktrees no se modifican.

Inventario heredado: **35 archivos**, seis fuentes de producto:

- `src/main/pandoc.ts`: módulo AC-00.
- `src/renderer/components/Preview.svelte`: numeración/portada/índices de AC-01/02.
- `src/renderer/lib/remark-numbering.ts`.
- `src/renderer/lib/render.ts`.
- `src/renderer/lib/report-metadata.ts`.
- `src/shared/front-matter.ts`.

Se incorporan también pruebas académicas/Pandoc, documentación/fixtures de esas entregas y el workflow P4 aislado ya aprobado y fusionado por el propietario. No son cambios nuevos de dependencias o CI propios de ED-01. El auto-merge del registro E2E conserva los dos archivos ED-01 y añade `academic-report.spec.ts`.

Al hacer el merge, Editor, extensiones/sesión Markdown, motor CSV y package/lock conservaban sus bytes de `c8b08c4`. Después se corrigió únicamente el adaptador de formato, descrito más abajo. Patch e inventario completos: `recovery/ed01/main-a44-integration.patch` y `main-a44-integration.json`.

## Cierre actual del producto combinado

Fuente congelada: **`6babfd8d80439ef3faccb0b1c9f2a4f0ddd151f3`**. Incluye el merge `f05d76c`, el ajuste de prueba C3 `4c58853` y el arreglo MC `6babfd8`. El full anterior de 435 y el build de `8902c99` son históricos; no se reutilizan para calificar este producto combinado.

C3 se incorporó por cherry-pick del único commit de prueba del coordinador (`c642771`): espera desplazamiento real antes de comprobar la sección, conservando el assert final. No cambia producto ni declara probada la causa exacta del fallo temporal original. El [arreglo MC](ed-01-selecciones-2026-10-29.md) corrige posiciones secundarias dentro del texto retenido al quitar formato, con rojo previo, guardia de ambigüedad y flujo reversible real. No se incorporó el WIP académico AC-03/04 de la otra sesión ni se declara resuelto su hallazgo de autoridad bibliográfica.

| Comando ejecutado, Node 24.22.1, macOS Apple silicon | Resultado real actual |
|---|---|
| `npm run check` | Código **0**, Svelte **0 errores / 0 avisos** y tsc correcto. |
| `npm test` completo | Código **0**, **1491/1491**, 76 archivos, **13,06 s**; incluye CSV. |
| `npm run test:e2e -- --reporter=line --output=<evidencia durable>/main-a44-secondary-full-output` | Código **0**, **439/439**, 12,2 min; reloj **731,04 s**, incluyendo el build del script. Sin fallos, skips ni reintentos. |
| `npm run build` final | Código **0**, reloj **1,64 s**. |

Los casos reales de Pandoc usaron 3.12.1 y avisaron que ese binario no soporta HTTP; **la eficacia del sandbox HTTP no se acredita aquí**. No se añadió una omisión ni se cambió la prueba heredada para ocultarlo.

Listado: **439 identidades únicas = 404 fast + 35 perf**, sin duplicados/solapamientos/pérdidas; conserva las 435 previas y añade únicamente cuatro casos de `academic-report.spec.ts` (41 shell/219 Markdown/179 CSV). El flujo MC amplía una identidad existente. Las **505 huellas de fuente, pruebas, configuración y out permanecen idénticas** desde antes del full hasta después del build final. Fuente y fixtures no se ajustaron durante la serie. Logs y snapshots previos/posteriores se conservan en `recovery/ed01/main-a44-secondary-*`.

## Medición actual, incluida en el full

Equipo: Apple M2 Max, 12 CPU lógicas, 32 GiB; macOS kernel 27.0.0, Node 24.22.1, Electron 44.9.2 / Chromium 152.0.7977.167. Reserva coordinada de CPU/Electron sin otros builds, suites, Pandoc/LibreOffice o rasterización en paralelo. Es latencia observable desde clic real hasta dos frames, con AST completo preparado mediante la navegación real al encabezado final y el índice cerrado antes de medir.

| Tamaño | Preparación AST/vista, excluida del plegado | Mediana plegar, 5 muestras | Mediana desplegar, 5 muestras |
|---|---|---|---|
| 6.396 bytes | 328,97 ms | **40,2 ms** | **40,1 ms** |
| 10.485.760 bytes, editable completo | **4456,01 ms** | **57,4 ms** | **48,6 ms** |

Relación grande/pequeño: 1,428× al plegar y 1,212× al desplegar. Se verificó el rango completo hasta el siguiente título y que el cuerpo reaparece al desplegar; no se mide un no-op ni un árbol parcial. Texto, `dirty=false`, bytes/SHA/mtime/inodo del archivo original permanecen intactos. **Main: plegado N/D**, aprobado por el propietario; no se inventa 0 ms ni una aceleración contra una operación ausente. Datos completos y cinco muestras originales en [ed-01-tiempos.json](ed-01-tiempos.json). La serie anterior permanece en su [JSON histórico](ed-01-tiempos-8902-historico.json).

Capturas actuales **1440×900** [claro](ed-01-light-1440x900.png) y [oscuro](ed-01-dark-1440x900.png), generadas en el full y revisadas con `view_image`: flecha/widget plegado y foco azul visibles, disposición conservada. Esta inspección no sustituye una auditoría automática de contraste. La prueba de sólo lectura pasó en el full, preservando permisos y fuente.

## Límites y entrega

- CI de **las cuatro plataformas y ejecución del paquete sobre el head final** pendientes. Los verdes de 8902/c8 o de las dependencias no se transfieren a este producto nuevo.
- Las intermitencias documentadas de P7/D1 permanecen abiertas; un pase local correcto no prueba su desaparición.
- Lector de pantalla físico, IME del sistema y caché fría no verificados; IME sintético está etiquetado en la prueba. Sin instalación, Word manual, release o fusión del PR.
- Los tiempos describen este corpus/equipo. Preparación del parser se informa aparte del plegado; no se garantiza el rendimiento en cualquier máquina.
- No se incorpora la fuente académica AC-03/04; su integración/autocompletado se validan en su carril. No hay dependencias nuevas, cambios propios de CI ni cambios a CSV/guardado/IPC.

Checkpoint durable completo con fuentes/pruebas/docs y manifiesto SHA en `recovery/ed01/checkpoint-20261029T070522Z`; excluye node_modules/out. Los snapshots de 505 archivos acreditan por separado que out no cambió durante este cierre.
