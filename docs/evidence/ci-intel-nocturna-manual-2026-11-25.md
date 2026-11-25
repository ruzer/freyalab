# CI · Cambio B: Intel nocturno y manual (2026-11-25)

Base: main `c97584ff906821d415da70db401846299cdd7328`, con A (#219) integrado por el propietario. Rama independiente: `codex/ci-intel-nocturna-manual`.

## Cambio y garantías

- Push conserva Ubuntu, Windows y ARM y deja de solicitar las tres partes Intel. Pide tres trabajos macOS en lugar de seis.
- Nocturna y `workflow_dispatch` comparten exactamente las tres partes Intel: `shell-md`, `csv` y `package`. El lanzamiento manual solo ejecuta Verify si se selecciona `main`.
- La puerta de Release candidate conserva el último push aprobado del SHA actual exacto de main y añade la última corrida Intel entre nocturna y manual, también aprobada sobre ese SHA.
- Cada evento se consulta con filtros de SHA, rama main y `per_page=1`, sin filtrar por éxito. Entre las dos respuestas Intel se elige el id de corrida mayor. Se conserva así la política existente de impedir que una ejecución verde antigua oculte una posterior fallida, cancelada o en curso.
- Sin Intel aprobado, el mensaje pide ejecutar CI de forma manual sobre main. Una respuesta HTTP fallida bloquea la puerta; no se imprime el token. Se conserva el retorno de la URL del push y el contrato del consumidor: `candidate.yml` no cambia.
- Producto, specs E2E, dependencias, workers, tiempos de Playwright, reintentos y límites de los jobs intactos. C no se inicia antes de integrar B.

## Rojo → verde (local, macOS ARM, Node 24.22.1)

| Comando | Resultado real |
| --- | --- |
| `npm test -- --run tests/ci-int.test.ts tests/ci-arm-package.test.ts tests/release-main-ci.test.ts`, antes del cambio | 15 fallidas y 35 aprobadas; 7,00 s. Checkpoint rojo: `9fe6ea7a` |
| El mismo grupo más `tests/ci-windows-package.test.ts`, tras el cambio | 69 aprobadas; 10,07 s |
| `npm run check` | Código 0; Svelte 0 errores y 0 avisos; TypeScript aprobado |
| `npm test` completo, incluido CSV | Código 0; 3.313 aprobadas y 2 omisiones existentes; 20,04 s |
| `npm run build` | Código 0 |

Las pruebas cubren ausencia de Intel; éxito por cada evento; SHA/rama/evento ajenos; en curso/fallo/cancelación/omisión; una ejecución posterior fallida en ambos órdenes de eventos; manual verde posterior a nocturna fallida; HTTP no autorizado; consultas exactas y compatibilidad del retorno. Las matrices, comandos de paquete y la igualdad de identidades E2E de las otras tres plataformas conservan sus regresiones.

## Tiempos y aceptación pendiente

El informe del propietario midió 75 minutos en push, con Intel CSV como camino crítico de 73 minutos. No es una medición nueva de este PR. En A, las partes de las otras tres plataformas tardaron como máximo 36:50, excluida la cola. Esto permite estimar un push del orden de 40 minutos con tres trabajos macOS, pero todavía no demuestra ese resultado tras B.

Pendiente al escribir esta evidencia:

1. CI del head final del PR; sus duraciones y resultados se registran en el PR sin commits de estado.
2. Primer push de main tras la integración del propietario: tres trabajos macOS y medición real de duración.
3. Lanzamiento manual de CI sobre ese mismo main: ejecución real de las tres partes Intel y confirmación de su SHA.
4. No se lanzó Release candidate ni se probó una publicación. No se ejecutó la suite gráfica completa local: la ejecución completa y el paquete se califican en CI.

La salida local no acredita Intel ni el funcionamiento real de un disparador que aún no está integrado en main. No se borran ni convierten en aprobadas las omisiones existentes.
