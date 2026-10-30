import {describe,it,expect} from 'vitest'
import {EditorState} from '@codemirror/state'
import {history,undoDepth} from '@codemirror/commands'
import {markdown} from '@codemirror/lang-markdown'
import {ensureSyntaxTree,syntaxTreeAvailable,syntaxTree,foldable,foldEffect,unfoldEffect,foldedRanges} from '@codemirror/language'
import {markdownEditingExtensions} from '../src/renderer/lib/markdown-editing'

function parsedState(state:EditorState){
 expect(ensureSyntaxTree(state,state.doc.length,1000)).not.toBeNull()
 expect(syntaxTreeAvailable(state,state.doc.length)).toBe(true)
 // ensureSyntaxTree completa el contexto; una transacción pública publica su snapshot.
 const transaction=state.update({}),parsed=transaction.state
 expect(transaction.docChanged).toBe(false);expect(parsed.doc.toString()).toBe(state.doc.toString())
 expect(undoDepth(parsed)).toBe(undoDepth(state));expect(syntaxTree(parsed).length).toBe(parsed.doc.length)
 return parsed
}

describe('ED-01 E2/E7 · plegado nativo de secciones',()=>{
 for(const separator of ['\n','\r\n'])it(`el rango completo termina antes del siguiente encabezado del mismo nivel (${JSON.stringify(separator)})`,()=>{
  const source=['# Uno','','## Hija','','Cuerpo','','# Dos','','Final'].join(separator),state=parsedState(EditorState.create({doc:source,extensions:[markdown({pasteURLAsLink:false}),markdownEditingExtensions,...(separator==='\r\n'?[EditorState.lineSeparator.of(separator)]:[])]}))
  expect(foldable(state,0,state.doc.line(1).to)).toEqual({from:state.doc.line(1).to,to:state.doc.toString().indexOf('\n\n# Dos')})
  expect(state.sliceDoc()).toBe(source)
 })
 it.each([
  ['código cercado','# Real\n\n```md\n# Falso\n```\n\n# Fin','Falso'],
  ['HTML details','# Real\n\n<details>\n# Falso\n</details>\n\n# Fin','Falso'],
 ])('%s no convierte un encabezado aparente en otra sección',(_name,source,label)=>{
  const state=parsedState(EditorState.create({doc:source,extensions:[markdown({pasteURLAsLink:false}),markdownEditingExtensions]}))
  const line=state.doc.lineAt(source.indexOf(label));expect(foldable(state,line.from,line.to)).toBeNull()
 })
 for(const readonly of [false,true])it(`plegar/desplegar no cambia documento ni historial (readonly=${readonly})`,()=>{
  const source='# Uno\n\nCuerpo\n\n# Dos\n\nFinal';let state=parsedState(EditorState.create({doc:source,extensions:[history(),markdown({pasteURLAsLink:false}),markdownEditingExtensions,EditorState.readOnly.of(readonly)]}))
  const range=foldable(state,0,state.doc.line(1).to);expect(range).not.toBeNull()
  const fold=state.update({effects:foldEffect.of(range!)});state=fold.state;expect(foldedRanges(state).size).toBe(1);expect(state.doc.toString()).toBe(source);expect(undoDepth(state)).toBe(0);expect(fold.docChanged).toBe(false)
  const unfold=state.update({effects:unfoldEffect.of(range!)});state=unfold.state;expect(foldedRanges(state).size).toBe(0);expect(state.doc.toString()).toBe(source);expect(undoDepth(state)).toBe(0);expect(unfold.docChanged).toBe(false)
 })
 it('publica el árbol completado después de una construcción incremental sin cambiar texto ni historial',()=>{
  const source=['# Uno','','## Hija','','Cuerpo','','# Dos','','Final'].join('\n')
  let released=false,advances=0
  const language=markdown({pasteURLAsLink:false,extensions:[{wrap:inner=>({
   get parsedPos(){return inner.parsedPos},get stoppedAt(){return inner.stoppedAt},
   stopAt(position:number){inner.stopAt(position)},
   advance(){if(++advances>1000)throw new Error('El fixture incremental no progresó.');return released||inner.stoppedAt!=null?inner.advance():null}
  })}]})
  const originalNow=Date.now;let tick=0,initial:EditorState
  try{
   // Sólo fuerza el corte incremental del constructor síncrono; no mide velocidad.
   Date.now=()=>tick+=100
   initial=EditorState.create({doc:source,extensions:[language,markdownEditingExtensions,history()]})
  }finally{Date.now=originalNow}
  expect(Date.now).toBe(originalNow);expect(syntaxTree(initial).length).toBeLessThan(initial.doc.length)
  released=true
  const state=parsedState(initial)
  expect(foldable(state,0,state.doc.line(1).to)).toEqual({from:5,to:22})
  expect(syntaxTree(state).length).toBe(state.doc.length)
  expect(state.doc.toString()).toBe(source);expect(undoDepth(state)).toBe(0)
 })
})
