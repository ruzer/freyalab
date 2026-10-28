import {describe,it,expect} from 'vitest'
import {EditorState,Transaction} from '@codemirror/state'
import {history,undoDepth} from '@codemirror/commands'
import {diagramMarks,setDiagramMarks} from '../src/renderer/lib/diagram-marks'
const error={kind:'sintaxis' as const,title:'Falta cerrar un corchete.',hint:'Revisa el cierre.',line:2,detail:'Parse error on line 2'}
const initial=()=>EditorState.create({doc:'flowchart LR\n A[Inicio\n B[Fin]',extensions:[history(),diagramMarks]})
describe('FL-MER-007 · marcas como proyección sin cambios de texto ni historial',()=>{
 it('marca solo líneas existentes y conserva la fuente',()=>{
  const state=initial(),source=state.sliceDoc(),next=state.update({effects:setDiagramMarks.of({source,generation:1,marks:[{line:2,error},{line:99,error},{line:0,error},{line:1.5,error}]}),annotations:Transaction.addToHistory.of(false)}).state
  expect(next.field(diagramMarks).marks.map(mark=>mark.line)).toEqual([2]);expect(next.sliceDoc()).toBe(source);expect(undoDepth(next)).toBe(0)
 })
 it('descarta un resultado de otra fuente',()=>{
  const state=initial(),next=state.update({effects:setDiagramMarks.of({source:'otro',generation:1,marks:[{line:2,error}]})}).state
  expect(next.field(diagramMarks).marks).toEqual([])
 })
 it('un resultado antiguo no reemplaza uno reciente',()=>{
  let state=initial();const source=state.sliceDoc()
  state=state.update({effects:setDiagramMarks.of({source,generation:3,marks:[{line:2,error}]})}).state
  state=state.update({effects:setDiagramMarks.of({source,generation:2,marks:[]})}).state
  expect(state.field(diagramMarks).marks.map(mark=>mark.line)).toEqual([2])
 })
 it('editar borra de inmediato las marcas y no las desplaza a otra línea',()=>{
  let state=initial();state=state.update({effects:setDiagramMarks.of({source:state.sliceDoc(),generation:1,marks:[{line:2,error}]})}).state
  state=state.update({changes:{from:0,to:state.doc.length,insert:'flowchart LR'}}).state
  expect(state.field(diagramMarks).marks).toEqual([]);expect(undoDepth(state)).toBe(1)
 })
 it('cursor y selección no recrean las decoraciones',()=>{
  let state=initial();state=state.update({effects:setDiagramMarks.of({source:state.sliceDoc(),generation:1,marks:[{line:2,error}]})}).state
  const field=state.field(diagramMarks);state=state.update({selection:{anchor:5}}).state
  expect(state.field(diagramMarks)).toBe(field)
 })
})
