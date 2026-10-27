import {describe,it,expect} from 'vitest'
import {unified} from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkDetails from '../src/renderer/lib/remark-details'
import {markdownHTML} from '../src/renderer/lib/render'

type Node=Parameters<ReturnType<typeof remarkDetails>>[0]
function transform(source:string):Node {
 const tree:Node={type:'root',children:[{type:'html',value:source}]}
 remarkDetails.call({parse:value=>({type:'root',children:[{type:'text',value:value.trim()}]})})(tree)
 return tree
}
const render=async(source:string)=>String(await unified().use(remarkParse).use(remarkGfm).use(remarkDetails).use(remarkRehype).use(rehypeSanitize).use(rehypeStringify).process(source))

describe('remark details · trabajo acotado y HTML literal',()=>{
 it('una corrida larga de backticks sin pareja no vuelve a recorrer cada sufijo',()=>{
  const source='<details><summary>Ejemplo</summary>\nliteral '+'`'.repeat(4096)+'\n</details>'
  const descriptor=Object.getOwnPropertyDescriptor(String.prototype,'slice')!,original=String.prototype.slice
  let sliced=0,tree:Node
  Object.defineProperty(String.prototype,'slice',{...descriptor,value:function(this:string,start?:number,end?:number){const result=original.call(this,start,end);if(String(this)===source)sliced+=result.length;return result}})
  try{tree=transform(source)}finally{Object.defineProperty(String.prototype,'slice',descriptor)}
  expect(JSON.stringify(tree!)).toContain('`'.repeat(4096))
  expect(sliced).toBeLessThan(source.length*16)
 })
 it('corridas sin pareja de longitudes distintas no buscan repetidamente en todo el resto',()=>{
  const source='<details><summary>Ejemplo</summary>\nliteral '+Array.from({length:64},(_,i)=>'`'.repeat(i+1)+' texto ').join('')+'\n</details>'
  const descriptor=Object.getOwnPropertyDescriptor(String.prototype,'indexOf')!,original=String.prototype.indexOf
  let searched=0
  Object.defineProperty(String.prototype,'indexOf',{...descriptor,value:function(this:string,value:string,from=0){if(String(this)===source&&value.startsWith('`'))searched+=Math.max(0,source.length-from);return original.call(this,value,from)}})
  try{transform(source)}finally{Object.defineProperty(String.prototype,'indexOf',descriptor)}
  expect(searched).toBeLessThan(source.length*16)
 })
 it('EOF con muchas aperturas huérfanas desenvuelve cada contenido una sola vez',()=>{
  const size=256,source=Array.from({length:size},(_,i)=>`<details>\npayload-${i}\n`).join('')
  const descriptor=Object.getOwnPropertyDescriptor(Array.prototype,'push')!,original=Array.prototype.push
  let moves=0,tree:Node
  Object.defineProperty(Array.prototype,'push',{...descriptor,value:function(this:unknown[],...items:unknown[]){for(const item of items){const node=item as Node|undefined;if(node?.type==='text'&&node.value?.startsWith('payload-'))moves++}return original.apply(this,items)}})
  try{tree=transform(source)}finally{Object.defineProperty(Array.prototype,'push',descriptor)}
  const text=JSON.stringify(tree!)
  expect(text.match(/payload-\d+/g)).toHaveLength(size)
  expect(text).not.toContain('freyaDetails')
  expect(moves).toBeLessThanOrEqual(size*4)
 })
 it('raw code dentro de un bloque compuesto no promueve sus etiquetas literales',async()=>{
  const html=await render('<details><summary>Exterior</summary><code><details><summary>No promover</summary>literal</details></code>\n\nTexto seguro\n\n</details>')
  expect(html.match(/<details(?:\s|>)/g)).toHaveLength(1)
  expect(html).toContain('<summary>Exterior</summary>');expect(html).toContain('Texto seguro')
  expect(html).not.toContain('No promover');expect(html).not.toContain('<code>')
 })
 it('mantiene código en línea y código cercado interpretados por Markdown',async()=>{
  const html=await render('<details><summary>Ejemplo</summary>literal `<details>`\n\n```html\n<details><summary>Código</summary></details>\n```\n\n</details>')
  expect(html.match(/<details(?:\s|>)/g)).toHaveLength(1)
  expect(html).toContain('<code>');expect(html).toContain('<pre>');expect(html).toContain('Código')
 })
 it.each(['div','object','svg'])('no emite el wrapper HTML %s ni sus atributos',async tag=>{
  const html=await render(`<details><summary>Exterior</summary><${tag} onclick="x()"><details><summary>Interior permitido</summary>contenido</details></${tag}>\n\nTexto seguro\n\n</details>`)
  expect(html).toContain('<summary>Exterior</summary>');expect(html).toContain('Texto seguro')
  expect(html).not.toContain(`<${tag}`);expect(html).not.toContain('onclick')
 })
})

describe('remark details · referencias con contexto del documento',()=>{
 it('resuelve una nota compacta con su definición exterior',async()=>{
  const r=await markdownHTML('<details><summary>Más</summary>Texto[^1]</details>\n\n[^1]: Nota exterior.')
  expect(r.html).toContain('data-footnote-ref');expect(r.html).toContain('Nota exterior.')
  expect(r.html).not.toContain('Texto[^1]')
 })
 it('resuelve un enlace compacto con su definición exterior',async()=>{
  const r=await markdownHTML('<details><summary>Más</summary>[enlace][ref]</details>\n\n[ref]: https://example.com/recurso')
  expect(r.html).toContain('<a href="https://example.com/recurso">enlace</a>')
  expect(r.html).not.toContain('[enlace][ref]')
 })
 it('reutiliza definiciones Markdown normales que están dentro del plegable',async()=>{
  const r=await markdownHTML('<details><summary>Más</summary>Texto[^1] y [enlace][ref]\n\n[^1]: Nota interior.\n\n[ref]: https://example.com/interior\n\n</details>')
  expect(r.html).toContain('data-footnote-ref');expect(r.html).toContain('Nota interior.')
  expect(r.html).toContain('<a href="https://example.com/interior">enlace</a>')
  expect(r.html.match(/Nota interior\./g)).toHaveLength(1)
 })
 it('no añade definiciones del contexto a un bloque de código sin cierre',async()=>{
  const r=await markdownHTML('[ref]: https://example.com/no-filtrar\n\n<details><summary>Más</summary>\n```txt\nliteral [ref]')
  expect(r.html).toContain('literal [ref]');expect(r.html).not.toContain('https://example.com/no-filtrar')
 })
})
