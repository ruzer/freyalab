<script module lang="ts">
 export interface CsvCommand {id:string;label:string;detail:string;disabled:boolean;run:()=>unknown}
</script>
<script lang="ts">
 import {onMount} from 'svelte'
 let {commands,context,onexecute,onclose}:{commands:CsvCommand[];context:string;onexecute:(id:string)=>void;onclose:()=>void}=$props()
 let search=$state(''),dialog:HTMLDialogElement
 const fold=(text:string)=>text.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase()
 const terms=$derived(fold(search).trim().split(/\s+/).filter(Boolean))
 const matches=$derived(commands.filter(command=>terms.every(term=>fold(command.label+' '+command.detail).includes(term))))
 onMount(()=>{dialog.showModal();dialog.querySelector('input')?.focus()})
 $effect(()=>{void matches;if(dialog?.open&&(!dialog.contains(document.activeElement)||document.activeElement?.matches(':disabled')))dialog.querySelector('input')?.focus()})
 function keydown(event:KeyboardEvent){
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onclose();return}
  const target=event.target as HTMLElement,buttons=Array.from(dialog.querySelectorAll<HTMLButtonElement>('.command-list button:not(:disabled)')),index=buttons.indexOf(document.activeElement as HTMLButtonElement)
  if(['ArrowDown','ArrowUp'].includes(event.key)||index>=0&&['Home','End'].includes(event.key)){
   event.preventDefault();buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:index<0?(event.key==='ArrowDown'?0:buttons.length-1):(index+(event.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus()
  }else if(event.key==='Enter'&&target.tagName==='INPUT'){event.preventDefault();const command=matches.find(command=>!command.disabled);if(command)onexecute(command.id)}
 }
</script>
<dialog bind:this={dialog} aria-labelledby="csv-commands-title" oncancel={event=>{event.preventDefault();onclose()}} onkeydown={keydown}>
 <div class="heading"><h3 id="csv-commands-title">Comandos CSV</h3><button aria-label="Cerrar comandos CSV" onclick={onclose}>×</button></div>
 <p>{context}</p>
 <label>Buscar herramienta<input type="search" aria-label="Buscar comando CSV" placeholder="Buscar, reemplazar, filtrar, duplicar…" bind:value={search}/></label>
 <p role="status">{matches.length} comandos encontrados. Las acciones deshabilitadas necesitan otro contexto.</p>
 <ul class="command-list">{#each matches as command (command.id)}<li><button disabled={command.disabled} onclick={()=>onexecute(command.id)}><strong>{command.label}</strong><small>{command.detail}</small></button></li>{/each}</ul>
 {#if !matches.length}<p>No hay comandos que coincidan. Prueba con otra palabra.</p>{/if}
 <p>↑ ↓ para recorrer · Enter para ejecutar · Escape para cerrar. Los cambios usan el historial y las vistas previas existentes.</p>
</dialog>
<style>
 dialog{margin:auto;width:min(620px,90vw);max-height:80vh;overflow:auto;color:var(--text);background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:18px}dialog::backdrop{background:#0007}.heading{display:flex;align-items:center;justify-content:space-between;gap:12px}h3{margin:0;font-size:16px}.heading button{border:0;background:transparent;font-size:20px}label{display:flex;flex-direction:column;gap:6px;margin-top:12px;font-size:12px}input{width:100%;padding:9px;color:var(--text);background:var(--input);border:1px solid var(--border);border-radius:5px}.command-list{list-style:none;padding:0;margin:10px 0;max-height:42vh;overflow:auto}.command-list button{display:flex;flex-direction:column;text-align:left;gap:4px;width:100%;white-space:normal;overflow-wrap:anywhere;padding:8px;border-color:transparent;background:transparent}.command-list button:hover,.command-list button:focus-visible{background:var(--hover)}.command-list button:disabled{cursor:default}strong{font-size:12px;font-weight:500}small,p{font-size:11px;line-height:1.5;color:var(--muted)}p{margin:8px 0}button:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
</style>
