# Referencia interna de DOCX

Estos seis XML y sus estilos son originales de FreyaLab y usan la licencia MIT del proyecto. No proceden de una plantilla o del `reference.docx` de Pandoc. El recurso sólo se usa para exportar DOCX con portada; no admite una ruta elegida por el documento o la interfaz.

`python3 scripts/docx-reference.py` genera `src/main/docx-reference.docx` y este directorio contiene su manifiesto. El ZIP usa `ZIP_STORED`, orden fijo, fecha fija y atributos fijos. Normaliza CRLF a LF para producir los mismos bytes en los checkouts de Windows, Linux y macOS. Python sólo genera el recurso durante desarrollo: la aplicación distribuye y lee el DOCX ya generado.

Los estilos son Normal, Title, Subtitle, Author, Date, AbstractTitle, Abstract, TOCHeading, Heading1–6, ImageCaption, TableCaption, Bibliography y FreyaPageBreak. Los nombres que usa el escritor DOCX de Pandoc se comprobaron con una muestra real. FreyaPageBreak conserva un párrafo U+200B en el Markdown preparado, con salto previo y fuente de 1 pt; TOCHeading también inicia página. La fuente original del documento no se modifica.

Con portada e índice, el orden que produce Pandoc es portada, índice actualizable y cuerpo. El escritor predeterminado imprime título, subtítulo, autores, fecha y resumen; no imprime `institution`. El título de índice predeterminado observado es `Table of Contents`; `metadata.tocTitle` permite suministrar la etiqueta del idioma del documento mediante el único metadato fijo `toc-title`. Esta referencia no mezcla esos datos en otros campos ni implica que Word actualice el índice automáticamente.


La referencia también define los estilos de cuerpo que usa el escritor: BodyText, FirstParagraph, Compact, CaptionedFigure, FootnoteText y BlockText; los de carácter FootnoteReference, Hyperlink y VerbatimChar; y Table. Son definiciones propias mínimas, sin extraer estilos de Pandoc. Los únicos saltos previos siguen siendo TOCHeading y FreyaPageBreak.

Una comprobación con un reporte real detectó que dejar esos IDs sin definición hacía que LibreOffice tratara párrafos y celdas como títulos y produjera doce páginas. Un clon del mismo DOCX, cambiando exclusivamente estilos de cuerpo faltantes, redujo la salida a cinco páginas. La prueba real comprueba que los estilos usados por pies, tablas, código, citas y notas tienen definición. Los campos de índice siguen requiriendo actualización en el lector.
