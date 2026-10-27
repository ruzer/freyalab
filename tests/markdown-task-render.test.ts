import {describe,it,expect} from 'vitest'
import {markdownHTML} from '../src/renderer/lib/render'

type Reference={line:number;from:number;expectedLine:string;marker:'[ ]'|'[x]'|'[X]'}
type Fixture={name:string;source:string;needles:string[]}
const fixtures:Fixture[]=[
 {name:'LF',source:'# Lista\n\n- [ ] tarea',needles:['[ ] tarea']},
 {name:'CRLF y estados',source:'Antes\r\n\r\n- [x] una\r\n- [X] dos\r\n- [ ] tres\r\n',needles:['[x] una','[X] dos','[ ] tres']},
 {name:'BOM sin propiedades',source:'\ufeff- [ ] tarea',needles:['[ ] tarea']},
 {name:'YAML LF',source:'---\ntitle: Lista\n---\n\n- [ ] tarea',needles:['[ ] tarea']},
 {name:'YAML BOM CRLF cierre puntos',source:'\ufeff---\r\ntitle: Lista\r\n...\r\n\r\n- [X] tarea',needles:['[X] tarea']},
 {name:'anidadas y numeradas',source:'- [ ] padre\n  1. [x] hijo\n     - [ ] nieta',needles:['[ ] padre','[x] hijo','[ ] nieta']},
 {name:'citas anidadas',source:'> > 3. [ ] tarea\n> > 4. [X] otra',needles:['[ ] tarea','[X] otra']},
 {name:'asterisco y signo más',source:'* [X] una\n+ [ ] otra',needles:['[X] una','[ ] otra']},
 {name:'sangría con tabulación',source:'- [ ] padre\n\t- [x] hija',needles:['[ ] padre','[x] hija']},
 {name:'details estándar',source:'<details>\n<summary>Más</summary>\n\n- [ ] tarea\n\n</details>',needles:['[ ] tarea']},
 {name:'details sin blanco antes de tarea',source:'Antes\n\n<details>\n<summary>Más</summary>\n- [ ] tarea\n</details>',needles:['[ ] tarea']},
 {name:'details compacto con marcador literal anterior',source:'<details><summary>[ ] literal</summary>- [ ] tarea</details>',needles:['[ ] tarea']},
 {name:'dos tareas en la misma línea compacta',source:'<details><summary>[ ] literal</summary>- [ ] una</details><details><summary>Más</summary>- [x] dos</details>',needles:['[ ] una','[x] dos']},
 {name:'details en cita sin blancos',source:'> <details>\n> <summary>Más</summary>\n> - [ ] tarea\n> </details>',needles:['[ ] tarea']},
 {name:'details en lista sin blancos',source:'- <details>\n  <summary>Más</summary>\n  - [ ] tarea\n  </details>',needles:['[ ] tarea']},
 {name:'details anidados tres niveles',source:'<details><summary>Uno</summary>\n<details><summary>Dos</summary>\n<details><summary>Tres</summary>\n- [ ] tarea\n</details>\n</details>\n</details>',needles:['[ ] tarea']},
 {name:'UTF-16 antes de fragmento',source:'🐾 café\n\n<details><summary>Más 🐕</summary>\n- [ ] tarea é\n</details>',needles:['[ ] tarea é']},
 {name:'YAML y cita con fragmento CRLF',source:'---\r\ntitle: Ejemplo\r\n---\r\n\r\n> <details><summary>Más</summary>\r\n> - [ ] tarea\r\n> </details>',needles:['[ ] tarea']},
 {name:'notas al pie en orden DOM',source:'[^n]:\n    - [X] nota\n\nReferencia[^n].\n\n- [ ] principal',needles:['[ ] principal','[X] nota']},
 {name:'details con referencia y tarea',source:'<details><summary>[enlace][r]</summary>\n- [ ] tarea\n</details>\n\n[r]: https://example.com',needles:['[ ] tarea']},
]
function reference(source:string,needle:string):Reference{
 const from=source.indexOf(needle);expect(from).toBeGreaterThanOrEqual(0)
 const start=source.lastIndexOf('\n',from-1)+1,end=source.indexOf('\n',from)
 return{from,line:source.slice(0,from).split('\n').length,expectedLine:source.slice(start,end<0?source.length:end).replace(/\r$/,''),marker:source.slice(from,from+3) as Reference['marker']}
}
describe('FL-MD-004 · metadatos de tareas desde el AST saneado',()=>{
 it.each(fixtures)('$name',async({source,needles})=>{
  const before=source,result=await markdownHTML(source) as Awaited<ReturnType<typeof markdownHTML>>&{tasks?:Reference[]}
  const expected=needles.map(needle=>reference(source,needle))
  expect(result.tasks).toEqual(expected);expect(source).toBe(before)
  const items=(result.html.match(/<li\b[^>]*>/g)??[]).filter(tag=>tag.includes('class="task-list-item"'))
  expect(items).toHaveLength(expected.length)
  expect(items.map(tag=>Number(/\bdata-line="(\d+)"/.exec(tag)?.[1]))).toEqual(expected.map(task=>task.line))
  for(const input of result.html.match(/<input\b[^>]*>/g)??[])expect(input).toMatch(/\bdisabled(?:\s|=|>)/)
  expect(result.html).not.toMatch(/\bdata-(?:from|expected-line|marker|task-index)=/)
 })
 it.each([
  ['cerca','```md\n- [ ] literal\n```'],
  ['indentado','    - [ ] literal'],
  ['código en línea','`- [ ] literal`'],
  ['tabla','| A |\n| - |\n| - [ ] literal |'],
  ['input HTML','<input type="checkbox" data-line="999" onclick="x()">'],
  ['li HTML','<li class="task-list-item" data-line="999"><input type="checkbox"></li>'],
  ['code crudo en details','<details><summary>Más</summary><code>- [ ] literal</code></details>'],
 ] as const)('%s no genera tareas accionables',async(_,source)=>{
  const result=await markdownHTML(source) as Awaited<ReturnType<typeof markdownHTML>>&{tasks?:Reference[]}
  expect(result.tasks??[]).toEqual([]);expect(result.html).not.toMatch(/<li\b[^>]*\bdata-line=/)
 })
 it('los atributos escritos por el documento no se promocionan y data-line procede de la tarea real',async()=>{
  const source='<details onclick="x()" data-line="999"><summary>Más</summary>\n\n- [ ] tarea\n\n</details>',result=await markdownHTML(source) as Awaited<ReturnType<typeof markdownHTML>>&{tasks?:Reference[]}
  expect(result.tasks).toEqual([reference(source,'[ ] tarea')]);expect(result.html).toContain('data-line="3"')
  expect(result.html).not.toMatch(/onclick|data-line="999"|<script/)
 })
 it('devuelve una lista vacía explícita si no hay tareas',async()=>{
  const result=await markdownHTML('# Sin tareas') as Awaited<ReturnType<typeof markdownHTML>>&{tasks?:Reference[]}
  expect(result.tasks).toEqual([])
 })
})
