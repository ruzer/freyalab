import {expect,it} from 'vitest'
import {csvAnalysisViews,emptyCsvAnalysisView} from '../src/renderer/lib/csv-analysis-view'
import type {DocumentInfo} from '../src/shared/types'

it('mantiene la consulta y la selección separadas por CSV hasta que se cierre el documento',()=>{
 const a={id:'one',revision:3,readonly:false} as DocumentInfo
 const b={id:'two',revision:5,readonly:true} as DocumentInfo
 const initial=emptyCsvAnalysisView(a),second=emptyCsvAnalysisView(b)
 const query={...initial.query,search:'muestra',requestId:4}
 const first={...initial,query,queryValid:true,columns:[1],range:{top:0,bottom:2,left:1,right:1,query,revision:3}}
 try{
  csvAnalysisViews.set(a.id,first)
  csvAnalysisViews.set(b.id,second)
  expect(csvAnalysisViews.get(a.id)).toEqual(first)
  expect(csvAnalysisViews.get(b.id)?.viewMeta).toMatchObject({revision:5,sample:true,requestId:0})
  csvAnalysisViews.delete(a.id)
  expect(csvAnalysisViews.get(a.id)).toBeUndefined()
  expect(csvAnalysisViews.get(b.id)).toEqual(second)
 }finally{csvAnalysisViews.clear()}
})
