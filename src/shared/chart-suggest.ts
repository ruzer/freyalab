import type {ChartOptions} from './charts'
import type {ColumnProfile} from './types'
import type {TranslationParameters} from './i18n'

export interface ChartColumn {column:number;name:string;profile?:ColumnProfile}
export interface ChartShelves {
 x?:number;y?:number;distribution?:boolean
 // Evidencia externa para estos ejes, revisión y alcance; los perfiles individuales no la prueban.
 multipleValuesPerGroup?:boolean
}
export interface ChartSuggestion {
 options:ChartOptions|null
 reason:{key:string;parameters:TranslationParameters}
 alternatives:ChartOptions[]
}
export function suggest(columns:readonly ChartColumn[],shelves:ChartShelves):ChartSuggestion {
 const none=(key:string):ChartSuggestion=>({options:null,reason:{key,parameters:{}},alternatives:[]})
 if(!columns.length)return none('charts.suggest.noColumns')
 const selected=[shelves.x,shelves.y].filter((index):index is number=>index!==undefined)
 if(!selected.length)return none('charts.suggest.chooseColumn')
 if(selected.some(index=>!Number.isInteger(index)||index<0||columns.filter(column=>column.column===index).length!==1))return none('charts.suggest.unavailableColumn')
 const x=columns.find(column=>column.column===(shelves.x??shelves.y))!
 const y=shelves.x===undefined||shelves.x===shelves.y?undefined:columns.find(column=>column.column===shelves.y)
 const kind=(column:ChartColumn|undefined)=>column?.profile?.kind
 const numericX=kind(x)==='number',dated=kind(x)==='date'
 const uncertain=[x,y].find(column=>column&&[undefined,'identifier','mixed','empty'].includes(kind(column)))
 const distribution=shelves.distribution===true,groupedNumber=!!y&&kind(y)==='number'&&['text','category','identifier'].includes(kind(x)??'')
 let distributionReason:string|undefined
 if(distribution&&y){
  if(!groupedNumber)distributionReason='charts.suggest.distributionIncompatible'
  else if(shelves.multipleValuesPerGroup===true)distributionReason='charts.suggest.distribution'
  else distributionReason=shelves.multipleValuesPerGroup===false?'charts.suggest.distributionTooFew':'charts.suggest.distributionNeedsEvidence'
 }
 const count:ChartOptions={kind:'bar',x:x.column,y:-1,bins:10,aggregate:'count',descending:false,measureType:'text',series:-1,time:'none'}
 const result=(options:ChartOptions,key:string,alternatives:ChartOptions[]):ChartSuggestion=>({
  options,alternatives,
  reason:{key:distributionReason??(uncertain?'charts.suggest.conservative':key),parameters:{
   x:x.name,xPosition:x.column+1,
   ...y?{y:y.name,yPosition:y.column+1}:{},
   ...uncertain?{field:uncertain.name,fieldPosition:uncertain.column+1}:{}
  }}
 })
 if(y&&kind(y)==='number'){
  const numeric:ChartOptions={...count,y:y.column,aggregate:'sum',measureType:'number'}
  const histogram:ChartOptions={...count,kind:'histogram',x:y.column,y:y.column,measureType:'number'}
  if(distribution&&groupedNumber&&shelves.multipleValuesPerGroup===true)return result({...numeric,kind:'box',aggregate:'count'},'charts.suggest.distribution',[numeric,histogram])
  const alternatives=distribution?[count,histogram]:[count]
  if(numericX)return result({...numeric,kind:'scatter',aggregate:'count'},'charts.suggest.twoNumbers',alternatives)
  if(dated)return result({...numeric,kind:'line',time:'month'},'charts.suggest.dateNumber',alternatives)
  return result(numeric,'charts.suggest.textNumber',alternatives)
 }
 if(y)return result({...count,kind:'heatmap',y:y.column},'charts.suggest.twoTexts',[count])
 if(numericX)return result({...count,kind:'histogram',y:x.column,measureType:'number'},'charts.suggest.numberOnly',[count])
 return result(count,'charts.suggest.textOnly',[{...count,descending:true}])
}
