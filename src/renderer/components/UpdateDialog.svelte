<script lang="ts">
 import {onMount,tick} from 'svelte'
 import {t,formatDate} from '../lib/i18n.svelte'
 import type {UpdateResult} from '../../shared/updates'
 let{initialResult,onclose}:{initialResult?:UpdateResult;onclose:()=>void}=$props()
 let dialog:HTMLDialogElement,result=$state<UpdateResult|{status:'checking'}>({status:'checking'}),message=$state(''),busy=$state(false),platform=$state(''),generation=0
 onMount(()=>{
  const origin=document.activeElement instanceof HTMLElement?document.activeElement:null;dialog.showModal()
  void window.freya.appInfo().then(info=>platform=info.platform).catch(()=>{})
  if(initialResult)result=initialResult;else void search()
  return()=>{generation++;void tick().then(()=>{if(origin?.isConnected)origin.focus({preventScroll:true})})}
 })
 async function search(){
  const token=++generation;result={status:'checking'};message=''
  try{const value=await window.freya.checkUpdates();if(token!==generation)return;if(value.status==='cancelled'){onclose();return}result=value}
  catch{if(token===generation)result={status:'error',code:'offline'}}
 }
 function close(){generation++;if(result.status==='checking')void window.freya.cancelUpdates().catch(()=>{});onclose()}
 async function run(operation:()=>Promise<unknown>,dismiss=false){
  const token=++generation;busy=true;message=''
  try{await operation();if(token===generation&&dismiss)onclose()}catch{if(token===generation)message=t('updates.error.action')}finally{if(token===generation)busy=false}
 }
 function installer(assets:string[]){return assets.some(name=>platform==='darwin'?/\.(dmg|zip)$/i.test(name):platform==='win32'?/\.exe$/i.test(name):/\.(AppImage|deb|rpm)$/i.test(name))}
</script>

<dialog class="update-dialog" bind:this={dialog} aria-label={t('updates.title')} aria-busy={result.status==='checking'} oncancel={event=>{event.preventDefault();close()}} onkeydown={event=>{if(event.ctrlKey||event.metaKey)event.stopPropagation()}}>
 <h2>{t('updates.title')}</h2>
 <section aria-live="polite" aria-atomic="true">
  {#if result.status==='checking'}
   <h3>{t('updates.checking')}</h3><p>{t('updates.host')}</p>
  {:else if result.status==='available'}
   <h3>{t('updates.available')}</h3><p class="version">{t('updates.version',{version:result.release.version})}</p>
   {#if result.release.publishedAt}<p>{t('updates.published',{date:formatDate(new Date(result.release.publishedAt),{dateStyle:'long'})})}</p>{/if}
   <p>{t('updates.installed',{version:result.currentVersion})}</p>
   {#if platform&&!installer(result.release.assets)}<p>{t('updates.noInstaller')}</p>{/if}
   <p>{t('updates.manual')}</p><p>{t('updates.sha256')}</p>
  {:else if result.status==='current'}
   <h3>{t('updates.current')}</h3><p>{t('updates.latest',{version:result.currentVersion})}</p>
  {:else if result.status==='error'}
   <h3>{t('updates.failed')}</h3><p>{t(`updates.error.${result.code}`)}</p>
  {/if}
  {#if 'settingsWarning' in result&&result.settingsWarning==='lastCheckNotSaved'}<p data-update-settings-warning>{t('updates.settingsWarning')}</p>{/if}
 </section>
 <p role="status" aria-live="polite">{message}</p>
 <footer>
  {#if result.status==='checking'}<button class="primary" onclick={close}>{t('updates.cancel')}</button>
  {:else}
   {#if result.status==='available'}
    {@const release=result.release}
    <button disabled={busy} onclick={()=>run(()=>window.freya.openUpdate(release.url))}>{t('about.releaseNotes')}</button>
    <button class="primary" disabled={busy} onclick={()=>run(()=>window.freya.openUpdate(release.url))}>{t('updates.download')}</button>
    <button disabled={busy} onclick={()=>run(()=>window.freya.remindUpdate(),true)}>{t('updates.remind')}</button>
    <button disabled={busy} onclick={()=>run(()=>window.freya.skipUpdate(release.version),true)}>{t('updates.skip')}</button>
   {:else if result.status==='error'}<button class="primary" onclick={search}>{t('updates.retry')}</button>{/if}
   <button onclick={close}>{t('about.close')}</button>
  {/if}
 </footer>
</dialog>
<style>
 dialog{width:620px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);margin:auto;padding:24px;border:1px solid var(--border);border-radius:14px;background:var(--panel);color:var(--text);box-shadow:0 16px 70px #0006;overflow:auto}dialog::backdrop{background:#0007}h2{font-size:22px;margin:0 0 24px}h3{font-size:18px;margin:0 0 16px}p{line-height:1.6;overflow-wrap:anywhere;margin:0 0 16px}.version{font-size:17px;font-weight:600}footer{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px;border-top:1px solid var(--border);padding-top:16px}button{white-space:normal;min-height:32px}p[role=status]:empty{display:none}
</style>
