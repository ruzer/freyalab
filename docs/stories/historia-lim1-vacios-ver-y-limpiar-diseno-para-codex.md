# LIM-1 — Vacíos: verlos y limpiarlos

Público (decisión del propietario, 2026-11-11): análisis de datos para prepa, universidad y maestría, sin complicar. Esta historia cubre lo que en pandas sería `isnull()`, `fillna()` y `dropna()`, con clics y sin escribir código. Depende de AN-2 (Información) y respeta PRJ-01 (fuentes protegidas).

## Historia
Como estudiante que limpia un dataset, quiero ver cuántos datos faltan en cada columna y, con un clic, ver esas filas, rellenarlas o quitarlas, con vista previa y deshacer, para preparar los datos sin estropear el resto del archivo.

## Qué hay hoy (main a8dfc7f)
- **Detectar:** Información (AN-2) muestra «Vacíos» por columna, con el desglose Ausentes, Vacíos exactos y Solo espacios. Un CSV no tiene null: ausente y vacío exacto equivalen al NaN de pandas, y «solo espacios» para pandas es texto.
- **Filtrar:** el filtro «Está vacío» (`src/main/table-query.ts:15`) cuenta exactamente esos tres casos: `!(cells[col]??'').trim()`.
- **Editar:**
  - Las ediciones de rango llevan la consulta de la vista (`TableRange.query`) y tienen las operaciones `fill`, `clear`, `trim`, `upper`, `lower`, `replace` y `paste`, con vista previa (`CsvRangePreview.svelte`) y un paso de deshacer.
  - Ya existen operaciones de columna con vista previa: «Mayúsculas en la columna…» y «Quitar espacios en la columna…».
  - «Eliminar filas seleccionadas» necesita las filas marcadas una a una.
- **El problema:** hoy rellenar los vacíos exige filtrar, seleccionar el rango y rellenar. Si se olvida el filtro, «Rellenar rango» sobrescribe datos buenos.

## Diseño UX
**Ver (Información, sección de AN-2).**
- La columna «Vacíos» muestra el recuento y el porcentaje: «3 · 43 %».
- Las columnas sin vacíos muestran «0», sin acciones.
- El desglose desplegable de cada columna con vacíos termina con tres acciones:
  - **«Ver filas vacías»:** te lleva al CSV filtrado por «Está vacío» en esa columna. Es un filtro de vista y no cambia nada.
  - **«Rellenar vacíos…»**.
  - **«Eliminar filas con vacío…»**.
- **La pestaña de análisis no edita.** «Rellenar» y «Eliminar» te llevan a la pestaña del CSV y abren allí su diálogo.

**También desde el CSV.**
- En el menú del encabezado de columna: «Rellenar vacíos de la columna…» y «Eliminar filas con vacío en la columna…».
- En la paleta, con las palabras: vacíos, nulos, faltantes, isnull, fillna, dropna.

**Diálogo «Rellenar vacíos de Cantidad».**
- **Rellenar con:**
  - «Un valor» (campo de texto): se escribe tal cual, como texto. `0` queda `0` y `00` queda `00`.
  - «El valor anterior»: el último valor con contenido que hay más arriba **en el orden del archivo**, no en el orden de la vista. Si no hay ninguno arriba, la celda queda vacía y se cuenta aparte.
- **Casilla «Contar las celdas con solo espacios como vacías»**, marcada al empezar.
- **Vista previa:**
  - «Se rellenarán 3 celdas: 1 vacía, 1 con solo espacios y 1 que faltaba (la fila era más corta)».
  - Hasta 5 filas de ejemplo, antes y después.
  - En «El valor anterior», también: «1 queda vacía porque no hay valor anterior».
- **Botones:** «Rellenar» y «Cancelar».
- **Al aplicar:** un solo paso de deshacer, sin guardar hasta pulsar Guardar.

**Diálogo «Eliminar filas con vacío».**
- **Dónde mirar:**
  - «En Cantidad» (por defecto).
  - «En las columnas marcadas», con «si falta en cualquiera» o «si faltan en todas».
- **La misma casilla** de solo espacios.
- **Vista previa:** «Se eliminarán 3 de 7 filas», con hasta 5 filas de ejemplo.
- **Al aplicar:** un paso de deshacer.

**Después de aplicar.** La pestaña de análisis abierta avisa «Los datos cambiaron · Actualizar» (comportamiento de AN-1). Los resultados viejos no se quedan sin aviso.

**Cuándo no se puede.**
- **Fuente protegida de un proyecto:** acciones desactivadas con el motivo «Fuente protegida: usa Guardar como… y limpia la copia». «Ver filas vacías» sí funciona.
- **Archivo grande (solo lectura):** desactivadas con el motivo «Para archivos grandes, usa Extraer filas con la condición “No está vacío”». Esa extracción ya existe.
- **Documento con cambios de Texto sin confirmar:** aparece el mismo diálogo de cambio de vista de siempre.

**Textos y accesibilidad.** Lenguaje de tarea, sin «NaN» ni «null» en la interfaz. La ayuda del desglose dice una vez: «En pandas, “ausente” y “vacío” serían NaN; “solo espacios” sería texto». Diálogos con foco inicial, Escape, anuncios del recuento y textos en es, en y en-XA.

## Contrato técnico
- **Rellenar:** reutiliza la edición de rango con la consulta «Está vacío» sobre la columna, o añade una operación `fillEmpty` si eso no completa los campos ausentes. Documenta cuál y por qué.
- **El valor anterior:** necesita su propia operación (`fillPrevious`), que recorre el orden del documento. Es determinista.
- **Eliminar:** usa una operación por consulta (por ejemplo, `deleteRowsWhere` con la condición), no una lista de identificadores enviada desde la interfaz. Debe valer hasta los límites de edición (50 MiB y 2 millones de celdas).
- **Integridad:** las celdas y columnas no afectadas quedan **idénticas**. También se conservan `00123`, los identificadores largos, los campos multilínea, el BOM y los finales de línea.
- **Completar un campo ausente** alarga solo esa fila hasta esa columna. No inventa campos vacíos en otras columnas.
- **Validación:** IPC validado con zod, como las demás ediciones.
- **Sin dependencias nuevas.**

## Aceptación (fixture)
```
Producto,Precio,Cantidad,Alta,Mixta
a,10,1,2026-01-02,1
b,20,2,2026-03-04,x
a,30,3,2026-02-01,1
c,40,4,2026-01-15,
a,,,2026-02-20,
a,50,"  ",2026-01-30,
d,60
```
1. En Información, Cantidad muestra «Vacíos 3 · 43 %», con el desglose 1 ausente, 1 vacío exacto y 1 solo espacios. Precio muestra 1 y Mixta 4.
2. «Ver filas vacías» de Cantidad abre el CSV con 3 filas visibles (5, 6 y 7) y sin cambios pendientes.
3. «Rellenar vacíos» de Cantidad con `0`:
   - La vista previa dice 3 celdas (1 vacía, 1 solo espacios, 1 que faltaba).
   - Al aplicar, las filas 5, 6 y 7 tienen `0` en Cantidad. La fila 7 queda `d,60,0`.
   - El resto de bytes no cambia.
   - Deshacer devuelve el archivo idéntico (hash).
4. Con la casilla de espacios desmarcada se rellenan 2 celdas, y la fila 6 conserva `"  "`.
5. «El valor anterior» en Cantidad rellena las filas 5, 6 y 7 con `4`. Si la primera fila de datos estuviera vacía, la vista previa diría «1 queda vacía».
6. «Eliminar filas con vacío» en Cantidad deja 4 filas. Con Precio y Cantidad marcadas: «en cualquiera» elimina 3 filas y «en todas» solo 1 (la 5).
7. Un paso de deshacer por acción. Guardar escribe exactamente lo que muestra la vista previa (comprueba los bytes, con CRLF y con BOM).
8. Con fuente protegida, archivo grande o cambios de Texto sin confirmar, se cumple lo de «Cuándo no se puede».
9. En la paleta, «fillna», «dropna» e «isnull» encuentran las tres acciones.
10. Con la pestaña de análisis abierta, después de rellenar aparece el aviso de datos cambiados, y al recalcular los números son los nuevos.
11. Teclado de principio a fin. Capturas en claro y oscuro, en es y en-XA, a 1440×900.

## Casos límite
- Una columna con todo vacío: «Rellenar» funciona y «El valor anterior» deja todo vacío, con su recuento.
- Encabezados duplicados o vacíos: se actúa por posición y en el texto se nombra la columna con su número.
- Filtros activos en la tabla: los diálogos actúan sobre el documento completo y lo dicen («Se aplica a todo el documento, no solo a la vista filtrada»). Una casilla «Solo en las filas visibles» queda fuera de esta versión.
- Más de 100 000 filas afectadas: progreso y cancelación, como en las transformaciones.

## Fuera de alcance
- Rellenar con la media, la mediana o la moda (inventa valores: decisión aparte).
- Rellenar como paso de receta de proyecto (PRJ-02), sin tocar la fuente.
- «Solo en las filas visibles».
- Marcar valores centinela como vacíos (por ejemplo, «N/A», «-», «999»).

## Entrega
Un PR en borrador, base `main`, rojo primero con el fixture. Copia esta historia a `docs/stories/`. Informa: SHA, pruebas rojas y verdes con su salida, capturas, la comprobación de bytes y la CI de las tres plataformas.
