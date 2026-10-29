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
