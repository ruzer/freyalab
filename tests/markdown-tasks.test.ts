import {describe,it,expect} from 'vitest'
import {EditorState,EditorSelection,Transaction} from '@codemirror/state'
import {history,undo,redo,undoDepth,isolateHistory} from '@codemirror/commands'
import {language} from '@codemirror/language'
import {markdown} from '@codemirror/lang-markdown'
import {createMarkdownSession,taskChange,taskTransaction,type TaskReference} from '../src/renderer/lib/markdown-tasks'

function reference(source:string,line=1,marker:TaskReference['marker']='[ ]',occurrence=0):TaskReference{
 const rows=source.split('\n'),expectedLine=rows[line-1].replace(/\r$/,'')
 let column=-1
 for(let index=0;index<=occurrence;index++)column=expectedLine.indexOf(marker,column+1)
 return{line,from:rows.slice(0,line-1).reduce((length,row)=>length+row.length+1,0)+column,expectedLine,marker}
}
function apply(source:string,change:ReturnType<typeof taskChange>){
 return change?source.slice(0,change.from)+change.insert+source.slice(change.to):source
}
function stateOf(source:string,readonly=false,selection=EditorSelection.single(0)){
 return EditorState.create({doc:source,selection,extensions:[history(),EditorState.readOnly.of(readonly),...(source.includes('\r\n')?[EditorState.lineSeparator.of('\r\n')]:[])]})
}
const cases:[string,string,number,TaskReference['marker']][]=[
 ['LF sin marcar','- [ ] pendiente\nDespués',1,'[ ]'],
 ['LF marcada','- [x] lista',1,'[x]'],
 ['mayúscula','- [X] lista',1,'[X]'],
 ['CRLF','Antes\r\n- [ ] pendiente\r\nDespués\r\n',2,'[ ]'],
 ['mixto tras LF','Antes\r\nOtra\n- [ ] pendiente\r\nDespués\n',3,'[ ]'],
 ['mixto tras CRLF','Antes\nOtra\r\n- [x] lista\nDespués\r\n',3,'[x]'],
 ['BOM','\uFEFF- [ ] primera\n',1,'[ ]'],
 ['front matter','---\r\ntitle: Freya\r\n---\r\n\r\n- [ ] pendiente\r\n',5,'[ ]'],
 ['Unicode','😀 café e\u0301\n- [ ] tarea 🐕\n終わり',2,'[ ]'],
 ['anidada','- Padre\n  - [ ] hija',2,'[ ]'],
 ['sangría mixta','- Padre\n \t- [ ] hija',2,'[ ]'],
 ['numerada','1. [ ] primera\n2. [x] segunda',2,'[x]'],
 ['cita','> > - [ ] citada\n',1,'[ ]'],
 ['asterisco','* [ ] tarea',1,'[ ]'],
 ['signo más','+ [ ] tarea',1,'[ ]'],
 ['sin texto','- [ ]',1,'[ ]'],
]
describe('FL-MD-004 · cambio puro de una tarea',()=>{
 it.each(cases)('%s cambia únicamente el marcador completo',(_,source,line,marker)=>{
  const ref=reference(source,line,marker),change=taskChange(source,ref)
  expect(change).toEqual({from:ref.from,to:ref.from+3,insert:marker==='[ ]'?'[x]':'[ ]'})
  const result=apply(source,change)
  expect(result.slice(0,ref.from)).toBe(source.slice(0,ref.from))
  expect(result.slice(ref.from+3)).toBe(source.slice(ref.from+3))
  expect(result.length).toBe(source.length)
  expect(source.slice(ref.from,ref.from+3)).toBe(marker)
 })
 it.each([
  ['línea cero',{line:0}],['línea negativa',{line:-1}],['línea fraccionaria',{line:1.5}],
  ['línea infinita',{line:Infinity}],['línea inexistente',{line:9}],
  ['offset negativo',{from:-1}],['offset fraccionario',{from:2.5}],['offset NaN',{from:NaN}],
  ['offset fuera del texto',{from:500}],['offset desplazado',{from:3}],
  ['línea cambiada',{expectedLine:'- [ ] texto anterior'}],['marcador cambiado',{marker:'[x]'}],
  ['marcador ajeno',{marker:'[y]' as TaskReference['marker']}],
 ] as const)('%s se rechaza sin alterar la fuente',(_,overrides)=>{
  const source='- [ ] actual',ref={...reference(source),...overrides}
  expect(taskChange(source,ref)).toBeUndefined()
 })
 it('un offset de otra línea no señala una tarea idéntica',()=>{
  const source='- [ ] igual\n- [ ] igual',ref=reference(source,2)
  expect(taskChange(source,{...ref,from:2})).toBeUndefined()
  expect(apply(source,taskChange(source,ref))).toBe('- [ ] igual\n- [x] igual')
 })
 it('una tarea editada después del render rechaza la referencia anterior',()=>{
  const original='Antes\n- [ ] pendiente',ref=reference(original,2)
  expect(taskChange('Antes\n- [ ] otro texto',ref)).toBeUndefined()
  expect(taskChange('Nueva\nAntes\n- [ ] pendiente',ref)).toBeUndefined()
 })
 it('el segundo clic sobre el mismo snapshot se rechaza',()=>{
  const source='- [ ] tarea',ref=reference(source),first=apply(source,taskChange(source,ref))
  expect(taskChange(first,ref)).toBeUndefined()
  expect(apply(first,taskChange(first,reference(first,1,'[x]')))).toBe(source)
 })
 it('no muta la referencia y rechaza una fuente vacía',()=>{
  const source='- [ ] tarea',ref=Object.freeze(reference(source)),copy={...ref}
  taskChange(source,ref)
  expect(ref).toEqual(copy)
  expect(taskChange('',ref)).toBeUndefined()
 })
})

describe('FL-MD-004 · transacciones e historial sin EditorView',()=>{
 it.each(cases.filter((_,index)=>[0,3,4,5,6,7,8].includes(index)))('%s conserva RAW exacto al alternar, deshacer y rehacer',(_,source,line,marker)=>{
  let state=stateOf(source,false,EditorSelection.single(1))
  const ref=reference(source,line,marker),before=state,transaction=taskTransaction(state,source,ref)
  expect(transaction).toBeDefined()
  expect(transaction!.annotation(isolateHistory)).toBe('full')
  expect(transaction!.isUserEvent('input.task')).toBe(true)
  const changes:{from:number;to:number;insert:string}[]=[]
  transaction!.changes.iterChanges((from,to,_fromB,_toB,inserted)=>changes.push({from,to,insert:inserted.toString()}))
  const cmFrom=state.toText(source.slice(0,ref.from)).length
  expect(changes).toEqual([{from:cmFrom,to:cmFrom+3,insert:marker==='[ ]'?'[x]':'[ ]'}])
  state=transaction!.state
  expect(state.sliceDoc()).toBe(apply(source,taskChange(source,ref)))
  expect(before.sliceDoc()).toBe(source)
  expect(undoDepth(state)).toBe(1)
  const target={get state(){return state},dispatch:(tr:Transaction)=>{state=tr.state}}
  expect(undo(target)).toBe(true)
  expect(state.sliceDoc()).toBe(source)
  expect(state.selection.eq(before.selection)).toBe(true)
  expect(undo(target)).toBe(false)
  expect(redo(target)).toBe(true)
  expect(state.sliceDoc()).toBe(apply(source,taskChange(source,ref)))
 })
 it('no añade selección explícita y conserva una selección inversa',()=>{
  const source='- [ ] una\n- [ ] otra',state=stateOf(source,false,EditorSelection.single(18,10))
  const transaction=taskTransaction(state,source,reference(source))!
  expect(transaction.selection).toBeUndefined()
  expect(transaction.state.selection.eq(state.selection)).toBe(true)
 })
 it('la fuente y el estado deben coincidir exactamente, incluidos los finales de línea',()=>{
  const source='Antes\r\n- [ ] tarea',ref=reference(source,2)
  expect(taskTransaction(EditorState.create({doc:source,extensions:[history()]}),source,ref)).toBeUndefined()
  expect(taskTransaction(stateOf(source),source.replace('Antes','Otros'),ref)).toBeUndefined()
 })
 it('solo lectura bloquea la transacción y conserva historial vacío',()=>{
  const source='- [ ] tarea',state=stateOf(source,true)
  expect(taskTransaction(state,source,reference(source))).toBeUndefined()
  expect(state.sliceDoc()).toBe(source)
  expect(undoDepth(state)).toBe(0)
 })
 it('una referencia inválida no produce transacción',()=>{
  const source='- [ ] tarea',state=stateOf(source)
  expect(taskTransaction(state,source,{...reference(source),expectedLine:'otra'})).toBeUndefined()
 })
 it('dos acciones son dos pasos y no se agrupan con la escritura anterior',()=>{
  const source='- [ ] tarea'
  let state=stateOf(source).update({changes:{from:source.length,insert:' nueva'},userEvent:'input.type'}).state
  const written=state.sliceDoc()
  state=taskTransaction(state,written,reference(written))!.state
  const checked=state.sliceDoc()
  state=taskTransaction(state,checked,reference(checked,1,'[x]'))!.state
  expect(undoDepth(state)).toBe(3)
  const target={get state(){return state},dispatch:(tr:Transaction)=>{state=tr.state}}
  expect(undo(target)).toBe(true);expect(state.sliceDoc()).toBe(checked)
  expect(undo(target)).toBe(true);expect(state.sliceDoc()).toBe(written)
  expect(undo(target)).toBe(true);expect(state.sliceDoc()).toBe(source)
 })
})

describe('FL-MD-004 · sesiones Markdown sin gramática cuando no hay editor',()=>{
 it.each([
  ['LF','Antes\n- [ ] tarea\n'],
  ['CRLF','Antes\r\n- [ ] tarea\r\n'],
  ['mixto y BOM','\uFEFFAntes\r\nOtra\n- [ ] tarea\r\n'],
 ])('%s inicia con RAW exacto, ui vacío y sin lenguaje',(_,source)=>{
  const session=createMarkdownSession(source)
  expect(session.state.sliceDoc()).toBe(source)
  expect(session.state.facet(language)).toBeNull()
  expect(session.ui.get(session.state)).toEqual([])
  expect(session.state.readOnly).toBe(false)
  expect(undoDepth(session.state)).toBe(0)
 })
 it('montar y desmontar la gramática conserva fuente, selección e historial sin vista',()=>{
  const source='\uFEFFAntes\r\nOtra\n- [ ] tarea\r\n',session=createMarkdownSession(source)
  session.state=session.state.update({selection:EditorSelection.single(7,1),effects:session.ui.reconfigure([markdown()])}).state
  const selection=session.state.selection
  expect(session.state.facet(language)).not.toBeNull()
  session.state=taskTransaction(session.state,source,reference(source,3))!.state
  const checked=session.state.sliceDoc()
  session.state=session.state.update({effects:session.ui.reconfigure([])}).state
  expect(session.state.facet(language)).toBeNull()
  expect(session.state.selection.eq(selection)).toBe(true)
  expect(undoDepth(session.state)).toBe(1)
  const target={get state(){return session.state},dispatch:(transaction:Transaction)=>{session.state=transaction.state}}
  expect(undo(target)).toBe(true)
  expect(session.state.sliceDoc()).toBe(source)
  expect(session.state.selection.eq(selection)).toBe(true)
  expect(redo(target)).toBe(true)
  expect(session.state.sliceDoc()).toBe(checked)
  expect(session.state.facet(language)).toBeNull()
 })
 it('la UI puede bloquear y desbloquear sin un facet de solo lectura permanente',()=>{
  const session=createMarkdownSession('- [ ] tarea')
  session.state=session.state.update({effects:session.ui.reconfigure(EditorState.readOnly.of(true))}).state
  expect(session.state.readOnly).toBe(true)
  session.state=session.state.update({effects:session.ui.reconfigure([])}).state
  expect(session.state.readOnly).toBe(false)
 })
 it('cada documento tiene su propio compartment y su historial independiente',()=>{
  const source='- [ ] tarea',first=createMarkdownSession(source),second=createMarkdownSession(source)
  expect(first.ui).not.toBe(second.ui)
  first.state=taskTransaction(first.state,source,reference(source))!.state
  expect(undoDepth(first.state)).toBe(1)
  expect(undoDepth(second.state)).toBe(0)
  expect(second.state.sliceDoc()).toBe(source)
 })
})
