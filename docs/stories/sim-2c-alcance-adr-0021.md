# SIM-2c · Campos más simples · Alcance y ADR 0021

Preparación sin implementación. Rama codex/sim-2c-campos-simples; base fija eb64dd43b22bc3fb4fd3caec7fd4f5d95105c874, interfaz B verde que incorpora A. No se modifican B, A, P3 ni sus heads de CI. La [historia SIM-2](historia-sim2-analisis-graficos-diseno-para-codex.md), sección C y reglas comunes, es la referencia de aceptación.

## Alcance

Cada fila conserva nombre y tipo, mediante icono con title y nombre accesible, y cambia Añadir/Mover por Más acciones de {campo}. Clic, Intro y Espacio en un campo sin usar llaman recommendedZone/addToZone; el campo ya usado abre Mover/Quitar sin eliminar al activarlo. Se conserva el anuncio charts.fields.added, los avisos de monto/porcentaje y las operaciones de zonas/filtros actuales.

La lista tiene un punto de tabulación, flechas verticales e Inicio/Fin. Los puntos suspensivos siguen hover, foco y selección de PRJ-01c. Su menú reutiliza ContextMenu: teclado, restauración de foco, elementos no disponibles enfocables y motivos. Una pista precede las zonas; cada zona vacía dice Vacía. Los grupos conservan sus títulos; desaparece solo la etiqueta textual de cada fila.

El recomendado procede de la sugerencia actual. El propietario ya aprobó la excepción acotada documentada abajo: validar únicamente los botones de tipo con los perfiles existentes. No se añade un detector, perfil, consulta, agregación, motor, dependencia, canal IPC o persistencia nueva.

## Contradicción concreta y decisión del propietario

En CsvCharts.svelte:74, chooseKind proyecta las opciones; en :82, sql solo intenta chartSQL(headers, options). El generador shared/charts.ts valida índices/opciones, sin perfiles de columnas: Líneas sin período y Dispersión hacen TRY_CAST de X y descartan nx nulo. Con Ciudad + Edad se construye SQL para los seis tipos aunque los dos gráficos numéricos descarten Ciudad. La regla literal «no construye consulta» no produce el ejemplo de la historia «Dispersión necesita dos campos numéricos».

| Proyección actual desde Ciudad + Edad | SQL construible hoy | Efecto relevante |
| --- | --- | --- |
| Barras | Sí | Promedio de Edad por Ciudad; sugerencia actual. |
| Líneas, sin período | Sí | Ciudad no numérica queda descartada, sin puntos utilizables. |
| Dispersión | Sí | Ciudad no numérica queda descartada, sin puntos utilizables. |
| Histograma | Sí | Usa Edad numérica. |
| Mapa de calor | Sí | Cuenta pares Ciudad/Edad. |
| Caja | Sí | Distribución de Edad por Ciudad. |

El propietario **aprobó** la excepción mínima: únicamente los botones de tipos usan los perfiles existentes. Para Ciudad en Filas y Edad en Valores, Barras/Histograma/Mapa/Caja están disponibles, Barras es recomendado y Líneas/Dispersión no están disponibles. La consulta del motor sigue siendo construible para los seis: la diferencia pertenece solo a la elegibilidad del botón. No extender esta validación a Generar ni impedir configuraciones manuales/presets anteriores; conservan su pipeline de errores.

La sexta E2E fija los dos motivos exactos, tanto en title como en aria-describedby/nombre de descripción: Líneas, «Necesita un campo numérico o de fecha en Filas y un campo numérico en Valores»; Dispersión, «Necesita dos campos numéricos». La implementación los catalogará como claves propias, por ejemplo charts.kind.unavailable.line y charts.kind.unavailable.scatter. No se consulta una clave futura desde la prueba: sus oráculos son los textos literales del comportamiento preparado.

Si se necesita compartir la proyección, extraer solo el cuerpo puro actual de chooseKind a un helper que devuelva una copia de options, recibiendo el contexto ya disponible de sugerencia/perfiles. El handler conserva chosenTypeSignature. Los botones y el handler reutilizarían esa proyección; chartSQL/chartTotalSQL quedan sin cambios. La comprobación de perfiles se aplica únicamente a los botones y usa evidencia ya cargada; su ausencia no autoriza inventar un tipo ni lanzar un detector. Las configuraciones manuales y presets no atraviesan esa nueva guarda de botones.

## Mapa mínimo previsto, sin aplicar

| Archivo | Cambio previsto |
| --- | --- |
| src/renderer/components/ChartFields.svelte | Activación de fila, menú de casa, roving, iconos de tipo, pista y zonas vacías; conservar muestras, warning monetario, chips, agregación, filtros y ajustes de B. |
| src/renderer/components/CsvCharts.svelte | Marca recomendada y disponibilidad de botones; reutilizar la proyección sin cambiar cálculo, firma, cancelación, carga de perfiles, título ni exportaciones. |
| src/shared/chart-fields.ts, solo si hace falta | Helper puro mínimo de proyección de tipo; recommendedZone, addToZone y sus 49 combinaciones conservan datos/semántica. |
| src/shared/i18n/es.json y en.json | Pista, Vacía, Más acciones y motivos aprobados; en-XA usa generación existente. Retirar solo claves que queden sin consumidores. |
| tests/e2e/chart-simple-fields.spec.ts | Seis pruebas nuevas de comportamiento, preparadas antes de fuente; las primeras cinco y el helper corregido en a5b1a6e se conservan al añadir la sexta. |
| tests/chart-fields.test.ts y consumidores de tipo | Tras el rojo de la matriz aprobada: equivalencia de proyección y SQL, sin nuevo detector ni cambios de motor. |

Consumidores actuales que pueden necesitar únicamente migración de selector tras el rojo: chart-clarity, analysis-sections, chart-field-loading, chart-review, sql-progress-states, analysis-tab, chart-fields y ui-u0. No se editan ahora. Se conservan sus oráculos de datos, consultas, cancelación, revisiones, formatos y archivos originales; solo se retiran expectativas del botón/etiqueta que esta historia elimina.

## Seis E2E preparadas

Se copia literalmente el fixture sintético de analysis-sections: 240 filas, siete campos ID/Ciudad/Ingreso/Edad/Grupo/Fecha/Respuesta, un Ingreso vacío e ID 9007199254740993 conservado como texto. No se importa un spec con hooks ni se modifica A. La prueba anterior de amountBadge en chart-fields sigue siendo la cobertura real del monto/porcentaje; no se fabrica un nuevo detector o una columna monetaria en la encuesta para afirmar esa cobertura.

1. Lista: siete filas, iconos con nombre/title, sin texto de tipo, un tabstop, ↑/↓/Inicio/Fin, una pista y cuatro Vacía.
2. Clic Ingreso→Ciudad: recommendedZone produce promedio; tabla/JSON/CSV coinciden con medias independientes de las 240 filas. Se conservan revisión, bytes, vacío e ID grande.
3. Intro/Espacio: añaden sin abrir el menú y conservan anuncios actuales y promedio; no se presenta el doble clic como prueba de clic simple.
4. Campo usado: clic abre Mover/Quitar, no elimina ni recalcula; Escape restaura foco. La retirada exige elegir Quitar.
5. Más acciones: hover/foco, Mayús+F10 y tecla de menú; navegación de ContextMenu, motivo de Valores no disponible en mapa de calor, foco conservado y activación sin cambios en consultas/cancelación.
6. Matriz Ciudad+Edad: seis tipos, Barras recomendado, cuatro disponibles y Líneas/Dispersión con sus motivos exactos; los dos bloqueados conservan foco y no cambian selección, título, tabla, consultas ni cancelación al pulsar Intro/Espacio.

El observador de main delega siempre al handler original; no devuelve resultados inventados. Solo observa analyzeColumn/sqlRun/sqlPage/sqlCancel/cancelAnalysis y las exportaciones reales. Para comprobar ausencia de recálculo en presentación, tres casos usan el reloj de renderer después de obtener un resultado real y agotan el debounce existente de 300 ms con runFor(301), como B. No mide latencia ni cambia plazos del producto. Sin imports futuros, test.skip, retries nuevos, cambio de timeout o generación de fixtures grandes.

## Siete respuestas del ADR 0021

1. **¿Existe herramienta?** ChartFields, recommendedZone/addToZone, suggest, chooseKind, chartSQL, ContextMenu, controlHint y los iconos existentes bastan.
2. **¿Existe habilidad reutilizable?** Los patrones de lista/menú y rojo→verde del repositorio. No se incorpora una herramienta de desarrollo al producto.
3. **¿Hay CLI/API/MCP suficiente?** Las API de análisis/exportación y el puente actual ya sirven para las pruebas. C no requiere otro canal ni acceso genérico del renderer.
4. **¿Madurez, seguridad, mantenimiento y licencia?** Svelte, ECharts y código interno MIT existentes. Se conserva la validación del motor, datos originales, formatos, presets manuales y avisos de límites.
5. **¿Coste?** Cambios locales de interacción/presentación y una posible extracción pura mínima; sin perfiles ni consultas adicionales.
6. **¿Pegamento mínimo?** Eventos de fila llaman los handlers actuales; ContextMenu sustituye su menú manual; proyección de tipo compartida si la política aprobada lo requiere.
7. **¿Qué valor tiene código propio?** Hacer visible y accesible la selección de campos ya existente. Reescribir SQL, perfiles, muestreo o exportaciones no aporta valor.

## Estado

Producto intacto. Raíz ejecutó las cinco primeras pruebas sobre la base: cuatro fallos de conducta y un fallo de setup por el sufijo recomendado de assign. El checkpoint a5b1a6ef862c077f753763d614369c9750b7023d corrige solo ese helper; su cuerpo permanece intacto al añadir la sexta. Raíz ejecutará C4 de nuevo y la nueva matriz sobre el build de la base antes de autorizar interfaz. La aprobación de la política no equivale al rojo ni autoriza adelantar producto. Capturas y calificación por plataforma se incorporarán desde ejecuciones reales posteriores. Este bloque no ejecuta GUI, build, pruebas, commits, push ni PR.
