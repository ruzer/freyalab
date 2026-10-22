# Recuperación CSV anterior

`recovery-csv-v1.json` fue generado con la app instalada de desarrollo `0.1.0-dev.20261021.f535b63`, antes de introducir las mutaciones de orden. Contiene datos sintéticos, una edición de celda pendiente y su historial original. Se sustituyeron únicamente ID de documento, ruta y fecha del contenedor para no depender del equipo. La prueba debe recuperar la edición y deshacerla hasta el CSV original con CRLF y ceros iniciales.
