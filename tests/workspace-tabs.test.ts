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
 it('al cerrar un documento desaparece solo su análisis y una sesión nueva solo tiene documentos',()=>{
  const first=openAnalysisTab([],{documentId:'one'},'info')
  const second=openAnalysisTab(first.tabs,{documentId:'two'},'statistics')
  expect(closeDocumentAnalysis(second.tabs,'one')).toEqual([second.tab])
  expect(workspaceTabs([{id:'two'}],[])).toEqual([{type:'document',id:'two'}])
 })
})
