<script lang="ts">
 import {tick} from 'svelte'
 import {t} from '../lib/i18n.svelte'
 import type {DocumentInfo,TextEncoding} from '../../shared/types'

 let {doc,locked,onreopen,onsave}:{doc:DocumentInfo;locked:boolean;onreopen:(encoding:TextEncoding)=>Promise<boolean>;onsave:(encoding:TextEncoding)=>Promise<boolean>}=$props()
 const labels={utf8:'UTF-8',utf16le:'UTF-16 LE',utf16be:'UTF-16 BE',win1252:'Windows-1252',latin1:'Latin-1 (ISO-8859-1)'}
 const current=$derived(labels[doc.encoding]+(doc.bom?' · BOM':''))
 let choice=$state<TextEncoding>('utf8'),busy=$state(false),message=$state('')
 let dialog:HTMLDialogElement,trigger:HTMLButtonElement,origin:HTMLElement|null=null

 export function open(){
  if(locked||dialog.open)return
  origin=document.activeElement instanceof HTMLElement?document.activeElement:null
  choice=doc.encoding;message='';dialog.showModal()
 }
 function restoreFocus(){void tick().then(()=>{if(trigger.isConnected)(origin?.isConnected?origin:trigger).focus()})}
 async function choose(mode:'reopen'|'save'){
  if(busy||locked||(mode==='reopen'?!doc.path:doc.readonly))return
  busy=true;message=''
  try{if(await (mode==='reopen'?onreopen:onsave)(choice))dialog.close()}
  catch(error){message=error instanceof Error?error.message:String(error)}
  finally{busy=false}
 }
</script>

<button type="button" class="text-button" bind:this={trigger} aria-label={t('textEncoding.control',{encoding:current})} aria-haspopup="dialog" disabled={locked} onclick={open}>{current}</button>
<dialog bind:this={dialog} aria-labelledby="text-encoding-title" aria-describedby="text-encoding-explanation" aria-busy={busy} onclose={restoreFocus} oncancel={event=>{if(busy)event.preventDefault()}}>
 <h2 id="text-encoding-title">{t('textEncoding.title')}</h2>
 <p id="text-encoding-explanation">{t('textEncoding.explanation')}</p>
 <label>{t('textEncoding.choice')}
  <select bind:value={choice} disabled={busy}>{#each Object.entries(labels) as [value,label]}<option {value}>{label}</option>{/each}</select>
 </label>
 {#if !doc.readonly}<p>{t('textEncoding.writeExplanation',{encoding:labels[choice]})}</p>{/if}
 {#if doc.encodingPending}<p>{t('textEncoding.pending')}</p>{/if}
 {#if message}<p class="failure" role="alert">{message}</p>{/if}
 {#if busy}<p role="status">{t('textEncoding.busy')}</p>{/if}
 <div class="actions">
  <button type="button" disabled={busy||!doc.path} onclick={()=>void choose('reopen')}>{t('textEncoding.reopen')}</button>
  <button type="button" class="primary" disabled={busy||doc.readonly} onclick={()=>void choose('save')}>{t('textEncoding.save')}</button>
  <button type="button" class="btn-ghost" disabled={busy} onclick={()=>dialog.close()}>{t('dialog.cancel')}</button>
 </div>
</dialog>

<style>
 dialog{width:min(500px,calc(100vw - 32px));margin:auto;padding:22px;color:var(--text);background:var(--panel);border:1px solid var(--border);font:inherit;white-space:normal}
 dialog::backdrop{background:#0008}
 h2{margin:0 0 12px}p{line-height:1.6;overflow-wrap:anywhere}
 label{display:grid;gap:6px}select{width:100%}
 .actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.failure{border-left:3px solid var(--danger);padding-left:10px}
</style>
