<script lang="ts">
 import {onMount} from 'svelte'
 import {t,formatNumber,getUILanguage} from '../lib/i18n.svelte'
 import type {PandocStatus} from '../../shared/pandoc'
 let{onclose,onstatus}:{onclose:()=>void;onstatus:(status:PandocStatus)=>void}=$props()
 let dialog:HTMLDialogElement,status=$state<PandocStatus>(),busy=$state(false),message=$state(''),generation=0
 async function refresh(choose=false){
  const token=++generation;busy=true;message=''
  try{const result=await(choose?window.freya.pandocChoose():window.freya.pandocStatus());if(token===generation){status=result;onstatus(result)}}
  catch(error){if(token===generation)message=error instanceof Error?error.message:String(error)}
  finally{if(token===generation)busy=false}
 }
 async function probe(){busy=true;message='';try{const result=await window.freya.pandocTest();message=t('pandoc.dialog.success',{bytes:formatNumber(result.bytes)})}catch(error){message=error instanceof Error?error.message:String(error)}finally{busy=false}}
 $effect(()=>{getUILanguage();void refresh()})
 onMount(()=>{dialog.showModal();return()=>{generation++}})
</script>
<dialog bind:this={dialog} aria-label={t('pandoc.dialog.title')} oncancel={onclose}>
 <h2>{t('pandoc.dialog.title')}</h2>
 <p>{t('pandoc.dialog.description')}</p>
 {#if status?.available}
  <dl><dt>{t('pandoc.dialog.version')}</dt><dd>{status.version}</dd><dt>{t('pandoc.dialog.path')}</dt><dd><code>{status.path}</code></dd><dt>{t('pandoc.dialog.license')}</dt><dd>{status.license}</dd></dl>
 {:else if status}<p>{status.reason}</p><p>{status.installation}</p>{:else}<p>{t('pandoc.dialog.checking')}</p>{/if}
 <p role="status" aria-live="polite">{message}</p>
 <div class="actions">
  <button disabled={busy} onclick={()=>refresh(true)}>{t('pandoc.dialog.choose')}</button>
  <button disabled={busy||!status?.available} onclick={probe}>{t('pandoc.dialog.probe')}</button>
  <button onclick={()=>window.freya.openLink('https://pandoc.org/installing.html')}>{t('pandoc.dialog.install')}</button>
  <button onclick={onclose}>{t('pandoc.dialog.close')}</button>
 </div>
</dialog>
<style>
 dialog{width:min(540px,calc(100vw - 48px));padding:24px;border:1px solid var(--border);border-radius:12px;background:var(--panel);color:var(--text);box-shadow:0 16px 70px #0006}
 dialog::backdrop{background:#0007}h2{margin-top:0}p{line-height:1.5}dl{display:grid;grid-template-columns:auto 1fr;gap:10px 16px}dd{margin:0;min-width:0}code{overflow-wrap:anywhere}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
</style>
