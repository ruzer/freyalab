<script lang="ts">
 import {tick} from 'svelte'
 import CsvStatistics from './CsvStatistics.svelte'
 import CsvColumnsOverview from './CsvColumnsOverview.svelte'
 import CsvSql from './CsvSql.svelte'
 import Icon from './Icon.svelte'
 import {t,formatNumber} from '../lib/i18n.svelte'
 import type {AnalysisSection,AnalysisTab} from '../lib/workspace-tabs'
 import {csvAnalysisSample,type CsvAnalysisView,type CsvEmptyIntent} from '../lib/csv-analysis-view'
 import type {DocumentInfo} from '../../shared/types'
 let {tab,doc,shown,view,external,onsection,onreturn,onerror,onreport,onempty}:{tab:AnalysisTab;doc:DocumentInfo;shown:boolean;view:CsvAnalysisView;external:boolean;onsection:(section:AnalysisSection)=>void;onreturn:()=>void;onerror:(message:string)=>void;onreport:(text:string)=>Promise<void>;onempty:(intent:CsvEmptyIntent)=>void}=$props()
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
  <div class="analysis-heading"><h2 tabindex="-1" bind:this={heading}>{t('analysis.tab.section.'+section)}</h2><p>{t('analysis.tab.source',{name:doc.name,rows:formatNumber(doc.rowCount??0)})}</p></div>
  <div class="analysis-toolbar">
   <div class="analysis-sections" role="group" aria-label={t('analysis.tab.sections')}>
    {#each sections as item (item)}
     <button type="button" aria-pressed={item===section} disabled={unavailable(item)} title={unavailable(item)?t('analysis.tab.large'):undefined} aria-describedby={unavailable(item)?'analysis-large-'+tab.id:undefined} onclick={()=>onsection(item)}>{t('analysis.tab.section.'+item)}</button>
    {/each}
    {#if doc.large}<span id={'analysis-large-'+tab.id} class="sr-only">{t('analysis.tab.large')}</span>{/if}
   </div>
   <div class="header-actions"><div bind:this={exportHost} hidden={section!=='charts'}></div><button type="button" onclick={onreturn}><Icon name="table" size={14}/>{t('analysis.tab.return')}</button></div>
  </div>
 </header>
 {#if external}<p class="analysis-warning" role="status">{t('analysis.tab.external')}</p>{/if}
 {#if csvAnalysisSample(doc,view.viewMeta)===true}<p class="analysis-warning" role="status">{t('charts.fields.sample')}</p>{/if}
 {#if doc.csvView==='text'}
  <p class="analysis-warning" role="status">{t('analysis.tab.textView')}</p>
 {:else}
  {#each mounted as item (item)}
   <div class="analysis-section" class:charts-section={item==='charts'} class:info-section={item==='info'} hidden={item!==section}>
    {#if !unavailable(item)}
     {#if item==='info'}<CsvColumnsOverview {doc} {...view} {external} {onerror} {onreport} {onempty} oninspect={inspect}/>
     {:else if item==='statistics'}<CsvStatistics {doc} {...view} embedded autofocus={false} {inspection} entry={tab.statistics} {onerror} {onreport} {onempty} onclose={onreturn}/>
     {:else if item==='sql'}<CsvSql {doc} viewMeta={view.viewMeta} embedded {onerror} {onreport} onclose={onreturn}/>
     {:else}{#await import('./CsvCharts.svelte')}<p role="status">{t('charts.ui.prepare')}</p>{:then module}
      {#key JSON.stringify(doc.headers)}<module.default {doc} query={view.query} queryValid={view.queryValid} viewMeta={view.viewMeta} visible={shown&&section==='charts'} onDemand {exportHost} {onerror} onclose={()=>heading?.focus()}/>{/key}
     {:catch}<p role="alert">{t('charts.ui.loadError')}</p>{/await}{/if}
    {/if}
   </div>
  {/each}
 {/if}
</div>

<style>
 .analysis-workspace{flex:1;display:flex;flex-direction:column;min-height:0;min-width:0;background:var(--panel)}
 .analysis-workspace[hidden],.analysis-section[hidden]{display:none}
 header{display:flex;flex-direction:column;gap:2px;padding:0 12px;border-bottom:1px solid var(--border)}
 .analysis-heading{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
 .analysis-heading p{flex:1;min-width:0;line-height:1.5}
 .analysis-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
 header button{min-height:24px;padding:2px 6px}
 .header-actions :global(.header-export>summary){margin-block:0;min-height:24px;padding:2px 6px}
 header p{margin:0;overflow-wrap:anywhere}
 .header-actions,.header-actions button,.analysis-sections{display:flex;align-items:center;gap:6px}
 .header-actions>div{position:relative}
 .analysis-sections{flex-wrap:wrap;padding:0}
 .analysis-sections button[aria-pressed=true]{color:var(--accent);border-color:var(--accent)}
 h2{margin:0;padding:0;font-size:var(--font-ui);line-height:1.5;flex-shrink:0}
 .analysis-section{flex:1;min-height:0;min-width:0;overflow:auto}
 .charts-section{display:flex;flex-direction:column}.info-section{padding-inline:16px}
 .analysis-warning{margin:0;padding:8px 16px;background:var(--hover)}
 /* La cabecera de la pestaña deja espacio al gráfico y al pie de la tabla paginada. */
 .charts-section :global(.pivot-result){flex-shrink:1;min-height:100px}
 .charts-section :global(.chart-info summary){margin-block:0}

 .analysis-section :global(section.sql-panel),.analysis-section :global(section.statistics-panel){max-height:none;overflow:visible;border-bottom:0}
</style>
