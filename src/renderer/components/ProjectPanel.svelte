<script lang="ts">
 import {onMount} from 'svelte'
 import {t,formatNumber} from '../lib/i18n.svelte'
 import type {ProjectInfo,ProjectSourceView} from '../../shared/project'
 let{project,sources,onclose,onadd,onopen}:{project:ProjectInfo;sources:ProjectSourceView[];onclose:()=>void;onadd:()=>void;onopen:(source:string,analyze:boolean)=>void}=$props()
 let editing=$state(false),busy=$state(false),name=$state(''),message=$state('')
 let request=$state<string|null>(null),operation=$state<'hash'|'find'|null>(null),progress=$state({bytes:0,total:0})
 onMount(()=>window.freya.onEvent(event=>{const value=event.sourceProgress;if(value&&value.requestId===request)progress={bytes:value.bytes,total:value.total}}))
 async function run(kind:'hash'|'find',id:string){
  request=crypto.randomUUID();operation=kind;busy=true;message='';progress={bytes:0,total:0}
  try{if(kind==='hash')await window.freya.projectReregisterSource(project.id,id,request);else await window.freya.projectRelinkSource(project.id,id,request)}
  catch(error){message=error instanceof Error?error.message:String(error)}
  finally{request=null;operation=null;busy=false}
 }
 async function simple(action:()=>Promise<void>){
  busy=true;message=''
  try{await action()}catch(error){message=error instanceof Error?error.message:String(error)}finally{busy=false}
 }
 function cancel(){if(request)void window.freya.projectCancelSource(request).catch(error=>{message=String(error)})}
 const delimiters={',':'comma',';':'semicolon','\t':'tab','|':'pipe'} as const
 async function rename(event:SubmitEvent){
  event.preventDefault()
  if(!name.trim()||busy)return
  busy=true;message=''
  try{await window.freya.projectRename(project.id,name);editing=false}
  catch(error){message=error instanceof Error?error.message:String(error)}
  finally{busy=false}
 }
</script>
<section class="project-panel">
 {#if editing&&!project.readonly}
  <form onsubmit={rename}>
   <label>{t('project.name')}<input bind:value={name} maxlength="200" required disabled={busy}/></label>
   <div class="actions">
    <button type="button" disabled={busy} onclick={()=>editing=false}>{t('dialog.cancel')}</button>
    <button type="submit" class="btn-primary" disabled={!name.trim()||busy}>{t('dialog.save')}</button>
   </div>
  </form>
 {:else}
  <h2>{project.name}</h2>
 {/if}
 <p class="path" title={project.path}>{project.path}</p>
 {#if message}<p role="alert">{message}</p>{/if}
 {#if project.readonly}<p role="status">{t('project.future',{version:formatNumber(project.version)})}</p>{/if}
 <div class="actions">
  {#if !project.readonly&&!editing}<button onclick={()=>{name=project.name;message='';editing=true}}>{t('project.rename')}</button>{/if}
  <button onclick={onclose} disabled={busy}>{t('project.close')}</button>
 </div>
 {#if !project.readonly}
  <h3>{t('project.sources')}</h3>
  <button onclick={onadd} disabled={busy}>{t('project.source.add')}</button>
  {#if operation}
   {#if operation==='hash'}<progress aria-label={t('project.source.hashing')} max={progress.total||1} value={progress.bytes}></progress>{/if}
   <p role="status" aria-live="polite">{operation==='find'?t('project.source.searching'):t('project.source.hashProgress',{bytes:formatNumber(progress.bytes),total:formatNumber(progress.total)})}</p>
   <button onclick={cancel}>{t('dialog.cancel')}</button>
  {/if}
  {#if sources.length}
   <ul class="sources">{#each sources as source (source.id)}
    <li>
     <strong title={source.path}>{source.name}</strong>
     <p>{t('project.source.summary',{columns:formatNumber(source.columnCount),encoding:t(`csvText.encoding.${source.format.encoding}`),delimiter:t(`project.source.${delimiters[source.format.delimiter]}`),bytes:formatNumber(source.bytes)})}</p>
     <p title={source.status==='verified'?t('project.source.quickOnly'):undefined}>{t(`project.source.status.${source.status}`)} · <span aria-hidden="true">🔒</span> {t('project.source.badge')}</p>
     {#if source.external}<p class="path">{t('project.source.externalNotice')}</p>{/if}
     {#if source.overAnalysis}<p role="status">{t('project.source.overAnalysis')}</p>{/if}
     <div class="actions">
      <button disabled={busy||source.status==='missing'} onclick={()=>onopen(source.id,false)}>{t('dialog.open.button')}</button>
      <button disabled={busy||source.status==='missing'} onclick={()=>onopen(source.id,true)}>{t('analysis.tab.open')}</button>
      <button disabled={busy||source.status==='missing'||source.status==='external'} onclick={()=>void simple(()=>window.freya.projectShowSource(source.id))}>{t('project.showFolder')}</button>
      {#if source.status==='missing'}
       <button disabled={busy} onclick={()=>void run('find',source.id)}>{t('project.source.find')}</button>
      {:else}
       <button disabled={busy||source.status==='external'} onclick={()=>void run('hash',source.id)}>{t('project.source.reregister')}</button>
      {/if}
      <button disabled={busy} onclick={()=>void simple(()=>window.freya.projectForgetSource(project.id,source.id))}>{t('project.source.forget')}</button>
     </div>
    </li>
   {/each}</ul>
  {:else}
   <p>{t('project.noSources')}</p>
  {/if}
 {/if}
</section>

<style>
 .project-panel{padding:12px;overflow:auto}
 h2,h3{overflow-wrap:anywhere;margin:0 0 8px}
 h2{font-size:16px}h3{margin-top:16px;font-size:14px}
 p{margin:0 0 12px}.path{color:var(--muted);overflow-wrap:anywhere}
 label{display:grid;gap:6px}input{min-width:0;width:100%}
 .actions{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
 .sources{list-style:none;margin:12px 0 0;padding:0}
 .sources li{padding:8px 0;border-top:1px solid var(--border);overflow-wrap:anywhere}
 .sources p{margin:4px 0}.sources button{padding:4px 6px}
 progress{width:100%;margin-top:10px}
</style>
