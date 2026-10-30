# Plegado: publicar el árbol preparado en el fixture

## Fallo observado y alcance

[CI259](https://github.com/ruzer/freyalab/actions/runs/41008877749), push de main `5562523ecdc2167bf331439b38ce3d0d8f14d519`, job Intel123910107093: markdown-folding.test.ts falló en el caso LF esperando `{from:5,to:22}` y recibiendo null. Las precondiciones ensureSyntaxTree con1000ms y syntaxTreeAvailable habían pasado; no fue un timeout. La unidad terminó1647aprobadas+1fallida+6omitidas y los pasos E2E/paquete no se ejecutaron. Windows/ARM/Ubuntu terminaron444E2E+1Wordomitido y63/63paquete, sin reintentos observados.

El test, markdown-editing.ts y lockfile eran idénticos en main556/de8/bcfc. Que las unidades Intel posteriores pasaran no subsana ese rojo ni demuestra su causa.

## Mecanismo y corrección limitada al test

En las versiones fijadas, ensureSyntaxTree avanza el contexto de parsing y syntaxTreeAvailable consulta si ese contexto terminó. El servicio de plegado Markdown lee syntaxTree(state), el snapshot inmutable del estado. Si el parse inicial fue parcial, completar el contexto no publica por sí solo otro snapshot. La API pública forceParsing usa también una transacción para publicar el árbol cuando cambia.

El fixture conserva ensureSyntaxTree(...,1000) y las aserciones de disponibilidad; después obtiene `state.update({}).state` antes de consultar foldable. Comprueba que la transacción no cambia documento, texto o historial y que el snapshot cubre todo el documento. Conserva las aserciones originales de LF/CRLF, código cercado, details y readonly true/false. **No cambia Source, CodeMirror, dependencias, configuración, presupuestos, filas o CI.**

## Rojo → verde real

Worktree independiente, base main556, Node24.22.1, Vitest5.0.5. Sólo este unitario pequeño, autorizado mientras otra sesión tenía la app; no es una medición de velocidad del producto.

```text
node node_modules/vitest/vitest.mjs run tests/markdown-folding.test.ts --reporter=verbose
```

| Estado | Resultado real |
|---|---|
| Helper sin publicación + nueva regresión determinista | **6 originales pasan +1 falla**, exit1,200ms. La nueva aserción espera{5,22} y recibe null. |
| Helper publica mediante transacción pública vacía | **7/7 pasan**, exit0,151ms. |

La regresión usa Markdown ParseWrapper/PartialParse públicos para retener el parse inicial y un reloj controlado **sólo durante la construcción síncrona**, restaurado inmediatamente en finally. Respeta stopAt y limita el número de avances para no bloquearse. Luego libera el parser y utiliza el mismo presupuesto1000ms. No hay sleep, retry o aumento de plazos. No toca la biblioteca ni el producto.

El diagnóstico externo previo registró snapshot6/contexto36/availabletrue/foldablenull; después de la transacción, snapshot36/rango{5,22}, docChanged=false/texto íntegro/undoDepth0. El nuevo test comprueba ese mismo contrato utilizando además la extensión real del producto.

## Evidencia y límites

Logs de CI de los cuatro SO, protocolo externo, resultado, fuentes roja/verde, exit y diff se conservan en `/private/tmp/freyalab-lote2/main556-ci259/` y en `recovery/main556-ci259/` de esta sesión. Source `4d30bd4bca4ca987ee8dc2fa84de0e2ecfd63880`, package/lock y workflows tienen diff vacío; el enlace temporal a dependencias existentes se retiró.

La reproducción prueba un mecanismo permitido por el contrato que explica la preparación insuficiente del fixture; **no identifica retrospectivamente los dos árboles exactos de aquel intento Intel**, que no se registraron. CI259 permanece rojo histórico y no se relanzó. Root revisó y aprobó el diff antes de consolidarlo. Los PR existentes que incorporen este commit necesitan su CI final; no se declara esa CI aprobada aquí.

No se ejecutó otra suite, build, benchmark, paquete ni Electron; no hubo cambio de producción, publicación, instalación o fusión de PR.
