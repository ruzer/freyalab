<script lang="ts">
 import type {ProjectResultView} from '../../shared/project-exports'
 import {t,plural,formatNumber} from '../lib/i18n.svelte'
 import {projectResultWarnings,type ProjectExportJob} from '../lib/project-result'
 let{jobs,results=[],mutationReason='',onopenresult,onshowresult,onaddresultsource,onregisterresult,oncancelexport}:{
  jobs:ProjectExportJob[];results?:ProjectResultView[];mutationReason?:string
  onopenresult:(id:string)=>void;onshowresult:(id:string)=>void;onaddresultsource:(id:string)=>void
  onregisterresult:(id:string)=>void;oncancelexport:(requestId:string)=>void
 }=$props()
 const instance=$props.id()
 function resultOf(job:ProjectExportJob){
  const outcome=job.outcome
  if(!outcome||!('result'in outcome))return null
  return results.find(result=>result.id===outcome.result.id)??outcome.result
 }
 const fileReason=(result:ProjectResultView)=>result.status==='missing'?result.reason||t('project.export.missing'):''
 const addReason=(result:ProjectResultView)=>mutationReason||(result.isSource?t('project.export.isSource'):'')||fileReason(result)||(result.status==='changed'?result.reason||t('project.export.changed'):'')
 const registerReason=(result:ProjectResultView)=>mutationReason||fileReason(result)||(result.status==='changed'?result.reason||t('project.export.changed'):'')
</script>
{#each jobs as job (job.requestId)}
 {@const result=resultOf(job)}
 <div class="project-export-status" data-project-export={job.requestId}>
  {#if job.running}
   <p>{t('project.export.running',{name:job.name})}</p>
   <progress max={Math.max(1,job.progress.totalBytes)} value={job.progress.bytesRead} aria-label={t('project.export.running',{name:job.name})} aria-valuetext={t('subset.progressBytes',{bytes:formatNumber(job.progress.bytesRead),total:formatNumber(job.progress.totalBytes)})}></progress>
   <p class="export-progress">{t('subset.progressBytes',{bytes:formatNumber(job.progress.bytesRead),total:formatNumber(job.progress.totalBytes)})}</p>
   <button type="button" onclick={()=>oncancelexport(job.requestId)}>{t('dialog.cancel')}</button>
  {:else if job.outcome?.status==='cancelled'}
   <p>{t('project.export.cancelled')}</p>
  {:else if result}
   {@const unavailable=fileReason(result)}{@const add=addReason(result)}{@const register=registerReason(result)}
   <p>{plural('project.export.finished',result.provenance.coverage.matched,{name:result.name})}</p>
   {#each projectResultWarnings(result) as warning}<p class="export-warning">{warning}</p>{/each}
   {#if job.outcome?.status==='unregistered'}
    <p class="export-error">{t('project.result.registerFailed',{path:result.path,error:job.outcome.error})}</p>
    <button type="button" aria-disabled={register?'true':undefined} aria-describedby={register?instance+'-'+job.requestId+'-register':undefined} title={register||undefined} onclick={()=>{if(!register)onregisterresult(result.id)}}>{t('project.result.retry')}</button>
    {#if register}<p id={instance+'-'+job.requestId+'-register'} class="export-reason">{register}</p>{/if}
   {/if}
   <div class="export-actions">
    <button type="button" aria-disabled={unavailable?'true':undefined} aria-describedby={unavailable?instance+'-'+job.requestId+'-file':undefined} title={unavailable||undefined} onclick={()=>{if(!unavailable)onopenresult(result.id)}}>{t('dialog.open.button')}</button>
    <button type="button" aria-disabled={unavailable?'true':undefined} aria-describedby={unavailable?instance+'-'+job.requestId+'-file':undefined} title={unavailable||undefined} onclick={()=>{if(!unavailable)onshowresult(result.id)}}>{t('project.showFolder')}</button>
    <button type="button" aria-disabled={add?'true':undefined} aria-describedby={add?instance+'-'+job.requestId+(add===unavailable?'-file':'-source'):undefined} title={add||undefined} onclick={()=>{if(!add)onaddresultsource(result.id)}}>{t('project.result.addSource')}</button>
   </div>
   {#if unavailable}<p id={instance+'-'+job.requestId+'-file'} class="export-reason">{unavailable}</p>{/if}
   {#if add&&add!==unavailable}<p id={instance+'-'+job.requestId+'-source'} class="export-reason">{add}</p>{/if}
  {/if}
  {#if job.error&&!(job.outcome?.status==='unregistered'&&job.outcome.error===job.error)}<p class="export-error">{job.error}</p>{/if}
 </div>
{/each}
<style>
 .project-export-status{min-width:0;font-size:12px;overflow-wrap:anywhere}.project-export-status+.project-export-status{margin-top:8px}.project-export-status p{margin:4px 0}.project-export-status progress{display:block;width:100%;max-width:100%}.export-progress,.export-reason{color:var(--muted);font-size:11px}.export-error{color:var(--danger)}.export-warning{color:var(--text)}.export-actions{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.project-export-status button{font-size:11px;padding:3px 5px}.project-export-status button[aria-disabled="true"]{opacity:.5;cursor:default}
 @media(forced-colors:active){.export-error{color:CanvasText}.project-export-status button[aria-disabled="true"]{color:GrayText;opacity:1}}
</style>
