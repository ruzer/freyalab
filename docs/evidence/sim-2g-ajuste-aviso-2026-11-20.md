# SIM-2g · Aviso sin tapar la ayuda de Información

El aviso de cambio externo tapaba el final de «Cómo interpretar esta vista» en en-XA a 1280×720, con ambos temas. El ajuste reserva espacio para el aviso dentro del flujo mientras Información está visible y mantiene el pie al fondo. Cambia únicamente la presentación mediante dos reglas CSS; no cambia mensajes, acciones, datos ni duración del aviso.

La base es `b2bcc465207a43d3654709ff43525edb256f3cef`. Las huellas completas del CSS anterior y candidato, resultados saneados y las 16 capturas originales se incluyen en [proof.json](sim-2g-ajuste-aviso-2026-11-20/proof.json).

| Fase local | Resultado real | Tiempo Playwright / proceso |
|---|---|---|
| Geometría inicial |1 aprobada / 1 fallida; en-XA1280 alcanza el solape|6.177s /6.541s|
| Matriz antes |1 aprobada / 1 fallida;2 solapes de 8 vistas|7.170s /7.605s|
| Cinco casos de avisos después |5/5 aprobados;0 reintentos, 0 flaky, 0 omitidos|13.885s /14.225s|
| Matriz después, dentro de esos cinco casos |8/8 vistas sin solape; pie a ≤1 px del fondo|No es otra ejecución independiente|

Build anterior y posterior: salida 0, 2.482 s y 2.299 s de proceso respectivamente. No se transfieren resultados de CI del head anterior a este CSS.

La matriz usa español/en-XA, claro/oscuro y1280×720/1440×900. Cada PNG mantiene sus bytes originales; el manifiesto registra SHA256, tamaño y dimensiones. Los 16 se revisaron visualmente mediante cuatro mosaicos antes/después: no se observan rutas personales ni credenciales y las imágenes muestran datos sintéticos.

| Vista | Antes | Después |
|---|---|---|
| es · light · 1280x720 | [PNG](sim-2g-ajuste-aviso-2026-11-20/before/notice-help-es-light-1280x720.png) | [PNG](sim-2g-ajuste-aviso-2026-11-20/after/notice-help-es-light-1280x720.png) |
| es · dark · 1280x720 | [PNG](sim-2g-ajuste-aviso-2026-11-20/before/notice-help-es-dark-1280x720.png) | [PNG](sim-2g-ajuste-aviso-2026-11-20/after/notice-help-es-dark-1280x720.png) |
| es · light · 1440x900 | [PNG](sim-2g-ajuste-aviso-2026-11-20/before/notice-help-es-light-1440x900.png) | [PNG](sim-2g-ajuste-aviso-2026-11-20/after/notice-help-es-light-1440x900.png) |
| es · dark · 1440x900 | [PNG](sim-2g-ajuste-aviso-2026-11-20/before/notice-help-es-dark-1440x900.png) | [PNG](sim-2g-ajuste-aviso-2026-11-20/after/notice-help-es-dark-1440x900.png) |
| en-XA · light · 1280x720 | [PNG](sim-2g-ajuste-aviso-2026-11-20/before/notice-help-en-XA-light-1280x720.png) | [PNG](sim-2g-ajuste-aviso-2026-11-20/after/notice-help-en-XA-light-1280x720.png) |
| en-XA · dark · 1280x720 | [PNG](sim-2g-ajuste-aviso-2026-11-20/before/notice-help-en-XA-dark-1280x720.png) | [PNG](sim-2g-ajuste-aviso-2026-11-20/after/notice-help-en-XA-dark-1280x720.png) |
| en-XA · light · 1440x900 | [PNG](sim-2g-ajuste-aviso-2026-11-20/before/notice-help-en-XA-light-1440x900.png) | [PNG](sim-2g-ajuste-aviso-2026-11-20/after/notice-help-en-XA-light-1440x900.png) |
| en-XA · dark · 1440x900 | [PNG](sim-2g-ajuste-aviso-2026-11-20/before/notice-help-en-XA-dark-1440x900.png) | [PNG](sim-2g-ajuste-aviso-2026-11-20/after/notice-help-en-XA-dark-1440x900.png) |

Mientras existe el aviso, Información y la barra lateral disponen de menos altura: es el coste visible de reservar espacio y evitar una superposición sobre la ayuda o los datos. Se conserva su temporización existente de 3.5 s. El selector deja de reservar ese espacio al retirarse el aviso; los casos ejercitan el cierre, aunque no se archivó una medición geométrica específica después de cerrarlo.

Esta evidencia acredita el ajuste local y su matriz, **no una CI nueva verde**, una suite integral nueva ni otras plataformas. Los fallos de foco nativo E1 y sus sondas pertenecen al trabajo de estabilidad separado.

Cierre local sobre el mismo CSS: `npm run check` aprobó con 0 errores y 0 avisos; `npm test` aprobó 3.107 casos con 2 omisiones existentes; `npm run build` terminó con salida 0. Se ejecutaron en paralelo: 17.721 s, 24.347 s y 4.337 s de proceso, respectivamente. No son una medición de rendimiento del producto. No se borró ninguna prueba: se añadieron mediciones a los dos casos de aviso ya existentes.

## Suite integral local posterior

Sobre `fe311c79f352668f511b5dea2276baaddcea7378`, `npm run test:e2e -- --reporter=list,json` terminó con salida 0: **834 aprobadas, 7 omisiones existentes, 0 fallos y 0 reintentos**, de 841 identidades. Playwright: 1898.022 s; proceso, incluido build: 1901.145 s. [Resultado saneado y huellas](sim-2g-ajuste-aviso-2026-11-20/integral-local.json).

Las siete omisiones exigen el Pandoc externo del ayudante, que no se proporcionó en esta ejecución: un caso de commands y seis de academic-word. SEG-S2e se omitió antes de alcanzar su fallo esperado. No se modifica ninguna condición de omisión. E1 y los casos H13 de fin de línea sí se ejecutaron y pasaron. La sesión estaba desbloqueada antes y después; no se monitorizó continuamente.

La CI de `b2bcc465` concluyó con fallo real en macOS, `charts.spec.ts:121`, en ambos intentos: un ayudante esperaba 15 s antes de alcanzar la espera de 90 s existente en el caso. Las exportaciones no se alcanzaron allí. La suite local no reemplaza esa evidencia ni acredita una nueva CI verde del CSS. No se relanzó la corrida a ciegas, no se fusionó ni se instaló ninguna aplicación.
