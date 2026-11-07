import {describe,expect,it} from 'vitest'
import {EditorSelection,EditorState,Compartment,type Transaction} from '@codemirror/state'
import {indentMore,toggleComment,undo} from '@codemirror/commands'
import {getIndentUnit} from '@codemirror/language'
import {selectNextOccurrence,selectSelectionMatches} from '@codemirror/search'
import {insertBracket} from '@codemirror/autocomplete'
import {keymap} from '@codemirror/view'
import {editorEditingExtensions,editorIndentation} from '../src/renderer/lib/editor-editing'
import {csvTextDocument,csvTextValue} from '../src/renderer/lib/csv-text-model'
import {createMarkdownSession} from '../src/renderer/lib/markdown-tasks'

const formats=[
 {kind:'markdown',source:'uno\r\nuno\r\nuno',comment:'<!-- uno -->\r\nuno\r\nuno'},
 {kind:'text',source:'uno\r\nuno\r\nuno'},
 {kind:'mermaid',source:'uno\r\nuno\r\nuno',comment:'%% uno\r\nuno\r\nuno'},
 {kind:'csv-text',source:'uno\r\nuno\runo'}
] as const

describe.each(formats)('$kind',format=>{
 const {kind,source}=format
 const csv=kind==='csv-text'?csvTextDocument(source):undefined
 const value=(state:EditorState)=>csv?csvTextValue(state):state.sliceDoc()
 const make=(readonly=false)=>EditorState.create({doc:csv?.doc??source,extensions:[...(csv?.extensions??[]),editorEditingExtensions(kind,source),editorIndentation({tabIndents:false,indent:2}),EditorState.readOnly.of(readonly)]})
 it('permite extender y editar una selección múltiple conservando los saltos de línea',()=>{
  let state=make().update({selection:EditorSelection.range(0,3)}).state
  const dispatch=(transaction:Transaction)=>{state=transaction.state}
  expect(selectNextOccurrence({state,dispatch})).toBe(true)
  expect(state.selection.ranges.map(range=>range.from)).toEqual([0,4])
  state=state.update({selection:EditorSelection.range(0,3)}).state
  expect(selectSelectionMatches({state,dispatch})).toBe(true)
  expect(state.selection.ranges.map(range=>range.from)).toEqual([0,4,8])
  state=state.update(state.replaceSelection('🐾')).state
  expect(value(state)).toBe(source.replaceAll('uno','🐾'))
 })
 it('cierra el par y al teclear su cierre avanza sin duplicarlo',()=>{
  const state=make().update({selection:{anchor:3}}).state
  const paired=insertBracket(state,'(')?.state
  expect(paired&&value(paired)).toBe('uno()'+source.slice(3))
  expect(paired?.selection.main.head).toBe(4)
  const closed=paired&&insertBracket(paired,')')?.state
  expect(closed&&value(closed)).toBe('uno()'+source.slice(3))
  expect(closed?.selection.main.head).toBe(5)
 })
 it('alterna el comentario propio del formato y no edita una muestra de solo lectura',()=>{
  let state=make()
  const dispatch=(transaction:Transaction)=>{state=transaction.state}
  const comment='comment' in format?format.comment:undefined
  expect(toggleComment({state,dispatch})).toBe(!!comment)
  expect(value(state)).toBe(comment??source)
  if(comment){expect(toggleComment({state,dispatch})).toBe(true);expect(value(state)).toBe(source)}
  expect(toggleComment({state:make(true),dispatch})).toBe(false)
  expect(indentMore({state:make(true),dispatch})).toBe(false)
  expect(value(state)).toBe(source)
 })
})

it.each([[2,'  '],[4,'    '],['tab','\t']] as const)('sangría %s se aplica sin capturar Shift+Tab', (size,spaces)=>{
 const initial=EditorState.create({doc:'uno',extensions:[editorIndentation({tabIndents:true,indent:size})]})
 const tab=initial.facet(keymap).flat().find(binding=>binding.key==='Tab')
 expect(tab?.run).toBeDefined()
 expect(tab?.shift).toBeUndefined()
 expect(initial.facet(keymap).flat().some(binding=>binding.key==='Shift-Tab')).toBe(false)
 expect(getIndentUnit(initial)).toBe(size==='tab'?4:size)
 let state=initial
 expect(indentMore({state,dispatch:tr=>{state=tr.state}})).toBe(true)
 expect(state.sliceDoc()).toBe(spaces+'uno')
 expect(EditorState.create({extensions:[editorIndentation({tabIndents:false,indent:size})]}).facet(keymap).flat()).toEqual([])
})

it('cambiar la sangría conserva las selecciones, CRLF y el historial de la sesión Markdown',()=>{
 const session=createMarkdownSession('uno\r\ndos'),indentation=new Compartment()
 let state=session.state.update({effects:session.ui.reconfigure([editorEditingExtensions('markdown','uno\r\ndos',true),indentation.of(editorIndentation({tabIndents:false,indent:2}))])}).state
 state=state.update({selection:EditorSelection.create([EditorSelection.cursor(3),EditorSelection.cursor(7)])}).state
 state=state.update(state.replaceSelection('!'),{userEvent:'input.type'}).state
 const selection=state.selection
 state=state.update({effects:indentation.reconfigure(editorIndentation({tabIndents:true,indent:4}))}).state
 expect(state.selection.eq(selection)).toBe(true)
 expect(state.sliceDoc()).toBe('uno!\r\ndos!')
 expect(undo({state,dispatch:tr=>{state=tr.state}})).toBe(true)
 expect(state.sliceDoc()).toBe('uno\r\ndos')
})
