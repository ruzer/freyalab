<script lang="ts">
 import {onMount} from 'svelte'
 import {t} from '../lib/i18n.svelte'
 import type {CsvViewDecision} from '../../shared/types'
 let {name,busy=false,message='',onchoose}:{name:string;busy?:boolean;message?:string;onchoose:(decision:CsvViewDecision|'cancel')=>void}=$props()
 let dialog:HTMLDialogElement,cancel:HTMLButtonElement
 onMount(()=>{dialog.showModal();cancel.focus();return()=>dialog.close()})
</script>
<dialog bind:this={dialog} aria-labelledby="csv-view-title" aria-describedby="csv-view-description" aria-busy={busy} oncancel={event=>{event.preventDefault();if(!busy)onchoose('cancel')}}>
 <h2 id="csv-view-title">{t('csvText.change.title')}</h2>
 <p id="csv-view-description">{t('csvText.change.description',{nombre:name})}</p>
 <p class="muted">{t('csvText.change.history')}</p>
 {#if message}<p class="failure" role="alert">{message}</p>{/if}
 {#if busy}<p role="status">{t('csvText.change.busy')}</p>{/if}
 <div class="actions">
  <button class="primary" disabled={busy} onclick={()=>onchoose('save')}>{t('csvText.change.save')}</button>
  <button disabled={busy} onclick={()=>onchoose('discard')}>{t('csvText.change.discard')}</button>
  <button bind:this={cancel} disabled={busy} onclick={()=>onchoose('cancel')}>{t('dialog.cancel')}</button>
 </div>
</dialog>
<style>
 dialog{width:min(440px,calc(100vw - 32px));margin:auto;padding:24px;color:var(--text);background:var(--panel);border:1px solid var(--border);border-radius:12px;box-shadow:0 20px 70px #0005;font:inherit}
 dialog::backdrop{background:#0008}
 h2{margin:0 0 14px;font-size:18px}p{line-height:1.6;overflow-wrap:anywhere}.muted{font-size:12px}
 .actions{display:flex;flex-direction:column;gap:8px;margin-top:20px}.failure{border-left:3px solid #d92d20;padding-left:10px}
</style>
