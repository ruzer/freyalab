<script lang="ts">
 import {onMount} from 'svelte'
 import {t,getUILanguage} from '../lib/i18n.svelte'
 import {formatApplicationShortcut,type ApplicationShortcuts} from '../../shared/application'
 let {onclose}:{onclose:()=>void}=$props()
 let dialog:HTMLDialogElement,origin:HTMLElement|null=null,generation=0
 let data=$state<ApplicationShortcuts>(),query=$state(''),error=$state('')
 const commands=$derived((data?.commands??[]).filter(command=>command.accelerator&&command.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))
 function close(){dialog.close();onclose()}
 $effect(()=>{getUILanguage();const token=++generation;void window.freya.applicationShortcuts().then(value=>{if(token===generation){data=value;error=''}}).catch(()=>{if(token===generation)error=t('shortcuts.error')});return()=>{generation++}})
 onMount(()=>{origin=document.activeElement instanceof HTMLElement?document.activeElement:null;dialog.showModal();return()=>{dialog.close();if(origin?.isConnected)origin.focus()}})
</script>
<dialog bind:this={dialog} class="shortcuts-dialog" aria-labelledby="shortcuts-title" oncancel={event=>{event.preventDefault();close()}}>
 <header><h2 id="shortcuts-title">{t('menu.help.shortcuts')}</h2></header>
 <label>{t('shortcuts.search')}<input bind:value={query}/></label>
 <div class="shortcuts-content">
  {#if error}<p role="status">{error}</p>{:else if !data}<p role="status">{t('shortcuts.loading')}</p>{:else}
   <table><thead><tr><th scope="col">{t('shortcuts.action')}</th><th scope="col">{t('shortcuts.shortcut')}</th></tr></thead><tbody>{#each commands as command (command.id)}<tr><td>{command.label}</td><td><kbd>{formatApplicationShortcut(command.accelerator!,data.platform)}</kbd></td></tr>{/each}</tbody></table>
   {#if !commands.length}<p>{t('shortcuts.empty')}</p>{/if}
  {/if}
 </div>
 <footer><button onclick={close}>{t('about.close')}</button></footer>
</dialog>
<style>
 .shortcuts-dialog{margin:auto;width:min(560px,calc(100vw - 32px));max-height:calc(100vh - 32px);padding:20px;border:1px solid var(--border);border-radius:12px;color:var(--text);background:var(--panel);overflow:hidden}
 .shortcuts-dialog[open]{display:flex;flex-direction:column;gap:16px}.shortcuts-dialog::backdrop{background:#0008}
 h2{margin:0;font-size:20px;font-weight:650}label{display:flex;flex-direction:column;gap:6px;font-size:13px}input{width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text)}
 .shortcuts-content{overflow:auto;min-height:0}table{width:100%;border-collapse:collapse;font-size:13px;text-align:left}th,td{padding:9px 4px;border-bottom:1px solid var(--border)}th{font-weight:600}td:last-child{white-space:nowrap}kbd{font-family:inherit;font-size:12px}footer{display:flex;justify-content:flex-end;flex-shrink:0}button{padding:8px 14px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text)}input:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
</style>
