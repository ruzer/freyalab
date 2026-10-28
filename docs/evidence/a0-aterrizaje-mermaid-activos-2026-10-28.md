# A0 · Aterrizaje de Mermaid y activos

**Estado al congelar la implementación:** regresiones enfocadas y mediciones verificadas. El cierre completo local y la CI de este nuevo PR se ejecutan después de esta evidencia; no se reutiliza el verde de #81/#82 como si fuera del nuevo candidato.

Base `main` `33a5dfd`; se incorporó `4358d91` en el commit local `ddf078c`, que debe ser ancestro del main integrado junto con los commits de corrección. Ningún PR se fusiona automáticamente.

## Trazabilidad

| ID | Commit | Criterio y prueba |
| --- | --- | --- |
| R1 | `e3fa33c` | Configuración aislada hasta terminar render/parse; tres regresiones unitarias y dos carreras con Mermaid real, incluida caché. |
| R2 | `fadee0f` | Caché acotada a 64 claves tema:fuente, SVG válido reutilizado, errores no cacheados, cesión y generaciones. Siete unitarias y cinco estados con 5/40 bloques. |
| U1 | `1c8026e` | El error identifica la imagen, sin prefijo remoto; archivo y ruta original conservados. Política de bloqueo intacta. |
| U2 | `fed008e` | Resumen por documento con detalle persistente, teclado y cierre que devuelve foco. Guardar o cambiar de documento no pierde el aviso. |
| U3 | `6faef1f` | Capturas antiguas condicionadas por variables; comprobación de intentos de escritura, hashes y fechas de modificación. |

## R1: carrera real, sin cambiar la seguridad

El hueco entre initialize y render permitía que otra operación cambiara el tema. Se esperan las importaciones antes de entrar en la operación y la cola incluye initialize hasta completar render/parse: la cola interna de Mermaid no protege initialize. Se conservan securityLevel strict, htmlLabels false, DOMPurify y sus perfiles/atributos.

| Caso con Mermaid 12.2.0 real | Antes: contraste texto/blanco | Después | Caché clara |
| --- | --- | --- | --- |
| Render claro + render oscuro | 1,6059285649 | 12,6346543445 | Antes envenenada; después coincide con control serial claro |
| Render claro + validar oscuro | 1,6059285649 | 12,6346543445 | Antes envenenada; después coincide con control serial claro |

Aristas y flechas: 1,4969939561 antes y 12,6346543445 después. Dos casos parten de un renderer nuevo y comparan controles seriales con la misma geometría. El renderer está aislado, sin Node/preload ni recursos remotos. El ensayo final incluye R2 y su hash coincide con render.ts actual.

La firma coincide exactamente con el fallo Intel de mermaid-export-theme.spec.ts:164 y demuestra el mecanismo; no se inspeccionó el trace de esa ejecución histórica para atribuir cada evento. No se declara una ejecución futura libre de intermitencias antes de su CI.

## R2: respuesta del hilo y tiempo total

Se calentó el módulo Mermaid; cada conjunto tiene fuentes únicas por comentarios. Frío significa caché de diagramas/validaciones sin esa clave, no caché fría del disco. Una medición por fase, sin cargas pesadas simultáneas. Los resultados son de esta máquina, no garantías universales.

| Estado | Bloques | Pared antes (ms) | Pared después (ms) | Tarea larga máxima antes → después (ms) | Latidos después |
| --- | --- | ---: | ---: | --- | ---: |
| 5-cold | 5 | 64.9 | 71.7 | 65 → 0 | 2 |
| 5-paragraph-1 | 5 | 92.1 | 1.1 | 92 → 0 | 0 |
| 5-paragraph-2 | 5 | 87.2 | 0.7 | 87 → 0 | 0 |
| 5-dark-cold | 5 | 84.8 | 66.2 | 84 → 0 | 2 |
| 5-dark-paragraph | 5 | 83.2 | 0.8 | 83 → 0 | 0 |
| 40-cold | 40 | 447.1 | 642.8 | 447 → 0 | 48 |
| 40-paragraph-1 | 40 | 454.6 | 158.1 | 454 → 0 | 16 |
| 40-paragraph-2 | 40 | 462.8 | 157.3 | 462 → 0 | 15 |
| 40-dark-cold | 40 | 457.6 | 660.8 | 457 → 0 | 47 |
| 40-dark-paragraph | 40 | 457.1 | 160.7 | 457 → 0 | 16 |

La primera validación de 40 bloques tarda más de pared (447 → 643 ms), porque cede el hilo; los párrafos sin cambiar bloques bajan de unos 455–463 a 157–158 ms. No se afirma que todo sea más rápido. El comprobador de cesión falla antes (cero latidos) y aprueba los cinco estados de 40 bloques después. En estos ensayos no hubo tareas largas tras el cambio. Editar no publica el article oculto ni modifica los archivos sintéticos.

## Rojo → verde y montaje

- R1: tres aserciones de tema fallaban; después 3/3. El primer mock concurrente de DOMPurify produjo TypeError de montaje, conservado en los logs; se mantuvo la identidad de su factory real y se calentó el mock. El rojo funcional final tiene solo errores de tema, sin debilitar aserciones.
- R2: tres casos de caché fallaban y el ensayo de cesión de 40 bloques era rojo. Después siete unitarias y el comprobador de cesión verdes. R1+R2: 10/10.
- U1/U2: tres rojos de backend y dos de interfaz nativa. Backend final 41/41; el intento inicial de Electron restringido se conserva separado de los rojos funcionales.
- Focal de cinco specs: 42/43. El único fallo comparó el alias /var con /private/var; la prueba ahora compara la ruta con doc.path original, manteniendo comprobaciones del archivo y destino vacío. Focal posterior U1: 1/1, sin reintentos.
- Capturas optativas U1/U2: 2/2; se repitieron solo estos dos casos con animations disabled para fotografiar transiciones asentadas. Último resultado: 2/2, 2695,71 ms, sin omitidos/flaky/reintentos.
- El primer arranque del harness real falló por carga CJS del API Playwright; se usó el require de @playwright/test ya instalado. No fue un rojo del producto. Después los dos casos reales fallaron por contraste antes del arreglo y aprobaron después.

## Reproducción y comandos

Node 24 y las dependencias existentes del lockfile. Los datos detallados de versiones y hashes están en el JSON; los scripts reproducibles están en [experiments/mermaid-validation](../../experiments/mermaid-validation/README.md).

- Unitarias: `npm test -- tests/diagram-concurrency.test.ts tests/diagram-validation-cache.test.ts`.
- Interfaz: `npx playwright test tests/e2e/markdown-assets.spec.ts tests/e2e/mermaid-diagnostics.spec.ts tests/e2e/mermaid-expanded.spec.ts tests/e2e/mermaid-export-theme.spec.ts tests/e2e/preview-progressive.spec.ts --retries=0`.
- Capturas: `FREYALAB_A0_EVIDENCE=1 npx playwright test tests/e2e/markdown-assets.spec.ts --grep "U1 ·|U2 ·" --retries=0`.
- Antes de ejecutar E2E: `npm run build` de la misma fuente. La fase de medición usa el build correspondiente y verifica hashes de render.ts/Preview.svelte.

## Higiene y capturas

Sin variables, las cuatro capturas rastreadas antiguas conservan SHA y mtime anterior al inicio del focal. El stub de escritura pasó de dos sitios que intentaban escribir a cero; con optin sí se generan. FREYALAB_MER_EVIDENCE y FREYALAB_ASSET_EVIDENCE controlan las antiguas; FREYALAB_A0_EVIDENCE las siguientes.

- [Error claro](a0-error-activo-light-1440x900.png) · [oscuro](a0-error-activo-dark-1440x900.png).
- [Aviso claro](a0-avisos-activos-light-1440x900.png) · [oscuro](a0-avisos-activos-dark-1440x900.png).

Cuatro imágenes a 1440×900. Se inspeccionaron visualmente error claro y aviso oscuro; dimensiones y hashes verificados en las cuatro. Solo datos sintéticos.

## Cierre y límites

| Comprobación de cierre | Estado en esta captura de evidencia |
| --- | --- |
| npm run check | Pendiente sobre la fuente final congelada |
| npm test completo | Pendiente, incluye CSV |
| npm run test:e2e completo | Pendiente |
| npm run build | Builds enfocados correctos; cierre final pendiente |
| CI cuatro plataformas y paquete | Pendiente del nuevo PR; #81/#82 no la sustituyen |

El resultado posterior del cierre se registra en el cuerpo del PR y en los logs externos sin añadir commits cosméticos que invaliden la CI.

Dock Windows sigue abierto: el test hace una lectura nullable de boundingBox después de una aserción; el panel también depende del ancho medido. Es una observación estática, no una causa demostrada. No se reprodujo Windows localmente ni se cambió el test o la lógica. Los casos de dock pasaron en el cierre macOS de C1 sobre el mismo código, lo cual no prueba Windows.

Sin lector/IME/táctil físicos, impresora, instalador, Windows/Linux manual o caché fría. La política de activo propio ausente continúa bloqueando Guardar como. Sin dependencias nuevas, cambios de CI/licencias/permisos, ancho mínimo ni app instalada.

[Resultados compactos](a0-aterrizaje-mermaid-activos-2026-10-28.json). Raw, montajes fallidos y perfiles originales quedan fuera del repo en /private/tmp/freyalab-lote2/a0-ux-evidence/.
