# Markdown: un recurso local ausente no bloquea el resto del documento

Fecha local: 23 de octubre de 2026. Rama: `codex/markdown-missing-resources`. Origen: hallazgo UX-02 (P1) de la [auditoría UX/UI](../audit/UX-UI-CONTINUOUS-IMPROVEMENT.md) (PR #39). Alcance: una corrección mínima; no cambia dependencias, IPC, seguridad de Electron ni la política de recursos.

## Problema reproducido

Con `![Logo](logo.png)` y el archivo inexistente, en un documento que también contiene bloques ```` ```mermaid ````:

| Resultado | Antes | Después |
|---|---|---|
| Diagramas Mermaid de la vista previa | 0 dibujados (los bloques quedan como código) | Se dibujan |
| Aviso al abrir | `Error invoking remote method 'freya': Error: ENOENT: no such file or directory, realpath '<ruta absoluta>/logo.png'` | Ninguno; la imagen muestra «Imagen no disponible: Logo» |
| Exportar a HTML o PDF | Falla con el mismo error; no se crea el archivo | Se exporta con el texto alternativo y avisa «1 imagen no se encontró» |
| Ruta absoluta en mensajes | Sí | No |

## Causa

`Preview.svelte` ya prevé la imagen ausente: si `window.freya.image(...)` devuelve `null`, quita el `src` y pone «Imagen no disponible: …». Pero `Documents.image` solo devolvía `null` para rutas no permitidas; si el archivo no existía, `contained()` lanzaba `ENOENT` (`realpath`). La excepción salía del bucle de imágenes, así que:

1. los bloques `mermaid`, que se procesan **después** de las imágenes, nunca se dibujaban;
2. `catch` fijaba `renderError`, que `exportHTML()` relanza: HTML y PDF quedaban bloqueados;
3. el mensaje técnico, con la ruta absoluta, llegaba al aviso.

Una ruta mal codificada (`100%.png`, `decodeURIComponent` lanza `URIError`) o un archivo ilegible producían el mismo efecto.

## Cambio

- `src/main/documents.ts`: `Documents.image` devuelve `null` si el archivo falta, es ilegible o la ruta está mal codificada, igual que ya hacía con rutas no permitidas. Los accesos a disco quedan dentro de un `try/catch`; `this.get(id)` queda fuera, porque un identificador de documento desconocido sigue siendo un error de programación.
- `src/renderer/components/Preview.svelte`: tolera cualquier fallo de la llamada por imagen (`.catch(() => null)`), cuenta las no disponibles y expone `missingImages()`.
- `src/renderer/App.svelte`: al exportar Markdown con imágenes ausentes, el aviso añade «N imagen(es) no se encontró/encontraron; se exportó con su texto alternativo». Sin ruta del recurso.

Total: 3 archivos, 7 inserciones y 6 eliminaciones. La política de recursos no cambia: siguen bloqueadas las URL remotas y las rutas fuera de la carpeta del documento.

## Pruebas

| Prueba | Antes del cambio | Después |
|---|---|---|
| `tests/document-images.test.ts` (unitaria): `Documents.image` devuelve `null` para archivo ausente, subcarpeta ausente, `100%.png`, `../fuera.png`, URL remota y (fuera de Windows y de `root`) archivo sin permisos; devuelve `data:image/png` para uno válido | **Falla**: `ENOENT … realpath '<ruta>/falta.png'` | Pasa |
| `tests/e2e/missing-resources.spec.ts` «una imagen local ausente no bloquea Mermaid ni la exportación y no revela rutas»: diagrama dibujado, texto con formato, marcador de imagen, sin avisos al abrir; exporta HTML (contiene el SVG y el marcador, sin rutas) y PDF (cabecera `%PDF-`) con el aviso «1 imagen no se encontró» y sin `ENOENT`, `realpath`, `Error invoking` ni la ruta del recurso | **Falla**: el diagrama nunca se dibuja (espera de 40 s) | Pasa |
| Mismo archivo, control «un documento sin imágenes ausentes se exporta sin avisos de recursos» | Pasa | Pasa |

Ejecutadas con **Node v24.22.1** (el de `.nvmrc`) sobre el árbol de `main` más este cambio: `npm run check` 889 archivos, 0 errores y 0 advertencias; `npm test` 193 pruebas aprobadas (21 archivos, una más que en `main`); `npm run test:e2e` 110 aprobadas (4,1 min, dos más que en `main`), sin reintentos.

## Límites

- El PDF se comprobó por su cabecera y por la ausencia de error; no se inspeccionó visualmente.
- Chromium intenta cargar el `src` relativo de la imagen antes de que Preview lo sustituya y registra `net::ERR_FILE_NOT_FOUND` en la consola del renderer. No es un aviso para la persona usuaria y no cambia con este PR.
- Una imagen de tipo no admitido o mayor de 8 MiB sigue mostrándose como «Imagen no disponible» (comportamiento previo); el aviso de exportación la cuenta como ausente.
- La CI de cuatro sistemas del commit de este PR es la comprobación de Windows y Linux.

## Cómo revertir

Revertir el PR; solo afecta a `Documents.image`, `Preview.svelte` y al aviso de exportación de `App.svelte`.
