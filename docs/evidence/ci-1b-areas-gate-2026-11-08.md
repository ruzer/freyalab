# CI-1b · Áreas y compuerta

Base `4c2b7fd`, fusión de #128. [Diseño CI-1b](../stories/historia-ci1-pruebas-por-area-diseno-para-codex.md#ci-1b-workflow-por-áreas-con-una-compuerta).

## ADR 0021

1. **Herramienta existente.** Git obtiene el diff del PR. Node 24 ejecuta el selector existente. Playwright conserva sus tres proyectos y dos fases. GitHub Actions aporta la matriz y sus estados.
2. **Skill reutilizable.** Ponytail acota el cambio al selector, los comandos y la CI. TDD comprueba la clasificación y los proyectos mediante sus interfaces.
3. **Integración.** El job de PR calcula el plan con los SHA del evento y rutas delimitadas por NUL. Los runners reciben los proyectos y el indicador de ejecución completa. Gate consume los estados del cálculo y de la matriz, más las confirmaciones individuales.
4. **Madurez, seguridad y licencia.** Se conservan dependencias, acciones y permisos de solo lectura. Las rutas son datos, se registran aparte del JSON y nunca se expanden como comandos. Los proyectos se validan contra la lista admitida.
5. **Mantenimiento.** `groups.ts` sigue siendo la fuente de proyectos para los specs. Las rutas sin clasificar dejan un aviso y activan la suite completa. Revisar el mapa al cambiar consumidores o fixtures.
6. **Pegamento mínimo.** El comando local y los PR comparten el adaptador de planes. Reutiliza los comandos npm con sus filtros y conserva la fase serial. Los pasos existentes de push y nocturna conservan selección, límites y paquete.
7. **Valor del código propio.** El mapa expresa riesgos de FreyaLab y Gate verifica las tres plataformas requeridas. GitHub y Playwright gestionan la ejecución y los reportes.

## Mapa y riesgos

| Rutas verificadas | Consumidores reales |
| --- | --- |
| `lib/markdown-commands.ts` | MarkdownToolbar ejecuta los comandos. Editor los aplica con la condición Markdown. App inicializa el estado Markdown, cubierto también por Shell. |
| `lib/virtual-scroll.ts`, `CsvTable.svelte`, `CsvCharts.svelte`, `ChartFields.svelte`, `ChartPresets.svelte` | La rejilla CSV importa la virtualización y carga el constructor dinámicamente. El constructor importa campos y configuraciones. |
| `components/Editor.svelte` | Importa edición Markdown y `csv-text-model`. También sirve Mermaid y TXT. Activa las tres áreas y el paquete. |
| `components/TextStats.svelte`, `lib/text-stats.worker.ts` | El componente crea el worker y App lo monta para Markdown y TXT. Las E2E de estadísticas de texto pertenecen a `md`. |
| `src/main/table-client.ts`, `table-worker.ts`, `table-engine.ts`, `large-search-worker.ts`, `sql-service.ts`, `analytics.html`, `analytics.ts` | Documentos abre la tabla con TableClient y este inicia el worker con `utilityProcess.fork`. Vite incluye ambos workers. SqlService carga la ventana analítica. Sus rutas empaquetadas justifican CSV + paquete para esos cambios de proceso principal. |
| `tests/**/*.test.ts` fuera de `tests/e2e/**` | Coincide con Vitest. Los auxiliares y fixtures fuera de esa regla siguen siendo transversales. |
| DOCX de `docs/evidence/seg-s2e-2026-10-30/`, `docs/evidence/i18n-01-baseline-2026-10-28.json` | Los leen `word-style-evidence.test.ts` e `i18n-pending.test.ts`, respectivamente. Ambos exigen Verify y mantienen Shell sin añadir áreas. |
| `docs/design/freya-icon-original.png`, `docs/licenses/**` | Son entradas de `app.spec.ts` y de generación de licencias. Conservan la clasificación transversal. |

La exclusividad de las demás rutas del mapa es una hipótesis heredada de CI-1a. Los imports tampoco demuestran el aislamiento de las ramas por formato, IPC y cargas dinámicas futuras. Por ejemplo, el servicio de configuraciones de gráficos se construye al arrancar la app. Shell cubre el arranque y `main` conserva la suite completa para detectar cruces de área.

Gate exige cálculo exitoso en todos los PR. Acepta Verify omitido únicamente con un plan de solo documentación y sin confirmaciones de plataforma. Con los demás planes exige Verify exitoso y sus tres confirmaciones. Quitar el filtro de rutas evita que un cambio documental suprima el check. Los grupos de Playwright y el selector comparten la lista de specs. El propietario debe marcar **Gate** como requerido en GitHub.

## Comprobaciones locales

- El selector falló primero en cinco casos de clasificación o diagnóstico y después pasó 45/45.
- La prueba del comando de áreas falló primero por faltar el adaptador. Con el adaptador, `npm test -- tests/ci-areas.test.ts tests/ci-int.test.ts` pasó 51/51. CI-INT siguió comprobando el reparto de push y nocturna.

Las corridas de aceptación se registran en el cuerpo del PR para mantener fijo el SHA validado. La referencia completa sin reintentos es [42551585918](https://github.com/ruzer/freyalab/actions/runs/42551585918), `d2e6c29`: Ubuntu 30:16, Windows 45:29, macOS ARM 50:03.
