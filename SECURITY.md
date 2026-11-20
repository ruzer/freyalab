# Seguridad

La alfa está en desarrollo y todavía no dispone de una auditoría independiente. No se considera un sistema de custodia ni un sustituto de las copias de seguridad.

## Diseño

- Contenido y recursos de la app incluidos localmente; sin telemetría, cuentas o servicios remotos obligatorios.
- La única conexión de red de la aplicación es la comprobación de actualizaciones: una petición HTTPS `GET` a `api.github.com` desde el proceso principal, que la persona inicia o activa en Ajustes (desactivada por omisión). No envía identificadores ni datos de documentos, no descarga ni instala nada, y el renderer sigue sin acceso a la red (`connect-src 'self'`).
- Renderer aislado, sandbox activo e integración de Node desactivada. El puente expone operaciones concretas y valida los mensajes en ejecución.
- Markdown saneado, Mermaid en modo estricto y recursos remotos bloqueados por defecto.
- Los documentos exportados se generan en una ventana sin el puente de archivos.
- Las imágenes locales se limitan a la carpeta autorizada, resolviendo rutas reales para evitar escapes mediante enlaces simbólicos.
- Guardado mediante temporal de la misma carpeta, comprobación de cambios externos y recuperación local. Estas medidas reducen riesgo; no garantizan durabilidad ante cualquier fallo del sistema o hardware.

Las copias de recuperación contienen contenido de documentos y se almacenan localmente en el perfil de la aplicación. No se suben al repositorio. Antes de compartir un perfil o reporte, revisa que no incluya archivos privados.

## Reportar una vulnerabilidad

Utiliza la opción **Report a vulnerability** de la pestaña Security si está habilitada en GitHub. Si no lo está, abre un issue con una descripción general y pide un canal privado, sin adjuntar documentos sensibles, credenciales ni detalles de explotación.

Las versiones se mantienen mediante actualizaciones manuales de la alfa. Los avisos de dependencias requieren evaluación; que una auditoría de paquetes no encuentre vulnerabilidades no demuestra que la aplicación sea segura.

## Preparación del cierre

Las órdenes internas `app.prepareClose` y `app.closeAborted` usan el canal de comandos existente y se distinguen de los comandos ordinarios, cuyo callback sigue siendo síncrono. Sólo `onPrepareClose` admite una respuesta asíncrona. El preload oculta el UUID emitido por Main y responde mediante `freya:close-prepared` con exactamente UUID y booleano; no acepta texto, rutas ni un verbo elegible. Main valida emisor/frame, UUID de un uso y dueño de ventana. El rechazo conserva la ventana; el motivo y el contenido permanecen en la interfaz. Un timeout no fuerza el cierre.

Las confirmaciones de todos los documentos preceden a su disposición. Durante esa fase se impiden nuevas mutaciones en la cola de Documents; no se espera un motor SQL de lectura. Las aperturas nuevas del sistema se difieren, sin ampliar la autorización de rutas recibidas del renderer. Estas medidas no prometen una transacción del sistema de archivos ni rollback de un recurso ya liberado ante un fallo excepcional.


## Exportaciones de conjuntos

Las operaciones de resultados reciben ids validados; el renderer no proporciona la ruta de exportación. Main resuelve el proyecto y rechaza destinos fuera de él, fuentes protegidas, exportaciones registradas, documentos abiertos y enlaces simbólicos. Revalida el contexto al preparar una fuente y la identidad del padre antes de crear o publicar el archivo; el temporal queda en la raíz del proyecto para poder limpiarlo si cambia la carpeta de destino. No modifica la fuente original ni reemplaza una exportación registrada.

Estas comprobaciones usan rutas y las API portables de Node. No equivalen a una garantía de confinamiento atómica del kernel frente a un proceso local que sustituya directorios entre la última comprobación y el syscall; ese límite TOCTOU se conserva explícito. El registro del manifiesto y la creación del archivo son dos fases: un fallo del registro conserva el archivo y ofrece reintentar tras verificar su huella. No se promete una transacción de ambos archivos.
