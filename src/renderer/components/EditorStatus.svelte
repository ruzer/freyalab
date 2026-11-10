<script lang="ts">
 import type {editorPosition} from '../lib/editor-status'
 import {formatNumber,plural,t} from '../lib/i18n.svelte'
 import type {Settings} from '../../shared/settings'
 type Ending='LF'|'CRLF'
 let {position,ending,kind,indent,readonly,onending}:{
  position:ReturnType<typeof editorPosition>;ending:Ending|'CR'|'mixed';kind:string;indent:Settings['editor']['indent'];readonly:boolean;onending:(ending:Ending)=>boolean
 }=$props()
 let announcement=$state('')
 const location=$derived({line:formatNumber(position.line),column:formatNumber(position.column)})
 function portal(node:HTMLElement){
  document.getElementById('document-status')?.appendChild(node)
  return{destroy(){node.remove()}}
 }
 function choose(event:Event&{currentTarget:HTMLSelectElement}){
  const target=event.currentTarget,value=target.value
  if((value==='LF'||value==='CRLF')&&onending(value)){
   // CSV Texto ya anuncia el nuevo formato en el indicador del documento.
   if(kind!=='csv-text')announcement=t('editor.status.endingsChanged',{ending:value})
  }
  else target.value=ending
 }
</script>

<div class="editor-status" role="group" aria-label={t('editor.status.group')} use:portal>
 <span title={t('editor.status.positionLong',location)}>{t('editor.status.position',location)}</span>
 {#if position.selection}
  <span class="selection">{plural('csvText.lines',position.selection.lines)}, {plural('editor.status.characters',position.selection.characters)}</span>
 {/if}
 <select aria-label={t('editor.status.endings')} title={t('editor.status.endingsHint')} disabled={readonly} value={ending} onchange={choose}>
  {#if ending==='CR'||ending==='mixed'}<option value={ending} disabled>{t(`csvText.eol.${ending}`)}</option>{/if}
  <option value="LF">{t('csvText.eol.LF')}</option>
  <option value="CRLF">{t('csvText.eol.CRLF')}</option>
 </select>
 <span>{indent==='tab'?t('editor.status.tabs'):t('editor.status.spaces',{count:formatNumber(indent)})}</span>
 <span>{t(`editor.status.format.${kind}`)}</span>
 <span class="sr-only" role="status" aria-atomic="true">{announcement}</span>
</div>

<style>
 .editor-status{display:flex;align-items:center;gap:8px;min-width:0;white-space:nowrap}
 .selection{min-width:0;overflow:hidden;text-overflow:ellipsis}
 select{flex:none;padding:0 3px;font:inherit;color:inherit}
</style>
