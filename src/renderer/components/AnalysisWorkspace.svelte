<script lang="ts">
 import {tick,untrack} from 'svelte'
 import {copyAnalysisNumbers} from '../lib/analysis-copy'
 import type {AnalysisNumberMode} from '../../shared/analysis-number-format'
 import CsvStatistics from './CsvStatistics.svelte'
 import CsvColumnsOverview from './CsvColumnsOverview.svelte'
 import CsvSql from './CsvSql.svelte'
 import Icon from './Icon.svelte'
 import ContextMenu from './ContextMenu.svelte'
 import {controlHint} from '../lib/control-hint'
 import type {AnalysisExportAction} from '../lib/analysis-export'
 import {subsetCoverage} from '../lib/subset-coverage'
 import {t,plural,formatNumber,getUILanguage} from '../lib/i18n.svelte'
 import type {AnalysisSection,AnalysisTab} from '../lib/workspace-tabs'
 import {csvAnalysisSample,type CsvAnalysisView,type CsvEmptyIntent} from '../lib/csv-analysis-view'
 import type {DocumentInfo} from '../../shared/types'
 let {tab,doc,shown,view,external,onsection,onreturn,onerror,onreport,onempty,numberMode='auto',numberModeReadonly=false,onnumbermodechange}:{tab:AnalysisTab;doc:DocumentInfo;shown:boolean;view:CsvAnalysisView;external:boolean;onsection:(section:AnalysisSection)=>void;onreturn:()=>void;onerror:(message:string)=>void;onreport:(text:string)=>Promise<void>;onempty:(intent:CsvEmptyIntent)=>void;numberMode?:AnalysisNumberMode;numberModeReadonly?:boolean;onnumbermodechange?:(mode:AnalysisNumberMode)=>Promise<void>}=$props()
 let changingNumberMode=$state(false)
 async function changeNumberMode(select:HTMLSelectElement){
  if(numberModeReadonly||changingNumberMode||!onnumbermodechange)return
  changingNumberMode=true
  try{await onnumbermodechange(select.value==='all'?'all':'auto')}catch(error){onerror(String(error))}
  finally{changingNumberMode=false;await tick();if(select.isConnected)select.value=String(numberMode)}
 }
 const subset=$derived(doc.analysisSubset)
 const coverage=$derived(subset?subsetCoverage(subset.coverage,subset.steps,getUILanguage(),subset.stepOwners):undefined)
 const sections:AnalysisSection[]=['info','statistics','charts','sql']
 const unavailable=(section:AnalysisSection)=>!!doc.large&&(section==='info'||section==='statistics')
 const section=$derived(unavailable(tab.section)?'charts':tab.section)
 let visited=$state<AnalysisSection[]>([])
 let heading:HTMLHeadingElement,sectionList:HTMLDivElement,exportButton:HTMLButtonElement,inspection=$state<{column:number;scope:'all'|'view'}>()
 let information=$state<CsvColumnsOverview>(),statistics=$state<CsvStatistics>(),sql=$state<CsvSql>(),charts=$state<{exportActions:()=>AnalysisExportAction[]}>()
 let exportMenu=$state<{x:number;y:number}>()
 const exports:AnalysisExportAction[]|undefined=$derived(section==='info'?information?.exportActions():section==='statistics'?statistics?.exportActions():section==='sql'?sql?.exportActions():charts?.exportActions()??[
  ...['PNG','SVG','PDF'].map(format=>({label:t('charts.ui.exportImage',{format}),disabledReason:'busy' as const,run:()=>{}})),
  ...['json','csv','markdown'].map((format,index)=>({label:t('analysis.export.'+format),disabledReason:'busy' as const,run:()=>{},separator:index===0}))
 ])
 const mounted=$derived(visited.includes(section)?visited:[...visited,section])
 $effect(()=>{
  if(shown){const current=section;untrack(()=>{
   if(!visited.includes(current))visited=[...visited,current]
   const fromTabs=sectionList?.contains(document.activeElement)
   void tick().then(()=>{if(shown&&current===section){if(fromTabs)sectionList.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();else heading?.focus()}})
  })
  }
 })
 $effect(()=>{section;shown;exportMenu=undefined})
 function inspect(column:number,scope:'all'|'view'){inspection={column,scope};onsection('statistics')}
 function sectionKey(event:KeyboardEvent){
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return
  event.preventDefault();event.stopPropagation()
  const available=sections.filter(item=>!unavailable(item)),index=available.indexOf(section)
  onsection(available[event.key==='Home'?0:event.key==='End'?available.length-1:(index+(event.key==='ArrowRight'?1:available.length-1))%available.length])
 }
 function openExport(){const bounds=exportButton.getBoundingClientRect();exportMenu=exportMenu?undefined:{x:bounds.left,y:bounds.bottom}}
 function closeExport(restore:boolean){exportMenu=undefined;if(restore)void tick().then(()=>{if(shown)exportButton?.focus()})}
 function runExport(action:AnalysisExportAction){if(action.disabledReason)return;closeExport(true);void action.run()}
</script>

<div use:copyAnalysisNumbers class="analysis-workspace" role="tabpanel" id={'workspace-panel-'+tab.id} aria-labelledby={'workspace-tab-'+tab.id} hidden={!shown}>
 <header>
  <div class="analysis-heading"><h2 tabindex="-1" bind:this={heading}>{subset?plural('subset.analysis.source',doc.rowCount??0,{name:subset.name,rows:formatNumber(doc.rowCount??0)}):t('analysis.tab.source',{name:doc.name,rows:formatNumber(doc.rowCount??0)})}</h2>
   <div class="header-actions"><button bind:this={exportButton} type="button" aria-haspopup="menu" aria-expanded={!!exportMenu} onclick={openExport}>{t('analysis.tab.export')}<Icon name="chevron-down" size={14}/></button><button type="button" onclick={onreturn}><Icon name="table" size={14}/>{t(subset?'subset.analysis.return':'analysis.tab.return')}</button></div>
  </div>
  {#if section!=='sql'}<div class="number-format"><label>{t('analysis.decimals.label')} <select aria-label={t('analysis.decimals.label')} title={t('analysis.decimals.precisionHelp')} aria-describedby={'analysis-number-help-'+tab.id} value={String(numberMode)} disabled={numberModeReadonly||changingNumberMode||!onnumbermodechange} onchange={event=>void changeNumberMode(event.currentTarget)}><option value="auto">{t('analysis.decimals.auto')}</option><option value="all">{t('analysis.decimals.all')}</option></select></label><small id={'analysis-number-help-'+tab.id}>{t('analysis.decimals.help')}</small></div>{/if}
   <div bind:this={sectionList} class="analysis-sections" role="tablist" aria-label={t('analysis.tab.sections')}>
    {#each sections as item (item)}
     <button type="button" role="tab" id={'analysis-section-'+tab.id+'-'+item} aria-controls={'analysis-panel-'+tab.id+'-'+item} aria-selected={item===section} tabindex={item===section?0:-1} aria-disabled={unavailable(item)} disabled={unavailable(item)} title={unavailable(item)?t('analysis.tab.large'):undefined} aria-describedby={unavailable(item)?'analysis-large-'+tab.id:undefined} onkeydown={sectionKey} onclick={()=>onsection(item)}>{t('analysis.tab.section.'+item)}</button>
    {/each}
    {#if doc.large}<span id={'analysis-large-'+tab.id} class="sr-only">{t('analysis.tab.large')}</span>{/if}
   </div>
 </header>
 {#if exportMenu}<ContextMenu x={exportMenu.x} y={exportMenu.y} label={t('analysis.tab.export')} onclose={closeExport}>
  {#each exports??[] as action}{#if action.separator}<div role="separator"></div>{/if}<button type="button" role="menuitem" tabindex="-1" aria-disabled={!!action.disabledReason} {...controlHint(action.disabledReason,action.title)} onclick={()=>runExport(action)}>{action.label}</button>{/each}
 </ContextMenu>{/if}
 {#if coverage}<div class="subset-analysis-coverage" role="status">{#each coverage.lines as line}<p>{line}</p>{/each}<p>{coverage.identity}</p>{#if subset?.coverage.sourceVersionDifferent}<p>{t('subset.sourceVersionDifferent',{name:subset.sourceName})}</p>{/if}</div>{/if}
 {#if external}<p class="analysis-warning" role="status">{t('analysis.tab.external')}</p>{/if}
 {#if csvAnalysisSample(doc,view.viewMeta)===true}<p class="analysis-warning" role="status">{t('charts.fields.sample')}</p>{/if}
 {#if doc.csvView==='text'}
  <p class="analysis-warning" role="status">{t('analysis.tab.textView')}</p>
 {/if}
 {#each sections as item (item)}
   <div class="analysis-section" role="tabpanel" id={'analysis-panel-'+tab.id+'-'+item} aria-labelledby={'analysis-section-'+tab.id+'-'+item} class:charts-section={item==='charts'} class:info-section={item==='info'} hidden={doc.csvView==='text'||item!==section}>
    {#if mounted.includes(item)&&!unavailable(item)&&(item==='info'||doc.csvView!=='text')}
     {#if item==='info'}<CsvColumnsOverview bind:this={information} {numberMode} externalExports {doc} {...view} requested={doc.csvView!=='text'&&section==='info'} {external} {onerror} {onreport} {onempty} oninspect={inspect}/>
     {:else if item==='statistics'}<CsvStatistics bind:this={statistics} {numberMode} {doc} {...view} embedded autofocus={false} {inspection} entry={tab.statistics} {onerror} {onreport} {onempty} onclose={onreturn}/>
     {:else if item==='sql'}<CsvSql bind:this={sql} {doc} viewMeta={view.viewMeta} embedded {onerror} {onreport} onclose={onreturn}/>
     {:else}{#await import('./CsvCharts.svelte')}<p role="status">{t('charts.ui.prepare')}</p>{:then module}
      {#key JSON.stringify(doc.headers)}<module.default bind:this={charts} {numberMode} {doc} query={view.query} queryValid={view.queryValid} viewMeta={view.viewMeta} visible={shown&&section==='charts'} onDemand {onerror} onclose={()=>heading?.focus()}/>{/key}
     {:catch}<p role="alert">{t('charts.ui.loadError')}</p>{/await}{/if}
    {/if}
   </div>
 {/each}
</div>

<style>
 .analysis-workspace{flex:1;display:flex;flex-direction:column;min-height:0;min-width:0;background:var(--panel)}
 .analysis-workspace[hidden],.analysis-section[hidden]{display:none}
 header{display:flex;flex-direction:column;gap:2px;padding:0 12px;border-bottom:1px solid var(--border)}
 .analysis-heading{display:flex;align-items:center;gap:10px;min-height:30px}
 header button{min-height:24px;padding:2px 6px}
 .header-actions,.header-actions button,.analysis-sections{display:flex;align-items:center;gap:6px}
 .header-actions{flex-shrink:0}
 .number-format,.number-format label{display:flex;align-items:center;gap:6px}.number-format{flex-wrap:wrap}.number-format select{font:inherit;color:var(--text);background:var(--input);border:1px solid var(--border);border-radius:var(--radius-control);padding:2px 4px}.number-format small{color:var(--muted)}
 .analysis-sections{padding:0;gap:4px}
 :global(:root .app-shell) .analysis-sections button{border:0;border-radius:4px 4px 0 0;border-bottom:2px solid transparent;background:transparent;padding:7px 9px;font-size:var(--font-ui);font-weight:600}
 :global(:root .app-shell) .analysis-sections button[aria-selected=true]{border-bottom-color:var(--accent);background:var(--hover)}
 h2{margin:0;padding:0;font-size:var(--font-ui);line-height:1.5;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:400}
 .analysis-section{flex:1;min-height:0;min-width:0;overflow:auto}
 .charts-section{display:flex;flex-direction:column}.info-section{padding-inline:16px}
 .subset-analysis-coverage{padding:4px 12px;font-size:12px;color:var(--muted);flex-shrink:0}.subset-analysis-coverage p{margin:0;line-height:1.5;overflow-wrap:anywhere}
 .analysis-warning{margin:0;padding:8px 16px;background:var(--hover)}
 @media(min-width:900px){
  header{flex-direction:row;align-items:center;gap:12px}
  .analysis-heading{flex:1;min-width:0}
  .analysis-sections{flex-shrink:0}
 }
 /* La cabecera de la pestaña deja espacio al gráfico y al pie de la tabla paginada. */
 .charts-section :global(.pivot-result){flex-shrink:1;min-height:100px}
 .charts-section :global(.chart-info summary){margin-block:0}

 .analysis-section :global(section.sql-panel),.analysis-section :global(section.statistics-panel){max-height:none;overflow:visible;border-bottom:0}
</style>
