import {t} from '../../shared/i18n'
import type {ColumnAnalysis} from '../../shared/types'
import type {StatisticsResultRequest} from '../../shared/statistics-result'
import {describeTable,type DescribeEntry} from './describe-table'
import {STATISTICS_FIELDS,PROFILE_FIELDS,NUMERIC_DETAIL_FIELDS,type ReportContext,type ColumnReportContext,type StatisticsRow,type ColumnReportView} from './statistics-report'

export type StatisticsData=Pick<StatisticsResultRequest,'table'|'context'>
type ResultKind=StatisticsResultRequest['context']['kind']

function exportContext(context:ReportContext,kind:ResultKind,partial=false):StatisticsData['context']{
 return{kind,scope:context.scope,sample:context.sample,analyzedAt:context.analyzedAt,partial,...context.query?{query:structuredClone(context.query)}:{}}
}

// These constructors only reshape captured results. Screen formatters, source
// cells and Markdown serialization are deliberately outside this path.
export function describeData(context:ReportContext,entries:DescribeEntry[],includeText:boolean):StatisticsData{
 const matrix=describeTable(entries,includeText)
 return{
  table:{columns:[t('describe.metric'),...matrix.columns.map(column=>column.name||t('describe.column',{index:column.index+1}))],rows:matrix.rows.map(row=>[t('describe.metric.'+row.metric),...row.values])},
  context:exportContext(context,'describe',matrix.columns.some(column=>column.unavailable===true)),
 }
}

export function statisticsData(context:ReportContext,rows:StatisticsRow[]):StatisticsData{
 const fields=[...STATISTICS_FIELDS,...NUMERIC_DETAIL_FIELDS]
 return{
  table:{columns:[t('statistics.column'),...fields.map(([key])=>t('statistics.field.'+key))],rows:rows.map(row=>[row.name,...fields.map(([key])=>row[key])])},
  context:exportContext(context,'statistics'),
 }
}

export function columnAnalysisData(context:ColumnReportContext,result:ColumnAnalysis,view:ColumnReportView):StatisticsData{
 const name=context.columnName||t('describe.column',{index:result.column+1})
 const names=view==='correlation'&&context.otherColumnName?name+' / '+context.otherColumnName:name
 const captured={...context,sample:result.sample,scope:names+' · '+context.scope}
 const partial=view==='frequencies'&&(context.duplicatesOnly||result.frequencyOffset>0||result.frequencyOffset+result.frequencies.length<result.frequencyTotal||result.frequencies.some(entry=>entry.truncated))
 const provenance=exportContext(captured,view,partial)
 if(view==='profile')return{
  table:{columns:[t('describe.metric'),name],rows:[...PROFILE_FIELDS,...NUMERIC_DETAIL_FIELDS].map(([key,label])=>[label,result[key]])},
  context:provenance,
 }
 if(view==='frequencies')return{
  table:{columns:['value','count','percent','firstRow'].map(key=>t('statistics.export.'+key)),rows:result.frequencies.map(entry=>[entry.value,entry.count,result.cells?entry.count/result.cells*100:0,entry.firstRow])},
  context:provenance,
 }
 if(view==='distribution')return{
  table:{columns:['lower','upper','count'].map(key=>t('statistics.export.'+key)),rows:result.histogram.map(bin=>[bin.lower,bin.upper,bin.count])},
  context:provenance,
 }
 if(!result.correlation)throw new Error(t('ui.reason.correlation'))
 return{
  table:{columns:[t('describe.metric'),t('describe.report.value')],rows:[[t('statistics.export.pearson'),result.correlation.value],[t('statistics.export.pairs'),result.correlation.pairs],[t('statistics.export.omitted'),result.correlation.omitted]]},
  context:provenance,
 }
}
