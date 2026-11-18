# SIM-1g · Menús alineados a la izquierda

Fecha: 2026-11-18. Base `main fd4e2a46845de95d7f7274f52fbd26cb0f63fcbc`, después de la fusión de #180 por el propietario. Validación local en macOS 27.0.1, arm64, Node 24.22.1. Fixture CSV sintético de dos filas; sus bytes y el estado sin cambios se conservan.

## Alcance y decisión

La alineación que ya tenía `ContextMenu` se comparte con `.dropdown`, `.range-context` y los elementos de `role="menu"`, incluidos los títulos. Una regla global sustituye la regla aislada de ContextMenu. Sus estilos de desactivación se conservan. No cambian roles, handlers, orden, iconos, padding, foco, acciones, datos ni contratos.

**Decisión del propietario del 2026-11-18:** conservar los iconos y medir el bloque visual completo. El umbral de 12 px corresponde al comienzo de icono + texto cuando hay icono, y a los glifos cuando no lo hay. La prueba usa DOM Range real; no comprueba solo una declaración CSS ni descuenta la separación observada.

Historia copiada sin cambios: [SIM-1](../stories/historia-sim1-simplificar-flujos-diseno-para-codex.md), SHA-256 `767ade59a0c705f37eab2d8e3ad805a402f44250dfe999a83d1f139e3e4dc446`. [Alcance y siete respuestas ADR 0021](../stories/sim-1g-alcance-adr-0021.md).

## Rojo → verde

| Comprobación | Antes, DOM Range | Después, mismo test |
|---|---|---|
| Nuevo, con iconos | 26,546875–64,8828125 px | 10 px |
| Menú de columna | −91,375–59,0703125 px, según idioma y texto | 7 px |
| Títulos de grupo | 7 px | 7 px |
| Archivos, reutiliza ContextMenu | 7 px; roles, End/Escape y foco correctos | 7 px; se conserva la misma conducta sin la regla local |

La segunda ejecución roja completó **los ocho escenarios y sus ocho capturas**; las dos pruebas fallaron solo por la geometría de Nuevo y Columna. [Log rojo curado](sim1g-rojo-2026-11-18.txt) y [mediciones](sim1g-rojo-geometria-2026-11-18.json).

La primera ejecución también detectó un fallo del montaje: `FREYALAB_TEST_FOLDER` prepara el selector, pero no abre la carpeta al iniciar. El test intentó encontrar el archivo sin abrir su carpeta. Se corrigió el montaje usando «Abrir carpeta» y esperando al archivo del árbol, antes de repetir el rojo. Ese fallo no se atribuye al producto ni se cuenta como una captura de escenario completado.

Después: **17/17 E2E enfocadas aprobadas en 26,1 s, sin reintentos**, incluidos los menús estructurales y Proyecto. [Log verde curado](sim1g-verde-2026-11-18.txt) y [mediciones](sim1g-verde-geometria-2026-11-18.json). El SHA-256 del test geométrico es idéntico en rojo y verde.

## Comandos y resultados reales

Todos los comandos de validación usan Node 24.22.1. La app de cada ejecución corresponde al build actualizado. Las E2E y las capturas las ejecutó la coordinación de la GUI; el cambio no añade un gancho al producto.

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit -p tsconfig.node.json` antes de cambiar CSS | Correcto |
| `npx playwright test tests/e2e/menu-alignment.spec.ts --project=shell --list` | 2 pruebas nuevas en Shell |
| `npm run build` antes del rojo, Node 24 | Correcto |
| `FREYALAB_SIM1G_PHASE=before FREYALAB_SIM1G_EVIDENCE=docs/evidence npx playwright test tests/e2e/menu-alignment.spec.ts --project=shell --workers=1 --retries=0 --max-failures=0` | Rojo completo: 2 fallos geométricos esperados, 8 capturas |
| `npm run check` | Correcto; 0 errores y 0 advertencias Svelte |
| `npm test` completo, incluido CSV | 164 archivos aprobados; 2.953 pruebas aprobadas, 1 omitida; 16,96 s |
| `npm run build` después de cambiar CSS | Correcto |
| `FREYALAB_SIM1G_PHASE=after FREYALAB_SIM1G_EVIDENCE=docs/evidence npx playwright test tests/e2e/menu-alignment.spec.ts tests/e2e/structural-context.spec.ts tests/e2e/project-tree.spec.ts --project=shell --project=csv --workers=1 --retries=0 --max-failures=0` | 17 aprobadas, 0 reintentos; 26,1 s |
| Verificación de grupos y mapa de áreas con las fuentes reales | 76 specs existentes idénticas; ninguna movida; nueva spec solo Shell. Cambio compartido: Shell, Markdown, CSV y paquete |
| `git diff --check` | Correcto |

La única unitaria omitida en macOS es la comprobación específica de Windows «un hijo sobreviviente al timeout bloquea el paquete hasta cerrarlo», de `package-smoke.test.ts` (`skipIf(process.platform !== 'win32')`). No se presenta como aprobada.

Se añaden **dos pruebas E2E**, una por idioma; ninguna se borra ni se debilita. Los 76 archivos de specs anteriores son idénticos byte a byte a la base; sus proyectos conservan la asignación. `groups.ts` solo registra el archivo nuevo en Shell. El mapa real lo clasifica como Shell; para este cambio compartido conserva `full:true`. El workflow existente publica el gate del paquete como `package || full`. [Verificación del mapa](sim1g-grupos-ci-2026-11-18.json). No se modifica ningún workflow.

## Capturas

Cada captura muestra juntos Nuevo y el menú de columna. Las ocho combinaciones incluyen ambos idiomas, ambos temas y ambos tamaños. Las esperas comprueban fuentes listas, tamaño real de viewport y color aplicado del tema.

| Idioma | Tema | Tamaño | Antes | Después |
| es | light | 1440×900 | [Antes](sim1g-before-es-light-1440x900.png) | [Después](sim1g-after-es-light-1440x900.png) |
| es | light | 1280×720 | [Antes](sim1g-before-es-light-1280x720.png) | [Después](sim1g-after-es-light-1280x720.png) |
| es | dark | 1440×900 | [Antes](sim1g-before-es-dark-1440x900.png) | [Después](sim1g-after-es-dark-1440x900.png) |
| es | dark | 1280×720 | [Antes](sim1g-before-es-dark-1280x720.png) | [Después](sim1g-after-es-dark-1280x720.png) |
| en-XA | light | 1440×900 | [Antes](sim1g-before-en-XA-light-1440x900.png) | [Después](sim1g-after-en-XA-light-1440x900.png) |
| en-XA | light | 1280×720 | [Antes](sim1g-before-en-XA-light-1280x720.png) | [Después](sim1g-after-en-XA-light-1280x720.png) |
| en-XA | dark | 1440×900 | [Antes](sim1g-before-en-XA-dark-1440x900.png) | [Después](sim1g-after-en-XA-dark-1440x900.png) |
| en-XA | dark | 1280×720 | [Antes](sim1g-before-en-XA-dark-1280x720.png) | [Después](sim1g-after-en-XA-dark-1280x720.png) |

## Pendiente y no verificado en esta evidencia

- La suite E2E local completa queda pendiente de la corrida de cierre sobre este mismo código; solo se declaran aquí las 17 enfocadas ya ejecutadas. El resultado completo se actualizará en el PR, sin un commit que cambie el head calificado.
- CI de Ubuntu, Windows y macOS Apple silicon: pendiente del PR y su head final. Intel no forma parte de la matriz de PR; no se declara verificado.
- No se han probado instaladores ni publicado versiones ni actualizado la app instalada.
- No se añaden dependencias ni se modifica `package.json`, el lockfile, la CI, los plazos, el motor, el guardado o las exportaciones. Las demás partes de SIM-1 quedan para sus entregas separadas.
