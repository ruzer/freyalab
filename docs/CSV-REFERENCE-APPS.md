# Referencias locales para el explorador de datos

Actualización: 21 de octubre de 2026. Complementa [la auditoría CSV y roadmap](CSV-ADVANCED-ROADMAP.md). Se verificó `mac_apps_inventory.txt` y la presencia de paquetes locales. El inventario original, sus rutas personales y la lista completa de software no se copian al repositorio público.

## Presencia local y método

Paquetes verificados: KNIME, Orange, JASP, jamovi, Gephi, RStudio, DBeaver, LibreOffice, Joplin, PanWriter y DataGrip. Metadatos confirman Orange 3.40.0 y KNIME 5.8.3; el campo de versión del bundle de jamovi no se presenta como versión del producto sin comprobación adicional. Presencia no prueba arranque ni funcionamiento.

El inventario y directorios de Homebrew confirman DuckDB (1.5.5/1.5.6), Arrow, SQLite, R, NumPy, Pandoc, Graphviz, ImageMagick, OCRmyPDF/Tesseract, Ollama, llama.cpp y whisper-cpp. Son herramientas locales, no dependencias declaradas ni distribuidas por FreyaLab. Arrow de Homebrew y el paquete JavaScript son artefactos distintos.

La comparación es documental y estática; no se probaron manualmente los flujos de esas aplicaciones.

| Referencia | Capacidad documentada | Propuesta para FreyaLab | Estado/prioridad |
|---|---|---|---|
| Modern CSV | Edición tabular, análisis y pivot | Integridad y comandos descubribles | Matriz en roadmap; alta |
| JASP | Descriptivos, resultados anotados y divulgación progresiva | Elegir variables/medidas, explicar resultados y exclusiones | Panel básico implementado; ampliación pendiente, alta |
| jamovi | Hoja de datos, descriptivos/gráficas, resultados actualizados con datos/opciones | Separar datos/resultados; alcance y obsolescencia | Invalidación y reanálisis implementados; gráficos pendientes, alta |
| Orange | Column Statistics: tipo, distribución, media/mínimo/máximo, moda y dispersión | Perfil, faltantes, distribuciones y salida tabular derivada | Conteos básicos implementados; perfil pendiente, alta |
| KNIME | Flujos visuales para transformar, agrupar y combinar | Pasos con entrada, preview, resultado y deshacer | Asistente lineal propuesto antes de un canvas; media |

Fuentes: [Modern CSV](https://www.moderncsv.com/documentation/), [JASP](https://jasp-stats.org/) y [análisis](https://jasp-stats.org/features/), [jamovi](https://www.jamovi.org/features.html), [Orange](https://orangedatamining.com/widget-catalog/data/featurestatistics/), [KNIME](https://www.knime.com/knime-analytics-platform). No se deduce equivalencia ni rendimiento de estas páginas.

DBeaver/DataGrip pueden guiar una futura revisión de SQL; Gephi, grafos; Joplin/PanWriter/RStudio, documentos e informes. Son referencias secundarias propuestas: esta entrega no presenta sus flujos como auditados ni integra sus runtimes.

## Reutilización y licencias

Revisar la licencia del componente antes de copiar o incorporar código: open source no equivale a código trasladable como MIT. JASP publica código principal AGPL-3.0 y condiciones por componente; jamovi documenta AGPL3 y componentes GPL2+; KNIME aplica GPLv3 con permisos adicionales a sus plug-ins. Orange publica sus condiciones específicas. Esta entrega toma referencias funcionales, sin incorporar código de esas aplicaciones ni aprobar su redistribución.

Fuentes: [JASP](https://github.com/jasp-stats/jasp-desktop/blob/development/COPYING.txt), [jamovi](https://github.com/jamovi/jamovi/blob/main/LICENSE.md), [KNIME](https://www.knime.com/downloads/full-license), [Orange](https://orangedatamining.com/license/).

## Explorador de datos propuesto

En el documento CSV: **Resumen**, **Calidad**, **Distribuciones**, **Agrupar/Pivot**, **Transformar** e **Informe** como herramientas progresivas. SQL será una vista avanzada posterior. Mostrar conteos reales y modo completo/muestra; análisis costosos bajo petición, sin presentar acciones pendientes como funcionales.

Prioridad: revisar/integrar correcciones de integridad; ampliar estadísticas/perfiles; generar informes Markdown; prototipo DuckDB y agrupaciones/pivot; después SQL e IA opcional. La primera mejora actual sigue siendo el panel estadístico de consulta.

**DuckDB:** candidato analítico principal, separado de la edición. Probar Node Neo frente a Wasm en un proceso de datos y empaquetar por plataforma, sin depender de Homebrew ni invocar el CLI del usuario. Gates: Windows/Linux/macOS ARM/Intel, ejecución de paquetes, offline, memoria/cancelación y precisión. La proyección reflejará cambios pendientes y conservará texto, IDs y encabezados duplicados. Aislar funciones de archivos/red/extensiones: un SELECT no constituye por sí solo una frontera de seguridad. La instalación en este Mac no resuelve esos gates.

**Informes Markdown:** propuesta de documento derivado con medidas, nombre/alcance/revisión, filtros, exclusiones y método numérico. Abrirlo como Markdown nuevo mediante los flujos existentes, sin reemplazar el CSV; revisar y guardar/exportar HTML/PDF. Mermaid puede representar un flujo de transformación estándar. Exportar resultados analíticos a Markdown todavía no está implementado.

**IA local:** posterior y opcional. Proponer una consulta o configuración visual, mostrar alcance/operación, validar con el ejecutor acotado y limitar recursos. Texto de celdas y respuestas del modelo son datos no confiables; no autorizan ejecución ni modificación de archivos. El análisis básico funcionará sin modelos, descargas, cuentas o servicios. Esta entrega no conecta Ollama/llama.cpp ni descarga modelos; Whisper queda fuera del objetivo tabular.

## Componentes compartidos de los editores

- Documentos/pestañas, Abrir/Guardar/Guardar como, cambios, conflictos y recuperación.
- Convenciones de acciones, menús, atajos, foco, errores, temas y trabajos de fondo.
- Exportación con alcance explícito y resultados nuevos; autoridad de archivos única.
- Renderizado Markdown/Mermaid reutilizado para informes/diagramas; CSV conserva su grilla y motor.

Pendiente: pruebas manuales de las aplicaciones de referencia, prototipo DuckDB empaquetado, gráficos, inferencia, informes y asistente local. No se declara compatibilidad de esos motores con FreyaLab distribuido sin comprobarla.
