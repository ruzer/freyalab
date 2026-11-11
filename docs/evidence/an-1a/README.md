# AN-1a · Pestaña de análisis a petición

Base `ec792b6`. Datos sintéticos en perfiles temporales de FreyaLab. El panel lateral y la vista «Resumen y gráfico» siguen disponibles en esta entrega.

| Verificación | Resultado local en macOS Apple silicon |
|---|---|
| Rojo en la base | `analysis-tab.spec.ts` editó y guardó el CSV, pero agotó 30 s esperando el botón «Analizar» que aún no existía. El espía registró solo `save` en ese recorrido. |
| Modelo de pestañas y vista | Las unitarias verificaron orden, reutilización, cierre por origen y separación de filtros, marcas y rango por documento. |
| Tipos y construcción | `npm run check` terminó sin errores ni avisos y `npm run build` terminó correctamente. |
| Suite unitaria | `npm test` pasó 2.649 pruebas en 137 archivos. Se omitió una prueba HTTP porque Pandoc local carece de ese soporte. |
| Flujos de análisis | Seis E2E sin reintentos verificaron foco, filtro, rango, revisión, exportación disponible, cancelación, cierre en cascada, gráfico manual en archivo grande, SQL y configuraciones tras reiniciar. |
| Espía de IPC | Abrir, desplazar, editar, guardar y entrar en Información, Estadísticas y SQL registró solo `save`. Al abrir Gráficos se observó `analyzeColumn` y `sqlRun` apareció tras aceptar la sugerencia. Al cerrar Estadísticas durante una respuesta retenida se observó `cancelAnalysis`. |

Para repetir los flujos y generar las capturas, ejecutar `npm run build` y después `FREYALAB_AN1_EVIDENCE=1 npx playwright test tests/e2e/analysis-tab.spec.ts --project=csv --workers=1 --retries=0`.

| Idioma y tema | 1440 × 900 | 900 × 900 |
|---|---|---|
| Español claro | [Captura](an1a-es-light-1440x900.png) | [Captura](an1a-es-light-900x900.png) |
| Español oscuro | [Captura](an1a-es-dark-1440x900.png) | [Captura](an1a-es-dark-900x900.png) |
| en-XA claro | [Captura](an1a-en-XA-light-1440x900.png) | [Captura](an1a-en-XA-light-900x900.png) |
| en-XA oscuro | [Captura](an1a-en-XA-dark-1440x900.png) | [Captura](an1a-en-XA-dark-900x900.png) |

La pestaña y sus controles nuevos se traducen. Información, Estadísticas y SQL conservan los textos de los componentes reutilizados. Las pruebas comprobaron foco y nombres accesibles con Playwright. Queda pendiente la revisión manual con lector de pantalla y la CI del PR en las tres plataformas. Al retirar el panel lateral en AN-1b se perderá la vista simultánea de tabla y estadísticas hasta disponer de una vista dividida.

## Seguimiento del PR #155

La corrida [42871053430](https://github.com/ruzer/freyalab/actions/runs/42871053430) del head `5712275` falló en macOS, Windows y Ubuntu en el mismo caso, en ambos intentos. Al buscar «análisis SQL», tanto el comando nuevo como «Análisis SQL y asistentes» coincidían. El primero aparecía antes y recibía el foco con Flecha abajo. El comando nuevo queda al final de la lista para conservar la prioridad de las coincidencias existentes. Su etiqueta y los términos de búsqueda siguen disponibles.

| Verificación | Resultado local en macOS Apple silicon |
|---|---|
| Rojo en `5712275` | El caso existente de `commands.spec.ts` falló en `toBeFocused()` después de Flecha abajo. |
| Verde sobre la base `f949c22` | El mismo caso, sin editar la prueba, y las seis pruebas de `analysis-tab.spec.ts` pasaron en 18,8 s sin reintentos. La paleta mantuvo el foco y la apertura del panel SQL existente, y abrió la nueva pestaña al buscar «describe». |
| Tipos y construcción | `npm run check` pasó con 0 errores y 0 avisos. `npm run build` pasó. |

Comando enfocado tras compilar:

```sh
FREYALAB_AN1_EVIDENCE=1 npx playwright test --project=shell --project=csv tests/e2e/commands.spec.ts tests/e2e/analysis-tab.spec.ts -g 'muestra bloquea edición y copia|AN-1a' --workers=1 --retries=0
```

Las capturas anteriores siguen mostrando la disposición. En este seguimiento se regeneraron localmente como parte de la prueba. Quedan pendientes los resultados de la CI sobre el nuevo head y la prueba manual con lector de pantalla.
