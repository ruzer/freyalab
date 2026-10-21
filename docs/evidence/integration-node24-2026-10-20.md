# Integración local con Node 24 — 20 de octubre de 2026

Comando ejecutado:

```sh
npm exec --yes --package=node@24 -- npm run test:e2e
```

Entorno: macOS/arm64, Apple M2 Max, 32 GiB RAM. Node.js **v24.22.0**. Código de trabajo todavía sin integrar; esta comprobación no acredita el SHA final de una release.

## Resultado observado

La construcción terminó correctamente y **12 de 12 E2E pasaron en 14.3 s**:

- Aislamiento del renderer y ciclo crear/editar/guardar/reabrir Markdown.
- CSV con ceros iniciales, campo multilínea y comillas; filtro, edición y guardado.
- PDF multipágina con texto de la segunda página recuperable.
- SVG independiente sin limpiar cambios pendientes.
- HTML autónomo con fuentes embebidas y SVG, sin scripts o recursos remotos.
- Recuperación tras caída sin sobrescribir el original.
- Restricción de imágenes a la carpeta autorizada y rechazo de argumentos IPC inválidos.
- Exportación filtrada CSV rechazada si el destino es el documento abierto; bytes originales conservados.
- PNG de SVG 1600×100 generado como imagen 3200×200, sin recorte al viewport.
- Interfaz Markdown: crear, editar, visualizar, guardar y exportar en ambos temas.
- Interfaz CSV: buscar, editar una fila filtrada, deshacer y guardar.
- Interfaz Mermaid: renderizar y exportar SVG válido.

Las pruebas de interfaz usan controles reales y CodeMirror; las pruebas del puente ejercitan persistencia y exportación mediante la API limitada. Todas usan perfiles temporales y datos sintéticos.

El informe de Playwright y las capturas se generan en `playwright-report/` y `test-results/`. Las capturas seleccionadas para revisión se conservan en `docs/evidence/screenshots/`. La medición inicial de rendimiento se documenta por separado en `local-2026-10-20.md`; no se volvió a medir en esta ejecución.

## Límites de esta evidencia

No demuestra compatibilidad en Windows/Linux, fidelidad visual aprobada, instalación de artefactos ni el resultado de CI sobre `main`. Los gates de publicación siguen pendientes hasta reunir esa evidencia. El éxito de una ejecución local no autoriza a presentar la alfa como publicada o multiplataforma verificada.
