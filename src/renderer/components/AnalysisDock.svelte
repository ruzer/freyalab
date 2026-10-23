<script lang="ts">
 import type {Snippet} from 'svelte'
 import {DOCK_MIN,clampWidth,dockRange,nextWidth,type DockTab} from '../lib/workspace-layout'
 let {tab,ontab,width,area,onresize,oncommit,resumen,graficos,sql}:{tab:DockTab;ontab:(tab:DockTab)=>void;width:number;area:number;onresize:(width:number)=>void;oncommit:()=>void;resumen:Snippet;graficos:Snippet;sql:Snippet}=$props()
 const tabs:{id:DockTab;label:string}[]=[{id:'resumen',label:'Resumen'},{id:'graficos',label:'Gráficos'},{id:'sql',label:'SQL'}]
 // Una pestaña se monta la primera vez que se visita y después sigue montada, oculta: conserva su configuración y su resultado.
 let visited=$state<DockTab[]>([]),buttons=$state<Partial<Record<DockTab,HTMLButtonElement>>>({})
 const mounted=$derived(visited.includes(tab)?visited:[...visited,tab])
 $effect(()=>{if(!visited.includes(tab))visited=[...visited,tab]})
 // El ancho guardado es la preferencia; el mostrado se ajusta al espacio disponible (sin medir aún, se muestra tal cual).
 const range=$derived(dockRange(area)),shown=$derived(area>0?clampWidth(width,area):width)
 let drag:{x:number;width:number;next?:number;frame?:number}|undefined
 function keyResize(event:KeyboardEvent){const next=nextWidth(shown,event.key,event.shiftKey,area);if(next===null)return;event.preventDefault();onresize(next);oncommit()}
 function startDrag(event:PointerEvent){if(event.button!==0)return;event.preventDefault();(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);drag={x:event.clientX,width:shown}}
 // Mientras se arrastra, el ancho se aplica una vez por fotograma; se guarda una sola vez al soltar.
 function moveDrag(event:PointerEvent){if(!drag)return;drag.next=clampWidth(drag.width+drag.x-event.clientX,area);if(drag.frame===undefined){const current=drag;current.frame=requestAnimationFrame(()=>{current.frame=undefined;if(current.next!==undefined)onresize(current.next)})}}
 function endDrag(){if(!drag)return;if(drag.frame!==undefined)cancelAnimationFrame(drag.frame);if(drag.next!==undefined)onresize(drag.next);drag=undefined;oncommit()}
 function reset(){onresize(DOCK_MIN);oncommit()}
 // Activación manual: las flechas solo mueven el foco, porque cambiar de pestaña puede lanzar trabajo.
 function key(event:KeyboardEvent,index:number){
  const last=tabs.length-1,next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+last)%tabs.length:event.key==='Home'?0:event.key==='End'?last:-1
  if(next<0)return
  event.preventDefault();buttons[tabs[next].id]?.focus()
 }
</script>
<aside class="analysis-dock" id="analysis-dock" aria-label="Panel de análisis" style:flex-basis={`${shown}px`}>
 <!-- Un divisor enfocable es un widget en WAI-ARIA (divisor de ventana): lleva foco y teclado aunque Svelte no lo distinga de un separador estático. -->
 <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
 <div class="dock-handle" role="separator" tabindex="0" aria-label="Ancho del panel" aria-orientation="vertical" aria-controls="analysis-dock" aria-valuemin={range.min} aria-valuemax={range.max} aria-valuenow={shown} onkeydown={keyResize} onpointerdown={startDrag} onpointermove={moveDrag} onpointerup={endDrag} onpointercancel={endDrag} ondblclick={reset}></div>
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
 .analysis-dock{position:relative;flex:0 1 520px;min-width:360px;min-height:0;display:flex;flex-direction:column;border-left:1px solid var(--border);background:var(--panel)}
 .dock-handle{position:absolute;left:0;top:0;bottom:0;width:6px;z-index:2;cursor:col-resize;touch-action:none;background:transparent}
 .dock-handle:hover,.dock-handle:focus-visible{background:var(--accent);opacity:.55;outline:none}
 .dock-tabs{display:flex;gap:2px;padding:6px 8px 0;border-bottom:1px solid var(--border);flex-shrink:0}
 .dock-tabs button{border:0;border-bottom:2px solid transparent;border-radius:5px 5px 0 0;background:transparent;padding:6px 12px}
 .dock-tabs button[aria-selected=true]{border-bottom-color:var(--accent);font-weight:600}
 .dock-panel{flex:1;min-height:0;overflow:auto}
 .dock-panel[hidden]{display:none}
 /* Dentro del panel lateral el único desplazamiento es el del propio panel. */
 .dock-panel :global(section.charts-panel),.dock-panel :global(section.sql-panel),.dock-panel :global(section.statistics-panel){max-height:none;overflow:visible;border-bottom:0}
</style>
