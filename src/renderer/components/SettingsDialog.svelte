<script lang="ts">
 import {onMount,tick} from 'svelte'
 import {t,formatNumber,formatDate} from '../lib/i18n.svelte'
 import {defaultSettings,type Settings,type SettingsPatch,type SettingsState} from '../../shared/settings'
 let{settings,onsave,onreset,onclearrecents,onshowdata,onupdates,onclose}:{settings:SettingsState;onsave:(patch:SettingsPatch)=>Promise<void>;onreset:()=>Promise<boolean>;onclearrecents:()=>Promise<boolean>;onshowdata:()=>Promise<void>;onupdates:()=>void;onclose:()=>void}=$props()
 const sections=['general','appearance','files','updates','privacy','advanced'] as const
 type Section=typeof sections[number]
 let section=$state<Section>('general'),dialog:HTMLDialogElement,busy=$state(false),message=$state('')
 onMount(()=>{
  const origin=document.activeElement instanceof HTMLElement?document.activeElement:null;dialog.showModal()
  return()=>{void tick().then(()=>{if(origin?.isConnected)origin.focus({preventScroll:true})})}
 })
 async function run(operation:()=>Promise<void|boolean>,success='settings.applied'){
  busy=true;message=t('settings.saving')
  try{message=await operation()===false?'':success?t(success):''}catch(error){message=error instanceof Error?error.message:t('settings.writeFailed')}finally{busy=false}
 }
 const save=(patch:SettingsPatch)=>run(()=>onsave(patch))
 async function navKey(event:KeyboardEvent){
  const index=sections.indexOf(section)
  if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return
  event.preventDefault();section=event.key==='Home'?sections[0]:event.key==='End'?sections.at(-1)!:sections[(index+(event.key==='ArrowDown'?1:-1)+sections.length)%sections.length]
  await tick();dialog.querySelector<HTMLButtonElement>(`#settings-tab-${section}`)?.focus()
 }
 function resetSection(){
  const values=defaultSettings()
  if(section==='general')void save({idioma:values.idioma})
  else if(section==='appearance')void save({tema:values.tema,barraLateral:values.barraLateral,markdown:values.markdown,division:values.division})
  else if(section==='updates')void save({actualizaciones:values.actualizaciones})
  else if(section==='advanced')void save({avanzado:values.avanzado})
 }
 async function security(){await run(()=>window.freya.openLink('https://github.com/ruzer/freyalab/blob/main/SECURITY.md'),'')}
</script>

<dialog bind:this={dialog} aria-label={t('settings.title')} aria-busy={busy} oncancel={event=>{event.preventDefault();if(!busy)onclose()}} onkeydown={event=>{if(event.ctrlKey||event.metaKey)event.stopPropagation()}}>
 <h2>{t('settings.title')}</h2>
 <div class="settings-content">
  <div class="settings-nav" role="tablist" aria-label={t('settings.sections')} aria-orientation="vertical">
   {#each sections as item}<button id="settings-tab-{item}" role="tab" aria-selected={section===item} aria-controls="settings-panel-{item}" tabindex={section===item?0:-1} onkeydown={navKey} onclick={()=>{section=item;message=''}}>{t(`settings.section.${item}`)}</button>{/each}
  </div>
  <div class="settings-panel" id="settings-panel-{section}" role="tabpanel" aria-labelledby="settings-tab-{section}" tabindex="0">
   <h3>{t(`settings.section.${section}`)}</h3>
   {#if settings.notice}<p class="notice">{settings.notice}</p>{/if}
   {#if section==='general'}
    <p><strong>{t('settings.language')}</strong>: {t(`settings.language.${settings.values.idioma}`)}</p>
    <p>{t('settings.languageDeferred')}</p>
   {:else if section==='appearance'}
    <fieldset disabled={busy||settings.readonly}>
     <label>{t('settings.theme')}<select aria-label={t('settings.theme')} value={settings.values.tema} onchange={event=>save({tema:event.currentTarget.value as Settings['tema']})}><option value="system">{t('menu.view.theme.system')}</option><option value="light">{t('menu.view.theme.light')}</option><option value="dark">{t('menu.view.theme.dark')}</option></select></label>
     <label class="check"><input type="checkbox" checked={settings.values.barraLateral.visible} onchange={event=>save({barraLateral:{visible:event.currentTarget.checked}})}/>{t('settings.sidebarVisible')}</label>
     <label>{t('settings.sidebarWidth',{value:formatNumber(settings.values.barraLateral.ancho)})}<input type="range" aria-label={t('settings.sidebarWidth.label')} min="180" max="420" step="any" value={settings.values.barraLateral.ancho} onchange={event=>save({barraLateral:{ancho:event.currentTarget.valueAsNumber}})}/></label>
     <label>{t('settings.markdownMode')}<select aria-label={t('settings.markdownMode')} value={settings.values.markdown.modoInicial} onchange={event=>save({markdown:{modoInicial:event.currentTarget.value as Settings['markdown']['modoInicial']}})}><option value="edit">{t('menu.view.mode.edit')}</option><option value="split">{t('menu.view.mode.split')}</option><option value="preview">{t('menu.view.mode.preview')}</option></select></label>
     <p>{t('settings.markdownMode.help')}</p>
     <label>{t('settings.split',{value:formatNumber(settings.values.division)})}<input type="range" aria-label={t('settings.split.label')} min="20" max="80" step="any" value={settings.values.division} onchange={event=>save({division:event.currentTarget.valueAsNumber})}/></label>
    </fieldset>
   {:else if section==='files'}
    <p>{t('settings.recents.help')}</p>
    <button disabled={busy} onclick={()=>run(onclearrecents,'settings.recentsCleared')}>{t('settings.clearRecents')}</button>
   {:else if section==='updates'}
    <button disabled={busy} onclick={onupdates}>{t('about.checkUpdates')}</button>
    <fieldset disabled={busy||settings.readonly}><label class="check"><input type="checkbox" checked={settings.values.actualizaciones.buscarAlIniciar} onchange={event=>save({actualizaciones:{buscarAlIniciar:event.currentTarget.checked}})}/>{t('settings.updates.atStartup')}</label></fieldset>
    <p>{t('settings.updates.last',{value:settings.values.actualizaciones.ultimaComprobacion?formatDate(new Date(settings.values.actualizaciones.ultimaComprobacion)):t('settings.updates.never')})}</p>
    <p>{t('settings.updates.skipped',{count:formatNumber(settings.values.actualizaciones.versionesOmitidas.length)})}</p>
    {#if settings.values.actualizaciones.versionesOmitidas.length}<ul class="skipped-versions">{#each settings.values.actualizaciones.versionesOmitidas as version}<li>{version}</li>{/each}</ul>{/if}
    <button disabled={busy||settings.readonly||!settings.values.actualizaciones.versionesOmitidas.length} onclick={()=>save({actualizaciones:{versionesOmitidas:[]}})}>{t('updates.forget')}</button>
   {:else if section==='privacy'}
    <p>{t('settings.privacy.local')}</p><p>{t('settings.privacy.updates')}</p>
    <button disabled={busy} onclick={security}>{t('menu.help.security')}</button>
   {:else if section==='advanced'}
    <fieldset disabled={busy||settings.readonly}><label class="check"><input type="checkbox" checked={settings.values.avanzado.herramientasDeDesarrollo} onchange={event=>save({avanzado:{herramientasDeDesarrollo:event.currentTarget.checked}})}/>{t('settings.devTools')}</label></fieldset>
    <p>{t('settings.devTools.help')}</p>
    <button disabled={busy} onclick={()=>run(onshowdata,'settings.folderOpened')}>{t('settings.showDataFolder')}</button>
    <p>{t('settings.reset.help')}</p>
    <button disabled={busy||settings.readonly} onclick={()=>run(onreset,'settings.resetDone')}>{t('settings.resetAll')}</button>
   {/if}
   {#if section==='general'||section==='appearance'||section==='updates'||section==='advanced'}<button class="reset-section" disabled={busy||settings.readonly} onclick={resetSection}>{t('settings.resetSection')}</button>{/if}
  </div>
 </div>
 <footer><p role="status" aria-live="polite">{message}</p><button class="primary" disabled={busy} onclick={onclose}>{t('about.close')}</button></footer>
</dialog>

<style>
 .skipped-versions{padding-left:20px;overflow-wrap:anywhere}
 dialog{width:900px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);margin:auto;padding:20px;border:1px solid var(--border);border-radius:14px;background:var(--panel);color:var(--text);box-shadow:0 16px 70px #0006}dialog[open]{display:flex;flex-direction:column;gap:16px}dialog::backdrop{background:#0007}h2{font-size:22px;font-weight:600;line-height:1.3;margin:0}h3{font-size:16px;font-weight:600;margin:0 0 16px}.settings-content{display:flex;gap:20px;min-height:0;overflow:hidden}.settings-nav{display:flex;flex-direction:column;gap:4px;flex:0 0 160px;overflow:auto}.settings-nav button{border-color:transparent;background:transparent;text-align:left;white-space:normal;min-height:32px}.settings-nav button[aria-selected=true]{background:var(--hover);border-color:var(--border);font-weight:600}.settings-panel{flex:1;min-width:0;min-height:0;overflow:auto;padding:2px 8px 8px}.settings-panel:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}fieldset{border:0;padding:0;margin:0;min-width:0}label{display:flex;flex-direction:column;align-items:stretch;gap:8px;margin:0 0 16px;font-weight:500}label.check{flex-direction:row;align-items:center;font-weight:400}label.check input{flex:none}input[type=range]{width:100%;padding:0;accent-color:var(--accent)}select{width:min(100%,280px)}p{margin:0 0 16px;line-height:1.6;overflow-wrap:anywhere}.notice{padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:7px}.reset-section{display:block;margin-top:24px}footer{display:flex;flex:none;gap:12px;align-items:center;border-top:1px solid var(--border);padding-top:12px}footer p{flex:1;min-width:0;min-height:20px;margin:0}footer button{flex:none}@media(max-width:760px){.settings-nav{flex-basis:132px}.settings-content{gap:12px}dialog{padding:16px}}
</style>
