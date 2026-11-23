# Reloj de las pruebas de columna: una preparación sin carrera

Base `main@6e70d54995a8975ce234cd1a759a46b3d72d385e`. Rama `codex/reloj-pruebas-columnas`. Solo cambia el setup de dos escenarios de `column-menu.spec.ts`; el segundo se ejecuta en es y en-XA. Producto, títulos, aserciones, barreras IPC, datos, plazos y reintentos intactos.

## Causa y rojo anterior al cambio

En [main 45120143253](https://github.com/ruzer/freyalab/actions/runs/45120143253), macOS ARM, `column-menu.spec.ts:110` falló antes de la edición con `clock.pauseAt: Cannot fast-forward to the past`, en `install({time:0}); pauseAt(1)`. Pasó al reintento: no se presenta como cero flaky ni como un fallo del motor CSV.

Se reproducen exactamente esas API públicas en una página aislada: instalar hora 0, avanzar 2 ms mediante `runFor(2)` y pedir pausar en 1. Rechaza con el mismo error. No se reduce un timeout, añade un sleep ni simula un error de la app. El primer intento restringido de lanzar Chromium fue rechazado por macOS antes de abrir una página; no cuenta como rojo del reloj. El mismo control en ejecución nativa terminó correctamente y capturó el rechazo esperado.

## Cambio y control temporal

`setFixedTime(0) → pauseAt(0) → setSystemTime(0)`. Fijar la hora hace que pausar en 0 no dependa del tiempo real entre dos mensajes de protocolo. La última llamada retira la hora fija, ya con el reloj pausado, para que `runFor` conserve el avance de `Date` y los temporizadores de 150 ms del caso original.

Control del candidato, también con un avance forzado de 2 ms entre las primeras llamadas:

| Estado | Callback | Date.now() |
| --- | ---: | ---: |
| Inicial, pausado | 0 | 0 |
| Tras `runFor(149)` | 0 | 149 |
| Tras `runFor(1)` | 1 | 150 |

La sonda acredita el reloj de Playwright 1.64.1; las pruebas reales siguientes acreditan el flujo de la aplicación. No se accede a APIs internas del reloj.

## Validación real local

Apple M2 Max / macOS ARM, Node 24.22.1. Build de la base de producto, sin modificaciones de fuentes; el único cambio ejecutable es el spec, SHA-256 `901c7af6c5a76f29557e81ccbef88478c1e08731727568267f8bff8cbed69f95`.

| Comando | Resultado |
| --- | --- |
| `npm run check` | 0 errores, 0 avisos |
| `npm test` completo | 3.107 aprobadas, 2 omisiones existentes; 174 archivos aprobados y 1 omitido; 19,91 s |
| `npm run build` | exit 0 |
| `npx playwright test tests/e2e/column-menu.spec.ts --grep 'quitar espacios y minúsculas|una búsqueda cambiada' --repeat-each=5 --workers=1 --retries=0` | 15/15, 21,9 s, cero reintentos |

Tres casos × cinco repeticiones: limpieza de columna y consulta vigente bajo edición en es/en-XA. Se mantienen las comprobaciones de 150 ms, revisión, orden de respuestas, segunda búsqueda, bytes y valores originales. Un primer filtro sin coincidencias no ejecutó casos y no se cuenta como validación.

## ADR 0021, siete respuestas

1. Herramienta existente: reloj público de Playwright ya instalado.
2. Práctica reutilizada: rojo controlado y originales sin relajar oráculos.
3. API suficiente: setFixedTime, pauseAt y setSystemTime; sin servicios nuevos.
4. Madurez y seguridad: misma versión, licencia y aislamiento; ningún cambio al puente o al producto.
5. Coste: dos preparaciones de tres llamadas, sin nuevas esperas ni recursos.
6. Adaptación mínima: sustituir solo las dos preparaciones que compiten con 1 ms.
7. Código propio: únicamente coordinar el reloj de la prueba; no reimplementar temporizadores.

## Pendiente y no verificado

CI del head final en las tres plataformas pendiente. No se ejecutaron Windows/Intel locales ni una suite E2E local integral nueva: el cambio está limitado al montaje temporal del spec. No se declara resuelto el otro flaky U0 ni el fallo de exportación de 1 GB, que tienen seguimiento separado. Ninguna prueba borrada o saltada por este cambio. No hay interfaz nueva ni capturas de producto. No se fusionó, publicó o instaló nada.
