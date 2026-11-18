<script lang="ts">
 import {onMount,tick,type Snippet} from 'svelte'
 let{x,y,label,onclose,children}:{x:number;y:number;label:string;onclose:(restoreFocus:boolean)=>void;children:Snippet}=$props()
 let menu:HTMLDivElement,left=$state(8),top=$state(8)
 function position(){if(!menu)return;const bounds=menu.getBoundingClientRect();left=Math.max(8,Math.min(x,innerWidth-bounds.width-8));top=Math.max(8,Math.min(y,innerHeight-bounds.height-8))}
 $effect(()=>{x;y;position()})
 onMount(()=>{const observer=new ResizeObserver(position);observer.observe(menu);void tick().then(()=>{position();menu?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus()});return()=>observer.disconnect()})
 function key(event:KeyboardEvent){const items=Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)')),current=items.indexOf(document.activeElement as HTMLElement);if(event.key==='Escape'){event.preventDefault();onclose(true)}else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();items[event.key==='Home'?0:event.key==='End'?items.length-1:(current+(event.key==='ArrowDown'?1:items.length-1))%items.length]?.focus()}else if(event.key==='Tab')onclose(false)}
</script>
<svelte:window onresize={position} onpointerdown={event=>{if(menu&&!menu.contains(event.target as Node))onclose(false)}}/>
<div bind:this={menu} class="range-context" role="menu" aria-label={label} tabindex="-1" style:left={`${left}px`} style:top={`${top}px`} onkeydown={key}>
 {@render children()}
</div>
<style>
 /* Los menús se leen de un vistazo alineados a la izquierda; lo no disponible se ve como desactivado aunque siga siendo enfocable. */
 .range-context :global([role="menuitem"]){justify-content:flex-start;text-align:left}
 .range-context :global([role="menuitem"][aria-disabled="true"]){opacity:.45;cursor:default}
 .range-context :global([role="menuitem"][aria-disabled="true"]:hover){background:transparent}
</style>
