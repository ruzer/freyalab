<script lang="ts">
 import {onMount,tick,type Snippet} from 'svelte'
 let{x,y,label,onclose,children,parentItem}:{x:number;y:number;label:string;onclose:(restoreFocus:boolean,all?:boolean)=>void;children:Snippet;parentItem?:HTMLElement}=$props()
 let menu:HTMLDivElement,left=$state(8),top=$state(8),frame=0
 function position(){
  if(!menu)return
  const bounds=menu.getBoundingClientRect(),parent=parentItem?.closest('[role="menu"]')?.getBoundingClientRect(),anchor=parentItem?.getBoundingClientRect()
  const horizontal=parent?(parent.right+bounds.width<=innerWidth-8?parent.right:parent.left-bounds.width):x
  left=Math.max(8,Math.min(horizontal,innerWidth-bounds.width-8));top=Math.max(8,Math.min(anchor?.top??y,innerHeight-bounds.height-8))
 }
 function reposition(){if(parentItem){cancelAnimationFrame(frame);frame=requestAnimationFrame(position)}else position()}
 function items(){return menu?Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)')).filter(item=>item.closest('[role="menu"]')===menu):[]}
 $effect(()=>{x;y;parentItem;reposition()})
 onMount(()=>{const observer=new ResizeObserver(reposition);observer.observe(menu);const parent=parentItem?.closest('[role="menu"]');if(parent)observer.observe(parent);void tick().then(()=>{position();items()[0]?.focus()});return()=>{observer.disconnect();cancelAnimationFrame(frame)}})
 function key(event:KeyboardEvent){
  if(!(event.target instanceof Element)||event.target.closest('[role="menu"]')!==menu)return
  const choices=items(),current=choices.indexOf(document.activeElement as HTMLElement)
  if(event.key==='Escape'||parentItem&&event.key==='ArrowLeft'){event.preventDefault();event.stopPropagation();onclose(true)}
  else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();choices[event.key==='Home'?0:event.key==='End'?choices.length-1:(current+(event.key==='ArrowDown'?1:choices.length-1))%choices.length]?.focus()}
  else if(event.key==='Tab'){event.stopPropagation();onclose(false,true)}
 }
</script>
<svelte:window onresize={reposition} onpointerdown={event=>{if(menu&&!menu.contains(event.target as Node)&&!parentItem?.contains(event.target as Node))onclose(false)}}/>
<div bind:this={menu} class="range-context" role="menu" aria-label={label} tabindex="-1" style:left={`${left}px`} style:top={`${top}px`} onkeydown={key}>
 {@render children()}
</div>
<style>
 /* Los menús se leen de un vistazo alineados a la izquierda; lo no disponible se ve como desactivado aunque siga siendo enfocable. */
 .range-context :global([role="menuitem"]){justify-content:flex-start;text-align:left}
 .range-context :global([role="menuitem"][aria-disabled="true"]){opacity:.45;cursor:default}
 .range-context :global([role="menuitem"][aria-disabled="true"]:hover){background:transparent}
</style>
