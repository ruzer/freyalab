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
| Recuento e identidades de csv-text | Pendiente |
| Todas las aserciones previas conservadas | Pendiente de comparar AST después de añadir el await |
| `npm run check` | Pendiente |
| `npm test` completo | Pendiente |
| `npm run build` | Pendiente |
| E2E csv-text completo, sin retry | Pendiente de raíz |
| Ocho capturas de contexto | Pendiente de raíz |
| CI del head final | Pendiente; no se transfiere otro SHA |

## Fuera de esta corrección

C2 Markdown de Windows y H13 siguen abiertos como señales diferentes con disco previo. Tampoco se corrige aquí la preparación de fuentes inestable de Windows #183. No se modifican producto, datos, guardado, IPC, dependencias, workflow, timeouts, retries ni ninguna aserción existente. No se afirma instalación, empaquetado ni plataforma no ejecutada.
