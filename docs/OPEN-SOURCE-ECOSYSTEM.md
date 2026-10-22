# Evaluación del ecosistema open source de FreyaLab

Consulta: **22 de octubre de 2026**. Corte de actividad: **2026-10-22 17:05:39 UTC** (11:05:39, Ciudad de México). Evidencia base: `main` **bf5e670b455ccfb3e25d60b0fc0750239df582cb**, que integra el PR #26. No había PR abiertos al iniciar. Rama documental: `codex/opensource-ecosystem`.

## Decisión recomendada

**Conservar TanStack Table/Virtual + DuckDB-Wasm/Arrow + ECharts y Simple Statistics. No incorporar dependencias nuevas en esta entrega.** Mejorar el constructor actual es la opción de menor integración pendiente. Graphic Walker y Perspective sí ahorran interfaz de exploración, pero reemplazarían parte del sistema visual o exigirían mantener dos dibujadores. No son controles intercambiables para ECharts.

La comparación no prueba que una solución propia sea siempre mejor. Si la prioridad pasa a ser un constructor completo con campos arrastrables, Perspective merece una siguiente prueba con nuestro DuckDB aislado. Graphic Walker queda condicionado a revisar/remediar sus avisos transitivos. Tabulator es el candidato para una sustitución limitada de la grilla si se demuestra ahorro neto conservando el modelo CSV.

Esta entrega cambia documentación y evidencia; **no cambia arquitectura, código de aplicación, lockfile de FreyaLab ni instalador**. La mejora local de ejes/alcance se conserva separada en `codex/visual-chart-builder`, sin publicar ni instalar; esta evaluación no la declara terminada. No se fusiona ningún PR.

## Método y límites

- Ventanas fijas: 90 días desde **2026-07-24T17:05:39Z** y 365 desde **2025-10-22T17:05:39Z**, ambas hasta el corte. GitHub GraphQL cuenta commits alcanzables por la rama predeterminada, incluidos merges; no son commits de todo el conjunto de ramas ni de un paquete concreto dentro de un monorepo.
- Autores activos: cuentas GitHub vinculadas al **autor principal** de commits en la ventana. No equivale a todos los colaboradores, revisores, coautores o personas. Los bots pueden figurar; no se deducen personas a partir de nombres sin cuenta vinculada. Históricos: REST contributors, incluye autores anónimos, caché de GitHub y su definición propia; no es directamente comparable con cuentas activas.
- Respuesta: muestra de los 20 issues creados más recientemente, restringida a los últimos 365 días, hasta los primeros 20 comentarios de cada uno. Se mide primera respuesta de OWNER/MEMBER/COLLABORATOR ajeno al autor, excluyendo logins `[bot]`. Mediana solo entre respondidos; los demás están censurados. Cierre sin comentario no cuenta como respuesta. No es SLA ni una estimación representativa de toda la comunidad.
- Versiones: registro npm para librerías y GitHub Releases para aplicaciones/motores. Un tag de otro adaptador TanStack o una versión de Python Polars no identifica automáticamente el paquete que usaríamos en Electron. Un `latest` prerelease se distingue de estable.
- Las métricas se consultaron en varios minutos; son una instantánea fechada, no valores permanentes. Se guardan respuestas, errores y metodología en [la evidencia](evidence/ecosystem-2026-10-22/README.md). Un fallo TLS interrumpió la primera paginación de DuckDB; solo la recuperación marcada completa sustituye el límite inferior inicial. La rama de DuckDB avanzó 44 commits durante la consulta; se verificó mediante compare que el SHA inicial es ancestro del recuperado y se excluyeron exactamente esos 44 para mantener las métricas de la referencia inicial. Se conserva la comparación y el archivo bruto recuperado.
- Las puntuaciones son juicios técnicos trazables y la sensibilidad matemática de esos juicios; no son mediciones de rendimiento ni una certificación de seguridad. Estrellas y forks se describen, pero no determinan la decisión.

## Inventario, versiones y mantenimiento

| Proyecto / paquete o distribución | Estable y publicación | Commits 90 / 365 días | Cuentas activas 90 / 365 | Estado verificable |
|---|---|---:|---:|---|
| [TanStack Table](https://github.com/TanStack/table)<br>@tanstack/svelte-table | 9.3.1 (2026-10-12) | 128 / 468 | 18 / 37 | Actividad observada; no archivado |
| [Tabulator](https://github.com/tabulator-tables/tabulator)<br>tabulator-tables | 6.7.1 (2026-10-22) | 70 / 221 | 7 / 20 | Actividad observada; no archivado |
| [AG Grid Community](https://github.com/ag-grid/ag-grid)<br>ag-grid-community | 36.2.0 (2026-09-16) | 874 / 2872 | 19 / 28 | Actividad observada; no archivado |
| [DuckDB](https://github.com/duckdb/duckdb)<br>@duckdb/duckdb-wasm | 1.32.0 (2025-12-16); latest 1.33.1-dev57.0 es prerelease | 8879 / 26457 | 178 / 331 | Actividad observada; no archivado |
| [Arquero](https://github.com/uwdata/arquero)<br>arquero | 8.0.3 (2025-05-29) | 0 / 0 | 0 / 0 | Sin commits en ambas ventanas; no archivado |
| [Polars](https://github.com/pola-rs/polars) | py-2.0.0 (2026-10-06) | 917 / 2515 | 77 / 199 | Actividad observada; no archivado |
| [OpenRefine](https://github.com/OpenRefine/OpenRefine) | 3.10.1 (2026-03-04) | 131 / 358 | 13 / 31 | Actividad observada; no archivado |
| [Apache ECharts](https://github.com/apache/echarts)<br>echarts | 6.1.0 (2026-05-19) | 17 / 257 | 3 / 21 | Actividad observada; no archivado |
| [Graphic Walker](https://github.com/Kanaries/graphic-walker)<br>@kanaries/graphic-walker | 0.5.3 (2026-10-01) | 14 / 57 | 2 / 4 | Actividad observada; no archivado |
| [Perspective](https://github.com/perspective-dev/perspective)<br>@perspective-dev/viewer | 5.6.0 (2026-10-14) | 124 / 347 | 3 / 9 | Actividad observada; no archivado |
| [Vega-Lite](https://github.com/vega/vega-lite)<br>vega-lite | 6.5.0 (2026-10-08) | 31 / 127 | 6 / 16 | Actividad observada; no archivado |
| [Simple Statistics](https://github.com/simple-statistics/simple-statistics)<br>simple-statistics | 7.12.1 (2026-09-27) | 51 / 74 | 10 / 14 | Actividad observada; no archivado |
| [jStat](https://github.com/jstat/jstat)<br>jstat | 1.9.6 (2022-11-21) | 0 / 0 | 0 / 0 | Sin commits en ambas ventanas; no archivado |

**DuckDB requiere dos lecturas distintas:** el motor nativo tiene una comunidad mucho mayor que el wrapper WASM. FreyaLab fija `@duckdb/duckdb-wasm` 1.33.1-dev57.0 y observó motor v1.5.4 en sus pruebas previas; no está usando el release nativo v2.0.0 (2026-10-21) por tener ese tag en GitHub. No se actualiza ni se degrada automáticamente a la estable 1.32.0.

DuckDB-Wasm, colección completa: **49 / 129 commits**, **3 / 6 cuentas vinculadas activas** en 90/365 días. [Fuente separada](evidence/ecosystem-2026-10-22/duckdb-history.json).

Frecuencia: las dos ventanas permiten comprobar continuidad sin extrapolar cadencia de un release aislado. Arquero y jStat no tienen commits en ninguna; eso eleva el riesgo de mantenimiento, pero no demuestra abandono. En los monorepos AG Grid, DuckDB, Polars y TanStack, una cifra de commits alta incluye otros módulos. Los releases npm fechados son evidencia más directa de mantenimiento del componente seleccionado.

## Comunidad y respuesta observada

| Proyecto | Estrellas | Forks | Autores históricos REST | Issues abiertos / cerrados | PR abiertos | Respuesta mantenedor: respondidos / muestra; mediana |
|---|---:|---:|---:|---:|---:|---|
| TanStack Table | 28510 | 3589 | 503 | 47 / 2537 | 28 | 7/20; 53.5 h |
| Tabulator | 7790 | 905 | 142 | 370 / 4126 | 40 | 2/20; 132.3 h |
| AG Grid Community | 15652 | 2092 | 208 | 51 / 7275 | 79 | 0/20; no estimable |
| DuckDB | 42394 | 3987 | 957 | 572 / 7410 | 374 | 0/20; no estimable |
| Arquero | 1542 | 73 | 22 | 40 / 133 | 2 | 0/2; no estimable |
| Polars | 40155 | 3196 | 783 | 2588 / 10938 | 399 | 20/20; 4.1 h |
| OpenRefine | 12054 | 2187 | 428 | 669 / 2694 | 50 | 5/20; 26.8 h |
| Apache ECharts | 67571 | 19819 | 337 | 1273 / 18126 | 211 | 4/20; 6.0 h |
| Graphic Walker | 3270 | 188 | 23 | 27 / 66 | 21 | 1/7; 55.7 h |
| Perspective | 11334 | 1349 | 104 | 33 / 908 | 1 | 4/20; 132.4 h |
| Vega-Lite | 5527 | 727 | 228 | 719 / 2879 | 101 | 5/20; 27.7 h |
| Simple Statistics | 3526 | 240 | 67 | 14 / 184 | 11 | 2/6; 12.2 h |
| jStat | 1805 | 246 | 66 | 56 / 103 | 7 | 0/2; no estimable |

Los issues cerrados no prueban resolución satisfactoria; los abiertos no son todos defectos. Los PR abiertos miden inventario, no velocidad ni calidad. Los PR recientes y estados están en `github.json`. Un “0/20” significa que el método no encontró respuesta de un mantenedor en esa muestra: puede haber conversación de usuarios, automatización, cierres directos o soporte externo. No se interpreta como falta de soporte.

Documentación y soporte: TanStack ofrece adaptador Svelte, guías y comunidad; Tabulator documenta edición, rangos, historial y exportación; AG Grid publica migraciones y separación Community/Enterprise; ECharts tiene manual/ejemplos y comunidad Apache; Graphic Walker ofrece ejemplos, configuración y un protocolo de cómputo; Perspective publica API de componentes, plugins y servidores virtuales. OpenRefine tiene manual/comunidad especializada; Polars, DuckDB y Vega-Lite tienen documentación y ejemplos de consulta/visualización. Simple Statistics incluye funciones tipadas/documentadas. jStat requiere revisar definiciones TypeScript y documentación del paquete antiguo. La presencia de ejemplos no constituye una medición independiente de adopción empresarial.

Se detectó un desfase de documentación de Tabulator: el registro y release consultados indican **6.7.1**, mientras la página recuperada del manual anuncia **6.5.0**. No se toma el encabezado cacheado del sitio como la última versión. Las fuentes exactas y la fecha de consulta se conservan.

## Licencias, compatibilidad y coste de integración

Las licencias MIT, ISC, BSD-3 y Apache-2.0 permiten esta combinación bajo un proyecto MIT manteniendo licencias/avisos de los componentes. Eso no relicencia sus archivos ni cubre automáticamente todas sus dependencias transitivas. AG Grid Enterprise no está autorizado. Se evalúan aquí las licencias declaradas y las obligaciones de conservación de avisos.

| Proyecto | Licencia principal | Svelte 5 / TypeScript / Electron | macOS, Windows, Linux y offline | Dependencias y empaquetado |
|---|---|---|---|---|
| TanStack Table | MIT | Adaptador Svelte ya usado; headless y tipado | Integración existente; CI multiplataforma previa | Table + Virtual; no binarios nativos propios. La UI, foco, clipboard y modelo de disco siguen siendo nuestros |
| Tabulator | MIT | JS imperativo en onMount/onDestroy; API con tipos a verificar en versión fijada | Viable en Chromium local; integración FreyaLab no probada | Sin dependencias directas en paquete consultado; DOM/CSS y eventos propios, no reemplazo automático de motor |
| AG Grid Community | MIT (solo Community) | API JS/TS; adaptador imperativo para Svelte, sin asumir wrapper oficial | Viable en Electron; integración no probada | Community y sus módulos; las funciones Enterprise tienen otra licencia |
| DuckDB / WASM | MIT | Ya aislado en Electron; TS y Arrow | Recursos locales ya empaquetados; CI anterior en cuatro entornos | WASM + Worker; no requiere Homebrew/servidor. Versión fijada prerelease, actualización exige pruebas |
| Arquero | BSD-3-Clause | API JS/TS; necesita adaptador a nuestro estado | JS local, sin prueba de integración | Otro modelo tabular en memoria; no aporta guardado CSV reversible |
| Polars | MIT | Motor Rust/Python; no es un widget Svelte ni API drop-in del renderer | Proyecto multiplataforma; nuestra ruta de bindings no evaluada | Binarios/bindings/runtime adicionales; otro motor y obligaciones de distribución |
| OpenRefine | BSD-3-Clause | Aplicación Java con interfaz web; no librería Svelte | Aplicación local multiplataforma, no embebida aquí | JVM/servidor local/modelo de proyecto; usar como referencia de UX |
| ECharts | Apache-2.0 | API TS/JS ya integrada, SVG local | Integración existente; CI/paquetes anteriores | Importaciones modulares; exportador saneado propio. No incluye constructor BI de campos |
| Graphic Walker | Apache-2.0 | React 19; montaje desde Svelte probado. También publica helper vanilla que incluye React | Prototipo local probado solo en macOS ARM; Windows/Linux sin probar | React + Vega/Vega-Lite + sus controles/estado. No reutiliza ECharts. Adaptador DuckDB aún pendiente |
| Perspective | Apache-2.0 | Custom Element, API TS, montaje Svelte probado | Prototipo local solo macOS ARM; Windows/Linux sin probar | Viewer/client/server WASM + plugin WebGL propio; existe DuckDBHandler, sin probar con nuestro sandbox |
| Vega-Lite | BSD-3-Clause | Especificación JSON/compilador JS tipado, integrable en Svelte | Viable local; no probado en FreyaLab | Necesita Vega y opcionalmente vega-embed; sustituye/duplica ECharts, no es UI de constructor |
| Simple Statistics | ISC | Funciones TS/JS ya utilizadas en proceso tabular | Local, sin binarios nativos; pruebas existentes | Cero dependencias directas; no ofrece paneles ni motor de CSV |
| jStat | MIT (LICENSE del repositorio) | API JS; tipos adicionales por verificar | JS local, no probado aquí | Cero dependencias directas declaradas; versión publicada antigua |

Tamaño npm descomprimido y dependencias directas: **no son tamaño del bundle, instalador ni RAM**. Son útiles para decidir qué investigar, no para prometer arranque rápido.

| Paquete consultado | Tamaño npm descomprimido (MiB) | Dependencias directas |
|---|---:|---:|
| @tanstack/svelte-table 9.3.1 | 0.09 | 2 |
| tabulator-tables 6.7.1 | 28.54 | 0 |
| ag-grid-community 36.2.0 | 20.63 | 2 |
| @duckdb/duckdb-wasm 1.33.1-dev57.0 | 142.46 | 2 |
| arquero 8.0.3 | 2.60 | 2 |
| echarts 6.1.0 | 57.50 | 2 |
| @kanaries/graphic-walker 0.5.3 | 38.79 | 71 |
| @perspective-dev/viewer 5.6.0 | 7.75 | 3 |
| vega-lite 6.5.0 | 5.67 | 6 |
| simple-statistics 7.12.1 | 1.29 | 0 |
| jstat 1.9.6 | 0.67 | 0 |

No se descargaron distribuciones completas de OpenRefine/Polars para medir tamaño ni RAM; no se les asigna un número ficticio. El árbol combinado instalado solo en `/private/tmp` para los dos prototipos ocupó aproximadamente **422 MiB** y registró 749 paquetes añadidos. Incluye dependencias de desarrollo publicadas por terceros y recursos que no necesariamente entran al bundle.

Cambios incompatibles: no se ejecutó ninguna migración. El salto a TanStack 9, AG Grid 36, Polars Python 2 o DuckDB nativo 2 exige sus guías si se adopta una versión diferente. Perspective 5.6 publica `viewer-charts`; el paquete antiguo `viewer-d3fc` tiene otro número de versión. Mezclarlos no fue una ruta válida del prototipo. Graphic Walker 0.5.3 exige React >=19; no se supone compatibilidad con un runtime React anterior. Véanse manifiestos de [npm](evidence/ecosystem-2026-10-22/npm.json) y [tipos/exports](evidence/ecosystem-2026-10-22/package-compatibility.json).

## Matriz funcional — componentes, no aplicaciones equivalentes

Leyenda: **G** gratuito abierto documentado; **E** Enterprise/comercial; **A** requiere adaptación/UI; **—** no es su función. “Grande” no significa capacidad demostrada de FreyaLab.

| Proyecto | Edición / rangos | Transformaciones | Estadística | Pivot / agrupación | Gráficos / constructor | D&D | Filtros | Exportación | Datos grandes |
|---|---|---|---|---|---|---|---|---|
| TanStack | G headless / A | A | A | G headless / A | — | A | G/A | A | Virtualización y procesamiento externo |
| Tabulator | G | G mutators + A avanzadas | G cálculos básicos | G agrupación; pivot a validar | A | G filas/columnas | G | G; formatos requieren módulos | Virtual DOM; medir memoria/modelo |
| AG Grid Community | G edición; rangos E | A | A | Pivot/agrupación avanzada E | Integrados E | G según operación | G básicos; avanzados E | CSV G; Excel E | Virtualización; server-side avanzado E |
| DuckDB | — | G SQL / A UI | G agregados | G SQL / A UI | — | — | G SQL | G motor; controles de archivos propios | Motor capaz; límites de FreyaLab vigentes |
| Arquero | — | G tablas JS | G agregados | G consultas / A UI | — | — | G | G datos / A archivos | Memoria JS; sin medición local |
| Polars | — | G DataFrame | G | G | — | — | G | G formatos | Motor capaz; integración sin medir |
| OpenRefine | G aplicación | G limpieza/reconciliación | G exploración básica | Facetas; no BI completo equivalente | No sustituye ECharts | No constructor gráfico equivalente | G facetas | G aplicación | Proyecto propio en memoria/disco |
| ECharts | — | G limitadas; usar DuckDB | G helpers; no motor estadístico general | A preparación | G gráficos / A constructor | A para campos | A datos | G imagen / A exportador | Dibujo acotado y agregado externo |
| Graphic Walker | Exploración, no editor canónico | G flujos / adaptador externo | G agregados | G | G Vega/Vega-Lite + constructor | G campos | G | Configuración/imagen según API; comprobar contrato | Cómputo externo posible; prototipo 100k |
| Perspective | G plugin; no editor canónico | G expresiones/consultas | G agregados | G | G plugins + constructor | G campos | G | G datos/config según API | WASM/virtual servers; prototipo 100k |
| Vega-Lite | — | G declarativas | G agregados | G facetas; A pivot | G gramática / A constructor | A | G selección/filtros | Vega/vega-embed | Preparación externa recomendable |
| Simple Statistics | — | — | G descriptiva/correlación | — | — | — | — | A | Arrays numéricos; límites existentes |
| jStat | — | — | G distribuciones/inferencia | — | — | — | — | A | Arrays numéricos; sin medición |

AG Grid Community no resuelve gratuitamente toda nuestra lista: pivot, selección de rangos, charts integrados, portapapeles avanzado y menús/contexto avanzados aparecen como Enterprise en su [comparativa oficial](https://www.ag-grid.com/javascript-data-grid/community-vs-enterprise/). Tabulator incluye rangos/clipboard/menús/historial en su [manual abierto](https://www.tabulator.info/docs/6.x/), pero no hemos probado que conserve identidad de filas, campos ausentes o nuestro diario de recuperación.

## Pruebas técnicas reutilizadas y completadas

Equipo: Apple M2 Max, 32 GiB, ARM64, Electron 44.9.2, Node 24.22.1, Svelte 5.57.2 y Vite 8.3.4. Graphic Walker 0.5.3 + React/ReactDOM 19.3.1; Perspective 5.6.0. Recursos servidos únicamente en loopback; red externa bloqueada en la sesión Electron del prototipo. No se usaron los CSV del usuario.

Se reutilizan los cuatro ensayos de montaje ya verificados; no se repitieron para esta evaluación. Se añadió un ensayo distinto porque faltaban tiempos separados de procesamiento y casos de integridad. Los datos son deterministas: alternar Oaxaca/Puebla y ventas `i % 10`. Sumas independientes: 3.000 filas → Oaxaca 6.000/Puebla 7.500; 100.000 → 200.000/250.000. Ambas herramientas coinciden.

| Prototipo | Filas | Preparación del componente/datos/config (ms) | Suma working set observada (MiB) |
|---|---:|---:|
| graphic | 3000 | 236.1 | 530.1 |
| graphic | 100000 | 254.0 | 553.3 |
| perspective | 3000 | 295.3 | 624.2 |
| perspective | 100000 | 441.0 | 722.3 |

**Esos tiempos no son arranque frío de FreyaLab ni tiempo al primer píxel.** `readyMs` termina al preparar la configuración/montaje; la captura posterior confirma interfaz visible. La memoria es una observación tras la preparación, no pico, incremento marginal ni memoria exclusiva de la librería. Sumar procesos puede contar páginas compartidas. Una corrida por caso; sin percentiles ni garantías universales.

| Procesamiento adicional | Filas | Agregación Graphic Walker (ms) | Cargar tabla Perspective (ms) | Vista + agregación Perspective (ms) |
|---|---:|---:|---:|---:|
| Suma por ciudad | 3000 | 14.1 | 20.2 | 19.0 |
| Suma por ciudad | 100000 | 58.1 | 59.2 | 53.1 |

Los pasos no son equivalentes internamente: Graphic Walker recibe objetos ya creados; Perspective recibe además una carga de tabla explícita. No se deduce de estas cifras que un motor sea globalmente más rápido. Tampoco se comparan como benchmark A/B con la app completa.

Como referencia histórica, sin repetirla: [DuckDB-Wasm en FreyaLab](evidence/duckdb-wasm-profile-2026-10-21.json) midió análisis de 3.000 filas en 578,0 ms y 100.000 en 977,8 ms, con picos de suma working set de 996,5/1.143,6 MiB; incluye abrir un proceso aislado, transferencia Arrow y el resto de la aplicación. **No es el mismo fixture ni la misma carga que los prototipos.** El [histograma de un millón](evidence/charts-million-2026-10-21.json) tardó 5.624,8 ms; no acredita GB ni cualquier CSV de un millón de filas.

Bundle de la compilación inicial del prototipo conjunto: chunk principal de Graphic Walker ≈4,26 MB (gzip ≈1,25 MB), además del runtime compartido React/Svelte; Perspective incluye ≈0,56 MB de JS de client/viewer/plugins y ≈4,27 MB de WASM (gzip ≈4,24 MB). Son segmentos del prototipo, no dos instaladores comparables ni tamaño incremental exacto en FreyaLab. El ensayo de integridad añade un WASM de cliente explícito; sus recursos no se atribuyen al gráfico inicial. Los tamaños npm anteriores tampoco son bundle.

**Integridad: resultado eliminatorio de una ruta de uso.** Con el fixture de identificadores, Perspective con inferencia automática devolvió `001` como `1` y `9007199254740993` como `2147483647`. Su esquema final reportó string; eso no recupera el texto ya alterado. La carga con esquema explícito `string` conservó ambos, Unicode, saltos de línea y comillas; vacío se mantuvo `""` y campo ausente se representó como null. Graphic Walker conservó el texto y las propiedades ausentes en la consulta raw. Los objetos originales no cambiaron en el ensayo. [Resultado exacto](evidence/ecosystem-2026-10-22/integrity-results.json).

Estas pruebas no verifican reserialización CSV, BOM/codificación/delimitador, undo, guardado ni recuperación a través de los componentes alternativos. Por ello no se les entrega el modelo canónico: FreyaLab conserva arrays textuales/longitud irregular/identidad, historial y formatos; el explorador solo recibiría una proyección de solo lectura con esquema explícito.

| Capacidad de los prototipos | Verificación real | Pendiente |
|---|---|---|
| Montaje Svelte/Electron y gráfica de barras | Ambos visibles con fuentes locales y datos deterministas | Empaquetado/instalación Windows/Linux; accesibilidad con lector de pantalla |
| Ejes/agrupación | Configuración por API y sumas contrastadas | Pruebas completas de gestos drag & drop y teclado |
| Persistencia | Perspective save/restore de configuración probado; Graphic Walker normalize genera configuración serializable | Reabrir sesión/archivo auxiliar, columnas renombradas/eliminadas |
| DuckDB | Se inspeccionaron protocolo computation de Graphic Walker y DuckDBHandler/VirtualServer de Perspective 5.6 | Adaptación a nuestro IPC, sandbox, cancelación, presupuestos y permisos; no se ejecutó ese puente |
| ECharts | Ninguno reutiliza directamente el dibujador actual | Sustitución de exportación/caches/temas; duplicarlo no es una integración gratuita |
| Filtros/series/pivot/exportaciones | APIs y documentación consultadas | E2E de esas rutas en los prototipos; no declaradas completas |

## Seguridad y requisitos eliminatorios

- **Actual**: `npm audit --omit=dev` sobre el lockfile de la rama base reportó **0 avisos** al consultar. Esto solo cubre la base pública de avisos consultada; no certifica XSS, integridad ni contenido malicioso.
- **Prototipo combinado**: la misma auditoría reportó **40 entradas: 18 high y 22 moderate**, sin critical. El paquete directo señalado fue Graphic Walker; incluye rutas Vega, compiladores y dependencias de herramientas publicadas como dependencias. Son entradas del árbol, no 40 vulnerabilidades independientes ni 40 exploits demostrados. No se ejecutó `audit fix`, overrides ni downgrade sugerido automáticamente. [Árbol y avisos](evidence/ecosystem-2026-10-22/prototype-npm-audit.json).
- El aviso [GHSA-7f2v-3qq3-vvjf](https://github.com/advisories/GHSA-7f2v-3qq3-vvjf) alcanza versiones de Vega resueltas por el prototipo y tiene condiciones de explotación específicas; exige triage/remediación antes de adopción. No basta con que Graphic Walker no tenga GHSA directo.
- ECharts: [GHSA-fgmj-fm8m-jvvx](https://github.com/advisories/GHSA-fgmj-fm8m-jvvx) se corrigió en **6.1.0**, la versión actual fijada. AG Grid: los dos avisos consultados afectan versiones antiguas, no 36.2.0 según sus rangos. DuckDB-Wasm: [GHSA-w62p-hx95-gf2c](https://github.com/advisories/GHSA-w62p-hx95-gf2c) documenta una versión comprometida **1.29.2**, no nuestra 1.33.1-dev57.0. No se equipara aviso histórico con versión vulnerable actual.
- OpenRefine publicó avisos de path traversal/XSS/RCE en versiones anteriores; los rangos consultados señalan correcciones hasta 3.8.3, anterior al release 3.10.1 evaluado. DuckDB también publicó avisos del motor, por ejemplo cifrado corregido en 1.4.2 y acceso por sniff_csv corregido en 1.1.0; las medidas de aislamiento de FreyaLab no se sustituyen por una versión reciente. Los registros íntegros se conservan.
- Los avisos npm no cubren toda la aplicación Java de OpenRefine ni todos los bindings de Polars. Se consultaron también avisos públicos por repositorio; una lista vacía no demuestra ausencia de vulnerabilidades.

| Gate obligatorio | A actual | B Graphic Walker | C Perspective | D sustitución de grilla |
|---|---|---|---|---|
| Integridad del CSV | Modelo actual probado; sigue siendo canónico | Raw del fixture pasa; roundtrip/undo sin probar | Inferencia automática **rechazada**; esquema explícito pasa fixture, roundtrip pendiente | No probado: no adoptable aún |
| Seguridad | Sin avisos auditados actuales; aislamiento existente | **Adopción bloqueada** hasta revisar/remediar high/moderate relevantes | Sin avisos directos encontrados; revisión del puente/render/export pendiente | Revisar widget, clipboard/HTML y datos antes de adoptar |
| Licencia | Componentes y avisos existentes | Apache-2.0; auditar transitivas antes de distribuir | Apache-2.0; auditar transitivas antes de distribuir | Tabulator MIT; Enterprise AG Grid fuera de autorización |
| Multiplataforma | Evidencia anterior en CI/paquetes; no es certificación del nuevo constructor | Solo macOS ARM probado; no aprobada distribución nueva | Solo macOS ARM probado; no aprobada distribución nueva | Solo viabilidad documental; sin prueba integrada |

Un total ponderado alto **no levanta un gate**. “Pendiente” tampoco se cambia por “incompatible”: significa que aún no se puede aprobar adopción o distribución basándose en esta evaluación.

## Matriz ponderada y sensibilidad

Pesos pedidos: compatibilidad 25%, mantenimiento 20%, comunidad 15%, funcionalidad 15%, rendimiento 10%, licencia 10%, integración 5%. Escala 1–5; total = suma ponderada / 5 sobre 100. Se evalúan opciones arquitectónicas comparables, no una biblioteca estadística contra una grilla.

| Opción | Compat. | Mant. | Comun. | Func. | Rend. | Lic. | Integr. | Total / 100 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| A — TanStack + DuckDB + ECharts | 5 | 4 | 4.5 | 3 | 3 | 5 | 5 | 84.5 |
| B — Graphic Walker + adaptador DuckDB | 3 | 3 | 3 | 5 | 3 | 5 | 2 | 69.0 |
| C — Perspective + adaptador DuckDB | 3.5 | 4 | 3.5 | 4.5 | 3 | 5 | 2.5 | 76.0 |
| D — Tabulator para sustituir solo la grilla | 3.5 | 4 | 3.5 | 4 | 3 | 5 | 2 | 74.0 |

Justificación por puntuación (juicios, no mediciones):

- **Compatibilidad** A5: Svelte/IPC/exportación ya integrados; B3: montaje React probado, puente nuevo; C3,5: Custom Element probado, WASM/puente nuevo; D3,5: API JS viable, sin POC integrado. Se descuentan incógnitas específicas, no soporte genérico de Chromium.
- **Mantenimiento** A4: actividad de sus componentes, con cautela por la variante WASM prerelease; B3: 14 commits/90 días y 4 cuentas/365, más deuda transitoria observada; C4: 124/90 y 9 cuentas/365; D4: 70/90 y 20 cuentas/365, con manual recuperado desfasado. Números altos no implican automáticamente mejor calidad.
- **Comunidad** A4,5: varios proyectos con integraciones y comunidades amplias; B3: 23 autores históricos y 4 cuentas/365; C3,5: 104 históricos y 9 cuentas/365; D3,5: 142 históricos y 20 cuentas/365. Se consideran soporte/documentación y actividad, sin usar estrellas como sustituto.
- **Funcionalidad** A3: gráficos/cálculo existentes, falta el constructor avanzado; B5: UI BI de canales rica; C4,5: constructor/pivot/plugins; D4: edición/rangos/menús maduros, pero no resuelve el constructor gráfico. Lo no probado sigue siendo documental, con incertidumbre.
- **Rendimiento** todos **3 neutral provisional**, intervalo de juicio **2–4**: los ensayos no son comparables extremo a extremo. No se inventa superioridad para A, B, C o D. Esto introduce ±2 puntos al total base si solo se mueve este criterio.
- **Licencia** todos5 para sus componentes abiertos principales; es compatibilidad potencial, no auditoría completa de dependencias. Enterprise no entra a la opción D.
- **Integración** A5: ampliación acotada; B2: React, Vega, estado y protocolo nuevos; C2,5: Custom Element facilita montaje pero nuevo gráfico/cliente/puente; D2: adaptar eventos y sustituir selección/virtualización sin perder historial/guardado. Ninguna librería elimina estas fronteras de seguridad.

| Escenario | Pesos compat./mant./comun./func./rend./lic./integr. | A | B | C | D |
|---|---|---:|---:|---:|---:|
| base | 25 / 20 / 15 / 15 / 10 / 10 / 5 | 84.5 | 69.0 | 76.0 | 74.0 |
| compatibility_integration | 35 / 15 / 10 / 10 / 10 / 10 / 10 | 88.0 | 66.0 | 73.5 | 71.5 |
| maintenance_community | 15 / 30 / 25 / 10 / 5 / 10 / 5 | 85.5 | 67.0 | 76.5 | 75.0 |
| visual_functionality_stress | 10 / 10 / 5 / 60 / 5 / 5 / 5 | 71.5 | 85.0 | 83.0 | 76.5 |

Perturbación adicional: cada uno de los siete pesos se varió individualmente ±50% y se normalizó de nuevo (14 escenarios). Cambios de ganador bruto: **0**. El detalle está en [scoring.json](evidence/ecosystem-2026-10-22/scoring.json).

La recomendación **sí depende de prioridades**: al dar 60% al constructor visual completo, Graphic Walker/Perspective ganan atractivo y el orden bruto cambia. Eso no autoriza B con avisos pendientes, C con inferencia destructiva ni una distribución sin validar. Si se prioriza BI completo y se superan esos gates, debe reabrirse la decisión; no se fuerza la arquitectura actual por inercia.

## Qué código podría simplificarse realmente

| Alternativa | Código candidato a retirar | Código que debe permanecer | Decisión |
|---|---|---|
| Tabulator | Parte del DOM de grilla, navegación, selección, menús, clipboard y virtualización de CsvTable | Motor textual, IDs, preview/aplicación atómica de cambios, historial, recuperación, formatos, IPC | No hay líneas eliminadas demostradas. POC específico antes de reemplazar |
| AG Grid Community | Orden/filtros/UI básica | Rango/clipboard/contexto avanzado propio o licencia comercial; modelo y guardado | No aporta sustitución gratuita completa de nuestra edición avanzada |
| Graphic Walker | Panel constructor, canales, filtros visuales/configuración | Adaptador validado de consultas, revisión/cancelación/presupuestos y modelo CSV; exportador tendría que adaptarse a Vega | Puede ahorrar UI, no se adopta con deuda de seguridad pendiente |
| Perspective | Panel de exploración/pivot, configuración y plugins | DuckDBHandler adaptado al sandbox o motor adicional, validaciones, esquema textual y fronteras de archivo | Segunda opción para BI; nunca importar inferencia al documento |
| Arquero / Polars | Expresiones propias de transformación/cálculos | Preview, plan de cambios por IDs, undo, diferencias ausente/vacío, cancelación y formatos | Añaden otro modelo/motor sin eliminación demostrada |
| DuckDB existente | Preparación de agregaciones, pivot, joins y futuras transformaciones puras complejas | Aplicar cambios textuales mediante el motor actual y validar conversiones explícitas | Reutilizar para consultas de solo lectura; no migrar trim/NFC por estética |
| Simple Statistics existente | Fórmulas estadísticas manuales equivalentes | Recolección/validación numérica y avisos de exclusión | Conservar; jStat solo si se requieren distribuciones/inferencia no cubiertas |

No se promete un porcentaje de código eliminado ni un ahorro de semanas: no se implementaron sustituciones. Medir líneas borradas y complejidad neta requeriría el POC de sustitución, incluidos sus adaptadores y pruebas.

## Recomendación por categoría y próximas decisiones

1. **Edición:** conservar TanStack/Virtual. Tabulator es candidato de evaluación si se convierte en un cuello de mantenimiento; comparar IDs, paginación externa, rangos, teclado, ausencia/vacío, historial y recuperación antes de cambiar. No AG Grid Enterprise.
2. **Procesamiento:** conservar DuckDB-Wasm + Arrow para proyecciones y consultas; mantener el motor textual para mutaciones. No Arquero/Polars como segundo motor por ahora. OpenRefine como referencia para facetas/limpieza con vista previa, no aplicación embebida.
3. **Visualización:** conservar ECharts. Separar configuración tipada del resultado y mejorar ejes/medida/alcance antes de añadir más tipos. Graphic Walker y Perspective son alternativas de explorador, no plugins de ECharts. Vega-Lite solo si una sustitución visual completa aporta una ventaja demostrada.
4. **Estadística:** conservar Simple Statistics. No jStat sin un requisito de inferencia/distribución concreto y revisión de mantenimiento/tipos.
5. **Dependencias nuevas recomendadas ahora: ninguna.** Eliminar redundancia futura exige demostrar sustitución; no instalar una librería para conservar también toda la implementación anterior.

| Iteración futura | Beneficio | Dependencias / aceptación | Riesgo y pruebas |
|---|---|---|
| 1. Ejes/medida/cálculo/alcance | Saber qué se dibuja, documento o vista filtrada | Configuración tipada, operaciones compatibles explícitas, ejes y alcance en exportación | Fixture numérico independiente; filtros combinados; identificadores/ausentes; cancelar; muestra; CSV intacto |
| 2. Series/fechas/filtros propios | Comparar categorías y ventas por periodo | Límites de series; reglas ISO/zonas horarias/vacíos visibles; mismo DuckDB | Orden cronológico, conversiones inválidas, presupuesto, leyenda y cancelación |
| 3. Guardar configuración y datos agregados | Reutilizar análisis sin modificar el CSV | Sidecar/almacenamiento local versionado; columnas por identidad/validación; CSV/JSON/Markdown derivados | Columnas renombradas/duplicadas/eliminadas, save cancelado, exportaciones parciales y recuperación |
| 4. Decidir constructor reutilizado | Reducir UI propia si BI domina el producto | Un POC de puente seguro Perspective-DuckDB o Graphic Walker saneado, no ambos en producción | Gates, mismas consultas/fixtures/métricas, paquete de los cuatro entornos, accesibilidad y ahorro neto |

Cada iteración necesita rama/PR, comprobaciones correspondientes y evidencia del commit. No se fusiona ni se publica automáticamente. Esta evaluación no cierra el objetivo completo de CSV/análisis/visualización.

## Facilidad de uso para universitarios y profesionales

**La amplitud de funciones no equivale a facilidad de uso.** La prioridad de producto es que una persona pueda completar su tarea sin saber CSV, SQL ni programación. La evaluación funcional anterior cuenta capacidades; no se presenta como un estudio de usabilidad.

| Tarea común | Experiencia mínima exigida | Verificación pendiente |
|---|---|---|
| Abrir un CSV y corregir un dato | Doble clic, celda editable, estado de guardado visible, deshacer y recuperación | Pruebas de tareas con usuarios; comparar grilla actual y alternativa si se propone sustituir |
| Crear el primer gráfico | Elegir categoría y valor con nombres de columnas; explicación como “Suma de ventas por ciudad”; sin SQL obligatorio | Usuarios que desconocen ejes, medidas y agregación deben entender el resultado |
| Comparar categorías o periodos | Campo opcional “Separar por”, filtros visibles y alcance explícito; fechas con reglas claras | Evitar selección accidental de identificadores como números o mezcla de muestra/completo |
| Compartir un resultado | Imagen o tabla con título, unidades, procedencia y alcance; acciones directas | Exportación fuera de FreyaLab, comprensión de límites y recuperación ante error |

Diseño a conservar: valores predeterminados útiles y reversibles; ayuda breve junto a un control; términos “Agrupar por”, “Valor”, “Cálculo” y “Separar por” acompañados del nombre real de columna; opciones avanzadas progresivas. Drag & drop es opcional: toda tarea también debe poder completarse con clics y teclado. SQL, expresiones y diagnósticos técnicos quedan en una sección avanzada, disponibles para quienes los necesitan.

La seguridad y los límites deben explicarse en lenguaje de tarea: “Estos datos incluyen las filas ocultas por tus filtros” o “Esta vista solo muestra una parte”, no términos internos del motor. No sustituir mensajes claros por una pantalla llena de opciones.

Antes de adoptar un constructor completo: comparar las mismas tareas con estudiantes y profesionales, registrar finalización sin asistencia, errores de elección de datos, necesidad de ayuda, accesibilidad por teclado y comprensión de guardado/deshacer. No se asignan ahora tasas de éxito ni tiempos ideales: todavía no se ejecutó ese estudio. Una opción que obligue a escribir SQL para el flujo básico o pueda alterar datos silenciosamente no se acepta, aunque gane en puntuación técnica.

La sensibilidad al peso de funcionalidad no representa automáticamente sensibilidad a usabilidad: las dos deben medirse por separado. La recomendación actual es provisional respecto a facilidad de uso hasta probar las tareas, no una afirmación de que más botones propios sean mejores que un componente existente.

## Fuentes y evidencia

- Métricas primarias: GitHub GraphQL/REST de los repositorios enlazados en el inventario y registro público npm. Respuestas congeladas y scripts de consulta en [evidence/ecosystem-2026-10-22](evidence/ecosystem-2026-10-22/README.md).
- [TanStack overview](https://tanstack.com/table/latest/docs/overview), [Tabulator manual](https://www.tabulator.info/docs/6.x/), [AG Grid Community/Enterprise](https://www.ag-grid.com/javascript-data-grid/community-vs-enterprise/).
- [Graphic Walker computation](https://github.com/Kanaries/graphic-walker/blob/main/computation.md), [Perspective client y Virtual Servers](https://github.com/perspective-dev/perspective), API `DuckDBHandler` inspeccionada en el paquete 5.6.0; no declarada integración probada.
- [ECharts dataset/encode](https://echarts.apache.org/handbook/en/concepts/dataset/), [Vega-Lite](https://vega.github.io/vega-lite/), [DuckDB-Wasm](https://github.com/duckdb/duckdb-wasm), [Arquero](https://github.com/uwdata/arquero), [Polars](https://github.com/pola-rs/polars), [OpenRefine](https://github.com/OpenRefine/OpenRefine).
- [Simple Statistics](https://github.com/simple-statistics/simple-statistics), [jStat y licencia](https://github.com/jstat/jstat/blob/master/LICENSE).

No verificado: adopción empresarial independiente, SLAs, accesibilidad completa, integración DuckDB de los prototipos, roundtrip CSV a través de alternativas y sus paquetes/instaladores en Windows/Linux. Riesgo principal: cambiar el modelo textual/las fronteras de ejecución para ahorrar UI.
