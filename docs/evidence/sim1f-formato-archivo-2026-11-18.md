# SIM-1f · Formato del archivo

La barra inferior reúne Codificación, Separador y Encabezado en un acceso con el formato confirmado del documento. El panel conserva los mismos controles, opciones, condiciones `disabled`, mensajes y handler `options()`, idéntico byte por byte. No añade confirmaciones ni modifica la fuente al reinterpretarla. El resumen deriva de `doc.encoding`, `doc.delimiter` y `doc.hasHeader`, sin actualización optimista.

Se retira únicamente el «Guardado» limpio del footer global. Permanecen el indicador superior y los estados de solo lectura, documento sin ruta, cambios pendientes, última acción, apertura y selección. Los siete consumidores E2E se adaptan al panel o al indicador superior sin eliminar casos ni aserciones de datos, disco, codificación, BOM, revisión o historial. Se añaden cinco claves equivalentes en es/en; en-XA usa el mecanismo existente.

## Base y conservación

Baseline: `b156ec2e528a0657095504703fb80d00f83e756f`, integración local normal de `main 7bda2e9` con la corrección previa `1a639b6` de los accesos Limpiar (#189). La fuente antes de SIM-1f coincide con esa corrección. Su compilación nueva precede a los rojos y a las capturas anteriores. La historia corregida conserva SHA-256 `c0e45fd395cb147f9a278699b9f45c9a6da93f88a0ab72d87b91e7155afd257f`.

El spec final tiene SHA-256 `1f6cc2d6e86aa8e527a653e2daa0d4408b73b696f7ec38577f3f851384cb9ea9`; la fixture, `5845a6d446bf1334691bbae4773aa0d96b856c8b007f244422dcafd4d61c348b`. Los logs, traces, versiones anteriores de los oráculos y hashes completos de fuentes y capturas se conservan en la evidencia privada de la tarea.

## Rojo, calibración y verde

1. **Antes de modificar la interfaz:** cinco casos fallan sobre el baseline construido: falta el resumen y su acceso; tras comprobar cambios pendientes sigue faltando el acceso; el footer contiene un «Guardado» donde se esperaba ninguno. Las duraciones publicadas de los cinco casos suman 125.3 s; no se presenta esa suma como tiempo global.
2. **Primera ejecución con interfaz:** cuatro casos asumen que `summary` se expone con rol `button`; el quinto alcanza una preparación antes inaccesible que crea un documento solo en backend, sin activarlo en App. Ambos son problemas de los oráculos; no acreditan un defecto de accesibilidad del producto. Se retira el `display:flex` añadido al resumen y se conserva su presentación nativa, sin forzar roles ni añadir manejo de teclado.
3. **Oráculos corregidos:** el acceso se localiza por su etiqueta «Formato del archivo:», como los otros `summary` del repositorio; el documento nuevo se crea mediante Nuevo → Texto. [ARIA in HTML](https://www.w3.org/TR/html-aria/#el-summary) reconoce que el rol expuesto de `summary` varía entre plataformas y no permite sustituir el de su `details` principal. La prueba mantiene nombre accesible, geometría, foco, navegación y conservación de datos.
4. **Calibración del selector final:** el caso del resumen vuelve a fallar durante 16.0 s sobre la app de #189, sin interfaz SIM-1f. Un intento anterior que no encontraba la configuración de ejecución se conserva como error de preparación, no como rojo válido.
5. **Primer verde tras corregir los oráculos:** los cinco casos pasan juntos en 6.4 s, con cero retries. Comprueban resumen y geometría, reinterpretación equivalente de los tres controles, bytes intactos, Tab/Espacio/Escape y cierre exterior, rechazo real de un `change` sintético sin habilitar el selector dirty, resumen confirmado y estados de guardado.

Las elecciones del chooser nativo de macOS se calibraron con teclas del sistema antes del cambio. No se repitió esa interacción después: las pruebas finales no atribuyen a CDP las elecciones de End/Home del popup nativo. Se conservan selección de opciones y comprobaciones de los tres resultados, además del recorrido de foco y teclado que sí ejecutan.

La primera ejecución de los 18 consumidores afectados dejó 15 aprobados y tres fallos reales, uno por idioma en LIM-1: tras abrir la paleta con el panel de formato todavía desplegado, el handler global de Escape cerraba el panel del fondo y cancelaba el cierre nativo del diálogo. Se conserva la aserción existente y se añade una única condición en `closeMenu()` para no interceptar Escape originado dentro de un `dialog`, siguiendo la exclusión ya usada en la misma ventana. Es la única modificación de un handler de interfaz; `options()` permanece idéntico. Tras construir de nuevo, los 18 consumidores y los cinco casos nuevos pasan juntos sobre esa fuente final: 23/23 en 36.9 s, sin retries. Los tres casos LIM-1 pasan en 1.8, 1.8 y 1.9 s.

## Validación local

macOS, Node `24.22.1`, Pandoc real `3.12.1`. Todas las ejecuciones GUI pertenecen al responsable de la tarea.

| Comprobación | Resultado y alcance |
| --- | --- |
| `npm run check` | Sin errores ni advertencias sobre la condición final de Escape. |
| `npm run build` | Verde sobre el resumen nativo y la condición final de Escape (`CsvTable.svelte` SHA-256 `bb5f3c30…`). |
| `npm test` con servidores locales autorizados y Pandoc real | Fuente final con condición de Escape: 167 archivos, 2972 aprobadas y una omitida específica de Windows, 17.99 s. La primera corrida, previa a los ajustes finales, queda registrada aparte. |
| Catálogos y auditoría i18n | 56/56, antes de ese último ajuste exclusivamente CSS. |
| Nuevas E2E y consumidores afectados | 23/23 juntos en 36.9 s sobre la fuente final: cinco nuevos casos y las mismas 18 identidades y aserciones de consumidores. Sin retries. El listado completo de los siete archivos contiene 92 identidades y no equivale al número ejecutado. |
| Capturas y geometría | 2/2, 3.0 s, repetidos sobre la fuente final; ocho estados, panel y controles dentro del viewport, panel sobre el footer, etiquetas visibles y foco en colores forzados. Fixture y documento confirmado intactos. |
| Revisiones independientes | Dos revisiones estáticas, de especificación y estándares, sin hallazgos reportados. No prueban interacción del hardware ni CI. |

En total se ejecutaron 25 casos GUI finales: 23 públicos y dos privados de capturas. La verificación visual del responsable incluye 1280×720 oscuro en en-XA y 1440×900 claro en es.

No se añade cobertura GUI directa de los rechazos por falta de ruta o archivo cambiado en disco; sus guardas permanecen intactas. La suite unitaria completa incluye protección de fuentes y subconjuntos. No cambian parser, IPC, guardado, dependencias, plazos, retries, workflows ni `pending-files.json`.

## Capturas

Las ocho imágenes anteriores son las nuevas `fresh-main-before-*`, tomadas sobre el baseline integrado; no se utilizan las capturas históricas de la base anterior a SIM-1b. Las posteriores corresponden a la fuente final con resumen nativo.

| Idioma | Tema | Tamaño | Antes | Después |
| --- | --- | --- | --- | --- |
| es | Claro | 1440×900 | [Antes](sim1f-before-es-light-1440x900.png) | [Después](sim1f-after-es-light-1440x900.png) |
| es | Oscuro | 1440×900 | [Antes](sim1f-before-es-dark-1440x900.png) | [Después](sim1f-after-es-dark-1440x900.png) |
| es | Claro | 1280×720 | [Antes](sim1f-before-es-light-1280x720.png) | [Después](sim1f-after-es-light-1280x720.png) |
| es | Oscuro | 1280×720 | [Antes](sim1f-before-es-dark-1280x720.png) | [Después](sim1f-after-es-dark-1280x720.png) |
| en-XA | Claro | 1440×900 | [Antes](sim1f-before-en-XA-light-1440x900.png) | [Después](sim1f-after-en-XA-light-1440x900.png) |
| en-XA | Oscuro | 1440×900 | [Antes](sim1f-before-en-XA-dark-1440x900.png) | [Después](sim1f-after-en-XA-dark-1440x900.png) |
| en-XA | Claro | 1280×720 | [Antes](sim1f-before-en-XA-light-1280x720.png) | [Después](sim1f-after-en-XA-light-1280x720.png) |
| en-XA | Oscuro | 1280×720 | [Antes](sim1f-before-en-XA-dark-1280x720.png) | [Después](sim1f-after-en-XA-dark-1280x720.png) |

La suite E2E completa y la CI del commit final están pendientes. El PR de SIM-1f puede abrirse en borrador contra `main`, declarando #189 como prerrequisito y conservándolo como commit separado en su historia normal. Mientras #189 no esté en `main`, el diff incluye esa corrección; no se fusiona automáticamente ni se reescribe el head durante CI. No se ha actualizado la app instalada ni se ha publicado SIM-1f.
