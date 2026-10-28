# Render Markdown bajo demanda en Editar · evidencia local

**Fecha local: 2026-10-27.** Implementación comprobada en `8302e1dc3256acd297215deb9b2291d8b71b6844`, hijo del commit documental original `27671454300aeb89043823c295c51feb077f866e`. El archivo académico original permanece intacto. Esta evidencia acompaña la corrección del PR77; el [JSON curado](ci-preview-edit-2026-10-27.json) conserva métricas y hashes.

**CI pendiente al generar esta evidencia.** El cierre corresponde a los checks de las cuatro plataformas sobre el head final del PR. No se convierte este estado a verde con una edición circular de solo documentación ni se heredan checks de otros heads.

## Cambio y decisiones

Preview permanecía montado y preparaba Markdown mientras estaba oculto en Editar. App ahora pasa `renderEnabled={mode!=='edit'}`. Preview omite ese trabajo, conservando la invalidación por generación; al exportar habilita temporalmente el render con try/finally y espera el resultado vigente. Se conservan article, diagramBlocks y el recuento de imágenes ausentes: App consulta ese recuento después de retornar exportHTML.

Solo cambian App, Preview y el nuevo spec de tres casos. Sin dependencias, IPC, CSV, guardado, parser nuevo ni cambios del fixture readonly, timeouts o retries. No se reescribe el commit original de Claude. El parseo visible o solicitado para exportar sigue en el renderer; no se promete cancelación de trabajo síncrono ya iniciado.

## Rojo → verde y regresión

| Comprobación | Rojo o estado anterior | Resultado posterior real |
|---|---|---|
| Abrir un segundo archivo con Editar activo | Article oculto no vacío | Pasa; full2: 1.050 ms |
| Escribir con Preview oculto | Article actualizado sin mostrarse | Pasa; full2: 1.034 ms |
| Exportar desde Editar y volver a escribir | La edición posterior renueva el article oculto | Pasa; full2: 2.147 ms |
| Caso readonly original, intacto | Intel agotó click Editar en dos intentos | Focal: 1,3 s; full2: 993 ms; recuperación remota aún pendiente |
| Focal combinado | 3 nuevos casos fallan sobre original | 4/4 pasan, 5,8 s |
| `npm run check` | — | Exit 0; 0 errores y 0 avisos |
| `npm test` completo | — | 763/763, 36 archivos, 5,57 s |
| `npm run build` final separado | — | Exit 0 |
| Doce controles originales sobre base 276 | — | 12/12, 53,6 s, exit 0 |
| Mismos doce sobre candidato 8302 | — | 12/12, 50,5 s, exit 0 |
| Suite global, intento2 despierto | Se conserva intento1 fallido abajo | **307/307, 517,619821 s; 0 fallos, flakes, skips o retries; exit 0** |

Los nuevos casos no afirman una latencia absoluta: comprueban el estado del article y sus recursos. Cubren Dividido/Vista previa, exportación HTML sin cambiar de modo, PNG válido, imagen ausente y Mermaid; verifican el aviso «1 imagen no se encontró», fuente, dirty y disco. El full2 empieza a 2026-10-28T02:15:52.792Z; el fin calculado por inicio+duración es 02:24:30.411Z, no un timestamp final independiente.

La fuente funcional de 171 archivos conserva el hash `bb6dc8baece78bd87459c4c1c826d52cc995e28d6c083bdc4ab0a84b036552fb` antes/después del full2; también permanece intacta durante las sondas y capturas. Los documentos de evidencia se añaden después de verificar esa instantánea.

## Incidencias preservadas: no todos los fallos tienen causa conocida

- **PR77 original:** run40583966581, 3/4 plataformas; Intel303 pases +1 fallo. **PR78 observado:** run40592392260, 3/4; Intel301 pases +2 flakes recuperados +1 fallo. Ambos agotan el click de `markdown-toolbar.spec.ts:110`, helper open:21, en el intento inicial y retry automático. No se atribuyen los flakes a esta corrección.
- El test original pasó una vez localmente sin cambios (4,6 s total). Eso no reproduce Intel. Las sondas originales CPU1/4/8/16 también pasan: sí demuestran trabajo oculto y bloqueo local, **no** el timeout remoto exacto.
- **Primer full local posterior:** exit 1, **295 pases /12 fallos /307, 0 retries**. Duración del reporte 7.904.728,705 ms; inicio23:10:26.511Z y fin aritmético≈01:22:11.240Z. Reportes y trazas full1 se conservan separados, sin reemplazarlos por el full2.
- La primera caída (caso 211, progresivo) dura 2,802 s y termina con **TargetClosed** en la primera espera de imágenes, antes de editar el párrafo. La acción falla a23:15:59.537Z, **5,46 s antes** del ClamshellSleep 23:16:05Z: **causa desconocida**, no demostrada por esa suspensión posterior. El caso ya usa Dividido y no se modificó.
- Después hubo Clamshell/DarkWake hasta Wake por tapa/HID a01:57:53Z (2 h 41 min 48 s). Los otros 11 fallos comienzan en ese intervalo; el alineamiento no prueba una causa única. El guard 67087 no expiró y Root lo terminó con Ctrl+C; los temporizadores no dieron una garantía durante el reposo. Los siguientes controles usan guardas transitorias ligadas al hijo, sin ajustes persistentes.

Una posterior corrida verde acredita esa corrida; no explica retrospectivamente el TargetClosed ni confirma por sí sola la causa de Intel. No se usó un rerun manual de CI para ocultar los fallos originales.

## Perfiles locales: alcance concreto de la mejora

Mac Apple M2 Max arm64; Node 24.22.1, Electron 44.9.2, Playwright 1.64.1. Fixture original 12.600.019 bytes, muestra de solo lectura de 1.048.576 bytes / 49.933 líneas. Una sonda por fuente/tasa; CPU16 es ralentización CDP sintética del renderer, no hardware Intel.

| Sonda | Driver hasta result-saved (ms) | Mayor gap heartbeat (ms) | Pila markdownHTML observada (ms) |
|---|---:|---:|---:|
| original-cpu1 | 1.654,263 | 263,700 | 9,984 |
| fixed-cpu1 | 1.566,289 | 160,900 | Sin muestras |
| original-cpu16 | 38.820,809 | 30.936,000 | 27.247,870 |
| fixed-cpu16 | 6.919,773 | 2.704,600 | Sin muestras |

Original CPU4/8: markdownHTML 4.405,362/9.158,397 ms frente a ARIA 5,031/9,528 ms; gaps 4.933,5/10.117 ms. En los corregidos no se observan muestras de markdownHTML/resolveAllText: **no equivale a 0 ms garantizados**. CodeMirror sigue presente (CPU16 estado/vista 2.228,772→2.235,777 ms). Las categorías inclusivas se solapan y no se suman.

Las ventanas terminan tras el click y no garantizan igual trabajo diferido finalizado. La copia histórica del harness no registró hash runtime; se conserva su procedencia sin inventarlo. El actualizado sí lo registra; sus 128 bundles JS/CSS permanecen iguales antes/después y entre CPU1/16. Una sonda, ventanas distintas y cachés impiden prometer aceleración universal o cotas de respuesta. Estos perfiles no sustituyen la prueba funcional ni la futura CI de Intel.

## Comandos y procedencia

Node 24 se antepuso con `PATH=/Users/ruzer/.npm/_npx/387698761821791d/node_modules/node/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`. En el WT propio se ejecutaron `npm run check`, `npm test` y `npm run build`. Full1 usó `npm run test:e2e` sin caffeinate externo; Full2 usó **`/usr/bin/caffeinate -i npm run test:e2e`**, ambos con ese PATH. Las salidas originales y sus hashes permanecen externos.

Los controles fueron Playwright directo, no npm, en `baseline-openlid` y `wt`, con el mismo PATH:

```sh
FILTRO12='el párrafo nuevo aparece|buscar muestra CSV|lo interactivo pasa por delante|una exportación en cola no espera|SQL: valores exactos|SQL: mide fuentes completas|informe SQL rotula|W6: el anuncio cortés|W1/W3: puntuación|interfaz Mermaid: renderizar|operaciones CSV: duplicar|editable · 249 999 filas.*al agrandar la ventana'
# En baseline-openlid:
/usr/bin/caffeinate -i npx playwright test --grep "$FILTRO12" --output=/private/tmp/freyalab-lote/pr77-ci/controls-baseline-results
# En wt:
/usr/bin/caffeinate -i npx playwright test --grep "$FILTRO12" --output=/private/tmp/freyalab-lote/pr77-ci/controls-fixed-results
```

El destino y la salida se guardaron en `pr77-ci/controls-baseline-results`/`controls-fixed-results` y sus logs respectivos. Las sondas usan el harness externo `probe-readonly.mjs` con tasas 1/16 y head esperado 8302; las cuatro capturas usan `capture-evidence.mjs 8302e1dc3256acd297215deb9b2291d8b71b6844 <captures-fixed>`. El JSON identifica los archivos reales y sus hashes, sin publicar perfiles crudos, powerlogs ni variables del entorno de las trazas.

## Capturas 1440×900

Root confirmó haber revisado visualmente las cuatro. El manifiesto acredita fuente/disco sin cambios, dirty=false, HEAD/fuentes intactos y worktree limpio antes de incorporar esta evidencia.

| Modo | Claro | Oscuro |
|---|---|---|
| Editar | [Captura](ci-preview-editar-claro-1440x900.png) | [Captura](ci-preview-editar-oscuro-1440x900.png) |
| Vista previa | [Captura](ci-preview-vista-previa-claro-1440x900.png) | [Captura](ci-preview-vista-previa-oscuro-1440x900.png) |

## Límites pendientes

Solo se acredita ejecución local en Mac. La **CI nueva del head final permanece pendiente**, igual que la recuperación remota de Intel. No se verificaron instalación, firma/notarización, Windows/Linux/Intel nativos locales o IME físico. No hay merge, release ni actualización de la app instalada. El parseo visible/exportado sigue siendo síncrono; esta entrega evita el trabajo oculto innecesario y conserva el comportamiento solicitado.
