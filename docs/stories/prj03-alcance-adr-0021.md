# PRJ-03 · Exportar conjuntos con procedencia · Alcance y ADR 0021

Base: `main` actualizado `614e2f37d06275c83082255f1ed16a4ed1c19642`, después de las fusiones del propietario de SIM-1d y SIM-1e. Rama `codex/prj-03-exportar-conjunto`. La historia de diseño se conserva íntegra en este primer commit; sus cuatro decisiones figuran aprobadas por el propietario el 2026-11-18.

## Resultado y fronteras

Exportar un conjunto guardado crea un CSV/TSV dentro del proyecto y registra su procedencia después de escribirlo. Se reutilizan el motor de recetas, sus filtros, muestreo y orden, la escritura por streaming de E1, la protección de fuentes y la escritura atómica del manifiesto. La vista previa de cien filas nunca se convierte en el archivo exportado.

Se conservan la codificación, BOM, delimitador y finales de registro. Sin selección de columnas se copian los registros; con selección se conservan los valores, incluidos los campos ausentes al final. Un ausente antes de un valor presente se representa vacío y se cuenta expresamente. Primeras N mantiene su cobertura parcial y total desconocido aunque exportar drena todos los bytes para verificar la huella completa. El orden sin límite se detiene al superar los límites actuales; orden seguido de Primeras N retiene N.

El árbol de Proyecto y el panel Conjunto ofrecen Exportar. Los resultados son hijos del conjunto y permiten abrir, mostrar, registrar como fuente y quitar del proyecto sin borrar el archivo. La cobertura usa el mismo compositor en Probar, la fila y el aviso del archivo abierto. Una exportación registrada no se reemplaza; un conjunto con resultados no se elimina. Se conservan las guardas de versiones futuras, fuente cambiada/ausente y cambios sin guardar.

La interfaz envía ids cerrados. Main resuelve las rutas y abre el diálogo del sistema; rechaza destinos fuera del proyecto, fuentes protegidas, resultados registrados, documentos abiertos, enlaces simbólicos y extensiones no admitidas. Se comprueba el espacio y la identidad antes de publicar el archivo. Cancelar limpia el temporal y no escribe el manifiesto. Si falla el registro después de crear el archivo, se conserva y se puede registrar de nuevo tras verificar su huella. Dos exportaciones pueden correr; las mutaciones del manifiesto se serializan.

La persistencia mínima añade `mtimeMs?` al resultado y una instantánea opcional validada de nombres, columnas y recetas dentro de `provenance`. Las nuevas exportaciones escriben ambos datos; los lectores aceptan los resultados v1 antiguos sin inventar la fecha ni reconstruir condiciones históricas a partir de recetas actuales. Se captura el contexto de ejecución, no el estado vivo al registrar. Los hashes de recetas usan claves ordenadas recursivamente y JSON sin espacios. Esta ampliación compatible sigue §4.8 del contrato; no implementa obsolescencia PRJ-06.

## Lugares que alcanza el cambio

- Contratos de proyecto/receta, resultados, operaciones tabulares y puente tipado; peticiones y eventos validados.
- Motor de recetas y escritor de E1, coordinador de proyectos/fuentes, registro, cancelación, recuperación del registro y destinos.
- `ProjectPanel`, `SubsetPanel`, integración de `App`, paleta y aviso del CSV abierto. Se reutilizan árbol, menús, diálogos, progreso, foco y formatos existentes.
- Compositor de cobertura, catálogos es/en y generación vigente de en-XA. No se traducen ni transforman los datos del usuario.
- Fixtures y pruebas unitarias, integración, E2E y rendimiento del flujo completo. E1 fuera de proyectos conserva su contrato y sus pruebas.

No se añaden dependencias, motores, ajustes, rutas genéricas, red, formatos Excel/Parquet, borrado de archivos ni confirmaciones ajenas al diseño. No se cambian plazos, reintentos, workflows o límites. No se fusiona, publica ni instala.

## Rojo primero y evidencia

El primer rojo usa `prj02-censo.csv` y compara los bytes literales de Oaxaca, adultos, el registro corto, el multilínea y el SHA de la fuente. Después se cubren bytes originales/codificaciones, proyección Nota/ID con su aviso, muestra semilla 7, primeras dos con huella completa y total desconocido, cadena y hashes canónicos, límites, cancelación/limpieza, destinos, conflicto del manifiesto, reintento de registro y dos ejecuciones concurrentes.

Los E2E verifican las entradas, el árbol, la procedencia común, los bloqueos, abrir/editar, añadir como fuente y quitar sin borrar; teclado, anuncios, es/en/en-XA y capturas claro/oscuro en 1440×900 y 1280×720. Los oráculos de datos existentes no se relajan. Se registrará cada prueba retirada únicamente si comprueba una conducta expresamente eliminada.

Durante el desarrollo se ejecutan pruebas enfocadas. Al calificar la entrega: tipos, todas las unitarias y construcción; suite completa al cierre de la integración, CI del head exacto en tres sistemas y ejecución completa Intel sin reintentos. Las medidas de 1 GB registran equipo, tiempo y memoria reales en ARM e Intel; una medida no ejecutada queda pendiente. Un resultado anterior o de otra composición no transfiere su verde.

## Siete respuestas del ADR 0021

1. **¿Existe herramienta?** Sí: `runRecipe`, E1, `ProjectStore`, `ProjectSourceRegistry`, el worker tabular y los componentes de árbol, menús, cancelación y cobertura. Falta unir su ejecución duradera, registrar el resultado y presentarlo.
2. **¿Existe habilidad reutilizable?** El cambio mínimo completo, el ciclo rojo→verde y las comprobaciones de accesibilidad/seguridad se aplican sobre los patrones de la aplicación. Son herramientas de desarrollo; no dependencias de FreyaLab.
3. **¿Hay CLI, API o MCP suficiente?** Se amplía el puente interno con peticiones cerradas por ids. No se ofrece una CLI ni acceso genérico a disco o comandos al renderer. El diálogo y las rutas pertenecen a main.
4. **¿Madurez, seguridad, mantenimiento y licencia?** Código interno MIT y dependencias ya instaladas. Se reutilizan sus validadores zod, protección de fuentes, hashing, serialización, escritura y pruebas. La revisión estática no se presenta como una ejecución.
5. **¿Coste?** Un modo cerrado de escritura del motor existente, registro y vistas de resultados, y conexión de la interfaz. Se conservan los límites de memoria; no hay segundo motor ni archivos intermedios para ejecutar la cadena.
6. **¿Pegamento mínimo?** Capturar el contexto resuelto, elegir/validar destino, ejecutar una pasada, escribir temporal, verificar, renombrar y registrar; mostrar el resultado con las acciones y la cobertura compartidas. La persistencia guarda solo los datos que exige el diseño.
7. **¿Qué valor tiene código propio?** Conservar identidad, cobertura y procedencia de un conjunto como entrega duradera del estudiante. Reescribir filtros, parser, muestreo, formato CSV o controles existentes no aporta valor y se evita.

## Estado inicial

Solo historia y alcance. No se ha modificado producto, ejecutado pruebas nuevas ni medido rendimiento en esta rama. Los resultados y límites reales se añadirán después de ejecutarlos.
