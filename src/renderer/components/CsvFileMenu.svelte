<script lang="ts">
 import {controlHint} from '../lib/control-hint'
 import {onMount} from 'svelte'
 import ContextMenu from './ContextMenu.svelte'
 import {t} from '../lib/i18n.svelte'
 import type {CsvView} from '../../shared/types'
 let {path,x,y,onopen,onclose,onerror,onproject}:{path:string;x:number;y:number;onopen:(path:string,view:CsvView)=>void;onclose:(restoreFocus:boolean)=>void;onerror:(message:string)=>void;onproject?:(path:string)=>void}=$props()
 let allowed=$state(false),loading=$state(true),protection=$state<"protected"|"closed"|undefined>()
 const reason=$derived(loading?'loading':protection==='protected'?'projectProtected':protection==='closed'?'projectClosed':!allowed?'textLimit':null)
 onMount(()=>{let alive=true;void window.freya.csvViewInfo(path).then(info=>{if(alive){allowed=info.textAllowed;protection=info.projectSource;loading=false}}).catch(error=>{if(alive){onerror(String(error));onclose(true)}});return()=>{alive=false}})
 function choose(view:CsvView){const selected=path,open=onopen;onclose(false);open(selected,view)}
</script>
<ContextMenu {x} {y} label={t('csvText.menu')} {onclose}>
 <button role="menuitem" onclick={()=>choose('table')}>{t('csvText.openTable')}</button>
 <button {...controlHint(reason)} {...loading?{title:t('csvText.checkSize')}:reason==='textLimit'?{title:t('csvText.limit')}: {}} role="menuitem" disabled={!!reason}  onclick={()=>choose('text')}>{t('csvText.openText')}</button>
 {#if onproject}<button role="menuitem" onclick={()=>{onclose(false);onproject?.(path)}}>{t('menu.file.addProjectSource')}</button>{/if}
</ContextMenu>
