# P5: esperar la lectura inicial de ajustes

Cambio de montaje autorizado por el propietario a través de la coordinación de AN-2. No modifica el producto, las aserciones ni los plazos de P5.

El agente de AN-1b reprodujo en una copia aislada la carrera al retener 1 s la respuesta real de `settings:get` durante la recarga. La barra ya era visible, pero el contador seguía en `reads: 0` con el gancho de almacenamiento activo. La misma reproducción, esperando por condición `reads > 0`, pasó tres veces con `reads: 5`; no se añadió esa demora al test versionado.

- [Salida roja original](red-real.log): una ejecución, falla la aserción original de lecturas, `0 > 0` es falso.
- [Tres verdes originales](green-3-repeticiones.log): 3/3, sin reintentos, 12,7 s.
- Procedencia: `/private/tmp/freyalab-an1b-p5-delayed-red-real.log` y `/private/tmp/freyalab-an1b-p5-delayed-poll-green.log`, entregados por el agente AN-1b. Estas ejecuciones diagnósticas son anteriores a este commit; no se presentan como CI de AN-2.

Solo se incorpora la espera de condición al test de AN-2. La CI verde de AN-1b permanece asociada a su propio SHA. La nueva CI y las pruebas de AN-2 tendrán evidencia separada.
