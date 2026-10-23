<script lang="ts" module>
 export type DockTab='resumen'|'graficos'|'sql'
</script>
<script lang="ts">
 import type {Snippet} from 'svelte'
 let {tab,ontab,resumen,graficos,sql}:{tab:DockTab;ontab:(tab:DockTab)=>void;resumen:Snippet;graficos:Snippet;sql:Snippet}=$props()
 const tabs:{id:DockTab;label:string}[]=[{id:'resumen',label:'Resumen'},{id:'graficos',label:'Gráficos'},{id:'sql',label:'SQL'}]
 // Una pestaña se monta la primera vez que se visita y después sigue montada, oculta: conserva su configuración y su resultado.
 let visited=$state<DockTab[]>([]),buttons=$state<Partial<Record<DockTab,HTMLButtonElement>>>({})
 const mounted=$derived(visited.includes(tab)?visited:[...visited,tab])
 $effect(()=>{if(!visited.includes(tab))visited=[...visited,tab]})
 // Activación manual: las flechas solo mueven el foco, porque cambiar de pestaña puede lanzar trabajo.
 function key(event:KeyboardEvent,index:number){
  const last=tabs.length-1,next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+last)%tabs.length:event.key==='Home'?0:event.key==='End'?last:-1
  if(next<0)return
  event.preventDefault();buttons[tabs[next].id]?.focus()
 }
</script>
<aside class="analysis-dock" aria-label="Panel de análisis">
 <div class="dock-tabs" role="tablist" aria-label="Herramientas de análisis">
  {#each tabs as item,index (item.id)}
   <button role="tab" id="dock-tab-{item.id}" aria-selected={tab===item.id} aria-controls="dock-panel-{item.id}" tabindex={tab===item.id?0:-1} bind:this={buttons[item.id]} onclick={()=>ontab(item.id)} onkeydown={event=>key(event,index)}>{item.label}</button>
  {/each}
 </div>
 {#each tabs as item (item.id)}
  <div class="dock-panel" role="tabpanel" id="dock-panel-{item.id}" aria-labelledby="dock-tab-{item.id}" hidden={tab!==item.id}>
   {#if mounted.includes(item.id)}{#if item.id==='resumen'}{@render resumen()}{:else if item.id==='graficos'}{@render graficos()}{:else}{@render sql()}{/if}{/if}
  </div>
 {/each}
</aside>
<style>
 /* Por debajo del ancho validado (520 px) el panel cede espacio a la tabla; F2c lo sustituye por la vista ampliada. */
 .analysis-dock{flex:0 1 520px;min-width:360px;min-height:0;display:flex;flex-direction:column;border-left:1px solid var(--border);background:var(--panel)}
 .dock-tabs{display:flex;gap:2px;padding:6px 8px 0;border-bottom:1px solid var(--border);flex-shrink:0}
 .dock-tabs button{border:0;border-bottom:2px solid transparent;border-radius:5px 5px 0 0;background:transparent;padding:6px 12px}
 .dock-tabs button[aria-selected=true]{border-bottom-color:var(--accent);font-weight:600}
 .dock-panel{flex:1;min-height:0;overflow:auto}
 .dock-panel[hidden]{display:none}
 /* Dentro del panel lateral el único desplazamiento es el del propio panel. */
 .dock-panel :global(section.charts-panel),.dock-panel :global(section.sql-panel),.dock-panel :global(section.statistics-panel){max-height:none;overflow:visible;border-bottom:0}
</style>
