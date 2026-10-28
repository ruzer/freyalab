<script lang="ts">
 import {tick,onMount} from 'svelte'
 import type {Heading} from '../lib/render'
 let {headings,current,onselect,shown=true,container=$bindable<HTMLDivElement|undefined>(),onscroll}:{headings:Heading[];current?:string;onselect:(heading:Heading)=>void;shown?:boolean;container?:HTMLDivElement;onscroll?:(top:number)=>void}=$props()
 let previous:string|undefined,pending:string|undefined,countBefore=0,widthBefore=0,heightBefore=0
 async function ensureCurrentVisible(id=current){
  if(!shown||!id)return
  await tick()
  if(pending===id)await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
  if(!shown||current!==id||!container?.isConnected||!container.clientHeight)return
  const row=container.querySelector<HTMLButtonElement>(`[data-heading-id="${CSS.escape(id)}"]`)
  if(!row)return
  const outer=container.getBoundingClientRect(),inner=row.getBoundingClientRect()
  const top=outer.top+container.clientTop,bottom=top+container.clientHeight
  if(inner.top<top)container.scrollTop-=top-inner.top
  else if(inner.bottom>bottom)container.scrollTop+=inner.bottom-bottom
  if(pending===id)pending=undefined
 }
 $effect(()=>{
  const id=current,count=headings.length,visible=shown
  if(id!==previous){previous=id;pending=id}
  const changed=count!==countBefore;countBefore=count
  if(!visible){widthBefore=heightBefore=0;return}
  if(id&&(pending||changed))void ensureCurrentVisible(id)
 })
 onMount(()=>{
  const element=container;if(!element)return
  const observer=new ResizeObserver(()=>{
   const width=element.clientWidth,height=element.clientHeight
   if(!shown||!width||!height){widthBefore=heightBefore=0;return}
   const resized=widthBefore>0&&heightBefore>0&&(width!==widthBefore||height!==heightBefore)
   widthBefore=width;heightBefore=height
   // Volver a la pestaña conserva el scroll manual si la sección actual no cambió.
   if(pending||resized)void ensureCurrentVisible()
  });observer.observe(element)
  return()=>observer.disconnect()
 })
</script>
<div class="document-outline" hidden={!shown} bind:this={container} onscroll={event=>{if(event.currentTarget.clientHeight)onscroll?.(event.currentTarget.scrollTop)}}>
 {#each headings as heading (heading.id)}
  <button class="sidebar-heading" data-heading-id={heading.id} aria-current={current===heading.id?'location':undefined} style:padding-left={`${12+(heading.level-1)*10}px`} onclick={()=>onselect(heading)}>{heading.text}</button>
 {:else}<p class="sidebar-empty">Este documento no tiene títulos</p>{/each}
</div>
<style>
 .document-outline{flex:1;min-height:0;min-width:0;overflow:auto;padding:4px 0;scroll-behavior:auto}
 .document-outline[hidden]{display:none}
 button{font-size:11px;background:transparent;border:0;display:block;width:100%;white-space:normal;text-align:left;padding:7px 12px;line-height:1.45;color:var(--text)}
 button[aria-current=location]{color:var(--text);background:color-mix(in srgb,var(--accent) 12%,var(--bg));box-shadow:inset 2px 0 var(--accent);font-weight:600}
 button:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
</style>
