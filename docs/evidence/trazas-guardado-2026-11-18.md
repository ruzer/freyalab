# Trazas reales de Electron para guardado H13/C2

Código validado: **`532c3ad869ed47dc0cab0a2df5cddd61242a42eb`**, desde main `23121eda41fb9380c533a25ef86723046b6d7639`. Node 24.22.1, macOS Apple silicon. [Alcance previo y siete respuestas ADR 0021](../stories/pruebas-trazas-guardado-alcance-adr-0021.md). Esta entrega mejora la observación; **no corrige ni identifica la causa de los fallos históricos de Windows**.

## Cambio mínimo

El tracing automático de Playwright Test no observa el contexto que crea esta aplicación Electron. Se añade un ayudante de 20 líneas con la API pública `BrowserContext.tracing` y dos consumidores:

- H13-2: posición, selección, sangría y finales de línea de md/txt/mmd/CSV Texto.
- C2: guardar conserva el historial y cambiar pestaña conserva el documento correcto.

La captura comienza al principio del caso, tras el lanzamiento existente. `afterEach` termina la captura antes de cerrar Electron: en `failed`, `timedOut` o `interrupted` guarda y adjunta `electron-context.zip`; al pasar lo descarta. Los errores de iniciar, terminar o adjuntar solo añaden una anotación, sin reemplazar el resultado original ni impedir el cierre existente.

No hay observadores de eventos, wrappers IPC, nuevas esperas, capturas explícitas en los casos públicos ni cambios de producto, guardado, configuración, dependencias, plazos, retries o cobertura.

## Rojo → verde y evidencia real

| Comprobación | Rojo previo | Resultado con el ayudante |
|---|---|---|
| Contrato público de tracing/adjuntos | **8/8 fallan** con ayudante vacío: no inicia, guarda, descarta ni anota | **8/8 pasan**, 104 ms |
| Persistencia ante permiso real rechazado | Calibración privada: directorio sintético 0555; el archivo original permanece intacto y falla el poll de bytes | **Sigue roja**, 16,3 s, en la misma aserción de persistencia de 15 s. No se oculta el fallo |
| Observación del error anterior | ZIP automático: **0 DOM / 0 fotogramas** | ZIP explícito: **26 DOM / 26 fotogramas**, aviso EACCES en el snapshot posterior al clic Guardar |
| Casos originales | Línea base de main: H13 **2,7 s**, C2 **2,5 s**, sin retry | Ambos archivos: **16/16**, 27,4 s, sin retry. H13 **3,0 s**, C2 **2,5 s** |
| Descarte de casos aprobados | Contrato unitario | **0 ZIP** en los resultados de los 16 casos aprobados |

La pareja de tiempos es una sola ejecución descriptiva en la misma Mac; no es un benchmark ni una garantía de coste. No se repitieron los dos casos aparte de su ejecución dentro de los archivos completos.

La calibración usa un rechazo real del sistema de archivos y el handler de guardado existente. No fabrica respuestas ni errores IPC. Después de editar la tarea sintética se impide crear su temporal atómico mediante permisos 0555. Los permisos se restauran antes de limpiar. La aserción original exige `- [x] Primera\n` en disco y recibe `- [ ] Primera\n`.

En la traza, `yyiq@56` es el clic real en Guardar. Su snapshot `after` contiene el aviso `EACCES: permission denied, open '<fixture>/.tareas.md.<uuid>.tmp'`, antes de esperar explícitamente ese aviso. El ZIP adjunto es idéntico al generado, su CRC es correcto y las anotaciones del informe están vacías. No fue necesario añadir consultas o esperas a los escenarios públicos para capturar el aviso.

| Artefacto privado original | Bytes | SHA-256 | Snapshots / fotogramas |
|---|---:|---|---:|
| `electron-context.zip` | 579.485 | `da9c71806262969d10753151f5532060185ba80d6760c1d7e7b4f0900e8aac02` | 26 / 26 |
| `trace.zip` automático | 583.747 | `6aa4bb8ca44c5bc1f5ad60b9fc67d144ffd27f5650a674f18dc5367891ed1c4e` | 0 / 0 |

Los ZIP y PNG de calibración contienen rutas de trabajo y temporales locales y se mantienen privados. Se publican solo [contadores, hashes y extracto normalizado](trazas-guardado-2026-11-18/calibracion.json), [salida roja curada](trazas-guardado-2026-11-18/calibracion-roja.txt) y [manifiesto de procedencia](trazas-guardado-2026-11-18/manifest.json). La sonda no entra en el `testDir` público.

## Cobertura conservada

[Inventario de identidades](trazas-guardado-2026-11-18/identidades.json): **16 → 16**, mismo proyecto, archivo y título. La comparación omite solo los números de línea desplazados por los hooks; no cambia títulos, etiquetas, proyectos ni segmentación.

[Inventario AST de llamadas `expect` y `expect.poll`](trazas-guardado-2026-11-18/aserciones.json): editor-status **34 → 34**, hash `64a2eb7de87f75593193f355dc378fdc174d5b3508071621d245cd658aee13b7`; markdown-tasks **200 → 200**, hash `e936274ee6b53453c1d57ac8406a0858268f021f7d775016647902f1f3d359f2`. Todas son idénticas antes y después; no se borra ni relaja ninguna aserción.

El mapa de áreas existente clasifica las dos specs como Markdown y el helper nuevo como no clasificado; activa **full=true**, shell+md+csv y paquete por la compuerta conservadora. No se modifica el mapa ni el workflow para reducir esa cobertura.

## Comandos y resultados

Ejecutados sobre el código indicado, sin GUI concurrente durante las mediciones. Las GUI las ejecutó exclusivamente raíz.

| Comando | Resultado real |
|---|---|
| `npx vitest run tests/electron-trace.test.ts` antes del cambio | 8 fallan; [rojo](trazas-guardado-2026-11-18/unitarias-rojas.txt) |
| Mismo comando con implementación | 8 pasan; [verde](trazas-guardado-2026-11-18/unitarias-enfocadas.txt) |
| `npm run check` | 0 errores / 0 avisos; [salida](trazas-guardado-2026-11-18/check.txt) |
| `npx tsc --ignoreConfig --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler tests/e2e/electron-trace.ts tests/electron-trace.test.ts` | Correcto, sin diagnósticos |
| `npm test` completo, incluido CSV | **2.969 pasan / 1 omitida**, 166 archivos, 21,64 s; [salida](trazas-guardado-2026-11-18/unitarias-completas.txt) |
| `npm run build` | Correcto; [cierre del build](trazas-guardado-2026-11-18/build-resumen.txt) |
| `npx playwright test tests/e2e/editor-status.spec.ts tests/e2e/markdown-tasks.spec.ts --project=md --workers=1 --retries=0 --output=../guardar-trazas-evidence/focused-results` | **16 pasan**, 27,4 s; [salida](trazas-guardado-2026-11-18/e2e-enfocadas.txt) |
| `npx playwright test --config=../guardar-trazas-evidence/calibration.config.ts --workers=1 --retries=0` (configuración privada) | **1 fallo deliberado de persistencia**, 16,3 s; el reporter lo registra `unexpected=1` (sin `test.fails`). ZIP real adjunto y ninguna anotación de error de captura |
| `playwright test … --list` antes/después | 16 mismas identidades |
| `git diff --name-only -z 23121ed...HEAD \| node scripts/ci-areas.mjs --stdin` | full conservador; helper no clasificado |

La única omisión unitaria local es la prueba exclusiva de Windows en `tests/package-smoke.test.ts`. Por separado, Pandoc local 3.12.1 no tiene HTTP y la eficacia de ese sandbox queda pendiente con otro binario; esa rama retorna normalmente y no cuenta como skip.

## Pendiente y lo no verificado

- CI del head que se publique: pendiente. No se atribuye el verde de otro SHA. No se ha autorizado publicar esta preparación al documentar estos resultados.
- H13 (LF solicitado y disco con CRLF en Windows) y C2 (casilla nueva en memoria y bytes previos en Windows) siguen sin causa reproducida. La calibración EACCES en Mac **no demuestra EACCES en Windows** ni Undo tardío.
- El ZIP observa DOM y fotogramas; no registra entrada/salida de IPC principal. Un fallo silencioso aún puede dejar desconocido su motivo.
- No se verificó esta captura en Windows, Linux o Intel, ni el empaquetado/instalador o la suite E2E completa local. No se promete impacto de rendimiento a partir de una muestra.
- No se cambia ninguna rama pública existente, no se fusiona, publica versión ni actualiza la aplicación instalada.
