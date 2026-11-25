<script lang="ts">
 import AnalysisNumber from './AnalysisNumber.svelte'
 import {formatAnalysisNumber,type AnalysisNumberMode,type AnalysisNumberKind} from '../../shared/analysis-number-format'
 import {t,plural,getUILanguage} from '../lib/i18n.svelte'
 import {csvAnalysisSample,csvAnalysisQueryReady,csvAnalysisQueryKey as viewKey,type CsvEmptyIntent} from '../lib/csv-analysis-view'
 import {controlHint} from '../lib/control-hint'
 import Icon from './Icon.svelte'
 import type {AnalysisExportAction} from '../lib/analysis-export'
 import {onDestroy,untrack} from 'svelte'
 import {columnSummary} from '../../shared/column-profile'
 import {columnOverviewReport,type ReportContext} from '../lib/statistics-report'
 import type {DocumentInfo,TableQuery,ColumnOverviewRow,TableViewMeta} from '../../shared/types'
 let {doc,columns,query,queryValid,viewMeta,requested,external=false,externalExports=false,onerror,onreport,oninspect,onempty,numberMode='auto'}:{doc:DocumentInfo;columns:number[];query:TableQuery;queryValid:boolean;viewMeta:TableViewMeta;requested?:boolean;external?:boolean;externalExports?:boolean;onerror:(message:string)=>void;onreport:(markdown:string)=>Promise<void>;oninspect:(column:number,scope:'all'|'view')=>void;onempty:(intent:CsvEmptyIntent)=>void;numberMode?:AnalysisNumberMode}=$props()
 let scope=$state<'all'|'view'>('all'),selection=$state('all'),busy=$state(false),reporting=$state(false),results=$state<ColumnOverviewRow[]>([])
 let message=$state('info.idle'),errorMessage=$state(''),total=$state(0),rowCount=$state(0),search=$state(''),offset=$state(0),context=$state<ReportContext|null>(null)
 let serial=0,active:{id:string;requestId:string}|null=null,timer:ReturnType<typeof setTimeout>|undefined
 let initialRequested=false,initialized=false,hadResult=$state(false)
 const sample=$derived(csvAnalysisSample(doc,viewMeta))
 const viewReady=$derived(queryValid&&sample!==undefined&&csvAnalysisQueryReady(doc,query,viewMeta))
 const scopeKey=$derived(scope==='view'?JSON.stringify([scope,viewKey(query),viewReady]):scope)
 const scopeReady=$derived(sample!==undefined&&(scope==='all'?doc.rowCount!==undefined&&Number.isSafeInteger(doc.rowCount)&&doc.rowCount>=0:viewReady))
 const selectionKey=$derived(selection==='selected'?JSON.stringify(columns):'all')
 const visible=$derived(results.filter(row=>`${row.column+1}. ${row.name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())))
 const failed=$derived(results.filter(row=>'error'in row).length)
 const emptyReason=$derived(doc.projectSource==='protected'?t('empty.protected'):doc.projectSource==='closed'?t('ui.reason.projectClosed'):doc.large?t('empty.large'):doc.readonly?t('empty.readonly'):external?t('empty.error.disk'):'')
 const emptyDescription=(empty:number,cells:number)=>empty?t('empty.countPercent',{count:formatAnalysisNumber(empty,numberMode,getUILanguage(),'count'),percent:formatAnalysisNumber(cells?empty/cells*100:0,numberMode,getUILanguage(),'percent')}):formatAnalysisNumber(0,numberMode,getUILanguage(),'count')
 const kinds=['number','date','identifier','category','text','mixed','empty'] as const
 const typeCounts=$derived(results.reduce((counts,entry)=>{if('result'in entry){const kind=entry.result.profile.kind;counts[kind]=(counts[kind]??0)+1}return counts},{} as Partial<Record<typeof kinds[number],number>>))
 function cancel(){serial++;clearTimeout(timer);if(active)void window.freya.cancelAnalysis(active.id,active.requestId).catch(()=>{});active=null;busy=false;results=[];context=null;offset=0;errorMessage=''}
 onDestroy(cancel)
 // Cambiar de pestaña o de página no cambia la captura del análisis.
 const invalidationKey=$derived(JSON.stringify([doc.id,doc.revision,scopeKey,selectionKey]))
 $effect(()=>{void invalidationKey;untrack(()=>{cancel();message=initialized?'info.changed':'info.idle';initialized=true})})
 $effect(()=>{
  const selected=requested,ready=scopeReady
  untrack(()=>{
   if(selected===false&&busy){cancel();message='info.cancelled'}
   else if(selected&&ready&&!initialRequested){initialRequested=true;void explore()}
  })
 })
 $effect(()=>{void search;offset=0})
 async function explore(){
  if(sample===undefined||!scopeReady){onerror(t('info.error.ready'));return}
  cancel();const ticket=serial,id=doc.id,revision=doc.revision,headers=[...doc.headers??[]],capturedScope=scope,capturedQuery=scope==='view'?$state.snapshot(query):undefined
  const selected=selection==='all'?headers.map((_,index)=>index):[...new Set($state.snapshot(columns))].sort((a,b)=>a-b)
  if(!selected.length){message='info.error.selection';return}
  if(selected.length>2000){message='info.error.columns';return}
  total=selected.length;rowCount=0;busy=true;message='info.checking'
  timer=setTimeout(()=>{if(ticket===serial){cancel();message='info.error.time'}},120000)
  try{
   const matched=capturedQuery?viewMeta.matched:doc.rowCount,capturedSample=sample
   if(matched===undefined||!Number.isSafeInteger(matched)||matched<0)throw new Error(t('info.error.rows'))
   if(matched*selected.length>2_000_000)throw new Error(t('info.error.cells'))
   rowCount=matched
   const captured:ReportContext={source:doc.name,revision,sample:capturedSample,dirty:doc.dirty,scope:t(capturedSample?capturedQuery?'info.scope.sampleView':'info.scope.sample':capturedQuery?'info.scope.view':'info.scope.all')+' · '+t(selection==='all'?'info.columns.all':'info.columnsSelectedAtStart'),analyzedAt:new Date().toISOString(),query:capturedQuery}
   context=captured
   for(const column of selected){
    const requestId=crypto.randomUUID();active={id,requestId};message='info.progress'
    try{
     const data=await window.freya.analyzeColumn(id,{column,query:capturedQuery,revision,requestId,frequencyOffset:0,duplicatesOnly:false,bins:10})
     if(ticket!==serial)return
     if(data.revision!==revision||doc.id!==id||doc.revision!==revision||data.cells!==rowCount||data.sample!==capturedSample)throw new Error(t('info.error.changed'))
     const {profile,cells,empty,missing,whitespace,numeric,unique,extraDuplicates,sample,filtered}=data
     results=[...results,{column,name:headers[column],result:{profile,cells,empty,missing,whitespace,numeric,unique,extraDuplicates,revision,sample,filtered}}]
    }catch(error){
     if(ticket!==serial)return
     const detail=String(error).replace(/^.*Error: /,'')
     // shortcut: el motor aún identifica este límite por su mensaje fijo; usar un código estable antes de traducirlo.
     if(!detail.includes('100 000 valores distintos'))throw error
     const current=(await window.freya.documents()).find(value=>value.id===id)
     if(ticket!==serial)return
     if(!current||current.revision!==revision)throw new Error(t('info.error.changed'))
     results=[...results,{column,name:headers[column],error:detail}]
    }finally{if(ticket===serial)active=null}
   }
   message=failed?'info.partial':'info.complete';hadResult=true
  }catch(error){if(ticket===serial){results=[];context=null;errorMessage=String(error).replace(/^.*Error: /,'');message='info.error';onerror(errorMessage)}}
  finally{if(ticket===serial){clearTimeout(timer);active=null;busy=false}}
 }
 async function report(){if(!context||busy||reporting||doc.revision!==context.revision)return;reporting=true;try{await onreport(columnOverviewReport($state.snapshot(context),$state.snapshot(results)))}catch(error){onerror(String(error))}finally{reporting=false}}
 export function exportActions():AnalysisExportAction[]{return[{label:t('info.report'),disabledReason:busy||reporting?'busy':!context||!results.length?'result':doc.revision!==context.revision?'refresh':null,run:report}]}
 const number=(value:number)=>formatAnalysisNumber(value,numberMode,getUILanguage(),'count')
 function fileSize(bytes:number|undefined){if(bytes===undefined)return null;const unit=bytes<1024?'B':bytes<1024*1024?'KiB':'MiB',divisor=unit==='B'?1:unit==='KiB'?1024:1024*1024;return{value:bytes/divisor,unit:' '+unit}}
 const delimiterNames:Record<string,string>={',':'comma',';':'semicolon','\t':'tab','|':'pipe'}
</script>
{#snippet numeric(value:number,unit='',kind:AnalysisNumberKind='count')}<AnalysisNumber {value} mode={numberMode} {unit} {kind}/>{/snippet}
<section class="columns-overview" aria-label={t('info.title')}>
 <form onsubmit={event=>{event.preventDefault();void explore()}}>
  <label>{t('info.columns')} <select aria-label={t('info.columnsLabel')} bind:value={selection} disabled={busy}><option value="all">{t('info.columns.all')}</option><option value="selected" disabled={!columns.length}>{t('info.columns.selected')}</option></select></label>
  <label>{t('info.rows')} <select aria-label={t('info.scopeLabel')} bind:value={scope} disabled={busy}><option value="all">{sample===undefined?t('analysis.scope.pending'):sample?t('info.scope.sample'):t('info.scope.all')}</option><option value="view">{sample?t('info.scope.sampleView'):t('info.scope.view')}</option></select></label>
  <button aria-busy={busy} {...controlHint(busy?'busy':!scopeReady?'scope':null)} type="submit" disabled={busy||!scopeReady}>{#if busy}<span class="button-spinner" aria-hidden="true"></span>{/if}<span class:busy-label={busy} data-loading={t('ui.button.calculating')}>{t(hadResult?'info.refresh':'info.calculate')}</span></button>
  {#if busy}<button class="btn-ghost" type="button" onclick={()=>{cancel();message='info.cancelled'}}>{t('info.cancel')}</button><progress aria-label={t('info.progressLabel')} value={results.length} max={total}></progress>{/if}
  {#if !externalExports&&context&&results.length&&!busy&&doc.revision===context.revision}<button {...controlHint(busy||reporting?'busy':!context?'result':doc.revision!==context.revision?'refresh':null)} type="button" disabled={!context||busy||reporting||doc.revision!==context.revision} onclick={report}>{t('info.report')}</button>{/if}
 </form>
 <p role="status" class:sr-only={!busy&&!message.startsWith('info.error')&&message!=='info.partial'}>{t(message,{done:message==='info.partial'?results.length-failed:results.length+1,total,failed})+(errorMessage?' '+errorMessage:'')}</p>
 {#if sample===true}<p class="notice">{t('info.sampleWarning')}</p>{/if}
 {#if results.length}{@const size=fileSize(doc.byteLength)}
  <p class="file-summary">{plural('info.count.rows',rowCount)} × {plural('info.count.columns',total)} · <span title={t('info.fileSize')}>{#if size}{@render numeric(size.value,size.unit,size.unit===' B'?'count':'number')}{:else}{t('info.size.unknown')}{/if}</span> · {t('csvText.encoding.'+doc.encoding)} · {delimiterNames[doc.delimiter??',']?t('project.source.'+delimiterNames[doc.delimiter??',']):t('info.delimiter',{value:doc.delimiter??','})} · {t(doc.hasHeader===false?'info.noHeader':'info.withHeader')}{context?.sample?' · '+t('info.sample'):''}</p>
  <div class="type-chips" aria-label={t('info.types')}>{#each kinds as kind}{#if typeCounts[kind]}<span>{plural('info.kind.'+kind,typeCounts[kind]!)}</span>{/if}{/each}</div>
  {#if sample||scope==='view'||selection==='selected'||failed}<p class="scope">{context?.scope??t(sample?scope==='view'?'info.scope.sampleView':'info.scope.sample':scope==='view'?'info.scope.view':'info.scope.all')} · {t('info.scopeSummary',{rows:number(rowCount),done:results.length,total})}{busy?' · '+t('info.provisional'):''}{failed?' · '+t('info.partialCoverage'):''}</p>{/if}
  {#if results.length>20}<label>{t('info.search')} <input aria-label={t('info.searchLabel')} bind:value={search} type="search" placeholder={t('info.searchPlaceholder')}/></label>{/if}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (La tabla desplazable debe recibir foco para usar flechas y PageDown.) -->
  <div class="overview-scroll" role="region" aria-label={t('info.profiles')} tabindex="0"><table>
   <caption>{t('info.caption')}</caption>
   <thead><tr>{#each ['#','column','type','content','empty','unique','detail'] as title}<th scope="col">{title==='#'?'#':t('info.header.'+title)}</th>{/each}</tr></thead>
   <tbody>{#each visible.slice(offset,offset+50) as entry(entry.column)}<tr>
    <td>{@render numeric(entry.column+1)}</td><th scope="row">{entry.name||t('describe.column',{index:entry.column+1})}</th>
    {#if 'result'in entry}{@const summary=columnSummary(entry.result)}
     <td><details class="type-explanation"><summary class="cell-summary">{t('info.type.'+entry.result.profile.kind)}<Icon name="chevron-down" size={12}/></summary><p>{summary.reason}</p></details></td>
     <td class="non-empty">{@render numeric(entry.result.cells-entry.result.empty)}</td>
     <td>{#if entry.result.empty}<details class="quality-breakdown"><summary class="cell-summary" aria-label={emptyDescription(entry.result.empty,entry.result.cells)+' · '+t('info.emptyHelp',{name:entry.name})}>{@render numeric(entry.result.empty)} · {@render numeric(entry.result.cells?entry.result.empty/entry.result.cells*100:0,' %','percent')}<Icon name="chevron-down" size={12}/></summary><dl>{#each [['missing',entry.result.missing],['exact',entry.result.empty-entry.result.missing-entry.result.whitespace],['spaces',entry.result.whitespace]] as [kind,value]}<div><dt>{t('info.empty.'+kind)}</dt><dd>{@render numeric(Number(value))}</dd></div>{/each}</dl>
      <p>{t('empty.pandas')}</p><p>{t('empty.scope')}</p>
      <div class="empty-actions">
       <button type="button" disabled={busy} onclick={()=>onempty({action:'view',column:entry.column,revision:entry.result.revision})}>{t('empty.view')}</button>
       <button type="button" disabled={busy||!!emptyReason} title={emptyReason||undefined} aria-describedby={emptyReason?'empty-reason-'+doc.id+'-'+entry.column:undefined} onclick={()=>onempty({action:'fill',column:entry.column,revision:entry.result.revision})}>{t('empty.fill')}</button>
       <button type="button" disabled={busy||!!emptyReason} title={emptyReason||undefined} aria-describedby={emptyReason?'empty-reason-'+doc.id+'-'+entry.column:undefined} onclick={()=>onempty({action:'delete',column:entry.column,revision:entry.result.revision})}>{t('empty.delete')}</button>
      </div>{#if emptyReason}<p id={'empty-reason-'+doc.id+'-'+entry.column}>{emptyReason}</p>{/if}
     </details>{:else}{@render numeric(0)}{/if}</td>
     <td><details class="distinct-detail"><summary class="cell-summary" aria-label={number(entry.result.profile.distinctNonEmpty)+' · '+t('info.distinctHelp',{name:entry.name})}>{@render numeric(entry.result.profile.distinctNonEmpty)}<Icon name="chevron-down" size={12}/></summary><p>{t('info.distinctExplanation')}</p><p>{t('info.repetitions',{count:number(entry.result.extraDuplicates)})}</p></details></td>
    {:else}<td>{t('info.unavailable')}</td><td colspan="3" class="unavailable">{entry.error}</td>{/if}
    <td><button class="inspect btn-ghost" {...controlHint(busy?'busy':null)} type="button" disabled={busy} aria-label={t('info.inspect',{index:entry.column+1})} onclick={()=>oninspect(entry.column,scope)}>{t('info.detail')}<Icon name="chevron-right" size={12}/></button></td>
   </tr>{/each}</tbody>
  </table></div>
  {#if visible.length>50}<div class="pagination"><button {...controlHint(offset===0?'firstPage':null)} disabled={offset===0} onclick={()=>offset=Math.max(0,offset-50)}>{t('info.previous')}</button><span>{visible.length?offset+1:0}–{Math.min(offset+50,visible.length)} {t('info.of')} {number(visible.length)} {t('info.visibleColumns')}</span><button {...controlHint(offset+50>=visible.length?'lastPage':null)} disabled={offset+50>=visible.length} onclick={()=>offset+=50}>{t('info.next')}</button></div>{/if}
 {/if}
 <details><summary>{t('info.how')}</summary><p>{t('info.help')}</p><p>{t('describe.revision',{revision:context?.revision??doc.revision})}{#if context} · {context.scope} · {t('info.scopeSummary',{rows:number(rowCount),done:results.length,total})}{/if}</p></details>
</section>
<style>
 .cell-summary{list-style:none;cursor:pointer}.cell-summary::-webkit-details-marker{display:none}.cell-summary :global(.icon){margin-left:4px;vertical-align:-2px}details[open]>.cell-summary :global(.icon){transform:rotate(180deg)}.inspect{display:inline-flex;align-items:center;gap:2px;border:0;background:transparent}
 .empty-actions{display:flex;flex-direction:column;align-items:flex-start;gap:6px}.quality-breakdown>p{max-width:300px;white-space:normal}.empty-actions button{white-space:normal;text-align:left;min-height:24px}
 .columns-overview{font-size:11px;padding:8px 0}.columns-overview p{color:var(--muted);line-height:1.5;margin:8px 0}form,.pagination{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}label{display:inline-flex;gap:6px;align-items:center}button,input,select{font:inherit;color:var(--text);background:var(--input);border:1px solid var(--border);border-radius:var(--radius-control);padding:5px 8px}input{max-width:240px}button:disabled{opacity:.5}.columns-overview :focus-visible{outline:2px solid var(--accent);outline-offset:2px}progress{width:90px}.notice{border-left:3px solid var(--accent);padding-left:8px}.scope{font-weight:600}.overview-scroll{max-height:180px;overflow:auto;border:1px solid var(--border);border-radius:var(--radius-control)}table{border-collapse:collapse;white-space:nowrap;width:100%}caption{text-align:left;color:var(--muted);padding:6px;white-space:normal}th,td{padding:6px 8px;border-bottom:1px solid var(--border);text-align:right}:is(th,td):nth-child(2),:is(th,td):nth-child(3){text-align:left}thead th{position:sticky;top:0;background:var(--panel)}.file-summary{font-weight:600;color:var(--text)}.type-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.type-chips span{padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius-control);background:var(--input)}.quality-breakdown dl{margin:6px 0}.quality-breakdown dl div{display:flex;justify-content:space-between;gap:12px}.quality-breakdown dd{margin:0}.quality-breakdown,.distinct-detail{text-align:right}.quality-breakdown dl,.quality-breakdown>p,.distinct-detail>p{text-align:left}.quality-breakdown dl,.distinct-detail p{max-width:280px;white-space:normal}.columns-overview{height:100%;display:flex;flex-direction:column;min-height:0}.columns-overview>form,.columns-overview>p,.columns-overview>.type-chips,.columns-overview>label,.columns-overview>.pagination,.columns-overview>details{flex-shrink:0}.overview-scroll{flex:1;min-height:140px;max-height:none}.type-explanation p{white-space:normal;max-width:300px;min-width:180px;text-align:left}.unavailable{white-space:normal;max-width:320px;text-align:left}
</style>
