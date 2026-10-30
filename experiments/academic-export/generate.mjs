import {mkdir,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import assert from 'node:assert/strict'

export const sha256=data=>createHash('sha256').update(data).digest('hex')
const paragraph=label=>`${label}. Este texto sintético describe una revisión de datos locales y documenta decisiones reproducibles. El equipo comprueba las fuentes, conserva los identificadores y explica las limitaciones de cada resultado. Una tabla permite contrastar observaciones; una figura resume tendencias y el informe relaciona ambos elementos con sus referencias. Ningún registro pertenece a una persona real ni procede de un expediente privado. La finalidad es medir la exportación de un documento extenso con una estructura académica normal, sin insertar saltos de página ni modificar el formato de impresión de la aplicación.`
export function reportSource(extraParagraphs){
 assert(Number.isInteger(extraParagraphs)&&extraParagraphs>=0&&extraParagraphs<=2000)
 const blocks=[`---\nportada: true\ntitle: Reporte sintético de exportación\nsubtitle: AC-04 D6 · documento reproducible\nauthor: ["Ana García", "Luis Chen"]\ninstitution: Instituto FreyaLab Sintético\ndate: 2026-10-28\nabstract: Documento sintético para medir PDF y DOCX sin alterar los originales.\ntoc: true\nlof: true\nlot: true\nlang: es\nbibliography: referencias.json\n---`]
 for(let chapter=1;chapter<=6;chapter++){
  blocks.push(`# Capítulo ${chapter}: resultados locales`,`La figura [@fig:ventas-${chapter}] y la tabla [@tbl:ventas-${chapter}] ilustran este caso. Fuente: [@garcia2020, p. 10] y [@chen2021].`)
  for(let n=1;n<=4;n++)blocks.push(paragraph(`C${chapter}-P${n}`))
  blocks.push(`![Ventas del capítulo ${chapter}](grafico.svg){#fig:ventas-${chapter}}`,`| Ciudad | Identificador | Ventas |\n| --- | --- | --- |\n| Oaxaca | 000123 | 12 |\n| Puebla | 9007199254740993 | 18 |\n| Mérida | 000125 | 21 |\n\n: Ventas verificadas del capítulo ${chapter} {#tbl:ventas-${chapter}}`,`## Método ${chapter}`,`Una medida documentada es $x_i^2$. La nota ofrece contexto[^nota-${chapter}].`,`\`\`\`python\nregistro = {"id": "000123", "total": 12}\nprint(registro["total"])\n\`\`\``)
  if(chapter%2===0)blocks.push(`\`\`\`mermaid\nflowchart LR\n A[Datos locales] --> B[Revisión ${chapter}] --> C[Reporte]\n\`\`\``)
  blocks.push(`[^nota-${chapter}]: Nota sintética del capítulo ${chapter}; conserva la referencia [@garcia2020].`)
 }
 blocks.push('# Desarrollo complementario')
 for(let n=1;n<=extraParagraphs;n++)blocks.push(paragraph(`APENDICE-${String(n).padStart(4,'0')}`))
 blocks.push('FIN-REPORTE-SINTETICO')
 return blocks.join('\n\n')+'\n'
}
export const library=[{id:'garcia2020',type:'book',title:'Fuente local verificable',author:[{family:'García',given:'Ana'}],issued:{'date-parts':[[2020]]}},{id:'chen2021',type:'article-journal',title:'Revisión reproducible de datos sintéticos',author:[{family:'Chen',given:'Luis'}],issued:{'date-parts':[[2021]]},'container-title':'Revista sintética',volume:'1',page:'10-20'}]
export const image='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="white"/><rect x="40" y="70" width="50" height="90" fill="#1670be"/><rect x="110" y="40" width="50" height="120" fill="#1670be"/><rect x="180" y="20" width="50" height="140" fill="#1670be"/><text x="20" y="15" fill="black" font-family="Arial" font-size="12">Ventas locales: 12, 18, 21</text></svg>\n'
export async function prepareFixture(directory,extraParagraphs){
 await mkdir(directory,{recursive:true})
 const files={'informe.md':reportSource(extraParagraphs),'referencias.json':JSON.stringify(library,null,2)+'\n','grafico.svg':image}
 for(const [name,content]of Object.entries(files))await writeFile(join(directory,name),content)
 const manifest={state:'generado_sin_calibrar',extraParagraphs,files:Object.fromEntries(Object.entries(files).map(([name,content])=>[name,{bytes:Buffer.byteLength(content),sha256:sha256(content)}]))}
 await writeFile(join(directory,'fixture-manifest.json'),JSON.stringify(manifest,null,2)+'\n')
 return manifest
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [directory,count='200']=process.argv.slice(2);assert(directory,'Uso: node generate.mjs DIRECTORIO [PÁRRAFOS_ADICIONALES]')
 console.log(JSON.stringify(await prepareFixture(directory,Number(count)),null,2))
}
