import {createHash} from 'node:crypto'
import {stringify} from 'csv-stringify/sync'
import {chartLabels,type ChartData} from '../shared/charts'
import type {ChartResultRequest,SqlResult} from '../shared/types'
import {describeConditions} from '../shared/table-conditions'
import {literal,table} from '../shared/markdown-table'
export const chartResultLimit=10000
export function chartResult(request:ChartResultRequest,result:SqlResult,data:ChartData,dirty:boolean){
 const config=request.configuration,labels=chartLabels(config.headers,config.options),source=result.sources[0]
 if(result.sources.length!==1||source.revision!==request.revision||data.rows.length!==Math.min(data.points,chartResultLimit))throw new Error('El resultado del gráfico está incompleto.')
 const scope=config.view?'Filtros de tabla guardados para esta exportación':'Documento completo'
 const metadata={description:labels.summary,source:source.name,revision:source.revision,dirty,origin:source.fromDisk?(source.large?'Archivo completo desde disco; el editor lo abre en solo lectura':'Archivo completo desde disco; el editor solo muestra una muestra'):'Documento en memoria; cambios pendientes incluidos',scope,configuration:config,completedAt:result.completedAt,duckdb:result.version,analyzedRows:data.total,usableRows:data.usable,totalElements:data.points,exportedElements:data.rows.length,partial:data.limited||result.limited,invalidDates:data.invalidDates,seriesCount:data.seriesCount,limit:chartResultLimit,precision:'Cálculos numéricos aproximados (DOUBLE), punto decimal; no se modifican identificadores en el CSV. Cuartiles tipo 7 y bigotes 1,5 RIC; atípicos enumerados hasta 20 por grupo. El orden es el del gráfico; la visibilidad de la leyenda no filtra los resultados.'}
 const meanings:Record<string,string>={x:labels.x,value:config.options.kind==='heatmap'?'Conteo de filas':config.options.kind==='box'?`Mediana de ${labels.y}`:labels.y,upper:'Límite superior del intervalo',fila:'Fila de la fuente analizada',y:labels.y,q1:'Cuartil 1',q3:'Cuartil 3',low:'Bigote inferior',high:'Bigote superior',outliers:'Atípicos totales',count:'Valores numéricos',atypical:'Primeros atípicos (máximo 20)',series:`Serie: ${config.headers[config.options.series??-1]??''}`}
 const columns=data.columns.map((key,index)=>({index,key,label:meanings[key]??key}))
 const document={version:1,kind:'freyalab-chart-result',metadata,columns,rows:data.rows}
 let csv:string|undefined
 if(request.format==='csv'){
  csv=stringify([columns.map(column=>`${column.index+1}. ${column.label}`),...data.rows],{quoted_string:true,escape_formulas:request.protectFormulas,record_delimiter:'\r\n'})
  return{content:csv,context:JSON.stringify({...document,csv:{encoding:'utf8',delimiter:',',newline:'CRLF',protectFormulas:request.protectFormulas,sha256:createHash('sha256').update(csv).digest('hex'),nulls:'Los nulos son campos sin contenido; los vacíos de texto están entrecomillados. Usa rows del JSON para la distinción exacta. La protección añade apóstrofo a valores que una hoja de cálculo podría interpretar como fórmula; rows conserva el original.'}},null,2)+'\n'}
 }
 if(request.format==='json')return{content:JSON.stringify(document,null,2)+'\n'}
 const conditions=describeConditions(config.headers,config.where)
 return{content:'# Informe de datos del gráfico\n\n'+
  (metadata.partial?'> **RESULTADO PARCIAL:** se conservan los primeros 10 000 elementos; las agregaciones usan toda la fuente elegida.\n\n':'')+
  'Instantánea de análisis. No modifica el CSV ni vuelve a calcular al abrir el informe.\n\n'+
  table([['Análisis','Valor'],['---','---'],['Descripción',literal(labels.summary)],['Fuente',literal(source.name)],['Revisión',String(source.revision)],['Origen',literal(metadata.origin)],['Alcance',literal(scope)],['Cambios pendientes',dirty?'Sí':'No'],['Filas analizadas',String(data.total)],['Filas utilizables',String(data.usable)],['Elementos exportados / totales',`${data.rows.length} / ${data.points}`],['Finalizado UTC',literal(result.completedAt)],['DuckDB',literal(result.version)]])+
  '## Filtros\n\n'+literal(JSON.stringify(config.view??{}))+'\n\n'+literal(conditions)+'\n\n'+
  '## Resultado\n\n'+table([columns.map(column=>literal(`${column.index+1}. ${column.label}`)),columns.map(()=>'---'),...data.rows.map(row=>row.map(value=>value===null?'`NULL`':literal(value)))])+
  '## Interpretación\n\nNULL sin comillas es un nulo SQL; "" es texto vacío. El texto utiliza escapes JSON y las cifras conservan la representación de DuckDB, sin convertir identificadores a números de JavaScript.\n\n'+literal(metadata.precision)+'\n\n'}
}
