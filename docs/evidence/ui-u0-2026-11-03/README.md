# U0 · Base de diseño y botones · 2026-11-03

## Alcance y trazabilidad

Solo U0. Base `402151adb8d014e63e3a4cff66f50586b0e57249`, con #108 fusionado. Implementación inicial `7849f59`; correcciones hasta **`f260e090902fa54ea5cd8c81a5bd8fd2817bc289`**. Worktree independiente `/private/tmp/freyalab-ui-u0-base`, rama `codex/ui-u0-base`, [PR #109 en borrador](https://github.com/ruzer/freyalab/pull/109). No se modifica el checkout del propietario, LAB ni el trabajo de otras sesiones. Sin fusión, release ni instalación.

El alcance y las siete respuestas del ADR 0021 se publicaron con `bc0cd53`, antes de escribir interfaz. Se preservan el [contrato](../../stories/ui-u0-u2-diseno.md) y la [referencia visual](../../design/freyalab-ui-kit-propuesta.html) sin editar ni incorporar sus manejadores al producto.

| Referencia | SHA-256 |
| --- | --- |
| HTML del UI kit | `25cf2090aa96ae3602802c7adbedd7924a968e9e4811547ad7c6f0ee46eac058` |
| Documento completo de diseño | `a331e169b9712fb9fda01da7b35bc1f31d214d9db5751249bf06cf43855db376` |

## Resultado y decisiones del propietario

- Tokens y clases CSS sobre los botones nativos actuales: primario, secundario por omisión, suave, fantasma y peligro. Sin componente Button, observador DOM ni biblioteca nueva. Se conservan componentes, acciones, permisos y atajos.
- El azul aprobado está en un solo lugar, `--accent:#2563eb`, en `:root`. El oscuro existente #308bff se conserva con texto #0b1220. Se miden los fondos reales, no solo blanco.
- **Guardar primario** con cambios o documento nuevo sin nombre. Guardado: **Exportar primario**, Guardar secundario deshabilitado con motivo. Si ambas acciones no están admitidas, **Abrir primario**. No se habilitan exportaciones antes no admitidas en Texto, CSV Texto o solo lectura.
- Durante Guardar se conserva la variante, aparece spinner de12 px y aria-busy; Exportar no alterna hasta terminar. Nombres accesibles y cajas estables en ambos temas. La indisponibilidad temporal durante esa operación es la excepción explícita del propietario.
- **Decisión sobre la contradicción de §2.2:** conservar celdas11 px y CodeMirror13 px, con JetBrains Mono. Controles/etiquetas de interfaz13 px y metadatos al menos11 px. Inter no se sustituye. [Medición anterior](logs/fonts-before.json), [posterior](logs/fonts-after.json).
- `controlHint()` reutiliza i18n para title y descripciones compartidas. Conserva títulos/atajos; los controles de solo icono reciben nombre y tooltip. La disponibilidad original no se reimplementa. `saving` es estado de presentación, limpiado en finally: no cambia escritura, recuperación ni contratos de guardado/IPC.
- Se conserva el espacio de la tabla: el divisor mide1 px visual y ofrece25 px reales de puntero, comprobados con elementFromPoint. No se cambian límites ni decisiones de workspace-layout. Campos, zonas, total, paginación y Más opciones conservan sus pruebas geométricas.

## TDD y hallazgos corregidos

| Comprobación | Rojo real | Corrección y verificación |
| --- | --- | --- |
| Acento sobre blanco | #007aff daba4,016975780478911; [salida](logs/tokens-red.txt) | #2563eb da5,168556; token único |
| Pares del CSS | [Tokens ausentes](logs/palette-red.txt) | 48 pruebas unitarias de colores; [verde](logs/heatmap-green.txt) |
| Verde CSV sobre panel | #15803d/#f2f2f7 daba4,49478296; [salida](logs/csv-kind-red.txt) | #157d3c; ratio exacto en el registro independiente |
| Borde dentro del chip | Claro2,7786 y oscuro2,9553; [claro](logs/polish-e2e.txt), [oscuro](logs/focused-final.txt) | --control #7b8291 / #70788a, sin relajar el test existente |
| Texto atenuado sobre hover | #6e6e7a/#e7e7ee daba4,087476 | #666672 da4,601005; caso persistente |
| Prioridad y progreso | [Rojo de la barra anterior](logs/priority-red.txt) | Limpio, modificado, nuevo, guardando y Texto, en claro/oscuro |
| Motivos de indisponibilidad | [Rojo](logs/reasons-red.txt) | title y descripción accesible en botones visibles |
| Superficies secundarias | [La barra les aplicaba fantasma](logs/secondary-red.txt) | Guardar/Exportar secundarios usan --input y --control; [verde](logs/palette-final.txt) |
| Estado activo Markdown | [La regla fantasma ocultaba el fondo](logs/active-red.txt) | Se excluyen estados activos; [47 casos conjuntos](logs/complete-focus.txt) |
| Más opciones | [Resumen recortado](logs/options-red.txt) | Se reserva su espacio y mantiene la tabla con scroll propio; no se eliminan controles |
| Divisor | [El mínimo global lo ensanchaba a24 px](logs/divider-red.txt) | Visual1 px/hitbox25 px; [13 casos](logs/divider-green.txt), sin perder filas ni columnas |
| Ayuda y carga | [Popover encima del control y en-XA necesitaba126,24 px donde había50,65 px](logs/last-states-red.txt) | Anclaje100% y ancho intrínseco; [10 casos](logs/last-states-green.txt), incluida exportación real de55 MiB; [anchos por idioma](logs/loading-labels.json) |
| Mapa de calor | Nuevo acento con negro daba4,0630307164403066; [rojo](logs/heatmap-red.txt) | Escala clara independiente del acento de acciones, #dfe8f7→#3b82f6, texto negro. Solo presentación: ningún cambio SQL/datos; [caso original aprobado](logs/palette-final.txt) |
| Validación de columnas | La descripción oculta duplicaba exactamente el mensaje del formulario; [integral anterior](logs/final-560.txt) | Motivo compartido más explícito, sin cambiar el mensaje ni las aserciones originales; [verde](logs/palette-final.txt) |

El comprobador independiente de colores del paquete Data se ejecutó localmente, sin integrarlo como dependencia: [48 pares con ratios sin redondear](logs/contrast-data-validator.json), todos válidos. Los colores de sintaxis/documento y la hoja de exportación no se rediseñan en U0.

## Adaptaciones de pruebas existentes

Se conservan todos los oráculos, plazos, archivos y casos. [Comparación del listado](logs/e2e-list-diff.json): **551 existentes +9 nuevos =560**, ninguna pérdida ni traslado de los existentes. La nueva spec está en shell; el caso de más50 MiB conserva la etiqueta de límite de tamaño.

- I5/I6 espera `Export` cuando el idioma es inglés: se eliminó el literal español de ese botón.
- Los dos specs de exportación Mermaid usan el nombre accesible estable y aria-busy. Se conservan clics DOM sin esperas, carreras, plazos y aserciones de bloqueo/cancelación. [Rojo](logs/export-selector-red.txt), [comprobación](logs/export-selector-green.txt), [cambio de tema](logs/export-theme-green.txt).
- El test de iconos edita antes de Guardar, conserva aviso e iconos y añade igualdad exacta del archivo escrito. [Verificación](logs/icons-green.txt).
- Los casos que necesitan guardar una fuente limpia usan el menú existente `file.save`, después de comprobar que el botón está deshabilitado; esperan el aviso de guardado. Se mantienen bytes, imágenes, identidad del DOM, YAML, etiquetas, orden y selección. [34 casos enfocados](logs/save-menu-green.txt). El menú no acredita un acelerador físico.
- La comprobación visual de Reemplazar espera el fondo transparente de fantasma y también el color de texto oscuro. Conserva teclado, coincidencias, contenido hostil, filtros, documentos, recuperaciones y archivo original. [Caso aprobado](logs/palette-final.txt).

## Comandos y resultados previos a congelar el head

Equipo: macOS27.0.1 Apple silicon arm64, Node24.22.1, Pandoc3.12.1. Son mediciones locales, no garantías para otras máquinas.

| Comando | Fuente y resultado real |
| --- | --- |
| `npm run check` | f260e09: 0 errores, 0 advertencias; [salida](logs/final-check.txt) |
| `FREYALAB_PANDOC_TEST_PATH=/opt/homebrew/bin/pandoc npm test` | f260e09: 123 archivos, 2.450 pruebas aprobadas; [salida](logs/final-unit.txt) |
| `npm run build` | f260e09: correcto; conserva advertencias de importaciones dinámicas ya existentes; [salida](logs/final-build.txt) |
| `FREYALAB_PANDOC_TEST_PATH=/opt/homebrew/bin/pandoc npm run test:e2e -- --retries=0` | ad00f8b: integral de560 casos, 557 aprobados y3 fallos nuevos; [salida completa](logs/final-560.txt). No se declara verde ni se transfiere su resultado al head final |
| `npm run test:e2e -- tests/e2e/ui-u0.spec.ts tests/e2e/csv-summary.spec.ts tests/e2e/extract.spec.ts tests/e2e/search.spec.ts --grep 'U0:|series sin depender|elegir columnas reescribe|buscar CSV: teclado' --retries=0` | Árbol incorporado en f260e09: 12/12 aprobados, incluidos los3 fallos corregidos; [salida](logs/palette-final.txt) |

Los fallos esperados de SEG-S2e siguen ejecutándose; no son una omisión ni una corrección de U0. Las corridas de desarrollo interrumpidas y sus fallos no acreditan cierre. No se aumentaron plazos o reintentos ni se cambiaron workflows.

**Calificación del head congelado:** después de preservar esta evidencia, la integral local y la CI del mismo head se registran en la [descripción de #109](https://github.com/ruzer/freyalab/pull/109) y sus ejecuciones públicas, sin crear commits solo para actualizar estados. El verde de otra fuente no se transfiere. La entrega no se declara lista si un check obligatorio falta o falla.

## Capturas y registro de diseño

[before/](before/): 28 capturas previas, siete estados ×1440×900/1280×720 ×claro/oscuro. [after/](after/): las28 equivalentes del árbol final y cuatro adicionales en inglés/en-XA a1280×720.

Estados: bienvenida vacía, Markdown, CSV, Resumen y gráfico, Ajustes, búsqueda sin resultados y Guardar en curso. Este último retiene el diálogo público de Electron desde la prueba: no se falsifica el DOM ni se añade un gancho al producto. Se comprueban los originales sintéticos sin modificaciones. La carga U0 muestra spinner/aria-busy; no acredita el componente de progreso de U1.

[Registro ECC](design-evidence.json) validado con su script check-evidence.js: completo. [Salida](logs/design-evidence-check.txt). El script comprueba existencia y estructura, no sustituye inspección visual. Se inspeccionaron renderizadas capturas seleccionadas de bienvenida, Markdown, Ajustes y Resumen; cajas, estado y contraste tienen pruebas automatizadas. No se afirma inspección manual de cada píxel.

## No verificado y fuera de alcance

- Sin revisión visual manual en Windows/Linux, lector de pantalla físico, macOS Intel o instalación local del paquete. La emulación Chromium de forced-colors no equivale a Windows High Contrast en un equipo real.
- Pandoc local no incluye soporte HTTP: no se acredita su sandbox HTTP; la suite conserva el aviso correspondiente.
- La CI de PR comprueba Linux, Windows y macOS ARM. Intel corre en main/nocturna según la política vigente; su ausencia no acredita esa plataforma. Build, ejecución del paquete e instalación son comprobaciones diferentes.
- U1 (progreso común, buscadores/placeholders/vacíos), U2 (navegación), U3 (vidrio), F2c y conversión de montos siguen pendientes. Los progress existentes se conservan. Sin dependencias, licencias, red de producto, contratos IPC/guardado, motor, límites ni cambios del archivo original.
- Se aplicaron Ponytail, TDD, ECC frontend-design-direction/accessibility/e2e-testing y Data visualize-data con su comprobador local de contraste. No se encontró skill específica de Svelte ni servicio conectado de color. Sin subagentes ni auditoría nueva del ecosistema.
