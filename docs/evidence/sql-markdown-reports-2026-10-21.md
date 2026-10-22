# Informes Markdown de resultados SQL

Entrega de desarrollo, 21 de octubre de 2026 (México). No es una publicación nueva ni completa el objetivo A–D.

## Cambio y alcance

El panel SQL abre una instantánea Markdown independiente mediante el flujo existente de informes. Reúne todas las páginas del resultado conservado mediante `sqlPage`; las fuentes y revisiones se validan en cada página. El informe incluye SQL ejecutado, fecha de finalización, versión del motor, nombre/revisión/filas/origen de cada fuente, tipos, orden y todos los valores conservados. No añade IPC, dependencias, motor, serializador CSV ni formato de recuperación.

NULL SQL se distingue de texto "NULL" y texto vacío. Celdas y encabezados reutilizan el escape literal JSON/GFM de los informes estadísticos; las cercas de SQL se adaptan al contenido. Un resultado limitado se identifica dentro del documento. El resultado vacío se documenta; el constructor rechaza filas incompletas y páginas aisladas.

La preparación muestra progreso y se puede cancelar entre páginas o cerrando el panel, sin abrir un informe incompleto. La generación final del texto es síncrona y acotada por los límites del resultado SQL; el editor Markdown mantiene su límite de 10 MiB y lo comprueba antes de crear una pestaña. Una instantánea ya creada no se recalcula. Las fuentes desde disco se comprueban por tamaño/fecha en el servicio existente, sin atribuir una relectura o hash adicional durante el informe.

## Verificaciones locales

- 123 pruebas unitarias, 16 archivos: constructor completo, estructura, nulos/vacíos/identificadores, metadatos, parcialidad, cero filas, encabezados duplicados, texto hostil, render seguro y cercas SQL.
- Tipos/Svelte sin errores ni advertencias.
- Regresión completa local: 67 pruebas Electron pasaron sin reintentos, incluida compilación de producción (2,3 minutos observados en este equipo; no garantía universal). CI, ejecución del paquete e instalación se registran por separado en el PR del mismo commit.
- Prueba de interfaz con 130 filas: abre el informe desde la segunda página y verifica las 130 filas, orden, cambios pendientes, identificadores largos, campos multilínea y contenido hostil. Recuperación local, Guardar y exportaciones HTML/PDF; PDF de varias páginas con el último identificador presente, considerando los saltos visuales dentro de celdas.
- Resultado de 10 100 filas: conserva y documenta 10 000, incluye la última conservada y rotula parcialidad. Cancelación durante preparación no crea otra pestaña; una revisión cambiada en el servicio impide el informe.
- CSV válido mayor de 50 MiB: 2 400 registros completos analizados y suma contrastada, mientras el editor conserva 200 filas de muestra. Informe identifica el origen desde disco; el CSV conserva SHA-256, estado y fecha. Guardar/exportar el CSV parcial siguen deshabilitados.
- Capturas revisadas en claro 1440×900, oscuro 1280×800 y documento dividido. No se rediseña la interfaz ni se cambia el icono elegido.

## Límites

Exportación directa de los resultados a CSV/TSV/JSON, nuevas medidas/dimensiones, tablas dinámicas con categorías dinámicas y localización de filas faltantes siguen pendientes. Lectores de pantalla y pruebas manuales de instalación fuera de macOS ARM no se acreditan aquí. La evidencia de CI, ejecución del paquete e instalación corresponde al commit exacto indicado en el PR; no se hereda de ramas anteriores.
