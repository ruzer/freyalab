# SIM-1a · Menú de columna: alcance y ADR 0021

Base actualizada mediante `git fetch origin main`: `fd4e2a46845de95d7f7274f52fbd26cb0f63fcbc`. Rama `codex/sim-1a-menu-columnas`, worktree aislado; no se modifica el checkout del propietario.

Contrato: [historia completa de SIM-1 en el SHA de PR #184](https://github.com/ruzer/freyalab/blob/51b5dc39eea4f4ff29446f7f6c46040b47bb7975/docs/stories/historia-sim1-simplificar-flujos-diseno-para-codex.md), sección SIM-1a y reglas comunes. SHA-256 leído: `767ade59a0c705f37eab2d8e3ad805a402f44250dfe999a83d1f139e3e4dc446`. No se duplica esa copia exacta. [SIM-1g ya tiene PR #184](https://github.com/ruzer/freyalab/pull/184): el orden de apertura g → a está satisfecho; no exige fusionar g para comenzar este bloque independiente.

## Cambio mínimo completo

El clic derecho en la cabecera, el botón ▾, Mayús+F10 y la tecla de menú presentan la misma lista para toda entrada `context.kind==='columns'`. El índice `context.column ?? context.headerColumn` sirve a la presentación; no cambia los destinos, marcas ni motivos de las acciones.

Se conservan las 20 acciones actuales: 19 IDs de `contextCommands` y el cálculo contextual. Dentro quedan 16 hojas, con seis bajo Limpiar; el principal incluye título con nombre de columna sin filas, separadores, orden de la historia y Eliminar columna al final en peligro. Transformar documento, Copiar como Markdown, Deshacer y Rehacer continúan alcanzables en los lugares existentes indicados por la historia. La barra actual se llama Limpiar datos; renombrarla y ampliar sus opciones pertenece a SIM-1b.

Se reutilizan los callbacks, `runCommand`, `disabledReason`, `controlHint`, los diálogos y el historial. Calcular a la derecha conserva `openCalculation(column+1,contextReturn)`, no se sustituye por el cálculo genérico. El submenú admite teclado, cierre por nivel, retorno de foco y posición a derecha o izquierda según el espacio; no mantiene scroll a 1280×720. Los textos nuevos usan el catálogo es/en y su en-XA existente.

**Contextos intencionalmente distintos:** con ID y N marcadas, clic derecho/teclado sobre ID conserva `headerColumn=0` y no fija `context.column`; ▾ conserva ambas marcas y fija `context.column=0`. `targetColumn` puede diferir; `emptyTarget` ya identifica ID en ambos. La unificación es del renderer/lista: no se restablecen marcas, no se amplían acciones ni se exige igualdad artificial de desactivados entre esos contextos. Se conservan openers y derivados actuales.

Fuera de alcance: otros menús y partes de SIM-1, motor CSV, IPC, guardado, confirmaciones, límites, dependencias, CI, plazos y retries. No se cambian fuentes ni valores del documento. La alineación general de SIM-1g no se reimplementa aquí.

## Siete respuestas ADR 0021

1. **¿Existe una herramienta?** CsvTable ya reúne las acciones y guardas. ContextMenu y CsvFileMenu aportan posición/foco/cierre de menús planos; Proyecto aporta separadores, peligro y desactivados accesibles. Ninguno ofrece un submenú terminado. Se reutilizan esos patrones sin instalar otra biblioteca ni construir un registro de órdenes.
2. **¿Qué método se reutiliza?** Cambio mínimo y TDD sobre el menú real: primero E2E roja de estructura, cuatro aperturas, alcance de acciones, datos y teclado; después el renderer. [APG de menús](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/) fija la navegación por nivel; las guardas y motivos siguen siendo los existentes.
3. **¿Cómo se integra?** Solo Svelte y los handlers tipados ya conectados a las acciones CSV. El submenú mantiene vivo el contexto hasta ejecutar la acción. No se añaden canales IPC, rutas, CLI, red ni ejecución de contenido.
4. **¿Madurez, seguridad y licencia?** Mismas versiones y licencias del lockfile y MIT del repositorio. Se mantienen validación de revisión/origen, muestras de solo lectura, protecciones del proyecto, límites y datos originales. Desactivar no se sustituye por permitir una acción; toda activación conserva su guard.
5. **¿Qué mantenimiento añade?** Solo presentación y estado local del hijo, sus teclas y posición. No se persiste configuración ni se cambia el modelo de selección. Los consumidores de ContextMenu se comprueban únicamente si la implementación necesita tocar ese componente compartido.
6. **¿Cuál es el pegamento mínimo?** Un render de columna para las dos formas de contexto, seis hojas agrupadas, cuatro salidas ya presentes, foco/posición del hijo y etiquetas del catálogo. Se mantienen los handlers especiales y el orden ejecutar → cerrar. No se migran filas, rango o paleta al menú de columna.
7. **¿Qué valor aporta código propio?** Reduce la altura y hace consistentes los accesos sin perder acciones ni modificar su alcance. Conectar las piezas existentes es menor y más fiel al contrato que introducir un sistema nuevo de menús.

## Prueba previa y equivalencias que se conservan

La fase inicial solo añade casos SIM-1a a `tests/e2e/column-menu.spec.ts`, sin cambiar producción ni migrar todavía las specs existentes. Se exige el mismo listado de raíz/hijo por los cuatro accesos, las 20 rutas alcanzables, teclado/retorno de foco/flip/sin scroll y conservación de filas, bytes y marcas. No se añaden grupos, plazos, retries ni fixtures de datos del usuario.

Después del rojo se migran selectores y rutas de las conductas vigentes, conservando datos, vistas previas, recuentos, confirmación, original, dirty e historial. No se identificó un caso entero que deba borrarse inicialmente. Cualquier caso eliminado se explicará con su sustitución observable según la historia.

`structural-context.spec.ts:48` contiene expresiones después de `//` en la misma línea que hoy no se ejecutan. Su eventual restauración al migrar se registrará como cobertura restaurada, no como aserciones ya ejercidas ni como verde anterior. Esa spec no se modifica antes de obtener el rojo de SIM-1a.

Estado al escribir este alcance: documentación previa a la interfaz. E2E roja, cambios de producción, capturas, suites completas y CI pendientes. Se ejecutarán las comprobaciones de CONTRIBUTING sobre el head correspondiente; no se trasladan verdes de g u otros SHA. Sin push, PR, fusión, publicación o instalación en esta fase.
