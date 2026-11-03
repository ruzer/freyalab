# U0.1 · Preparación de 0.1.0-alpha.2

Base `561deee6196fca126705441ed4b12f4be8b70ccd`. Capturas de Electron en macOS Apple silicon, con CSV sintético y viewport de 1280 × 720.

| Estado | Antes claro | Después claro | Antes oscuro | Después oscuro |
| --- | --- | --- | --- | --- |
| Inicio, tema Sistema | [PNG](before-inicio-light-1280x720.png) | [PNG](after-inicio-light-1280x720.png) | [PNG](before-inicio-dark-1280x720.png) | [PNG](after-inicio-dark-1280x720.png) |
| Cabeceras CSV | [PNG](before-tabla-light-1280x720.png) | [PNG](after-tabla-light-1280x720.png) | [PNG](before-tabla-dark-1280x720.png) | [PNG](after-tabla-dark-1280x720.png) |
| Campos del Resumen en español | [PNG](before-campos-es-light-1280x720.png) | [PNG](after-campos-es-light-1280x720.png) | [PNG](before-campos-es-dark-1280x720.png) | [PNG](after-campos-es-dark-1280x720.png) |
| Campos del Resumen en en-XA | [PNG](before-campos-en-XA-light-1280x720.png) | [PNG](after-campos-en-XA-light-1280x720.png) | [PNG](before-campos-en-XA-dark-1280x720.png) | [PNG](after-campos-en-XA-dark-1280x720.png) |

## Pruebas

- `npx playwright test tests/e2e/ui-u0.spec.ts --grep 'U0\.1:' --retries=0` ejecuta los dos casos nuevos. `FREYALAB_U01_PHASE=before` o `after` habilita capturas. En la base, ambos casos fallaron por recorte de insignias y separación de 0 px. El caso en español también detectó la sombra en reposo, el selector estrecho, la línea de la pestaña inactiva y la ausencia de dirección en es/en. [Extracto de la salida roja](rojo.txt).
- En el resultado se comprueba que las insignias caben completas, que los elementos de cada fila no se cruzan y que hay al menos 4 px entre los botones consecutivos. El puntero alcanza cada botón y el nombre de columna conserva el foco, el hover y su nombre accesible. Se verifica un primario habilitado en inicio, tabla y resumen.
- La revisión existente del Resumen verifica que se ven seis campos y las acciones siguen accesibles. Los casos de orden comparan Suma y Cuenta en es/en. Con orden descendente la primera categoría pasa a `C841` y el aviso cambia de dirección. El mapa de calor conserva su orden ascendente fijo.
- La primera suite completa sobre `4dcfb56` aprobó 561 casos y falló en «Más opciones» a 800 × 720. La traza dio una proporción visible de 0,97716 frente al 1 exigido. El gráfico estrecho cede 6 px de altura mínima para dar espacio al aviso. La misma prueba pasó a 800, 1280 y 1440 px sin ajustar su aserción. Las capturas de 1280 px se mantienen porque el ajuste solo se aplica por debajo de 900 px.
- `npm run check` terminó con 0 errores y 0 advertencias. `npm test` con Pandoc 3.12.1 aprobó 2.450 casos en 123 archivos. `npm run build` terminó correctamente.
- La comprobación de metadatos pasó de `0.1.0-alpha.1` a `0.1.0-alpha.2` en el manifiesto y las dos entradas del lockfile. La comparación estructural confirmó que las dependencias son idénticas. El procedimiento deriva la etiqueta de la versión de `package.json` en el SHA candidato.

Los resultados de la suite completa y la CI del commit entregado se registran en el PR. Las capturas son locales y no acreditan una revisión visual en Windows o Linux ni la instalación de los artefactos.
