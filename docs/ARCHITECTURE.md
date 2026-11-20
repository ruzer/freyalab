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


## Análisis posterior a alpha.1

`SqlService` ejecuta una consulta a la vez mediante una cola (`job-queue.ts`): una solicitud nueva espera en lugar de cancelar a la anterior, lo interactivo pasa por delante de la exportación, cancelar una solicitud en curso destruye su motor y se conservan los resultados de las tres últimas solicitudes para paginarlos. El proceso tabular produce lotes Arrow UTF-8 del documento y su revisión; para una muestra relee el original autorizado por streaming y comprueba huellas, metadatos y encabezados. La huella compartida usa streaming para evitar otra copia completa en memoria. No se sustituye el documento editable ni su recuperación.

DuckDB-Wasm reside en un Web Worker de una ventana oculta con sandbox de Chromium, sin Node/preload, sin permisos, navegación ni conexiones externas. Sus recursos se sirven mediante un protocolo/sesión propios desde los archivos empaquetados. CSP admite WebAssembly y no `unsafe-eval`; Arrow IPC se construye en el proceso tabular para evitar generar código en el navegador. El paquete incluye solo la variante EH y su worker; Arrow sigue disponible para el proceso de datos.

La configuración de DuckDB bloquea acceso externo, extensiones automáticas/comunitarias/no firmadas y cambios de configuración. Cada consulta pasa por el parser/prepared statement del motor (una sentencia), se usa como relación dentro de una transacción READ ONLY y devuelve hasta 10 001 filas para detectar truncamiento. DDL/SET/INSTALL/LOAD no se ejecutan como relación. El aislamiento no depende solo de identificar verbos SQL.

Main valida entradas/salida, limita fuentes/celdas/resultado y conserva como máximo 10 000 filas/8 MiB. La interfaz recibe páginas de 100; destruir la ventana cancela cómputo, con tiempo máximo de dos minutos. Un resultado pertenece a revisiones concretas; se invalida si cambian. El límite de memoria de DuckDB no es una cuota de RAM de todo Electron. [Contrato de uso y límites](EDITOR-MENUS.md#análisis-sql-agrupaciones-tablas-dinámicas-y-cruces).


## Exportar conjuntos de proyecto

`ProjectExports` coordina el diálogo de destino, las operaciones cerradas por ids, la ejecución y el registro. `recipeExtract` usa el mismo `runRecipe` con un cuarto argumento cerrado `recipe_extract`; los tres argumentos de Probar permanecen iguales. Reutiliza preparación, semántica 1, filtros, depósito y orden del motor tabular, y el escritor de E1. El contexto de proyecto que main entrega al worker no se puede elegir desde el renderer.

Filtro y porcentaje escriben por streaming; depósito y orden seguido de Primeras N conservan N. El orden completo acumula solo hasta TABLE_LIMITS. Exportar Primeras N drena el resto de bytes para verificar el SHA-256 sin interpretar más registros: conserva el total desconocido y la cobertura parcial de Probar. La cobertura incluye las etapas de muestreo que realmente ejecutó el motor y se presenta con `subsetCoverage` en Probar, el árbol y la procedencia del documento.

Sin proyección se copian los registros; con proyección se serializan valores conservando los campos ausentes al final. Un ausente anterior a un campo presente se escribe vacío y se cuenta como normalización. El temporal P3 se crea con wx en la raíz del proyecto, se sincroniza y se renombra solo tras verificar la fuente, la cancelación y el destino. Su fecha procede del inode escrito antes de publicarlo. El registro posterior vuelve a comprobar la salida; si falla, el archivo se conserva y Registrar de nuevo exige el mismo SHA y tamaño, sin atribuir a la procedencia un archivo editado.

Las nuevas exportaciones guardan `mtimeMs`, `provenance.snapshot` y, cuando existen, `coverage.samplingStages`. Son campos opcionales al leer proyectos v1 anteriores; no se inventan nombres, condiciones ni fechas históricas. Cada instantánea contiene fuente, columnas exportadas y cadena de recetas. `recipeSha256` usa JSON sin espacios con claves de objetos ordenadas recursivamente; conserva el orden de arrays. Las mutaciones del manifiesto se serializan y usan la comprobación atómica existente. Quitar un resultado elimina solo sus metadatos; no borra el archivo.

Las operaciones del puente son `project:recipeExport`, `project:registerResult`, `project:openResult`, `project:showResult`, `project:resultSource` y `project:forgetResult`; el canal y la cancelación de recetas se reutilizan. Main valida tuplas de ids y elige las rutas. La vista conserva las tareas por requestId, permite dos exportaciones y evita dos registros simultáneos del mismo resultado. Añadir como fuente reutiliza el diálogo y el registro existentes. Los resultados se vigilan con chokidar; cerrar o cambiar de proyecto cierra ese watcher.
