<script lang="ts">
 import type {Snippet} from 'svelte'
 import {DOCK_MIN,clampWidth,dockRange,nextWidth,type DockTab} from '../lib/workspace-layout'
 let {tab,ontab,width,area,expanded,narrow,onexpand,onresize,oncommit,resumen,graficos,sql}:{tab:DockTab;ontab:(tab:DockTab)=>void;width:number;area:number;expanded:boolean;narrow:boolean;onexpand:()=>void;onresize:(width:number)=>void;oncommit:()=>void;resumen:Snippet;graficos:Snippet;sql:Snippet}=$props()
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
 // En la vista ampliada Escape vuelve a acoplar el panel antes de que lo cierre el propio panel; con la ventana estrecha no hay a dónde volver y Escape cierra como siempre.
 function escape(event:KeyboardEvent){if(event.key!=='Escape'||!expanded||narrow)return;event.preventDefault();event.stopPropagation();onexpand()}
 // Activación manual: las flechas solo mueven el foco, porque cambiar de pestaña puede lanzar trabajo.
 function key(event:KeyboardEvent,index:number){
  const last=tabs.length-1,next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+last)%tabs.length:event.key==='Home'?0:event.key==='End'?last:-1
  if(next<0)return
  event.preventDefault();buttons[tabs[next].id]?.focus()
 }
</script>
<aside class="analysis-dock" class:expanded id="analysis-dock" aria-label="Panel de análisis" style:flex-basis={expanded?undefined:`${shown}px`} onkeydowncapture={escape}>
 {#if !expanded}
 <!-- Un divisor enfocable es un widget en WAI-ARIA (divisor de ventana): lleva foco y teclado aunque Svelte no lo distinga de un separador estático. -->
 <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
 <div class="dock-handle" role="separator" tabindex="0" aria-label="Ancho del panel" aria-orientation="vertical" aria-controls="analysis-dock" aria-valuemin={range.min} aria-valuemax={range.max} aria-valuenow={shown} onkeydown={keyResize} onpointerdown={startDrag} onpointermove={moveDrag} onpointerup={endDrag} onpointercancel={endDrag} ondblclick={reset}></div>
 {/if}
 <div class="dock-header">
 <div class="dock-tabs" role="tablist" aria-label="Herramientas de análisis">
  {#each tabs as item,index (item.id)}
   <button role="tab" id="dock-tab-{item.id}" aria-selected={tab===item.id} aria-controls="dock-panel-{item.id}" tabindex={tab===item.id?0:-1} bind:this={buttons[item.id]} onclick={()=>ontab(item.id)} onkeydown={event=>key(event,index)}>{item.label}</button>
  {/each}
 </div>
 {#if !narrow}<button class="dock-expand" title={expanded?'Devuelve el panel junto a la tabla · Escape':'El panel ocupa toda el área de trabajo; la tabla se conserva'} onclick={onexpand}>{expanded?'Acoplar':'Ampliar'}</button>{/if}
 </div>
 {#if narrow}<p class="dock-notice">Ventana estrecha: el panel ocupa toda el área. Oculta el explorador o amplía la ventana para verlo junto a la tabla.</p>{/if}
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
 .analysis-dock.expanded{flex:1 1 0;min-width:0;border-left:0}
 .dock-header{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;padding:6px 8px 0;border-bottom:1px solid var(--border);flex-shrink:0}
 .dock-tabs{display:flex;gap:2px}
 .dock-expand{margin-bottom:4px}
 .dock-notice{margin:0;padding:8px 12px;font-size:11px;color:var(--muted);border-bottom:1px solid var(--border);flex-shrink:0}
 .dock-tabs button{border:0;border-bottom:2px solid transparent;border-radius:5px 5px 0 0;background:transparent;padding:6px 12px}
 .dock-tabs button[aria-selected=true]{border-bottom-color:var(--accent);font-weight:600}
 .dock-panel{flex:1;min-height:0;overflow:auto}
 .dock-panel[hidden]{display:none}
 /* Dentro del panel lateral el único desplazamiento es el del propio panel. */
 .dock-panel :global(section.charts-panel),.dock-panel :global(section.sql-panel),.dock-panel :global(section.statistics-panel){max-height:none;overflow:visible;border-bottom:0}
</style>
