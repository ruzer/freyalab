import {describe,it,expect} from 'vitest'
import {EditorState,EditorSelection,Transaction} from '@codemirror/state'
import {history,undo,redo,isolateHistory} from '@codemirror/commands'
import {markdownCommands,type MarkdownAction} from '../src/renderer/lib/markdown-commands'
import {markdownFormatChange} from '../src/renderer/lib/markdown-editing'

function stateOf(source:string,mainIndex=0){return EditorState.create({doc:source,selection:EditorSelection.create([EditorSelection.range(0,5),EditorSelection.range(10,15)],mainIndex),extensions:[EditorState.allowMultipleSelections.of(true),history()]})}
describe('ED-01 E4 · formato principal y posiciones secundarias',()=>{
 const cases:[MarkdownAction,string][]=[['bold','**Freya** uno\nFreya dos'],['italic','*Freya* uno\nFreya dos'],['strike','~~Freya~~ uno\nFreya dos'],['inline','`Freya` uno\nFreya dos'],['heading1','# Freya uno\nFreya dos'],['heading2','## Freya uno\nFreya dos'],['heading3','### Freya uno\nFreya dos']]
 it.each(cases)('%s no formatea la secundaria y la conserva tras el cambio', (action,expected)=>{
  const source='Freya uno\nFreya dos';let state=stateOf(source)
  const command=markdownCommands[action](state.doc.toString(),state.selection.main),change=markdownFormatChange(state,command)
  state=state.update({...change,annotations:isolateHistory.of('full'),userEvent:'input'}).state
  expect(state.sliceDoc()).toBe(expected);expect(state.selection.ranges).toHaveLength(2);expect(state.selection.mainIndex).toBe(0)
  expect(state.sliceDoc(state.selection.ranges[1].from,state.selection.ranges[1].to)).toBe('Freya');expect(state.selection.ranges[1].from).toBe(expected.lastIndexOf('Freya'))
  const beforeTyped=state.sliceDoc();state=state.update({...state.replaceSelection('Luna'),annotations:isolateHistory.of('full'),userEvent:'input.type'}).state
  expect(state.sliceDoc()).toBe(expected.replaceAll('Freya','Luna'))
  const dispatch=(transaction:Transaction)=>{state=transaction.state};expect(undo({state,dispatch})).toBe(true);expect(state.sliceDoc()).toBe(beforeTyped)
  expect(undo({state,dispatch})).toBe(true);expect(state.sliceDoc()).toBe(source);expect(state.selection.ranges).toHaveLength(2)
  expect(redo({state,dispatch})).toBe(true);expect(state.sliceDoc()).toBe(expected)
 })
 it('la principal puede estar después de la secundaria y conserva su identidad',()=>{
  const state=stateOf('Freya uno\nFreya dos',1),result=state.update(markdownFormatChange(state,markdownCommands.bold(state.doc.toString(),state.selection.main))).state
  expect(result.sliceDoc()).toBe('Freya uno\n**Freya** dos');expect(result.selection.mainIndex).toBe(1);expect(result.selection.ranges).toHaveLength(2)
  expect(result.sliceDoc(result.selection.ranges[0].from,result.selection.ranges[0].to)).toBe('Freya')
 })
 it('los cursores vacíos conservan Unicode completo y los marcadores sólo se insertan en el principal',()=>{
  const source='🐾uno\n🐾dos',state=EditorState.create({doc:source,selection:EditorSelection.create([EditorSelection.cursor(2),EditorSelection.cursor(8)],0),extensions:[EditorState.allowMultipleSelections.of(true)]}),result=state.update(markdownFormatChange(state,markdownCommands.bold(state.doc.toString(),state.selection.main))).state
  expect(result.doc.toString()).toBe('🐾****uno\n🐾dos');expect(result.selection.ranges).toHaveLength(2);expect(result.selection.main.head).toBe(4);expect(result.selection.ranges[1].head).toBe(12)
 })
 it('CRLF mantiene posiciones CodeMirror y finales de línea originales',()=>{
  const source='Freya uno\r\nFreya dos',state=EditorState.create({doc:source,selection:EditorSelection.create([EditorSelection.range(0,5),EditorSelection.range(10,15)],1),extensions:[EditorState.allowMultipleSelections.of(true),EditorState.lineSeparator.of('\r\n')]}),result=state.update(markdownFormatChange(state,markdownCommands.strike(state.doc.toString(),state.selection.main))).state
  expect(result.sliceDoc()).toBe('Freya uno\r\n~~Freya~~ dos');expect(result.selection.ranges).toHaveLength(2);expect(result.selection.mainIndex).toBe(1)
 })
 it('un comando sin cambios conserva todas las selecciones',()=>{
  const state=stateOf('Freya uno\nFreya dos'),result=state.update(markdownFormatChange(state,{changes:[],selection:state.selection.main})).state
  expect(result.doc).toBe(state.doc);expect(result.selection.toJSON()).toEqual(state.selection.toJSON())
 })
 it('aplicar y quitar vuelve al documento y posiciones iniciales',()=>{
  const source='Freya uno\nFreya dos';let state=stateOf(source);const before=state.selection.toJSON()
  state=state.update(markdownFormatChange(state,markdownCommands.bold(state.doc.toString(),state.selection.main))).state
  state=state.update(markdownFormatChange(state,markdownCommands.bold(state.doc.toString(),state.selection.main))).state
  expect(state.doc.toString()).toBe(source);expect(state.selection.toJSON()).toEqual(before)
 })
 it('conserva la dirección de selecciones invertidas',()=>{
  const source='Freya uno\nFreya dos',state=EditorState.create({doc:source,selection:EditorSelection.create([EditorSelection.range(5,0),EditorSelection.range(15,10)]),extensions:[EditorState.allowMultipleSelections.of(true)]}),result=state.update(markdownFormatChange(state,markdownCommands.bold(state.doc.toString(),state.selection.main))).state
  expect(result.doc.toString()).toBe('**Freya** uno\nFreya dos');expect(result.selection.ranges.every(range=>range.anchor>range.head)).toBe(true)
 })
 it('un bloque multilínea mantiene el modelo de líneas CRLF y la secundaria',()=>{
  const source='Freya uno\r\nFreya dos',state=EditorState.create({doc:source,selection:EditorSelection.create([EditorSelection.range(0,5),EditorSelection.range(10,15)]),extensions:[EditorState.allowMultipleSelections.of(true),EditorState.lineSeparator.of('\r\n')]}),result=state.update(markdownFormatChange(state,markdownCommands.code(state.doc.toString(),state.selection.main))).state
  expect(result.doc.lines).toBeGreaterThan(2);expect(result.sliceDoc().replaceAll('\r\n','')).not.toContain('\n');expect(result.selection.ranges).toHaveLength(2);expect(result.sliceDoc(result.selection.ranges[1].from,result.selection.ranges[1].to)).toBe('Freya')
 })
})
