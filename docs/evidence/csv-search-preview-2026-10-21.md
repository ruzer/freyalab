# Búsqueda CSV y reemplazo con vista previa

Entrega de desarrollo del 21 de octubre de 2026 (México). No cierra el objetivo A–D ni publica una versión nueva.

## Alcance

- Ctrl/⌘ + F enfoca/selecciona la búsqueda global; Ctrl/⌘ + Mayús + F abre/enfoca reemplazo. Los atajos se limitan al espacio CSV y respetan CodeMirror, diálogos y eventos ya atendidos.
- El texto de cada celda coincidente se marca de forma semántica con `mark`, fondo y subrayado. Se resalta la celda completa sin interpretar HTML. La búsqueda aceptada se toma de la consulta de la página entregada, no del borrador pendiente del campo. No hay algoritmo de posiciones Unicode ni resaltado de condiciones regex/numéricas.
- El reemplazo general ya no aplica inmediatamente: prepara un rango sobre el documento completo (incluidas filas ocultas), limita a una columna si se marcó exactamente una y conserva encabezados. El alcance y la comparación literal sensible a mayúsculas aparecen antes de confirmar.
- Reutiliza CsvRangePreview y el motor de rangos, con conteos, ejemplos, cancelación, revisión, presupuesto de historial y un paso de deshacer. El diálogo conserva su comportamiento anterior para rangos de la vista. No hay IPC, dependencias, motor, formato de archivo o recuperación nuevos.

## Evidencia local

Tres regresiones nuevas en search.spec.ts:

1. Teclado, coincidencias en ÁRBOL/árbol, celda ID no marcada, limpieza de búsqueda, contenido hostil como texto sin imágenes/enlaces, datos/estado/recuperación intactos. Capturas revisadas en claro 1440×900 y oscuro 1280×800, con comprobación de que el tema se aplicó antes de capturar. El buscador propio de CodeMirror SQL conserva Ctrl/⌘ + F.
2. Documento filtrado, una columna marcada, ejemplos que incluyen la fila oculta, comparación sensible a mayúsculas, cancelación sin cambio y retorno del foco. Aplicar cambia solo las dos celdas previstas, conserva encabezados y otras columnas, mantiene el original sin guardar; deshacer restaura las tres filas en un paso y rehacer recupera el resultado.
3. Búsqueda en una muestra de 200 filas: mantiene el aviso de alcance parcial y el bloqueo del reemplazo, sin cambiar tamaño/fecha/estado del original. La fixture se amplía por truncado para forzar el modo muestra; no se usa como evidencia de análisis integral de CSV válido.

Validación local común: tipos/Svelte sin errores ni advertencias; 123 unitarias y 70 pruebas Electron pasaron sin reintentos, incluida compilación de producción (2,4 minutos observados en este equipo, no garantía universal). CI, paquete e instalación del commit exacto se registran por separado en el PR. La suite dirigida no demuestra todos los flujos ni todas las plataformas. La CI incorpora search.spec.ts a los recorridos de paquetes existentes.

## Límites

Las marcas identifican celdas de la búsqueda global, no subcadenas ni filtros avanzados. El reemplazo general mantiene su alcance completo; usar el menú del rango para limitar a filas visibles/seleccionadas. La paleta de comandos, rangos discontinuos, lectores de pantalla y pruebas manuales de instalación fuera de macOS ARM siguen pendientes. No se cambia el guardado ni se neutralizan fórmulas modificando valores automáticamente.
