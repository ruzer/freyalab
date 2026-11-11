import {expect,it} from 'vitest'
import {EditorState} from '@codemirror/state'
import {ensureSyntaxTree} from '@codemirror/language'
import {csvColumnExtensions} from '../src/renderer/lib/csv-column-colors'
import {csvTextDocument} from '../src/renderer/lib/csv-text-model'

function tokens(raw:string,delimiter=','){
 const {doc,extensions}=csvTextDocument(raw)
 const state=EditorState.create({doc,extensions:[...extensions,...csvColumnExtensions(delimiter,true,true,()=>{})]})
 const tree=ensureSyntaxTree(state,state.doc.length,1000)
 if(!tree)throw new Error('No se terminó de analizar el CSV de prueba')
 const result:[string,string][]=[]
 tree.iterate({enter(node){
  if(node.name.startsWith('csv'))result.push([node.name,state.doc.sliceString(node.from,node.to)])
 }})
 return result
}
it('separa sintaxis de contenido y conserva comas y comillas escapadas en el campo',()=>{
 expect(tokens('"a, b","di ""hola""","",suelto"texto')).toEqual([
  ['csvMuted','"'],['csvField1','a, b'],['csvMuted','","'],['csvField2','di ""hola""'],
  ['csvMuted','","",'],['csvField4','suelto"texto']
 ])
})
it('conserva columna en CRLF internos y resetea en registro nuevo y fila vacía',()=>{
 expect(tokens('x,"dos\r\n\r\nlíneas",fin\r\n\r\notro,fila')).toEqual([
  ['csvField1','x'],['csvMuted',',"'],['csvField2','dos'],['csvField2','líneas'],['csvMuted','",'],
  ['csvField3','fin'],['csvField1','otro'],['csvMuted',','],['csvField2','fila']
 ])
})
it.each([['\t',','],[';',',']])('separa por %j y conserva el carácter %j', (delimiter,plain)=>{
 expect(tokens(`a${plain}b${delimiter}c`,delimiter)).toEqual([['csvField1','a,b'],['csvMuted',delimiter],['csvField2','c']])
})
it('conserva el campo de una comilla sin cerrar',()=>{
 expect(tokens('a,"fin\n,sigue')).toEqual([['csvField1','a'],['csvMuted',',"'],['csvField2','fin'],['csvField2',',sigue']])
})
it('omite el color en una línea enorme y conserva su estado de comillas',()=>{
 expect(tokens('a,"'+ 'x'.repeat(1024*1024)+'\nfin",c')).toEqual([['csvField2','fin'],['csvMuted','",'],['csvField3','c']])
})
