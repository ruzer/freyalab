# FreyaLab — evolución del editor CSV

Fecha local: 20 de octubre de 2026. Base: `1ef4665bc22f359de08b32310cd34a6c818af165` (`main`). Rama: `codex/csv-column-statistics`.

## 1. Auditoría incremental

Se reutilizan `ARCHITECTURE.md`, `EDITOR-MENUS.md`, `PROGRESS.md`, las pruebas y [la auditoría de editores del PR #6](https://github.com/ruzer/freyalab/pull/6). Este documento añade el contraste CSV, la decisión analítica y un roadmap específico; no repite la auditoría completa ni modifica LAB. Las capturas aportadas son referencias de funciones y extensiones, no una especificación para copiar la interfaz.

Estado de integración comprobado al iniciar: PR #6 (alcance de exportación) y PR #7 (pegado con filtros/orden) abiertos, con CI satisfactoria, aún fuera de main. Su corrección no debe atribuirse a main ni a los binarios alpha.1. Esta rama no los fusiona ni los incorpora tácitamente. Antes de ampliar edición masiva, revisar e integrar esas correcciones mediante el proceso de revisión.

Stack verificado en package.json: Electron 44.9.2, Svelte 5.57.2, TypeScript estricto, TanStack Svelte Table 9.3.1 y Virtual 3.13.47; csv-parse 7.0.3, csv-stringify 6.9.0 e iconv-lite 0.7.3. No hay DuckDB ni Arrow. Interfaz en `src/renderer/components/CsvTable.svelte`; datos en `src/main/table-engine.ts`, dentro de un utility process; contrato en `src/shared/types.ts`; puente y validación Zod en preload/main. No se necesita Graphify para seguir este conjunto reducido de módulos.

**Existente:** celdas y encabezados editables; añadir/eliminar/duplicar filas y columnas; selección de filas y columnas, copia TSV, pegado dentro de dimensiones; historial; buscar/reemplazar; filtros AND de contiene; ordenación estable por una columna, textual o numérica explícita; trim/mayúsculas/minúsculas; estadísticas de celdas seleccionadas; exportar CSV/TSV y copiar Markdown. La grilla virtualiza filas/columnas y recibe páginas de 200 registros. Una fila seleccionada conserva ID estable.

**Guardado:** `Documents` serializa mutaciones y reutiliza `files.atomicWrite`: temporal en la misma carpeta, sincronización, comprobaciones de cambios externos y reemplazo. Mantiene dirty ante errores y recuperación local tras dos segundos; recuperar abre una copia. Guardar conserva el orden del documento, distinto del orden de la vista. No reescribir esta infraestructura para añadir análisis.

**Límites y riesgos:** 50 MiB, dos millones de celdas contando registros de entrada y 1 MiB por registro. Si se superan, muestra de hasta 200 registros completos/8 MiB, solo lectura. La memoria completa de datos e historial vive en el proceso de tablas; virtualizar no elimina ese coste. Estadísticas existentes acumulan arrays y un Set de valores únicos; repetirlas por columna tiene coste O(filas × columnas) y memoria adicional. Cadenas numéricas largas permanecen texto; la base podía incluir enteros inseguros en cálculos con Number. La primera entrega los excluye de estadísticas para evitar resultados redondeados y lo documenta. Las agregaciones restantes siguen siendo aproximadas. Muchas pestañas, textos enormes y alta cardinalidad requieren medición agregada; no hay límite global de memoria demostrado.

Pruebas base: 32 unitarias y 20 E2E; tipos, build y CI de cuatro entornos. Cubren ceros, comillas, multilinea, codificaciones, guardado fallido/conflictos, recuperación, muestras y aislamiento. Esa cobertura no acredita capacidades futuras ni accesibilidad completa. Evidencia previa de ~49.83 MiB en `docs/evidence/local-2026-10-20.md`; no repetirla como si fuera una medición nueva.

## 2. Matriz funcional

Modern CSV: **D** = documentado oficialmente, sin prueba directa de todas sus funciones. FreyaLab: **E** = código/pruebas existentes en main; **P** = parcial; **N** = no implementado. P1 integridad, P2 flujo frecuente, P3 análisis ampliado. Las propuestas no son capacidades terminadas.

| Funcionalidad | Modern CSV | FreyaLab en main | Brecha | Prioridad |
|---|---|---|---|---|
| Edición avanzada | D: edición multicelda y panel | P: celda individual | Rangos y edición multilinea asistida | P2 |
| Filas/columnas | D: insertar, mover, duplicar, eliminar | P: añadir, duplicar y eliminar | Posición antes/después, mover y preview | P2 |
| Selección múltiple | D: rangos y selección discontinua | P: filas/columnas individuales | Selección rectangular y teclado | P2 |
| Buscar/reemplazar | D: regex y preview | P: búsqueda global/reemplazo literal | Alcance, regex segura y preview | P1/P2 |
| Filtros | D: operadores, AND/OR, regex | P: contiene por columna, AND | Exacto, prefijo/sufijo, vacíos, números/fechas | P2 |
| Ordenamiento | D: filas/columnas y selección | E: una columna estable, solo vista | Orden múltiple y reordenar físico explícito | P2 |
| Estadísticas | D: selección/columnas, mediana y dispersión | P: resumen agregado de selección | Panel por columna y alcances explícitos | P2, primera entrega |
| Análisis de columnas | D: vacíos, longitud, tipo | N | Perfil por columna sin conversión destructiva | P3 |
| Valores únicos | D: frecuencias e histograma | P: solo recuento de únicos seleccionado | Lista paginada, frecuencia y filtro | P3 |
| Tablas dinámicas | D: agrupación y medidas | N | Asistente de agrupación y resultados | P3 |
| Column Lookup | D: cruce por clave | N | Claves duplicadas y destino explícito | P3 |
| Transformaciones | D: dividir/unir, duplicados, texto | P: trim/case/reemplazo | Preview, dividir/unir y deduplicación | P1/P2 |
| Importación/exportación | D: delimitados, JSON/XML | P: CSV/TSV, copiar Markdown | JSON/Markdown importados; .tab/.dsv/.psv | P2/P3 |
| Atajos | D: configurables | P: comunes y edición básica | Navegación tabular y acciones contextuales | P2 |
| Paleta/comandos | D: lanzador, menús y clic derecho | P: barra y menú Operaciones | Registro común, paleta y contexto | P2 |
| Archivos grandes | D: edición y modo lectura | P: límites y muestra acotada | Medición por forma; backend incremental posterior | P1/P3 |

Fuentes por filas: [edición](https://www.moderncsv.com/documentation/edit-data/), [filtros y orden](https://www.moderncsv.com/documentation/sort-filter-hide/), [análisis](https://www.moderncsv.com/documentation/file-analysis/), [básicos y archivos](https://www.moderncsv.com/documentation/basics/) y [referencia de comandos](https://www.moderncsv.com/documentation/commands-reference/). No se verificó orden multicolumna ni estabilidad de Modern CSV: no inferirlos del nombre «Sort». Fechas y XLSX se evalúan para FreyaLab; no se atribuyen a Modern CSV sin fuente específica. Algunas funciones analíticas de Modern CSV requieren su licencia Business; esto es una referencia funcional, no reutilización de su código.

## 3. Bibliotecas: reutilizar antes de sustituir

Metadatos del registro npm consultados el 21 de octubre UTC (20 local). Versiones de candidatos consultadas, no instaladas. Publicación reciente es una señal de actividad, no una garantía. Ningún candidato se ha comparado con un benchmark de integración ni con lector de pantalla en FreyaLab.

| Opción / versión | Licencia / publicación UTC | Encaje, gratuidad y accesibilidad | Coste y decisión |
|---|---|---|---|
| TanStack Svelte Table 9.3.1 + Virtual | MIT / 2026-10-12 (Table) | Instalados; control total de la presentación y páginas. ARIA/teclado son responsabilidad de FreyaLab | Mantener ahora. Extender acciones existentes; no crear otro historial |
| AG Grid Community 36.2.0 | MIT / 2026-09-16 | Edición/filtros/virtualización, navegación y ARIA documentadas. Rangos, pivot y clipboard avanzado figuran como Enterprise comercial | No cubre gratis todo el objetivo; no incorporar módulos comerciales. Sustitución M/L con adaptación paginada |
| Tabulator 6.7.0 | MIT / 2026-10-21 | Rangos, clipboard, menús, teclado y virtualización existentes. Documentación 6.x anuncia 6.5: validar APIs de la versión elegida | Candidato de prototipo para rangos; comprobar Svelte, accesibilidad real, worker y IDs. No cargar todo el CSV en la grilla |
| Papa Parse 5.7.0 | MIT / 2026-08-24 | Parser, streaming, workers y serialización. No es grilla ni panel accesible | Redundante con csv-parse/stringify/iconv. No añadir |
| DuckDB Node Neo 1.5.6-r.2 | MIT / 2026-10-20 | Motor analítico SQL; posible ejecución en utility process, no UI. Repositorio incluye bindings por plataforma | Prototipo nativo separado antes de adoptar: empaquetar Electron/asar, binarios por SO/arquitectura, cancelar, memoria y tipos. No probado aquí |
| DuckDB-Wasm | MIT (proyecto DuckDB) | Worker web como alternativa; requiere empaquetar recursos localmente | Restricciones de memoria/entorno y copia de datos. Comparar con Neo, no instalar ambos. No supone compatibilidad Electron demostrada |
| Apache Arrow JS 21.2.0 | Apache-2.0 / 2026-07-21 | Formato/intercambio columnar, no editor ni motor SQL | Útil si la medición demuestra que IPC/copia dominan; hoy el renderer solo recibe páginas. No añadir por anticipación |

Fuentes: [AG Grid](https://www.ag-grid.com/javascript-data-grid/community-vs-enterprise/), [rangos Tabulator](https://www.tabulator.info/docs/6.x/range/), [licencia Tabulator](https://github.com/tabulator-tables/tabulator/blob/master/LICENSE), [Papa Parse](https://www.papaparse.com/docs), [DuckDB Neo](https://duckdb.org/docs/current/clients/node_neo/overview), [bindings Neo](https://github.com/duckdb/duckdb-node-neo), [DuckDB-Wasm](https://duckdb.org/docs/current/clients/wasm/overview), [Arrow JS](https://arrow.apache.org/js/current/), [licencia Arrow](https://github.com/apache/arrow/blob/main/LICENSE.txt). Versiones/licencias/fechas: `https://registry.npmjs.org/<paquete>`; sin instalar candidatos. Alternativa adicional inmediata: los componentes nativos HTML y el motor actual; no otra librería para mostrar resúmenes ya calculados. XLSX requiere caso de uso, biblioteca/licencias y pruebas de precisión antes de elegir dependencia.

## 4. Arquitectura recomendada

Mantener Main → puente explícito → utility process → páginas/resúmenes acotados. La grilla presenta y envía comandos, no se convierte en autoridad de tipos/serialización. Historial y recuperación únicos para CSV; IDs estables y revisiones esperadas en cambios masivos. Una acción funcional compartida por barra, clic derecho y atajo; extracción del registro cuando esos accesos se implementen, no un framework anticipado.

El panel de análisis es de consulta. Alcances separados: documento completo (incluye filas filtradas), vista filtrada, selección; nunca inferirlos de un filtro activo. Muestras rotuladas y sin totales globales. Resultados ligados a revisión, selección de columnas congelada al iniciar, invalidación ante edición/recarga y cancelación clara. No marcar dirty ni guardar por analizar.

**DuckDB:** proponer una proyección analítica de la revisión editada, con columnas originales como VARCHAR y nombres internos por índice (encabezados duplicados válidos). Convertir tipos solo para cálculo explícito; no reabrir el archivo original ignorando cambios pendientes. Resultados derivados no reemplazan el CSV. Una UI de agrupación puede generar consultas parametrizadas; SQL avanzado separado. Un SELECT no basta como aislamiento: funciones pueden leer archivos/red/extensiones. Deshabilitar acceso externo/instalación automática, limitar rutas concedidas, tiempo, memoria y cantidad de resultados; incluir pruebas adversariales. [Seguridad oficial](https://duckdb.org/docs/current/operations_manual/securing_duckdb/overview). Compatibilidad de empaquetado, precisión, cancelación y funcionamiento offline son gates; SQL sigue fuera de esta alfa.

## 5. Roadmap priorizado

S = local; M = UI/contrato/pruebas; L = transversal; XL = prototipo y decisión previa. No son estimaciones de calendario. Accesibilidad y rendimiento se comprueban desde cada fase.

| Fase / tamaño | Alcance y dependencia | Aceptación / pruebas | Riesgo / beneficio |
|---|---|---|---|
| 1. Integridad (S/M) | Revisar PR #6/#7, mantener guardado/recuperación; fuente textual intacta | Exportar alcance completo; pegar por vista; pruebas con ceros, quotes, multilinea, conflictos y caída | Filas omitidas/ocultas; base confiable |
| 2. Edición avanzada (M/L) | Antes/después, mover, rangos; depende de 1 y prototipo de grilla si ahorra trabajo | Misma acción barra/contexto/atajo; IDs, un undo, teclado; pruebas con orden/filtro y celdas vacías | Desplazamientos ambiguos; edición sin sintaxis |
| 3. Filtros y orden (M/L) | Modelo tipado; exacto/contiene/prefijo/sufijo/vacío/número/fecha, AND/OR; sort múltiple estable | Fecha/formato/zona explícitos; texto intacto; regex inválida o costosa controlada; pruebas de empates y límites | ReDoS y fechas ambiguas; localizar registros |
| 4. Estadísticas (S inicial/M) | Primero panel por columna con motor actual; después selección por columna, mediana y desviación | Alcance y revisión visibles; no mutación; casos conocidos, vacíos, texto/numéricos, límites y obsolescencia | Redondeo y resultados antiguos; consultar sin programar |
| 5. Análisis de columnas (M) | Frecuencias, faltantes, duplicados y longitudes; depende de 4 | Valores únicos paginados, cardinalidad acotada, sin inferir conversiones; probar duplicados Unicode/headers | Memoria por cardinalidad; descubrir calidad |
| 6. Transformaciones (M/L) | Preview reutilizable, dividir/unir, normalizar, deduplicar/reordenar; depende de 1–3 | Alcance/recuento/ejemplos, cancelar sin cambio, aplicar por revisión y undo; malformados y presupuesto de historia | Daño masivo; limpieza reversible |
| 7. Tablas dinámicas (L) | Asistente de dimensiones/medidas, primero backend elegido por prueba | Grupo conocido, nulos/tipos claros, resultado separado/exportable y límites; comparar con resultado de referencia | Explosión de cardinalidad; resumir visualmente |
| 8. SQL/análisis avanzado (XL) | Prototipo Neo vs Wasm y Arrow solo si aporta; posterior a alfa | CI con paquetes ejecutados en 4 objetivos, sin red/acceso arbitrario, precisión, cancelación y memoria; proyección de cambios pendientes | Frontera de seguridad y binarios; cruces/grupos avanzados |
| 9. Rendimiento (M/L) | Medir 100/3000/100000/1000000 filas, varias anchuras; luego backend incremental | Registrar bytes/celdas, modo completo/muestra, apertura/filtro/sort, RAM y heartbeat por equipo; conservar recuperaciones | Confundir muestra con archivo; ampliar capacidad con evidencia |
| 10. UX integrada (M) | Paleta buscable, contexto, paneles, ayuda y atajos comunes | Escape/foco/teclado, lector, claro/oscuro y 1280×800/1440×900; acciones sin duplicar lógica | Saturar controles; descubrir herramientas |

Importación/exportación se entrega por formatos entre fases 2 y 6: delimitados y JSON/Markdown con validación y vista previa; encabezados duplicados y campos ausentes requieren representación explícita. XLSX es una evaluación adicional, no alcance aprobado de esta iteración. Guardar conserva valores; una futura exportación protegida para hojas de cálculo debe ser una opción explícita. FreyaLab no evalúa fórmulas; prefijar apóstrofos silenciosamente rompería datos. No se declara neutralización de fórmulas ya implementada.

## 6. Estrategia de pruebas

- Integridad: 00123, IDs >2^53, fechas como texto, Unicode, comillas, multilinea, BOM/EOL, celdas vacías/ausentes, encabezados repetidos, archivos corruptos. Comparar valores y original; no exigir identidad del entrecomillado normalizado al guardar.
- Analítica: datos conocidos, alcances separados, no conversión, no mutación, dirty/revisión/historia intactos, filtros y datos aún no guardados, actualización/rechazo de resultados antiguos, cancelación y muestra identificada.
- Seguridad: aislamiento renderer; IPC inválido; rutas/recursos; clipboard como texto; SQL futuro con archivos/red/extensiones bloqueados. Regex necesita motor o límite eficaz, no solo una longitud máxima.
- UX: flujos reales Playwright, atajos, foco, Escape, claro/oscuro, errores y tamaños. Lectores de pantalla requieren evidencia específica, no solo ARIA estático.
- Rendimiento: una observación local por tamaño es exploratoria; separar motor/UI/paquete. Un millón de filas no equivale a un millón de filas de cualquier anchura. El límite de celdas incluye el encabezado.
- Gates: `npm run check`, `npm test`, `npm run test:e2e` (incluye build), CI Linux/Windows/macOS ARM/Intel sobre el mismo commit. PR revisable sin fusión automática; no nueva publicación ni instaladores aquí.

## 7. Primera iteración recomendada

**Panel de estadísticas por columna**, reutilizando `TableEngine.stats` y el puente existente: columnas marcadas o todas; recuentos, vacíos, únicos, numéricos, suma, media, mínimo y máximo. Cada fila del panel representa una columna por su índice, también con encabezados repetidos. Alcance inicial: documento completo, o únicamente la muestra cuando corresponda; filtros no restringen el cálculo y se indica expresamente.

La única ampliación de contrato necesaria es permitir `rowIds=null` para consultar todas las filas dentro del worker, sin enviar sus IDs al renderer. `[]` sigue significando selección vacía. La UI congela las columnas consultadas, ofrece progreso/cancelación entre columnas y descarta resultados si cambia la revisión. El panel inicial admite hasta 100 columnas por consulta: se rechaza un alcance mayor explícitamente, sin omitir columnas; antes de ampliar, virtualizar sus resultados. Cancelar descarta resultados y detiene las columnas siguientes, pero deja terminar el cálculo de la columna en curso. No inventa mediana, desviación, frecuencias ni pivot: quedan para entregas probadas posteriores.

Superficie: tipos compartidos y validación IPC de stats; motor stats y sus llamadas existentes; panel/estilos CSV; pruebas unitarias y E2E; documentación. Sin cambios de guardado, formato de recuperación, dependencias, CLI ni aplicación independiente.

## 8. Resultado de la primera iteración

Panel implementado en esta rama, pendiente de revisión/integración. Dos pruebas del motor fallaron antes de ampliar el alcance. Validación local: 34 unitarias, 24 E2E, tipos sin errores/advertencias y build satisfactorio. [Evidencia funcional, capturas y los cuatro tamaños medidos](evidence/csv-statistics-2026-10-20.md), con separación entre documento completo y muestra. No se confunden los resultados locales con CI de otras plataformas o instalación. No hay dependencias ni comandos CLI nuevos; LAB permanece fuera de la entrega.
