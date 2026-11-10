<script lang="ts">
 import {onMount,untrack} from 'svelte'
 import type {ProjectSourceDraft} from '../../shared/project'
 import type {ProjectSourceOptions} from '../../shared/types'
 import {t,formatNumber} from '../lib/i18n.svelte'
 let{initial,projectId,onclose}:{initial:ProjectSourceDraft;projectId:string;onclose:()=>void}=$props()
 let draft=$state(untrack(()=>initial)),format=$state<ProjectSourceOptions>(untrack(()=>fields(initial.format)))
 let dialog:HTMLDialogElement,busy=$state(false),request=$state<string|null>(null),progress=$state(0),message=$state(''),cancelling=$state(false)
 const opener=document.activeElement as HTMLElement|null
 function fields(value:ProjectSourceDraft['format']){const{encoding,delimiter,header,eol}=value;return{encoding,delimiter,header,eol}}
 onMount(()=>{
  dialog.showModal()
  const unsubscribe=window.freya.onEvent(event=>{if(event.sourceProgress?.requestId===request)progress=event.sourceProgress.bytes})
  return()=>{unsubscribe();void window.freya.projectDiscardSourceDraft().catch(()=>{});dialog.close();if(opener?.isConnected)opener.focus()}
 })
 async function inspect(){
  busy=true;message=''
  try{draft=await window.freya.projectInspectSource(draft.id,$state.snapshot(format))}
  catch(error){message=error instanceof Error?error.message:String(error)}
  finally{format=fields(draft.format);busy=false}
 }
 async function register(event:SubmitEvent){
  event.preventDefault();if(busy||request)return
  request=crypto.randomUUID();message='';progress=0;cancelling=false
  try{
   const saved=await window.freya.projectRegisterSource(projectId,draft.id,$state.snapshot(format),request)
   if(saved||cancelling)onclose()
   else message=t('project.source.notSaved')
  }catch(error){message=error instanceof Error?error.message:String(error)}
  finally{request=null}
 }
 function cancel(){
  if(request){cancelling=true;void window.freya.projectCancelSource(request).catch(error=>{message=String(error)})}
  else if(!busy)onclose()
 }
</script>

<dialog bind:this={dialog} aria-label={t('project.source.add')} oncancel={event=>{event.preventDefault();cancel()}}>
 <form onsubmit={register}>
  <h2>{t('project.source.add')}</h2>
  <p class="path">{draft.path}</p>
  {#if draft.external}<p role="status">{t('project.source.externalNotice')}</p>{/if}
  {#if request}
   <progress aria-label={t('project.source.hashing')} max={draft.bytes||1} value={progress}></progress>
   <p role="status" aria-live="polite">{t('project.source.hashProgress',{bytes:formatNumber(progress),total:formatNumber(draft.bytes)})}</p>
  {:else}
   <fieldset disabled={busy}>
    <legend>{t('project.source.format')}</legend>
    <label>{t('project.source.encoding')}<select bind:value={format.encoding} onchange={inspect}><option value="utf8">{t('csvText.encoding.utf8')}</option><option value="utf16le">{t('csvText.encoding.utf16le')}</option><option value="win1252">{t('csvText.encoding.win1252')}</option></select></label>
    <label>{t('project.source.delimiter')}<select bind:value={format.delimiter} onchange={inspect}><option value=",">{t('project.source.comma')}</option><option value=";">{t('project.source.semicolon')}</option><option value={'\t'}>{t('project.source.tab')}</option><option value="|">{t('project.source.pipe')}</option></select></label>
    <label>{t('project.source.eol')}<select bind:value={format.eol} onchange={inspect}><option value={'\n'}>{t('csvText.eol.LF')}</option><option value={'\r\n'}>{t('csvText.eol.CRLF')}</option><option value={'\r'}>{t('project.source.eolCR')}</option></select></label>
    <label class="checkbox"><input type="checkbox" bind:checked={format.header} onchange={inspect}/>{t('project.source.headerToggle')}</label>
   </fieldset>
   <h3>{t('project.source.columns')}</h3>
   <ol class="columns">{#each draft.columns as column (column.position)}<li>{column.name||t(draft.format.header?'project.source.emptyHeader':'project.source.column',{position:formatNumber(column.position)})}</li>{/each}</ol>
  {/if}
  {#if message}<p role="alert">{message}</p>{/if}
  <div class="actions">
   <button type="button" onclick={cancel} disabled={busy||cancelling}>{t('dialog.cancel')}</button>
   <button type="submit" class="btn-primary" disabled={busy||!!request}>{t('project.source.register')}</button>
  </div>
 </form>
</dialog>

<style>
 dialog{margin:auto;width:min(540px,calc(100vw - 48px));padding:24px;border:1px solid var(--border);border-radius:12px;background:var(--panel);color:var(--text);box-shadow:var(--shadow-dialog)}
 dialog::backdrop{background:#0007}h2{margin-top:0}.path{overflow-wrap:anywhere;color:var(--muted)}
 fieldset{border:1px solid var(--border);display:grid;grid-template-columns:1fr 1fr;gap:10px}
 label{display:grid;gap:5px}.checkbox{display:flex;align-items:center}.columns{max-height:140px;overflow:auto}
 progress{width:100%}.actions{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}
</style>
