# Informes Markdown de estadísticas — 21 de octubre de 2026

Entrega de desarrollo en `codex/csv-statistics-reports`, sobre las entregas de transformaciones, orden, cancelación y estadísticas de selección todavía pendientes de integración en `main`. No fusionar automáticamente.

## Alcance comprobado localmente

- Node 24, Electron 44.9.2, macOS ARM. `npm run check`: sin errores ni advertencias; `npm test`: 110 pruebas; `npm run test:e2e`: 61 pruebas, sin reintentos. La suite E2E incluye compilación de producción.
- Cuatro flujos nuevos: resumen con CSV pendiente, PDF/HTML, edición/recuperación persistida/guardado; rango con consulta capturada e invalidación; las cuatro vistas del explorador con paginación y valores abreviados; informe de muestra sin habilitar escritura/exportación del CSV parcial.
- Seis pruebas unitarias nuevas contrastan etiquetas compartidas, precisión, procedencia, filtros sin paginación, muestras, frecuencias parciales, perfil, intervalos, correlación indefinida y representación literal de contenido hostil mediante el renderizador existente.
- Capturas revisadas: herramientas en claro 1440×900 y oscuro 1280×800; informe en vista dividida. El icono elegido de Freya permanece en la interfaz y el recurso de distribución.
- Pruebas iniciales detectaron autoenlaces de GFM: los textos ahora usan cadenas JSON en tramos de código con delimitadores adaptados a su contenido. Las pruebas de recuperación esperan una copia posterior a la última edición y consultan el documento completo, porque CodeMirror virtualiza las líneas fuera de pantalla.

## Integridad y arquitectura

Un generador puro comparte etiquetas con los paneles; un callback abre Markdown usando las funciones existentes de creación y actualización, incluida la cola que esperan guardar/exportar/cerrar. No se añaden dependencias, APIs privilegiadas ni un motor de documentos. Se comprueba el límite de 10 MiB antes de crear una pestaña. Los textos no se interpretan como enlaces, HTML ni fórmulas. Las tablas exportadas permiten ajustar palabras largas a la página.

Los informes solo incluyen resultados completados y válidos para su revisión. Fijan nombre sin ruta, revisión de sesión, estado pendiente al iniciar, fecha UTC y alcance. Las frecuencias incluyen la página actual y marcan textos truncados; una muestra no se presenta como archivo completo. El informe no recalcula ni altera el CSV.

## Verificaciones de distribución

La CI incluye esta suite en la aplicación empaquetada de macOS ARM/Intel, Windows y Linux, además de la regresión completa. Consultar el PR para los resultados del commit final y la versión instalada en el Mac del usuario. Compilar, ejecutar un paquete, copiarlo a Aplicaciones y probar un instalador son comprobaciones distintas. No se certifica instalación manual en Windows/Linux/Intel ni se publica una nueva versión de alfa con esta entrega.

Pendientes fuera de este cambio: exportaciones de resultados SQL, navegación a filas faltantes, rangos discontinuos y los restantes criterios del objetivo A–D. No se declara el objetivo completo ni equivalencia con Modern CSV.
