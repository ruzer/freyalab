# SIM-2f · SQL sin muros de texto

Base: `d17cc81cd279f3e8a0938077d0b8d55294f05e83`. Primer commit, solo diseño y alcance: `f24375a`. Código: `88b279f3ea12b492b777081e2812896277ab5770`.

La historia se conserva sin cambios: SHA-256 `c0fa99ec6c788ca4316d8cf1531dd69c1a88dcbfdccd2d1492b903b375f08273`. El alcance y las siete respuestas previas están en [sim-2f-alcance-adr-0021.md](../stories/sim-2f-alcance-adr-0021.md). La historia permite adelantar esta parte a SIM-1.

## Resultado y perímetro

- Una línea de solo lectura y las columnas de `datos` aparecen antes del editor. Las fichas insertan el identificador entrecomillado mediante `quoteIdentifier` y devuelven el foco.
- Los dos párrafos originales de alcance y límites conservan su contenido en «Límites». Allí sigue visible a petición la procedencia memoria/disco y revisión; no se elimina esa información para conseguir una pantalla más limpia.
- Se conservan los archivos adicionales, los asistentes, todos sus parámetros, la paginación, los informes, los estados de progreso, la cancelación y los límites.
- «Ejecutar consulta» utiliza la variante primaria y muestra «⌘ Intro» o «Ctrl Intro». Su captura de teclado se limita al panel SQL, antes del `Mod-Enter` de CodeMirror que inserta una línea. No ejecuta durante composición IME o mientras está ocupado.
- No hay mensaje de cambios al abrir o al escribir antes de una ejecución. El resultado vacío explica qué hacer; después de ejecutar, una modificación invalida el resultado y anuncia que debe ejecutarse otra vez.
- La línea de resultado muestra solo el número de filas; versión y revisiones pasan a «Detalles del resultado».
- El componente deja de estar en la lista de traducciones pendientes. Se añadieron 85 claves de SQL, todas consumidas, en español e inglés; el pseudoidioma se genera mediante el mecanismo existente. Los datos, identificadores y detalles técnicos del motor conservan su contenido.

`Editor.svelte` tiene exactamente dos adaptaciones: `insertText` con guardas de solo lectura/IME y una transacción de CodeMirror aislada para deshacer; y un `Compartment` de atributos que actualiza el nombre accesible sin recrear el editor ni perder el historial. No se cambia su edición, sesiones, codificación ni configuración de teclas general.

No hay cambios en el motor, las consultas generadas, el IPC, el guardado, los límites, las dependencias, los archivos originales o las otras partes de SIM-2.

## Rojo y verde

| Comprobación | Rojo registrado | Verde / estado |
| --- | --- | --- |
| Copia y plurales públicos del catálogo | 8 fallos: claves ausentes | 8 pasan; incluidas en las 50 enfocadas |
| Guard de textos del componente al retirarlo de pendientes | Falló por `datos`, `tabla_`, `DuckDB`, `NULL` | 7 pruebas del guard pasan; los identificadores viajan como datos, y los textos técnicos de presentación están en el catálogo |
| Apertura compacta | E2E no encontró la frase de solo lectura en el build de main | Pasa en la corrida final: el anunciador vacío permanece accesible y no ocupa espacio visual |
| Fichas, escape de comillas, foco y un solo deshacer | Caso escrito antes de la implementación | Pasa en las corridas inicial y final, incluyendo comillas/Unicode, foco y un solo deshacer |
| Cambio de idioma en vivo | El botón ya decía «Run query», pero el mismo editor conservaba «Consulta SQL» | Pasa: es → en → es conserva el mismo elemento, texto e historial |
| Contraste del texto hijo del botón | 1,0956:1: `.actions span` imponía el color apagado sobre el botón azul | Pasa: texto medido en el DOM con contraste ≥ 4,5:1 en claro y oscuro, tras limitar esa regla a los hijos directos |

El anunciador `role="status"` permanece montado y `aria-live="polite"` antes de la primera actualización. Cuando está vacío usa `sr-only`; no se oculta con `display:none`.

## Comandos y resultados reales

| Comando | Resultado local |
| --- | --- |
| `npm run check` | Final: 0 errores y 0 avisos |
| `vitest run tests/sql-clarity.test.ts tests/i18n.test.ts tests/i18n-pending.test.ts tests/sql-progress.test.ts` | Final: 50 pasan, 4 archivos |
| `npm test` | Final sobre `88b279f`: 2.941 pasan y 1 omisión de HTTP de Pandoc, 163 archivos, 18,58 s |
| `npm run build` | Final: correcto |
| `playwright test tests/e2e/sql-clarity.spec.ts tests/e2e/sql-progress-states.spec.ts tests/e2e/sql.spec.ts --project=csv --retries=0` | Final sobre `88b279f`: **18 de 18 pasan en 57,0 s**, un worker, cero reintentos; incluye aislamiento, cancelación, informes, un millón de filas y archivo mayor de 50 MiB |

El primer `npm test` en el entorno restringido falló al intentar abrir los servidores locales de pruebas (`listen EPERM 127.0.0.1`). Al repetir con autorización para esos servidores pasó. La omisión restante está declarada por la prueba existente: el Pandoc local 3.12.1 no dispone de HTTP; no se atribuye a la aplicación una comprobación que ese binario no permite ejecutar.

Los cuatro casos de fases existentes conservan sus aserciones y datos. Solo se adaptaron a `t()` los nombres de la región/editor/botón y el mensaje final, ahora traducidos. **Pruebas borradas: ninguna. Pruebas nuevas: 8 unitarias y 7 E2E.**

## Capturas

Se conservan ocho capturas anteriores de main y ocho finales del código `88b279f`, con el contraste corregido:

| Idioma y tema | 1440×900 | 1280×720 |
| --- | --- | --- |
| es, claro | [Antes](sim-2f-before-es-light-1440x900.png) · [Después](sim-2f-after-es-light-1440x900.png) | [Antes](sim-2f-before-es-light-1280x720.png) · [Después](sim-2f-after-es-light-1280x720.png) |
| es, oscuro | [Antes](sim-2f-before-es-dark-1440x900.png) · [Después](sim-2f-after-es-dark-1440x900.png) | [Antes](sim-2f-before-es-dark-1280x720.png) · [Después](sim-2f-after-es-dark-1280x720.png) |
| en-XA, claro | [Antes](sim-2f-before-en-XA-light-1440x900.png) · [Después](sim-2f-after-en-XA-light-1440x900.png) | [Antes](sim-2f-before-en-XA-light-1280x720.png) · [Después](sim-2f-after-en-XA-light-1280x720.png) |
| en-XA, oscuro | [Antes](sim-2f-before-en-XA-dark-1440x900.png) · [Después](sim-2f-after-en-XA-dark-1440x900.png) | [Antes](sim-2f-before-en-XA-dark-1280x720.png) · [Después](sim-2f-after-en-XA-dark-1280x720.png) |

El séptimo caso nuevo mide el color del texto **hijo** del botón y el fondo real mediante `getComputedStyle`, y exige ≥ 4,5:1 en ambos temas. La aserción pasó; el reporter de línea no conservó el adjunto en memoria con los RGB y ratios exactos. No se inventan esos valores ni se sustituye la medición del DOM por un cálculo sobre tokens.

## Salidas conservadas y primer intento de interfaz

- [Rojo del catálogo y plurales](sim-2f-red-catalogo.txt).
- [Rojo del guard de textos](sim-2f-red-guard.txt).
- [Rojo inicial de disposición](sim-2f-red-inicial.txt).
- [Rojo del nombre accesible al cambiar idioma](sim-2f-red-idioma.txt).
- [Rojo del contraste: 1,0956:1](sim-2f-red-contraste.txt).
- [Primera corrida general: 14 pasan y 2 fallan](sim-2f-intermedia-14-de-16.txt).
- [Corrida final: 18 pasan](sim-2f-e2e-final.txt).
- [Unitarias finales](sim-2f-unitarias-final.txt).

Los dos fallos intermedios provenían de ocultar con `display:none` el anunciador vacío. La solución fue mantenerlo registrado desde el principio como `role="status"`, con `sr-only` mientras no tiene mensaje, para que el primer cambio se pueda anunciar. No se dejó un selector `includeHidden` que ocultase ese defecto de accesibilidad. La primera corrida ya pasó fichas, idiomas/capturas y todos los consumidores de SQL; la final añade y pasa las dos regresiones accesibles de nombre y contraste.

## No verificado todavía

- La suite E2E local completa está en curso en la sesión de integración; no se atribuye todavía un resultado. Las pruebas del paquete y la CI de las tres plataformas sobre el head publicado están pendientes. Las mediciones locales corresponden a macOS Apple silicon y no prueban Windows, Linux o Intel.
- Se prepara un PR en borrador, base main. No se fusiona, publica una versión ni actualiza la aplicación instalada.
- No se tradujeron los errores técnicos que proceden de los motores y módulos pendientes fuera de `CsvSql.svelte`; se mantiene su detalle original.
