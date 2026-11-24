# SIM-3d · Alcance de continuación y ADR0021

Rama `codex/sim-3d-decimales-continuacion`, main `3b5e822c` con3a/3c fusionadas. La [historia](historia-sim3-resultados-correctos-diseno-para-codex.md) y la [decisión actualizada](sim-3d-decimales-copia-decision-2026-11-23.md) sustituyen el contrato2/Todos anterior.

## Cambio más pequeño completo

1. Reutilizar formatNumber/Intl y el formateador puro común; añadir el tipo conocido de métrica, sin detector nuevo. Copia/ayuda usan String del resultado, no15cifras.
2. Reutilizar Settings/schema/default/patch/store/eventos y fila de Apariencia para auto/all. App pasa solo preferencia/callback a AnalysisWorkspace; El formato no necesita IPC nuevo.
3. Los cinco consumidores de Análisis comparten el formato: Información, Estadísticas/Describe, Más estadísticas y Gráficos (tabla y texto de tendencia). La tendencia mantendrá sus números marcados para copiar; el informe Markdown conserva su serialización completa.
4. El adaptador de copia existente conserva selección/separadores, queda acotado al panel visible y no interpreta IDs/texto como números.
5. Conservar los textos estudiantiles ya preparados; completar los motivos conocidos de filas en CsvTable después de3c, con prueba roja propia. undoLimit ya rechaza antes de commitChange: se conserva esa garantía.

## Coordinación y validación

No se desarrollan3b/3e en archivos compartidos hasta congelar este head. Sin cambios de motor, cálculos, límites existentes, dependencias, workflows, guardado de documentos ni tabla fuente. No quitar rutas de pending-files sin migración completa comprobada. La nueva preferencia no existe en main: perfilesv1 sin ella reciben auto, patches de Tema no inyectan defaults, versiones futuras siguen solo lectura.

Pruebas primero por bloque; preservar rojos antiguos como históricos. Nuevos casos: extremos0/±1/100,15sig frente a String, copia parcial/múltiple, equivalencia con informe y datos exportados, cambio global sin consultas, persistencia/reset/v1/futuro. Capturas es/en-XA×claro/oscuro×1440×900/1280×720. Al cierre tipos, unitarias completas, E2E completa y build; CI del head final y tiempos Windows, sin atribuir verde a lo no ejecutado.

## Siete respuestas originales del ADR0021 · decisión3

1. **Does a tool already do this?** Sí: formatNumber/Intl, t/plural, Settings/schema/default/patch/store/eventos, la cabecera AnalysisWorkspace y las tablas existentes. DOM Selection y metadatos de los resultados permiten copiar sin adivinar números. Reutilizar→configurar→integrar antes de desarrollar.
2. **Is there a skill we can reuse?** El flujo rojo→mínimo→verde y los helpers de Playwright/Electron, persistencia y exportaciones existentes. Las herramientas de desarrollo no se incorporan al runtime del producto.
3. **Can it be integrated through CLI, API, or MCP?** El puente actual de preferencias y los datos/callbacks de Análisis son suficientes. No nuevo IPC, CLI, API, MCP o acceso del renderer a archivos/clipboard del sistema; la copia usa ClipboardEvent nativo acotado.
4. **How mature, secure, and maintained is it (release cadence, maintainers, license)?** Intl y DOM estándar, componentes internos MIT y dependencias ya fijadas. No biblioteca, servicio o carga remota nuevos. Se conservan aislamiento, settings futuros, originales y exportaciones.
5. **What maintenance cost does it add?** Un campo persistido compatible, un selector/fila de Ajustes que comparten valor, helpers puros pequeños y presentación/metadatos comunes. El coste delicado es preservar la selección y los separadores: queda cubierto por E2E nativa, no por un parser genérico de texto.
6. **What is the minimum glue LAB must write?** Una política de formato/copia, conectar la preferencia existente a los consumidores indicados y un adaptador DOM limitado a la raíz visible. LAB no cambia. No otro motor, esquema de resultados, caché, almacenamiento renderer o detector de tipos.
7. **Does writing our own code add value?** Sí: evita cifras pequeñas presentadas como cero y permite presentación legible y copia coherente conservando datos crudos. Rehacer formato internacional, Settings, matemática, exportación o clipboard global no aporta valor y no se propone.

## Ampliación autorizada: CSV/JSON de Estadísticas

El propietario eligió explícitamente «Añadir CSV/JSON a Estadísticas en esta entrega» al comprobar que hoy solo exporta Markdown. No se afirma cobertura de un formato inexistente.

Se reutiliza `exportResult`: selector nativo, validación de destinos, protección de fuentes/proyectos, escritura atómica y pareja CSV/contexto con reserva y recuperación. La única capacidad nueva es `exportStatisticsResult`, con petición tipada y validada, matriz acotada de resultados ya calculados y contexto de muestra/vista/parcial. No recibe ruta ni contenido libre de archivo. Fuente, revisión y cambios pendientes se obtienen en main y se revalidan antes de escribir; no se modifica el documento original. JSON/contexto conserva nulos; CSV conserva el valor completo y protege fórmulas textuales, explícito en ayuda/metadatos. El snapshot no es una prueba criptográfica de autenticidad matemática del renderer; los tests comparan con el motor/informe y con los datos de pantalla.

### Siete respuestas ADR0021 para esta ampliación

1. Ya existen exportResult, serializadores CSV/JSON, describeTable y campos de estadísticas. Se reutilizan; no otro sistema de guardado.
2. Se conservan rojo→mínimo→verde, revisión de límites/seguridad y fixtures de estadísticas existentes.
3. La función de exportación segura es interna de main y todavía no sirve estos resultados: se añade solo una operación limitada al puente actual, sin CLI, red ni escritura genérica.
4. Zod, CSV y la escritura atómica ya están instalados y probados. Sin dependencia ni licencia nueva; se mantienen defensas de destino y proyectos.
5. Coste adicional: serializador/validación acotados y adaptadores de las tres vistas estadísticas, con tests de precisión, nulos, fórmulas, revisión y cancelación del selector.
6. Código propio mínimo: construir una matriz desde el resultado existente, validar la petición y delegar la escritura a exportResult. No recalcular, parsear Markdown ni duplicar exportadores.
7. Aporta salida reutilizable fuera de la app sin depender del redondeo visual; esta capacidad sí fue solicitada y aprobada por el propietario.
