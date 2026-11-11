import {describe,expect,it} from 'vitest'
import {closeDocumentAnalysis,openAnalysisTab,workspaceTabs} from '../src/renderer/lib/workspace-tabs'

describe('pestañas de análisis',()=>{
 it('se abren a la derecha del documento y se reutilizan por origen',()=>{
  const first=openAnalysisTab([],{documentId:'one'},'info')
  const again=openAnalysisTab(first.tabs,{documentId:'one'},'charts')
  const second=openAnalysisTab(again.tabs,{documentId:'two'},'sql')
  expect(again.tab.id).toBe(first.tab.id)
  expect(workspaceTabs([{id:'one'},{id:'two'}],second.tabs)).toEqual([
   {type:'document',id:'one'},again.tab,{type:'document',id:'two'},second.tab,
  ])
  expect(again.tab.section).toBe('charts')
 })
 it('un acceso de estadísticas conserva el alcance pedido y no lo lleva a otra sección',()=>{
  const first=openAnalysisTab([],{documentId:'one'},'statistics',{scope:'range'})
  expect(first.tab.statistics).toEqual({scope:'range'})
  const column=openAnalysisTab(first.tabs,{documentId:'one'},'statistics',{scope:'selected'})
  expect(column.tabs).toHaveLength(1)
  expect(column.tab.statistics).toEqual({scope:'selected'})
  expect(openAnalysisTab(column.tabs,{documentId:'one'},'sql').tab.statistics).toBeUndefined()
 })
 it('al cerrar un documento desaparece solo su análisis y una sesión nueva solo tiene documentos',()=>{
  const first=openAnalysisTab([],{documentId:'one'},'info')
  const second=openAnalysisTab(first.tabs,{documentId:'two'},'statistics')
  expect(closeDocumentAnalysis(second.tabs,'one')).toEqual([second.tab])
  expect(workspaceTabs([{id:'two'}],[])).toEqual([{type:'document',id:'two'}])
 })
})
