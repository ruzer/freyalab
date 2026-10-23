import type {Documents} from './documents'
import type {SqlService} from './sql-service'
import type {ChartResultRequest} from '../shared/types'
import {chartSQL,chartData} from '../shared/charts'
import {matchingChartHeaders} from '../shared/chart-presets'
import {chartResult,chartResultLimit} from './chart-result'
import {validateChartConfiguration} from './chart-presets'
import {exportResult} from './export'
export async function exportChartResult(docs:Documents,analytics:SqlService,id:string,request:ChartResultRequest){
 const record=docs.get(id),config=request.configuration
 if(record.info.kind!=='csv'||record.info.revision!==request.revision||!matchingChartHeaders(config.headers,record.info.headers??[]))throw new Error('La fuente cambió. Genera de nuevo el gráfico antes de exportar.')
 validateChartConfiguration(config)
 const dirty=record.info.dirty,sql=chartSQL(config.headers,config.options,chartResultLimit)
 try{
  const first=await analytics.run({requestId:request.requestId,sources:[{id,revision:request.revision,...config.view?{query:{...config.view,offset:0,limit:1000,requestId:0}}:{},...config.where.conditions.length?{where:config.where}:{}}],sql},'export'),rows=[...first.rows]
  for(let offset=100;offset<first.returnedRows;offset+=100)rows.push(...(await analytics.page(request.requestId,offset)).rows)
  const data=chartData(config.options.kind,first.columns.map(column=>column.name),rows,chartResultLimit),output=chartResult(request,first,data,dirty)
  return await exportResult(docs,id,{format:request.format,...output},async()=>{await analytics.page(request.requestId,0)})
 }finally{analytics.cancel(request.requestId)}
}
