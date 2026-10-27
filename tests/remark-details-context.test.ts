import {describe,it,expect} from 'vitest'
import {unified} from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkDetails from '../src/renderer/lib/remark-details'
import {markdownHTML} from '../src/renderer/lib/render'

type Node=Parameters<ReturnType<typeof remarkDetails>>[0]
const parser=unified().use(remarkParse).use(remarkGfm)
const definitions=(count:number)=>Array.from({length:count},(_,i)=>`[ajena-${i}]: https://example.com/ajena-${i}`).join('\n\n')

// El AST es el de remark; únicamente se sustituye el reparseo de fragmentos.
// Contar caracteres recibidos por this.parse mide trabajo, sin depender del reloj.
function measured(summary:string,count:number,used='') {
 const source=`<details>\n<summary>${summary}</summary>\n\nTexto del plegable.\n\n</details>\n\n${used}\n\n${definitions(count)}`
 const tree:Node=parser.parse(source),inputs:string[]=[]
 remarkDetails.call({parse:value=>{inputs.push(value);return{type:'root',children:[]}}})(tree,{value:source})
 return{characters:inputs.reduce((total,value)=>total+value.length,0),inputs}
}

describe('remark details · contexto de referencias proporcional al fragmento',()=>{
 it('un plegable estándar sin corchetes procesa los mismos caracteres con 0 o 400 definiciones',()=>{
  const empty=measured('Resumen',0),many=measured('Resumen',400)
  expect(empty.inputs.length).toBeGreaterThan(0)
  expect(many.characters).toBe(empty.characters)
  expect(many.inputs.join('\n')).not.toContain('[ajena-')
 })

 it('un rótulo añade solo su definición, independientemente de las 400 ajenas',()=>{
  const used='[rótulo]: https://example.com/elegida'
  const empty=measured('[rótulo]',0,used),many=measured('[rótulo]',400,used)
  expect(many.inputs.join('\n')).toContain(used)
  expect(many.characters).toBe(empty.characters)
  expect(many.inputs.join('\n')).not.toContain('[ajena-')
 })

 it('una nota al pie añade solo su definición, sin copiar el resto del documento',()=>{
  const used='[^nota]: Nota elegida.'
  const empty=measured('Texto[^nota]',0,used),many=measured('Texto[^nota]',400,used)
  expect(many.inputs.join('\n')).toContain(used)
  expect(many.characters).toBe(empty.characters)
  expect(many.inputs.join('\n')).not.toContain('[ajena-')
 })

 it.each([
  {label:'[RÓTULO]',definition:'[rótulo]: https://example.com/elegida'},
  {label:'[texto][RÓTULO   DE   DATOS]',definition:'[rótulo de datos]: https://example.com/elegida'},
  {label:'[Rótulo][]',definition:'[rótulo]: https://example.com/elegida'}
 ])('normaliza el rótulo $label al escoger contexto, sin incluir referencias ajenas',({label,definition})=>{
  const result=measured(label,30,definition),inputs=result.inputs.join('\n')
  expect(inputs).toContain(definition)
  expect(inputs).not.toContain('[ajena-')
 })

 it.each([
  {label:'[RÓTULO]',definition:'[rótulo]: https://example.com/elegida',text:'RÓTULO'},
  {label:'[texto][RÓTULO   DE   DATOS]',definition:'[rótulo de datos]: https://example.com/elegida',text:'texto'},
  {label:'[Rótulo][]',definition:'[rótulo]: https://example.com/elegida',text:'Rótulo'},
  {label:'[SS]',definition:'[ß]: https://example.com/elegida',text:'SS'},
  {label:'[texto][mi\\]rótulo]',definition:'[mi\\]rótulo]: https://example.com/elegida',text:'texto'},
  {label:'[antes [RÓTULO]]',definition:'[rótulo]: https://example.com/elegida',text:'RÓTULO'}
 ])('preserva la resolución real de la referencia $label',async({label,definition,text})=>{
  const result=await markdownHTML(`<details>\n<summary>${label}</summary>\n\nContenido.\n\n</details>\n\n${definition}\n\n${definitions(30)}`)
  expect(result.html).toContain(`<a href="https://example.com/elegida">${text}</a>`)
 })

 it('preserva la resolución real de notas al pie exteriores en un fragmento compacto',async()=>{
  const result=await markdownHTML(`<details><summary>Más</summary>Texto[^NOTA]</details>\n\n[^nota]: Nota elegida.\n\n${definitions(30)}`)
  expect(result.html).toContain('data-footnote-ref')
  expect(result.html).toContain('Nota elegida.')
  expect(result.html).not.toContain('Texto[^NOTA]')
 })
 it('indexa una definición de enlace anidada dentro de una nota sin copiar la nota entera',async()=>{
  const source='<details><summary>Más</summary>[texto][ref]</details>\n\nUna nota[^n].\n\n[^n]: Nota.\n\n    [ref]: https://example.com/anidada'
  const result=await markdownHTML(source)
  expect(result.html).toContain('<a href="https://example.com/anidada">texto</a>')
  expect(result.html).not.toContain('[texto][ref]')
 })
})
