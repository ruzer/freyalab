# SIM-2c · Campos más simples · Alcance y ADR 0021

Candidato de implementación pendiente de calificación. Rama codex/sim-2c-campos-simples; base fija eb64dd43b22bc3fb4fd3caec7fd4f5d95105c874, interfaz B verde que incorpora A. No se modifican B, A, P3 ni sus heads de CI. La [historia SIM-2](historia-sim2-analisis-graficos-diseno-para-codex.md), sección C y reglas comunes, es la referencia de aceptación.

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

## Mapa del candidato

| Archivo | Cambio o límite |
| --- | --- |
| src/renderer/components/ChartFields.svelte | Activación de fila, menú de casa, roving, iconos de tipo, pista y zonas vacías; conservar muestras, warning monetario, chips, agregación, filtros y ajustes de B. |
| src/renderer/components/CsvCharts.svelte | Marca recomendada y disponibilidad de botones; reutilizar la proyección sin cambiar cálculo, firma, cancelación, carga de perfiles, título ni exportaciones. |
| src/shared/chart-fields.ts | Helper puro mínimo de proyección y elegibilidad del botón; recommendedZone, addToZone y sus 49 combinaciones conservan datos/semántica. |
| src/shared/i18n/es.json y en.json | Pista, Vacía, Más acciones y motivos aprobados; en-XA usa generación existente. Retirar solo claves que queden sin consumidores. |
| tests/e2e/chart-simple-fields.spec.ts | Seis pruebas nuevas de comportamiento, preparadas antes de fuente; las primeras cinco y el helper corregido en a5b1a6e se conservan al añadir la sexta. |
| tests/chart-fields.test.ts y consumidores de tipo | Sin cambios en este candidato. Su ejecución y la migración de selectores eliminados corresponden al cierre coordinado por raíz. |

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

Raíz conservó los intentos de setup fallidos: no prueban que el problema fuera la puntuación del sufijo ni demuestran la causa de Intro. El diagnóstico por clic nativo mostró el menú con «(recomendado)». El setup usa ahora clic nativo y dos nombres exactos del catálogo; sus logs temporales se retiraron sin cambiar los seis cuerpos de prueba.

Después, actionable-red alcanzó ambos oráculos reales: C4 llegó a Promedio de Ingreso por Ciudad y falló al activar una fila ya usada; la sexta llegó a Ciudad+Edad y falló porque Líneas no tenía aria-disabled. Las dos fallaron en 37,846 s. Con ese rojo y la decisión del propietario, raíz autorizó implementar C.

El candidato reutiliza ContextMenu y sus motivos enfocables, un tabindex itinerante, iconos existentes, recommendedZone/addToZone y los callbacks de zonas/filtros actuales. projectChartKind extrae la misma proyección; chartKindUnavailable solo gobierna botones. No se cambian chartSQL/chartTotalSQL, Generar, manual ni presets. Se conservan los seis cuerpos E2E. Tipos, unitarias, build, GUI, capturas y calificación por plataforma siguen pendientes de raíz. No se ejecutaron en este bloque ni se creó commit, push o PR. Los dos ajustes compatibles de B y main vivo se integrarán después por fusión normal coordinada por raíz; no se da por calificada esa composición futura.

## Evidencia posterior e integración provisional

El estado anterior describe el candidato inicial. La primera tanda de seis tuvo dos aprobadas y cuatro fallidas; el pase aislado posterior de Intro no demuestra la causa de su fallo anterior. La séptima prueba permanente conserva una primera página real ya calculada y reproduce el alcance desconocido sin perfiles: Más acciones no esperaba antes de la guarda. El producto ahora incluye ese alcance en su indisponibilidad, mantiene el foco itinerante y publica aria-busy en la lista; no añade perfiles, barridos o respuestas inventadas.

Los siete casos cerraron inicialmente por unión de seis aprobados en la tanda de guarda y el quinto aprobado aisladamente, con los ajustes de driver includeHidden/tecla Menu documentados y los oráculos conservados. Después, los siete pasaron dentro de la tanda de 147 sobre 2039f23; esa tanda completa tuvo 138 aprobadas y nueve fallidas. Check y build pasaron, junto con 3039 unitarias y dos omisiones existentes. No se presenta el conjunto de 147 como verde.

El cierre de 17 sobre 9732f15 pasó los dos fallos de foco después de esperar closeMenu, pero terminó 16/1: quedaban cinco campos visibles frente a los seis exigidos. Quitar el padding añadido por C permitió seis y reveló un recorte real de Filtros; reducir la lista a 244 corrigió Filtros pero volvió a dejar cinco campos. Se conservaron aserciones y mediciones. El ajuste medido deb9797 usa lista de 250 y margen de pista 0; el mismo caso pasó con seis campos y cuatro zonas intactos. No es una tanda final de diez, 17 o 147 verdes.

Las 48 capturas están completas: 24 antes y 24 después, con la misma fixture B de 50 filas/seis columnas y cinco promedios, usando referencias/hashes finales suministrados al ejecutar. Se copiaron byte por byte y se conservaron tres fases de preparación fallidas —contador por idioma, manifest de fuente anterior y foco esperado incorrecto del probe— sin atribuirlas a producto. El antes exitoso no se repitió. CI del head final sigue pendiente; no se declara una tanda final de 147 o diez verdes. La [evidencia provisional por fases](../evidence/sim-2c-campos-simples-2026-11-20.md) conserva esos resultados y evita transferir verdes a otra composición, plataforma o main.
