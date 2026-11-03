# PR #108 · Espera del resumen de 200 campos en macOS · 2026-11-02

## Inspección antes de modificar

Se descargó y abrió el artefacto [evidence-macos-15-1](https://github.com/ruzer/freyalab/actions/runs/41515069251/artifacts/13176798995), correspondiente al head `59955b98da03eb24fb8f6fbad813a97970d4a4af`.
Digest del ZIP del artefacto informado por GitHub: `441e65755854e564f5d3305f31ecdeab36433fdcaead79660b5a7851b8906c3a`.

Los dos `trace.zip` contienen `test.trace` y el contexto accesible adjunto al fallo; no incluyen una secuencia de snapshots del navegador ni una grabación que permita observar cuándo habría terminado. Se inspeccionaron ambos archivos, no solo el log del job. Los hashes individuales, tiempos y extractos están en [trace-inspection.json](trace-inspection.json).

| Intento rojo | Espera real de la aserción | Estado capturado al fallo |
| --- | --- | --- |
| Inicial | 15.010,631 ms | 200 campos cargados; Filas = Campo 0; Valores = Cuenta de Filas del archivo; sugerencia visible; «Calculando el resultado…», Cancelar y progreso |
| retry1 | 15.062,042 ms | Mismo estado: calculando, con los campos y la sugerencia ya presentes |

No aparece un mensaje de error del panel. El resumen `.pivot-result` todavía no existe. Por tanto, la evidencia distingue **cálculo pendiente** de ausencia de sugerencia o un error visible, pero no demuestra por sí sola la causa de la demora ni descarta un cálculo que no termine. No se atribuye de forma concluyente a lentitud del runner.

## Cambio mínimo autorizado

Solo la aserción inicial del caso «200 campos, nombres Unicode, idioma seudolocalizado y tamaños accesibles» recibe la constante local `summaryWith200FieldsTimeout = 30_000`, con comentario del estado observado y la corrida original. El rojo anterior es real de CI, no un retraso inyectado para simularlo. Los 200 campos y todas las comprobaciones de búsqueda, Unicode, tamaños y archivo intacto se conservan.

No cambian fuentes de la app, opciones de gráficos, perfiles, SQL, configuración de Playwright, workflow, workers, reintentos, plazo del caso completo ni los plazos de ninguna otra aserción. Esta espera funcional no es un benchmark: ampliar su presupuesto no acredita rendimiento. Si el nuevo plazo también vence, queda pendiente diagnosticar la ejecución, sin otra ampliación automática.

## Validación

Los comandos se ejecutan sobre `59955b9` más únicamente este ajuste de prueba y estos documentos. El head final y la CI se registran en la descripción del PR, sin crear un commit documental que reinicie la corrida.

- `npm run check`: salida 0, 0 errores y 0 avisos.
- `FREYALAB_PANDOC_TEST_PATH=/opt/homebrew/bin/pandoc npm test`: salida 0, **2.402/2.402**, 122 archivos, 16,01 s. Pandoc real local 3.12.1; su binario no tiene soporte HTTP, por lo que no acredita la eficacia de ese aislamiento.
- `npm run test:e2e -- tests/e2e/chart-fields.spec.ts tests/e2e/chart-review.spec.ts --retries=0 --output=/private/tmp/freyalab-f2b-evidence/macos-fix-focused`: salida 0, **17/17**, 1,6 min, sin reintentos ni omisiones. El caso de 200 campos tardó **5,2 s** en total en este Mac; esto no demuestra la duración en el runner. Incluye los cinco casos de la revisión anterior.
- `npm run build`: salida 0, ejecutado por el script anterior antes de lanzar Electron.

El código de producto no cambia: se conserva la evidencia integral local previa de `5ea3530`, **548/548** con cero retries, cuyo árbol `src` es idéntico al de esta corrección. No se repite esa suite local sin cambios de producto; la CI completa del nuevo head debe calificarse por separado.

## Alcance y límites

Se mantienen las seis correcciones anteriores: truncado honesto y aviso único, motivo sin solapes, atribución de elección, formato numérico y campos/acciones visibles. El propietario revisará esos puntos cuando macOS pase. No se inicia U0, F2b-2 ni F2c; no se fusiona ni se marca listo el PR.

No verificado: causa interna exacta o finalización del cálculo después del fallo en la corrida original; Intel; lector de pantalla manual; instalación manual; rendimiento universal de 200 columnas. La evidencia remota del head nuevo no se presume a partir del verde local ni de checks anteriores.
