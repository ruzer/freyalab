# PRJ-01c — La pestaña «Proyecto» como árbol, con las acciones en un menú

Público (decisión del propietario, 2026-11-11): análisis de datos para prepa, universidad y maestría, sin complicar.
- **Qué hace:** rediseña la pestaña «Proyecto» que crearon PRJ-01a/01b y que ampliaron PRJ-02a/02b. No cambia qué se puede hacer, solo cómo se presenta.
- **Orden:** va antes de PRJ-03, para que «Exportar…» y los archivos exportados entren en el árbol y en los menús y no como botones nuevos.
- **Maqueta:** la vio el propietario, pero es privada y no hace falta abrirla. Esta historia es la referencia completa.

## Por qué
Hoy, con 1 fuente y 3 conjuntos encadenados, la pestaña muestra **24 botones y 11 líneas de estado** (`ProjectPanel.svelte`):
- **Botones en cada fila:** cada fuente tiene 6 (Abrir, Analizar, Mostrar en la carpeta, Volver a registrar, Nuevo conjunto… y Quitar del proyecto) y cada conjunto 5 (Abrir, Analizar, Nuevo conjunto…, Renombrar y Eliminar).
- **Estados que no avisan de nada:** «Listo» y «Verificada» aparecen aunque no pase nada, y «Protegida» se repite en cada fuente.
- **Fuente repetida:** el nombre de la fuente vuelve a salir como título en la sección «Conjuntos».
- **Motivos siempre a la vista:** cada botón desactivado ocupa una línea con su motivo, aunque nadie intente usarlo.

Con PRJ-03, cada archivo exportado sumaría 4 botones más.

**Referencias revisadas:**
- **Power Query de Excel («Consultas y conexiones»):** lista de nombres con filas cargadas; las acciones van en el menú contextual.
- **VS Code (guías de vistas):** no más de tres acciones por elemento; el resto, en el menú contextual, con grupos siempre en el mismo orden.
- **Power BI:** el botón «…» aparece al pasar el cursor.
- **PatternFly y Primer:** un menú de más acciones solo con más de dos acciones, y sin esconder información.
- **Apple HIG:** la barra lateral sirve para moverse y tiene filas fijas.

## Reglas de diseño (propuestas por Claude; el propietario pidió esta historia el 2026-11-17)
1. La barra lateral sirve para moverse; las acciones van en el menú de cada fila.
2. Cada fila lleva icono, nombre y una línea de detalle. Clic o Intro abre.
3. Hay un solo «⋯» por fila, visible en la fila seleccionada, al pasar el cursor o al enfocarla. El mismo menú se abre con clic derecho, Mayús + F10 o la tecla de menú.
4. Todo va en un solo árbol: fuente → conjuntos (anidados por base) → archivos exportados (PRJ-03).
5. Lo normal no se escribe. Solo se muestran los problemas, cada uno con su única acción para resolverlo.
6. «Protegida» se dice una vez, bajo «Fuentes».
7. Lo no disponible sigue en el menú, desactivado y con su motivo debajo. «Quitar» y «Eliminar» van al final y separados.

## Qué hay hoy (main d17cc81)
- **`src/renderer/components/ProjectPanel.svelte` (137 líneas):**
  - Cabecera: nombre, ruta completa visible, «Renombrar proyecto» y «Cerrar proyecto».
  - Sección «Fuentes»: «Añadir fuente…» y una lista con todos los botones por fuente.
  - Sección «Conjuntos»: listas anidadas por fuente.
  - El progreso de huella se muestra arriba, de forma global.
  - Diálogo de confirmación para eliminar un conjunto.
  - Renombrado en línea con un formulario.
- **Patrones de la casa que se reutilizan:**
  - Las filas del árbol de «Archivos» (`Tree.svelte`, clase `tree-item`, chevrons e iconos).
  - El menú contextual de `CsvFileMenu.svelte`: `role="menu"`, foco en el primer elemento, flechas, Inicio, Fin y Escape, y cierre al pulsar fuera.
  - Los motivos de desactivación con `controlHint` y `ui.reason`.
- **E2E que usan los botones del panel:** `project.spec.ts`, `project-source.spec.ts`, `project-subsets.spec.ts` y `project-subset-analysis.spec.ts`.

## Diseño UX

### Estructura, de arriba abajo
1. **Cabecera del proyecto:**
   - El nombre del proyecto en negrita, con la ruta completa en el título (tooltip). La ruta deja de ocupar líneas.
   - A la derecha, «⋯» («Acciones del proyecto»), con este menú:
     - «Renombrar proyecto».
     - «Mostrar en la carpeta»: **nuevo**; revela `proyecto.freyalab` en el explorador del sistema.
     - Separador.
     - «Cerrar proyecto».
2. **Encabezado «Fuentes»:** en versalitas pequeñas, con «+» a la derecha (`aria-label` «Añadir fuente…»).
   - Debajo, una sola línea gris con un candado: «FreyaLab no modifica las fuentes.» Su título muestra el texto completo de `project.source.protected`.
3. **El árbol:** cada fuente; dentro, sus conjuntos anidados por base; y dentro de cada conjunto, sus archivos exportados cuando llegue PRJ-03.
   - Desaparece la sección «Conjuntos» con títulos de fuente.
   - Los conjuntos cuya fuente raíz no existe se agrupan al final, bajo «No disponibles» (el texto actual).
4. **Estados vacíos:**
   - Sin fuentes: «Todavía no hay fuentes.», con el «+» del encabezado.
   - Una fuente sin conjuntos no muestra nada más.

### Una fila
- **Icono:** tabla para una fuente, embudo para un conjunto y documento para un archivo exportado.
- **Nombre:** en peso 500.
- **Detalle:** debajo, en gris y en una sola línea.
  - Fuente: «5 columnas · 211 B».
  - Conjunto: su resumen actual («Edad ≥ 18», «Muestra de 3 filas · semilla 7», «2 columnas»).
- **Nombres largos:** se cortan con «…» y el nombre completo va en el título.
- **Chevron** a la izquierda si la fila tiene hijos. Al empezar, todo el árbol está expandido. El estado de expansión no se guarda en disco.
- **«⋯»** a la derecha («Más acciones de {nombre}»): se ve en la fila seleccionada, al pasar el cursor o al enfocarla. En las demás no ocupa espacio visible, pero el hueco se reserva para que la fila no salte.
- **Fila seleccionada:** fondo de selección del tema. **Al pasar el cursor:** fondo suave.

### Clic, menú y teclado
- **Clic en la fila o Intro:** la acción principal de hoy («Abrir»).
  - Fuente: abre su tabla.
  - Conjunto: abre el panel «Conjunto».
  - Archivo exportado (PRJ-03): abre el CSV.
  - Si «Abrir» no está disponible, el clic solo selecciona la fila, y la línea de problema dice por qué.
- **«⋯», clic derecho, Mayús + F10 o la tecla de menú** abren el menú de esa fila, junto a ella.
- **Navegación del árbol:**
  - Un solo punto de tabulación para todo el árbol, con tabindex itinerante.
  - ↑ ↓: moverse.
  - → : expandir o ir al primer hijo.
  - ← : contraer o ir al padre.
  - Inicio y Fin.
- **Navegación del menú:** igual que en `CsvFileMenu`. Escape lo cierra y devuelve el foco a la fila.

### Menús por tipo
Este es el orden exacto; «—» marca un separador.

| Fila | Menú |
|---|---|
| Fuente | Abrir · Analizar · Nuevo conjunto… — Mostrar en la carpeta · Volver a registrar (o «Buscar en la carpeta del proyecto» si falta) — Quitar del proyecto |
| Conjunto | Abrir · Analizar · Nuevo conjunto a partir de este… — Renombrar — Eliminar |
| Archivo exportado (PRJ-03) | Abrir · Mostrar en la carpeta · Añadir como fuente — Quitar del proyecto |

- **Acciones:** cada una hace exactamente lo que hace hoy su botón, con las mismas confirmaciones, errores y bloqueos.
- **«Nuevo conjunto a partir de este…»:** sustituye al «Nuevo conjunto…» del conjunto, para que se entienda que parte de él.
- **Lo desactivado:**
  - Se queda en el menú con `aria-disabled="true"` y sigue siendo enfocable.
  - Su motivo actual aparece debajo, en gris, enlazado con `aria-describedby`. Por ejemplo: «No se puede quitar: 3 conjuntos parten de esta fuente.», «No se puede eliminar: Muestra estable parte de este conjunto.» o «Máximo 8 niveles».
  - Activarlo no hace nada.
- **«Quitar del proyecto» y «Eliminar»** van en el color de peligro del tema, al final y tras un separador.
- **Proyecto de versión futura (solo lectura):** las acciones que escriben siguen en el menú, desactivadas con el motivo actual (`mutationReason`). «Abrir», «Analizar» y «Mostrar en la carpeta» siguen disponibles.

### Problemas y progreso: lo único que se escribe en el árbol
- **Fuente que cambió:** debajo de la fila, una línea con aviso: «Cambió desde que se registró» (`project.source.status.changed`) y un botón «Volver a registrar».
- **Fuente que falta:** «No está en su ruta» (`project.source.status.missing`) y «Buscar en la carpeta del proyecto».
- **Fuente fuera de la carpeta del proyecto:** no es un problema. El detalle añade «Fuera del proyecto» y el título lleva `project.source.externalNotice`.
- **Fuente por encima del límite de análisis:** el motivo actual (`project.source.overAnalysis`) aparece en «Analizar» del menú, no en el árbol.
- **Conjunto no ejecutable:** su motivo actual, por ejemplo «Las columnas de la fuente cambiaron», sin botón. Se arregla con «Abrir», en el panel.
- **Versión distinta de la fuente:** solo en el título de la fila. Es informativa y no es un problema.
- **Calcular la huella o buscar en la carpeta:**
  - El progreso se muestra en la fila de esa fuente, con «Cancelar». Deja de ser global.
  - El texto actual (`hashProgress`, `searching`) se anuncia en vivo.

### Renombrar
- «Renombrar» (del proyecto o de un conjunto) convierte el nombre de esa fila en un campo de texto, con el foco dentro.
  - Intro guarda.
  - Escape o salir del campo cancela.
- Los errores, como «Ya hay un conjunto con ese nombre», aparecen debajo del campo. Es lo mismo que hace hoy el formulario, pero en la fila.

### Ancho de la barra lateral
Funciona de 240 a 420 px: los nombres y detalles se recortan con «…», los menús no se salen de la ventana y la sangría por nivel es de 16 px.

## Contrato técnico
- **Casi solo la interfaz:**
  - Se cambia `ProjectPanel.svelte` y lo que haga falta en su llamada desde `App.svelte`.
  - Única excepción: un IPC `project:show` que haga `shell.showItemInFolder` del manifiesto del proyecto activo. Valida el id con zod, igual que `project:showSource`.
  - Sin cambios en manifiesto ni motor.
  - Sin dependencias nuevas (ADR 0021).
- **Menú:** reutiliza el comportamiento de `CsvFileMenu.svelte`: posición dentro de la ventana, foco, teclado y cierre.
  - Si conviene, sácalo a un componente compartido de menú contextual y úsalo en los dos sitios, sin cambiar lo que hace hoy en «Archivos».
  - El menú no debe saltarse los elementos con `aria-disabled`: la navegación los incluye.
- **Árbol:** `role="tree"` con `treeitem`, `aria-level`, `aria-expanded` y `aria-selected`, siguiendo el patrón de árbol de WAI-ARIA APG. Los nombres de las filas tienen el mismo estilo visual que `Tree.svelte`.
- **Textos:** claves nuevas en es, en y en-XA. Las claves que dejen de usarse se quitan. Los motivos y confirmaciones reutilizan las claves actuales.
- **Nada se pierde:** ninguna acción de hoy deja de ser alcanzable. Una prueba recorre la lista completa de acciones de hoy y comprueba que cada una está en el menú que le toca.

## Aceptación
Usa el proyecto de las pruebas de conjuntos: fuente `prj02-censo.csv` y los conjuntos «Adultos» → «Muestra estable» → «Identificador y nota».

1. **En reposo:** sin nada seleccionado ni con el cursor encima, la pestaña tiene exactamente **2 botones de acción** («Acciones del proyecto» y «Añadir fuente…»).
   - No aparecen los textos «Listo» ni «Verificada».
   - «Protegida» aparece una vez.
   - La fuente no se repite como título.
2. **Clic:** en la fuente abre su tabla; en «Adultos» abre el panel «Conjunto». El comportamiento es el mismo que hoy con «Abrir».
3. **El mismo menú, de cuatro formas:** «⋯», clic derecho, Mayús + F10 y la tecla de menú abren el mismo menú, con los elementos en el orden de la tabla. Escape lo cierra y el foco vuelve a la fila.
4. **Lo desactivado:**
   - En la fuente, «Quitar del proyecto» aparece desactivado con «No se puede quitar: 3 conjuntos parten de esta fuente.».
   - En «Adultos», «Eliminar» aparece desactivado con su motivo.
   - Los dos son enfocables con las flechas y el lector de pantalla lee el motivo.
5. **Problemas:**
   - Si se modifica la fuente en disco, la fila muestra «Cambió desde que se registró» con «Volver a registrar», que calcula la huella con el progreso en esa fila y «Cancelar».
   - Si se borra la fuente, aparece «No está en su ruta» con «Buscar en la carpeta del proyecto».
6. **Teclado:** Tab entra al árbol una sola vez; ↑ ↓ → ← Inicio Fin funcionan como dice el diseño; Intro abre.
7. **Renombrar en la fila:** el proyecto y un conjunto se renombran en la propia fila. Un nombre repetido muestra el error debajo, y Escape cancela sin guardar.
8. **Proyecto de versión futura:** las acciones que escriben aparecen desactivadas con su motivo; «Abrir» y «Analizar» funcionan.
9. **Todas las acciones siguen ahí.** Una prueba enumera las 14 acciones de hoy, más la nueva «Mostrar en la carpeta» del proyecto, y comprueba que cada una está en su menú:
   - Proyecto: Renombrar y Cerrar.
   - Añadir fuente.
   - Fuente: Abrir, Analizar, Mostrar en la carpeta, Volver a registrar / Buscar, Nuevo conjunto y Quitar.
   - Conjunto: Abrir, Analizar, Nuevo conjunto, Renombrar y Eliminar.
10. **E2E actualizadas sin perder comprobaciones.** Las cuatro specs de proyecto se actualizan para llegar a las acciones por el menú. Mismas aserciones y mismos datos; el número de pruebas no baja.
11. **Ancho:** a 240 y a 420 px de barra lateral no hay desbordes y los menús quedan dentro de la ventana.
12. **Capturas:** claro y oscuro, en es y en en-XA, a 1440×900 y 1280×720. Una en reposo, una con el menú de un conjunto abierto y otra con una fuente que cambió.

## Fuera de alcance
- Arrastrar y soltar, la selección múltiple, buscar o filtrar en el árbol y guardar qué está expandido.
- Cambiar qué hace cada acción o sus textos de confirmación.
- Los archivos exportados y «Exportar…»: llegan con PRJ-03, ya dentro de este árbol y de estos menús.

## Entrega
Un PR en borrador, con base `main`. La prueba va en rojo primero: el criterio 1 (dos botones en reposo) y el 9 (todas las acciones alcanzables).
- Copia esta historia a `docs/stories/` con su alcance según ADR 0021.

Informa:
- SHA.
- Pruebas rojas y verdes.
- El número de pruebas E2E de proyecto antes y después.
- Capturas.
- La CI de las tres plataformas.
