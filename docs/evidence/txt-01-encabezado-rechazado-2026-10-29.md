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
