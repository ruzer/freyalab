import {describe,it,expect} from 'vitest'
import {EditorState} from '@codemirror/state'
import {markdown} from '@codemirror/lang-markdown'
import {ensureSyntaxTree,syntaxTreeAvailable} from '@codemirror/language'
import {markdownDiagramBlocks,diagramDocumentLine,matchDiagramBlocks,type DiagramBlock} from '../src/renderer/lib/diagram-diagnostics'

function stateOf(source:string){
 const state=EditorState.create({doc:source,extensions:[markdown(),...(source.includes('\r\n')?[EditorState.lineSeparator.of('\r\n')]:[])]})
 expect(ensureSyntaxTree(state,state.doc.length,Infinity)).not.toBeNull()
 const ready=state.update({}).state
 expect(syntaxTreeAvailable(ready,ready.doc.length)).toBe(true)
 return ready
}

describe('FL-MER-007 D2 · fuentes y líneas reales desde el árbol Markdown de CodeMirror',()=>{
 it.each([
  ['fence simple','```mermaid\nflowchart LR\n  A --> B\n```',[{source:'flowchart LR\n  A --> B',lines:[2,3]}]],
  ['cerca de cuatro marcas','````mermaid\nflowchart LR\n  A --> B\n````',[{source:'flowchart LR\n  A --> B',lines:[2,3]}]],
  ['cierre más largo','```mermaid\nflowchart LR\n`````',[{source:'flowchart LR',lines:[2]}]],
  ['cerca con virgulillas','~~~mermaid\nflowchart LR\n~~~',[{source:'flowchart LR',lines:[2]}]],
  ['metadatos del bloque','```mermaid ejemplo\nflowchart LR\n```',[{source:'flowchart LR',lines:[2]}]],
  ['fin sin cierre','```mermaid\nflowchart LR\n  A --> B',[{source:'flowchart LR\n  A --> B',lines:[2,3]}]],
  ['blancos iniciales','```mermaid\n\nflowchart LR\n  A --> B\n```',[{source:'\nflowchart LR\n  A --> B',lines:[2,3,4]}]],
  ['blanco final real','```mermaid\nflowchart LR\n\n```',[{source:'flowchart LR\n',lines:[2,3]}]],
  ['bloque vacío sin línea','```mermaid\n```',[{source:'',lines:[]}]],
  ['una línea vacía real','```mermaid\n\n```',[{source:'',lines:[2]}]],
  ['dos líneas vacías reales','```mermaid\n\n\n```',[{source:'\n',lines:[2,3]}]],
  ['CRLF','Inicio\r\n\r\n```mermaid\r\nflowchart LR\r\n  A --> B\r\n```',[{source:'flowchart LR\n  A --> B',lines:[4,5]}]],
  ['BOM y propiedades','\ufeff---\ntitle: Ejemplo\n---\n\n```mermaid\nflowchart LR\n```',[{source:'flowchart LR',lines:[6]}]],
  ['propiedades CRLF','---\r\ntitle: Ejemplo\r\n...\r\n\r\n```mermaid\r\nflowchart LR\r\n```',[{source:'flowchart LR',lines:[6]}]],
  ['cita','> ```mermaid\n> flowchart LR\n>   A --> B\n> ```',[{source:'flowchart LR\n  A --> B',lines:[2,3]}]],
  ['lista','- ```mermaid\n  flowchart LR\n    A --> B\n  ```',[{source:'flowchart LR\n  A --> B',lines:[2,3]}]],
  ['cita dentro de lista','- > ```mermaid\n  > flowchart LR\n  >   A --> B\n  > ```',[{source:'flowchart LR\n  A --> B',lines:[2,3]}]],
  ['sangría de cerca','  ```mermaid\n  flowchart LR\n    A --> B\n  ```',[{source:'flowchart LR\n  A --> B',lines:[2,3]}]],
  ['sangría dentro de cita','>   ```mermaid\n>   flowchart LR\n>     A --> B\n>   ```',[{source:'flowchart LR\n  A --> B',lines:[2,3]}]],
  ['citas anidadas con sangría','> >   ```mermaid\n> >   flowchart LR\n> >     A --> B\n> >   ```',[{source:'flowchart LR\n  A --> B',lines:[2,3]}]],
  ['sangría en lista ya abierta','- Texto\n\n    ```mermaid\n    flowchart LR\n      A --> B\n    ```',[{source:'flowchart LR\n  A --> B',lines:[4,5]}]],
  ['lista numerada','10. ```mermaid\n    flowchart LR\n      A --> B\n    ```',[{source:'flowchart LR\n  A --> B',lines:[2,3]}]],
  ['EOF con salto final','```mermaid\nflowchart LR\n',[{source:'flowchart LR',lines:[2]}]],
  ['EOF sin contenido','```mermaid\n',[{source:'',lines:[]}]],
  ['tab que cruza una sangría no demostrada','  ```mermaid\n\tflowchart LR\n  ```',[]],
  ['Unicode intacto','```mermaid\nflowchart LR\n  A[🐶 Freya] --> B[Árbol]\n```',[{source:'flowchart LR\n  A[🐶 Freya] --> B[Árbol]',lines:[2,3]}]],
  ['lenguaje distinto','```python\nprint("mermaid")\n```',[]],
  ['lenguaje con mayúscula no renderizado','```Mermaid\nflowchart LR\n```',[]],
  ['código indentado','    ```mermaid\n    flowchart LR\n    ```',[]],
  ['código en línea','Texto `mermaid` y ```mermaid```.',[]],
  ['HTML opaco','<div>\n```mermaid\nflowchart LR\n```\n</div>',[]],
  ['documento sin bloques','# Guía\n\nTexto.',[]],
 ] as const)('%s',(_,source,expected)=>{
  const state=stateOf(source),before=state.sliceDoc(),selection=state.selection
  const result=markdownDiagramBlocks(state)
  expect(result.complete).toBe(true)
  expect(result.blocks.map(({source,lines})=>({source,lines}))).toEqual(expected)
  expect(state.sliceDoc()).toBe(before);expect(state.selection).toBe(selection)
 })
 it('conserva bloques repetidos y sus rangos, en coordenadas CodeMirror',()=>{
  const source='Antes\r\n\r\n```mermaid\r\nflowchart LR\r\n```\r\n\r\n```mermaid\r\nflowchart LR\r\n```',state=stateOf(source),result=markdownDiagramBlocks(state)
  expect(result.blocks.map(block=>block.lines)).toEqual([[4],[8]])
  for(const block of result.blocks){expect(state.doc.sliceString(block.from,block.to)).toBe('```mermaid\nflowchart LR\n```');expect(block.to).toBeGreaterThan(block.from)}
  expect(result.blocks[0].to).toBeLessThan(result.blocks[1].from)
 })
 it('no usa como candidato un fence dentro de las propiedades apartadas por el renderer',()=>{
  const source='---\nvalue: |\n  ```mermaid\n  flowchart LR\n  ```\n---\n\n```mermaid\nflowchart TD\n```'
  expect(markdownDiagramBlocks(stateOf(source)).blocks.map(({source,lines})=>({source,lines}))).toEqual([{source:'flowchart TD',lines:[9]}])
 })
 it('un árbol parcial no publica un prefijo aparentemente completo ni fuerza el parseado',()=>{
  const state=EditorState.create({doc:'```mermaid\nflowchart LR\n```\n\n'+'# Texto\n\n'.repeat(10000),extensions:[markdown()]})
  expect(syntaxTreeAvailable(state,state.doc.length)).toBe(false)
  expect(markdownDiagramBlocks(state)).toEqual({complete:false,blocks:[]})
  expect(syntaxTreeAvailable(state,state.doc.length)).toBe(false)
 })
})

describe('FL-MER-007 D1/D2/D6 · línea del analizador sin inventar posiciones',()=>{
 const block:DiagramBlock={source:'\nflowchart LR\n  A -->',lines:[6,7,8],from:20,to:70}
 it.each([
  ['primera',1,6],['segunda',2,7],['última',3,8],['EOF siguiente',4,8],['EOF lejano',100,8],
  ['sin línea',undefined,undefined],['cero',0,undefined],['negativa',-1,undefined],['fracción',1.5,undefined],['NaN',NaN,undefined],['infinito',Infinity,undefined],
 ] as const)('%s',(_,relative,expected)=>expect(diagramDocumentLine(block,relative)).toBe(expected))
 it('no convierte la LF sintética del HTML ni el cierre del fence en una línea de fuente',()=>{
  const block=markdownDiagramBlocks(stateOf('```mermaid\nflowchart LR\n  A --> B\n  B -->\n```')).blocks[0]
  expect(block.source).toBe('flowchart LR\n  A --> B\n  B -->')
  expect(diagramDocumentLine(block,4)).toBe(4)
  expect(diagramDocumentLine({...block,lines:[],source:''},1)).toBeUndefined()
 })
})

describe('FL-MER-007 D2 · emparejar lo renderizado sin ambigüedad de HTML ni repetidos',()=>{
 const a:DiagramBlock={source:'flowchart LR',lines:[2],from:0,to:30}
 const b:DiagramBlock={source:'sequenceDiagram',lines:[7],from:40,to:80}
 it('quita exactamente la LF sintética y conserva orden y blancos iniciales',()=>{
  const blank={...a,source:'\nflowchart LR\n',lines:[2,3,4]}
  expect(matchDiagramBlocks(['\nflowchart LR\n\n','sequenceDiagram\n'],[blank,b])).toEqual([blank,b])
 })
 it('empareja dos bloques idénticos en orden si las multiplicidades coinciden',()=>{
  const duplicate={...a,from:100,to:130,lines:[12]}
  expect(matchDiagramBlocks(['flowchart LR\n','flowchart LR\n'],[a,duplicate])).toEqual([a,duplicate])
 })
 it('un bloque HTML adicional con la misma fuente invalida todos sus pares',()=>{
  expect(matchDiagramBlocks(['flowchart LR\n','flowchart LR\n','sequenceDiagram\n'],[a,b])).toEqual([undefined,undefined,b])
 })
 it('no empareja un subconjunto de candidatos repetidos ni inventa bloques desconocidos',()=>{
  expect(matchDiagramBlocks(['flowchart LR\n','pie\n'],[a,{...a,from:100}])).toEqual([undefined,undefined])
 })
 it('fuentes en orden cruzado se descartan antes de devolver una línea equivocada',()=>{
  expect(matchDiagramBlocks(['sequenceDiagram\n','flowchart LR\n'],[a,b])).toEqual([undefined,undefined])
 })
 it('un bloque vacío no necesita LF y no convierte una línea vacía en cierre',()=>{
  const empty={...a,source:'',lines:[]}
  expect(matchDiagramBlocks([''],[empty])).toEqual([empty]);expect(diagramDocumentLine(empty,1)).toBeUndefined()
 })
})
