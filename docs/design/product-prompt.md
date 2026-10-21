# Prompt para render de alto nivel: editor rápido de documentos, tablas y diagramas

Diseña un concepto visual de alta fidelidad para una aplicación de escritorio para macOS que permita abrir, consultar, buscar, editar, crear, guardar y exportar archivos de manera rápida y sencilla. El resultado debe comunicar un producto real, coherente y listo para desarrollar, con contenido de ejemplo legible y controles que correspondan a tareas concretas.

El nombre de la aplicación está por definir. Puedes usar «Nombre de la app» como identificador provisional. Este documento describe el producto deseado; no implica que las funciones ya estén implementadas.

## 1. Propósito del producto

La aplicación es un editor ligero de archivos para el trabajo cotidiano con documentos Markdown, tablas CSV/TSV y diagramas Mermaid. Debe servir tanto para una consulta de segundos como para una sesión de edición con varios archivos abiertos.

El usuario quiere abrir un Markdown y leerlo bien, modificarlo y exportarlo a PDF sin abrir un entorno de programación ni ejecutar comandos. También quiere abrir un CSV como tabla, encontrar información, aplicar filtros, corregir valores y guardar rápidamente. Para los diagramas, quiere editar su definición y ver el resultado inmediatamente.

La experiencia central es: abrir → entender → consultar o editar → guardar o exportar.

Todo debe sentirse directo: pocos pasos, acciones visibles, buena respuesta al teclado y una interfaz que se adapte al tipo de archivo. El procesamiento del núcleo debe realizarse localmente, sin exigir una cuenta ni subir los archivos para leerlos, editarlos o exportarlos.

## 2. Formas de abrir y organizar archivos

- Abrir un archivo individual desde el selector de macOS, Finder o arrastrándolo a la ventana.
- Abrir una carpeta y explorar su contenido en un árbol de archivos y subcarpetas.
- Trabajar con varios archivos en pestañas.
- Crear un archivo Markdown, CSV/TSV o Mermaid desde una acción «Nuevo».
- Acceder a archivos y carpetas recientes.
- Buscar rápidamente un archivo dentro de la carpeta abierta.
- Mostrar u ocultar el árbol de archivos para ampliar el área de trabajo.

Abrir un archivo individual debe llevar directamente a su contenido. Abrir una carpeta debe mostrar el explorador lateral. No se requiere configurar un proyecto o espacio de trabajo para empezar.

## 3. Edición y visualización de Markdown

Ofrece tres modos claramente identificables:

- **Editar:** texto Markdown con resaltado de sintaxis.
- **Vista previa:** documento renderizado y cómodo de leer.
- **Dividido:** editor y vista previa juntos, con actualización mientras se escribe.

El contenido debe admitir títulos, párrafos, listas, listas de tareas, enlaces, imágenes, citas, tablas, bloques de código con resaltado, fórmulas matemáticas y bloques Mermaid.

Incluye búsqueda y reemplazo, atajos de formato e índice navegable generado a partir de los títulos. En modo dividido, procura conservar la posición de lectura y relacionar el desplazamiento del editor con la vista previa.

El usuario puede guardar el archivo original, guardar una copia y exportar a PDF o HTML mediante una acción visible. La exportación debe permitir elegir destino y mostrar cuándo terminó, con opción de abrir el resultado.

## 4. Consulta, análisis y edición de CSV/TSV

Al abrir un CSV o TSV, presenta una tabla editable con encabezados claros, números de fila y desplazamiento fluido.

Incluye:

- Selección y edición de celdas, filas y columnas.
- Copiar y pegar selecciones.
- Añadir o eliminar filas y columnas.
- Buscar valores y avanzar entre coincidencias.
- Reemplazar valores con un alcance claro.
- Filtrar por una o varias columnas y ver qué filtros están activos.
- Ordenar columnas de forma ascendente o descendente, distinguiendo orden numérico y textual cuando corresponda.
- Mostrar filas visibles frente al total y permitir quitar todos los filtros fácilmente.
- Consultar un resumen sencillo: número de filas y columnas, celdas vacías y valores únicos de una columna; para datos numéricos, suma, mínimo, máximo y promedio de la selección cuando sean aplicables.
- Guardar el archivo completo, guardar una copia o exportar explícitamente las filas filtradas.
- Copiar una selección como tabla Markdown para incorporarla a un documento.

La aplicación debe preservar los valores originales: identificadores con ceros iniciales, textos que parecen fechas, comillas, caracteres especiales y saltos de línea dentro de celdas. Debe reconocer el delimitador y la codificación, mostrar los detectados y permitir corregirlos cuando haga falta.

Los filtros deben actuar como una vista del archivo. Guardar debe comunicar con claridad si se guarda el documento completo o se exporta únicamente la selección o las filas visibles. Cualquier ordenación que cambie el archivo debe poder deshacerse y marcar el documento como modificado.

Para archivos grandes, la interfaz debe seguir respondiendo, mostrar progreso y comunicar cualquier límite sin aparentar que se cargaron o analizaron datos que aún no están disponibles.

## 5. Diagramas Mermaid y crecimiento del soporte

Mermaid es el primer lenguaje de diagramación requerido. Debe funcionar tanto en archivos individuales `.mmd` o `.mermaid` como dentro de bloques de Markdown.

La experiencia de diagramación incluye:

- Editor de la definición y previsualización inmediata.
- Vista dividida y vista del diagrama a pantalla amplia.
- Zoom, desplazamiento y ajuste al área disponible.
- Mensajes comprensibles cuando la definición tenga un error, con referencia a la ubicación cuando el motor la proporcione.
- Exportación a SVG, PNG y PDF.
- Tema claro y oscuro con buen contraste.

La dirección del producto contempla incorporar otros lenguajes de diagramación. El render debe identificar el lenguaje activo como «Mermaid» y permitir que el diseño crezca, sin mostrar otros motores como si ya estuvieran disponibles.

Los motores de renderizado deberán mantenerse actualizados mediante versiones estables y comprobadas, preservando la compatibilidad con archivos existentes. La experiencia visual no necesita exponer detalles de dependencias o versiones de bibliotecas.

## 6. Importación y transformación de documentos

Contempla una acción «Importar y convertir a Markdown» para documentos como Word, PDF, Excel y PowerPoint. MarkItDown de Microsoft es un motor candidato para esta función.

La importación debe crear un documento nuevo que el usuario pueda revisar, editar y guardar, conservando el archivo fuente. El resultado busca recuperar contenido y estructura; la fidelidad del diseño y los documentos escaneados necesitan validación específica.

Representa esta función como una acción secundaria, accesible desde «Abrir / Importar». El centro visual de la aplicación sigue siendo leer y editar Markdown, tablas y diagramas.

## 7. Comportamientos comunes y confianza

- Guardar, guardar como y deshacer/rehacer disponibles de manera consistente.
- Indicador discreto y visible de cambios pendientes en cada pestaña.
- Aviso antes de cerrar un documento con cambios sin guardar.
- Detección de cambios externos, con opciones claras para recargar o conservar el trabajo antes de sobrescribir.
- Guardado seguro que evite dejar un archivo incompleto ante un fallo.
- Acciones destructivas con alcance comprensible y recuperación mediante deshacer cuando sea posible.
- Procesamiento local del núcleo y control sobre cualquier acceso a recursos remotos.
- Manejo seguro de contenido Markdown, enlaces, imágenes y diagramas procedentes de archivos externos.
- Controles accesibles, contraste suficiente y navegación por teclado.
- Mensajes de error concretos y estados de carga que expliquen qué está ocurriendo.

## 8. Estructura visual sugerida

Diseña una ventana de escritorio con cuatro zonas coherentes:

1. **Barra superior:** controles de ventana de macOS, nombre del archivo, acciones de abrir/crear, guardar y exportar. Las acciones disponibles se adaptan al archivo activo.
2. **Explorador lateral opcional:** carpeta raíz, árbol de archivos, búsqueda por nombre y acceso a recientes. Usa una estructura compacta y reconocible.
3. **Área central con pestañas:** documentos abiertos y contenido adecuado para cada tipo. En Markdown y Mermaid, muestra el selector de modos. En CSV, muestra herramientas de búsqueda, filtros y tabla.
4. **Barra de estado discreta:** información útil del archivo activo, como posición del cursor, codificación, delimitador, filas visibles o estado de guardado.

Los paneles deben poder redimensionarse. La vista de archivo individual debe sentirse completa con el explorador oculto. Las acciones frecuentes deben poder descubrirse sin recurrir a una paleta de comandos, aunque puede existir una búsqueda de acciones con atajos.

## 9. Dirección de diseño

Busca una apariencia nativa de macOS, sobria, moderna y ligera. Usa tipografía de sistema en la interfaz, una tipografía monoespaciada legible para el código y una composición cuidada para el documento renderizado.

Prioriza jerarquía, espaciado, legibilidad y densidad útil. La tabla debe aprovechar el espacio; la lectura de documentos debe tener márgenes cómodos. Usa un color de acento contenido para selecciones, acciones principales y estados activos.

Prepara tema claro y oscuro. Los estados de selección, modificación, error, filtro activo y exportación completada deben distinguirse con texto o iconos además del color.

Usa etiquetas de interfaz en español, breves y naturales: «Abrir», «Abrir carpeta», «Nuevo», «Guardar», «Exportar», «Editar», «Vista previa», «Dividido», «Buscar», «Filtrar» y «Quitar filtros».

El resultado debe parecer una herramienta cotidiana de trabajo con archivos. Dedica la mayor parte de la ventana al contenido que el usuario está leyendo o editando.

## 10. Referencias y qué tomar de cada una

- **MDViewer:** lectura de Markdown, Mermaid, fórmulas y código dentro de una app de escritorio.
- **Markdown All in One:** comodidad de edición, atajos e índice automático. Es una extensión de Yu Zhang para VS Code.
- **Modern CSV:** trabajo directo con datos tabulares, búsqueda, filtros y edición de celdas.
- **Tangerine:** acciones contextuales y pocos pasos para trabajar con archivos. El acceso rápido global inspirado en su gesto de arrastre queda como una exploración posterior; para el concepto inicial basta un buen arrastrar y soltar dentro de la app.
- **MarkItDown:** conversión de documentos a Markdown como capacidad de importación.

Toma estas referencias como inspiración funcional. Crea una identidad visual propia y unifica los comportamientos en una sola experiencia.

## 11. Pantallas que debe mostrar el render

Genera una serie coherente de vistas de la misma aplicación:

### A. Markdown en modo dividido — vista principal

Explorador de una carpeta llamada `Documentación`, varias pestañas y el archivo `guia-del-proyecto.md` activo. A la izquierda, texto Markdown; a la derecha, la vista previa del mismo contenido. Incluye un título, lista de tareas, una tabla pequeña y un diagrama Mermaid. Muestra el índice del documento de forma discreta y el botón «Exportar» claramente accesible.

### B. CSV en consulta y edición

Archivo `inventario.csv` con columnas `Código`, `Artículo`, `Categoría`, `Existencias` y `Ubicación`. Usa datos sintéticos y códigos como `000124` para mostrar la conservación de ceros iniciales. Presenta una celda en edición, un filtro activo, búsqueda y el indicador «24 de 180 filas». El resumen de la selección debe ser compacto y secundario.

### C. Diagrama individual

Archivo `flujo-de-revision.mmd` con definición Mermaid a la izquierda y un diagrama de proceso a la derecha: «Recibir archivo → Revisar → Corregir / Aprobar → Exportar». Incluye zoom, ajustar a ventana y exportar. Usa un ejemplo sintácticamente válido y una previsualización que corresponda al texto.

### D. Archivo individual y exportación

Muestra un Markdown abierto con el explorador oculto, en vista previa. Presenta el menú o diálogo de exportación con PDF y HTML, selección de destino y una acción principal clara. La vista debe transmitir que esta tarea se resuelve rápidamente.

### E. Inicio ligero

Pantalla inicial con «Abrir archivo», «Abrir carpeta», «Nuevo archivo», una zona para arrastrar y una lista breve de recientes. Debe permitir empezar sin configuración previa.

Muestra al menos una vista en tema claro y otra en oscuro. Mantén la misma identidad, dimensiones de controles y lógica de navegación en todas.

## 12. Criterios para evaluar el concepto

El diseño debe permitir entender de inmediato:

- Qué archivo está abierto y si tiene cambios pendientes.
- Cómo cambiar entre editar y visualizar.
- Cómo buscar o filtrar sin perder el contexto.
- Cómo guardar el original o exportar una copia.
- Cómo abrir un archivo suelto o navegar por una carpeta.
- Que Markdown, CSV y Mermaid comparten una aplicación, pero cada uno recibe las herramientas que necesita.

La primera versión se centra en Markdown, CSV/TSV y Mermaid. La importación amplía la entrada de documentos; otros motores de diagramación y las acciones globales de arrastre son crecimiento posterior.

Entrega renders de producto y sus estados principales, con contenido realista y consistente. Acompáñalos con una explicación breve de la navegación y de las decisiones que hacen rápidas las tareas habituales.
