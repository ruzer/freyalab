<script lang="ts">
 import {onMount,tick} from 'svelte'
 import type {CsvView} from '../../shared/types'
 let {path,x,y,onopen,onclose,onerror}:{path:string;x:number;y:number;onopen:(path:string,view:CsvView)=>void;onclose:(restoreFocus:boolean)=>void;onerror:(message:string)=>void}=$props()
 let menu:HTMLDivElement,allowed=$state(false),loading=$state(true)
 onMount(()=>{let alive=true;void window.freya.csvViewInfo(path).then(info=>{if(alive){allowed=info.textAllowed;loading=false}}).catch(error=>{if(alive){onerror(String(error));onclose(true)}});void tick().then(()=>menu?.querySelector<HTMLButtonElement>('button')?.focus());return()=>{alive=false}})
 function key(event:KeyboardEvent){const items=Array.from(menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')),current=items.indexOf(document.activeElement as HTMLButtonElement);if(event.key==='Escape'){event.preventDefault();onclose(true)}else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();items[event.key==='Home'?0:event.key==='End'?items.length-1:(current+(event.key==='ArrowDown'?1:items.length-1))%items.length]?.focus()}else if(event.key==='Tab')onclose(false)}
 function choose(view:CsvView){const selected=path,open=onopen;onclose(false);open(selected,view)}
</script>
<svelte:window onpointerdown={event=>{if(menu&&!menu.contains(event.target as Node))onclose(false)}}/>
<div bind:this={menu} class="range-context" role="menu" aria-label="Abrir CSV" tabindex="-1" style:left={`${Math.max(8,Math.min(x,innerWidth-268))}px`} style:top={`${Math.max(8,Math.min(y,innerHeight-100))}px`} onkeydown={key}>
 <button role="menuitem" onclick={()=>choose('table')}>Abrir como tabla</button>
 <button role="menuitem" disabled={loading||!allowed} title={loading?'Comprobando el tamaño…':!allowed?'El modo Texto admite hasta 10 MiB. Usa la tabla.':undefined} onclick={()=>choose('text')}>Abrir como texto</button>
</div>
