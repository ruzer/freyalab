# SIM‑3d · Decimales y copia · Decisión del propietario, 2026‑11‑23

Este anexo registra la decisión posterior a la [historia SIM‑3](historia-sim3-resultados-correctos-diseno-para-codex.md) y sustituye el contrato previo de precisión/copia de SIM‑3d. No modifica la historia compartida por 3a/3c. Se mantiene un único PR en borrador, #214, base main; la entrega se desarrolla por bloques dentro de ese PR.

## Decisión vigente

- Selector global **«Decimales»**, opciones **«2»** y **«Todos»**, encima de los resultados de Análisis. Valor inicial **2**, persistido por el mismo sistema de Ajustes que Tema, no por otra preferencia local.
- Se aplica a los valores numéricos de Información, Estadísticas principales, Más estadísticas y **la tabla de resultados de Gráficos**. Los subpaneles ya montados deben reflejar el cambio sin volver a analizar los datos.
- En modo2 se muestran **hasta dos decimales**, sin rellenar ceros: 12 se presenta como12, no12.00. Para 0<abs(valor)<0.01 se usan hasta dos cifras significativas. Un valor no nulo nunca se presenta como0 por redondeo; el cero negativo se presenta como0.
- «Todos» muestra hasta15 cifras significativas. No promete precisión infinita: 0.1+0.2 se presenta como0.3, sin el ruido binario final.
- La ayuda numérica y la copia usan el valor completo de presentación, hasta15 cifras significativas, con su unidad. La copia no depende del modo2/Todos y no añade separadores de millares al número copiado.
- **Todo número marcado que intersecte la selección se copia completo**, aunque solo se haya seleccionado una parte de sus caracteres. Si hay varios, todos se copian completos. Texto restante, etiquetas, identificadores y separadores nativos de fila/celda permanecen iguales. No hay botones nuevos de copia.
- No cambian cálculos, datos fuente, valores crudos ni exportaciones CSV/JSON. Los informes siguen su ruta existente; no se redondea el objeto de resultado para modificar una pantalla.

La antigua regla «parcial o varios→copiar visible» y la línea fija «Cifras redondeadas a 2 decimales. Al copiar un valor completo se copia exacto.» quedan **supersedidas**. Sus rojos, controles y capturas se conservan como evidencia de la fase anterior, no como oráculos del nuevo contrato. Se mantienen el ejemplo explícito5.52264150943→5.52 y los datos de media140/9, porcentaje, identificadores y unidades, actualizando únicamente la expectativa de precisión/copia autorizada.

## Reutilización mínima y límites

El formateador compartido seguirá basándose en `formatNumber`/Intl. Se propone una pequeña función pura para elegir máximo2decimales, la excepción de cifras pequeñas y máximo15significativas; otra salida pura produce texto de copia/ayuda con15significativas y unidad. No hay detector de tipos nuevo, motor matemático, regex de números sobre texto, dependencia o IPC nuevos.

La copia recibe fragmentos tipados: texto literal o número calculado con unidad. Solo el renderer marca valores de resultados que **ya sabe numéricos**. «00123», «90071992547409931234», nombres, fechas y frecuencias textuales no se convierten por parecer números. SQL conserva su resultado crudo; no se incorpora su tabla a este selector sin una decisión adicional. No se cambia `formatChartNumber` global porque también alimenta ejes, tooltips e imágenes: el carril autorizado es la tabla de Gráficos.

El adaptador DOM se propone en la raíz visible de AnalysisWorkspace. Al recibir un evento nativo de copia, recorre solo metadatos numéricos de los resultados seleccionados. Para conservar tabs y saltos de fila usa **Selection.toString()**, no Range.toString() como serializador de filas. Puede serializar los segmentos no numéricos por rangos de forma síncrona, pero guarda y restaura en finally los rangos, anchor/focus y la selección inversa antes de devolver el evento. No hay await, timer, consulta, lectura de archivo o cambio persistente durante copiar. No toma selecciones de inputs/editores, paneles ocultos, otras pestañas o la tabla CSV. La precisión se sustituye solo en los fragmentos numéricos marcados.

Esta propuesta necesita E2E real de una fila con varias celdas numéricas, unidad%, texto/ID sin metadato y selección parcial. Debe comprobar clipboard real, separadores exactos y selección intacta después de copiar. Un test puro de ensamblar fragmentos no prueba por sí solo la serialización DOM.

## Persistencia y coordinación

Se propone un campo único `decimalesAnalisis: 2 | 'all'` junto a Tema. El esquema de lectura debe aceptar settingsv1 que no lo contienen y aportar2 sin perder otras preferencias. El esquema de **patch** no puede inyectar un default al cambiar solo Tema: la nueva propiedad es opcional allí. Se conserva el trato de archivos de versión futura como solo lectura.

CONTRIBUTING exige que un ajuste nuevo tenga esquema, default único, fila accesible/traducida en Ajustes y prueba de persistencia. La fila de Apariencia y el selector de Análisis compartirían exactamente el mismo campo/callback. También debe incluirse el campo en el reset de Apariencia, cuya lista actual es explícita; reset total usa defaultSettings. No se añade almacenamiento renderer ni otra fuente de verdad.

App solo pasa la preferencia y el callback existentes a AnalysisWorkspace; este distribuye la política a los subpaneles o a un pequeño componente numérico común. main/preload y el evento de preferencias ya son genéricos. No se modifican antes de publicar el alcance. App se coordina con3c e incorpora main normalmente antes de su hunk; CsvTable permanece fuera del bloque y los motivos de filas siguen diferidos hasta3a/3c fusionados.

La propuesta de texto visible del selector y su ayuda se consolidará con los catálogos es/en y en‑XA generado. El texto fijo anterior no puede permanecer cuando el modo seaTodos ni describir la nueva copia parcial como copia visible.

## Puerta de evidencia

Antes del nuevo wiring: alcance/anexo y siete respuestas publicados por raíz en el mismo borrador. Las unitarias nuevas pueden registrar el rojo convencional de una función pura todavía ausente; **un fallo de importación no prueba un bug de UI** y no se fabricará un adaptador sin uso solo para obtener rojo.

Se requiere además rojo funcional sobre el bundle actual:0.0004123 mostrado como0, selector ausente y copia múltiple/parcial con la política anterior. Después se comprueban2/Todos, cambio entre los cuatro paneles, persistencia/reinicio/reset/ajustesv1/futuro, ausencia de nuevos cálculos por alternar formato y clipboard real con todos los separadores. No se cambian plazos, retries o datos para llegar al resultado.

CSV/JSON se comparan antes/después del selector para preservar cadenas, precisión, encabezados y fuente; las pruebas actuales de informes siguen intactas. Las capturas anteriores quedan históricas; la nueva matriz se registra en es/en‑XA, claro/oscuro,1440×900 y1280×720. No se declara verde nuevo, CI, instalación o merge por esta propuesta.
