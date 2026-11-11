# TEN-1 · Tendencia lineal en la dispersión

Base inicial `a8dfc7f8b27871f3a7288cc8b3f536a583859c8e`. El [alcance y las siete respuestas ADR 0021](../../stories/ten-1-alcance-adr-0021.md) se registraron antes del código. La historia original se conserva intacta en el PR documental #165.

Desarrollo en macOS 27.0.1 arm64, Node.js v26.11.1 y las dependencias fijadas ya presentes. Las salidas de este bloque corresponden a Node 26; no se presentan como comprobaciones de Node 24 LTS. El cierre con Node 24.22.1 se registra por separado.

## Resultado del bloque

Una casilla añade la recta a la dispersión sin series. Los agregados de DuckDB se incorporan al `stats` de la consulta existente, antes del límite: no se abre otro trabajo SQL. Se conservan conversiones, exclusiones y filtros. Los metadatos de tendencia no se mezclan con las columnas de puntos. Sin la opción, las 67 referencias SQL anteriores siguen idénticas.

La línea discontinua y su marcador de leyenda comparten el color de texto, en ambos temas. La casilla nativa tiene etiqueta y motivo accesible al usar series. El bloque anuncia el resultado vigente, muestra cuatro cifras significativas y conserva los valores completos en el título/descripción. X constante y menos de tres pares explican la ausencia de línea. Y constante produce una recta horizontal con R² no aplicable; pendiente cero con Y variable utiliza una explicación neutral.

La procedencia se separa del alcance: «Fuente: archivo completo desde disco» no afirma que un filtro se ignore. Una muestra en el editor puede analizar el original completo; el bloque no declara que esa tendencia use solo la muestra. Se preserva el cartel anterior del gráfico.

JSON y contexto JSON del CSV contienen `trend: {slope, intercept, r2, r, n}` sin redondear. CSV conserva sus filas y formato estándar. Markdown incluye ecuación, medidas e interpretación completas; SVG/PNG reciben la línea y la ecuación del mismo render. Los presets anteriores conservan la opción ausente/desmarcada; la nueva opción booleana se valida y persiste en el esquema existente. No se añaden dependencias, canales, motores ni preferencias.

## Rojo y verde durante los bloques

Las copias de salida están en [logs](logs/); normalizan exclusivamente blancos al final de línea y un salto final. Los originales y las trazas completas de Electron se conservan intactos en las rutas `/private/tmp/ten1-*` citadas en sus salidas; las capturas finales de la leyenda están en esta carpeta. Son verificaciones de desarrollo, todavía separadas del cierre integral y de la CI del head final.

| Comprobación | Resultado observado |
| --- | --- |
| Fixture de cinco puntos antes del cambio | Rojo: faltaba `trend` |
| Núcleo SQL y baseline sin tendencia | Verde: cinco puntos, degenerados, exclusiones y 300 000 filas frente al oráculo completo |
| Presentación y exportación antes de conectarlas | Dos rojos: faltaban línea y objeto exportado |
| Filtros con rótulo de origen anterior | Rojo real; después conserva 5 pares, vista filtrada y rótulo «Fuente» |
| Marcador de leyenda | Dos rojos claro/oscuro; después línea y marcador coinciden, con contraste ≥3:1 |
| Errores nuevos con interfaz inglesa | Rojo del literal español; después usan el catálogo del idioma |
| Última tanda unitaria enfocada | 5 archivos, 115 casos verdes |
| Primera tanda Electron con permiso de ventana | 3 pasaron, 3 fallaron y 1 no se ejecutó: fallaron tres supuestos de las pruebas nuevas, detallados abajo |
| Segunda tanda Electron con permiso de ventana | 6 pasaron y 1 falló por mayúscula de un literal de la prueba de muestra; no se alteró el producto para corregirlo |
| Repetición del caso de 300 000 filas | 1/1 verde, 16,2 s; conserva muestra real del editor, recuento completo, procedencia y oráculo del JSON |
| Capturas tras corregir la leyenda | 2/2 verdes, 6,4 s; es/en-XA en claro/oscuro y 1280×720 |
| Unitarias completas previas a los dos últimos ajustes pequeños | 144 archivos, 2 705 pasaron y 1 omitida; Pandoc real ejecutado. El cierre final se registra aparte |

El fixture de cinco puntos coincide con `linearRegression`, `rSquared` y `sampleCorrelation` con tolerancia 1e-12. Para 300 000 filas se usa `x = i % 1000 - 500`, `y = 3x + 1 + ((17i % 23) - 11)/100`; el mismo oráculo examina todos los pares, mientras la recta dibujada conserva solo 2 000 puntos. La diferencia de R² respecto del ajuste de los puntos dibujados supera 1e-5; el resultado completo coincide a 1e-12. No se amplió la tolerancia para ocultar una diferencia.

Una primera calibración con X monótona obtuvo diferencia de pendiente de 6,43e-12 entre las acumulaciones DOUBLE de DuckDB y simple-statistics. Se eligió el fixture centrado para la comparación estricta. Un umbral auxiliar inicialmente supuesto de 1e-3 para distinguir el ajuste dibujado falló (diferencia real 1,31e-4); se fijó 1e-5, todavía separado ampliamente de la tolerancia numérica de 1e-12. Esta calibración no cambia el cálculo del producto.

Los tres supuestos de la primera tanda Electron fueron: un literal inventado del aviso de revisión, creer que superar dos millones de celdas siempre produce muestra (el motor prefiere modo grande) y un matcher numérico no serializable para una captura. Se usa ahora el aviso existente, un original UTF-16 válido que fuerza una muestra real por su límite de bytes de registro, y la geometría real. La gran celda UTF-16 cabe en el presupuesto UTF-8 del análisis; los 300 000 pares X/Y permanecen intactos. La comprobación posterior solo corrigió «Muestra» por la traducción exacta «Análisis de muestra».

## Restricciones del entorno y pendientes

El primer arranque de Electron terminó antes de probar el producto: 3 SIGABRT/EPERM y 4 casos no ejecutados. Con permiso de ventana se ejecutaron los recorridos. La primera suite unitaria completa también encontró EPERM al abrir servidores de prueba en 127.0.0.1: 2 archivos fallaron, 26 casos fallaron, 2 670 pasaron y 10 se omitieron al fallar la preparación. La repetición con acceso a esos servidores locales pasó; no se cambiaron las pruebas ni el producto para conseguirlo.

La única omisión de la repetición unitaria es la prueba de paquete exclusiva de Windows. Pandoc 3.12.1 real se ejecutó; su binario carece de HTTP, por lo que continúa pendiente medir ese aislamiento con otro binario, como declara la prueba anterior. No equivale a haber verificado E2E de Word.

Permanecen separados el cierre integral del SHA congelado, CI remota, otras plataformas, paquete/instalación y lector de pantalla manual. No se publicó, instaló ni actualizó FreyaLab.

## Cierre con Node 24 LTS

Tras el commit de producto `d0025f8`, se incorporó mecánicamente `main` `85760f2` (PR #165) en `9dbae3cb5bb1b56ac5564bd5045a121bb586abc4`. La historia TEN-1 conserva SHA-256 `f139e5a7dd9cb8472cae1398423f3e0ec99fd7b02b9a163b6892c6d556bf8b89`.

Con `PATH=/Users/ruzer/.npm/_npx/387698761821791d/node_modules/node/bin:$PATH`, cada salida de cierre comienza comprobando `node --version`: **v24.22.1**. `npm run check` terminó con 0 errores/avisos. `npm test` completo: **144 archivos, 2 707 casos verdes y 1 omitido, 16,08 s**, con Pandoc real. `npm run build` completó la construcción.

El fixture puro de cinco puntos se copió a una base aislada `a8dfc7f`, omitiendo solo las importaciones de helpers nuevos que ese caso no usa. Con Node 24 produjo el mismo rojo lógico: falta `trend`, sin cambiar el código base. No se repitieron las demás pruebas rojas de desarrollo con Node 24; sus salidas de Node 26 permanecen separadas.

Sobre la construcción actualizada, **14/14 E2E verdes en 1,4 min**, un worker y cero reintentos: los siete recorridos TEN-1 (cinco puntos, degenerados, filtros/series, respuesta tardía/cancelación/revisión, 300 000 filas y capturas es/en-XA) más siete regresiones existentes de seis tipos de gráfico, leyenda/teclado, exportación/revisiones, presets y resultados CSV/JSON/Markdown/IPC. El fixture de 300 000 filas conserva el oráculo completo incluso cuando el editor muestra solo 200 filas. No es una ejecución integral de todas las E2E.

Comando de la tanda E2E:

```sh
playwright test tests/e2e/chart-trend.spec.ts tests/e2e/charts.spec.ts \
  --project=csv \
  --grep 'TEN-1|seis gráficos calculan|gráficos visuales:|series visuales:|configuraciones: reinicio|exportar un gráfico rechaza|resultados exportados: interfaz|resultados exportados: filtros' \
  --workers=1 --retries=0 --max-failures=3
```

Las [salidas Node 24](logs/node24-e2e.log) y las capturas de esta carpeta corresponden al cierre con ese runtime. El [PNG real](trend-export.png) y el [SVG real](trend-export.svg) se copiaron del primer fixture después de exportarlos, antes de limpiar su perfil temporal; no se regeneraron para la documentación. La suite integral local permanece pendiente de la última integración coordinada con LIM-1. La CI se registrará en el PR sobre su head congelado.

## Capturas de la leyenda final

- [Español claro, 1440×900](ten1-es-light-1440x900.png)
- [Español oscuro, 1440×900](ten1-es-dark-1440x900.png)
- [en-XA claro, 1440×900](ten1-en-XA-light-1440x900.png)
- [en-XA oscuro, 1440×900](ten1-en-XA-dark-1440x900.png)
- [Español oscuro, 1280×720](ten1-es-dark-1280x720.png)
