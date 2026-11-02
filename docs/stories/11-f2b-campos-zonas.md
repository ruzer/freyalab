OBJETIVO · FreyaLab · Historia 11 · F2b: campos y zonas (modelo tabla dinámica de Excel) + pulido de usabilidad de F2a

Autor del diseño: Claude (diseño UX/UI y criterios). Implementa Codex. Decide y fusiona el propietario.
Referencia visual PRINCIPAL (solo visual; no reutilizar su JavaScript): /private/tmp/freyalab-design-refs/freyalab-pivot-combinado.html
Referencia secundaria: docs/design/gemini-pivot-prototype.html (ya en main).
Primer commit: copia la principal SIN editarla a docs/design/freyalab-pivot-combinado.html y anota su SHA-256 en la historia.

## 0. Por qué (léelo, guía las decisiones dudosas)
F2a dejó el resultado primero, pero para cambiar QUÉ se grafica el usuario todavía debe abrir «Más opciones» y usar el formulario viejo. El propietario piensa en tablas dinámicas de Excel: ve una lista de campos y los coloca en Filas, Columnas, Valores y Filtros. F2b entrega eso. Regla de oro: **un usuario que nunca usó la app obtiene un gráfico distinto en 2 acciones o menos, sin leer nada**. Una «acción» es un arrastre, un clic o una elección de menú.

## 1. Alcance de F2b (un PR en borrador, base main; DETENTE al terminar)
Incluye: A) lista de campos, B) zonas, C) «Resumir por», D) estados y arranque, E) textos en lenguaje llano, F) muchos grupos, G) barra superior legible, H) accesibilidad y pruebas.
NO incluye: arrastre (F2c), conversión de montos/porcentajes (F2b-2, otro PR; aquí solo el aviso y la ruta ya existente, ver §6), varios valores a la vez, tableros guardados, tipos de gráfico nuevos, cambios de motor/IPC/guardado, dependencias, red.
El estado de zonas es una VISTA de `ChartOptions`: misma fuente de verdad (`options`), sin segundo estado paralelo. Reutiliza `suggest()`, `chartSQL`, `chartPivot`, `ChartPresets`. El resultado debe seguir siendo idéntico al del formulario con las mismas opciones (equivalencia sobre `chartSQL`, la prueba de 67 SHA-256 sigue verde y se amplía).

## 2. Anatomía de pantalla (≥1100 px, como el prototipo)
- Izquierda: resultado (título, línea de estado, botones de tipo + motivo, gráfico, tabla dinámica con fila Total, «Más opciones»).
- Derecha, 280 px (mínimo 240): panel **Campos** arriba y **Organiza tu análisis** (4 zonas) abajo. El panel se desplaza por dentro; el resultado nunca.
- 900–1100 px: panel de 240 px. **<900 px:** el panel pasa a un botón «Campos y zonas» sobre el gráfico que despliega el panel a ancho completo (cerrado por defecto cuando ya hay resultado). Nunca una tira vertical de 12 controles.
- 1280×720 y 1440×900, claro y oscuro: con ≤5 grupos se ve sin desplazar la región de resultado: título, tipos, gráfico (alto entre 170 y 300 px según la ventana), cabecera de tabla, filas y Total. Con más grupos la tabla pagina (5 por página, ya existe) y el pie de paginación sigue visible.
- Quitar el encabezado «Resumen y gráfico» con la X (redunda con la pestaña; vimos que sobra a 1440). La pestaña es la única navegación.

## 3. Componentes (qué son y cómo se comportan)

### 3.1 Lista de campos
- Buscador arriba («Buscar campo…», filtra por subcadena sin acentos ni mayúsculas, anuncia «N campos» en aria-live).
- Grupos con encabezado: **Categoría**, **Número**, **Fecha**, **Texto (sin número reconocido)**. Un grupo vacío no se muestra. Los tipos salen de los perfiles/`suggest` existentes; no hay detector nuevo.
- Cada fila: nombre (una línea, elipsis + `title` con el nombre completo), insignia de tipo y botón «Añadir a…». La insignia de un campo de texto que parece monto o porcentaje (dato de perfil si existe; si no, solo «Texto») lleva borde ámbar y tooltip «Parece un monto o un porcentaje».
- Hasta 200 columnas sin virtualizar; el buscador es la ruta para encontrar una.
- El botón «Añadir a…» siempre visible (también táctil), alto ≥ 28 px. Abre un menú: **Añadir a Filas / Columnas / Valores / Filtros**; la zona recomendada va primero y con «(recomendado)». Flechas navegan, Enter elige, Esc cierra y devuelve el foco al botón. Una zona no válida para ese campo aparece deshabilitada con motivo (ver 3.3).
- Atajos: Enter sobre la fila abre el menú; doble clic sobre la fila añade a la zona recomendada. Recomendada: Número → Valores; Categoría/Texto → Filas (o Columnas si Filas ya tiene un campo); Fecha → Filas.
- Un campo ya colocado se marca con ✓ y su botón dice «Mover a…». (Un campo puede estar a la vez en Filas y en Filtros; en Filas y Valores no hace falta bloquearlo.)

### 3.2 Zonas: Filas, Columnas, Valores, Filtros
- Cada zona: título + chips + texto vacío («Arrastra o usa «Añadir a…»»; en F2b la palabra «Arrastra» solo si F2c existe: **hasta F2c dice solo «Usa «Añadir a…»»**).
- Límites de F2b (dilo en pantalla cuando se alcancen, sin error): una sola cosa en Filas, una en Columnas, un Valor, varios Filtros. Colocar un segundo campo en una zona de uno **reemplaza** al anterior y anuncia «Producto reemplaza a Región en Filas». Segundo Valor: se reemplaza y, en la línea de ayuda, «Por ahora un valor a la vez».
- Chip: `[nombre] [▾ Resumir por] [×]`. El × tiene `aria-label` «Quitar {campo} de {zona}».
- Fecha en Filas: el chip lleva «Agrupar por: Mes ▾» con Día/Semana/Mes/Año (usa `chartTimeGroups`; por defecto lo que proponga `suggest`).
- Botones de zona: **Intercambiar filas y columnas** (⇄) y **Limpiar todo**. Limpiar todo no borra nada del archivo: deja las zonas vacías y muestra el estado de arranque (§4).

### 3.3 «Resumir por» (solo en el chip de Valores)
- Opciones y nombres: Suma, Cuenta, Promedio, Mínimo, Máximo, Mediana (los que ya admite `chartSQL`; sin «COUNT/AVG»).
- Por defecto: campo numérico → Suma; cualquier otro → Cuenta.
- Un campo de texto/categoría solo admite Cuenta: las demás opciones salen deshabilitadas con «Este campo es texto; solo se puede contar». No ocultar opciones.
- Cambiarlo actualiza el resultado de inmediato y anuncia «Resumen cambiado a Promedio».
- Totales: nunca suma de promedios/medianas/mín/máx (ya lo hace el motor: «Total (recalculado)»). «% del total» solo para Suma y Cuenta. Mantener.

## 4. Estados y arranque
- **Arranque (CSV recién abierto, sin configuración previa):** las zonas ya vienen llenas con la sugerencia de `suggest()` (primera categoría en Filas, primer número en Valores con Suma; si no hay números: contar por la primera categoría). El usuario ve un gráfico real al abrir la pestaña.
- **Vacío (tras «Limpiar todo» o sin sugerencia posible):** «Elige qué quieres ver: coloca un campo en Filas y un número en Valores.» + botón primario **«Empezar con una sugerencia»**.
- **Cargando:** «Calculando el resultado…» + Cancelar (existe). **Error:** «No se pudo calcular el resultado. El archivo no se modificó.» + Reintentar. **Archivo grande (manual):** botón «Generar» + Cancelar (existe en F2a).
- En todos: foco predecible tras cada cambio (queda en el control usado; tras Cancelar vuelve al botón de tipo activo, ya existe).

## 5. Textos exactos (español; inglés natural con el mismo registro; sin «columna 1», sin «perfil», sin «Revisión», sin «utilizables»)
Motivo bajo los botones de tipo (reemplaza las claves `charts.suggest.*`; conserva las claves, cambia el texto; `{x}` y `{y}` entre comillas angulares «»):
- textNumber: «Sugerido: compara {medida} de «{y}» por «{x}».» donde {medida} = la suma/promedio/etc. activo.
- dateNumber: «Sugerido: sigue «{y}» {por mes|por día|por año}.»
- twoNumbers: «Sugerido: cada punto es una fila; sirve para ver si «{x}» y «{y}» se relacionan.»
- textOnly: «Sugerido: cuenta cuántas filas hay por «{x}».»
- numberOnly: «Sugerido: muestra cuántas filas caen en cada rango de «{x}».»
- twoTexts: «Sugerido: cuenta las filas de cada combinación de «{x}» y «{y}».»
- distribution: «Sugerido: compara cómo se reparte «{y}» dentro de cada «{x}».»
- distributionNeedsEvidence / TooFew: «Para comparar el reparto hace falta que cada grupo tenga varias filas. Se muestran barras.»
- conservative: ««{campo}» se lee como texto y no se puede sumar. Úsala como etiqueta o conviértela a número.»
- Si el usuario elige un tipo distinto al sugerido: «Elegiste {tipo}. Antes: {sugerido}.» (una línea, sin regañar).
Título del resultado: «{Resumen} de {campo} por {fila} · separado por {columna}» (como en el prototipo).
**Línea de estado** (una sola, sin «·» pegados, con espacios): «{n} filas · {g} grupos · El archivo no se modifica». Si el alcance no es el documento completo: «Solo filas filtradas» / «Vista guardada» antes del recuento. «Gráfico listo.», revisión, «omitidas del cálculo», «series representadas», «elementos», «utilizables» pasan al **popover ⓘ** («Detalles del cálculo»), que sí conserva todo el rigor técnico actual. Se anuncia por aria-live solo el cambio de estado («Resultado actualizado: 4 grupos»), no toda la línea.
Aviso de monto/porcentaje: ««{campo}» tiene valores como «10%», que son texto. No se pueden sumar tal cual.» + enlace «Usar como número…» (ver §6).

## 6. Conversión de montos y porcentajes
F2b NO convierte nada. Lo único que hace: mostrar el aviso de arriba y, en «Usar como número…», abrir la opción YA existente (`measureType: 'number'`, conversión explícita con punto decimal) si el campo contiene solo números en texto; si contiene «$», «%» o separadores ambiguos, el cuadro dice «Todavía no se pueden convertir símbolos como $ o %. El archivo no cambia.» con botón Cerrar. La política completa (patrones, ambigüedad coma/punto, confirmación con 3 ejemplos antes→después, conteo de valores omitidos) es **F2b-2**, PR aparte que yo diseño tras revisar este.

## 7. Muchos grupos (el caso de 100+ barras ilegibles)
- Barras y mapa de calor con más de 10 grupos en el eje de categorías: dibujar los **10 mayores** (orden descendente por valor) y, **solo si la medida es aditiva (Suma o Cuenta)**, una barra final «Otros». Con Promedio/Mínimo/Máximo/Mediana: dibujar solo los 10 mayores y decirlo; **nunca** calcular un «Otros» de una medida no aditiva.
- Aviso sobre el gráfico (una línea, role=status): «Hay {n} grupos. Se dibujan los 10 mayores{ y «Otros»}. La tabla de abajo los muestra todos.» + enlace «Elegir otro campo en Filas».
- La tabla dinámica siempre contiene todos los grupos devueltos (paginada de 5 en 5; permite 10/25/50 por página). Si el motor ya devolvió un resultado limitado/truncado, se conserva el aviso de truncado actual y **no** se calcula «Otros».
- Líneas por tiempo, dispersión, histograma y caja: sin Top 10 (ya tienen sus límites).
- Es presentación pura (en `chart-pivot`/adaptador del gráfico); `chartSQL` normal no cambia.

## 8. Barra superior legible
Hoy los botones de la barra son iconos sin nombre (flecha, ⌘, gráfico). Cada botón solo-icono lleva: `aria-label` y tooltip visible al pasar/foco (≤500 ms) con nombre y atajo («Ir a la fila  ⌘G»). A ≥1280 px mantener visible la etiqueta de «Filtrar» y «Reemplazar» si caben; el resto, solo icono con tooltip. El botón «Analizar» (icono de gráfico) abre estadísticas y SQL del dock: renómbralo «Estadísticas y SQL» y dile al propietario en el informe si te parece redundante con la pestaña (decide él; no lo elimines).

## 9. Accesibilidad y calidad visual (obligatorio)
- Orden de tabulación: buscar campo → lista → zonas → botones de tipo → resultado → Más opciones. Foco visible en todo.
- Menú «Añadir a…» con roles `menu`/`menuitem`; resultados anunciados en aria-live (es/en): «Ventas añadido a Valores», «Producto reemplaza a Región en Filas», «Región quitado de Filas», «Resumen cambiado a Promedio», «Filas y columnas intercambiadas», «Análisis limpiado», «Resultado actualizado: 4 grupos».
- Áreas táctiles/clic ≥ 24×24 px (WCAG 2.2 AA 2.5.8); contraste de texto ≥4.5:1 y de series/UI ≥3:1 en claro y oscuro (valida con el validador de la skill `dataviz` si existe; si no, di que no existe). Series: color + trama (ya hecho, no regresar).
- es / en / en-XA: ningún texto cortado sin tooltip. Ventana estrecha (<900 px) y teclado solo: el flujo completo funciona.
- Respeta `prefers-reduced-motion`; sin animaciones nuevas.

## 10. Criterios de aceptación (medibles)
1. CSV recién abierto → pestaña «Resumen y gráfico» muestra un gráfico y su tabla **sin** ninguna acción.
2. Barras, Líneas (con una columna de fechas) e histograma por un camino de ≤2 acciones desde el estado inicial, sin abrir «Más opciones».
3. Solo con teclado se logra lo mismo, y cada acción se anuncia (texto exacto de §9).
4. «Resumir por» cambia el cálculo; Total y % del total cumplen §3.3; los números coinciden con el formulario viejo para las mismas opciones (equivalencia `chartSQL`).
5. Con 842 grupos el gráfico es legible (Top 10 + Otros solo si aditiva) y la tabla conserva todo.
6. Ningún texto de §5 contiene «columna N», «perfil», «Revisión», «omitidas», «utilizables» fuera del popover ⓘ.
7. 1280×720 y 1440×900, claro y oscuro: sin desplazamiento de la región de resultado con ≤5 grupos; estado estrecho (<900 px) usable.
8. Todos los controles de F2a (tipos, exportaciones SVG/PNG/PDF, zoom, configuraciones guardadas, Ver consulta, Estadísticas/SQL) siguen funcionando.
9. Sin cambios en guardado/IPC/CSV canónico, sin dependencias, sin red; el archivo original queda intacto (prueba de que las consultas no escriben).

## 11. Proceso (igual que F2a)
- Rama `codex/analitica-campos-zonas-f2b`, PR en borrador base main, **antes de escribir interfaz** publica en el PR el alcance en bloques y las siete respuestas del ADR 0021.
- Prueba que falla primero: lógica pura (`addToZone`/estado↔`ChartOptions`, recomendada por campo, reemplazo de zona, Top 10 + Otros con medidas aditivas y no aditivas, textos de §5 por clave y por idioma) y E2E (criterios 1–3 y 5, teclado, aria-live, estrecho, en-XA). Registra rojo→verde.
- Usa de verdad las skills de diseño/UX/accesibilidad/visualización de datos, TDD y ponytail; si una no existe, dilo en el informe.
- Informe con capturas antes/después (1440×900 y 1280×720, claro y oscuro, estrecho, en-XA, estados vacío/cargando/error/muchos grupos) y **lista honesta de lo no verificado** (lector de pantalla manual, Intel, etc.). CI de los tres sistemas de PR.
- DETENTE tras F2b: no arrastrar (F2c), no conversión de montos (F2b-2). No fusiones, no publiques versiones.
- Si algo de este documento choca con el código real o con una decisión previa, NO lo resuelvas en silencio: dilo en el informe con la evidencia.
