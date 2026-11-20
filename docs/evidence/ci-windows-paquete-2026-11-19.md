# CI · Paquete Windows separado · Evidencia local

Base `9a4aa5d4809968c6a05971d9cc9dc7eff0122f2c`, macOS, Node 24.22.1. [Alcance, autorización y siete respuestas ADR](../stories/ci-windows-paquete-alcance-adr-0021.md). El propietario autorizó «Autorizar el reparto en otro PR»; la revisión de raíz precede a publicar el borrador.

## Cambio y conservación de tareas

El diff del workflow cambia únicamente las dos líneas de matriz de PR con paquete y push a main. Windows principal conserva tipos, todas las unitarias —incluida la nativa—, experimentos, rápidas y perf/solo. Windows `part: package` ejecuta preparación/build propios, licencias y el mismo empaquetado/ejecutable/comando de CSV empaquetado. Cada tarea de verificación aparece una vez en la unión de partes; la preparación/build adicionales tienen coste propio.

Se conservan 60 minutos por job Windows, todos los pasos/condiciones, workers, retries y aserciones anteriores. Las pruebas CI existentes comprueban también ARM, Intel, Ubuntu, selección de identidades y los diez specs empaquetados. PR sin paquete y schedule quedan iguales. Gate conserva el agregado Verify; las pruebas nuevas rechazan fallo/cancelación aunque otro Windows haya dado output `passed` y comprueban el rechazo por defecto.

## Rojo → verde y cierre local

| Comprobación | Resultado |
| --- | --- |
| Nueva prueba sobre workflow original | 2 fallos esperados (PR/push aún en un job), 7 controles aprobados; 136 ms Vitest. |
| Foco nuevo + CI existentes + gate de candidate | 78/78, cinco archivos; 2.82 s Vitest. |
| `npm run check` | 0 errores y 0 advertencias; 9.551 s de proceso. |
| `FREYALAB_PANDOC_TEST_PATH=/opt/homebrew/bin/pandoc npm test` | 3008 aprobadas + 2 omitidas; 170 archivos (169 aprobados, uno omitido); 16.66 s Vitest / 16.969 s de proceso. |
| `npm run build` | Exit 0; 1.895 s de proceso. |

La primera ejecución de la completa no pudo abrir los servidores HTTP locales (`listen EPERM 127.0.0.1`): 26 fallos y fallo de inicio de la suite Pandoc. Se conserva aparte. El mismo comando con permiso para localhost pasó, sin cambiar fuentes ni tests. No es el EPERM de rename ni un cambio de retries. Pandoc real 3.12.1 ejecutó sus casos; ese binario carece de soporte HTTP y no califica la eficacia de su sandbox HTTP. Las dos omisiones locales corresponden a casos Windows-only; no prueban ejecución nativa Windows.

## Motivo y límites

[Main614 / Windows](https://github.com/ruzer/freyalab/actions/runs/44612844417/job/135873674588) quedó cancelado a los 60:16 por la anotación original «The job has exceeded the maximum execution time of 1h0m0s». CSV empaquetado solo registró 91 casos aprobados y uno omitido; no hay resumen final ni fallo de datos demostrado. [PR196 / Windows, otro head](https://github.com/ruzer/freyalab/actions/runs/44518404831/job/135540526098) había terminado en 57:58, con 114 casos empaquetados aprobados y uno omitido.

No se ejecutó GUI/E2E local ni la app empaquetada para esta entrega; build no los sustituye. No se relanzó main614 ni se cambió candidate, producto, dependencias o pruebas anteriores. No se mide ahorro ni se garantiza una mejora de cola; un job adicional puede aumentar el cómputo total. La CI de la matriz propuesta y su paquete Windows deben calificar el SHA final del futuro borrador. Estado al registrar esta evidencia: sin push/PR, fusión, release ni instalación.

[Proof de hashes y resultados](ci-windows-paquete-2026-11-19/proof.json). Los originales rojo/verde, intentos locales, diff y manifests se conservan en evidencia privada; no se publican rutas locales ni URLs firmadas.
