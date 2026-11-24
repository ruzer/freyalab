# SIM‑3d · Cifras y textos para estudiantes · Alcance y ADR0021

Continuación de código en `codex/sim-3d-decimales-continuacion`, base main actualizado `3b5e822c`. #214 fusionó solo la documentación inicial; esta entrega prepara un PR de continuación en borrador. Rigen la [historia SIM‑3](historia-sim3-resultados-correctos-diseno-para-codex.md) y el [anexo posterior de decimales/copia](sim-3d-decimales-copia-decision-2026-11-23.md), que **sustituye** el contrato anterior de copia parcial/múltiple y amplía la presentación a los resultados de Análisis. La historia compartida no se edita.

## Bloques y orden antes de nueva interfaz

1. **Contrato puro y pruebas:** formato2/Todos, cifras pequeñas sin cero falso, eliminación de−0 y salida hasta15significativas para copia/ayuda. Fragmentos tipados preservan texto/IDs/unidades/separadores recibidos; no regex que adivine números. Funciones pequeñas sobre formatNumber/Intl existentes, sin motor nuevo.
2. **Preferencia única, después de alcance publicado:** selector «Decimales:2/Todos» encima de los resultados, default2 y persistencia como Tema. Propuesta `decimalesAnalisis:2|'all'`. Settingsv1 sin el campo se conserva; patch opcional sin default implícito, versiones futuras solo lectura. La fila accesible de Ajustes y reset de Apariencia satisfacen CONTRIBUTING y usan el mismo valor, no otra preferencia.
3. **Presentación común:** Información, Estadísticas principales, Más estadísticas y tabla de Gráficos. Hasta2decimales sin ceros de relleno; si0<abs<0.01, hasta2cifras significativas. Todos hasta15significativas;0.1+0.2→0.3. Reutilizar un componente numérico pequeño si evita duplicar formato/metadatos. No redondear objetos de resultado ni cambiar cálculos. No extender el cambio a ejes/tooltips/SVG o a la tabla SQL.
4. **Copia nativa:** todos los valores numéricos marcados que toca la selección se copian completos con hasta15significativas y unidad, también si se seleccionaron parcialmente. El texto restante y los separadores nativos se conservan. Raíz visible de AnalysisWorkspace; metadatos de resultado, no detección global por texto. Serialización nativa por segmentos y restauración síncrona de anchor/focus/rangos, incluida selección inversa. Ningún botón, API/IPC, async, timer o acceso genérico al sistema.
5. **Textos seguros de3d:** alcance sin revisión/ordinal innecesario, «Solo lectura: tu archivo no cambia.», explicación en «Cómo se calcula» nativo plegado, etiqueta NFC más clara, textos de memoria sin revisión y error undoLimit que explica rechazo sin modificación. Los avisos y ámbitos reales permanecen. Se sustituyen las leyendas de precisión/copia anteriores para que no contradigan2/Todos ni la nueva copia de parciales.

No se modifica UI o Settings de la ampliación hasta que raíz publique este alcance/anexo. Las fases anteriores conservan sus fuentes y evidencia: el control nativo de copiar pasó; el rojo original y el borde Text completo demostraron errores distintos de presentación/copia. Ningún resultado de esa fase acredita el contrato ampliado.

## Hechos actuales y reparto

CsvStatistics ya formatea hasta2decimales; CsvDescribe también; Información tiene sus propios contadores/porcentajes y Más estadísticas recibió la primera presentación3d. La tabla de Gráficos usa formatChartNumber, compartido con el dibujo: se cambiará su caller de tabla, no ese helper global. Exportaciones e informes tienen rutas crudas independientes que deben seguir intactas.

AnalysisWorkspace mantiene subpaneles montados y ocultos y tiene una cabecera común apropiada para el selector. App conserva el estado canónico de preferencias; main/preload ya aceptan patches/eventos genéricos. El nuevo campo necesita default compatible para settingsv1, pero no en patches parciales de otras opciones. SettingsDialog tiene reset de Apariencia explícito y requiere añadir la misma preferencia.

El propietario ya fusionó 3a y 3c. Se incorpora ese main antes de conectar App a la preferencia existente y de completar los motivos de filas de CsvTable. La edición posterior de 3b espera a que el código de esta entrega quede congelado; cada entrega mantiene su propio PR, con la serie 3a→3b→3e. Limpiar▾ ya tiene la razón conocida de B cuando falta una celda, que se conserva sin otra lógica ni aceptar columnas por casilla. El fallback de contexto usa un texto comprensible, no habilita acciones.

El error `empty.error.undoLimit` se produce en emptyPlan antes de commitChange; la unitaria funcional existente de table-empty verifica rechazo de preview y snapshot intacto. Se revalida nativamente antes de afirmar verde actual, sin cambiar presupuesto ni motor. NFC sigue siendo la operación normalize existente. Revisión se quita de las tres etiquetas de memoria, no de requests, cachés, rechazos stale o informes.

Los catálogos es/en se coordinan por claves; en‑XA se genera del inglés. No se retira ninguna ruta de pending-files por cambiar algunas frases: solo si su migración completa queda comprobada. Sin App/Tree/style ajenos, CsvTable, motor, parser, dependencias, exportación cruda o preferencia duplicada fuera de los bloques descritos.

## Rojo, verde y consumidores

Las unitarias nuevas cubrirán el helper puro por comportamiento:5.52264150943→5.52,12→12,0.0004123→0.00041 y negativo equivalente,−0→0, Todos/copia hasta15significativas y0.1+0.2→0.3. También fragmentos con múltiples cifras, porcentaje con unidad y texto00123 intacto. Si el primer rojo es función ausente, se identifica como TDD convencional, no rojo funcional de la app.

La GUI actual debe demostrar primero el cero falso, el selector ausente y la política vieja de copia parcial/múltiple. Luego probará formato en los cuatro consumidores, cambio sin nuevas consultas, persistencia y reset, fuente/revisión intactas y clipboard real. El portapapeles original se guarda/restaura solo en memoria; las pruebas globales llevan@solo. Nada de execCommand o copia fabricada. Una fila real con varias celdas comprueba tabs/saltos; selección inversa/anchor/focus permanecen después de copiar.

Se mantienen los fixtures/oráculos de5.52264150943,media140/9,porcentaje, IDs, nulos y exportaciones. Las expectativas anteriores que exigían parcial/múltiple visible se actualizan porque el propietario cambió el contrato; sus rojos no se borran. No se presenta un control verde del formatNumber ya existente como rojo nuevo. Los consumidores que midan representación cambian solo esa representación; datos, consultas y bytes siguen.

Después del bloque: comprobaciones y consumidores pertinentes, matriz de capturas es/en‑XA×claro/oscuro×1440×900/1280×720. Al cierre de integración, tipos, unitarias completas, E2E completa y build según CONTRIBUTING, CI3OS del SHA final y tiempos reales de Windows. No plazos/retries nuevos, relanzamientos, fusiones ni actualización de la app instalada. No se afirma verde ampliado en este documento.

## Siete respuestas originales del ADR0021 · decisión3

1. **Does a tool already do this?** Sí: formatNumber/Intl, t/plural, Settings/schema/default/patch/store/eventos, la cabecera AnalysisWorkspace y las tablas existentes. DOM Selection y metadatos de los resultados permiten copiar sin adivinar números. Reutilizar→configurar→integrar antes de desarrollar.
2. **Is there a skill we can reuse?** El flujo rojo→mínimo→verde y los helpers de Playwright/Electron, persistencia y exportaciones existentes. Las herramientas de desarrollo no se incorporan al runtime del producto.
3. **Can it be integrated through CLI, API, or MCP?** El puente actual de preferencias y los datos/callbacks de Análisis son suficientes. No nuevo IPC, CLI, API, MCP o acceso del renderer a archivos/clipboard del sistema; la copia usa ClipboardEvent nativo acotado.
4. **How mature, secure, and maintained is it (release cadence, maintainers, license)?** Intl y DOM estándar, componentes internos MIT y dependencias ya fijadas. No biblioteca, servicio o carga remota nuevos. Se conservan aislamiento, settings futuros, originales y exportaciones.
5. **What maintenance cost does it add?** Un campo persistido compatible, un selector/fila de Ajustes que comparten valor, helpers puros pequeños y presentación/metadatos comunes. El coste delicado es preservar la selección y los separadores: queda cubierto por E2E nativa, no por un parser genérico de texto.
6. **What is the minimum glue LAB must write?** Una política de formato/copia, conectar la preferencia existente a los consumidores indicados y un adaptador DOM limitado a la raíz visible. LAB no cambia. No otro motor, esquema de resultados, caché, almacenamiento renderer o detector de tipos.
7. **Does writing our own code add value?** Sí: evita cifras pequeñas presentadas como cero y permite presentación legible y copia coherente conservando datos crudos. Rehacer formato internacional, Settings, matemática, exportación o clipboard global no aporta valor y no se propone.
