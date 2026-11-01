# P5 Windows tras relanzar · 2026-11-01

## Baseline y alcance

Mismo PR #102 y rama `codex/seg-s2`, partiendo de `7bdcd8946aa65377494866b6a8b61b378827d187`. Producto `src=81a03abb9bfe2c8ee027108297f727b0c3df4e9a`, idéntico a e7e7b4a. Sin cambios de dependencias, plazos, reintentos, workflows ni aserciones existentes; no fusionar ni salir de borrador.

Rojo real preservado: [CI279 Windows](https://github.com/ruzer/freyalab/actions/runs/41263604011), job124721680733. P5 recibió `documents()=[]` durante15000ms, tanto inicialmente como en retry1, al relanzar desde `preferences`. macOS y Linux pasaron. El artefacto original `evidence-windows-2025-1` tiene16472986bytes y SHA256 `5624d0a373467e578afe200733083716e83faa2a8178bd4f0a2785f54564af43`, comprobado al descargar. Conserva ambos `error-context.md` y `trace.zip`. No contenían la salida del proceso principal ni su evento de error de apertura.

## Primera etapa: diagnóstico, todavía sin atribuir causa

El ayudante de sidebar precarga un observador CJS mediante `-r`, conservando el entry real y sin tocar `src`:

- `p5-main-N.jsonl`: PID real, valor de `FREYALAB_TEST_OPEN`, stdout/stderr de Node y cada evento `freya:event/error` antes de reenviarlo, con stack del emisor. Permite distinguir el catch del bucle `initial` de otros errores.
- `p5-stdio-N.log`: salida de las tuberías del proceso lanzado tras obtener el handle de Playwright, incluidas advertencias nativas.
- `p5-lifecycle.jsonl`: solicitudes de arranque/cierre, PID principal y del proceso lanzador, eventos exit/close, estado de vida al volver de `quit()` y antes de arrancar la instancia siguiente. Windows usa `cmd.exe` en Playwright1.64.1; se registra también el PID principal, no sólo el shell.

La instrumentación no espera más tiempo, no reabre por IPC ni vuelve a intentar `openPaths`. El cierre original `app.exit` seguido de `app.close` permanece intacto en esta etapa. La hipótesis de instancia previa aún viva se medirá con estos eventos; no se presume cierta.

Cinco definiciones independientes del P5 de preferencias en Windows, cada una con su `beforeEach`, directorio/perfil nuevo y callback/aserciones originales íntegros. Primera definición conserva su nombre; las otras se nombran Windows2/5…5/5. macOS/Linux conservan una ejecución. Son cinco casos que deben aprobar todos, no cinco reintentos para conseguir uno verde. La configuración existente de retries no cambia y se informará cualquier retry real.

## Comprobaciones locales de la instrumentación

MacBook Pro M2 Max,32GB, Node24.22.1, Playwright1.64.1:

- `npm run build`: salida0, mismo producto base7bdcd89.
- P5 enfocado, `--workers=1 --retries=0`: 1/1,6.1s.
- Sidebar completo, `--workers=1 --retries=0`: 9/9,18.0s.
- Siete cierres/relanzamientos del P5 enfocado: PID principal ya muerto al volver de `quit()`, exitCode0; ninguna instancia previa viva al pedir el siguiente arranque. Sólo descarta el solapamiento observado en esa ejecución de Mac; no acredita Windows.

Salida y JSONL locales preservados en el archivo de recuperación de esta tarea. La causa y la corrección quedan pendientes del diagnóstico nativo Windows. El verde local no se atribuye al futuro SHA final ni se presenta como solución.

## Diagnóstico nativo y causa confirmada

[CI289 Windows](https://github.com/ruzer/freyalab/actions/runs/41327218664/job/124909577446), head `06f44bc5a3c0a14c7f7c93ac2ac4ce877c833671`: **FAILURE**. Fast457 aprobadas +1fallida +7Word omitidas; serial55/55. P5 original falla inicialmente22.6s y retry1 21.4s; los otros cuatro casos independientes pasan10.1/9.1/8.9/9.2s sin retry. Estos cuatro verdes no se presentan como cinco ejecuciones satisfactorias.

Artefacto `13092678192`, `evidence-windows-2025-1`:16696219bytes, SHA256 `0dd13ddb650db32c6061b40d3902d8ea2d718ac46a672a90b0978e20b0274a8d`, comprobado al descargar. Conservado junto con el log completo del job. Ambas capturas de `freya-error` dicen `EPERM: operation not permitted, rename …profile/.recents.json.<uuid>.tmp -> …profile/recents.json`; sus stacks apuntan al catch del bucle `initial` en `out/main/index.js:7591`. `FREYALAB_TEST_OPEN` contiene la ruta correcta. No se atribuye al valor de `freya-sidebar-tab`.

Hipótesis de instancia anterior: **descartada en los dos fallos reproducidos**. En el intento inicial el PID4484 y su shell2032 terminan antes del siguiente `launch-request` (1793551594673); se registra `mainAlive:false`, `previousAlive:false`, `childExit:0` y `child-close` previo. El nuevo PID9104 envía el EPERM a1793551595764. En retry1 el PID9064/shell8236 ya terminó a1793551616822; el nuevo PID2724 falla a1793551617714. No se añade una espera redundante al ayudante de cierre.

La causa que deja el inventario vacío está en `Documents.openNew`: la lectura correcta del documento se aborta si falla guardar una lista auxiliar de recientes, antes de `records.set`. **No se determinó qué agente de Windows produjo el EPERM**; no se afirma que sea antivirus, un proceso residual ni un defecto de localStorage. La corrección debe tolerar ese fallo auxiliar sin desactivar los errores al leer/guardar el documento.

## Corrección mínima y rojo→verde

Se conserva el guardado atómico de recientes, sus bytes anteriores si falla y el guardado de documentos sin cambios. Sólo `openNew` comunica un aviso es/en si falla actualizar recientes y permite que termine la apertura ya leída. No reintenta, no añade sleeps/plazos y no silencia el aviso. Los fallos de lectura del documento siguen rechazándose.

| Comprobación | Rojo antes | Después |
| --- | --- | --- |
| EPERM de recientes, Markdown real | Rechazo EPERM, documento no abierto | Abre, texto y disco intactos, aviso genérico sin rutas |
| EPERM de recientes, CSV real | Rechazo EPERM, documento no abierto | Abre, `00123` y campo multilínea intactos, recientes anteriores intactos |
| Error de lectura del documento | Control | Sigue rechazándose, inventario vacío |

`npx vitest run tests/document-opening.test.ts`: primero2fallos+4aprobadas, luego6/6. Una ejecución intermedia detectó un error del oráculo nuevo (`values` en vez de `cells`); se conservó su salida, se corrigió el acceso conforme a `TableRow`, sin cambiar el producto ni las expectativas de datos.

Sincronización mecánica por merge con main `720ec482505ade5dc56b31162674a8afba794362`, commit `0c77a92f622671a6b5f05adda4221e10a479b1f3`: sin conflictos ni resoluciones manuales. Incorpora #98–#101 ya fusionados por el propietario y alinea los9 casos Pandoc con el workflow de main. Ningún workflow se edita como parte de P5. La CI diagnóstica usó el merge sintético del PR; su producto ya incluía esas integraciones. No se atribuye su resultado sólo al árbol `src` del head06.

Validación local del cambio (M2 Max,32GB; Node24.22.1, Pandoc3.12.1 externo): `npm run check`0, cero errores/advertencias; `FREYALAB_PANDOC_TEST_PATH=/opt/homebrew/bin/pandoc npm test` **2105/2105**,113archivos,16.85s, cero omisiones; `npm run build`0. Se ejecutará una sola suite E2E completa local sobre esta fuente, sin retry, y la CI completa del nuevo SHA. Sus resultados se añadirán al PR sin un commit cosmético que invalide la calificación.

## Calificación final pendiente

No se presenta todavía un SHA final como verde: faltan la suite E2E completa local, las cinco ejecuciones Windows del nuevo SHA sin retry y la primera ejecución de macOS/Linux de ese mismo SHA, además de los checks completos y del paquete. El Mac local no sustituye Windows. No se comprobó el propietario del bloqueo de Windows, la instalación manual ni Intel (fuera de los PR por #103). No se fusiona el PR, no se marca listo, no se publica ni se actualiza la app instalada.
