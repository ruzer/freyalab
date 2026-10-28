import {describe,it,expect,vi} from 'vitest'
import {EditorState,EditorSelection} from '@codemirror/state'
import {markdown,markdownLanguage} from '@codemirror/lang-markdown'
import {ensureSyntaxTree,syntaxTreeAvailable} from '@codemirror/language'
import {markdownHTML} from '../src/renderer/lib/render'
import {markdownLinkOnPaste} from '../src/renderer/lib/markdown-paste'

type Case={name:string;doc?:string;selected?:string;clipboard?:string;expected?:string;readonly?:boolean;multiple?:boolean}
const url='https://example.org'
function stateFor(value:Case){
 const doc=value.doc??'Freya',text=doc.replace(/\r\n?/g,'\n'),selected=value.selected??text,from=text.indexOf(selected),to=from+selected.length
 const state=EditorState.create({doc,selection:value.multiple?EditorSelection.create([EditorSelection.range(0,1),EditorSelection.range(2,3)]):EditorSelection.range(from,to),extensions:[markdown({pasteURLAsLink:false}),EditorState.readOnly.of(!!value.readonly),EditorState.allowMultipleSelections.of(true),...(doc.includes('\r\n')?[EditorState.lineSeparator.of('\r\n')]:[])]})
 // Fixtures pequeñas: su árbol no debe depender del presupuesto inicial de CodeMirror.
 expect(ensureSyntaxTree(state,state.doc.length,Infinity)).not.toBeNull()
 const ready=state.update({}).state
 expect(syntaxTreeAvailable(ready,ready.doc.length)).toBe(true)
 return ready
}
const cases:Case[]=[
 {name:'https',expected:'[Freya](https://example.org)'},
 {name:'http',clipboard:'http://example.org/a?x=1#fin',expected:'[Freya](http://example.org/a?x=1#fin)'},
 {name:'mailto',clipboard:'mailto:freya@example.org',expected:'[Freya](mailto:freya@example.org)'},
 {name:'Unicode',doc:'Freya 🐕 café',expected:'[Freya 🐕 café](https://example.org)'},
 {name:'título',doc:'# Freya',selected:'Freya',expected:'# [Freya](https://example.org)'},
 {name:'dentro de negrita',doc:'**Freya**',selected:'Freya',expected:'**[Freya](https://example.org)**'},
 {name:'negrita completa',doc:'**Freya**',expected:'[**Freya**](https://example.org)'},
 {name:'corchetes naturales sin referencia',doc:'A [B] (C)',expected:String.raw`[A \[B\] \(C\)](https://example.org)`},
 {name:'barra invertida del texto',doc:String.raw`A\B`,expected:String.raw`[A\\B](https://example.org)`},
 {name:'paréntesis del destino',clipboard:'https://en.wikipedia.org/wiki/A_(B)',expected:String.raw`[Freya](https://en.wikipedia.org/wiki/A_\(B\))`},
 {name:'corchetes del destino',clipboard:'https://example.org/a[b]',expected:String.raw`[Freya](https://example.org/a\[b\])`},
 {name:'barra invertida del destino',clipboard:String.raw`https://example.org/a\b`,expected:String.raw`[Freya](https://example.org/a\\b)`},
 {name:'CRLF original',doc:'antes\r\nFreya\r\ndespués',selected:'Freya',expected:'antes\r\n[Freya](https://example.org)\r\ndespués'},
 {name:'portapapeles vacío',clipboard:''},
 {name:'javascript',clipboard:'javascript:alert(1)'},
 {name:'data',clipboard:'data:text/plain,hola'},
 {name:'ftp',clipboard:'ftp://example.org'},
 {name:'www no es uno de los protocolos',clipboard:'www.example.org'},
 {name:'xmpp no está permitido',clipboard:'xmpp:freya@example.org'},
 {name:'espacio interior',clipboard:'https://example.org/a b'},
 {name:'dos URL en líneas distintas',clipboard:'https://a.test\nhttps://b.test'},
 {name:'espacio inicial',clipboard:' https://example.org'},
 {name:'control NUL',clipboard:'https://example.org/a\u0000b'},
 {name:'control de formato',clipboard:'https://example.org/a\u200bb'},
 {name:'URL sin host',clipboard:'https://'},
 {name:'selección vacía',selected:''},
 {name:'selección multilínea',doc:'Freya\nLab'},
 {name:'solo lectura',readonly:true},
 {name:'selección múltiple',multiple:true},
 {name:'código en línea',doc:'`Freya`',selected:'Freya'},
 {name:'código cercado',doc:'```text\nFreya\n```',selected:'Freya'},
 {name:'código indentado',doc:'    Freya',selected:'Freya'},
 {name:'enlace existente',doc:'[Freya](https://old.test)',selected:'Freya'},
 {name:'autolink',doc:'<https://old.test>',selected:'old'},
 {name:'URL desnuda sin nodo GFM',doc:'https://old.test/ruta',selected:'old'},
 {name:'referencia explícita',doc:'[Freya][id]\n\n[id]: https://old.test',selected:'Freya'},
 {name:'shortcut con referencia',doc:'[Freya]\n\n[freya]: https://old.test',selected:'[Freya]'},
 {name:'imagen existente',doc:'![Freya](imagen.png)',selected:'Freya'},
 {name:'atributo HTMLTag',doc:'Texto <span title="Freya">final</span>',selected:'Freya'},
 {name:'comentario HTMLBlock',doc:'<!-- Freya -->',selected:'Freya'},
 {name:'instrucción de proceso',doc:'<?Freya?>',selected:'Freya'},
]
describe('FL-MD-005 · enlace al pegar',()=>{
 it.each(cases)('$name',value=>{
  const state=stateFor(value),before=state.sliceDoc(),selection=state.selection
  const result=markdownLinkOnPaste(state,value.clipboard??url)
  expect(state.sliceDoc()).toBe(before);expect(state.selection).toBe(selection)
  if(value.expected===undefined){expect(result).toBeUndefined();return}
  expect(result).toBeDefined();expect(result!.changes).toHaveLength(1)
  const changed=state.update({changes:result!.changes,selection:EditorSelection.range(result!.selection.anchor,result!.selection.head)}).state
  expect(changed.sliceDoc()).toBe(value.expected)
  expect(changed.selection.main.empty).toBe(true)
 })
 it('los escapes conservan texto y destino al renderizar Markdown real',async()=>{
  const value={name:'escapes',doc:'A [B] (C)',clipboard:'https://example.org/a(b)[c]'},state=stateFor(value),result=markdownLinkOnPaste(state,value.clipboard)!
  const output=state.update({changes:result.changes}).state.sliceDoc(),html=(await markdownHTML(output)).html
  expect(html).toContain('>A [B] (C)</a>');expect(html).toContain('href="https://example.org/a(b)%5Bc%5D"')
 })
 it('prepara el título con el presupuesto inicial agotado',()=>{
  let now=0
  const clock=vi.spyOn(Date,'now').mockImplementation(()=>now+=1000)
  try{
   const state=stateFor({name:'título',doc:'# Freya',selected:'Freya'})
   expect(syntaxTreeAvailable(state,state.doc.length)).toBe(true)
   const result=markdownLinkOnPaste(state,url)
   expect(result).toBeDefined()
   expect(state.update({changes:result!.changes}).state.sliceDoc()).toBe('# [Freya](https://example.org)')
  }finally{clock.mockRestore()}
 })
 it('no envuelve la selección si el presupuesto inicial deja un árbol incompleto',()=>{
  let now=0
  const clock=vi.spyOn(Date,'now').mockImplementation(()=>now+=1000)
  try{
   const state=EditorState.create({doc:'# Freya',selection:EditorSelection.range(2,7),extensions:[markdown({pasteURLAsLink:false})]})
   const before=state.sliceDoc(),selection=state.selection,parse=vi.spyOn(markdownLanguage.parser,'startParse')
   try{
    expect(syntaxTreeAvailable(state,state.doc.length)).toBe(false)
    expect(markdownLinkOnPaste(state,url)).toBeUndefined();expect(parse).not.toHaveBeenCalled()
    expect(state.sliceDoc()).toBe(before);expect(state.selection).toBe(selection)
   }finally{parse.mockRestore()}
  }finally{clock.mockRestore()}
 })
 it('consulta el árbol disponible sin iniciar un nuevo parseo',()=>{
  const state=stateFor({name:'árbol'}),parse=vi.spyOn(markdownLanguage.parser,'startParse')
  try{expect(markdownLinkOnPaste(state,url)).toBeDefined();expect(parse).not.toHaveBeenCalled()}finally{parse.mockRestore()}
 })
})
