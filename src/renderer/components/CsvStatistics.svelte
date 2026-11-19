<script lang="ts">
 import {t,formatNumber} from '../lib/i18n.svelte'
 import {csvAnalysisSample} from '../lib/csv-analysis-view'
 import {controlHint} from '../lib/control-hint'
 import Icon from './Icon.svelte'
 import {onDestroy,onMount,tick,untrack} from 'svelte'
 import {STATISTICS_FIELDS,NUMERIC_DETAIL_FIELDS,statisticsReport,type ReportContext,type StatisticsRow} from '../lib/statistics-report'
 import CsvColumnAnalysis from './CsvColumnAnalysis.svelte'
 import CsvColumnsOverview from './CsvColumnsOverview.svelte'
 import type {CsvEmptyIntent} from '../lib/csv-analysis-view'
 import CsvDescribe from './CsvDescribe.svelte'
 import type {AnalysisStatistics} from '../lib/workspace-tabs'
 import type {DocumentInfo,TableQuery,TableRange,TableViewMeta} from '../../shared/types'
 let {doc,autofocus=true,embedded=false,inspection,entry,columns,range,query,queryValid,viewMeta,onclose,onerror,onreport,onempty}:{doc:DocumentInfo;autofocus?:boolean;embedded?:boolean;inspection?:{column:number;scope:'all'|'view'};entry?:AnalysisStatistics;columns:number[];range:TableRange|null;query:TableQuery;queryValid:boolean;viewMeta:TableViewMeta;onclose:()=>void;onerror:(message:string)=>void;onreport:(markdown:string)=>Promise<void>;onempty:(intent:CsvEmptyIntent)=>void}=$props()
 const titleId=$derived(embedded?'analysis-statistics-'+doc.id:'csv-statistics-title')
 $effect(()=>{if(inspection){explorationColumn=inspection.column;explorationScope=inspection.scope;exploring=true}})
 let exploring=$state(false),overviewing=$state(false),advancedOpen=$state(false),explorationColumn=$state(0),explorationScope=$state<'all'|'view'>('all')
 $effect(()=>{if(inspection)advancedOpen=true})
 $effect(()=>{if(entry){untrack(()=>describeView?.cancelPending());scope=entry.scope;exploring=false;overviewing=false;advancedOpen=true}})
 let describeView:CsvDescribe,describeBusy=$state(false)
 let scope=$state('all'),busy=$state(false),results=$state<StatisticsRow[]>([]),numericDetails=$state(false)
 let message=$state('statistics.idle'),progressRows=$state(0),revision=$state(-1),total=$state(0),analyzedScope=$state(''),heading:HTMLHeadingElement
 let reportContext=$state<ReportContext|null>(null),reporting=$state(false)
 let request=0,active:string|undefined
 const sample=$derived(csvAnalysisSample(doc,viewMeta))
 const usingRange=$derived(scope==='range'||scope==='rangeColumns')
 const fields=$derived([...STATISTICS_FIELDS,...(numericDetails?NUMERIC_DETAIL_FIELDS:[])].map(([key])=>[key,t('statistics.field.'+key)] as const))
 const scopeKey=$derived(JSON.stringify([scope,scope==='selected'?columns:null,usingRange?range:null,usingRange?queryValid:null]))
 onMount(()=>{if(autofocus)heading.focus();return window.freya.onEvent(event=>{if(event.type==='analysis'&&event.progress&&event.progress.requestId===active){progressRows=event.progress.rows;message='statistics.progress'}})})
 onDestroy(cancel)
 function cancel(){request++;if(active)void window.freya.cancelAnalysis(doc.id,active).catch(()=>{});active=undefined;busy=false;results=[];reportContext=null;message='statistics.cancelled'}
 $effect(()=>{void scopeKey;cancel();revision=-1;message='statistics.scopeChanged'})
 $effect(()=>{if(revision>=0&&doc.revision!==revision){cancel();revision=-1;message='statistics.dataChanged'}})
 $effect(()=>{if((exploring||overviewing)&&busy)cancel()})
 async function inspectColumn(column:number,scope:'all'|'view'){explorationColumn=column;explorationScope=scope;overviewing=false;exploring=true;await tick();heading.focus()}
 async function analyze(){
  if(usingRange&&(!range||!queryValid)){onerror(t('statistics.error.range'));return}
  const captured=usingRange&&range?structuredClone($state.snapshot(range)):undefined
  const selected=scope==='range'?[-1]:scope==='rangeColumns'&&captured?Array.from({length:captured.right-captured.left+1},(_,i)=>captured.left+i):scope==='all'?(doc.headers??[]).map((_,index)=>index):$state.snapshot(columns)
  if(!selected.length){onerror(t('statistics.error.selection'));return}
  // shortcut: hasta 100 resultados por consulta visual; virtualizar el panel antes de ampliar este límite.
  if(selected.length>100){onerror(t('statistics.error.limit'));return}
  cancel();const ticket=request,current=doc.revision,id=doc.id,headers=[...doc.headers??[]]
  revision=current;analyzedScope=captured?t('statistics.scope.range',{firstRow:captured.top+1,lastRow:captured.bottom+1,firstColumn:captured.left+1,lastColumn:captured.right+1}):t(scope==='all'?'statistics.scope.all':'statistics.scope.selected');total=selected.length;results=[];busy=true;message='statistics.calculating'
  const context:Omit<ReportContext,'sample'>={source:doc.name,revision:current,dirty:doc.dirty,scope:analyzedScope,analyzedAt:new Date().toISOString(),query:captured?.query}
  try{
   for(const index of selected){
    const requestId=crypto.randomUUID();active=requestId
    const stats=await window.freya.stats(id,null,index<0?[]:[index],{requestId,revision:current,range:captured})
    if(ticket!==request)return
    if(doc.revision!==current||stats.revision!==current){cancel();message='statistics.changedDuring';return}
    active=undefined;results=[...results,{...stats,index,name:index<0?t('statistics.rangeCells'):headers[index]||t('describe.column',{index:index+1})}]
   }
   reportContext={...context,sample:results[0].sample};message='statistics.complete'
  }catch(error){if(ticket===request){results=[];message='statistics.error';onerror(String(error))}}
  finally{if(ticket===request){active=undefined;busy=false}}
 }
 async function report(){if(!reportContext||busy||reporting||doc.revision!==revision)return;const text=statisticsReport($state.snapshot(reportContext),$state.snapshot(results));reporting=true;try{await onreport(text)}catch(error){onerror(String(error))}finally{reporting=false}}
 function number(value:number|null){return value===null?'—':formatNumber(value,{maximumFractionDigits:2})}
</script>
<svelte:window onkeydown={event=>{if(!embedded&&event.key==='Escape'&&event.target instanceof HTMLElement&&event.target.closest('.statistics-panel')){event.preventDefault();event.stopPropagation();onclose()}}}/>
<section class="statistics-panel" aria-label={t('describe.workspace')}>
 <div class="statistics-heading"><h3 id={titleId} tabindex="-1" bind:this={heading}>{t('statistics.heading')}</h3>{#if !embedded}<button title={t('statistics.close')} aria-label={t('statistics.close')} onclick={onclose}><Icon name="x" size={14}/></button>{/if}</div>
 <div class="describe-host" hidden={usingRange||exploring||overviewing}><CsvDescribe bind:this={describeView} bind:busy={describeBusy} blocked={busy} shown={!usingRange&&!exploring&&!overviewing} {doc} {columns} {query} {queryValid} {viewMeta} {onerror} {onreport}/></div>
 <details class="advanced-statistics" bind:open={advancedOpen}><summary>{t('describe.advanced')}</summary>
 <section class="legacy-statistics" aria-labelledby={titleId}>
 {#if !exploring&&!overviewing}
 <p>{sample===undefined?t('analysis.scope.pending'):sample?t('statistics.sample'):usingRange?t('statistics.scope.rangeHelp'):t('statistics.scope.allHelp')}</p>
 <form onsubmit={event=>{event.preventDefault();void analyze()}}>
  <label>{t('statistics.columns')} <select aria-label={t('statistics.scopeLabel')} bind:value={scope} disabled={busy}><option value="all">{t('statistics.scope.all')}</option><option value="selected" disabled={!columns.length}>{t('statistics.scope.marked')}</option><option value="range" disabled={!range||!queryValid}>{t('statistics.scope.cells')}</option><option value="rangeColumns" disabled={!range||!queryValid}>{t('statistics.scope.byColumn')}</option></select></label>
  <button aria-busy={busy} {...controlHint(busy||describeBusy?'busy':usingRange&&(!range||!queryValid)?'selection':null)} class="btn-tint" type="submit" disabled={busy||describeBusy||usingRange&&(!range||!queryValid)}>{#if busy}<span class="button-spinner" aria-hidden="true"></span>{/if}<span class:busy-label={busy} data-loading={t('ui.button.calculating')}>{t('statistics.analyze')}</span></button>
  {#if busy}<button class="btn-ghost" type="button" onclick={cancel}>{t('statistics.cancel')}</button><progress aria-label={t('statistics.progressLabel')} value={results.length} max={total}></progress>{/if}
  <span role="status" aria-live="polite" class:sr-only={['statistics.idle','statistics.scopeChanged','statistics.complete'].includes(message)}>{t(message,{rows:formatNumber(progressRows)})}{busy?' '+t('statistics.columnsDone',{done:formatNumber(results.length),total:formatNumber(total)}):''}</span>
  <button {...controlHint(busy||reporting?'busy':!reportContext?'result':doc.revision!==revision?'refresh':null)} type="button" disabled={!reportContext||busy||reporting||doc.revision!==revision} onclick={report}>{t('describe.detailedReport')}</button>
 </form>
 <label><input type="checkbox" bind:checked={numericDetails}/>{t('statistics.numericDetails')}</label>
 {#if numericDetails}<p>{t('statistics.numericHelp')}</p>{/if}
 {#if results.length||usingRange}<div class="statistics-scroll" class:reserved={usingRange} role="region" aria-label={t('statistics.results')}>{#if results.length}<table>
  <caption>{analyzedScope}{results[0]?.sample?' · '+t('statistics.sampleLimited'):''}</caption>
  <thead><tr>{#each [t('statistics.column'),...fields.map(([,label])=>label)] as title}<th scope="col">{title}</th>{/each}</tr></thead>
  <tbody>{#each results as result (result.index)}<tr><th scope="row">{result.index<0?'':`${result.index+1}. `}{result.name}</th>{#each fields as [key]}<td title={result[key]===null?'':String(result[key])}>{number(result[key])}</td>{/each}</tr>{/each}</tbody>
 </table>{:else}<p>{t('statistics.rangeEmpty')}</p>{/if}</div>{/if}
 {/if}
 {#if !overviewing}<details bind:open={exploring}><summary>{t(exploring?'statistics.back':'statistics.explore')}</summary>{#if exploring}<CsvColumnAnalysis {doc} {query} {queryValid} {viewMeta} {onerror} {onreport} bind:column={explorationColumn} bind:scope={explorationScope}/>{/if}</details>{/if}
 {#if !embedded&&!exploring}<details bind:open={overviewing}><summary>{t(overviewing?'statistics.back':'statistics.overview')}</summary>{#if overviewing}<CsvColumnsOverview {doc} {columns} {query} {queryValid} {viewMeta} {onerror} {onreport} {onempty} oninspect={inspectColumn}/>{/if}</details>{/if}
 {#if !exploring&&!overviewing}<details><summary>{t('statistics.how')}</summary>{#if revision>=0}<p>{t('describe.revision',{revision})}</p>{/if}<p class="statistics-note">{t('statistics.note')}</p></details>{/if}
 </section></details>
</section>
<style>
 .statistics-panel{border-bottom:1px solid var(--border);background:var(--panel);padding:10px 12px;font-size:11px;max-height:310px;overflow:auto;flex-shrink:0}
 .statistics-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.statistics-heading h3{margin:0;font-size:12px}.statistics-heading button{border:0;background:transparent;font-size:18px;padding:0 6px}
 p{margin:6px 0;color:var(--muted);line-height:1.5}form{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0}label{display:flex;gap:6px;align-items:center}select,button{font-size:11px;color:var(--text);background:var(--input);border:1px solid var(--border);border-radius:var(--radius-control);padding:5px 8px}button{appearance:none}button.primary{color:white}button:disabled{opacity:.5}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}progress{width:90px}form span{color:var(--muted)}
 .statistics-scroll.reserved{height:140px}.statistics-scroll{overflow:auto;max-height:140px;border:1px solid var(--border);border-radius:var(--radius-control)}table{border-collapse:collapse;width:max-content;white-space:nowrap;font-size:11px}caption{text-align:left;padding:6px;color:var(--muted)}th,td{padding:6px 9px;border-bottom:1px solid var(--border);text-align:right}th:first-child{text-align:left;position:sticky;left:0;z-index:1;background:var(--panel)}thead th:first-child{z-index:3}thead th{position:sticky;top:0;background:var(--panel)}.statistics-note{font-size:var(--font-meta)}
</style>
