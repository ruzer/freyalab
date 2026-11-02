import {suggest,type ChartColumn} from './chart-suggest'
import {t} from './i18n'
import type {ChartOptions} from './charts'
export type ChartZone='rows'|'columns'|'values'
export function fieldGroup(field:ChartColumn){const kind=field.profile?.kind;return kind==='number'||kind==='date'||kind==='category'?kind:'text'}
export function zoneFields(options:ChartOptions){
 return{rows:options.kind==='histogram'?-1:options.x,columns:options.kind==='heatmap'?options.y:options.series??-1,values:options.kind==='heatmap'?-1:options.y}
}
export function recommendedZone(field:ChartColumn,options:ChartOptions):ChartZone{
 return fieldGroup(field)==='number'?'values':fieldGroup(field)==='date'||zoneFields(options).rows<0?'rows':'columns'
}
export function addToZone(options:ChartOptions,zone:ChartZone,column:number,columns:readonly ChartColumn[]):ChartOptions{
 const field=columns.find(c=>c.column===column)
 if(!field)throw new Error(t('charts.fields.unavailable'))
 const next={...options},numeric=field.profile?.kind==='number'
 if(zone==='columns'){
  if(next.kind==='heatmap')next.y=column
  else{next.series=column;if(!['bar','line','scatter'].includes(next.kind))next.kind='bar'}
  return next
 }
 if(zone==='values'){
  next.y=column;next.measureType=numeric?'number':'text';next.aggregate=numeric?'sum':'count'
  if(next.kind==='histogram'||next.x<0){if(numeric)return{...next,kind:'histogram',x:column,series:-1,time:'none'};next.kind='bar'}
 }else next.x=column
 const proposal=suggest(columns,{x:next.x,...next.y>=0?{y:next.y}:{}}).options
 if(proposal){next.kind=proposal.kind;next.time=proposal.time??'none'}
 if((zone==='values'&&!numeric)||(zone==='rows'&&options.kind!=='heatmap'&&next.measureType==='text')){next.kind='bar';next.time='none'}
 if(zone==='rows'&&options.kind==='heatmap')next.kind='heatmap'
 if(next.kind==='heatmap'){next.series=-1;next.measureType='text';next.aggregate='count'}
 return next
}
export function removeFromZone(options:ChartOptions,zone:ChartZone):ChartOptions{
 if(zone==='rows')return{...options,x:-1}
 if(zone==='columns')return options.kind==='heatmap'?{...options,kind:'bar',y:-1,aggregate:'count',series:-1}:{...options,series:-1}
 // -2 solo representa la zona vacía en la interfaz; nunca se envía a chartSQL ni se guarda como preset.
 return{...options,y:-2,aggregate:'count',measureType:'text'}
}
export function swapZones(options:ChartOptions):ChartOptions{
 return options.kind==='heatmap'?{...options,x:options.y,y:options.x}:{...options,x:options.series??-1,series:options.x}
}
export function initialChart(columns:readonly ChartColumn[]){
 const category=['category','text','date','identifier'].map(kind=>columns.find(c=>c.profile?.kind===kind)).find(Boolean),number=columns.find(c=>c.profile?.kind==='number')
 const first=category??number??columns[0]
 return first?suggest(columns,{x:first.column,...number&&number!==first?{y:number.column}:{}}).options:null
}
