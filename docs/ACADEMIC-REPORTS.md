# Figuras, portada e índices

Estas opciones generan el reporte en la vista previa, HTML y PDF. El archivo Markdown conserva exactamente lo que escribes. DOCX y citas bibliográficas se incorporan en las siguientes historias; no están terminados en este bloque.

Para activar la portada y los tres índices, comienza el documento así:

```yaml
---
title: Informe de resultados
subtitle: Análisis del semestre
author: [Ana Pérez, Luis Chen]
date: 2026-10-28
institution: Universidad de ejemplo
abstract: |
  Resumen del reporte.
  Puede ocupar varias líneas.
lang: es
portada: true
toc: true
lof: true
lot: true
---
```

portada activa la portada; toc el contenido; lof las figuras; lot las tablas. Cada opción es independiente y requiere true sin comillas; false o ausencia la desactiva. Un índice sin elementos se omite. Sin portada, los metadatos permanecen en Propiedades del documento y no se imprimen como portada. Solo se incluyen las propiedades indicadas; nunca otros datos del front matter.

Las propiedades son texto, sin HTML. Autores admite un nombre, una lista entre corchetes o una lista YAML de líneas. El resumen admite texto, | para conservar líneas y > para unirlas. No se interpretan alias ni estructuras YAML arbitrarias. Para comas en un nombre, usa comillas: author: ["Pérez, Ana", "Luis Chen"].

## Figuras y tablas

Coloca la imagen sola en su párrafo y añade su identificador:

```markdown
![Ventas **totales** por ciudad](informe.assets/ventas.png){#fig:ventas}

Véase [@fig:ventas].
```

Se verá «Figura1. Ventas totales por ciudad», y la referencia enlazará con ella. Usa la carpeta de activos propia de tu documento para conservar las imágenes al Guardar como; las advertencias de activos siguen disponibles en el aviso de la aplicación.

Para una tabla, escribe el pie debajo:

```markdown
| Ciudad | Total |
| --- | --- |
| Oaxaca | 100 |

: Resultados **revisados** {#tbl:resultados}

Consulta [@tbl:resultados].
```

Figuras y tablas llevan contadores separados. Se renumeran al moverlas. Sin identificador se muestran como antes; los duplicados muestran una advertencia y las referencias apuntan a la primera aparición. Una referencia sin destino queda marcada sin inventar un enlace.

lang elige los rótulos del documento (es/en/fr/pt/de/it; otro valor recurre al español). No traduce el contenido ni sustituye el idioma de la aplicación.

## Exportar

En Exportar elige HTML autónomo o Documento PDF. La portada se imprime separada del resto. Los índices PDF tienen enlaces; no calculan números de página dentro del índice. El índice lateral de edición conserva solo los encabezados del cuerpo y no incluye la portada o los índices generados.
