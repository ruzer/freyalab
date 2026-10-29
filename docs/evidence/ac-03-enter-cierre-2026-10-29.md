# AC-03 · Enter en citas y cierre actual — 2026-10-29

## Resultado vigente

Fuente congelada: `0870c46dffae83f22be75a44007e0b58360cbc6d` (producto `68d620a`, más el helper de pruebas de consultas). La corrección no añade dependencias ni cambia el motor CSV. `package.json` y el lockfile son idénticos a main `a44eb89`.

| Comprobación ejecutada | Resultado real |
| --- | --- |
| `npm run check` | Salida 0; Svelte 0 errores/0 avisos y TypeScript 0 |
| `npm test`, completo incluido CSV | Salida 0; 1.481/1.481, 78 archivos, 13,64 s |
| `npm run test:e2e`, con Pandoc externo explícito | Salida 1; 407 pasan/1 falla, 16,1 min; sin omisiones ni reintentos |
| `npm run build`, posterior a E2E | Salida 0 |
| Huellas antes/después | 272 archivos de fuente/pruebas/configuración y 134 PNG sin cambios; también se conserva la fecha de los PNG |

El caso DOCX real y la asistencia de citas pasaron en la ejecución completa. La ejecución completa **no se declara verde**. El único fallo fue `charts.spec.ts:222`, al esperar el error de una expresión regular mientras mostraba «Preparando motor local».

## Rojo → verde de Enter

El mismo fallo de CI se reprodujo con el reloj `Date.now()` detenido en el renderer: tras mostrar la sugerencia, Enter insertaba un salto de línea. El componente instalado `@codemirror/autocomplete` 6.20.4 rechaza `acceptCompletion` durante sus 75 ms iniciales (`interactionDelay`).

- Rojo nativo 36164: salida 1 con el producto previo y el reloj detenido; se conserva la traza.
- Cambio `68d620a`: una opción existente, `interactionDelay: 0`, en la asistencia específica que sólo se activa después de `[@`.
- Verde 65060: el mismo test y reloj detenido, 1/1 en 1,9 s; temas claro/oscuro, deshacer y fuente intacta. No se añadió una espera artificial.
- Cierre actual: el caso volvió a pasar dentro de los 408 ejecutados.

## Contraste del único fallo del cierre

La traza completa se preservó **antes** de ejecutar focos posteriores, porque Playwright recrea `test-results`. El registro de energía del Mac muestra `Maintenance Sleep` desde 02:58:28 hasta `DarkWake` a las 03:03:37, 309 s. La espera final del test comenzó a las 02:58:29,691 y terminó a las 03:03:37,081: 307,390 s pese a declarar 15 s. Coincide con la suspensión del equipo; no se atribuye sin pruebas a WASM ni a un cambio de CSV.

| Contraste aislado, sin reintentos | Resultado |
| --- | --- |
| Main `a44eb89`, mismo caso sin modificar | 1/1; 5,4 s |
| Fuente actual `0870c46`, mismo caso sin modificar | 1/1; 5,3 s |

El primer filtro de selección del baseline no encontró pruebas; se conserva ese log como error de montaje y no se cuenta como prueba ejecutada. No se volvió a correr toda la suite para reemplazar el fallo. Estos dos focos **no equivalen** a una ejecución completa 408/408.

Crudos y huellas: carpeta durable local `recovery/a3-interaction-final-0870c46`, con log completo, ZIP/contexto del fallo, extracto literal observado de `pmset`, manifiesto y `closure.json`. Los rojos/verde de Enter están en `recovery/a3-citation-interaction-68d620a`.

## CI y límites

La CI del head remoto anterior `2111743` terminó fallida: Intel en tres pruebas funcionales heredadas de archivos grandes; Apple silicon, Windows y Linux en la asistencia de citas. Apple silicon registró además una intermitencia de portapapeles/rangos, pendiente. Pandoc aislado del mismo head sí pasó en Windows/Linux con el binario fijado 3.10.2. No se transfieren esos estados a `0870c46` ni al siguiente head documental.

Los cambios propuestos de presupuesto de tres pruebas funcionales siguen pendientes de autorización y no están aplicados. No se relajaron paridad, memoria de 1 GiB ni cancelación de 1 s. El helper `0870c46` sólo espera las cuatro consultas dentro del plazo exterior existente de 30 s; tiene cinco pruebas propias.

D6 mantiene su fuente medida `c642771`: PDF 1.035,248 ms y DOCX 672,210 ms, medianas de tres muestras; 50 páginas PDF y 38 medidas en LibreOffice. El cambio de Enter y el guardado normal no participan en ese flujo; no se afirma una medición nueva. El paquete local de seis recursos se ejecutó sobre el producto anterior identificado en AC-04; falta el paquete y CI de las cuatro plataformas del head final.

Word manual, instalación distribuida, lector de pantalla e IME físico siguen sin verificarse. LibreOffice es evidencia independiente de Word; los campos de índice requieren actualización por el lector. El Pandoc local 3.12.1 no tiene HTTP y no acredita el sandbox HTTP local.
