<script lang="ts">
 import {onMount} from 'svelte'
 import {t} from '../lib/i18n.svelte'
 let{onclose}:{onclose:()=>void}=$props()
 let dialog:HTMLDialogElement,folder=$state(''),name=$state(''),suggested=$state(false),busy=$state(false),message=$state('')
 const opener=document.activeElement as HTMLElement|null
 onMount(()=>{dialog.showModal();return()=>{void window.freya.projectCancelCreate().catch(()=>{});dialog.close();if(opener?.isConnected)opener.focus()}})
 async function choose(){
  busy=true;message=''
  try{const choice=await window.freya.projectPickFolder();if(choice){folder=choice.path;name=choice.name}}
  catch(error){message=error instanceof Error?error.message:String(error)}
  finally{busy=false}
 }
 async function create(event:SubmitEvent){
  event.preventDefault()
  if(!folder||!name.trim()||busy)return
  busy=true;message=''
  try{await window.freya.projectCreate(name,suggested);onclose()}
  catch(error){message=error instanceof Error?error.message:String(error)}
  finally{busy=false}
 }
</script>

<dialog bind:this={dialog} aria-label={t('project.new')} oncancel={event=>{event.preventDefault();if(!busy)onclose()}}>
 <form onsubmit={create}>
  <h2>{t('project.new')}</h2>
  <div class="folder-choice">
   <button type="button" onclick={choose} disabled={busy}>{t('project.pickFolder')}</button>
   <span role="status" aria-live="polite">{folder||t('project.noFolder')}</span>
  </div>
  <label>{t('project.name')}<input bind:value={name} maxlength="200" required disabled={busy}/></label>
  <label class="check"><input type="checkbox" bind:checked={suggested} disabled={busy}/> {t('project.suggested')}</label>
  <p>{t('project.privacy')}</p>
  {#if message}<p role="alert">{message}</p>{/if}
  <div class="actions">
   <button type="button" onclick={onclose} disabled={busy}>{t('dialog.cancel')}</button>
   <button type="submit" class="btn-primary" disabled={!folder||!name.trim()||busy}>{t('project.create')}</button>
  </div>
 </form>
</dialog>

<style>
 dialog{width:min(520px,calc(100vw - 48px));padding:24px;border:1px solid var(--border);border-radius:12px;background:var(--panel);color:var(--text);box-shadow:var(--shadow-dialog)}
 dialog::backdrop{background:#0007}
 h2{margin-top:0}label{display:grid;gap:6px;margin:12px 0}.check{display:flex;align-items:center}
 .folder-choice{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.folder-choice span{overflow-wrap:anywhere;color:var(--muted)}
 .actions{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}
</style>
