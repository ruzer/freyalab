# TXT-01: conservar el encabezado rechazado

Fecha: 2026-10-29. Entorno local: macOS Apple silicon, Node.js 24. La corrección se preparó en el worktree independiente `txt-header-guard`, rama `codex/txt-01-encabezado-rechazado`, desde el head congelado `7488ef8` del PR #90. No modifica todavía ese head ni crea otro PR.

## Defecto y cambio mínimo

Al terminar la edición de un encabezado, el manejador de `blur` iniciaba `tableEdit` y eliminaba inmediatamente el borrador. Si la validación rechazaba un nombre de 10 001 caracteres, la tabla conservaba el encabezado original, pero el usuario perdía el nombre que intentaba corregir. Es un defecto heredado, no una regresión de APP-01.

El manejador ahora espera el resultado de la operación `edit` existente. Sólo elimina el borrador si se confirmó sin error y sigue siendo el mismo borrador, con el mismo valor. No modifica límites, interpretación CSV, guardado, IPC, dependencias ni mensajes visibles.

## Rojo y verde reales

La prueba fue registrada primero en `366d037` (`test(csv): conservar el borrador de encabezado rechazado`), sin cambiar `CsvTable.svelte`. Usa el límite real de 10 000 del validador Main; no simula el rechazo ni toca el portapapeles. Activa Texto con `button.click()` desde la evaluación de Playwright, equivalente al comando que no desplaza antes el foco, para ejercitar `flushEditing`.

Antes de comprobar el borrador exige que Main conserve los encabezados `ID,Nombre`, todas las celdas —incluidos `001`, el identificador largo y el campo multilínea—, el modo Tabla y el estado limpio; compara todos los bytes originales con `Buffer.equals`. Después exige que el input conserve sus 10 001 caracteres. En verde, corrige el mismo input a `Apellido`, vuelve a solicitar Texto, comprueba el diálogo de cambios y lo cancela: la tabla conserva el nuevo encabezado, queda modificada y el archivo original sigue idéntico.

| Comprobación | Resultado real |
| --- | --- |
| Build previo al arreglo: `npm run build` | Exit 0, sesión 50915. |
| Rojo: `npx playwright test tests/e2e/csv-text.spec.ts --grep 'el encabezado rechazado' --retries=0 --workers=1` | Exit 1, sesión 77744. Las comprobaciones de integridad previas pasaron; falló `toHaveValue(draft)` porque el input ya no existía, tras los 15 s normales de la aserción. |
| Build del arreglo: `npm run build` | Exit 0, sesión 17432. |
| Unitarias: `npx vitest run tests/table-engine.test.ts tests/table-structure.test.ts tests/document-csv-view.test.ts` | Exit 0, sesión 85757: 77/77, tres archivos, 2,15 s. |
| Verde: mismo comando E2E, sin retries | Exit 0, sesión 72354: 1/1, caso 739 ms, total 1,0 s. |

Los logs y el trace rojo se conservan en `/private/tmp/freyalab-lote2/evidence-csv/header-guard/`. Tras ambas sesiones se confirmó que no quedaban procesos Electron propios.

## Límites y cierre pendiente

Esto es una comprobación focal local. No se ejecutaron todavía `npm run check`, `npm test` completo, la suite E2E completa ni una nueva CI de cuatro plataformas sobre la integración final de este arreglo. El verde anterior de `7488ef8` es histórico y no califica el producto modificado. El coordinador incorporará esta corrección al mismo PR #90 y organizará su cierre antes de cambiar su head.

No se comprobó aquí el cierre de ventana o Salir del sistema, ni se modificó su comportamiento: corresponde al carril APP. Tampoco se añadieron pruebas de rendimiento ni nuevas funcionalidades tabulares.

## Segundo intento sin foco: hallazgo durante el cierre

La primera corrección conservaba el input rechazado, pero `flushEditing` sólo encontraba un encabezado si todavía era `document.activeElement`. Como el propio flush lo desenfoca, repetir Cambiar a Texto podía omitir el borrador y desmontarlo. Se canceló preventivamente la suite completa de `d8c096d` al encontrar esta ruta de integridad: sesión 94111, SIGINT limpio al runner identificado, exit 130, 191 pasadas, una interrumpida, 227 sin ejecutar, 4,4 min. No hubo fallos previos a la interrupción; el caso interrumpido no se presenta como un defecto. Su trace/resultados y log se conservaron antes de cualquier foco posterior.

`fb7a5d8` registró primero la repetición sin foco. El rojo 86203 terminó en modo Texto y falló al intentar corregir: su primera aserción inmediata todavía pudo ver un input transitorio. Se conservó ese fallo y `fed70de` afinó la sincronización del test, cerrando el aviso existente con «Cerrar aviso» y exigiendo un aviso nuevo tras el segundo intento. El rojo preciso 76922 falló con «Vista Texto» en lugar del rechazo, sin modificar el producto durante ambas reproducciones.

La corrección adicional sólo cambia el selector de `flushEditing`: usa la presencia de `editingHeader` y el input de encabezado existente, excluyendo los filtros de columna, independientemente del foco. Conserva el mismo `edit` y propagación de error.

| Comprobación adicional | Resultado real |
| --- | --- |
| Check de `d8c096d`, anterior al segundo arreglo | Exit 0, 0 errores y 0 avisos. No califica la fuente posterior. |
| `npm test` de `d8c096d`, primer intento restringido | Exit 1: 1440 pasadas y seis omitidas por fallo de preparación `listen EPERM 127.0.0.1` en Pandoc real. Fallo del entorno conservado. |
| Mismo `npm test` con permiso loopback, sin cambios | Exit 0, 1446/1446, 74 archivos, 12,68 s. Pandoc 3.12.1 real; ese binario no ofrece HTTP, por lo que la eficacia de ese control HTTP no se verificó. |
| Build tras el selector adicional | Exit 0, sesión 86345. |
| `npx playwright test tests/e2e/csv-text.spec.ts --retries=0 --workers=1` | Exit 0, sesión 34379: 16/16, 20,2 s, sin retries. Incluye dos rechazos, input desenfocado, corrección y cambio, celda, recuperación y valores/bytes preservados. |

El archivo E2E focal completo terminó antes de congelar el segundo arreglo; se verificaron cero procesos Electron propios. El cierre completo nuevo permanece pendiente hasta ejecutarlo sobre esta nueva fuente. No se transfieren los 191 casos parciales, las unitarias o el check de `d8c096d` a la combinación posterior.

Guardar y Cerrar pestaña con este encabezado se verificarán en el carril APP, que contiene la puerta compartida de acciones; no se incorporó esa puerta a TXT-01 ni se afirma que el selector por sí solo cubra esos comandos. Sin cambios de presupuestos, contratos, dependencias o cierre OS.
