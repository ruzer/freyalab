import {createHash} from 'node:crypto'
import {t} from '../shared/i18n'
import {statisticsResultSchema,statisticsResultTooLarge,statisticsResultWithinBudget,serializeStatisticsResult} from '../shared/statistics-result'
import type {Documents} from './documents'
import {query} from './query-schema'
import {exportResult} from './export'

const requestSchema=statisticsResultSchema(query)
export async function exportStatisticsResult(docs:Documents,id:string,input:unknown):Promise<string|null>{
 if(!statisticsResultWithinBudget(input))throw new Error(t('statistics.export.error.tooLarge'))
 const parsed=requestSchema.safeParse(input)
 if(!parsed.success)throw new Error(t(statisticsResultTooLarge(parsed.error)?'statistics.export.error.tooLarge':'statistics.export.error.invalid'))
 const request=parsed.data,record=docs.requireTable(id),path=record.info.path,headers=[...record.info.headers??[]]
 const assertCurrent=()=>{
  const current=docs.requireTable(id)
  if(current!==record||current.info.revision!==request.revision||current.info.path!==path||current.info.headers?.length!==headers.length||headers.some((header,index)=>current.info.headers?.[index]!==header))throw new Error(t('statistics.export.error.changed'))
 }
 assertCurrent()
 const output=serializeStatisticsResult(request,{name:record.info.name,revision:record.info.revision,dirty:record.info.dirty,exportedAt:new Date().toISOString(),...record.info.analysisSubset?{analysisSubset:structuredClone(record.info.analysisSubset)}:{}},text=>createHash('sha256').update(text).digest('hex'))
 return exportResult(docs,id,{format:request.format,...output},async()=>{
  assertCurrent();await docs.verifyProjectSource(id);assertCurrent()
 })
}
