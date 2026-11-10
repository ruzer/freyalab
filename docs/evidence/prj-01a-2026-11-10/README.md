# Evidencia de PRJ-01a

Código validado en `fb859eb697b889e689a869fbd8878e680c0a8884`, sobre AN-1a `3f559effc41bf7db9b574ef01dd6f466c76cb22b`. macOS Apple silicon, Node 24.22.1, perfil temporal y archivos sintéticos. [Diseño original](../../stories/historia-prj01-proyecto-y-fuentes-diseno-para-codex.md) · [Esquema JSON del manifiesto v1](../../design/project-manifest-v1.schema.json)

| Comprobación | Resultado |
| --- | --- |
| Prueba inicial de Electron en `ce7f21a` | Falló al buscar «Crear proyecto». |
| Pruebas de almacenamiento y contrato | Antes del cambio faltaba el servicio. Después quedaron cubiertas la creación simultánea sin sobrescritura, referencias inválidas, cambio externo durante la confirmación, historial de recientes dañado y falta de soporte para enlaces duros simulada. |
| `npm run check` y `npm run build` | Pasaron. Svelte informó cero errores y advertencias. |
| `npm test` | 2.659 pasaron. Una comprobación de HTTP se omitió porque el binario local de Pandoc carece de ese soporte. |
| `playwright test tests/e2e/project.spec.ts --project=shell --workers=1 --retries=0` | 5 pasaron en 5,0 s. Se comprobó el recorrido por teclado, apertura desde carpeta, manifiesto y recientes, eliminación de un reciente ausente, cancelación y conservación de bytes de una versión futura. |

## Capturas de 1440 × 900

| Idioma | Claro | Oscuro |
| --- | --- | --- |
| Español | [Claro](prj-01a-es-light-1440x900.png) | [Oscuro](prj-01a-es-dark-1440x900.png) |
| en-XA | [Claro](prj-01a-en-XA-light-1440x900.png) | [Oscuro](prj-01a-en-XA-dark-1440x900.png) |

## Límites de la comprobación

La lectura del manifiesto admite archivos regulares de hasta 4 MiB. El nombre del proyecto admite 200 caracteres. Para crear el manifiesto sin reemplazar una creación concurrente, la carpeta debe admitir enlaces duros y permitir la escritura. Cuando falla esa operación, FreyaLab conserva los archivos existentes e indica que hay que elegir otra ubicación. Se probó el error simulado. Quedan por verificar un volumen extraíble real, el recorrido con lector de pantalla nativo y la CI de los tres sistemas. El registro y la protección de fuentes corresponden a PRJ-01b.
