import type {EChartsOption} from 'echarts'
import type {ChartData,ChartOptions} from '../shared/charts'
import {chartKinds,chartLabels} from '../shared/charts'
const number=(v:string|null)=>{if(v===null)return null;const n=Number(v);if(!Number.isFinite(n))throw new Error('Un resultado numérico no se puede representar.');return n}
const label=(value:string|null)=>value===null?'(campo ausente)':value===''?'(vacío)':value
const short=(value:unknown)=>String(value).replace(/[{}]/g,'').slice(0,28)
export function chartSeries(data:ChartData){
 const index=data.columns.indexOf('series')
 return index<0?[]:[...new Set(data.rows.map(row=>row[index]))].map((value,i)=>({value,name:`${i+1}. ${label(value)}`}))
}
export function chartOption(data:ChartData,options:ChartOptions,colors:{text:string;background:string;accent:string},headers:string[]=[],scope='Documento completo',hiddenSeries:string[]=[]):EChartsOption{
 const labels={color:colors.text,formatter:short},axisLine={lineStyle:{color:colors.text}},splitLine={lineStyle:{color:colors.text,opacity:0.15}}
 const axes=chartLabels(headers,options),axisNames={nameLocation:'middle' as const,nameGap:50,nameTextStyle:{color:colors.text,fontSize:10,overflow:'truncate' as const,width:250}},xName={...axisNames,name:axes.x},yName={...axisNames,name:axes.y,nameGap:60}
 const visibility=hiddenSeries.length?` · ${hiddenSeries.length} ${hiddenSeries.length===1?'serie oculta':'series ocultas'} (totales sin recalcular)`:''
 const {rows}=data,category=rows.map((row,i)=>`${i+1}. ${label(row[0])}`)
 const common:EChartsOption={animation:false,backgroundColor:colors.background,color:[colors.accent,'#d98b43'],textStyle:{color:colors.text,fontFamily:'Inter'},aria:{enabled:true,label:{description:`${chartKinds[options.kind]}. ${axes.summary}. ${scope}. ${rows.length} elementos de ${data.points}${visibility}. La tabla de datos contiene los valores y se puede recorrer con teclado.`}},title:{text:axes.summary,textStyle:{color:colors.text,fontSize:12,overflow:'truncate',width:500},subtext:`${scope} · ${data.limited?'Vista parcial · ':''}${rows.length} de ${data.points} elementos · ${data.total} filas fuente · ${data.total-data.usable} omitidas del cálculo${visibility}`,left:16,top:8,subtextStyle:{color:colors.text,fontSize:10}},tooltip:{renderMode:'richText',confine:true},grid:{left:85,right:40,top:65,bottom:85,containLabel:false},xAxis:{...xName,type:'category',data:category,axisLabel:{...labels,rotate:25},axisLine},yAxis:{...yName,type:'value',axisLabel:labels,splitLine},series:[]}
 const groups=chartSeries(data)
 if(data.columns.includes('series')){
  const index=data.columns.indexOf('series'),xs=[...new Set(rows.map(row=>row[0]))]
  return{...common,color:[colors.accent,'#d98b43','#91cc75','#ee6666','#73c0de','#3ba272','#fc8452','#9a60b4'],legend:{type:'scroll',top:48,left:85,right:40,textStyle:{color:colors.text},formatter:short,data:groups.map(group=>group.name),selected:Object.fromEntries(groups.map(group=>[group.name,!hiddenSeries.includes(group.name)]))},grid:{left:85,right:40,top:90,bottom:85},...(options.kind==='bar'?{xAxis:{...xName,type:'category',data:xs.map((value,i)=>`${i+1}. ${label(value)}`),axisLabel:{...labels,rotate:25},axisLine}}:{xAxis:{...xName,type:'value',scale:true,axisLabel:labels,axisLine,splitLine},yAxis:{...yName,type:'value',scale:true,axisLabel:labels,splitLine}}),series:groups.map(group=>{
   const values=rows.filter(row=>row[index]===group.value)
   if(options.kind==='bar')return{name:group.name,type:'bar' as const,data:xs.map(x=>number(values.find(row=>row[0]===x)?.[1]??null))}
   const data=values.map(row=>[number(row[0]),number(row[1])])
   return options.kind==='line'?{name:group.name,type:'line' as const,connectNulls:false,showSymbol:values.length<100,data}:{name:group.name,type:'scatter' as const,symbolSize:7,data}
  })}
 }
 if(options.kind==='histogram')return{...common,xAxis:{...xName,type:'category',data:rows.map((r,i)=>`[${r[0]}, ${r[2]}${i===rows.length-1?']':')'}`),axisLabel:{...labels,rotate:25},axisLine},series:[{type:'bar',barCategoryGap:0,data:rows.map(r=>number(r[1]))}]}
 if(options.kind==='bar')return{...common,series:[{type:'bar',data:rows.map(r=>number(r[1]))}]}
 if(options.kind==='line'||options.kind==='scatter')return{...common,xAxis:{...xName,type:'value',scale:true,axisLabel:labels,axisLine,splitLine},yAxis:{...yName,type:'value',scale:true,axisLabel:labels,splitLine},series:options.kind==='line'?[{type:'line',connectNulls:false,showSymbol:rows.length<100,data:rows.map(r=>[number(r[0]),number(r[1])])}]:[{type:'scatter',symbolSize:7,data:rows.map(r=>[number(r[0]),number(r[1])])}]}
 if(options.kind==='heatmap'){
  const xs=[...new Set(rows.map(r=>r[0]))],ys=[...new Set(rows.map(r=>r[2]))],values=rows.map(r=>number(r[1])!)
  return{...common,xAxis:{...xName,type:'category',data:xs.map((v,i)=>`${i+1}. ${label(v)}`),axisLabel:{...labels,rotate:25},axisLine},yAxis:{...yName,type:'category',data:ys.map((v,i)=>`${i+1}. ${label(v)}`),axisLabel:labels,axisLine},visualMap:{min:Math.min(0,...values),max:Math.max(1,...values),textStyle:{color:colors.text},calculable:false,orient:'horizontal',left:'center',bottom:0,inRange:{color:['#dfe8f7',colors.accent]}},series:[{type:'heatmap',data:rows.map(r=>[xs.indexOf(r[0]),ys.indexOf(r[2]),number(r[1])]),label:{show:rows.length<=50,color:colors.text}}]}
 }
 const outliers:number[][]=[]
 rows.forEach((row,index)=>{const values=JSON.parse(row[8]??'[]') as unknown;if(!Array.isArray(values)||values.length>20||values.some(n=>typeof n!=='number'||!Number.isFinite(n)))throw new Error('Atípicos no válidos.');for(const n of values)outliers.push([index,n])})
 return{...common,series:[{type:'boxplot',data:rows.map(r=>[number(r[4])!,number(r[2])!,number(r[1])!,number(r[3])!,number(r[5])!])},{name:'Atípicos (hasta 20 por grupo)',type:'scatter',symbolSize:6,data:outliers}]}
}
