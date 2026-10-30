# AC-04 D6 · Protocolo de reporte de 50 páginas

Estado: **arnés preparado; sin calibración ni medición de exportación**. Se espera la fuente/build congelados con la corrección de portada y una concesión explícita de CPU/Electron. No se modifica FreyaLab, el paquete, sus dependencias, la CI ni sus documentos de evidencia.

## Corpus reproducible

`generate.mjs` reutiliza los elementos del fixture de `academic-word.spec.ts`: portada, autores, institución («Instituto FreyaLab Sintético»), resumen, tres índices, bibliografía CSL-JSON local, SVG local, tablas numeradas, referencias cruzadas, fórmulas, notas y Mermaid. Genera seis capítulos, seis figuras/tablas y tres diagramas, más un apéndice de longitud ajustable. Todo es sintético. No hay información personal, imágenes remotas, HTML, CSS, saltos de página ni un formato de documento nuevo.

Sólo cambia el número de párrafos al final. El texto siempre termina en `FIN-REPORTE-SINTETICO`. Las 50 páginas no se presuponen por la longitud del Markdown: se cuentan **en el PDF producido por FreyaLab** con el `pdfjs-dist` ya instalado. El manifiesto inicial dice `generado_sin_calibrar`.

`self-check.mjs` comprueba, sin Electron/Pandoc, determinismo, límites, conteos, institución, ausencia de saltos/URLs, unicidad de claves, igualdad de bytes en dos directorios y rechazo del runner si falta `--lease`. La revisión con institución pasó este autocontrol y los tres `node --check`. Es una comprobación del montaje, no una medición ni una cifra de páginas calibrada. Para no escribir resultados dentro del repositorio, se pueden copiar los tres scripts a un directorio temporal antes del autocontrol.

## Preparación coordinada

1. El coordinador congela las fuentes de AC-03/04 y construye esa misma fuente. Conserva el log de build. El arnés registra después Git, todos los archivos de `src` y `out`, package/lock/config y hardware. Una huella igual antes/después evita atribuir una prueba a una fuente que cambió durante ella; **por sí sola no prueba de qué fuente salió un build**.
2. Se detienen otras sesiones Electron y cargas pesadas. El coordinador concede un token para una ventana de CPU exclusiva. El parámetro `--lease` es una protección del arnés de desarrollo; no añade permisos ni comandos a FreyaLab.
3. Se elige explícitamente el Pandoc externo existente. No se instala ni empaqueta. Para contar páginas del DOCX se requiere el LibreOffice ya instalado en `/Applications/LibreOffice.app/Contents/MacOS/soffice`; se verificó que el archivo existe, pero aún no se ejecutó durante esta preparación.
4. Se usa Node 24.22.1 y el `node_modules` existente del worktree. No se ejecuta un gestor de paquetes.

## Comandos preparados (NO ejecutados todavía)

Concesión pendiente; sustituir `TOKEN_CONCEDIDO` sólo después de recibirla. Puede utilizarse como `--root` la copia durable para que las salidas sobrevivan a una limpieza de `/private/tmp`.

```sh
TASK_NODE=/Users/ruzer/.npm/_npx/387698761821791d/node_modules/node/bin/node
TASK_WT=/ruta/al/worktree/freyalab
TASK_TOOLS="$TASK_WT/experiments/academic-export"
TASK_ROOT=/private/tmp/freyalab-ac04-medicion

"$TASK_NODE" "$TASK_TOOLS/measure.mjs" calibrate \
  --lease TOKEN_CONCEDIDO --worktree "$TASK_WT" \
  --pandoc /opt/homebrew/bin/pandoc --root "$TASK_ROOT"

"$TASK_NODE" "$TASK_TOOLS/measure.mjs" measure \
  --lease TOKEN_CONCEDIDO --worktree "$TASK_WT" \
  --pandoc /opt/homebrew/bin/pandoc \
  --soffice /Applications/LibreOffice.app/Contents/MacOS/soffice \
  --root "$TASK_ROOT"
```

El coordinador puede envolverlos en `caffeinate -i` para evitar suspensión. No debe ejecutarlos al mismo tiempo. La calibración y la medición son comandos separados para que los tiempos de búsqueda de la longitud no se presenten como muestras del benchmark.

## Calibración y congelación

El runner abre el Markdown real mediante `window.freya.openPaths` en la aplicación construida. Espera el texto final, bibliografía, imágenes y los tres Mermaid. Exporta mediante **los controles actuales de App**, que preparan `Preview.exportHTML()` y llaman a la API cerrada `window.freya.export`; no reproduce ese preparador ni inventa una ruta alternativa. La variable de prueba de exportación ya existente dirige únicamente las salidas a un directorio sintético propio.

La calibración prueba primero cero párrafos adicionales, después 200 y ajusta por acotación/bisección, con máximo 14 intentos/2000 párrafos. Cada PDF se abre con PDF.js y registra sus páginas reales. Si no aparece un resultado de exactamente 50, el runner falla y conserva los intentos; no introduce saltos ni cambia estilos para hacer pasar la medición.

Al encontrar 50, crea `frozen-fixture/` con Markdown/bibliografía/SVG idénticos y `calibrated.json`. No sobrescribe un fixture congelado anterior. Si las fuentes o el build cambian, `measure` rechaza esa calibración.

## Medición y definición del tiempo

Tres muestras con **sesión de app y perfil nuevos por muestra**, en secuencia PDF→DOCX. Se informa la apertura/preparación por separado. La muestra de exportación empieza al pulsar el formato ya disponible y termina cuando existe el archivo completo y la UI recibe la notificación de la API. Incluye preparación, conversión, escritura e interacción observable; **no es un cronometraje aislado del motor ni incluye abrir el selector del formato**. El sondeo del archivo es cada 5 ms. Se registran los tres valores y su mediana; no se purgan ni se declaran frías las cachés del sistema.

Cada PDF medido debe tener exactamente **50 páginas** y contener el final del documento. Se guardan tamaño, SHA, texto por página y huella del texto. Los originales Markdown/bibliografía/SVG conservan bytes, SHA, mtime e inode; el documento abierto sigue limpio y con el mismo texto.

Cada DOCX conserva su propio tiempo de exportación y SHA. Después de cerrar Electron, LibreOffice abre ese DOCX con perfil aislado y genera un PDF independiente; PDF.js cuenta sus páginas. Se registra `docxIndependentPagination.pages` y el tiempo de esa conversión **por separado del tiempo de FreyaLab**. No se utiliza `docProps/app.xml` como recuento real ni se fuerza que DOCX, LibreOffice, Word y Chromium paginen igual. El DOCX debe seguir byte a byte intacto tras esa apertura y contener el final del informe. El índice es el campo que entregue el producto; el arnés no le inventa páginas ni actualiza campos mediante macros/UNO.

## Entregables de cada ejecución

`result.json` se actualiza tras cada intento/muestra y también al fallar. Contiene rutas, fechas, hardware sin hostname/usuario, versiones reales de Node/Electron/Chromium/Pandoc/LibreOffice, fuente/build, muestras, artefactos y comprobaciones de conservación. Los PDF/DOCX y el PDF independiente de LibreOffice se conservan en los directorios de muestra. Copiar los resultados y exportaciones a `recovery/ac04-50-pages` después de la ejecución; no hace falta conservar cachés/perfiles.

No demuestra instalación, rendimiento en Windows/Linux, paginación de Microsoft Word ni capacidades fuera de este corpus. No publica, fusiona ni actualiza la app instalada. Cualquier fallo de fuente, conversión, paginación o integridad se conserva y se reporta antes de cambiar el corpus o el producto.
