# SEG-S2e · DOCX inválido conservado

**Estado: DIFERIDO.** Evidencia del límite pendiente de `custom-style` en SEG-S2a. No constituye una reparación, un prototipo ni una validación visual en Word.

## Artefacto exacto

| Dato | Valor |
| --- | --- |
| Archivo | [custom-style-invalid.docx](custom-style-invalid.docx) |
| Tamaño | 10 707 bytes |
| SHA-256 | `cd3416aa091609f9c0de04bfdcfeb7e2cec629fcc72a43806fa64cf0b8c233d8` |
| Origen | Salida real `word-xml-batch-1.docx` del caso de estilos SEG-S2a, conservada en `real-style-artifact-results/academic-word-SEG-S2a-·-es-66c4c-bles-conservan-el-documento-md/` |
| Operación de esta entrega | Copia byte por byte; no se regeneró, abrió para guardar ni normalizó |

Se verificaron los bytes del original y de la copia con SHA-256 y comparación directa. La copia debe permanecer inmutable; futuras salidas corregidas se guardarán con otro nombre.

## Inspección estática real

El ZIP contiene `word/document.xml`, de **3894 bytes**, SHA-256 `4e5381b776d47d0b862eb87501d3b7630461aa25b16a98bc6c9e2b1e3553d0bd`.

La lectura con el parser XML estricto de la biblioteca estándar de Python produjo:

```text
xml.etree.ElementTree.ParseError:
not well-formed (invalid token): line 42, column 44
```

Esa línea contiene un atributo `w:pStyle/@w:val` con controles no admitidos por XML, incluido NUL. El paquete DOCX existe y su ZIP puede leerse, pero eso no demuestra que su documento XML sea válido. No se alteró el XML para inspeccionarlo.

Este diagnóstico es una inspección estática del archivo ya generado, **no** una nueva ejecución de Pandoc, una prueba E2E o una apertura en Word/LibreOffice. Tampoco demuestra por sí solo qué alternativa de reparación preservará mejor el documento.

## Decisiones e invariantes que se conservan

- SEG-S2a permanece **PARCIAL** por este caso. La [historia SEG-S2e](../../stories/seg-s2e-docx-estilos.md) queda para una implementación futura, cuyo primer paso compara AST frente a limpieza del XML generado, incluyendo un documento de 10 MiB sin ampliar plazos ni tocar cuerpo o resumen.
- El propietario exige conservar la regresión de estilos. El bloque S2 la registra como fallo conocido esperado tras comprobar sus precondiciones y el error exacto; no se omite. Esta entrega documental no inspecciona ni modifica la prueba, no debilita la aserción XML y no afirma haberla vuelto a ejecutar.
- Los metadatos continúan como MetaString por `--metadata`, no mediante archivo. Se conservan 1000 por título/subtítulo/institución, 200 por autor y hasta 100 autores; además, máximo combinado de 8000 unidades UTF-16 sumando los **valores** enviados por argumentos. Ese combinado reemplaza el antiguo tope de 64 KiB del resumen.
- U+FFFD es válido como reemplazo del sustituto UTF-16 suelto aprobado. No convierte en válidos los controles XML ilegales que permanecen en el atributo del artefacto.

## No verificado ni realizado aquí

No se ejecutaron check, suites unitarias/E2E, compilación, conversiones ni un prototipo. No se modificaron producto, tests, contratos, permisos, dependencias, CI o plazos; no se usó Git. No se revisó la presentación en Word o LibreOffice. La corrección del archivo inválido y su rendimiento siguen diferidos; no se cierra la historia.
