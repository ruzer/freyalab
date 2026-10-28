# Iteración 5 · Pruebas

Una historia, derivada de una auditoría de la suite el 2026-10-27. Regla de la iteración: **no se borra ni se debilita ninguna prueba**; solo se organizan para poder correr la parte que importa a cada cambio.

## FL-TST-001 · Segmentar la suite E2E en `shell`, `md`, `csv` y `@perf`, sin borrar pruebas

### 1. Historia de usuario

Como persona que implementa o revisa un cambio en Markdown o Mermaid, quiero correr solo las pruebas de esa área y saber en qué casos conviene la suite completa, para recibir una respuesta en minutos sin perder protección sobre CSV ni sobre los límites de tamaño.

### 2. Problema y evidencia

Medido el 2026-10-27 sobre `main` en `7955b68` (incluye el PR #67), con Apple M2 Max, macOS y Electron 44, en una sola corrida completa:

| Medida | Resultado |
|---|---|
| E2E completo | 234 de 234 en verde, 0 inestables, **8,7 min** (523,7 s de reloj) |
| Unitarias (`npm test`) | 527 de 527 en verde, unos 5 s; incluyen todas las de CSV |
| Antigüedad de las pruebas | El repositorio empezó el 2026-10-20 y todos los archivos de prueba se tocaron entre el 20 y el 26 de octubre |
| Omitidas (`skip`, `fixme`, `only`) | Ninguna |
| Módulos de `src` que solo existen para ser probados | Ninguno (`table-worker.ts` es un punto de entrada del build) |
| Mediana por prueba E2E | 1,2 s |

Reparto del tiempo E2E por área (suma de las duraciones de cada prueba):

| Área | Archivos | Pruebas | Tiempo | Parte |
|---|---|---:|---:|---:|
| `md` | `markdown-toolbar`, `markdown-render`, `mermaid-errors`, `preview-progressive`, `missing-resources` | 44 | 2,6 min | 30 % |
| `shell` | `ui`, `app`, `icons` | 38 | 0,8 min | 9 % |
| `csv` | los otros 23 archivos (gráficos, SQL, desplazamiento, dock, estadísticas, extracción…) | 152 | 5,3 min | 61 % |

El coste se concentra en pocas pruebas: **15 de 234 (6 %) gastan el 38 % del tiempo**. Las mayores:

| Tiempo | Archivo | Prueba |
|---:|---|---|
| 82,2 s | `markdown-toolbar.spec.ts` | documento de 10 MiB: el estado sigue al cursor sin bloquear la navegación |
| 17,1 s | `markdown-toolbar.spec.ts` | solo lectura deshabilita todos los controles (crea un documento de unos 12 MB para superar el límite de solo lectura) |
| 12,5 s | `charts.spec.ts` | gráficos de un CSV mayor de 50 MiB se exportan como imágenes |
| 10,5 s | `charts.spec.ts` | constructor explícito: cálculos contrastados |
| 9,0 s | `sql.spec.ts` | SQL: mide fuentes completas hasta un millón por cuatro columnas |
| 7,3 s | `charts.spec.ts` | histograma agrega un millón de filas completo |

Hoy `playwright.config.ts` tiene un único proyecto implícito (`testDir: ./tests/e2e`, un trabajador, 90 s por prueba) y `npm run test:e2e` construye y corre todo. La CI (`ci.yml`) corre `npm run test:e2e` en las cuatro plataformas con un límite de 45 min. `CONTRIBUTING.md` ya pide «no repitas suites ya verificadas por CI sin un cambio que lo justifique», pero no hay forma de correr un área sin escribir rutas a mano. Resultado: o se corre todo (9 min) o se improvisa.

No se midió la utilidad de cada aserción: la auditoría muestra que no hay pruebas vencidas ni omitidas, no que todas sean igual de valiosas.

### 3. Diseño

Dos ejes independientes:

- **Área, por archivo:** tres proyectos de Playwright que **particionan** la suite: `shell` (`ui`, `app`, `icons`), `md` (los cinco archivos de Markdown y Mermaid) y `csv` (todo lo demás). Una prueba pertenece a un solo proyecto.
- **Tamaño, por prueba:** la etiqueta `@perf` (etiquetas de Playwright, `test(título, {tag:'@perf'}, …)`) marca las pruebas cuyo **propósito** es un límite de tamaño: documentos de 10 MiB o más, tablas de un millón de filas o más y archivos de más de 50 MiB. El tiempo medido sirve para revisar candidatas, pero no basta por sí solo para etiquetar (la de 10,5 s de «constructor explícito» es funcional, no de límite).

Los grupos viven en un módulo pequeño, `tests/e2e/groups.ts`, con las listas de archivos de `shell` y `md`; `csv` es «todo lo demás». Así un archivo nuevo que se olvide registrar cae en `csv`, que se corre completo en la CI: el fallo es benigno, nunca se pierde cobertura.

Comandos (todos incluyen `npm run build &&` como el actual):

| Comando | Qué corre | Para qué | Tiempo estimado |
|---|---|---|---:|
| `npm run test:e2e` | Todo, como hoy | Última tarea de un lote y CI | 8,7 min |
| `npm run test:e2e:md` | `shell` + `md` | Cambios en Markdown o Mermaid | 3,4 min (1,7 sin `@perf`) |
| `npm run test:e2e:csv` | `shell` + `csv` | Cambios en CSV | 6,1 min |
| `npm run test:e2e:fast` | Todo menos `@perf` | Comprobación amplia y rápida | unos 6,5 min |
| `npm run test:e2e:perf` | Solo `@perf` | Antes de publicar o al tocar render, editor o motor de tablas | unos 2,2 min |

Qué correr según lo que se cambia (se documenta en `CONTRIBUTING.md`):

| Cambio | Mínimo local | Siempre |
|---|---|---|
| Solo Markdown o Mermaid (`render.ts`, `Preview`, `Diagram`, `markdown-commands`, `MarkdownToolbar`) | `test:e2e:md` | `check`, `test`, `build` y CI en verde |
| Solo CSV (`Csv*.svelte`, motor de tablas) | `test:e2e:csv` | ídem |
| Archivos compartidos (`App.svelte`, `Editor.svelte`, `style.css`, `src/main/**`, `src/preload/**`, `src/shared/**`, `Icon.svelte`, `Tree.svelte`) | `test:e2e` completo | ídem |
| Render, editor o motor de tablas con efecto en el rendimiento | además `test:e2e:perf` | ídem |

La CI no cambia: sigue corriendo todo en cada PR.

### 4. Criterios de aceptación

- T1. `playwright.config.ts` define los proyectos `shell`, `md` y `csv`. **Ninguna prueba se pierde ni se duplica:** la lista de `npx playwright test --list` antes y después es idéntica (mismos 234 nombres) y cada prueba aparece en un solo proyecto.
- T2. Las pruebas de límite de tamaño llevan la etiqueta `@perf`. La evidencia lista cada una con su tiempo medido y el motivo, y revisa las candidatas de más de 10 s que no se etiquetaron.
- T3. Cinco scripts en `package.json`: `test:e2e` (sin cambio de comportamiento: todo), `test:e2e:md`, `test:e2e:csv`, `test:e2e:fast` y `test:e2e:perf`. Funcionan en macOS, Windows y Linux: sin comillas simples ni sintaxis de shell propia de una plataforma.
- T4. **No se borra, omite ni debilita ninguna prueba.** El diff de los archivos `*.spec.ts` solo contiene la anotación de la etiqueta; sin cambios en aserciones, datos, tiempos límite ni orden.
- T5. La CI no se modifica y sigue ejecutando `npm run test:e2e` (todo).
- T6. Una prueba unitaria protege la partición: cada archivo de `groups.ts` existe, ningún archivo está en dos grupos, y todo `tests/e2e/*.spec.ts` cae en exactamente un proyecto.
- T7. `CONTRIBUTING.md` incluye la tabla «qué correr según lo que cambias» y `AGENTS.md` enlaza a ella desde su línea de comprobaciones. La regla de entrega sigue pidiendo `check`, `test`, `build` y la CI en verde; lo que cambia es qué E2E se corre en local.
- T8. La evidencia incluye el tiempo real de cada comando (`md`, `csv`, `fast`, `perf` y el completo) con sistema, versión y número de corridas, y confirma 234 de 234 con `test:e2e`.
- T9. Sin dependencias nuevas; `package.json` solo cambia en `scripts`.

### 5. Casos límite

Una prueba que dependa del estado de otra del mismo archivo (comprobar que `--grep @perf` y `--grep-invert @perf` no rompen archivos con estado compartido; corre cada combinación dos veces); un archivo nuevo sin registrar (cae en `csv`); un título de prueba que contenga «@perf» sin ser una etiqueta; comillas en `--grep-invert` en Windows (`cmd` y PowerShell); el reporte HTML con varios proyectos; las pruebas `@perf` en Linux con `xvfb`; los tiempos límite de las `@perf` (se conservan, p. ej. `test.setTimeout(300_000)`); el orden de ejecución con un solo trabajador; un proyecto vacío (no debe fallar).

### 6. Prompt ejecutable para Codex

```text
Tarea: FL-TST-001 · Segmentar la suite E2E (shell, md, csv, @perf) sin borrar pruebas.
Lee AGENTS.md, CONTRIBUTING.md y docs/stories/5-pruebas.md (FL-TST-001: criterios T1–T9, casos límite y la medición de la sección 2). Rama codex/tst-001-grupos-e2e desde main actualizado. Sin dependencias; package.json solo cambia en "scripts".
Archivos probables: playwright.config.ts, tests/e2e/groups.ts (nuevo), tests/e2e-groups.test.ts (nuevo), package.json (scripts), CONTRIBUTING.md, AGENTS.md, y SOLO la anotación {tag:'@perf'} en las pruebas de límite de tamaño de tests/e2e/*.spec.ts. No toques .github/workflows.
Método:
1. Guarda antes de cambiar nada: la lista de npx playwright test --list (nombres y total, debe ser 234) como referencia.
2. Escribe primero la prueba unitaria de la partición (T6) y comprueba que falla porque groups.ts no existe.
3. Implementa los tres proyectos, la etiqueta y los scripts. Comprueba que --list después es idéntico a la lista de referencia y que cada prueba aparece en un solo proyecto (T1).
4. Revisa las pruebas de límite de tamaño (documentos de 10 MiB o más, tablas de un millón de filas o más, archivos de más de 50 MiB) y etiquétalas con @perf; las candidatas de más de 10 s que no etiquetes, justifícalas en la evidencia (T2). Ejecuta --grep @perf y --grep-invert @perf dos veces cada uno para comprobar que ningún archivo con estado compartido se rompe.
5. Mide el tiempo real de test:e2e:md, test:e2e:csv, test:e2e:fast, test:e2e:perf y test:e2e (sistema, versión de Electron, número de corridas) (T8). Escribe la tabla «qué correr según lo que cambias» en CONTRIBUTING.md y enlázala desde AGENTS.md (T7).
Al terminar: npm run check && npm test && npm run test:e2e (completo: 234 de 234) && npm run build. Evidencia: docs/evidence/tst-001-<fecha>.md con la lista de --list antes y después (diff vacío), las pruebas @perf con sus tiempos, los tiempos de cada comando, y lo que NO se verificó. PR en BORRADOR; no fusiones. No borres, omitas ni debilites ninguna prueba: si crees que alguna sobra, repórtalo en la evidencia, no la quites.
```

### 7. Plan de pruebas

| Nivel | Qué | Dónde |
|---|---|---|
| Unitaria (rojo→verde) | Cada archivo de `groups.ts` existe; sin duplicados entre grupos; todo `*.spec.ts` cae en un proyecto | `tests/e2e-groups.test.ts` |
| Partición | `npx playwright test --list` antes y después: mismos 234 nombres y cada prueba en un solo proyecto | Evidencia (diff vacío) |
| Etiquetas | `--grep @perf` y `--grep-invert @perf`, dos corridas cada una, sin fallos por estado compartido | Local |
| Scripts | Los cinco comandos corren y dan el resultado esperado en macOS; la CI cubre Windows y Linux con `npm run test:e2e` | Local y CI |
| Regresión | `check`, `test`, `test:e2e` completo (234 de 234) y `build`; CI en las cuatro plataformas | CI |

### 8. Criterios de revisión (Claude)

- La lista de `--list` antes y después es idéntica: **ninguna prueba desaparece**; el diff de los `*.spec.ts` contiene solo anotaciones de etiqueta.
- Las pruebas `@perf` son de límite de tamaño por propósito, no solo lentas; las candidatas no etiquetadas están justificadas.
- La CI no cambió y sigue corriendo todo; `test:e2e` se comporta como antes.
- Los tiempos de la evidencia son reales y comparables con los de la sección 2.
- La tabla de `CONTRIBUTING.md` es coherente con la regla de entrega de `AGENTS.md` (siguen `check`, `test`, `build` y CI en verde).
- Sin dependencias nuevas; `package.json` solo cambia en `scripts`.
- `NEEDS TESTING` si falta la corrida del completo (234 de 234) o alguna plataforma de CI; `BLOCKED` si se propone una dependencia o se modifica la CI.
