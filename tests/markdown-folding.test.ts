import {describe,it,expect} from 'vitest'
import {EditorState} from '@codemirror/state'
import {history,undoDepth} from '@codemirror/commands'
import {markdown} from '@codemirror/lang-markdown'
import {ensureSyntaxTree,syntaxTreeAvailable,foldable,foldEffect,unfoldEffect,foldedRanges} from '@codemirror/language'
import {markdownEditingExtensions} from '../src/renderer/lib/markdown-editing'

describe('ED-01 E2/E7 · plegado nativo de secciones',()=>{
 for(const separator of ['\n','\r\n'])it(`el rango completo termina antes del siguiente encabezado del mismo nivel (${JSON.stringify(separator)})`,()=>{
  const source=['# Uno','','## Hija','','Cuerpo','','# Dos','','Final'].join(separator),state=EditorState.create({doc:source,extensions:[markdown({pasteURLAsLink:false}),markdownEditingExtensions,...(separator==='\r\n'?[EditorState.lineSeparator.of(separator)]:[])]})
  expect(ensureSyntaxTree(state,state.doc.length,1000)).not.toBeNull();expect(syntaxTreeAvailable(state,state.doc.length)).toBe(true)
  expect(foldable(state,0,state.doc.line(1).to)).toEqual({from:state.doc.line(1).to,to:state.doc.toString().indexOf('\n\n# Dos')})
  expect(state.sliceDoc()).toBe(source)
 })
 it.each([
  ['código cercado','# Real\n\n```md\n# Falso\n```\n\n# Fin','Falso'],
  ['HTML details','# Real\n\n<details>\n# Falso\n</details>\n\n# Fin','Falso'],
 ])('%s no convierte un encabezado aparente en otra sección',(_name,source,label)=>{
  const state=EditorState.create({doc:source,extensions:[markdown({pasteURLAsLink:false}),markdownEditingExtensions]});expect(ensureSyntaxTree(state,state.doc.length,1000)).not.toBeNull()
  const line=state.doc.lineAt(source.indexOf(label));expect(foldable(state,line.from,line.to)).toBeNull()
 })
 for(const readonly of [false,true])it(`plegar/desplegar no cambia documento ni historial (readonly=${readonly})`,()=>{
  const source='# Uno\n\nCuerpo\n\n# Dos\n\nFinal';let state=EditorState.create({doc:source,extensions:[history(),markdown({pasteURLAsLink:false}),markdownEditingExtensions,EditorState.readOnly.of(readonly)]})
  expect(ensureSyntaxTree(state,state.doc.length,1000)).not.toBeNull()
  const range=foldable(state,0,state.doc.line(1).to);expect(range).not.toBeNull()
  const fold=state.update({effects:foldEffect.of(range!)});state=fold.state;expect(foldedRanges(state).size).toBe(1);expect(state.doc.toString()).toBe(source);expect(undoDepth(state)).toBe(0);expect(fold.docChanged).toBe(false)
  const unfold=state.update({effects:unfoldEffect.of(range!)});state=unfold.state;expect(foldedRanges(state).size).toBe(0);expect(state.doc.toString()).toBe(source);expect(undoDepth(state)).toBe(0);expect(unfold.docChanged).toBe(false)
 })
})
