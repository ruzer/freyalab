# Windows · Guardado y recuperación acotada de rename

Propuesta para un PR borrador autorizado por el objetivo de estabilidad. La adopción corresponde al propietario al revisar y fusionar. Base `39c2000936f1b03c00daee45bc0a257132fb26ab`; SHA de publicación y CI pendientes. [Alcance y siete respuestas ADR](../stories/windows-rename-propuesta-local-alcance-adr-0021.md). [Proof: identidades, resultados, hashes y dimensiones](windows-guardado-rename-2026-11-19/proof.json).

## Hallazgo y propuesta

En la [CI de la sonda #195](https://github.com/ruzer/freyalab/actions/runs/44504974068), Windows falló al guardar Texto en el intento inicial y Mermaid en el retry. Los traces originales muestran la conversión a LF en memoria aprobada; el oráculo de disco conservó los bytes mixtos anteriores. Las capturas originales muestran `EPERM` en `rename`, regreso a Guardar y documento todavía modificado. El aviso de guardado exitoso ya estaba presente antes de esos clics. El origen de la denegación sigue desconocido; esto no prueba una causa histórica común para H13/C2, ni pérdida de datos. Los contadores nativos `seen=0` corresponden al Markdown que sí se guardó y son inconcluyentes para los formatos posteriores.

El único archivo de producto modificado es `src/main/files.ts`: nueve líneas añadidas y dos retiradas. La propuesta permite hasta tres intentos totales de rename únicamente con huella esperada string y error Windows `EPERM`/`rename`. Espera 50 y 100 ms: 150 ms programados, sin limitar el tiempo total de I/O o hashes. Cada intento comprueba la huella original; reutiliza el mismo temporal y consume el stream una vez. Si persiste el fallo se propaga el error real; si cambia el archivo se conserva el rechazo. Los casos sin huella, la creación exclusiva con link y otros sistemas/errores mantienen un intento.

## Rojo → verde y calificación local

Las pruebas iniciales sobre main dieron 4 fallos y 7 aprobadas (196 ms); el primer candidato dio 16/16 incluyendo `files.test.ts` (651 ms). Antes de excluir los guardados sin huella, un caso nuevo falló por observar tres llamadas en vez de una (276 ms; once casos no seleccionados). La política acotada dio 17/17 (622 ms). Los archivos y las comprobaciones de bytes/hash/limpieza son reales; los fallos de rename y la plataforma se simulan en esos casos.

La versión final V3 añade un caso exclusivamente Windows: vuelve readonly un destino sintético propio, llama al rename real y restaura el modo en finally antes de propagar el error recibido. Exige `EPERM`/`rename`, dos llamadas reales y bytes/permisos/limpieza correctos. Si el kernel no produce ese error, falla. Su salida final contiene solo código, syscall y número de llamadas. **En macOS se omite; aún no hay evidencia nativa Windows.** El fixture readonly no se presenta como causa histórica.

Resultados finales sobre fuente `c69759e44b9174b68faa8cae9650c5824527699e2764a93944aae34f22f3e06a`, prueba simulada `545e7c6281a7177363c13014d685dbf3dfa52c348af67272d85cc60d16d2fede` y prueba nativa `e4fcda23becbb39baca49140d6552a853941069d7b22bdd2ea7b3843a7a9b898`, Node 24.22.1 y Pandoc real 3.12.1:

| Comprobación | Resultado macOS |
| --- | --- |
| `npx vitest run tests/files.test.ts tests/files-windows-rename.test.ts tests/files-windows-rename-native.test.ts` | 17 aprobadas, 1 omitida nativa; 0.649 s Vitest / 1.077 s proceso |
| `npm run check` | 0 errores y 0 advertencias; 8.512 s proceso |
| `npm test` | 2984 aprobadas, 2 omitidas; 168 archivos aprobados y 1 omitido; 15.72 s Vitest / 16.010 s proceso |
| `npm run build` | Exit 0; 1.733 s proceso |
| H13/C2 originales, comando siguiente | 6/6; 8.0 s reporte / 8.45 s proceso; 0 retries |

Las dos omisiones unitarias son el caso Windows-only previo y el nuevo caso nativo. El comando E2E ejecutado por raíz fue:

```sh
npx playwright test tests/e2e/editor-status.spec.ts tests/e2e/markdown-tasks.spec.ts --project=md --grep "H13-2:|C2:" --workers=1 --retries=0
```

Los E2E originales, sus aserciones y plazos, dependencias, configuración de paquete y workflows no cambian. No se ejecutó una nueva E2E completa local. CI, paquete y recuperación nativa Windows siguen pendientes del futuro head publicado; los verdes macOS acreditan compatibilidad.

## Capturas de compatibilidad macOS

Sonda visual privada externa: antes 2/2, 2.6 s reporte / 3.103 s proceso; después 2/2, 2.2 s / 2.633 s. No añade tests públicos. Antes usa el producto main39 construido en checkout `fc208ab2db791f990f26f6bd5643198ac141fff6`, con diff vacío de `src`, package y lock respecto de main39; después usa el candidato c697. Las 16 copias conservan SHA-256 y dimensiones. Raíz inspeccionó después es claro 1440×900 y en-XA oscuro 1280×720 sin cortes. Estas imágenes no prueban la recuperación Windows.

| Idioma · tema · tamaño | Producto main39 | Candidato |
| --- | --- | --- |
| es · light · 1440x900 | [Antes](windows-guardado-rename-2026-11-19/before-es-light-1440x900.png) | [Después](windows-guardado-rename-2026-11-19/after-es-light-1440x900.png) |
| es · light · 1280x720 | [Antes](windows-guardado-rename-2026-11-19/before-es-light-1280x720.png) | [Después](windows-guardado-rename-2026-11-19/after-es-light-1280x720.png) |
| es · dark · 1440x900 | [Antes](windows-guardado-rename-2026-11-19/before-es-dark-1440x900.png) | [Después](windows-guardado-rename-2026-11-19/after-es-dark-1440x900.png) |
| es · dark · 1280x720 | [Antes](windows-guardado-rename-2026-11-19/before-es-dark-1280x720.png) | [Después](windows-guardado-rename-2026-11-19/after-es-dark-1280x720.png) |
| en-XA · light · 1440x900 | [Antes](windows-guardado-rename-2026-11-19/before-en-XA-light-1440x900.png) | [Después](windows-guardado-rename-2026-11-19/after-en-XA-light-1440x900.png) |
| en-XA · light · 1280x720 | [Antes](windows-guardado-rename-2026-11-19/before-en-XA-light-1280x720.png) | [Después](windows-guardado-rename-2026-11-19/after-en-XA-light-1280x720.png) |
| en-XA · dark · 1440x900 | [Antes](windows-guardado-rename-2026-11-19/before-en-XA-dark-1440x900.png) | [Después](windows-guardado-rename-2026-11-19/after-en-XA-dark-1440x900.png) |
| en-XA · dark · 1280x720 | [Antes](windows-guardado-rename-2026-11-19/before-en-XA-dark-1280x720.png) | [Después](windows-guardado-rename-2026-11-19/after-en-XA-dark-1280x720.png) |
