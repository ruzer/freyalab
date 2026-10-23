# Espacio de trabajo flexible: evidencia del cierre arquitectónico

**Fecha:** 23 de octubre de 2026 · **Base:** `main` en `bd09caa` · **Rama:** `codex/flexible-workspace-design`
**Entorno:** macOS, Node 24 (mise), Electron 44.9.2, aplicación construida con `npm run build` desde `main`.
**Alcance:** solo documentación y experimentos. No cambia `src/`, dependencias, IPC, interfaz ni CI. No se fusionó ningún PR, no se publicó ninguna versión y no se tocó la aplicación instalada.

## Archivos

| Archivo | Contenido |
|---|---|
| [`docs/design/FLEXIBLE-WORKSPACE.md`](../design/FLEXIBLE-WORKSPACE.md) | Diseño: decisiones, contrato IPC, estados, concurrencia, persistencia, UX, riesgos, criterios, hoja de ruta |
| [`flexible-workspace-concurrency-2026-10-23.json`](flexible-workspace-concurrency-2026-10-23.json) | S1–S4 (reproducción) y M1–M4 (mediciones) sobre la aplicación real |
| [`flexible-workspace-spike-2026-10-23.json`](flexible-workspace-spike-2026-10-23.json) | Resultados del spike aislado |
| [`experiments/flexible-workspace/`](../../experiments/flexible-workspace/README.md) | Código y pruebas, con instrucciones para repetirlo |

## Comprobaciones realizadas

| Comprobación | Resultado |
|---|---|
| `concurrency.spec.ts` (aplicación real) | 8/8: S1–S4 reproducen la cancelación entre consumidores; M1–M4 miden |
| `spike.spec.ts` | 11/11, y 33/33 en tres repeticiones seguidas |
| `tsc -p experiments/flexible-workspace/tsconfig.json --noEmit` | Sin errores |
| `npm test` y `npm run test:e2e` | No incluyen `experiments/` (vitest: `tests/**`; Playwright: `tests/e2e`) |

## Reproducción del defecto (aplicación real)

| Caso | Observado |
|---|---|
| S1 | Con A en curso, llega B: A falla con «Análisis cancelado.»; B se completa |
| S2 | El resultado paginable de A deja de estar disponible cuando empieza otra consulta |
| S3 | «Generar gráfico» y «Exportar resultados» se cancelan entre sí, en ambos órdenes |
| S4 | Cancelar con un identificador viejo no afecta a la consulta nueva |

Causa: un único hueco `job` en `SqlService` y `run()` que llama a `stop()` (detalle y líneas en el diseño, §2).

## Mediciones y su fiabilidad

- **Estables entre corridas:** ancho mínimo del panel sin desplazamiento del gráfico (520 px; 480 desplaza), columnas visibles con un dock (M3), alto del gráfico (340 px).
- **Con variación entre corridas:** tiempos (consulta de 240 filas 555–583 ms; de 100 000 filas 875–927 ms; gráfico 852–879 ms) y memoria del motor (+393 a +396 MiB). Se citan como orden de magnitud con el rango observado.
- **Ruidosa:** el conjunto de trabajo de una segunda ventana (M4: +15, +165 y +168 MiB en tres muestras). No sirve de umbral; debe medirse con memoria privada por proceso en F4.
- **Del spike (motor simulado):** apertura 160–181 ms, recuperación tras caída del renderer 190–240 ms, salida de la aplicación 48–55 ms.
- **Procedentes de la auditoría, no repetidas aquí:** filas visibles por tamaño de ventana con Gráficos o Estadísticas abiertos (serie de mediciones de [`docs/audit/exploration/`](../audit/exploration/)).

## Hallazgo del spike

Con la creación del motor asíncrona, cancelar o salir mientras el motor aún carga lo deja huérfano y la aplicación no termina en 30 s. Con el motor registrado de forma síncrona y la carga dentro de la ejecución, la salida tarda decenas de milisegundos. Quedó cubierto por la prueba de cierre con una consulta en curso.

## No validado

Interfaz real de las tres modalidades con personas; DuckDB real dentro de la cola; segundo monitor físico, Windows y Linux; empaquetado de la página secundaria con los componentes reales; traslado del estado de `CsvTable.svelte` a `main`; todos los umbrales marcados como propuesta o valor de prueba.
