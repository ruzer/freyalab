<script lang="ts">
 import {tick} from 'svelte'
 import CsvStatistics from './CsvStatistics.svelte'
 import CsvColumnsOverview from './CsvColumnsOverview.svelte'
 import CsvSql from './CsvSql.svelte'
 import Icon from './Icon.svelte'
 import {t,formatNumber} from '../lib/i18n.svelte'
 import type {AnalysisSection,AnalysisTab} from '../lib/workspace-tabs'
 import type {CsvAnalysisView} from '../lib/csv-analysis-view'
 import type {DocumentInfo} from '../../shared/types'
 let {tab,doc,shown,view,external,onsection,onreturn,onerror,onreport}:{tab:AnalysisTab;doc:DocumentInfo;shown:boolean;view:CsvAnalysisView;external:boolean;onsection:(section:AnalysisSection)=>void;onreturn:()=>void;onerror:(message:string)=>void;onreport:(text:string)=>Promise<void>}=$props()
 const sections:AnalysisSection[]=['info','statistics','charts','sql']
 const unavailable=(section:AnalysisSection)=>!!doc.large&&(section==='info'||section==='statistics')
 const section=$derived(unavailable(tab.section)?'charts':tab.section)
 let visited=$state<AnalysisSection[]>([])
 let heading:HTMLHeadingElement,exportHost=$state<HTMLDivElement>(),inspection=$state<{column:number;scope:'all'|'view'}>()
 const mounted=$derived(visited.includes(section)?visited:[...visited,section])
 $effect(()=>{
  if(shown){const current=section;if(!visited.includes(current))visited=[...visited,current]
   void tick().then(()=>{if(shown&&current===section)heading?.focus()})
  }
 })
 function inspect(column:number,scope:'all'|'view'){inspection={column,scope};onsection('statistics')}
</script>

<div class="analysis-workspace" role="tabpanel" id={'workspace-panel-'+tab.id} aria-labelledby={'workspace-tab-'+tab.id} hidden={!shown}>
 <header>
  <p>{t('analysis.tab.source',{name:doc.name,rows:formatNumber(doc.rowCount??0)})}</p>
  <div class="header-actions"><div bind:this={exportHost} hidden={section!=='charts'}></div><button type="button" onclick={onreturn}><Icon name="table" size={14}/>{t('analysis.tab.return')}</button></div>
 </header>
 {#if external}<p class="analysis-warning" role="status">{t('analysis.tab.external')}</p>{/if}
 {#if doc.readonly&&!doc.large}<p class="analysis-warning" role="status">{t('charts.fields.sample')}</p>{/if}
 <div class="analysis-sections" role="group" aria-label={t('analysis.tab.sections')}>
  {#each sections as item (item)}
   <button type="button" aria-pressed={item===section} disabled={unavailable(item)} title={unavailable(item)?t('analysis.tab.large'):undefined} aria-describedby={unavailable(item)?'analysis-large-'+tab.id:undefined} onclick={()=>onsection(item)}>{t('analysis.tab.section.'+item)}</button>
  {/each}
  {#if doc.large}<span id={'analysis-large-'+tab.id} class="sr-only">{t('analysis.tab.large')}</span>{/if}
 </div>
 <h2 tabindex="-1" bind:this={heading}>{t('analysis.tab.section.'+section)}</h2>
 {#if doc.csvView==='text'}
  <p class="analysis-warning" role="status">{t('analysis.tab.textView')}</p>
 {:else}
  {#each mounted as item (item)}
   <div class="analysis-section" class:charts-section={item==='charts'} class:info-section={item==='info'} hidden={item!==section}>
    {#if !unavailable(item)}
     {#if item==='info'}<CsvColumnsOverview {doc} {...view} {onerror} {onreport} oninspect={inspect}/>
     {:else if item==='statistics'}<CsvStatistics {doc} {...view} embedded autofocus={false} {inspection} entry={tab.statistics} {onerror} {onreport} onclose={onreturn}/>
     {:else if item==='sql'}<CsvSql {doc} embedded {onerror} {onreport} onclose={onreturn}/>
     {:else}{#await import('./CsvCharts.svelte')}<p role="status">{t('charts.ui.prepare')}</p>{:then module}
      {#key JSON.stringify(doc.headers)}<module.default {doc} query={view.query} queryValid={view.queryValid} visible={shown&&section==='charts'} onDemand {exportHost} {onerror} onclose={()=>heading?.focus()}/>{/key}
     {:catch}<p role="alert">{t('charts.ui.loadError')}</p>{/await}{/if}
    {/if}
   </div>
  {/each}
 {/if}
</div>

<style>
 .analysis-workspace{flex:1;display:flex;flex-direction:column;min-height:0;min-width:0;background:var(--panel)}
 .analysis-workspace[hidden],.analysis-section[hidden]{display:none}
 header{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:10px 16px;border-bottom:1px solid var(--border)}
 header p{margin:0;overflow-wrap:anywhere}
 .header-actions,.header-actions button,.analysis-sections{display:flex;align-items:center;gap:6px}
 .header-actions>div{position:relative}
 .analysis-sections{flex-wrap:wrap;padding:8px 16px}
 .analysis-sections button[aria-pressed=true]{color:var(--accent);border-color:var(--accent)}
 h2{margin:0;padding:2px 16px 8px;font-size:16px}
 .analysis-section{flex:1;min-height:0;min-width:0;overflow:auto}
 .charts-section{display:flex;flex-direction:column}.info-section{padding-inline:16px}
 .analysis-warning{margin:0;padding:8px 16px;background:var(--hover)}
 /* La cabecera de la pestaña deja espacio al gráfico y al pie de la tabla paginada. */
 .charts-section :global(.pivot-result){flex-shrink:1;min-height:100px}
 .charts-section :global(.chart-info summary){margin-block:0}
 @media(max-height:760px){header{padding-block:4px}.analysis-sections{padding-block:4px}h2{padding-bottom:4px}}

 .analysis-section :global(section.sql-panel),.analysis-section :global(section.statistics-panel){max-height:none;overflow:visible;border-bottom:0}
</style>
