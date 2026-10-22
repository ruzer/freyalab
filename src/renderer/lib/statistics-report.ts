import type {TableStats,TableQuery,ColumnAnalysis} from '../../shared/types'

export const STATISTICS_FIELDS=[['cells','Celdas'],['empty','Vacíos'],['unique','Únicos'],['numeric','Numéricos'],['sum','Suma'],['average','Media'],['min','Mínimo'],['max','Máximo'],['median','Mediana'],['deviation','Desv. poblacional (n)'],['sampleDeviation','Desv. muestral (n−1)'],['missing','Ausentes'],['whitespace','Solo espacios'],['excluded','Excluidos']] as const
export const PROFILE_FIELDS=[['cells','Filas'],['empty','Vacíos'],['missing','Campos ausentes'],['whitespace','Solo espacios'],['unique','Valores distintos exactos'],['duplicateGroups','Grupos repetidos'],['duplicateRows','Filas en grupos repetidos'],['extraDuplicates','Repeticiones adicionales'],['numeric','Numéricos utilizables'],['excluded','No numéricos o fuera del rango seguro'],['leadingZeros','Con ceros iniciales'],['minLength','Longitud mínima'],['maxLength','Longitud máxima'],['sum','Suma'],['average','Media'],['median','Mediana'],['min','Mínimo'],['max','Máximo'],['deviation','Desviación poblacional (n)'],['sampleDeviation','Desviación muestral (n−1)']] as const
export interface ReportContext {source:string;revision:number;sample:boolean;dirty:boolean;scope:string;analyzedAt:string;query?:TableQuery}
export interface ColumnReportContext extends ReportContext {columnName:string;otherColumnName?:string;duplicatesOnly:boolean}
export type StatisticsRow=TableStats&{index:number;name:string}
export type ColumnReportView='profile'|'frequencies'|'distribution'|'correlation'
// Un tramo de código evita enlaces automáticos de GFM; JSON distingue controles, vacíos y barras.
const literal=(text:string)=>{
 const json=JSON.stringify(text),fence='`'.repeat((json.match(/`+/g)??[]).reduce((n,run)=>Math.max(n,run.length+1),1))
 return fence+' '+json.replace(/\|/g,'\\|')+' '+fence
}
const number=(value:number|null)=>value===null?'—':String(value)
const table=(rows:string[][])=>rows.map(row=>'| '+row.join(' | ')+' |').join('\n')+'\n\n'
function preamble(context:ReportContext,title:string){
 return `# ${title}\n\n${context.sample?'> **MUESTRA LIMITADA:** los resultados no describen el archivo completo.\n\n':''}Informe estático del análisis completado. No modifica el CSV; abrirlo no vuelve a calcular los resultados.\n\n`+
 table([['Procedencia','Valor'],['---','---'],['Archivo',literal(context.source)],['Revisión de la sesión',String(context.revision)],['Alcance',literal(context.scope)],['Cambios sin guardar al iniciar',context.dirty?'Sí':'No'],['Análisis iniciado (UTC)',literal(context.analyzedAt)]])
}
function notes(context:ReportContext,warnings:string[]=[]){
 let text='## Interpretación y límites\n\nCálculos aproximados con punto decimal. Se excluyen textos y enteros fuera del rango numérico seguro. Vacíos incluye campos ausentes y solo espacios; únicos compara el texto exacto. — indica un resultado no disponible o no representable. La desviación poblacional usa n y la muestral n−1; esta última necesita al menos dos valores numéricos.\n\nLos textos entre comillas usan escapes JSON para distinguir vacíos, saltos de línea y barras. Los valores numéricos del informe no sustituyen el texto original del CSV.\n\n'
 for(const warning of warnings)text+='- '+literal(warning)+'\n'
 if(context.query){
  const {search,filters,sort,order,conditions,filterMode}=context.query
  const json=JSON.stringify({search,filters,sort,order,conditions,filterMode},null,2)
  const fence='`'.repeat((json.match(/`+/g)??[]).reduce((n,run)=>Math.max(n,run.length+1),3))
  text+='\n## Filtros y orden de la vista capturada\n\nLas posiciones del rango corresponden a esta vista, sin encabezados. Se omiten los controles de paginación.\n\n'+fence+'json\n'+json+'\n'+fence+'\n'
 }
 return text
}
export function statisticsReport(context:ReportContext,rows:StatisticsRow[]){
 let text=preamble(context,'Informe de estadísticas CSV')
 for(const row of rows)text+=`## ${row.index<0?'Celdas del rango':'Columna '+(row.index+1)}\n\n${literal(row.name)}\n\n`+table([['Medida','Valor'],['---','---'],...STATISTICS_FIELDS.map(([key,label])=>[label,number(row[key])])])
 return text+notes(context)
}
export function columnReport(context:ColumnReportContext,result:ColumnAnalysis,view:ColumnReportView){
 const titles={profile:'Perfil de columna',frequencies:'Frecuencias de columna',distribution:'Distribución de columna',correlation:'Correlación de Pearson'}
 let text=preamble(context,titles[view])+`Columna ${result.column+1}: ${literal(context.columnName)}\n\n`
 if(view==='profile'){
  text+=table([['Medida','Valor'],['---','---'],...PROFILE_FIELDS.map(([key,label])=>[label,number(result[key])])])
  if(result.missingRows.length)text+='Primeras filas originales con vacíos (máximo 20; sin encabezado, lista de ejemplos): '+result.missingRows.map(item=>item.row).join(', ')+'.\n\n'
 }else if(view==='frequencies'){
  const partial=result.frequencyOffset>0||result.frequencies.length<result.frequencyTotal||result.frequencies.some(entry=>entry.truncated)
  text+=(partial?'**VISTA PARCIAL: página cargada o textos abreviados; no es una lista completa de valores.**':'Lista completa de valores distintos del alcance analizado.')+'\n\n'
  text+=`Filtro de valores: ${context.duplicatesOnly?'solo repetidos':'todos'}. Posiciones ${result.frequencyTotal?result.frequencyOffset+1:0}–${result.frequencyOffset+result.frequencies.length} de ${result.frequencyTotal} valores. Frecuencias calculadas sobre ${result.cells} filas del alcance. Empates por primera fila original.\n\n`
  text+=table([['Valor (texto literal)','Conteo','Primera fila original','Texto abreviado','Longitud mostrada (UTF-16)'],['---','---','---','---','---'],...result.frequencies.map(entry=>[literal(entry.value),String(entry.count),String(entry.firstRow),entry.truncated?'Sí, primeros 256 caracteres':'No',String(entry.value.length)])])
 }else if(view==='distribution'){
  text+=`Intervalos de igual amplitud, sobre ${result.numeric} valores numéricos utilizables. Incluyen el límite inferior y excluyen el superior; el último incluye el máximo.\n\n`
  text+=table([['Desde','Hasta','Incluye superior','Filas'],['---','---','---','---'],...result.histogram.map((bin,index)=>[number(bin.lower),number(bin.upper),index===result.histogram.length-1?'Sí':'No',String(bin.count)])])
 }else{
  if(!result.correlation)throw new Error('Elige una columna de comparación y vuelve a explorar antes de crear el informe.')
  text+=`Comparación con columna ${result.correlation.column+1}: ${literal(context.otherColumnName??'')}\n\n`+table([['Medida','Valor'],['---','---'],['Pearson',number(result.correlation.value)],['Pares numéricos de la misma fila',String(result.correlation.pairs)],['Filas omitidas',String(result.correlation.omitted)]])+'Pearson mide asociación lineal; no demuestra causalidad. Con menos de dos pares o una columna constante puede no estar definido.\n\n'
 }
 return text+notes(context,result.warnings)
}
