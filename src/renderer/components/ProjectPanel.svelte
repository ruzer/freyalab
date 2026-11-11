<script lang="ts">
 import {t,formatNumber} from '../lib/i18n.svelte'
 import type {ProjectInfo} from '../../shared/project'
 let{project,onclose}:{project:ProjectInfo;onclose:()=>void}=$props()
 let editing=$state(false),busy=$state(false),name=$state(''),message=$state('')
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
  <p>{project.sourceCount?t('project.sourceCount',{count:formatNumber(project.sourceCount)}):t('project.noSources')}</p>
 {/if}
</section>

<style>
 .project-panel{padding:12px;overflow:auto}
 h2,h3{overflow-wrap:anywhere;margin:0 0 8px}
 h2{font-size:16px}h3{margin-top:16px;font-size:14px}
 p{margin:0 0 12px}.path{color:var(--muted);overflow-wrap:anywhere}
 label{display:grid;gap:6px}input{min-width:0;width:100%}
 .actions{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
</style>
