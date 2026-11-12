# Seguimiento de Windows · oráculos y coste de cancelación

Sin cambios de producto, plazos, reintentos, fixture compartido o aserciones. Solo se corrigieron dos oráculos en `tests/table-empty.test.ts`. La propuesta de plazo está separada y **NO aplicada**.

## CRLF: reproducción y corrección del oráculo

Se creó `/private/tmp/freyalab-lim1-crlf-h93fq6uh/`, con una copia de la prueba, el fixture convertido a CRLF exclusivamente en ese directorio y un enlace a las fuentes del producto. No se reescribió el fixture del worktree de desarrollo ni ningún documento de la GUI.

Comando, con Node 24.22.1 antepuesto a PATH:

```sh
./node_modules/.bin/vitest run tests/table-empty.test.ts \
  -t 'rellena Mixta|elimina por consulta' --reporter=verbose
```

- `10-red-crlf.log`: **2 fallaron / 3 pasaron / 26 excluidas por el filtro**. Coinciden con los fallos observados en Windows: Mixta usaba reemplazos que solo encontraban LF; eliminar con `all` reconstruía el último terminador como LF. El motor conservaba correctamente CRLF.
- Corrección: los reemplazos de los valores de Mixta ya no incluyen ni reescriben el terminador; al eliminar, el oráculo conserva los segmentos originales con sus finales de línea, sin `trimEnd` ni una reconstrucción con LF.
- `10-green-crlf.log`: **5/5** en 233 ms. `10-green-lf.log`: **5/5** en 236 ms. Las 26 exclusiones corresponden al filtro del comando, no a nuevos `test.skip`.

El fixture compartido original conservó SHA-256 `6fb73de2f8356d0ac1db7793bf87d326ffac23b29c76f8fa184762e4e8f5ecad`.

## Coste de la prueba de cancelación

Instrumentación temporal exclusivamente en la copia privada de la prueba. La ejecución filtró los dos casos `fillEmpty`; no se añadieron trazas a las fuentes ni a la prueba compartida. Node 24.22.1, macOS ARM, mientras el coordinador tenía la GUI reservada. No se cargó artificialmente el equipo ni se atribuyen estos tiempos al runner Windows.

Datos originales: `11-cancel-phase-cost.log` y `11-cancel-phase-cost.json`.

| Fase local | Preview | Apply |
| --- | --- | --- |
| Escribir y abrir 110.000 filas | 128,41 ms | 92,24 ms |
| Snapshot previo | 74,25 ms | 77,45 ms |
| JSON previo | 12,81 ms | 11,92 ms |
| Preparación, recorrido y serialización hasta cancelar después de 100.000 filas | 397,44 ms | 368,21 ms |
| Snapshot posterior | 67,66 ms | 71,33 ms |
| JSON posterior | 13,03 ms | 14,16 ms |
| Comparación nativa del estado completo | 1,34 ms | 1,20 ms |
| Comparación del archivo original | 0,87 ms | 0,79 ms |

Ambos casos pasaron en 700 y 640 ms. Los dos snapshots son el estado anterior y posterior: no son dos comprobaciones del mismo instante. Omitir uno o sustituir el estado completo por una comprobación parcial reduciría cobertura. Los dos JSON consumieron unos 26 ms por caso; el coste principal observado está en preparar/recorrer/serializar 100.000 modificaciones antes de solicitar la cancelación. `fillPrevious` sobre este fixture no prepara modificaciones por carecer de valor anterior; `deleteRowsWhere` puede cancelarse en el recorrido de selección. Esa diferencia es consistente con los tiempos remotos proporcionados por el coordinador, sin demostrar un bloqueo del producto.

No se justifica introducir una caché o cambiar el motor solo para cumplir el plazo funcional de cinco segundos de este caso. Esta prueba tampoco mide la latencia de respuesta a pulsar Cancelar: primero exige haber recorrido más de 100.000 filas, y luego verifica cancelación e integridad de estado/historial y archivo.

## Propuesta no aplicada

`propuesta-cancel-fill-12s.patch` propone un presupuesto con nombre de **12 s solo para preview y apply de `fillEmpty`**. Los otros cuatro casos siguen con el valor predeterminado de 5 s. Conserva 110.000 filas, el disparador posterior a 100.000, los títulos y todas las aserciones. El bucle de registro mantiene exactamente los seis casos.

El comentario parte del máximo remoto comunicado de **5387 ms × 2 = 10774 ms**. Es un margen propuesto; ese tiempo corresponde a un caso que agotó su plazo, no a una medición remota de finalización exitosa. No demuestra por sí solo que Windows terminará con el nuevo presupuesto.

El propietario debe resolver la excepción antes de aplicar el parche. No se aplicó ni se ejecutó esa propuesta y no se relanzó la CI por este agente.
