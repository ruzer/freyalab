import {setImmediate as yieldTurn} from 'node:timers/promises'
import {sum,mean,min,max,median,standardDeviation,sampleStandardDeviation,sampleCorrelation,equalIntervalBreaks} from 'simple-statistics'
import {date as isoDate} from './table-query'
import type {ColumnAnalysis,ColumnAnalysisRequest,TableRow} from '../shared/types'

const numberPattern=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/
export function numeric(value:string):number|null{const v=value.trim(),n=Number(v);return v&&numberPattern.test(v)&&Number.isFinite(n)?n:null}
function safeNumber(value:string){const n=numeric(value);return n!==null&&(!Number.isInteger(n)||Number.isSafeInteger(n))?n:null}
const finite=(value:number)=>Number.isFinite(value)?value:null

export function descriptive(values:number[]){return values.length?{sum:finite(sum(values)),average:finite(mean(values)),min:min(values),max:max(values),median:finite(median(values)),deviation:finite(standardDeviation(values)),sampleDeviation:values.length>1?finite(sampleStandardDeviation(values)):null}:{sum:null,average:null,min:null,max:null,median:null,deviation:null,sampleDeviation:null}}

export async function analyzeColumn(rows:TableRow[],indices:number[]|undefined,request:ColumnAnalysisRequest,ensure:()=>void,header:string):Promise<Omit<ColumnAnalysis,'revision'|'sample'|'filtered'|'column'>>{
 const cells=indices?.length??rows.length,values:number[]=[],x:number[]=[],y:number[]=[],missingRows:ColumnAnalysis['missingRows']=[]
 // shortcut: hasta 100 000 claves exactas en memoria; usar el motor analítico antes de ampliar la cardinalidad.
 const counts=new Map<string,{count:number;firstRow:number;rowId:string}>()
 let empty=0,missing=0,whitespace=0,leadingZeros=0,minLength=Infinity,maxLength=0,dates=0,invalidDates=0,unsafeIntegers=0,identifierZeros=0
 for(let i=0;i<cells;i++){
  const index=indices?indices[i]:i,row=rows[index],value=row.cells[request.column]??'',trimmed=value.trim(),parsed=numeric(value),n=parsed!==null&&(!Number.isInteger(parsed)||Number.isSafeInteger(parsed))?parsed:null
  const found=counts.get(value);if(found)found.count++;else{if(counts.size>=100000)throw new Error('La columna supera 100 000 valores distintos. Filtra los datos antes de explorarla.');counts.set(value,{count:1,firstRow:index+1,rowId:row.id})}
  if(!value.trim()){empty++;if(missingRows.length<20)missingRows.push({row:index+1,rowId:row.id})}
  if(request.column>=row.cells.length)missing++
  if(value.length&&!value.trim())whitespace++
  if(/^[+-]?0\d/.test(trimmed)){leadingZeros++;if(parsed!==null)identifierZeros++}
  if(parsed!==null&&Number.isInteger(parsed)&&!Number.isSafeInteger(parsed))unsafeIntegers++
  if(/^\d{4}-\d{2}-\d{2}$/.test(trimmed)){if(!trimmed.startsWith('0000-')&&isoDate(trimmed))dates++;else invalidDates++}
  minLength=Math.min(minLength,value.length);maxLength=Math.max(maxLength,value.length)
  if(n!==null)values.push(n)
  if(request.otherColumn!==undefined&&n!==null){const other=safeNumber(row.cells[request.otherColumn]??'');if(other!==null){x.push(n);y.push(other)}}
  if(i%2048===0){await yieldTurn();ensure()}
 }
 await yieldTurn();ensure()
 const frequencies=[...counts].filter(([,entry])=>!request.duplicatesOnly||entry.count>1).sort((a,b)=>b[1].count-a[1].count||a[1].firstRow-b[1].firstRow)
 let duplicateGroups=0,duplicateRows=0,distinctNonEmpty=0
 for(const [value,entry] of counts){if(value.trim())distinctNonEmpty++;if(entry.count>1){duplicateGroups++;duplicateRows+=entry.count}}
 const words=header.replace(/([a-z])([A-Z])/g,'$1 $2').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase(),headerHint=/(^|[^a-z0-9])(id|ids|codigo|code|clave|folio|uuid|rfc|curp|sku|zip)(?=$|[^a-z0-9])/.test(words),nonEmpty=cells-empty
 let kind:ColumnAnalysis['profile']['kind']='text'
 if(!nonEmpty)kind='empty'
 else if(headerHint||identifierZeros||unsafeIntegers)kind='identifier'
 else if(values.length===nonEmpty)kind='number'
 else if(dates===nonEmpty)kind='date'
 else if(values.length||dates||invalidDates)kind='mixed'
 else if(distinctNonEmpty<=20&&distinctNonEmpty<nonEmpty)kind='category'
 const profile={kind,dates,invalidDates,unsafeIntegers,identifierZeros,headerHint,distinctNonEmpty}
 const warnings:string[]=[],histogram:ColumnAnalysis['histogram']=[]
 const statistics=descriptive(values)
 if(values.length){
  const lower=statistics.min!,upper=statistics.max!
  const breaks=lower===upper?[lower,upper]:equalIntervalBreaks(values,request.bins)
  if(breaks.every(Number.isFinite)&&breaks.every((n,i)=>i===0||n>breaks[i-1]||lower===upper)){
   for(let i=0;i<breaks.length-1;i++)histogram.push({lower:breaks[i],upper:breaks[i+1],count:0})
   for(let i=0;i<values.length;i++){const n=values[i];let bin=0;while(bin<histogram.length-1&&n>=histogram[bin].upper)bin++;histogram[bin].count++;if(i%8192===0){await yieldTurn();ensure()}}
  }else warnings.push('No se pueden representar intervalos distintos con esta precisión numérica.')
  if(statistics.sum===null||statistics.average===null||statistics.median===null||statistics.deviation===null||values.length>1&&statistics.sampleDeviation===null)warnings.push('Algunos resultados exceden la precisión numérica y se muestran como no disponibles.')
 }
 let correlation:ColumnAnalysis['correlation']
 if(request.otherColumn!==undefined){
  const value=x.length>1&&standardDeviation(x)>0&&standardDeviation(y)>0?finite(sampleCorrelation(x,y)):null
  correlation={column:request.otherColumn,pairs:x.length,omitted:cells-x.length,value:value===null?null:Math.max(-1,Math.min(1,value))}
  if(value===null)warnings.push('Pearson requiere al menos dos pares numéricos y variación en ambas columnas; también puede ser no representable con esta precisión.')
 }
 await yieldTurn();ensure()
 return{profile,cells,empty,missing,whitespace,numeric:values.length,excluded:cells-empty-values.length,leadingZeros,minLength:cells?minLength:0,maxLength,unique:counts.size,duplicateGroups,duplicateRows,extraDuplicates:duplicateRows-duplicateGroups,...statistics,
  frequencies:frequencies.slice(request.frequencyOffset,request.frequencyOffset+50).map(([value,entry])=>({value:value.slice(0,256),truncated:value.length>256,...entry})),frequencyTotal:frequencies.length,frequencyOffset:request.frequencyOffset,missingRows,histogram,correlation,warnings}
}
