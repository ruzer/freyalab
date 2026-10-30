import {describe,it,expect} from 'vitest'
import {EditorState,EditorSelection,Transaction,type TransactionSpec} from '@codemirror/state'
import {keymap,type EditorView} from '@codemirror/view'
import {undo,redo,isolateHistory} from '@codemirror/commands'
import {selectNextOccurrence} from '@codemirror/search'
import {markdown} from '@codemirror/lang-markdown'
import {ensureSyntaxTree} from '@codemirror/language'
import {createMarkdownSession} from '../src/renderer/lib/markdown-tasks'
import {markdownEditingExtensions} from '../src/renderer/lib/markdown-editing'

describe('ED-01 E1/E4 · sesión Markdown persistente',()=>{
 it('permite más de una selección fuera del compartimento de interfaz',()=>{
  const session=createMarkdownSession('uno\ndos')
  expect(session.state.facet(EditorState.allowMultipleSelections)).toBe(true)
 })
 for(const separator of ['\n','\r\n'])it(`edita tres cursores y deshace/repite en un paso (${JSON.stringify(separator)})`,()=>{
  const source=['Freya','café 🐾','Fin'].join(separator),session=createMarkdownSession(source),dispatch=(transaction:Transaction)=>{session.state=transaction.state}
  const cursors=[1,2,3].map(line=>EditorSelection.cursor(session.state.doc.line(line).to))
  dispatch(session.state.update({selection:EditorSelection.create(cursors,1),annotations:Transaction.addToHistory.of(false)}))
  expect(session.state.selection.ranges).toHaveLength(3)
  dispatch(session.state.update({...session.state.replaceSelection('🐕'),annotations:isolateHistory.of('full'),userEvent:'input.type'}))
  expect(session.state.sliceDoc()).toBe(['Freya🐕','café 🐾🐕','Fin🐕'].join(separator))
  expect(undo({state:session.state,dispatch})).toBe(true);expect(session.state.sliceDoc()).toBe(source);expect(session.state.selection.ranges).toHaveLength(3)
  expect(redo({state:session.state,dispatch})).toBe(true);expect(session.state.sliceDoc()).toBe(['Freya🐕','café 🐾🐕','Fin🐕'].join(separator))
 })
 it('Mod+D usa el comando instalado y añade la coincidencia siguiente sin alterar el documento',()=>{
  const source='Freya uno\nFreya dos\nFreya tres',session=createMarkdownSession(source),dispatch=(transaction:Transaction)=>{session.state=transaction.state}
  expect(selectNextOccurrence({state:session.state,dispatch})).toBe(true)
  expect(selectNextOccurrence({state:session.state,dispatch})).toBe(true)
  expect(session.state.selection.ranges.map(range=>session.state.sliceDoc(range.from,range.to))).toEqual(['Freya','Freya'])
  expect(session.state.sliceDoc()).toBe(source)
 })
 it('reconfigurar la interfaz, ir a vista previa y volver conserva principal y secundarias',()=>{
  const session=createMarkdownSession('uno\ndos'),dispatch=(transaction:Transaction)=>{session.state=transaction.state}
  dispatch(session.state.update({selection:EditorSelection.create([EditorSelection.cursor(1),EditorSelection.cursor(5)],1)}))
  const before=session.state.selection.toJSON()
  dispatch(session.state.update({effects:session.ui.reconfigure([])}))
  dispatch(session.state.update({effects:session.ui.reconfigure([EditorState.phrases.of({Find:'Buscar'})])}))
  expect(session.state.selection.toJSON()).toEqual(before);expect(session.state.facet(EditorState.allowMultipleSelections)).toBe(true)
 })
})

describe('ED-01 E3 · comandos instalados con la configuración del editor',()=>{
 function command(state:EditorState,key:string){const binding=state.facet(keymap).flat().find(binding=>binding.key===key);expect(binding?.run).toBeDefined();let result=state;const view={get state(){return result},dispatch(value:Transaction|TransactionSpec){result=value instanceof Transaction?value.state:result.update(value).state}} as unknown as EditorView;return{handled:binding!.run!(view),state:result}}
 function configured(source:string,readonly=false){return EditorState.create({doc:source,selection:{anchor:source.length},extensions:[markdown({pasteURLAsLink:false,addKeymap:false}),markdownEditingExtensions,EditorState.readOnly.of(readonly)]})}
 const cases=[
  ['viñeta','- Uno','- Uno\n- '],['numerada','1. Uno','1. Uno\n2. '],['tarea marcada','- [x] Hecho','- [x] Hecho\n- [ ] '],['cita','> Cita','> Cita\n> '],
  ['viñeta vacía','- ',''],['tarea vacía','- [ ] ',''],['segundo elemento vacío','- Uno\n- ','- Uno\n'],
  ['lista no compacta','- Uno\n\n- Dos','- Uno\n\n- Dos\n\n- '],['tarea no compacta','- [ ] Uno\n\n- [ ] Dos','- [ ] Uno\n\n- [ ] Dos\n\n- [ ] '],['viñeta citada','> - Uno','> - Uno\n> - '],
 ] as const
 it.each(cases)('%s continúa o sale con Intro sin un motor propio',(_name,source,expected)=>{
  const state=configured(source)
  expect(ensureSyntaxTree(state,state.doc.length,1000)).not.toBeNull()
  const result=command(state,'Enter');expect(result.handled).toBe(true);expect(result.state.sliceDoc()).toBe(expected)
 })
 it('Retroceso elimina el marcador vacío con el comando instalado',()=>{
  const state=configured('- ')
  expect(ensureSyntaxTree(state,state.doc.length,1000)).not.toBeNull()
  const result=command(state,'Backspace');expect(result.handled).toBe(true);expect(result.state.sliceDoc()).toBe('')
 })
 it('Intro dentro del código cercado queda para el keymap general',()=>{
  const source='```text\n- Uno\n```',state=configured(source).update({selection:{anchor:source.indexOf('Uno')+3}}).state
  expect(ensureSyntaxTree(state,state.doc.length,1000)).not.toBeNull();const result=command(state,'Enter');expect(result.handled).toBe(false);expect(result.state.sliceDoc()).toBe(source)
 })
 for(const key of ['Enter','Backspace'])it(`${key} conserva la fuente de sólo lectura`,()=>{const state=configured('- ',true);expect(ensureSyntaxTree(state,state.doc.length,1000)).not.toBeNull();const result=command(state,key);expect(result.handled).toBe(false);expect(result.state).toBe(state)})
 it('registra una sola lista Markdown con Enter/Retroceso',()=>{const bindings=configured('- Uno').facet(keymap).flat();expect(bindings.filter(binding=>binding.key==='Enter')).toHaveLength(1);expect(bindings.filter(binding=>binding.key==='Backspace')).toHaveLength(1)})
})
