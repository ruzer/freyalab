# DuckDB — prototipo de compatibilidad local

21 de octubre de 2026. Prueba temporal fuera del producto y del repositorio de dependencias de FreyaLab. No se añade un comando CLI a la aplicación. No se utiliza la instalación Homebrew de DuckDB.

## Resultado observado

`@duckdb/node-api` 1.5.6-r.2 (MIT, motor v1.5.6) cargó en un utility process de Electron 44.9.2, Node.js 24.22.0, macOS arm64. Se descargó en una carpeta temporal con dependencias fijadas y scripts de instalación desactivados. El paquete nativo arm64 ocupó aproximadamente 113 MiB sin comprimir en disco: no es tamaño de instalador ni coste medido para otros sistemas.

17 comprobaciones satisfactorias con tres filas sintéticas: conservación de `001` y `9007199254740993` como VARCHAR, agregación decimal (Oaxaca 13.00, Puebla 20.00), join, pivot con columnas explícitas, identificación nativa de múltiples sentencias y tipo SELECT. Se rechazaron lectura local/remota, COPY a archivo, INSTALL/LOAD, reactivar acceso externo, cambiar memoria y DELETE dentro de una transacción de solo lectura. El archivo canary sintético permaneció intacto y no se creó el CSV prohibido. Una consulta costosa se interrumpió a los 54 ms observados y la conexión siguió consultando sus tres filas.

Configuración: dos hilos, 128 MB de memoria de DuckDB, directorio temporal vacío, extensiones automáticas/comunitarias/no firmadas desactivadas, acceso externo desactivado y configuración bloqueada. Se cargaron datos propios mediante appender antes de iniciar la transacción de solo lectura. **El límite de memoria no se midió como límite de RAM de todo el proceso.**

Dos detalles detectados durante el prototipo: `temp_directory` debe fijarse antes de desactivar acceso externo; hacerlo después rechazó la configuración. El pivot se limitó explícitamente a sus dos categorías; aún no se probaron columnas dinámicas ni múltiples archivos reales. Los intentos fallidos iniciales no se presentan como integración completada.

[Resultado bruto con versiones y hashes de los tres archivos temporales](duckdb-probe-2026-10-21.json). No es una prueba de la app empaquetada ni de Windows/Linux/macOS Intel. La CI del editor CSV no ejecuta este prototipo, porque DuckDB no forma parte de las dependencias del producto.

## Decisión y riesgos pendientes

Viable para continuar una evaluación, todavía no aprobado como motor distribuido. Faltan empaquetado/ejecución de binarios en cuatro entornos, ingestión consistente de ediciones pendientes, archivos grandes, paginación/límites de resultados y cancelación desde la interfaz. El parser nativo permite evitar un analizador SQL casero, pero esta prueba no constituye un validador completo de solo lectura.

Un utility process separa fallos y trabajo de la ventana, pero no reduce por sí mismo los privilegios del usuario. Los ajustes ensayados no sustituyen aislamiento del sistema operativo para SQL no confiable; debe resolverse antes de aceptar consultas arbitrarias. Evaluar también WASM si simplifica ese límite sin comprometer los requisitos de datos grandes.

Referencias oficiales: [cliente Node Neo](https://duckdb.org/docs/current/clients/node_neo/overview) y [modelo de seguridad](https://duckdb.org/docs/current/operations_manual/securing_duckdb/overview). El [objetivo C](../ANALYTICS-DELIVERY.md) sigue pendiente como función de FreyaLab.
