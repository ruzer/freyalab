import {EditorSelection,EditorState,type Transaction} from '@codemirror/state'
import {history,redo,undo} from '@codemirror/commands'
import {expect,it} from 'vitest'
import {convertLineEndings,csvTextDocument,editorText,replaceCsvText} from '../src/renderer/lib/csv-text-model'
import {createMarkdownSession} from '../src/renderer/lib/markdown-tasks'
import {editorPosition} from '../src/renderer/lib/editor-status'

it('la sesión Markdown conserva los bytes de los saltos mixtos y expone cada línea física',()=>{
 const source='Primera\r\nSegunda\nTercera\rCuarta',state=createMarkdownSession(source).state
 expect(state.doc.lines).toBe(4)
 expect(state.doc.line(3).text).toBe('Tercera')
 expect(editorText(state)).toBe(source)
})

it('el cursor usa la columna visible y cuenta la selección inversa sin duplicar líneas',()=>{
 const doc='a 🐾 café\n\túnico\nfin',state=EditorState.create({doc,extensions:[EditorState.allowMultipleSelections.of(true),EditorState.tabSize.of(4)]})
 const selected=state.update({selection:EditorSelection.create([EditorSelection.range(0,4),EditorSelection.range(13,10)],1)}).state
 expect(editorPosition(selected)).toEqual({line:2,column:1,selection:{lines:2,characters:6}})
 const tab=state.update({selection:EditorSelection.cursor(11)}).state
 expect(editorPosition(tab)).toEqual({line:2,column:5,selection:null})
 const combining=EditorState.create({doc:'a\u0301b\n',selection:{anchor:0,head:4}})
 expect(editorPosition(combining).selection).toEqual({lines:1,characters:3})
})

it('convertir saltos mixtos cambia el borrador de una vez, conserva selección y se puede deshacer y rehacer',()=>{
 const original='a\r\nb\nc\r',raw=csvTextDocument(original)
 let state=EditorState.create({doc:raw.doc,extensions:[raw.extensions,history()],selection:{anchor:5,head:1}})
 const target={get state(){return state},dispatch:(tr:Transaction)=>{state=tr.state}}
 const selection=state.selection
 target.dispatch(state.update(convertLineEndings(state,'CRLF')!))
 expect(editorText(state)).toBe('a\r\nb\r\nc\r\n')
 expect(state.selection.eq(selection)).toBe(true)
 expect(undo(target)).toBe(true);expect(editorText(state)).toBe(original)
 expect(redo(target)).toBe(true);expect(editorText(state)).toBe('a\r\nb\r\nc\r\n')
 target.dispatch(state.update({changes:{from:state.doc.length,insert:'d\n'}}))
 expect(editorText(state)).toBe('a\r\nb\r\nc\r\nd\r\n')
})

it('el cambio en un documento vacío define el próximo salto, y la lectura bloquea la conversión',()=>{
 const doc=csvTextDocument('')
 let state=EditorState.create({doc:doc.doc,extensions:doc.extensions})
 state=state.update(convertLineEndings(state,'CRLF')!).state
 state=state.update({changes:{from:0,insert:'a\nb'}}).state
 expect(editorText(state)).toBe('a\r\nb')
 expect(convertLineEndings(state,'CRLF')).toBeUndefined()
 const readonly=EditorState.create({doc:doc.doc,extensions:[doc.extensions,EditorState.readOnly.of(true)]})
 expect(convertLineEndings(readonly,'CRLF')).toBeUndefined()
})

it('al recargar un texto CRLF, el siguiente salto usa los finales del archivo recargado',()=>{
 const doc=csvTextDocument('a\nb')
 let state=EditorState.create({doc:doc.doc,extensions:doc.extensions})
 state=state.update(replaceCsvText(state,0,state.doc.length,'a\r\nb')).state
 state=state.update({changes:{from:state.doc.length,insert:'\nc'}}).state
 expect(editorText(state)).toBe('a\r\nb\r\nc')
})
