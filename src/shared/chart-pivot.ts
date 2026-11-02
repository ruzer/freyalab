import type {ChartData,ChartOptions} from './charts'
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
