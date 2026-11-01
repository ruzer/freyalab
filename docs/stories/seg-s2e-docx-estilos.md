# SEG-S2e · Estilos DOCX con caracteres no válidos

**Estado: DIFERIDO · solo historia.** El propietario autorizó documentar este trabajo en el objetivo del 2026-10-30 (§§1.2–1.3), no implementarlo ni crear un prototipo. SEG-S2a sigue **PARCIAL** en este punto.

## Problema y evidencia

Una exportación real produjo un DOCX cuyo `word/document.xml` contiene caracteres de control no admitidos en XML dentro del atributo del estilo de párrafo. El archivo se conserva, sin regenerar ni corregir, en [custom-style-invalid.docx](../evidence/seg-s2e-2026-10-30/custom-style-invalid.docx): **10 707 bytes**, SHA-256 `cd3416aa091609f9c0de04bfdcfeb7e2cec629fcc72a43806fa64cf0b8c233d8`.

La inspección estática y sus límites constan en el [README de evidencia](../evidence/seg-s2e-2026-10-30/README.md). Un archivo creado y una notificación de exportación correcta no bastan para acreditar un DOCX válido.

## Primer paso de una implementación futura

Comparar dos alternativas antes de elegir una: tratar el atributo `custom-style` en el AST antes de la escritura DOCX, o limpiar caracteres ilegales en las partes XML del DOCX ya generado, comprobando que se conserva el texto. Esta historia **no selecciona arquitectura** ni autoriza el prototipo ahora.

La comparación futura deberá registrar preservación de texto, XML estricto, superficie de cambio, tiempo y memoria con un documento pequeño y un Markdown de **10 MiB en total**, con metadatos dentro de sus topes. Reutilizará las herramientas ya disponibles y los presupuestos existentes: sin subir plazos, reducir el documento ni relajar límites para obtener verde. El XML mal formado es parte del problema; no se dará por hecho que puede parsearse antes de limpiarlo.

## Invariantes aprobados

- El archivo Markdown original, su cuerpo y su resumen no se reescriben, recortan ni normalizan. Cualquier tratamiento de las partes XML debe demostrar que no cambia esos textos ni otros valores válidos.
- Los metadatos continúan por argumentos `--metadata` como **MetaString**. No pasan a un archivo de metadatos: Pandoc lo interpretaría como Markdown y cambiaría el texto literal.
- Se conservan los topes por campo: título, subtítulo e institución de 1000 caracteres; 200 por autor y un máximo de 100 autores. Además, la **suma de los valores** de todos los metadatos enviados por argumentos tiene un máximo combinado de **8000 unidades UTF-16**. No se suman nombres de campos ni opciones CLI. Este tope sustituye al antiguo límite de 64 KiB del resumen; no se añaden ambos límites.
- Rechazar un exceso antes de invocar Pandoc, con el mensaje es/en previsto y sin truncar. La reparación del estilo no cambia esta validación.
- Un sustituto UTF-16 suelto puede representarse como **U+FFFD**; la prueba debe documentarlo. No confundir ese reemplazo admitido con los controles XML ilegales del atributo.
- Esta entrega no cambia dependencias, contratos, permisos, seguridad ni la cadena de conversión. La comparación futura debe señalar qué cambios exigiría cada alternativa; su implementación requiere la autorización de la historia.

## Criterios de aceptación futuros

| ID | Resultado exigido |
| --- | --- |
| E1 | Comparación AST frente a XML generado documentada, con el documento de 10 MiB, mediciones reales y una decisión motivada. No basta contar líneas de código. |
| E2 | El caso del artefacto real deja de producir XML inválido bajo la solución elegida, manteniendo la aserción estricta de XML y el texto esperado del cuerpo y resumen. No se convierte el defecto en una exportación silenciosamente incompleta. |
| E3 | Estilos válidos de párrafo y de texto siguen aplicándose; nombres con acentos, caracteres astrales y caracteres que requieren escape XML se verifican sin tocar el contenido del documento. |
| E4 | Los controles del atributo, valores vacíos y sustitutos sueltos tienen resultados explícitos y verificables. U+FFFD sigue permitido en el caso aprobado; no se elimina contenido desconocido del cuerpo. |
| E5 | Los metadatos siguen siendo MetaString y se conservan los límites por campo y el combinado UTF-16, incluidos sus bordes y el rechazo anterior a Pandoc. |
| E6 | El artefacto original conserva tamaño y SHA; una salida corregida se guarda aparte y se inspecciona como DOCX, XML y contenido visible. No se sobrescribe la evidencia roja. |

## Pruebas previstas, no ejecutadas aquí

Conservar la regresión de estilos **activa**, sin `skip`. El propietario exige conservar la regresión. En el bloque actual se registra como fallo esperado sólo tras comprobar las precondiciones y el error conocido; se conserva la aserción XML estricta. Esta entrega no verifica ni modifica su implementación. Una reparación futura deberá demostrar rojo→verde con esas mismas comprobaciones, y retirar el fallo esperado sólo cuando el defecto esté corregido.

Comparar una salida de control sin estilo y otra con estilo válido frente al caso inválido: mismos textos de cuerpo y resumen, mismos metadatos literales y XML estricto. Incluir NUL/controles XML, comillas y entidades, Unicode, U+FFFD y los bordes del tope combinado. Medir el documento de 10 MiB con los presupuestos existentes y comprobar que la entrada permanece idéntica.

No se ha implementado la reparación, ejecutado un conversor, modificado la prueba ni abierto el artefacto en Word o LibreOffice como parte de esta historia documental. El riesgo pendiente es que una exportación con este `custom-style` produzca un paquete DOCX existente pero con XML inválido.
