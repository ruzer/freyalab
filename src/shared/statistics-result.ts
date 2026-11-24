import {z} from 'zod'
import {stringify} from 'csv-stringify/sync'
import {t} from './i18n'
import type {TableQuery} from './types'
import type {RecipeAnalysisContext} from './recipe-operation'

export const statisticsResultLimits={rows:1000,columns:201,fieldBytes:1024*1024,fileBytes:20*1024*1024} as const
export type StatisticsResultKind='describe'|'statistics'|'profile'|'frequencies'|'distribution'|'correlation'
export interface StatisticsResultRequest {
 revision:number
 format:'csv'|'json'
 protectFormulas:boolean
 table:{columns:string[];rows:(string|number|null)[][]}
 context:{kind:StatisticsResultKind;scope:string;sample:boolean;analyzedAt:string;query?:TableQuery;partial?:boolean}
}
export interface StatisticsResultSource {name:string;revision:number;dirty:boolean;exportedAt:string;analysisSubset?:RecipeAnalysisContext}

const encoder=new TextEncoder(),sizeIssue='statistics-result-size-limit'
const field=z.string().max(statisticsResultLimits.fieldBytes).refine(value=>encoder.encode(value).byteLength<=statisticsResultLimits.fieldBytes)
const cell=z.union([field,z.number().finite(),z.null()])

// Count the bounded snapshot before constructing JSON/CSV. Stop immediately at
// the budget; in particular, never stringify a large request just to measure it.
export function statisticsResultWithinBudget(value:unknown):boolean {
 let remaining:number=statisticsResultLimits.fileBytes
 const ancestors=new WeakSet<object>()
 const visit=(item:unknown,depth=0):boolean=>{
  if(remaining<0||depth>16)return false
  if(typeof item==='string'){
   // UTF-16 length is only a lower bound for UTF-8 bytes. Reject an obviously
   // oversized field before allocating its encoded copy, then check real bytes.
   if(item.length>statisticsResultLimits.fieldBytes||item.length+2>remaining)return false
   remaining-=encoder.encode(item).byteLength+2
  }
  else if(typeof item==='number')remaining-=String(item).length
  else if(item===null)remaining-=4
  else if(typeof item==='boolean')remaining-=item?4:5
  else if(Array.isArray(item)){
   if(ancestors.has(item))return false
   ancestors.add(item)
   remaining-=2
   for(const entry of item){if(remaining<0||!visit(entry,depth+1))return false;remaining--}
   ancestors.delete(item)
  }else if(item&&typeof item==='object'){
   if(ancestors.has(item))return false
   ancestors.add(item)
   remaining-=2
   for(const key in item)if(Object.hasOwn(item,key)){
    if(!visit(key,depth+1)||!visit(Reflect.get(item,key),depth+1))return false
    remaining-=2
   }
   ancestors.delete(item)
  }
  return remaining>=0
 }
 return visit(value)
}

// Main supplies its existing table-query schema. No shared -> main import or
// unchecked query cast is needed, and this never accepts paths or file content.
export function statisticsResultSchema(query:z.ZodType<TableQuery>){
 return z.strictObject({
  revision:z.number().int().nonnegative(),format:z.enum(['csv','json']),protectFormulas:z.boolean(),
  table:z.strictObject({columns:z.array(field).min(1).max(statisticsResultLimits.columns),rows:z.array(z.array(cell).max(statisticsResultLimits.columns)).max(statisticsResultLimits.rows)}),
  context:z.strictObject({kind:z.enum(['describe','statistics','profile','frequencies','distribution','correlation']),scope:field.min(1),sample:z.boolean(),analyzedAt:z.iso.datetime({offset:true}),query:query.optional(),partial:z.boolean().optional()})
 }).superRefine((request,context)=>{
  if(request.table.rows.some(row=>row.length!==request.table.columns.length))context.addIssue({code:'custom',path:['table','rows'],message:'statistics-result-width'})
  if(!statisticsResultWithinBudget(request))context.addIssue({code:'custom',message:sizeIssue})
 })
}

export function statisticsResultTooLarge(error:z.ZodError):boolean{return error.issues.some(issue=>issue.message===sizeIssue)}

export function serializeStatisticsResult(request:StatisticsResultRequest,source:StatisticsResultSource,sha256:(text:string)=>string):{content:string;context?:string}{
 if(!statisticsResultWithinBudget({request,source}))throw new Error(t('statistics.export.error.tooLarge'))
 const document={version:1,kind:'freyalab-statistics-result',metadata:{...request.context,source:source.name,revision:source.revision,dirty:source.dirty,exportedAt:source.exportedAt,...source.analysisSubset?{analysisSubset:source.analysisSubset}:{}},columns:request.table.columns,rows:request.table.rows}
 let output:{content:string;context?:string}
 if(request.format==='csv'){
  const content=stringify([request.table.columns,...request.table.rows],{quoted_string:true,escape_formulas:request.protectFormulas,record_delimiter:'\r\n'})
  output={content,context:JSON.stringify({...document,csv:{encoding:'utf8',delimiter:',',newline:'CRLF',protectFormulas:request.protectFormulas,sha256:sha256(content),nulls:t('statistics.export.nulls')}},null,2)+'\n'}
 }else output={content:JSON.stringify(document,null,2)+'\n'}
 // Escaping, JSON indentation and CSV quotes can grow a bounded input.
 if(encoder.encode(output.content).byteLength>statisticsResultLimits.fileBytes||encoder.encode(output.context??'').byteLength>statisticsResultLimits.fileBytes)throw new Error(t('statistics.export.error.tooLarge'))
 return output
}
