import {t,plural,formatNumber} from '../shared/i18n'
import type {EChartsOption} from 'echarts'
import type {ChartData,ChartOptions} from '../shared/charts'
import {chartLabels} from '../shared/charts'
import {chartTrendLine,chartTrendText} from '../shared/chart-trend'
export const formatChartNumber=(value:number)=>formatNumber(value,{maximumSignificantDigits:12})
const number=(v:string|null)=>{if(v===null)return null;const n=Number(v);if(!Number.isFinite(n))throw new Error('Un resultado numérico no se puede representar.');return n}
const label=(value:string|null)=>value===null?t('charts.plot.missing'):value===''?t('charts.plot.empty'):value
const short=(value:unknown)=>String(value).replace(/[{}]/g,'').slice(0,28)
export function chartSeries(data:ChartData){
 const index=data.columns.indexOf('series')
 if(index<0)return[]
 const values=[...new Set(data.rows.map(row=>row[index]))],labels=values.map(value=>short(label(value)))
 return values.map((value,i)=>({value,name:labels.filter(item=>item===labels[i]).length>1?`${i+1}. ${label(value)}`:label(value)}))
}
export function chartOption(data:ChartData,options:ChartOptions,colors:{text:string;background:string;accent:string;dark?:boolean;compact?:boolean},headers:string[]=[],scope='Documento completo',hiddenSeries:string[]=[]):EChartsOption{
 const compact=colors.compact??false
 const palette=[colors.accent,...(colors.dark?['#efa657','#a3c66d','#ff8a91','#6fc6de','#65cba8','#fcb07a','#c294ee']:['#a05a00','#367220','#bc3447','#007f99','#00745c','#ac4c00','#8250b5'])]
 const symbols=['circle','rect','triangle','diamond','pin','arrow','roundRect','emptyCircle'] as const
 const markNumber=({value}:{value:unknown})=>{const n=Array.isArray(value)?value[options.kind==='heatmap'?2:1]:value;return n===null||n===undefined?'—':formatChartNumber(Number(n))}
 const direct={show:data.rows.length<=20,position:'top' as const,color:colors.text,formatter:markNumber}
 const numericLabels={color:colors.text,formatter:(value:string|number)=>formatChartNumber(Number(value))}
 const labels={color:colors.text,formatter:short},axisLine={lineStyle:{color:colors.text}},splitLine={lineStyle:{color:colors.text,opacity:0.15}}
 const axes=chartLabels(headers,options),axisNames={nameLocation:'middle' as const,nameGap:compact?38:50,nameTextStyle:{color:colors.text,fontSize:11,overflow:'truncate' as const,width:250}},xName={...axisNames,name:axes.x},yName={...axisNames,name:axes.y,nameGap:60}
 const visibility=hiddenSeries.length?` · ${plural('charts.ui.hidden',hiddenSeries.length)}`:''
 const dates=data.invalidDates!==undefined?` · ${t('charts.ui.invalidDates',{n:formatNumber(data.invalidDates)})}`:''
 const temporal=options.time!==undefined&&options.time!=='none'
 const {rows}=data
 const categories=(values:(string|null)[])=>{const labels=values.map(label).map(short);return values.map((value,i)=>labels.filter(item=>item===labels[i]).length>1?`${i+1}. ${label(value)}`:label(value))}
 const category=temporal?rows.map(row=>label(row[0])):categories(rows.map(row=>row[0]))
 const common:EChartsOption={animation:false,backgroundColor:colors.background,color:palette,textStyle:{color:colors.text,fontFamily:'Inter'},aria:{enabled:true,decal:{show:!!data.columns.includes('series')},label:{description:`${t('charts.kind.'+options.kind)}. ${axes.summary}. ${scope}. ${t('charts.plot.description',{count:formatNumber(rows.length),total:formatNumber(data.points)})}${visibility}${dates}. ${t('charts.plot.tableHelp')}`}},title:{show:!compact,text:axes.summary,textStyle:{color:colors.text,fontSize:12,overflow:'truncate',width:500},subtext:`${scope} · ${data.limited?t('charts.plot.partial')+' · ':''}${t('charts.plot.sourceStatus',{total:formatNumber(data.total),omitted:formatNumber(data.total-data.usable),drawn:formatNumber(rows.length),points:formatNumber(data.points)})}${visibility}${dates}`,left:16,top:8,subtextStyle:{color:colors.text,fontSize:10}},tooltip:{renderMode:'richText',confine:true,valueFormatter:value=>(Array.isArray(value)?value:[value]).map(item=>typeof item==='number'?formatChartNumber(item):String(item??'—')).join(', ')},grid:{left:85,right:40,top:compact?15:65,bottom:compact?60:85,containLabel:false},xAxis:{...xName,type:'category',data:category,axisLabel:{...labels,rotate:25},axisLine},yAxis:{...yName,type:'value',splitNumber:4,...options.aggregate==='count'?{minInterval:1}:{},axisLabel:numericLabels,splitLine},series:[]}
 const groups=chartSeries(data)
 if(data.columns.includes('series')){
  const index=data.columns.indexOf('series'),xs=[...new Set(rows.map(row=>row[0]))]
  return{...common,color:palette,legend:{type:'scroll',top:compact?0:48,left:85,right:40,textStyle:{color:colors.text},formatter:short,data:groups.map(group=>group.name),selected:Object.fromEntries(groups.map(group=>[group.name,!hiddenSeries.includes(group.name)]))},grid:{left:85,right:40,top:compact?30:90,bottom:compact?60:85},...(options.kind==='bar'||temporal?{xAxis:{...xName,type:'category',data:temporal?xs.map(label):categories(xs),axisLabel:{...labels,rotate:25},axisLine}}:{xAxis:{...xName,type:'value',scale:true,axisLabel:numericLabels,axisLine,splitLine},yAxis:{...yName,type:'value',scale:true,axisLabel:numericLabels,splitLine}}),series:groups.map((group,groupIndex)=>{
   const values=rows.filter(row=>row[index]===group.value)
   if(options.kind==='bar')return{name:group.name,type:'bar' as const,label:direct,data:xs.map(x=>number(values.find(row=>row[0]===x)?.[1]??null))}
   const data=temporal?xs.map(x=>number(values.find(row=>row[0]===x)?.[1]??null)):values.map(row=>[number(row[0]),number(row[1])])
   return options.kind==='line'?{name:group.name,type:'line' as const,lineStyle:{type:groupIndex===0?'solid' as const:[4+groupIndex*2,4]},symbol:symbols[groupIndex],label:direct,connectNulls:false,showSymbol:values.length<100,data}:{name:group.name,type:'scatter' as const,symbol:symbols[groupIndex],symbolSize:7,data}
  })}
 }
 if(temporal&&options.kind==='line')return{...common,series:[{type:'line',label:direct,connectNulls:false,showSymbol:rows.length<100,data:rows.map(row=>number(row[1]))}]}
 if(options.kind==='histogram')return{...common,xAxis:{...xName,type:'category',data:rows.map((r,i)=>`[${formatChartNumber(Number(r[0]))}, ${formatChartNumber(Number(r[2]))}${i===rows.length-1?']':')'}`),axisLabel:{...labels,rotate:25},axisLine},series:[{type:'bar',label:direct,barCategoryGap:0,data:rows.map(r=>number(r[1]))}]}
 if(options.kind==='bar')return{...common,series:[{type:'bar',label:direct,data:rows.map(r=>number(r[1]))}]}
 if(options.kind==='line'||options.kind==='scatter'){
  const trend=options.kind==='scatter'&&options.trend?data.trend:undefined,line=trend?chartTrendLine(trend):[],text=trend?chartTrendText(trend,headers,options,!compact):[]
  return{...common,...trend?{title:[...(Array.isArray(common.title)?common.title:common.title?[common.title]:[]),{text:text[0],left:85,right:40,top:compact?0:52,textStyle:{color:colors.text,fontSize:11,overflow:'break',width:450}}],grid:{left:85,right:40,top:compact?45:100,bottom:compact?60:85},aria:{enabled:true,label:{description:[(common.aria as {label:{description:string}}).label.description,...text].join(' ')}}}:{},...line.length?{legend:{data:[t('charts.trend.legend')],top:compact?20:75,right:40,textStyle:{color:colors.text}}}:{},xAxis:{...xName,type:'value',scale:true,axisLabel:numericLabels,axisLine,splitLine},yAxis:{...yName,type:'value',scale:true,axisLabel:numericLabels,splitLine},series:options.kind==='line'?[{type:'line',label:direct,connectNulls:false,showSymbol:rows.length<100,data:rows.map(r=>[number(r[0]),number(r[1])])}]:[{type:'scatter',symbolSize:7,data:rows.map(r=>[number(r[0]),number(r[1])])},...line.length?[{name:t('charts.trend.legend'),type:'line' as const,data:line,showSymbol:false,lineStyle:{color:colors.text,type:'dashed' as const},itemStyle:{color:colors.text},z:3}]:[]]}
 }
 if(options.kind==='heatmap'){
  // La escala clara conserva cifras negras legibles, independientemente del acento de los botones.
  const xs=[...new Set(rows.map(r=>r[0]))],ys=[...new Set(rows.map(r=>r[2]))],values=rows.map(r=>number(r[1])!)
  return{...common,grid:{left:85,right:40,top:compact?15:65,bottom:compact?100:120},xAxis:{...xName,type:'category',data:categories(xs),axisLabel:{...labels,rotate:25},axisLine},yAxis:{...yName,type:'category',data:categories(ys),axisLabel:labels,axisLine},visualMap:{formatter:value=>value===null||value===undefined?'—':formatChartNumber(Number(value)),min:Math.min(0,...values),max:Math.max(1,...values),textStyle:{color:colors.text},calculable:false,orient:'horizontal',left:'center',bottom:0,inRange:{color:['#dfe8f7','#3b82f6']}},series:[{type:'heatmap',data:rows.map(r=>[xs.indexOf(r[0]),ys.indexOf(r[2]),number(r[1])]),label:{show:rows.length<=50,color:'#000000',formatter:markNumber}}]}
 }
 const outliers:number[][]=[]
 rows.forEach((row,index)=>{const values=JSON.parse(row[8]??'[]') as unknown;if(!Array.isArray(values)||values.length>20||values.some(n=>typeof n!=='number'||!Number.isFinite(n)))throw new Error('Atípicos no válidos.');for(const n of values)outliers.push([index,n])})
 return{...common,series:[{type:'boxplot',data:rows.map(r=>[number(r[4])!,number(r[2])!,number(r[1])!,number(r[3])!,number(r[5])!])},{name:t('charts.plot.outliers'),type:'scatter',symbolSize:6,data:outliers}]}
}
