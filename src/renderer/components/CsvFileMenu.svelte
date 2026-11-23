<script lang="ts">
 import {controlHint} from '../lib/control-hint'
 import {onMount} from 'svelte'
 import ContextMenu from './ContextMenu.svelte'
 import {t} from '../lib/i18n.svelte'
 import type {CsvView} from '../../shared/types'
 let {path,x,y,directory=false,onopen,onfileopen,onclose,onerror,onproject}:{path:string;x:number;y:number;directory?:boolean;onfileopen:(path:string)=>void;onopen:(path:string,view:CsvView)=>void;onclose:(restoreFocus:boolean)=>void;onerror:(message:string)=>void;onproject?:(path:string)=>void}=$props()
 let allowed=$state(false),loading=$state(true),protection=$state<"protected"|"closed"|undefined>()
 const isCsv=$derived(!directory&&/\.(csv|tsv)$/i.test(path)),name=$derived(path.split(/[\\/]/).at(-1)??path)
 const reason=$derived(loading?'loading':protection==='protected'?'projectProtected':protection==='closed'?'projectClosed':!allowed?'textLimit':null)
 onMount(()=>{if(!isCsv){loading=false;return}let alive=true;void window.freya.csvViewInfo(path).then(info=>{if(alive){allowed=info.textAllowed;protection=info.projectSource;loading=false}}).catch(error=>{if(alive){onerror(String(error));onclose(true)}});return()=>{alive=false}})
 function choose(view:CsvView){const selected=path,open=onopen;onclose(false);open(selected,view)}
 function reveal(){const selected=path;onclose(true);void window.freya.fileShow(selected).catch(error=>onerror(String(error)))}
</script>
<ContextMenu {x} {y} label={isCsv?t('csvText.menu'):name} {onclose}>
 <div class="column-menu-items">
  <span class="dropdown-label column-menu-title" role="presentation">{name}</span>
  {#if isCsv}
   <button role="menuitem" onclick={()=>choose('table')}>{t('csvText.openTable')}</button>
   <button {...controlHint(reason)} {...loading?{title:t('csvText.checkSize')}:reason==='textLimit'?{title:t('csvText.limit')}: {}} role="menuitem" disabled={!!reason} onclick={()=>choose('text')}>{t('csvText.openText')}</button>
   {#if onproject}<button role="menuitem" onclick={()=>{onclose(false);onproject?.(path)}}>{t('menu.file.addProjectSource')}</button>{/if}
  {:else if !directory}<button role="menuitem" onclick={()=>{const selected=path;onclose(false);onfileopen(selected)}}>{t('context.open')}</button>{/if}
  {#if !directory}<div class="column-menu-separator" role="separator"></div>{/if}
  <button role="menuitem" onclick={reveal}>{t('project.showFolder')}</button>
 </div>
</ContextMenu>
