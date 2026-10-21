# Arquitectura

## Procesos e interfaz

- **Main:** ventanas, integración del sistema, diálogos, rutas autorizadas, cambios externos, recuperación y coordinación del guardado/exportación.
- **Preload:** puente mínimo `window.freya`, con funciones explícitas y validación en Main. El renderer no recibe acceso genérico a disco, Node, procesos o IPC.
- **Renderer:** Svelte, CodeMirror y vistas. El árbol se carga bajo demanda. Solo conserva páginas de la tabla, estado de selección y contenido de los documentos de texto abiertos.
- **Utility process:** propiedad del conjunto tabular y su historial; lectura/serialización, filtros, ordenación y estadísticas. Devuelve páginas con revisión e identificador de solicitud. Una consulta anterior no puede sustituir el resultado de otra posterior.
- **Exportación:** ventana aislada sin preload. El documento se prepara con recursos embebidos; se espera la finalización real de fuentes, imágenes y diagramas antes de crear PDF.

Los contratos públicos del puente están en `src/shared/types.ts`. La interfaz tabular expresa abrir, consultar páginas, editar y exportar sin acoplar la tabla a una futura implementación de almacenamiento para GB.

## Datos

Las celdas se mantienen como texto. Ordenar y filtrar modifica la vista, no el orden del archivo. Guardar serializa el documento; exportar una selección/vista es una acción distinta y no elimina cambios pendientes.

Se conserva delimitador, codificación, BOM y fin de línea. El serializador puede normalizar comillas. No se sustituye silenciosamente un carácter no representable por otro. La interpretación numérica para orden/estadísticas no convierte el valor guardado.

La primera versión no promete edición arbitraria de GB. La muestra grande solo contiene registros completos, respeta comillas y campos multilínea, y no permite guardar o exportar un supuesto archivo completo.

## Persistencia

El guardado escribe un temporal en la carpeta del destino, sincroniza y reemplaza con manejo de errores. Se verifica el estado externo antes de reemplazar. Ante fallo, se conserva la sesión y el original; no se informa éxito.

Las recuperaciones se escriben tras dos segundos de inactividad. Una copia base y los cambios permiten recuperar CSV aunque el original cambie o desaparezca. Recuperar abre un documento nuevo, sin sobrescribir el origen. Las recuperaciones desconocidas o incompatibles se conservan.

## Recursos y privacidad

Bibliotecas, fuentes y estilos se empaquetan localmente. Los enlaces se abren por acción explícita en el navegador del sistema. Los recursos externos de documentos están bloqueados por defecto. No hay analítica, cuenta o servidor obligatorio.
