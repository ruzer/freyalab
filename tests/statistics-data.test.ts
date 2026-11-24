import {afterEach,expect,it} from 'vitest'
import {describeData,statisticsData,columnAnalysisData} from '../src/renderer/lib/statistics-data'
import {STATISTICS_FIELDS,PROFILE_FIELDS,NUMERIC_DETAIL_FIELDS,type ReportContext,type ColumnReportContext,type StatisticsRow} from '../src/renderer/lib/statistics-report'
import type {DescribeEntry} from '../src/renderer/lib/describe-table'
import type {ColumnAnalysis} from '../src/shared/types'
import {setLanguage,t} from '../src/shared/i18n'

afterEach(()=>setLanguage('es'))
const tiny=0.000000000123456789,precise=0.1234567890123456,coefficient=0.9999999999999999
const context:ReportContext={source:'datos.csv',revision:7,sample:false,dirty:true,scope:'Vista filtrada',analyzedAt:'2026-11-23T20:00:00.000Z',query:{offset:0,limit:50,requestId:1,search:'visible',order:[{column:0,descending:false,numeric:false}]}}
const row:StatisticsRow={index:2,name:'00123',revision:7,sample:false,cells:4,empty:1,unique:4,numeric:3,sum:0.1+0.2,average:tiny,min:tiny,max:precise,median:precise,deviation:precise,sampleDeviation:null,variance:precise,sampleVariance:null,percentile10:tiny,percentile25:precise,percentile75:precise,percentile90:precise,missing:1,whitespace:0,excluded:0}
const column:ColumnAnalysis={...row,describe:{count:3,unique:3,top:'00123',freq:2,dateMin:null,dateMax:null},profile:{kind:'number',dates:0,invalidDates:0,unsafeIntegers:0,identifierZeros:0,headerHint:false,distinctNonEmpty:3},column:2,filtered:true,leadingZeros:0,duplicateGroups:1,duplicateRows:2,extraDuplicates:1,minLength:0,maxLength:8,frequencies:[{value:'00123',truncated:false,count:2,firstRow:3,rowId:'3'}],frequencyTotal:1,frequencyOffset:0,missingRows:[{row:4,rowId:'4'}],histogram:[{lower:tiny,upper:precise,count:1},{lower:precise,upper:1,count:2}],correlation:{column:3,pairs:3,omitted:1,value:coefficient},warnings:[]}
const columnContext:ColumnReportContext={...context,columnName:'Importe',otherColumnName:'Comparación',duplicatesOnly:false}
const entries:DescribeEntry[]=[
 {index:0,name:'Valor',profile:{kind:'number'},stats:{numeric:3,average:0.1+0.2,sampleDeviation:null,min:tiny,percentile25:precise,median:precise,percentile75:precise,max:precise}},
 {index:1,name:'ID',profile:{kind:'identifier'},description:{count:3,unique:2,top:'90071992547409931234',freq:2,dateMin:null,dateMax:null}},
]

it('describe exporta la matriz calculada con números completos y null, sin formato de pantalla',()=>{
 const data=describeData(context,entries,false)
 expect(data.table.columns).toEqual([t('describe.metric'),'Valor'])
 expect(data.table.rows).toEqual([
  [t('describe.metric.count'),3],[t('describe.metric.mean'),0.30000000000000004],
  [t('describe.metric.std'),null],[t('describe.metric.min'),tiny],
  [t('describe.metric.25%'),precise],[t('describe.metric.50%'),precise],
  [t('describe.metric.75%'),precise],[t('describe.metric.max'),precise],
 ])
 expect(data.context).toMatchObject({kind:'describe',scope:context.scope,sample:false,analyzedAt:context.analyzedAt,query:context.query,partial:false})
 expect(data.table.rows[1][1]).not.toBe('0.3')
})

it('describe conserva texto, identificadores, escapes y nombres repetidos sin convertirlos',()=>{
 const text='00123, "cita"\r\n\\ <script> =1+1'
 const input:DescribeEntry[]=[...entries,{index:2,name:'ID',profile:{kind:'text'},description:{count:2,unique:1,top:text,freq:2,dateMin:null,dateMax:null}}]
 const data=describeData(context,input,true)
 expect(data.table.columns).toEqual([t('describe.metric'),'Valor','ID','ID'])
 expect(data.table.rows.find(values=>values[0]===t('describe.metric.top'))).toEqual([t('describe.metric.top'),null,'90071992547409931234',text])
 expect(data.table.rows.find(values=>values[0]===t('describe.metric.mean'))).toEqual([t('describe.metric.mean'),0.30000000000000004,null,null])
})

it('describe marca muestra y resumen parcial sin inventar ceros para una columna no disponible',()=>{
 const data=describeData({...context,sample:true},[...entries,{index:2,name:'No disponible',profile:{kind:'number'},unavailable:true}],false)
 expect(data.context).toMatchObject({sample:true,partial:true})
 expect(data.table.rows.every(values=>values.at(-1)===null)).toBe(true)
})

it('estadísticas detalladas exporta todos los campos calculados y conserva la etiqueta del rango',()=>{
 const data=statisticsData(context,[row,{...row,index:-1,name:'Celdas del rango'}])
 const fields=[...STATISTICS_FIELDS,...NUMERIC_DETAIL_FIELDS]
 expect(data.table.columns).toEqual([t('statistics.column'),...fields.map(([key])=>t('statistics.field.'+key))])
 expect(data.table.rows).toEqual([[row.name,...fields.map(([key])=>row[key])],['Celdas del rango',...fields.map(([key])=>row[key])]])
 expect(data.context).toMatchObject({kind:'statistics',partial:false,sample:false})
 expect(data.table.rows[0]).toContain(0.30000000000000004)
 expect(data.table.rows[0]).toContain(tiny)
 expect(data.table.rows[0]).toContain(null)
})

it('perfil incluye las medidas y percentiles completos, su columna y los null disponibles',()=>{
 const data=columnAnalysisData(columnContext,column,'profile')
 expect(data.table.columns).toEqual([t('describe.metric'),'Importe'])
 expect(data.table.rows).toEqual([...PROFILE_FIELDS,...NUMERIC_DETAIL_FIELDS].map(([key,label])=>[label,column[key]]))
 expect(data.context).toMatchObject({kind:'profile',scope:'Importe · Vista filtrada',sample:false,partial:false})
 expect(data.table.rows).toContainEqual(['Suma',0.30000000000000004])
})

it('frecuencias exporta solo la página ya calculada y conserva literalmente texto y porcentaje',()=>{
 const text='00123,"x"\n\\=1+1'
 const value={...column,sample:true,frequencyOffset:50,frequencyTotal:60,frequencies:[{value:text,truncated:true,count:1,firstRow:77,rowId:'77'}]}
 const data=columnAnalysisData({...columnContext,sample:true},value,'frequencies')
 expect(data.table.columns).toEqual([t('statistics.export.value'),t('statistics.export.count'),t('statistics.export.percent'),t('statistics.export.firstRow')])
 expect(data.table.rows).toEqual([[text,1,25,77]])
 expect(data.context).toMatchObject({kind:'frequencies',sample:true,partial:true,scope:'Importe · Vista filtrada'})
 const complete=columnAnalysisData(columnContext,column,'frequencies')
 expect(complete.context.partial).toBe(false)
 expect(complete.table.rows[0]).toEqual(['00123',2,50,3])
 expect(columnAnalysisData({...columnContext,duplicatesOnly:true},column,'frequencies').context.partial).toBe(true)
})

it('distribución y Pearson preservan límites pequeños, coeficientes y null sin redondear',()=>{
 const distribution=columnAnalysisData(columnContext,column,'distribution')
 expect(distribution.table.columns).toEqual([t('statistics.export.lower'),t('statistics.export.upper'),t('statistics.export.count')])
 expect(distribution.table.rows).toEqual([[tiny,precise,1],[precise,1,2]])
 const correlation=columnAnalysisData(columnContext,column,'correlation')
 expect(correlation.context).toMatchObject({kind:'correlation',scope:'Importe / Comparación · Vista filtrada'})
 expect(correlation.table.rows).toEqual([['Pearson',coefficient],[t('statistics.export.pairs'),3],[t('statistics.export.omitted'),1]])
 expect(columnAnalysisData(columnContext,{...column,correlation:{column:3,pairs:1,omitted:3,value:null}},'correlation').table.rows[0]).toEqual(['Pearson',null])
})

it('construye sin mutar resultados ni consulta y localiza solo las etiquetas de la matriz',()=>{
 const before=structuredClone({context,columnContext,row,column,entries})
 setLanguage('en')
 const data=describeData(context,entries,true)
 expect(data.table.columns[0]).toBe(t('describe.metric'))
 expect(data.table.columns.slice(1)).toEqual(['Valor','ID'])
 expect(data.table.rows.find(values=>values[0]===t('describe.metric.top'))?.[2]).toBe('90071992547409931234')
 statisticsData(context,[row]);columnAnalysisData(columnContext,column,'profile')
 expect({context,columnContext,row,column,entries}).toEqual(before)
 expect(data.context.query).not.toBe(context.query)
})
