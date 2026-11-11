<script lang="ts">
 import {csvAnalysisSample} from '../lib/csv-analysis-view'
 import {controlHint} from '../lib/control-hint'
 import Icon from './Icon.svelte'
 import {t,plural,getUILanguage,formatNumber} from '../lib/i18n.svelte'
 import {onMount,onDestroy,untrack,tick} from 'svelte'
 import {init,use,type ECharts} from 'echarts/core'
 import {BarChart,LineChart,ScatterChart,HeatmapChart,BoxplotChart} from 'echarts/charts'
 import {GridComponent,TooltipComponent,VisualMapComponent,AriaComponent,TitleComponent,LegendComponent} from 'echarts/components'
 import {SVGRenderer} from 'echarts/renderers'
 import {chartKinds,chartAggregates,chartTimeGroups,chartLabels,chartSQL,chartTotalSQL,chartData,chartLimit,type ChartOptions,type ChartData} from '../../shared/charts'
 import ChartPresets from './ChartPresets.svelte'
 import ChartFields from './ChartFields.svelte'
 import {initialChart,addToZone,removeFromZone,swapZones,zoneFields,type ChartZone} from '../../shared/chart-fields'
 import {chartView,type ChartView,type ChartConfiguration} from '../../shared/chart-presets'
 import CsvQueryTools from './CsvQueryTools.svelte'
 import {describeConditions} from '../../shared/table-conditions'
 import {chartPivot,chartTop} from '../../shared/chart-pivot'
 import {suggest,type ChartColumn} from '../../shared/chart-suggest'
 import {chartOption,chartSeries,formatChartNumber} from '../chart-option'
 import type {DocumentInfo,SqlResult,TableQuery,TableConditionGroup,TableViewMeta} from '../../shared/types'
 use([BarChart,LineChart,ScatterChart,HeatmapChart,BoxplotChart,GridComponent,TooltipComponent,VisualMapComponent,AriaComponent,TitleComponent,LegendComponent,SVGRenderer])
 let {doc,query,queryValid,viewMeta,visible=true,onDemand=false,exportHost,onclose,onerror}:{doc:DocumentInfo;query:TableQuery;queryValid:boolean;viewMeta:TableViewMeta;visible?:boolean;onDemand?:boolean;exportHost?:HTMLElement;onclose:()=>void;onerror:(message:string)=>void}=$props()
 let scope=$state<'all'|'filtered'|'saved'>('all'),savedView=$state<ChartView>()
 let where=$state<TableConditionGroup>({conditions:[],filterMode:'all'}),showFilters=$state(false),filtersButton=$state<HTMLButtonElement>()
 const sample=$derived(csvAnalysisSample(doc,viewMeta))
 const scopeLabel=$derived((sample===undefined?t('analysis.scope.pending'):scope==='all'?t('charts.ui.all'):scope==='saved'?t('charts.ui.saved'):t('charts.ui.filtered'))+(where.conditions.length?` · ${t('charts.ui.filterStatus',{n:where.conditions.length,mode:t(where.filterMode==='all'?'charts.ui.and':'charts.ui.or')})}`:''))
 const viewSignature=$derived(JSON.stringify([query.search,query.filters,query.conditions,query.filterMode]))
 const unavailable=$derived(sample===undefined||(scope==='filtered'&&(!queryValid||sample))||(scope==='saved'&&(!savedView||sample)))
 const analysisQuery=$derived(scope==='saved'&&savedView?{...savedView,offset:0,limit:1000,requestId:0}:query)
 let options=$state<ChartOptions>({kind:'bar',x:0,y:-1,bins:10,aggregate:'count',descending:false,measureType:'text',series:-1,time:'none',...untrack(()=>onDemand?{x:-1,y:-2}:{})})
 let started=$state(false),stale=$state(false),lastRevision=untrack(()=>doc.revision)
 $effect(()=>{const revision=doc.revision;if(onDemand&&lastRevision!==revision){lastRevision=revision;if(untrack(()=>started)){stale=true;message='charts.ui.changed'}}})
 const temporal=$derived(options.time!==undefined&&options.time!=='none')
 const aggregated=$derived(options.kind==='bar'||(options.kind==='line'&&temporal))
 const axes=$derived.by(()=>{getUILanguage();return chartLabels((doc.headers??[]).map((_,column)=>columnLabel(column)),options)})
 let data=$state<ChartData|null>(null),source=$state<SqlResult['sources'][number]|null>(null),busy=$state(false),message=$state('charts.ui.initial'),tablePage=$state(0),ready=$state(false),zoom=$state(1),exporting=$state(false)
 let resultFormat=$state<'csv'|'json'|'md'>('json'),protectFormulas=$state(true),cancellingExport=$state(false),exportJob=$state<string>()
 let hiddenSeries=$state<string[]>([])
 const series=$derived(data?chartSeries(data):[])
 let element:HTMLDivElement,chart:ECharts|undefined,active:string|undefined,observedSignature:string|undefined,totalJob:string|undefined,fieldJob:{id:string;requestId:string}|undefined
 let totals=$state<Record<string,string|null>[]>([]),profiles=$state<ChartColumn[]>([]),pivotPage=$state(0),pivotSize=$state(5),fieldsOpen=$state(false),fieldsLoading=$state(true),announcement=$state(''),cancelledSignature=$state<string|null>(null),failed=$state(false),conversion=$state<number|null>(null),pendingFilter=$state<number|undefined>(),samples=$state<Record<number,string[]>>({}),interpretable=$state<Record<number,boolean>>({}),fieldErrors=$state<string[]>([])
 let fieldGeneration=0,fieldRevision:string|undefined,initializedDocument:string|undefined,filterReturn:HTMLElement|null=null,conversionReturn:HTMLElement|null=null
 const columns=$derived((doc.headers??[]).map((name,column)=>({column,name:columnLabel(column),profile:profiles.find(field=>field.column===column)?.profile})))
 const plotData=$derived(data?chartTop(data,options,totals):null)
 const summaryTitle=$derived(options.x<0||options.y===-2?t('charts.fields.emptyTitle'):aggregated?t(options.series!==undefined&&options.series>=0?'charts.fields.titleSplit':'charts.fields.titleResult',{summary:t('charts.aggregate.'+options.aggregate),field:options.y>=0?columnLabel(options.y):t('charts.fields.rowCount'),row:columnLabel(options.x),column:columnLabel(options.series??-1)}):axes.summary)
 const pivot=$derived(data?chartPivot(data,options,totals):null)
 const resultOrder=$derived.by(()=>{
  const direction=t(options.kind!=='heatmap'&&options.descending?'charts.fields.descending':'charts.fields.ascending')
  if(options.kind==='bar'&&!temporal&&(options.series??-1)<0)return{field:axes.y,tie:axes.x,direction}
  return{field:axes.x,tie:options.kind==='heatmap'?axes.y:(options.series??-1)>=0?columnLabel(options.series??-1):'',direction}
 })
 const suggestion=$derived(suggest(columns,options.x<0||options.y===-2?{}:{x:options.x,...options.y>=0?{y:options.y}:{}}))
 const signature=$derived(JSON.stringify([doc.id,doc.revision,options,scope,where,scope==='filtered'?viewSignature:scope==='saved'?savedView:null]))
 let chosenTypeSignature=$state<string|null>(null)
 const startingSuggestion=$derived(initialChart(columns))
 const suggestedTitle=$derived(startingSuggestion?chartLabels(columns.map(column=>column.name),startingSuggestion).summary:'')
 const reason=$derived(chosenTypeSignature===signature&&options.kind!==suggestion.options?.kind&&suggestion.options?t('charts.fields.selectedType',{type:t('charts.kind.'+options.kind),suggested:t('charts.kind.'+suggestion.options.kind)}):t(suggestion.reason.key,{...suggestion.reason.parameters,measure:t('charts.measure.'+options.aggregate),period:t('charts.period.'+(options.time==='none'?'month':options.time??'month'))}))
 const typeIcons={bar:'chart-column',line:'chart-line',scatter:'chart-scatter',histogram:'chart-histogram',heatmap:'chart-heatmap',box:'chart-box'} as const
 async function cancelChart(){cancelledSignature=signature;cancelFields();cancel();message='charts.ui.cancelled';await tick();element?.closest('section')?.querySelector<HTMLButtonElement>('.chart-types button[aria-pressed="true"]')?.focus()}
 function chooseKind(kind:ChartOptions['kind'],userChoice=false){if(kind==='heatmap'){options.y=options.series!==undefined&&options.series>=0?options.series:options.y;options.aggregate='count';options.measureType='text'}options.kind=kind;if(kind==='histogram'||kind==='scatter')options.aggregate='count';if(kind==='box')options.aggregate='median';if(!['bar','line','scatter'].includes(kind))options.series=-1;if(!['bar','line'].includes(kind))options.time='none';if(kind==='line'&&options.time==='none'&&suggestion.options?.kind==='line')options.time=suggestion.options.time??'none';if(kind==='histogram'&&options.y<0&&profiles.some(item=>item.column===options.x&&item.profile?.kind==='number'))options.y=options.x;chosenTypeSignature=userChoice?signature:null}
 const valueLabel=(value:string|null)=>value===null?t('charts.plot.missing'):value===''?t('charts.plot.empty'):value
 function displayNumber(value:string|null){getUILanguage();return value===null?'—':formatChartNumber(Number(value))}
 // shortcut: auto hasta 3.000 filas, 1 MiB y 200.000 celdas; ampliar tras medir más equipos (experiments/analytics-f2a).
 const automatic=$derived(sample===false&&!doc.large&&doc.byteLength!==undefined&&doc.byteLength<=1024*1024&&doc.rowCount!==undefined&&doc.rowCount<=3000&&doc.rowCount*(doc.headers?.length??0)<=200000)
 const tooWide=$derived((doc.headers?.length??0)>200)
 const sql=$derived.by(()=>{try{if(options.y===-2)return '';return chartSQL(doc.headers??[],options)}catch{return ''}})
 function cancel(){if(totalJob){void window.freya.sqlCancel(totalJob).catch(()=>{});totalJob=undefined}totals=[];pivotPage=0;const previous=active;active=undefined;busy=false;data=null;source=null;tablePage=0;hiddenSeries=[];if(previous)void window.freya.sqlCancel(previous).catch(()=>{});if(exportJob){void window.freya.sqlCancel(exportJob).catch(()=>{});exportJob=undefined;exporting=false;cancellingExport=false}}
 $effect(()=>{
  const current=signature,run=ready&&!fieldsLoading&&visible&&automatic&&(!onDemand||started&&!stale)&&current!==cancelledSignature&&!!sql&&!tooWide&&!unavailable
  if(current!==observedSignature){observedSignature=current;untrack(cancel);message=onDemand&&!started?'charts.ui.initial':onDemand&&stale?'charts.ui.changed':automatic?'charts.ui.updating':'charts.ui.changed'}
  if(!visible||unavailable){if(active)untrack(cancel);return}
  if(run&&!untrack(()=>!!data)){const timer=setTimeout(()=>{void generate()},300);return()=>clearTimeout(timer)}
 })
 onDestroy(()=>{cancelFields();cancel()})
 onMount(()=>{
  chart=init(element,undefined,{renderer:'svg'});ready=true
  chart.on('legendselectchanged',event=>{const {selected}=event as {selected:Record<string,boolean>};hiddenSeries=Object.keys(selected).filter(name=>!selected[name])})
  const resize=new ResizeObserver(()=>chart?.resize());resize.observe(element)
  const theme=new MutationObserver(()=>draw());theme.observe(document.documentElement,{attributes:true,attributeFilter:['class']})
  const unsubscribe=window.freya.onEvent(event=>{if(event.type==='analysis'&&event.progress&&(event.progress.requestId===active||event.progress.requestId===totalJob||event.progress.requestId===exportJob))message='charts.ui.prepare';else if(event.id===doc.id&&event.type==='external'){cancel();if(onDemand&&started)stale=true;message='charts.ui.external'}})
  return()=>{resize.disconnect();theme.disconnect();unsubscribe();chart?.dispose();chart=undefined}
 })
 function draw(compact=true){getUILanguage();if(!chart||!data)return;try{const css=getComputedStyle(element);chart.setOption(chartOption(plotData!.data,$state.snapshot(options),{text:css.getPropertyValue('--text').trim(),background:css.getPropertyValue('--panel').trim(),accent:css.getPropertyValue('--accent').trim(),dark:document.documentElement.classList.contains('dark'),compact},(doc.headers??[]).map((_,column)=>columnLabel(column)),scopeLabel,hiddenSeries),{notMerge:true})}catch(error){chart.clear();data=null;message=String(error);onerror(message)}}
 $effect(()=>{if(ready){if(data)draw();else chart?.clear()}})
 async function generate(){
  if(busy||fieldsLoading||exporting||!sql||tooWide||unavailable)return;started=true;stale=false;cancelledSignature=null;cancel();const requestId=crypto.randomUUID();active=requestId;busy=true;failed=false;message='charts.ui.prepare'
  try{
   const first=await window.freya.sqlRun({requestId,sources:[{id:doc.id,revision:doc.revision,...scope!=='all'?{query:$state.snapshot(analysisQuery)}:{},...where.conditions.length?{where:$state.snapshot(where)}:{}}],sql})
   if(active!==requestId)return
   if(first.limited||first.returnedRows>chartLimit(options.kind)+1)throw new Error(t('charts.ui.limitError'))
   const rows=[...first.rows]
   for(let offset=100;offset<first.returnedRows;offset+=100){const page=await window.freya.sqlPage(requestId,offset);if(active!==requestId)return;rows.push(...page.rows)}
   const result=chartData(options.kind,first.columns.map(c=>c.name),rows)
   if(temporal&&result.total>0&&result.points===0)throw new Error(t('charts.ui.dateError'))
   if(result.total>0&&result.usable===0&&options.kind!=='heatmap'&&!(aggregated&&['count','distinct'].includes(options.aggregate)))throw new Error(t('charts.ui.numberError'))
   const totalId=crypto.randomUUID();totalJob=totalId
   const summary=await window.freya.sqlRun({requestId:totalId,sources:[{id:doc.id,revision:doc.revision,...scope!=='all'?{query:$state.snapshot(analysisQuery)}:{},...where.conditions.length?{where:$state.snapshot(where)}:{}}],sql:chartTotalSQL(doc.headers??[],options)})
   if(active!==requestId)return
   const totalRows=[...summary.rows]
   for(let offset=100;offset<summary.returnedRows;offset+=100){const page=await window.freya.sqlPage(totalId,offset);if(active!==requestId)return;totalRows.push(...page.rows)}
   totals=totalRows.map(row=>Object.fromEntries(summary.columns.map((column,index)=>[column.name,row[index]])))
   data=result;source=first.sources[0];message='charts.ui.ready';zoom=1
  }catch(error){if(active===requestId){data=null;failed=true;message=String(error).replace(/^.*Error: /,'');onerror(t('charts.fields.failed'))}}
  finally{if(active===requestId){active=undefined;busy=false;void window.freya.sqlCancel(requestId).catch(()=>{});if(totalJob){void window.freya.sqlCancel(totalJob).catch(()=>{});totalJob=undefined}}}
 }
 async function exportChart(format:'svg'|'png'|'pdf'){
  if(!data||!source||!chart||busy||exporting)return;exporting=true;message='charts.ui.exporting'
  try{let svg:string;try{chart.resize({width:Math.max(640,element.clientWidth),height:Math.max(400,element.clientHeight)});draw(false);svg=chart.renderToSVGString()}finally{chart.resize({width:element.clientWidth,height:element.clientHeight});draw()}const path=await window.freya.exportGraphic(doc.id,{format,svg,revision:source.revision});message=path?t('charts.ui.exported',{path}):t('charts.ui.exportCancelled')}catch(error){message=String(error);onerror(message)}finally{exporting=false}
 }
 async function exportResults(){
  if(!data||!source||busy||exporting)return
  const requestId=crypto.randomUUID();exportJob=requestId;exporting=true;cancellingExport=false;message='charts.ui.exportPreparing'
  try{
   const path=await window.freya.exportChartResult(doc.id,{requestId,revision:source.revision,format:resultFormat,protectFormulas,configuration:{headers:[...(doc.headers??[])],options:$state.snapshot(options),where:$state.snapshot(where),...scope!=='all'?{view:chartView($state.snapshot(analysisQuery))}:{}}})
   if(exportJob===requestId)message=path?t('charts.ui.resultsExported',{path,context:resultFormat==='csv'?t('charts.ui.context'):''}):t('charts.ui.exportCancelled')
  }catch(error){if(exportJob===requestId){message=cancellingExport?t('charts.ui.exportCancelled'):String(error).replace(/^.*Error: /,'');if(!cancellingExport)onerror(message)}}
  finally{if(exportJob===requestId){exportJob=undefined;exporting=false;cancellingExport=false}}
 }
 function cancelResults(){if(!exportJob||cancellingExport)return;cancellingExport=true;message='charts.ui.exportCancelling';void window.freya.sqlCancel(exportJob).catch(error=>onerror(String(error)))}
 function columnLabel(index:number){const headers=doc.headers??[],header=headers[index]||t('charts.fields.emptyHeader',{n:index+1});return headers.filter(value=>value===headers[index]).length>1?`${index+1}. ${header}`:header}

 const resultAnnouncement=$derived(message==='charts.ui.ready'&&data?t('charts.fields.ready',{n:new Set(data.rows.map(row=>row[0])).size}):failed?t('charts.fields.failed'):message.startsWith('charts.ui.')?t(message):message)
 function announce(text:string){announcement=text}
 function cancelFields(){fieldGeneration++;if(fieldJob){void window.freya.cancelAnalysis(fieldJob.id,fieldJob.requestId).catch(()=>{});fieldJob=undefined}fieldsLoading=false}
 async function loadFields(){
  cancelFields();const token=fieldGeneration,id=doc.id,revision=doc.revision;fieldsLoading=true;profiles=[];samples={};interpretable={};fieldErrors=[]
  if(sample===undefined){fieldsLoading=false;return}
  if(!automatic||tooWide){if(initializedDocument!==id){if(!onDemand)options={kind:'bar',x:0,y:-1,bins:10,aggregate:'count',descending:false,measureType:'text',series:-1,time:'none'};initializedDocument=id}fieldsLoading=false;return}
  try{
   for(const column of (doc.headers??[]).map((_,i)=>i).slice(0,200)){
    const requestId=crypto.randomUUID();fieldJob={id,requestId}
    try{
     const result=await window.freya.analyzeColumn(id,{column,revision,requestId,frequencyOffset:0,duplicatesOnly:false,bins:10})
     if(token!==fieldGeneration||id!==doc.id||revision!==doc.revision)return
     profiles=[...profiles,{column,name:(doc.headers??[])[column],profile:result.profile}]
     interpretable[column]=result.numeric>0&&result.excluded===0
     samples[column]=result.frequencies.filter(value=>!value.truncated).slice(0,3).map(value=>value.value)
    }catch(error){if(token!==fieldGeneration)return;fieldErrors=[...fieldErrors,`${columnLabel(column)}: ${String(error).replace(/^.*Error: /,'')}`]}
   }
   if(token!==fieldGeneration)return
   if(initializedDocument!==id){const first=initialChart($state.snapshot(columns));if(first&&!onDemand)options=first;initializedDocument=id}
  }finally{if(token===fieldGeneration){fieldJob=undefined;fieldsLoading=false}}
 }
 $effect(()=>{
  if(!visible){
   // El resumen oculto no debe reemplazar la solicitud de análisis de la tabla.
   if(fieldJob){fieldRevision=undefined;untrack(cancelFields)}
   return
  }
  const revision=JSON.stringify([doc.id,doc.revision,doc.headers,sample])
  if(revision!==fieldRevision){fieldRevision=revision;untrack(()=>void loadFields())}
 })
 function addField(zone:ChartZone,column:number){
  started=true;stale=false
  const previous=zoneFields(options)[zone],name=columnLabel(column)
  const current=$state.snapshot(options)
 if(onDemand&&zone==='rows'&&current.x<0&&current.y===-2)current.y=-1
 options=addToZone(current,zone,column,$state.snapshot(columns))
  announcement=t(previous>=0&&previous!==column?'charts.fields.replaced':'charts.fields.added',{field:name,previous:columnLabel(previous),zone:t('charts.fields.'+zone)})
 }
 function removeField(zone:ChartZone){const previous=zoneFields(options)[zone];options=removeFromZone($state.snapshot(options),zone);announcement=t('charts.fields.removed',{field:previous<0?t('charts.fields.rowCount'):columnLabel(previous),zone:t('charts.fields.'+zone)})}
 function clearFields(){options={...options,kind:'bar',x:-1,y:-2,series:-1,time:'none'};where={conditions:[],filterMode:'all'};failed=false;announcement=t('charts.fields.cleared')}
 function startSuggestion(){const first=startingSuggestion;if(first){started=true;stale=false;options=first;announcement=t('charts.fields.ready',{n:0})}}
 function changeAggregate(aggregate:ChartOptions['aggregate']){if(options.kind==='heatmap')return;if(!aggregated){options.kind='bar';options.time='none'}options.aggregate=aggregate;announcement=t('charts.fields.changed',{operation:t('charts.aggregate.'+aggregate)})}
 function openFilters(column?:number){filterReturn=document.activeElement as HTMLElement;pendingFilter=column;showFilters=true}
 async function closeFilters(){showFilters=false;pendingFilter=undefined;await tick();(filterReturn?.isConnected?filterReturn:filtersButton)?.focus();filterReturn=null}
 async function openConversion(column:number){conversionReturn=document.activeElement as HTMLElement;conversion=column;await tick();element?.closest('section')?.querySelector<HTMLButtonElement>('.conversion-notice button')?.focus()}
 async function closeConversion(){conversion=null;await tick();if(conversionReturn?.isConnected)conversionReturn.focus();else element?.closest('section')?.querySelector<HTMLButtonElement>('.chart-types button[aria-pressed=true]')?.focus();conversionReturn=null}

 function attachExport(node:HTMLElement,host?:HTMLElement){if(!host)return;host.appendChild(node);return{destroy:()=>node.remove()}}
</script>
{#snippet resultExport()}
  <details use:attachExport={exportHost} class:header-export={!!exportHost}><summary>{t(exportHost?'analysis.tab.export':'charts.ui.exportResults')}</summary><div class="result-export-options">
   <p>{t('charts.ui.exportHelp')}</p>
   <div class="actions"><label>{t('charts.ui.resultFormat')} <select aria-label={t('charts.ui.resultFormatLabel')} bind:value={resultFormat} disabled={busy||exporting}><option value="json">{t('charts.ui.exactJson')}</option><option value="csv">{t('charts.ui.csvContext')}</option><option value="md">{t('charts.ui.markdown')}</option></select></label><button {...controlHint(busy||exporting?'busy':null)} disabled={busy||exporting} onclick={()=>void exportResults()}>{t('charts.ui.export')}</button>{#if exportJob}<button {...controlHint(cancellingExport?'cancelPending':null)} disabled={cancellingExport} onclick={cancelResults}>{t('charts.ui.cancelExport')}</button><progress aria-label={t('charts.ui.exportProgress')}></progress>{/if}</div>
   {#if resultFormat==='csv'}<label><input type="checkbox" bind:checked={protectFormulas} disabled={busy||exporting}/>{t('charts.ui.protect')}</label><p>{t('charts.ui.protectHelp')}</p>{/if}
  </div></details>
{/snippet}
<svelte:window onkeydown={event=>{if(event.key==='Escape'&&event.target instanceof HTMLElement&&event.target.closest('.charts-panel')&&!event.target.closest('.query-tools')){event.preventDefault();if(conversion!==null)void closeConversion();else if(window.innerWidth<900&&fieldsOpen){fieldsOpen=false;tick().then(()=>element?.closest('section')?.querySelector<HTMLButtonElement>('.fields-toggle')?.focus())}else onclose()}}}/>
<section class="charts-panel" class:fields-open={fieldsOpen} aria-label={t('charts.ui.region')}>
 <button class="fields-toggle" aria-expanded={fieldsOpen} onclick={()=>fieldsOpen=!fieldsOpen}>{t('charts.fields.panel')}</button>
 <ChartFields {columns} {options} {where} {samples} disabled={exporting||fieldsLoading} loading={fieldsLoading} onadd={addField} onremove={removeField} onaggregate={changeAggregate} ontime={time=>{options.time=time}} onswap={()=>{options=swapZones($state.snapshot(options));announcement=t('charts.fields.swapped')}} onclear={clearFields} onfilter={openFilters} onremovefilter={column=>{where={...where,conditions:where.conditions.filter(rule=>rule.column!==column)};announcement=t('charts.fields.removed',{field:columnLabel(column),zone:t('charts.fields.filters')})}} onannounce={announce} onconvert={openConversion}/>
 <div class="chart-result">
 <div class="chart-intro"><p class="chart-description" aria-label={t('charts.ui.config')} title={summaryTitle}>{summaryTitle}</p>
 <details class="chart-info"><summary aria-label={t('charts.ui.info')}><span aria-hidden="true">ⓘ</span></summary><div class="info-content"><p>{t('charts.ui.source',{name:doc.name})}</p>{#if !automatic}<p>{t('charts.fields.manualTypes')}</p>{/if}{#if fieldErrors.length}<ul>{#each fieldErrors as detail}<li>{detail}</li>{/each}</ul>{/if} <p class="help">{aggregated?(options.aggregate==='count'?t('charts.ui.countHelp'):t('charts.ui.measureHelp')):options.kind==='histogram'?t('charts.ui.histogramHelp'):options.kind==='heatmap'?t('charts.ui.heatmapHelp'):t('charts.ui.compareHelp')}</p>
 <p>{scope==='saved'?t('charts.ui.savedHelp'):scope==='filtered'?t('charts.ui.filteredHelp'):sample===undefined?t('analysis.scope.pending'):sample?t('charts.ui.sampleHelp'):t('charts.ui.allHelp')}</p>
 {#if aggregated&&options.measureType==='number'}<p>{t('charts.ui.numberHelp')}</p>{/if}
 {#if aggregated&&options.aggregate==='distinct'}<p>{t('charts.ui.distinctHelp')}</p>{/if}
 {#if options.series!==undefined&&options.series>=0}<p>{t('charts.ui.seriesHelp')}</p>{/if}
 {#if temporal}<p>{t('charts.ui.datesHelp')} {t(options.kind==='line'?'charts.ui.dateGaps':'charts.ui.dateObserved')}</p>{/if}
 {#if options.kind==='line'&&!temporal}<p>{t('charts.ui.lineHelp')}</p>{:else if options.kind==='box'}<p>{t('charts.ui.boxHelp')}</p>{:else if options.kind==='heatmap'}<p>{t('charts.ui.heatHelp')}</p>{:else if options.kind==='histogram'}<p>{t('charts.ui.binsHelp')}</p>{/if}
<p>{message.startsWith('charts.ui.')?t(message):message}</p>
 {#if data}<p>{scopeLabel} · {t('charts.ui.rowStatus',{total:formatNumber(data.total),usable:formatNumber(data.usable)})} · {t('charts.ui.dataStatus',{total:formatNumber(data.total),usable:formatNumber(data.usable),omitted:formatNumber(data.total-data.usable),drawn:data.rows.length,points:formatNumber(data.points)})}</p>{/if}
 {#if source}<p>{source.name} · {t('charts.ui.revision',{revision:source.revision})}</p>{/if}
 {#if data&&source}<p class="scope">{source.name} · {scopeLabel} · {source.fromDisk?t('charts.ui.disk'):t('charts.ui.revision',{revision:source.revision})} · {t('charts.ui.dataStatus',{total:formatNumber(data.total),usable:formatNumber(data.usable),omitted:formatNumber(data.total-data.usable),drawn:data.rows.length,points:formatNumber(data.points)})}{#if data.invalidDates!==undefined} · {t('charts.ui.invalidDates',{n:data.invalidDates})}{/if}{#if data.seriesCount!==undefined} · {t('charts.ui.seriesCount',{drawn:series.length,total:data.seriesCount})}{/if}.</p>{/if}
 {#if hiddenSeries.length}<p>{plural('charts.ui.hidden',hiddenSeries.length)}</p>{/if}
</div></details></div>
 <p class="result-status" title={scopeLabel}>{#if sample===true}{t('charts.fields.sample')} · {/if}{#if scope!=='all'}{scope==='saved'?t('charts.fields.savedScope'):t('charts.fields.filteredScope')} · {/if}{data?t('charts.fields.status',{n:formatNumber(data.total),g:plotData?.groups??0}):fieldsLoading?t('charts.fields.loading'):busy?t('charts.ui.prepare'):t('charts.fields.unchanged')}</p>
 <p class="sr-only result-announcement" role="status" aria-live="polite" aria-atomic="true">{resultAnnouncement}</p>
 <p class="sr-only analysis-announcement" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
 {#if data?.limited}<p class="truncated notice" role="status">{#if !['bar','heatmap'].includes(options.kind)}{t('charts.ui.partial',{n:formatNumber(chartLimit(options.kind))})}{' '}{/if}{t(['bar','heatmap'].includes(options.kind)?resultOrder.tie?'charts.fields.truncatedTies':'charts.fields.truncated':'charts.ui.truncated',{shown:formatNumber(data.rows.length),total:formatNumber(data.points),...resultOrder})}</p>{/if}

 {#if !automatic||stale}<div class="manual"><button aria-busy={busy} {...controlHint(busy||fieldsLoading||exporting?'busy':tooWide?'columnLimit':unavailable?'fileReady':!sql?'parameters':null)} class="btn-tint" disabled={busy||fieldsLoading||exporting||!sql||tooWide||unavailable} onclick={()=>void generate()}>{#if busy}<span class="button-spinner" aria-hidden="true"></span>{/if}<span class:busy-label={busy} data-loading={t('ui.button.calculating')}>{t('charts.ui.generate')}</span></button><span>{t(stale?'charts.ui.changed':'charts.ui.manual')}</span></div>{/if}
 {#if busy||fieldsLoading}<div class="progress"><button onclick={()=>void cancelChart()}>{t('charts.ui.cancel')}</button><progress aria-label={t('charts.ui.progress')}></progress></div>{/if}
 {#if unavailable}<p role="alert">{t('charts.ui.unavailable')}</p>{/if}
 {#if tooWide}<p role="alert">{t('charts.ui.tooWide')}</p>{/if}
 <div class="chart-types" role="group" aria-label={t('charts.ui.chooseType')}>{#each Object.keys(typeIcons) as kind}<button {...controlHint(exporting?'busy':null)} aria-pressed={options.kind===kind} disabled={exporting} onclick={()=>chooseKind(kind as ChartOptions['kind'],true)}><Icon name={typeIcons[kind as keyof typeof typeIcons]} size={14}/>{kind==='box'?t('charts.ui.boxButton'):t('charts.kind.'+kind)}</button>{/each}</div>
 <p class="suggestion" title={reason}>{reason}</p>
 {#if !busy&&!fieldsLoading&&(!sql||data&&!data.rows.length)}<div class="empty-result"><p>{t('charts.ui.chooseField')}</p><button disabled={onDemand&&!startingSuggestion} onclick={startSuggestion}>{onDemand?t('analysis.tab.createChart',{chart:suggestedTitle}):t('charts.fields.start')}</button></div>{/if}
 {#if failed}<div class="error-result" role="alert"><p>{t('charts.fields.failed')}</p><button onclick={()=>void generate()}>{t('charts.fields.retry')}</button></div>{/if}
 {#if plotData?.top}<p class="top-notice" role="status">{t('charts.fields.top',{n:plotData.groups,other:plotData.other?t('charts.fields.topOther'):''})} <button onclick={()=>{fieldsOpen=true;tick().then(()=>document.querySelector<HTMLInputElement>('.chart-fields input')?.focus())}}>{t('charts.fields.changeRows')}</button></p>{/if}
 <!-- svelte-ignore a11y_no_noninteractive_tabindex (La región ampliada debe admitir desplazamiento con teclado.) -->
 <div class="plot-scroll" role="region" aria-label={t('charts.ui.area')} tabindex="0"><div class="plot" style:width={`${zoom*100}%`} bind:this={element}></div></div>
 {#if pivot&&data?.rows.length}
 <section class="pivot-result" aria-label={t('charts.ui.pivot')}>
  <div class="pivot-heading"><strong>{t('charts.ui.pivot')}</strong><span>{t('charts.ui.groupsShown',{shown:Math.min(pivotSize,pivot.rows.length-pivotPage*pivotSize),total:pivot.rows.length})}</span></div>
  <div class="pivot-scroll"><table aria-label={t('charts.ui.pivot')}><thead><tr><th scope="col">{axes.x}</th>{#if pivot.columns.length}{#each pivot.columns as column}<th scope="col">{valueLabel(column)}</th>{/each}<th scope="col">{t('charts.ui.total')}</th>{:else}<th scope="col">{axes.y}</th>{/if}{#if pivot.additive}<th scope="col">{t('charts.ui.percentTotal')}</th>{/if}</tr></thead>
   <tbody>{#each pivot.rows.slice(pivotPage*pivotSize,(pivotPage+1)*pivotSize) as row}<tr><th scope="row">{valueLabel(row.label)}</th>{#each row.values as value}<td>{displayNumber(value)}</td>{/each}{#if pivot.columns.length}<td>{displayNumber(row.total)}</td>{/if}{#if pivot.additive}<td>{row.percent===null?'—':formatNumber(row.percent/100,{style:'percent',maximumSignificantDigits:3})}</td>{/if}</tr>{/each}</tbody>
   <tfoot><tr><th scope="row">{t(pivot.additive?data.limited?'charts.fields.totalGroups':'charts.ui.total':'charts.fields.recalculated',{n:formatNumber(data.points)})}</th>{#each pivot.totalValues as value}<td>{displayNumber(value)}</td>{/each}{#if pivot.columns.length}<td>{displayNumber(pivot.grandTotal)}</td>{/if}{#if pivot.additive}<td>{pivot.grandTotal===null||Number(pivot.grandTotal)===0?'—':formatNumber(1,{style:'percent',maximumSignificantDigits:3})}</td>{/if}</tr></tfoot></table></div>
  {#if pivot.rows.length>5}<div class="pivot-pages"><label>{t('charts.fields.pageSize')} <select aria-label={t('charts.fields.pageSize')} bind:value={pivotSize} onchange={()=>pivotPage=0}>{#each [5,10,25,50] as size}<option value={size}>{size}</option>{/each}</select></label><button {...controlHint(!pivotPage?'firstPage':null)} disabled={!pivotPage} onclick={()=>pivotPage--}>{t('charts.ui.previous')}</button><span>{t('charts.ui.page',{page:pivotPage+1,total:Math.ceil(pivot.rows.length/pivotSize)})}</span><button {...controlHint((pivotPage+1)*pivotSize>=pivot.rows.length?'lastPage':null)} disabled={(pivotPage+1)*pivotSize>=pivot.rows.length} onclick={()=>pivotPage++}>{t('charts.ui.next')}</button></div>{/if}
 </section>
 {/if}
 <details class="more-options"><summary>{t('charts.ui.more')}</summary><div class="advanced-content">
 {#if data}
  {#if !data.rows.length}<p>{t('charts.ui.empty')}</p>{/if}
  {#if series.length}<details><summary>{t('charts.ui.seriesKeyboard')}</summary><div class="actions">{#each series as group}<label><input type="checkbox" checked={!hiddenSeries.includes(group.name)} onchange={()=>hiddenSeries=hiddenSeries.includes(group.name)?hiddenSeries.filter(name=>name!==group.name):[...hiddenSeries,group.name]}/>{group.name}</label>{/each}</div></details>{/if}
  <div class="actions"><button {...controlHint(zoom<=1?'zoomMin':null)} onclick={()=>zoom=Math.max(1,zoom-0.5)} disabled={zoom<=1}>{t('charts.ui.zoomOut')}</button><button {...controlHint(zoom>=4?'zoomMax':null)} onclick={()=>zoom=Math.min(4,zoom+0.5)} disabled={zoom>=4}>{t('charts.ui.zoomIn')}</button><button onclick={()=>zoom=1}>{t('charts.ui.fit')}</button>{#each ['svg','png','pdf'] as format}<button {...controlHint(busy||exporting?'busy':null)} disabled={busy||exporting} onclick={()=>void exportChart(format as 'svg'|'png'|'pdf')}>{t('charts.ui.exportImage',{format:format.toUpperCase()})}</button>{/each}</div>
 {/if}
 <form onsubmit={event=>{event.preventDefault();void generate()}}>
  <fieldset disabled={exporting}><legend class="sr-only">{t('charts.ui.options')}</legend>
   <label>{t('charts.ui.dataIncluded')} <select aria-label={t('charts.ui.scopeLabel')} bind:value={scope}><option value="all">{t(sample===undefined?'analysis.scope.pending':'charts.ui.all')}</option><option value="filtered" disabled={sample!==false}>{t('charts.ui.filtered')}</option>{#if savedView}<option value="saved" disabled={sample!==false}>{t('charts.ui.saved')}</option>{/if}</select></label>
   <label>{t('charts.ui.type')} <select aria-label={t('charts.ui.typeLabel')} bind:value={options.kind} onchange={event=>chooseKind(event.currentTarget.value as ChartOptions['kind'])}>{#each Object.entries(chartKinds) as [kind,title]}<option value={kind}>{t('charts.kind.'+kind)}</option>{/each}</select></label>
   {#if ['bar','line'].includes(options.kind)}<label>{t('charts.ui.groupDates')} <select aria-label={t('charts.ui.groupDatesLabel')} bind:value={options.time}>{#each Object.entries(chartTimeGroups) as [unit,title]}<option value={unit}>{t('charts.time.'+unit)}</option>{/each}</select></label>{/if}
   {#if options.kind!=='histogram'}<label>{temporal?t('charts.ui.xDate'):options.kind==='line'||options.kind==='scatter'?t('charts.ui.xNumber'):t('charts.ui.xCategory')} <select aria-label={t('charts.ui.xLabel')} bind:value={options.x}>{#each doc.headers??[] as header,index}<option value={index}>{columnLabel(index)}</option>{/each}</select></label>{/if}
   <label>{options.kind==='heatmap'?t('charts.ui.yCategory'):aggregated?t('charts.ui.yValue'):t('charts.ui.yNumber')} <select aria-label={t('charts.ui.yLabel')} value={options.y} onchange={event=>{const next=Number(event.currentTarget.value);if(aggregated&&options.y>=0&&next!==options.y){options.measureType='text';options.aggregate='count'}options.y=next}}><option value={-1} disabled>{t('charts.ui.choose')}</option>{#each doc.headers??[] as header,index}<option value={index}>{columnLabel(index)}</option>{/each}</select></label>
   {#if options.kind==='histogram'}<label>{t('charts.ui.bins')} <input aria-label={t('charts.ui.binsLabel')} type="number" min="1" max="30" bind:value={options.bins}/></label>{/if}
   {#if aggregated}
    <label>{t('charts.ui.measure')} <select aria-label={t('charts.ui.measureLabel')} bind:value={options.measureType} onchange={event=>{if(event.currentTarget.value==='text'&&!['count','distinct'].includes(options.aggregate))options.aggregate='count'}}><option value="text">{t('charts.ui.text')}</option><option value="number">{t('charts.ui.number')}</option></select></label>
    <label>{t('charts.ui.aggregate')} <select aria-label={t('charts.ui.aggregateLabel')} bind:value={options.aggregate}>{#each Object.entries(chartAggregates) as [operation,title]}<option value={operation} disabled={options.measureType==='text'&&!['count','distinct'].includes(operation)}>{t('charts.aggregate.'+operation)}</option>{/each}</select></label>
   {/if}
   {#if ['bar','line','scatter'].includes(options.kind)}<label>{t('charts.ui.series')} <select aria-label={t('charts.ui.seriesLabel')} bind:value={options.series}><option value={-1}>{t('charts.ui.noSeries')}</option>{#each doc.headers??[] as header,index}<option value={index}>{columnLabel(index)}</option>{/each}</select></label>{/if}
   {#if ['bar','line','scatter'].includes(options.kind)}<label>{t('charts.ui.order')} <select aria-label={t('charts.ui.orderLabel')} bind:value={options.descending}><option value={false}>{temporal?t('charts.ui.oldest'):options.kind==='bar'?(options.series!==undefined&&options.series>=0?t('charts.ui.az'):t('charts.ui.lowFirst')):t('charts.ui.lowX')}</option><option value={true}>{temporal?t('charts.ui.newest'):options.kind==='bar'?(options.series!==undefined&&options.series>=0?t('charts.ui.za'):t('charts.ui.highFirst')):t('charts.ui.highX')}</option></select></label>{/if}
   <button {...controlHint(exporting?'busy':null)} type="button" aria-label={t('charts.ui.filters')} aria-expanded={showFilters} bind:this={filtersButton} onclick={()=>{pendingFilter=undefined;showFilters=!showFilters}}>{t('charts.ui.filters')}{where.conditions.length?` (${where.conditions.length})`:''}</button>
   {#if where.conditions.length}<button {...controlHint(exporting?'busy':null)} type="button" onclick={()=>{where={conditions:[],filterMode:'all'};showFilters=false;filtersButton?.focus()}}>{t('charts.ui.clearFilters')}</button>{/if}
   {#if automatic}<button aria-busy={busy} {...controlHint(busy||exporting?'busy':tooWide?'columnLimit':unavailable?'fileReady':!sql?'parameters':null)} class="btn-tint" type="submit" disabled={busy||!sql||tooWide||unavailable}>{#if busy}<span class="button-spinner" aria-hidden="true"></span>{/if}<span class:busy-label={busy} data-loading={t('ui.button.calculating')}>{t('charts.ui.generate')}</span></button>{/if}
  </fieldset>

 </form>
 <ChartPresets docId={doc.id} headers={doc.headers??[]} readonly={sample===true} disabled={exporting||fieldsLoading||sample===undefined} canSave={!!sql&&!tooWide&&!unavailable} configuration={{headers:doc.headers??[],options,where,...scope!=='all'?{view:chartView(analysisQuery)}:{}}} onapply={(configuration:ChartConfiguration)=>{started=true;stale=false;options=configuration.options;where=configuration.where;savedView=configuration.view;scope=configuration.view?'saved':'all';showFilters=false}}/>
 {#if scope==='saved'&&savedView}<details><summary>{t('charts.ui.recovered')}</summary><p>{t('charts.ui.recoveredHelp')}</p><pre>{savedView.search?`${t('charts.ui.search',{query:savedView.search})}\n`:''}{Object.entries(savedView.filters??{}).map(([column,value])=>`${Number(column)+1}. ${(doc.headers??[])[Number(column)]}: ${JSON.stringify(value)}`).join('\n')}{'\n'}{describeConditions(doc.headers??[],{conditions:savedView.conditions??[],filterMode:savedView.filterMode??'all'})}</pre></details>{/if}

 {#if where.conditions.length}<details><summary>{t('charts.ui.applied')}</summary><pre>{describeConditions(doc.headers??[],where)}</pre><p>{t('charts.ui.appliedHelp')}</p></details>{/if}
 <p class="scope">{axes.summary} · {scopeLabel}. {t('charts.ui.axes',{x:axes.x,y:axes.y})}</p>


 {#if data}
  {@render resultExport()}
  {#if sample===true}<p>{t('charts.ui.sampleExport')}</p>{/if}
  <details><summary>{t('charts.ui.table')}</summary><div class="table-scroll"><table><caption>{t('charts.ui.caption',{kind:t('charts.kind.'+options.kind)})}</caption><thead><tr>{#each data.columns as name}<th scope="col">{t('charts.head.'+name)}</th>{/each}</tr></thead><tbody>{#each data.rows.slice(tablePage*50,(tablePage+1)*50) as row}<tr>{#each row as value}<td>{value===null?'—':value===''?t('charts.plot.empty'):value}</td>{/each}</tr>{/each}</tbody></table></div><div class="actions"><button {...controlHint(tablePage===0?'firstPage':null)} disabled={tablePage===0} onclick={()=>tablePage--}>{t('charts.ui.previous')}</button><span>{t('charts.ui.page',{page:tablePage+1,total:Math.max(1,Math.ceil(data.rows.length/50))})}</span><button {...controlHint((tablePage+1)*50>=data.rows.length?'lastPage':null)} disabled={(tablePage+1)*50>=data.rows.length} onclick={()=>tablePage++}>{t('charts.ui.next')}</button></div></details>
 {/if}
 <details><summary>{t('charts.ui.viewQuery')}</summary><p>{t('charts.ui.precisionHelp')}</p><pre>{sql}</pre></details>
 </div></details>
 </div>
 {#if showFilters}<div class="filters-overlay"><CsvQueryTools filtersOnly headers={doc.headers??[]} initialConditions={pendingFilter===undefined?where.conditions:[...where.conditions,{column:pendingFilter,op:'contains',value:''}]} initialOrder={[]} initialMode={where.filterMode} onapply={(conditions,_order,filterMode)=>{where={conditions,filterMode};if(pendingFilter!==undefined)announcement=t('charts.fields.added',{field:columnLabel(pendingFilter),zone:t('charts.fields.filters')});closeFilters()}} onclose={closeFilters}/></div>{/if}
 {#if conversion!==null}<div class="conversion-notice" role="region" aria-label={t('charts.fields.conversion')}><p>{t(interpretable[conversion]?'charts.fields.explicit':'charts.fields.symbols')}</p>{#if interpretable[conversion]}<button onclick={()=>{options={...options,kind:'bar',y:conversion!,measureType:'number',aggregate:'sum',time:'none'};void closeConversion()}}>{t('charts.fields.explicit')}</button>{/if}<button onclick={()=>void closeConversion()}>{t('charts.fields.close')}</button></div>{/if}
</section>
<style>
 .header-export .result-export-options{position:absolute;right:0;top:calc(100% + 6px);z-index:4;width:min(390px,75vw);padding:12px;background:var(--panel);border:1px solid var(--border);border-radius:var(--radius-control);box-shadow:0 8px 20px #0003}.header-export summary{cursor:pointer}
 .charts-panel{padding:10px 14px;border-bottom:1px solid var(--border);background:var(--panel);font-size:12px;height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;flex:1}.actions,fieldset{display:flex;align-items:center;gap:8px;flex-wrap:wrap}p{color:var(--text);line-height:1.5;margin:8px 0}fieldset{border:0;padding:0;margin:8px 0}label{display:flex;align-items:center;gap:6px}select{max-width:180px}input{width:60px}input[type=checkbox]{width:auto}select,input,button{font:inherit;color:var(--text);background:var(--input);border:1px solid var(--border);padding:5px 8px;border-radius:var(--radius-control)}button.btn-tint{background:var(--text);color:var(--panel)}button:disabled{opacity:.5}button:focus-visible,select:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.plot-scroll{position:relative;flex:1;min-height:160px;overflow:auto;border:1px solid var(--border);border-radius:6px}.plot{overflow:hidden;position:absolute;inset:0;height:100%;min-width:0}.actions{margin:8px 0}.scope{font-weight:600}.notice{border-left:3px solid var(--accent);padding-left:8px}summary{cursor:pointer;margin:8px 0}.table-scroll{max-height:180px;overflow:auto}table{border-collapse:collapse;width:100%}td,th{padding:6px;border:1px solid var(--border);text-align:left;overflow-wrap:anywhere;max-width:280px}caption{padding:6px;text-align:left;color:var(--muted)}pre{white-space:pre-wrap;overflow-wrap:anywhere}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
 .chart-intro{display:flex;align-items:center;gap:8px}.chart-description{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;font-size:13px;font-weight:600;color:var(--text)}.chart-info{position:relative}.chart-info summary{display:flex;padding:6px}.chart-info .info-content{position:absolute;max-height:55vh;overflow:auto;right:0;top:100%;width:260px;padding:12px;background:var(--panel);border:1px solid var(--border);z-index:3}.more-options{flex:0 1 auto;min-height:0;overflow:auto}.advanced-content{padding-bottom:8px}.manual,.progress{display:flex;align-items:center;gap:8px;margin-bottom:8px}.actions{flex-shrink:0} .chart-info summary:focus-visible{outline:2px solid var(--accent)}
 .chart-types{display:flex;gap:5px;flex-wrap:wrap}.chart-types button{display:flex;align-items:center;gap:5px;min-height:28px}.chart-types button[aria-pressed=true]{background:var(--text);color:var(--panel);border-color:var(--text)}.suggestion{flex-shrink:0;min-height:17px;line-height:17px;margin:5px 0;font-size:11px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.empty-result{padding:8px;margin:0}.pivot-result{flex:0 1 auto;max-height:240px;min-height:0;display:flex;flex-direction:column;margin-top:8px}.pivot-heading{display:flex;justify-content:space-between;gap:8px;font-size:11px;margin-bottom:4px}.pivot-scroll{min-height:0;overflow:auto}.pivot-result table{font-size:11px;font-variant-numeric:tabular-nums}.pivot-result td,.pivot-result th{padding:5px 8px;border-left:0;border-right:0;text-align:right}.pivot-result th:first-child{text-align:left}.pivot-result tfoot{font-weight:700;background:var(--hover);position:sticky;bottom:0}.pivot-pages{display:flex;gap:8px;align-items:center;justify-content:flex-end;padding-top:4px;font-size:11px}.pivot-pages button{padding:3px 7px}.more-options{margin-top:3px}.chart-intro p{margin:4px 0}.chart-types button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
 @media(max-height:760px){.charts-panel{padding:6px 12px}.chart-types button{padding:4px 7px}.pivot-result{max-height:210px;margin-top:5px}.pivot-result td,.pivot-result th{padding:4px 7px}.suggestion{margin:4px 0}.chart-description{font-size:12px}.more-options summary{margin:5px 0}}
 @media(max-width:899px){.charts-panel{padding:7px 10px}.chart-types{gap:3px}.chart-types button{font-size:11px}.suggestion{white-space:normal;max-height:30px}.plot-scroll{min-height:150px}}
 .charts-panel{display:grid;grid-template-areas:"result fields";grid-template-columns:minmax(0,1fr) 280px;padding:0;position:relative;gap:0}.chart-result{grid-area:result;display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden;padding:10px 14px}.fields-toggle{display:none}.result-status{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:3px 0 7px;min-height:17px}.plot-scroll{min-height:170px;max-height:300px}.chart-types{flex-shrink:0}.chart-types button{font-size:11px;padding:4px 5px}.chart-info{z-index:4}.chart-description{margin:3px 0}.truncated,.top-notice{font-size:var(--font-meta);line-height:1.3;margin:3px 0;flex-shrink:0}.top-notice button{border:0;background:transparent;text-decoration:underline;padding:2px;min-height:24px;font-size:var(--font-meta)}.pivot-pages{flex-shrink:0;flex-wrap:wrap;gap:4px;justify-content:space-between}.pivot-pages label{font-size:var(--font-meta)}.pivot-pages button,.pivot-pages select{min-height:24px}.pivot-result{max-height:240px;flex-shrink:0}.more-options{flex:0 1 auto}.filters-overlay{position:absolute;inset:25px 20px auto;z-index:10;border:1px solid var(--border);box-shadow:var(--shadow-float)}.conversion-notice{position:absolute;z-index:10;inset:25px 20px auto;background:var(--panel);border:1px solid var(--border);padding:15px}.empty-result p,.error-result p{margin:4px 0}.chart-result .chart-types button{min-height:28px}
 @media(min-width:900px) and (max-width:1099px){.charts-panel{grid-template-columns:minmax(0,1fr) 240px}}
 @media(max-height:760px){.chart-result{padding:6px 10px}.chart-types{gap:3px}.chart-types button{font-size:var(--font-meta);padding:3px}.pivot-result{max-height:220px}.chart-info summary{padding:4px}.suggestion{margin:3px 0}.pivot-pages{padding-top:2px}}
 @media(max-width:899px){.charts-panel{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);grid-template-areas:"toggle" "result"}.fields-toggle{grid-area:toggle;display:block;justify-self:start;margin:5px 10px;min-height:28px}.charts-panel :global(.chart-fields){display:none}.charts-panel.fields-open{grid-template-rows:auto auto minmax(0,1fr);grid-template-areas:"toggle" "fields" "result"}.charts-panel.fields-open :global(.chart-fields){display:block}.chart-result{padding:4px 10px}.suggestion{white-space:nowrap;max-height:18px}}
 button,input,select{appearance:none;border-color:var(--muted)}
</style>
