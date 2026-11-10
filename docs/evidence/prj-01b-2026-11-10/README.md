# Evidencia de PRJ-01b

Código verificado en `d099f10929444f6ec815f33a998f7ce35464c636`, sobre PRJ-01a `4ec75dc92afe2dfb6949003524b13cc0aecb4fbc`. Se usaron perfiles temporales y datos sintéticos en macOS 27.0.1 con Apple M2 Max, 12 núcleos lógicos, 32 GiB de memoria y Node 24.22.1. [Diseño original](../../stories/historia-prj01-proyecto-y-fuentes-diseno-para-codex.md)

| Comprobación | Rojo | Verde |
| --- | --- | --- |
| Huella y registro, `npx vitest run tests/project-sources.test.ts` | Faltaban los módulos de huella y registro. | Conserva nombres por posición, BOM, finales de línea, huellas anteriores y archivos originales. Cancela antes de escribir. Rechaza rutas externas sin permiso y omite directorios enlazados al buscar. |
| Protección, `npx vitest run tests/document-csv-view.test.ts` | Las operaciones directas carecían de la protección de proyectos. | La protección alcanza al documento abierto y al destino de otro archivo. |
| Interfaz, `npx playwright test --project=shell tests/e2e/project-source.spec.ts tests/e2e/project.spec.ts --retries=0` | En PRJ-01a no aparecía «Añadir fuente…». | 10 pasaron en 11,5 s al primer intento. Incluye registro por teclado, edición y guardado bloqueados, copia exacta, cambio externo, huella anterior, confirmación de reenlace y proyecto cerrado. |
| Suite unitaria, `npm test` | — | 2.669 pasaron en 16,91 s. Una prueba HTTP quedó omitida porque Pandoc local carece de ese soporte. |
| Tipos y compilación, `npm run check` y `npm run build` | — | Ambos pasaron. Svelte informó cero errores y advertencias. |

## Huella y cancelación

`node experiments/prj-01b/fingerprint.mjs` registra un CSV sintético real en Electron y mide los cuadros de la interfaz con `requestAnimationFrame`. El tiempo incluye confirmar el registro y guardar el manifiesto.

| Tamaño | Tiempo | Avisos de progreso | P99 y máximo entre cuadros | Cancelación |
| --- | ---: | ---: | ---: | --- |
| 1.073.741.824 bytes | 1.326,3 ms | 25 | 9,4 y 9,4 ms | A los 555.024.384 bytes. El manifiesto quedó idéntico. |
| 268.435.456 bytes | 819,2 ms, incluida la captura | 8 | 9,3 y 9,3 ms | A los 165.216.256 bytes. El manifiesto quedó idéntico. |

La huella del archivo de 1 GiB fue `a7ab5a987cbbf9e279333440f240966d266cde42544ca5717f3ca5a6445c304a`. El progreso llegó al total de bytes. La medición es local y los intervalos entre cuadros describen el renderizado durante la operación.

## Capturas de 1440 × 900

| Idioma | Claro | Oscuro |
| --- | --- | --- |
| Español | [Formato y encabezados](prj-01b-es-light-1440x900.png) | [Fuente registrada](prj-01b-es-dark-1440x900.png) |
| en-XA | [Formato y encabezados](prj-01b-en-XA-light-1440x900.png) | [Fuente registrada](prj-01b-en-XA-dark-1440x900.png) |

[Progreso del CSV de 256 MiB](prj-01b-progreso-256mib-1440x900.png)

## Decisiones y límites

- Un manifiesto con una ruta externa requiere selección explícita de ese archivo o que el documento ya esté abierto con autorización. El registro impide modificar el original desde FreyaLab. «Guardar como» comprueba el SHA-256 y crea un destino nuevo.
- La comprobación rápida usa tamaño, fecha y huellas de los primeros y últimos 64 KiB. Puede pasar por alto cambios intermedios si se conservan esos datos. El reenlace exige la huella completa, omite enlaces simbólicos y limita la búsqueda a 25.000 entradas o 4 GiB de lecturas candidatas.
- Se avisa desde el registro al superar 256 MiB o el ancho de análisis. El aviso por filas y celdas usa el recuento de la tabla cuando ya existe. Si el CSV no está abierto, comprobar el número exacto exigiría otra lectura completa. Se verificó que el motor rechaza 40.001 filas de 200 columnas, equivalentes a 8.000.200 celdas.
- Se comprobó «Guardar como» en Electron. Quedan por verificar manualmente un extracto de una fuente registrada y todo el recorrido con un lector de pantalla. Tampoco se ejecutó la suite E2E completa, la CI multiplataforma ni una medición de huella en Windows. La creación exclusiva requiere un volumen con soporte para enlaces duros.
