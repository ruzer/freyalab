import {it,expect} from 'vitest'
import {prepareReportMarkdown,citationMarkdown} from '../src/main/report-markdown'
const data='data:image/png;base64,aGVsbG8='
it('resuelve los mismos números y referencias que la vista previa, conservando la fuente',async()=>{
 const source='---\nportada: true\ntitle: Informe\n---\n\n![Un *resultado*](figura.png){#fig:uno}\n\n| A |\n| - |\n| B |\n\n: Datos {#tbl:uno}\n\nVéase [@fig:uno] y [@tbl:uno], además de [@garcia2020].'
 const result=await prepareReportMarkdown(source,{image:async()=>data,diagrams:[]})
 expect(result).toContain(`![Figura 1. Un *resultado*](${data}){#figure-1}`)
 expect(result).toContain(': Tabla 1. Datos {#table-1}')
 expect(result).toContain('[Figura 1](#figure-1)');expect(result).toContain('[Tabla 1](#table-1)');expect(result).toContain('[@garcia2020]')
 expect(result).not.toContain('portada:');expect(source).toContain('![Un *resultado*](figura.png){#fig:uno}')
})
it('no transforma ejemplos de código ni texto desconocido al preparar una copia',async()=>{
 const source='```md\n![Una figura](x.png){#fig:x}\n[@fig:x]\n```\n\nTexto con Unicode 🐕 y $x^2$.\n'
 const result=await prepareReportMarkdown(source,{image:async()=>{throw new Error('No debe leer ejemplos')},diagrams:[]})
 expect(result).toBe(source)
})
it('incrusta las imágenes por referencia una sola vez con el lector autorizado',async()=>{
 const urls:string[]=[],source='![Uno][imagen]\n\n![Dos][imagen]\n\n[imagen]: ruta%20%C3%A1.png "Un título"\n'
 const result=await prepareReportMarkdown(source,{image:async url=>{urls.push(url);return data},diagrams:[]})
 expect(urls).toEqual(['ruta%20%C3%A1.png']);expect(result).toContain(`[imagen]: ${data} "Un título"`)
})
it('conserva CRLF, comillas y acentos fuera de los cambios resueltos',async()=>{
 const source='Introducción: "México" 🐕\r\n\r\n![Resultado](a.png){#fig:a}\r\n\r\nVéase [@fig:a].\r\n'
 const result=await prepareReportMarkdown(source,{image:async()=>data,diagrams:[]})
 expect(result).toContain('Introducción: "México" 🐕\r\n\r\n');expect(result).toContain('[Figura 1](#figure-1).\r\n')
})
it('sustituye sólo el bloque Mermaid coincidente por su imagen ya renderizada',async()=>{
 const source='Antes.\n\n```mermaid\nflowchart LR\n A --> B\n```\n\nDespués.'
 const result=await prepareReportMarkdown(source,{image:async()=>null,diagrams:[data]})
 expect(result).toContain(`![](${data})`);expect(result).not.toContain('```mermaid');expect(result).toContain('Antes.');expect(result).toContain('Después.')
})
it('un diagrama pendiente o inválido impide producir un DOCX incompleto',async()=>{
 await expect(prepareReportMarkdown('```mermaid\nflowchart LR\n A -->\n```',{image:async()=>null,diagrams:[]})).rejects.toThrow()
})
it('marca citas por origen aunque las notas al pie aparezcan antes que el cuerpo',()=>{
 const source='---\nbibliography: refs.json\n---\n\n[^n]: [@garcia2020, p. 1].\n\nTexto [@garcia2020, p. 2], nota[^n].'
 const result=citationMarkdown(source)
 expect(result).toContain('[[@garcia2020, p. 1]]{#freya-export-citation-1 .freya-export-citation}');expect(result).toContain('[[@garcia2020, p. 2]]{#freya-export-citation-2 .freya-export-citation}')
})
it('no marca como cita una secuencia escapada ni un ejemplo de código',()=>{
 const result=citationMarkdown('---\nbibliography: refs.json\n---\n\n\\[@garcia2020] y `[@garcia2020]`.')
 expect(result).not.toContain('.freya-export-citation');expect(result).toContain('\\[@garcia2020]')
})
it('mantiene los offsets originales al combinar referencias cruzadas y citas en un mismo párrafo',()=>{
 const source='---\nbibliography: refs.json\n---\n\n![Datos](a.png){#fig:datos}\n\nVéase [@fig:datos], fuente [@garcia2020, p. 10].'
 expect(citationMarkdown(source)).toContain('[Figura 1](#figure-1), fuente [[@garcia2020, p. 10]]{#freya-export-citation-1 .freya-export-citation}.')
 expect(source).toContain('[@fig:datos]')
})
