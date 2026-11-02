import type {ChartData,ChartOptions} from './charts'
import Decimal from 'decimal.js'
import {t} from './i18n'
export function chartTop(data:ChartData,options:ChartOptions,totals:Record<string,string|null|undefined>[]){
 const labels=[...new Set(data.rows.map(row=>row[0]))],groups=data.limited?data.points:labels.length
 if(data.limited||!['bar','heatmap'].includes(options.kind)||labels.length<=10)return{data,groups,top:false,other:false}
 const valueIndex=data.columns.indexOf('value'),splitIndex=data.columns.indexOf(options.kind==='heatmap'?'y':'series')
 const additive=options.kind==='heatmap'||['count','sum'].includes(options.aggregate)
 if(!additive&&splitIndex>=0&&labels.some(label=>!totals.some(row=>row.grand==='2'&&row.x===label)))return{data,groups,top:false,other:false}
 const score=(label:string|null)=>{
  const total=totals.find(row=>row.grand==='2'&&row.x===label)?.value
  if(total!==undefined)return total===null?null:new Decimal(total)
  const cells=data.rows.filter(row=>row[0]===label)
  if(cells.every(row=>row[valueIndex]===null))return null
  if(!additive)return new Decimal(cells[0][valueIndex]!)
  return cells.reduce((sum,row)=>sum.plus(row[valueIndex]??0),new Decimal(0))
 }
 const ranked=labels.map((label,index)=>({label,index,value:score(label)})).sort((a,b)=>(a.value===null?(b.value===null?0:1):b.value===null?-1:b.value.comparedTo(a.value))||a.index-b.index)
 const leading=ranked.slice(0,10).map(item=>item.label),remainder=data.rows.filter(row=>!leading.includes(row[0]))
 const rows=leading.flatMap(label=>data.rows.filter(row=>row[0]===label)),other=!data.limited&&additive
 if(other){
  const name=t('charts.ui.remainingGroups'),label=labels.includes(name)?`${name} (${ranked.length-10})`:name
  const splits=splitIndex<0?[undefined]:[...new Set(remainder.map(row=>row[splitIndex]))]
  for(const split of splits){
   const cells=splitIndex<0?remainder:remainder.filter(row=>row[splitIndex]===split)
   const row=Array<string|null>(data.columns.length).fill(null);row[0]=label;row[valueIndex]=cells.every(row=>row[valueIndex]===null)?null:cells.reduce((sum,row)=>sum.plus(row[valueIndex]??0),new Decimal(0)).toString()
   if(splitIndex>=0)row[splitIndex]=split!
   rows.push(row)
  }
 }
 return{data:{...data,rows},groups,top:true,other}
}
export function chartPivot(data:ChartData,options:ChartOptions,totals:Record<string,string|null|undefined>[]){
 const split=data.columns.indexOf(data.columns.includes('series')?'series':'y'),measure=data.columns.indexOf('value')
 const grouped=options.kind==='bar'||options.kind==='heatmap'||options.kind==='box'||(options.kind==='line'&&options.time!==undefined&&options.time!=='none')
 const additive=options.kind==='histogram'||options.kind==='heatmap'||(grouped&&['count','sum'].includes(options.aggregate)&&options.kind!=='box')
 const grandTotal=totals.find(row=>row.grand==='1')?.value??null
 const columns=split<0?[]:[...new Set(data.rows.map(row=>row[split]))]
 const labels=grouped?[...new Set(data.rows.map(row=>row[0]))]:data.rows.map(row=>row[0])
 const rows=labels.map((label,index)=>{
  const cells=grouped?data.rows.filter(row=>row[0]===label):[data.rows[index]]
  const values=split<0?[cells[0]?.[measure]??null]:columns.map(column=>cells.find(row=>row[split]===column)?.[measure]??null)
  const total=grouped?totals.find(row=>row.grand==='2'&&row.x===label)?.value??null:options.kind==='histogram'?values[0]:null
  const percent=additive&&total!==null&&grandTotal!==null&&Number(grandTotal)!==0?Number(total)/Number(grandTotal)*100:null
  return{label,values,total,percent}
 })
 return{columns,rows,additive,grandTotal,totalValues:split<0?[grandTotal]:columns.map(column=>totals.find(row=>row.grand==='0'&&row.series===column)?.value??null)}
}
