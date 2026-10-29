<script lang="ts">
 import {onMount,tick} from 'svelte'
 import appIcon from '../../../build/icon.png'
 import {t,getUILanguage} from '../lib/i18n.svelte'
 import {platformName,type ApplicationInfo} from '../../shared/app-info'
 let{onclose}:{onclose:()=>void}=$props()
 let dialog:HTMLDialogElement,info=$state<ApplicationInfo>(),message=$state(''),copying=$state(false),showNotices=$state(false),notices=$state<string>(),generation=0
 $effect(()=>{
  getUILanguage();const token=++generation
  void window.freya.appInfo().then(value=>{if(token===generation)info=value}).catch(()=>{if(token===generation)message=t('about.loadFailed')})
 })
 onMount(()=>{
  const origin=document.activeElement instanceof HTMLElement?document.activeElement:null
  dialog.showModal()
  return()=>{generation++;void tick().then(()=>{if(origin?.isConnected)origin.focus({preventScroll:true})})}
 })
 async function copy(){
  copying=true;message=''
  try{await window.freya.copyAppInfo();message=t('about.copied')}
  catch(error){message=error instanceof Error?error.message:t('about.copyFailed')}
  finally{copying=false}
 }
 async function licenses(){
  showNotices=!showNotices
  if(showNotices&&notices===undefined)try{notices=await window.freya.thirdPartyNotices()}catch(error){message=error instanceof Error?error.message:t('about.licensesFailed')}
 }
 async function link(url:string){try{await window.freya.openLink(url)}catch{message=t('about.linkFailed')}}
</script>
<dialog bind:this={dialog} aria-label={t('about.title')} aria-describedby="about-description" oncancel={event=>{event.preventDefault();onclose()}} onkeydown={event=>{if(event.ctrlKey||event.metaKey)event.stopPropagation()}}>
 <div class="content">
  <header><img src={appIcon} alt=""/><h2>{t('about.product')}</h2><p id="about-description">{t('about.description')}</p></header>
  {#if info}
   <dl>
    <dt>{t('about.version')}</dt><dd id="about-version">{info.version}</dd>
    <dt>{t('about.build')}</dt><dd data-info="build">{info.build??t('about.development')}</dd>
    <dt>{t('about.channel')}</dt><dd>{t(`about.channel.${info.channel}`)}</dd>
    <dt>{t('about.electron')}</dt><dd data-info="electron">{info.electron||t('about.unavailable')}</dd>
    <dt>{t('about.chromium')}</dt><dd data-info="chromium">{info.chromium||t('about.unavailable')}</dd>
    <dt>{t('about.node')}</dt><dd data-info="node">{info.node}</dd>
    <dt>{t('about.system')}</dt><dd>{platformName(info.platform)}</dd>
    <dt>{t('about.architecture')}</dt><dd data-info="arch">{info.arch}</dd>
   </dl>
  {:else}<p role="status">{t('about.loading')}</p>{/if}
  <p>{t('about.license')}</p>
  {#if showNotices}<section id="about-notices" aria-label={t('about.thirdParty')}><h3>{t('about.thirdParty')}</h3>{#if notices!==undefined}<textarea readonly aria-label={t('about.thirdParty')} value={notices}></textarea>{:else}<p>{t('about.loading')}</p>{/if}</section>{/if}
  <p class="updates-help">{t('about.updatesPending')}</p>
  <p class="dedication">{t('about.dedication')}</p>
 </div>
 <footer>
  <p role="status" aria-live="polite">{message}</p>
  <button disabled title={t('about.updatesPending')}>{t('about.checkUpdates')}</button>
  <button disabled={!info} onclick={()=>link(`https://github.com/ruzer/freyalab/releases/tag/${encodeURIComponent('v'+info!.version)}`)}>{t('about.releaseNotes')}</button>
  <button onclick={()=>link('https://github.com/ruzer/freyalab')}>{t('about.source')}</button>
  <button aria-expanded={showNotices} aria-controls="about-notices" onclick={licenses}>{t('about.thirdParty')}</button>
  <button disabled={!info||copying} onclick={copy}>{t('about.copy')}</button>
  <button class="primary" onclick={onclose}>{t('about.close')}</button>
 </footer>
</dialog>
<style>
 dialog{width:600px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);margin:auto;padding:20px;border:1px solid var(--border);border-radius:14px;background:var(--panel);color:var(--text);box-shadow:0 16px 70px #0006}
 dialog[open]{display:flex;flex-direction:column;gap:12px}dialog::backdrop{background:#0007}.content{overflow:auto;min-height:0;padding:0 4px}header{text-align:center}header img{display:block;width:64px;height:64px;margin:0 auto}h2{font-size:24px;font-weight:600;line-height:1.25;margin:8px 0}h3{font-size:14px}p{line-height:1.5;margin:8px 0}#about-description{white-space:pre-line}dl{display:grid;grid-template-columns:minmax(120px,auto) minmax(0,1fr);gap:6px 16px;margin:16px 0}dt{font-weight:600}dd{margin:0;overflow-wrap:anywhere}textarea{width:100%;height:180px;max-height:30vh;resize:vertical;white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;line-height:1.5;padding:12px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:7px}.updates-help{font-size:12px}.dedication{text-align:center}p[role=status]{min-height:20px}footer{display:flex;flex-wrap:wrap;gap:8px;padding-top:12px;border-top:1px solid var(--border);flex:none}footer p[role=status]{flex-basis:100%;margin:0}
</style>
