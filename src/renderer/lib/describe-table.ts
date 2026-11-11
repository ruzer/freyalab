import type {ColumnDescribe,ColumnProfileHint,TableStats} from '../../shared/types'

const numericFields={count:'numeric',mean:'average',std:'sampleDeviation',min:'min','25%':'percentile25','50%':'median','75%':'percentile75',max:'max'} as const
export type DescribeMetric=keyof typeof numericFields|'unique'|'top'|'freq'
export type DescribeValue=string|number|null
export interface DescribeEntry {
 index:number;name:string;profile:ColumnProfileHint
 stats?:Pick<TableStats,typeof numericFields[keyof typeof numericFields]>
 description?:ColumnDescribe
 unavailable?:boolean
}

export function describeTable(entries:DescribeEntry[],includeText:boolean){
 const columns=entries.filter(entry=>includeText||entry.profile.kind==='number')
 const metrics:DescribeMetric[]=includeText?['count','unique','top','freq','mean','std','min','25%','50%','75%','max']:['count','mean','std','min','25%','50%','75%','max']
 return{columns,rows:metrics.map(metric=>({metric,values:columns.map((entry):DescribeValue=>{
  if(entry.unavailable)return null
  if(entry.profile.kind==='empty')return metric==='count'?0:null
  if(entry.profile.kind==='number'&&metric in numericFields)return entry.stats?.[numericFields[metric as keyof typeof numericFields]]??null
  if(entry.profile.kind==='number'||!entry.description)return null
  if(metric==='count'||metric==='unique')return entry.description[metric]
  if(entry.profile.kind==='date')return metric==='min'?entry.description.dateMin:metric==='max'?entry.description.dateMax:null
  if(metric==='top'||metric==='freq')return entry.description[metric]
  return null
 })}))}
}
