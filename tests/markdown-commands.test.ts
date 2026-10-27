import {describe,it,expect} from 'vitest'
import {markdownCommands,lineFormatState,codeLanguages,type MarkdownAction,type MarkdownSelection} from '../src/renderer/lib/markdown-commands'

function run(action:MarkdownAction,text:string,anchor=0,head=text.length,language:typeof codeLanguages[number]='text'){
 const change=markdownCommands[action](text,{anchor,head},language)
 let value=text
 for(const part of [...change.changes].sort((a,b)=>b.from-a.from))value=value.slice(0,part.from)+part.insert+value.slice(part.to)
 return{value,...change}
}
const lineCases:[MarkdownAction,string,string][]=[
 ['heading1','uno','# uno'],['heading2','uno','## uno'],['heading3','uno','### uno'],['heading','uno','## uno'],
 ['heading1','# uno','uno'],['heading2','## uno','uno'],['heading3','### uno','uno'],['heading1','### uno','# uno'],
 ['heading3','# uno','### uno'],['paragraph','### uno','uno'],['paragraph','uno','uno'],
 ['heading2','uno\ndos','## uno\n## dos'],['heading3','uno\n\ndos','### uno\n### \n### dos'],
 ['heading1','uno\r\ndos','# uno\r\n# dos'],['paragraph','# uno\r\n## dos','uno\r\ndos'],
 ['list','uno\ndos','- uno\n- dos'],['list','- uno\n- dos','uno\ndos'],['list','+ uno\n* dos','uno\ndos'],
 ['ordered','uno\ndos','1. uno\n2. dos'],['ordered','1. uno\n2. dos','uno\ndos'],['ordered','- uno\n- dos','1. uno\n2. dos'],
 ['task','uno\ndos','- [ ] uno\n- [ ] dos'],['task','- [ ] uno\n- [x] dos','uno\ndos'],['task','- uno\n- dos','- [ ] uno\n- [ ] dos'],
 ['quote','uno\ndos','> uno\n> dos'],['quote','> uno\n> dos','uno\ndos'],['quote','uno\r\ndos','> uno\r\n> dos'],
 ['paragraph','#',''],['heading1','#',''],['heading3','#','### '],
 ['heading1','  uno','  # uno'],['list','\tuno','\t- uno'],['heading1','😀 café','# 😀 café'],
 ['heading1','a\n```python\nx=1\n```\nb','a\n```python\nx=1\n```\nb'],
 ['list','```\na\n```','```\na\n```'],['quote','~~~js\na\n~~~','~~~js\na\n~~~']
]
describe('comandos Markdown puros por línea',()=>{
 it.each(lineCases)('%s: %j → %j',(action,text,expected)=>expect(run(action,text).value).toBe(expected))
 it('selección vacía aplica a la línea actual y conserva el cursor en su texto',()=>{
  const result=run('heading2','antes\ntexto\ndespués',8,8)
  expect(result.value).toBe('antes\n## texto\ndespués');expect(result.selection).toEqual({anchor:11,head:11})
 })
 it('Tarea en una línea vacía conserva el ejemplo accesible de la barra anterior',()=>{
  const first=run('task','',0,0);expect(first.value).toBe('- [ ] Nueva tarea');expect(first.selection).toEqual({anchor:6,head:6})
  expect(run('task',first.value,first.selection.anchor,first.selection.head).value).toBe('Nueva tarea')
 })
 it('no incluye la línea donde termina una selección en su comienzo',()=>expect(run('quote','a\nb\nc',0,2).value).toBe('> a\nb\nc'))
 it('conserva la dirección de una selección inversa',()=>{
  const result=run('list','uno\ndos',7,0);expect(result.value).toBe('- uno\n- dos');expect(result.selection.anchor).toBeGreaterThan(result.selection.head)
 })
 it.each(['heading1','paragraph','list','ordered','task','quote'] as const)('%s no toca código ni selección al estar el cursor dentro de una cerca',action=>{
  const text='antes\n```python\n# conservar\n```\ndespués',selection:MarkdownSelection={anchor:20,head:20}
  expect(markdownCommands[action](text,selection)).toEqual({changes:[],selection})
 })
 it.each([
  ['> ```\n> preservar\n> ```',11],['- ```\n  preservar\n  ```',10],
  ['> > ```python\n> > preservar\n> > ```',20],['  - ```\n    preservar\n    ```',14],
  ['> - ```\n>   preservar\n>   ```',14],['- > ```\n  > preservar\n  > ```',14],
  ['-\t```\n\tpreservar\n\t```',10]
 ] as const)('protege cercas dentro de contenedores: %s',(text,cursor)=>{
  for(const action of ['heading1','paragraph','list','ordered','task','quote'] as const){
   const selection={anchor:cursor,head:cursor};expect(markdownCommands[action](text,selection)).toEqual({changes:[],selection})
  }
 })
 it('una cita normal sin cerca sigue admitiendo encabezados',()=>expect(run('heading1','> normal',3,3).value).toBe('# > normal'))
 it('una lista normal sin cerca sigue admitiendo citas',()=>expect(run('quote','- normal',3,3).value).toBe('> - normal'))
 it('una cerca con contenedor cerrado no protege el párrafo siguiente',()=>expect(run('heading1','- ```\n  código\n  ```\nfuera',25,25).value).toBe('- ```\n  código\n  ```\n# fuera'))
 it('una lista aparente dentro de una cerca normal no la cierra',()=>{
  const text='```\n- ```\n# preservar\n```',selection={anchor:16,head:16}
  expect(markdownCommands.heading1(text,selection)).toEqual({changes:[],selection})
 })
 it('quitar código en un contenedor conserva su estructura como operación no disponible',()=>{
  const text='> ```python\n> preservar\n> ```',selection={anchor:17,head:17}
  expect(markdownCommands.code(text,selection)).toEqual({changes:[],selection})
 })
 it('una cerca sin cerrar también protege su contenido',()=>expect(run('quote','```\ntexto',5,8).value).toBe('```\ntexto'))
})
describe('formato en línea reversible',()=>{
 it.each([['bold','**'],['italic','*'],['strike','~~'],['inline','`']] as const)('%s se aplica y se quita sin cambiar contenido',(action,marker)=>{
  const first=run(action,'café 😀');expect(first.value).toBe(marker+'café 😀'+marker)
  const second=run(action,first.value,first.selection.anchor,first.selection.head);expect(second.value).toBe('café 😀')
 })
 it.each([['bold','****',2],['italic','**',1],['strike','~~~~',2],['inline','``',1]] as const)('%s vacío deja cursor dentro y se revierte',(action,expected,cursor)=>{
  const first=run(action,'',0,0);expect(first.value).toBe(expected);expect(first.selection).toEqual({anchor:cursor,head:cursor})
  expect(run(action,first.value,cursor,cursor).value).toBe('')
 })
 it.each(['bold','italic','strike','inline'] as const)('%s quita marcadores incluidos en la selección',action=>{
  const first=run(action,'texto');expect(run(action,first.value).value).toBe('texto')
 })
 it('código en línea elige una cerca que no rompe los backticks seleccionados',()=>{
  const first=run('inline','a`b');expect(first.value).toBe('``a`b``');expect(run('inline',first.value,first.selection.anchor,first.selection.head).value).toBe('a`b')
 })
 it('no divide un par sustituto aunque la selección esté en medio',()=>{
  const result=run('bold','a😀b',2,2);expect(result.value).toBe('a****😀b')
  expect(result.value).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/u)
 })
 it('cursiva sobre negrita añade su marcador sin quitar media negrita',()=>{
  expect(run('italic','**texto**').value).toBe('***texto***')
  expect(run('italic','**texto**',2,7).value).toBe('***texto***')
 })
 it('cursiva combinada se quita conservando la negrita',()=>{
  expect(run('italic','***texto***').value).toBe('**texto**')
  expect(run('italic','***texto***',3,8).value).toBe('**texto**')
 })
 it('acepta marcadores existentes con guiones bajos al quitar formato',()=>{
  expect(run('italic','_texto_').value).toBe('texto');expect(run('bold','__texto__').value).toBe('texto')
 })
 it('quitar negrita desde su interior conserva el cursor relativo',()=>{
  const result=run('bold','**texto**',4,4);expect(result.value).toBe('texto');expect(result.selection).toEqual({anchor:2,head:2})
 })
})
describe('inserciones',()=>{
 it.each(codeLanguages)('bloque %s conserva contenido e indentación y es reversible',language=>{
  const first=run('code','  x\n    y',0,9,language);expect(first.value).toContain('```'+language+'\n  x\n    y\n```')
  expect(run('code',first.value,first.selection.anchor,first.selection.head,language).value).toBe('  x\n    y')
 })
 it('bloque usa una cerca más larga que las del contenido',()=>expect(run('code','const a = "```"').value).toContain('````text\nconst a = "```"\n````'))
 it('bloque conserva CRLF',()=>expect(run('code','a\r\nb').value).toBe('```text\r\na\r\nb\r\n```'))
 it('separador es reversible',()=>{const first=run('rule','',0,0);expect(first.value).toBe('---');expect(run('rule',first.value,first.selection.anchor,first.selection.head).value).toBe('')})
 it('enlace es reversible y conserva el texto',()=>{const first=run('link','Freya');expect(first.value).toBe('[Freya](https://ejemplo.com)');expect(run('link',first.value,first.selection.anchor,first.selection.head).value).toBe('Freya')})
 it('conserva el ejemplo de tabla',()=>expect(run('table','').value).toBe('| Columna 1 | Columna 2 |\n| --- | --- |\n| Dato 1 | Dato 2 |'))
 it('conserva Mermaid como Markdown estándar',()=>expect(run('mermaid','').value).toBe('```mermaid\nflowchart LR\n  A[Inicio] --> B[Proceso]\n  B --> C[Fin]\n```'))
})
describe('estado local de la línea del cursor',()=>{
 it.each([['**negrita**',5,'bold'],['*cursiva*',4,'italic'],['~~tachado~~',5,'strike'],['`código`',4,'inline']] as const)('detecta %s',(line,cursor,key)=>expect(lineFormatState(line,cursor)[key]).toBe(true))
 it.each([['****',2,'bold'],['**',1,'italic'],['~~~~',2,'strike'],['``',1,'inline']] as const)('estado activo de marcadores vacíos %s',(line,cursor,key)=>expect(lineFormatState(line,cursor)[key]).toBe(true))
 it.each([['\\****',3,'bold'],['\\**',2,'italic'],['\\~~~~',3,'strike'],['\\``',2,'inline']] as const)('no activa marcadores vacíos escapados %s',(line,cursor,key)=>expect(lineFormatState(line,cursor)[key]).toBe(false))
 it('marcadores vacíos no activan el formato desde otra posición',()=>expect(lineFormatState('****',0).bold).toBe(false))
 it('estado local recorre una línea larga de códigos y marcadores sin crecimiento cuadrático',()=>{
  const line='`x` *y* ~~z~~ '.repeat(20000)+'**final**',started=performance.now()
  const state=lineFormatState(line,line.length-4)
  expect(state.bold).toBe(true);expect(state.italic).toBe(false);expect(state.inline).toBe(false)
  expect(performance.now()-started).toBeLessThan(2000)
 })
 it('reconoce cursiva y negrita combinadas',()=>{
  const state=lineFormatState('***texto***',5);expect(state.bold).toBe(true);expect(state.italic).toBe(true)
 })
 it('reconoce énfasis con guiones bajos sin interpretar identificadores',()=>{
  expect(lineFormatState('__texto__',5).bold).toBe(true);expect(lineFormatState('_texto_',3).italic).toBe(true);expect(lineFormatState('id_con_guiones',5).italic).toBe(false)
 })
 it('reconoce el título ATX vacío sin espacio',()=>expect(lineFormatState('#',1).block).toBe('heading1'))
 it('no toma negrita como cursiva',()=>expect(lineFormatState('**negrita**',5).italic).toBe(false))
 it('ignora marcadores escapados',()=>expect(lineFormatState('\\*literal\\*',5).italic).toBe(false))
 it('ignora marcadores dentro de código en línea',()=>expect(lineFormatState('`~~literal~~`',5).strike).toBe(false))
 it.each([['texto','paragraph'],['# texto','heading1'],['## texto','heading2'],['### texto','heading3']] as const)('bloque de %s',(line,block)=>expect(lineFormatState(line,line.length).block).toBe(block))
})

describe('FL-MD-008 · fecha y hora locales inyectadas',()=>{
 const fixed=new Date(2024,1,29,9,5,48)
 function dated(action:'date'|'datetime',text:string,anchor=0,head=anchor,now:Date|undefined=fixed){
  const result=markdownCommands[action](text,{anchor,head},undefined,now)
  let value=text
  for(const change of [...result.changes].sort((a,b)=>b.from-a.from))value=value.slice(0,change.from)+change.insert+value.slice(change.to)
  return{...result,value}
 }
 const dates=[
  [new Date(2024,1,29,9,5),'2024-02-29','2024-02-29 09:05'],
  [new Date(2026,0,2,0,0),'2026-01-02','2026-01-02 00:00'],
  [new Date(2025,11,31,23,59),'2025-12-31','2025-12-31 23:59'],
  [new Date(2026,0,1,0,1),'2026-01-01','2026-01-01 00:01'],
  [new Date(2026,11,10,10,9),'2026-12-10','2026-12-10 10:09'],
  [new Date(1999,11,31,23,59),'1999-12-31','1999-12-31 23:59'],
 ] as const
 for(const action of ['date','datetime'] as const)it.each(dates)(`${action}: %s`,(now,date,datetime)=>{
  const expected=action==='date'?date:datetime,result=dated(action,'',0,0,now)
  expect(result.value).toBe(expected);expect(result.changes).toHaveLength(1)
  expect(result.selection).toEqual({anchor:expected.length,head:expected.length})
 })
 it.each([
  ['vacío','',0,0,'2024-02-29'],
  ['cursor interior','abc',1,1,'a2024-02-29bc'],
  ['reemplazo','hola mundo',5,10,'hola 2024-02-29'],
  ['selección inversa','hola mundo',10,5,'hola 2024-02-29'],
  ['selección multilínea LF','a\nb\nc',0,5,'2024-02-29'],
  ['selección multilínea CRLF','a\r\nb\r\nc',0,7,'2024-02-29'],
  ['resto LF intacto','uno\ntexto\nfin',4,9,'uno\n2024-02-29\nfin'],
  ['resto CRLF intacto','uno\r\ntexto\r\nfin',5,10,'uno\r\n2024-02-29\r\nfin'],
  ['dentro de cerca','```text\nx\n```',8,9,'```text\n2024-02-29\n```'],
  ['dentro de propiedades','---\nfecha: \n---',11,11,'---\nfecha: 2024-02-29\n---'],
  ['no parte Unicode','A🐕B',2,2,'A2024-02-29🐕B'],
 ] as const)('%s',(_,text,anchor,head,expected)=>{
  const result=dated('date',text,anchor,head);expect(result.value).toBe(expected)
  expect(result.selection.anchor).toBe(result.selection.head)
  expect(result.changes).toHaveLength(1)
 })
 for(const action of ['date','datetime'] as const){
  it(`${action}: sin reloj no cambia texto ni selección`,()=>{
   const original={anchor:1,head:2},result=markdownCommands[action]('abc',original)
   expect(result).toEqual({changes:[],selection:original})
  })
  it(`${action}: Invalid Date no cambia texto ni selección`,()=>{
   const original={anchor:2,head:1},result=markdownCommands[action]('abc',original,undefined,new Date(NaN))
   expect(result).toEqual({changes:[],selection:original})
  })
 }
 it('no modifica el objeto Date y no inserta segundos',()=>{
  const timestamp=fixed.getTime(),result=dated('datetime','antes después',6,6)
  expect(result.value).toBe('antes 2024-02-29 09:05después');expect(fixed.getTime()).toBe(timestamp)
 })
 it('completa también los años menores de cuatro cifras',()=>{
  const now=new Date(2000,0,2,0,0);now.setFullYear(0)
  expect(dated('date','',0,0,now).value).toBe('0000-01-02')
 })
 it('respeta la hora local que resuelve el sistema en un día de cambio horario',()=>{
  const now=new Date(2024,2,10,2,30),result=dated('datetime','',0,0,now)
  expect(new Date(result.value.replace(' ','T')).getTime()).toBe(now.getTime())
 })
})
