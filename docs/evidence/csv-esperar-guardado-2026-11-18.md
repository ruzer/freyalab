# CSV · Esperar el final visible de Guardar — 2026-11-18

Base de la corrección: `main 23121eda41fb9380c533a25ef86723046b6d7639`. Alcance y siete respuestas en `docs/stories/pruebas-csv-esperar-guardado-alcance-adr-0021.md`. La rama solo añadirá una espera de `aria-busy=false` en el cuerpo ya existente de los tres casos malformados; no añade una prueba duplicada ni un wrapper permanente.

## Rojo causal anterior al cambio

La raíz ejecutó los siguientes controles en Mac Apple silicon, Node 24.22.1, con datos sintéticos. Este agente no lanzó GUI.

| Fuente | Respuesta real de save | Estado / resultado |
|---|---|---|
| main 711f85f | Retenida tras persistir y completar el handler original | Main limpio + disco correcto, pero Guardar ocupado; clic Tabla abre confirmación y el grid falla tras 15 s |
| #183 895de2d | Misma barrera real | Mismo rojo y diálogo |
| main 711f85f | Guard iniciado mientras la respuesta sigue retenida | guardResolved=false tras consulta UI; después de liberar, verde 1/1 en 2,6s |
| #183 895de2d | Mismo guard iniciado antes de liberar | Misma espera demostrada; verde 1/1 en 2,5s |

En ambos rojos el editor permanece montado. Liberar después cambia Guardar a no ocupado, pero el diálogo ya abierto persiste. En ambos controles del guard, tras liberar se ve Tabla y se conservan las mismas filas y bytes; el editor se retira del DOM una vez. No hubo timers, nuevas esperas máximas ni datos guardados ficticios.

En `csv-esperar-guardado-2026-11-18/`: cuatro logs, JSON compacto de los cuatro controles, equivalencia de las funciones causales y dos capturas del diálogo. La sonda v1 y v2 quedan privadas, con SHA en el manifest, y no se incorporan a las pruebas. Los logs públicos solo retiran ANSI, el prefijo privado del worktree y espacios finales; el manifest conserva los SHA originales.

La traza de Ubuntu #183 en la [corrida 44396670322](https://github.com/ruzer/freyalab/actions/runs/44396670322) muestra Texto y confirmación al final, con Archivo guardado detrás. Las aserciones de main limpio y bytes ya habían pasado; el clic Tabla empezó 0,739 ms después del poll. No hay browser trace, IPC ni snapshot previo: no se atribuye a aquella ejecución una respuesta que no registró. La reproducción demuestra que la condición previa del test es insuficiente, también en baseline anterior a SQL.

## Validación de la corrección

| Comprobación sobre esta rama | Resultado |
|---|---|
| Recuento e identidades de csv-text | 22 antes y 22 después; mismos proyecto, archivo y títulos; solo se desplazan líneas |
| Todas las aserciones previas conservadas | AST: 196 originales intactas, 197 después; única añadida: aria-busy=false |
| `npm run check` | 0 errores, 0 avisos |
| `npm test` completo | 2.961 aprobadas, 1 omitida; 165 archivos, 18,61 s |
| `npm run build` | Correcto |
| E2E csv-text completo, sin retry | 22/22, 35,9 s, un worker y cero retries; ejecutado por raíz |
| Ocho capturas de contexto | 8 PNG, es/en-XA, claro/oscuro, 1440×900 y 1280×720; 2 ejecuciones auxiliares privadas, 4,0 s |
| CI del head final | Pendiente; no se transfiere otro SHA |

Comprobaciones actuales sobre código `fb1da6107bd5f835790a0fa57888efa1cca7bf48`, Node 24.22.1 en Mac Apple silicon. La única omisión unitaria es el caso exclusivo de Windows en `tests/package-smoke.test.ts`. El mensaje de Pandoc 3.12.1 sin HTTP indica una limitación del sandbox no medido; esa función retorna normalmente y no cuenta como skipped.

Comandos ejecutados hasta ahora:

```sh
npm run check
npm test
npm run build
npx playwright test tests/e2e/csv-text.spec.ts --workers=1 --retries=0 --list
npx playwright test tests/e2e/csv-text.spec.ts --workers=1 --retries=0 --reporter=line
```

Se conserva la comparación AST e identidades en la carpeta de evidencia. Ningún spec cambia de proyecto ni se añade o elimina un caso. Se conservan los logs de validación junto a la evidencia; los originales privados y sus SHA se mantienen en el manifest. La GUI la ejecutó únicamente la raíz.

## Contextos visuales

Los archivos `contexto-*.png` muestran Tabla después de completar el guardado visible y cambiar de modo. El fixture sintético usa el mismo CSV corregido de dos registros. Las ocho combinaciones mantienen `aria-busy=false` y el mismo SHA-256 del archivo; `contextos.json` registra dimensiones, tema, idioma y el código `fb1da61` ejecutado.

La sonda auxiliar de capturas vive fuera del testDir y no se añade al repositorio ni al recuento de 22 pruebas. No usa el wrapper diagnóstico IPC. Las capturas no sustituyen los cuatro controles causales ni las comprobaciones de bytes y filas del archivo completo. Se revisaron es/claro 1440×900 y en-XA/oscuro 1280×720 como muestras estáticas; no es una validación de instalación, lector de pantalla físico o de toda la interfaz.

## Fuera de esta corrección

C2 Markdown de Windows y H13 siguen abiertos como señales diferentes con disco previo. Tampoco se corrige aquí la preparación de fuentes inestable de Windows #183. No se modifican producto, datos, guardado, IPC, dependencias, workflow, timeouts, retries ni ninguna aserción existente. No se afirma instalación, empaquetado ni plataforma no ejecutada.
