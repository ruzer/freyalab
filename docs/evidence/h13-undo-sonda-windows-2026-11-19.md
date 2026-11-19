# H13 · Sonda de Undo nativo en Windows

**DIAGNÓSTICO TEMPORAL · NO FUSIONAR.** No corrige producto ni demuestra la causa de un fallo histórico. El [alcance y los siete ADR](../stories/h13-undo-sonda-windows-alcance-adr-0021.md) se conservan como decisión inicial de `3f3bed87204e198eea1890ee3554c3ba82d1e692`, anterior a estas calibraciones.

Base: `origin/main 39c2000936f1b03c00daee45bc0a257132fb26ab`. Producto sin diferencias; solo se instrumenta `tests/e2e/editor-status.spec.ts`. No cambian fuentes, workflows, package/lock, grupos, acciones ni plazos. La sonda se activa en Windows o con `FREYALAB_H13_UNDO_PROBE=1`; la CI existente ya ejecuta Markdown en Windows.

## Qué observa

Retiene únicamente el primer `edit.undo` real enviado por Electron y lo libera con sus argumentos originales. No fabrica una orden ni una segunda pulsación. `nativeOnlyTentative` es una instantánea tentativa y no concluyente; `seen=0` tampoco refuta una duplicación. Los eventos DOM y del envío nativo no observan las llamadas update/save, revisión, dirty ni errores de guardado.

Tras el primer control, raíz añadió únicamente campos pasivos a los snapshots existentes: `BrowserWindow.isFocused()`, `document.hasFocus()` y la etiqueta del elemento activo. No añadió solicitudes, acciones ni más instrumentación de update/save. No hay UI ni capturas nuevas; se conserva `traceElectronFailure` de #187 para el contexto real de Electron si falla.

## Controles macOS

Ejecutados por raíz con Node 24 y el flag de calibración activo. Estos controles **no reproducen el mecanismo** y no describen el comportamiento de Windows.

Antes de los campos de foco: tipos 0/0 (8.60 s), unitarias 2972 aprobadas y una omitida (16.30 s Vitest / 16.65 s de proceso), build correcto (1.74 s) y spec 3/3 (3.8 s de reporte / 4.38 s de proceso), sin reintentos. Con los campos pasivos: tipos 0/0 y caso original de cuatro editores 1/1 en 2.0 s de reporte. Son controles previos al commit congelado, no pruebas nuevas.

La validación final se repitió sobre `41d222add5a3e39bafa65c7ea5d5d9c80c9727af`, con `FREYALAB_H13_UNDO_PROBE=1`:

| Comprobación final | Resultado | Duración |
| --- | --- | --- |
| `npm run check` | Exit 0; 0 errores y advertencias | 8.31 s de proceso |
| `npm test`, Pandoc real 3.12.1 | Exit 0; 167 archivos, 2972 aprobadas y 1 omitida exclusiva de Windows | 15.79 s Vitest / 16.08 s de proceso |
| `npm run build` | Exit 0 | 1.76 s de proceso |
| Spec completo, un worker y `--retries=0` | 3/3; 0 reintentos | 3.9 s de reporte / 4.42 s de proceso |

Ninguna corrida macOS capturó un comando nativo: `seen=0`, `released=0`. En los snapshots finales, `windowFocused=false`, `document.hasFocus()=true` y elemento activo `DIV`; después de la tecla el texto conservó finales mixtos y antes de guardar era LF. La aserción original confirmó LF en disco. Estas observaciones no establecen una relación causal entre foco y entrega nativa, ni exclusividad de una ruta de Undo.

Un intento con filtro CLI mal seleccionado produjo `No tests found`; el archivo de salida se conserva. **No es un rojo del comportamiento** y no se cuenta como prueba ejecutada.

## Identidad y preservación

SHA-256 del spec antes de los campos de foco: `23587e541ea4521b23647a2dfd329ae1f2ec9fa11c9f202a0b92cadd4dd8ece4`. La sonda con esos campos quedó congelada en `41d222add5a3e39bafa65c7ea5d5d9c80c9727af`, con spec SHA-256 `bac159d49f3db3b55bf6f48f71862a7646526085f9111d6daf1bc8aa5b490e6a`.

La comparación estática conserva las 21 llamadas de aserción originales, las 11 acciones UI en idéntica secuencia, los datos, las tres identidades y los plazos del baseline. Mantiene el cierre de la traza antes de cerrar Electron. La comparación Git contra main39c da diferencias vacías en `src`, `.github`, `package.json`, `package-lock.json`, `playwright.config.ts` y `tests/e2e/groups.ts`. No se borraron pruebas. Esta preservación no convierte las observaciones tentativas de la sonda en conclusiones.

Los archivos brutos siguientes permanecen privados; estos SHA-256 permiten identificarlos sin publicar rutas locales:

| Archivo | SHA-256 |
| --- | --- |
| `final-qualification.json` | `2658d2227f512db1d94bd9c466f93245c42e9757e09a9e3ec0e1163fae1863cf` |
| `final-check.log` | `876f44af39b867fb2f03e3dcd9689cbc87ff13cfaf9d7c35a9e4661314ab8ad4` |
| `final-unit.log` | `47b118c94412248b5728f618f0b0e713442a6b30c310645bb67e817208744ebf` |
| `final-build.log` | `2dc9630130f00fc6470218249d8969799601c02541967caa1614e38d3a88966f` |
| `final-local-control.log` | `283499a0413dde19c1c7a6d0d6758020d5689e827bc183cc31a04172f5d16ee9` |

## Pendiente

SHA de publicación y CI sobre ese head, en particular Windows. La validación macOS de `41d222a` no es evidencia de Windows. La eventual entrega será un borrador diagnóstico temporal que deberá cerrarse sin fusionar, no una corrección de producto.

El selector existente da `checks=true`, `unit=true`, `e2e=[shell,md]`, `full=false`, `package=false`, `specs=[editor-status.spec.ts]`, `docsOnly=false`. No se cambia la CI para ejecutar la sonda ni se obtiene evidencia del paquete o Intel en este PR.
