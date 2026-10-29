# TXT-01 · Corrección de la configuración real de selección múltiple

Al revisar el adaptador durante D, se detectó que el fixture unitario añadía `EditorState.allowMultipleSelections.of(true)` por su cuenta. La configuración de producción de CSV no lo hacía: X7 aún estaba incompleto.

La prueba ahora crea el estado con las mismas extensiones que producción y sin esa ayuda. Rojo real `txt-b-multiselection-real-red.txt`: **3 fallos / 8 verdes**, incluidos los dos casos de pegado múltiple existentes. Se añade una única facet instalada a `csvTextDocument`, que solo utiliza el modo Texto CSV. No se cambia el estado de Markdown, Mermaid ni SQL.

Verde `txt-b-multiselection-real-green.txt`: **11/11**; también conserva el diferencial de 600 ediciones y sus historiales. La validación de interfaz de Buscar → Todas → edición de dos rangos → undo se añade al cierre enfocado de D; todavía no se atribuye un verde nativo a este commit aislado.

No cambian dependencias, lockfile, motor CSV, permisos ni CI. Es una corrección propia, sin reescribir los commits B y C ya registrados.

Validación posterior en la app: el primer montaje cancelaba las selecciones con Escape enfocado en el editor. La sonda de estados/eventos distingue ese gesto de las entradas y confirma la causa en defaultKeymap. Al cerrar Buscar con su botón nativo, `txt-d-x7-verified.txt` verifica dos rangos visibles, ambas sustituciones y undo de un paso, tanto con teclas normales como con insertText. No se modificó el producto para acomodar el montaje.
