<script lang="ts">
 import {onDestroy,untrack} from 'svelte'
 import {t,formatNumber} from '../lib/i18n.svelte'
 import {csvAnalysisSample,csvAnalysisQueryReady,csvAnalysisQueryKey} from '../lib/csv-analysis-view'
 import {describeTable,type DescribeEntry} from '../lib/describe-table'
 import {describeReport,type ReportContext} from '../lib/statistics-report'
 import {controlHint} from '../lib/control-hint'
 import type {DocumentInfo,TableQuery,TableViewMeta,ColumnAnalysisRequest,TableStatsOptions} from '../../shared/types'
 let {doc,columns,query,queryValid,viewMeta,onerror,onreport,busy=$bindable(false),blocked=false,shown=true}:{doc:DocumentInfo;columns:number[];query:TableQuery;queryValid:boolean;viewMeta:TableViewMeta;onerror:(message:string)=>void;onreport:(markdown:string)=>Promise<void>;busy?:boolean;blocked?:boolean;shown?:boolean}=$props()
 let scope=$state<'all'|'view'|'selected'>('all'),analyzedScope=$state<'all'|'view'|'selected'>('all'),includeText=$state(false),reporting=$state(false),entries=$state<DescribeEntry[]>([]),total=$state(0),status=$state('describe.idle'),context=$state<ReportContext|null>(null)
 let generation=0,active:{id:string;requestId:string}|undefined
 const sample=$derived(csvAnalysisSample(doc,viewMeta))
 const ready=$derived(sample!==undefined&&!doc.large&&(scope!=='view'||queryValid&&csvAnalysisQueryReady(doc,query,viewMeta)))
 const signature=$derived(JSON.stringify([doc.id,doc.revision,scope,includeText,scope==='selected'?columns:null,scope==='view'?csvAnalysisQueryKey(query):null,scope==='view'?ready:null]))
 const matrix=$derived(describeTable(entries,includeText))
 function cancel(){generation++;if(active)void window.freya.cancelAnalysis(active.id,active.requestId).catch(()=>{});active=undefined;busy=false;entries=[];context=null}
 export function cancelPending(){if(busy){cancel();status='describe.cancelled'}}
 onDestroy(cancel)
 $effect(()=>{void signature;untrack(()=>{cancel();status='describe.changed'})})
 $effect(()=>{if(!shown)untrack(cancelPending)})
 async function calculate(){
  if(!ready||blocked||!shown)return
  const selected=scope==='selected'?[...new Set($state.snapshot(columns))].sort((a,b)=>a-b):(doc.headers??[]).map((_,index)=>index)
  if(!selected.length){onerror(t('describe.error.selection'));return}
  if(selected.length>100){onerror(t('describe.error.limit'));return}
  cancel();const ticket=generation,id=doc.id,revision=doc.revision,headers=[...doc.headers??[]],capturedSample=sample!,capturedScope=scope,capturedQuery=scope==='view'?$state.snapshot(query):undefined,capturedText=includeText,matched=capturedQuery?viewMeta.matched:doc.rowCount
  if(matched===undefined||!Number.isSafeInteger(matched)||matched<0){onerror(t('describe.error.ready'));return}
  const current=()=>ticket===generation&&doc.id===id&&doc.revision===revision
  const captured:ReportContext={source:doc.name,revision,sample:capturedSample,dirty:doc.dirty,scope:t('describe.scope.'+capturedScope),analyzedAt:new Date().toISOString(),query:capturedQuery}
  total=selected.length;busy=true;status='describe.progress'
  try{
   for(const column of selected){
    const request:ColumnAnalysisRequest={column,revision,requestId:crypto.randomUUID(),frequencyOffset:0,duplicatesOnly:false,bins:10,query:capturedQuery}
    active={id,requestId:request.requestId}
    const {profile}=await window.freya.analyzeColumn(id,{...request,profileOnly:true})
    if(!current())return
    const entry:DescribeEntry={index:column,name:headers[column]??'',profile}
    if(profile.kind==='number'){
     const options:TableStatsOptions={revision,requestId:crypto.randomUUID(),...(capturedQuery&&matched>0?{range:{top:0,bottom:matched-1,left:column,right:column,revision,query:capturedQuery}}:{})}
     active={id,requestId:options.requestId}
     const stats=await window.freya.stats(id,capturedQuery&&matched===0?[]:null,[column],options)
     if(!current())return
     if(stats.revision!==revision||stats.sample!==capturedSample||stats.cells!==matched)throw new Error(t('describe.error.changed'))
     entry.stats=stats
    }else if(capturedText&&profile.kind!=='empty'){
     request.requestId=crypto.randomUUID();active={id,requestId:request.requestId}
     try{
      const result=await window.freya.analyzeColumn(id,request)
      if(!current())return
      if(result.revision!==revision||result.sample!==capturedSample||result.cells!==matched||result.profile.kind!==profile.kind)throw new Error(t('describe.error.changed'))
      entry.description=result.describe
     }catch(error){
      if(!current())return
      // shortcut: mismo límite por mensaje del motor; migrar a un código estable antes de traducir el backend.
      if(!String(error).includes('100 000 valores distintos'))throw error
      entry.unavailable=true
     }
    }
    active=undefined;entries=[...entries,entry]
   }
   if(current()){analyzedScope=capturedScope;context=captured;status=entries.some(entry=>entry.unavailable)?'describe.partial':'describe.complete'}
  }catch(error){if(current()){entries=[];context=null;status='describe.error';onerror(String(error))}}
  finally{if(current()){active=undefined;busy=false}}
 }
 async function report(){if(!context||busy||reporting||doc.revision!==context.revision)return;reporting=true;try{await onreport(describeReport({...$state.snapshot(context),scope:t('describe.scope.'+analyzedScope)},$state.snapshot(entries),includeText))}catch(error){onerror(String(error))}finally{reporting=false}}
 const full=(value:string|number|null)=>value===null?'':String(value)
</script>

<section class="describe-panel" aria-label={t('describe.title')}>
 <form onsubmit={event=>{event.preventDefault();void calculate()}}>
  <label>{t('describe.rows')}<select bind:value={scope} aria-label={t('describe.scopeLabel')} disabled={busy}>{#each ['all','view','selected'] as value}<option value={value} disabled={value==='selected'&&!columns.length}>{t('describe.scope.'+value)}</option>{/each}</select></label>
  <label><input type="checkbox" bind:checked={includeText} disabled={busy}/>{t('describe.includeText')}</label>
  <button type="submit" class="btn-tint" aria-busy={busy} disabled={!ready||busy||blocked} {...controlHint(busy||blocked?'busy':!ready?'scope':null)}>{t('describe.calculate')}</button>
  {#if busy}<button type="button" onclick={()=>{cancel();status='describe.cancelled'}}>{t('describe.cancel')}</button><progress aria-label={t('describe.progressLabel')} value={entries.length} max={total}></progress>{/if}
  <button type="button" disabled={!context||busy||reporting||!matrix.columns.length} {...controlHint(busy||reporting?'busy':!context?'result':null)} onclick={report}>{t('describe.report')}</button>
 </form>
 <p role="status" aria-live="polite">{t(status,{done:formatNumber(entries.length),total:formatNumber(total)})}</p>
 {#if sample===true}<p class="notice">{t('charts.fields.sample')}</p>{/if}
 {#if matrix.columns.length}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (La tabla horizontal debe poder desplazarse con teclado.) -->
  <div class="describe-scroll" role="region" aria-label={t('describe.results')} tabindex="0"><table>
   <caption>{t('describe.scope.'+(context?analyzedScope:scope))} · {t('describe.revision',{revision:doc.revision})}{busy?' · '+t('describe.provisional'):''}</caption>
   <thead><tr><th scope="col">{t('describe.metric')}</th>{#each matrix.columns as column(column.index)}<th scope="col"><span>{column.name||t('describe.column',{index:column.index+1})}</span><small>{t('describe.type.'+column.profile.kind)}</small>{#if column.unavailable}<small title={t('describe.unavailableHelp')}>{t('describe.unavailable')}</small>{/if}</th>{/each}</tr></thead>
   <tbody>{#each matrix.rows as row}<tr><th scope="row" aria-label={row.metric+' · '+t('describe.help.'+row.metric)}><abbr title={t('describe.help.'+row.metric)}>{row.metric}</abbr></th>{#each row.values as value}<td title={full(value)}>{value===null?'—':typeof value==='number'?formatNumber(value,{maximumFractionDigits:4}):value}</td>{/each}</tr>{/each}</tbody>
  </table></div>
 {:else if context}<p>{t('describe.noNumbers')}</p>{/if}
 <details><summary>{t('describe.how')}</summary><p>{t('describe.how.statistics')}</p><p>{t('describe.how.identifiers')}</p><p>{t('describe.how.decimal')}</p></details>
</section>

<style>
 .describe-panel{min-width:0}form{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:8px 0}label{display:flex;align-items:center;gap:6px}select,button{font:inherit}progress{width:90px}p{margin:8px 0;color:var(--muted)}.notice{border-left:3px solid var(--accent);padding-left:8px}.describe-scroll{overflow:auto;max-width:100%;border:1px solid var(--border);border-radius:var(--radius-control)}table{border-collapse:collapse;min-width:100%;white-space:nowrap}caption{text-align:left;padding:7px;color:var(--muted)}th,td{padding:7px 10px;border-bottom:1px solid var(--border);text-align:right;max-width:280px;overflow:hidden;text-overflow:ellipsis}th{background:var(--panel)}th:first-child{position:sticky;left:0;z-index:1;text-align:left}thead th{position:sticky;top:0}thead th:first-child{z-index:2}small{display:block;font-weight:400;color:var(--muted)}abbr{text-decoration:underline dotted;cursor:help}.describe-panel :focus-visible{outline:2px solid var(--accent);outline-offset:2px}details{margin-top:10px}details p{line-height:1.5}
</style>
