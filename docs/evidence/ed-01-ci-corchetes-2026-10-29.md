# ED-01 · Corrección exclusiva del arnés de teclado

CI inicial de `0a390e178ad416a3585e545143195acfbfd29da4`, [run 40823224767](https://github.com/ruzer/freyalab/actions/runs/40823224767): Ubuntu aprobó **1.401 unitarias**, pero acabó **432/435 E2E, 15,0 min**. Fallaron tres casos nuevos (`markdown-editing.spec.ts`, teclado, CRLF y tema): cero widgets de plegado frente a uno, tanto en el intento inicial como en retry1. Se conservaron el fallo y sus 15 s; no fue P7 y no se reintentó el run para obtener verde.

## Diagnóstico y límites

La primera hipótesis fue falta de árbol sintáctico. No se presenta como causa: un diagnóstico con **AST completo** reproduce el problema sin esa condición. Las APIs instaladas de CodeMirror normalizan primero un carácter con modificadores sin añadir Shift; para `key='['` y Ctrl+Shift se encuentra `Ctrl-[` (`indentLess`) antes del plegado. En sólo lectura ese comando devuelve false y permite continuar: explica el contraste con el caso readonly aprobado, sin atribuírselo a esperar el parser.

| Evento, Ctrl y Shift activos, AST completo | Sólo lectura | Manejador devuelve | Rangos plegados |
| --- | --- | --- | --- |
| `key='['`, code BracketLeft | false | true | 0 |
| `key='{'`, code BracketLeft | false | true | 1 |
| `key='['`, code BracketLeft | true | true | 1 |

Este diagnóstico usa **EditorState, parser y comandos nativos reales**, con un adaptador mínimo de vista para despacho/línea. No es una ejecución de Linux ni una simulación de su sistema operativo. Una captura aparte en el Editor nativo de macOS, con la flecha ya disponible, comprobó los eventos reales emitidos por Playwright:

- `Control+Shift+[` → `key='['`, `code='BracketLeft'`, `keyCode=219`, Ctrl=true y Shift=true.
- `Control+Shift+BracketLeft` → `key='{'`, mismo code/keyCode/modificadores.

Los controles con Meta se conservaron como observaciones de macOS; no se usan para afirmar un despacho nativo Linux. Scripts y JSON crudos: `recovery/ed01/diagnose-bracket-key.*` y `diagnose-native-key-v2.*`. El primer intento de leer logs con el visor de checks devolvió 502; el conector GitHub sí entregó el log del job `123280243995`.

## Cambio y verificación

Sólo el arnés cambia `Control+Shift+[`/`]` por las teclas físicas `Control+Shift+BracketLeft`/`BracketRight` en Windows/Linux. Los atajos del producto permanecen iguales. Se espera también la flecha nativa antes de teclear, como sincronización independiente; no se atribuye a esa espera la corrección del evento.

Focal de los tres casos afectados, build existente de la misma fuente: **3/3 en 2,3 s, salida 0, sin retries, macOS Apple silicon**. Esto no acredita todavía la rama Windows/Linux del arnés: la CI real nueva debe comprobarla. Se conservan teclado real, nombre accesible/anunciador, CRLF, texto/dirty y tema, con las mismas aserciones y plazos de 15 s.

Comparación contra el cierre local `8902c99`: **104 archivos de src, 251 compilados y package/lock/config sin cambios**; de 497 archivos comparados, cambia únicamente `tests/e2e/markdown-editing.spec.ts`. El producto, fixtures y tiempos medidos no se modifican. No se repite una suite local completa ni la medición sobre un producto byte a byte idéntico; se exige CI completa y paquete en cuatro plataformas sobre el nuevo head. No se cambia CI ni se aumentan los reintentos.

Mismo PR #91 en borrador/base main. Sin fusión, publicación o instalación. Las intermitencias históricas de D1 y P7 continúan abiertas.
