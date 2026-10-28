<script lang="ts">
 import {tick,onMount} from 'svelte'
 import type {Heading} from '../lib/render'
 import {outlineTree,visibleHeading} from '../lib/outline'
 import Icon from './Icon.svelte'
 let {headings,current,onselect,shown=true,collapsed,oncollapse,ready=true,container=$bindable<HTMLDivElement|undefined>(),onscroll}:{headings:Heading[];current?:string;onselect:(heading:Heading)=>void;shown?:boolean;collapsed:ReadonlySet<string>;oncollapse:(next:Set<string>)=>void;ready?:boolean;container?:HTMLDivElement;onscroll?:(top:number)=>void}=$props()
 const nodes=$derived(outlineTree(headings)),visibleCurrent=$derived(visibleHeading(nodes,current,collapsed))
 function toggle(key:string){const next=new Set(collapsed);if(next.has(key))next.delete(key);else next.add(key);oncollapse(next)}
 $effect(()=>{if(!ready)return;const valid=new Set(nodes.map(node=>node.key)),next=new Set([...collapsed].filter(key=>valid.has(key)));if(next.size!==collapsed.size)oncollapse(next)})
 let previous:string|undefined,pending:string|undefined,countBefore=0,widthBefore=0,heightBefore=0
 async function ensureCurrentVisible(id=visibleCurrent){
  if(!shown||!id)return
  await tick()
  if(pending===id)await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
  if(!shown||visibleCurrent!==id||!container?.isConnected||!container.clientHeight)return
  const row=container.querySelector<HTMLButtonElement>(`[data-heading-id="${CSS.escape(id)}"]`)
  if(!row)return
  const outer=container.getBoundingClientRect(),inner=row.getBoundingClientRect()
  const top=outer.top+container.clientTop,bottom=top+container.clientHeight
  if(inner.top<top)container.scrollTop-=top-inner.top
  else if(inner.bottom>bottom)container.scrollTop+=inner.bottom-bottom
  if(pending===id)pending=undefined
 }
 $effect(()=>{
  const id=visibleCurrent,count=nodes.length,visible=shown
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
 {#each nodes as node (node.key)}
  <div class="outline-row" data-outline-row={node.id} hidden={node.ancestors.some(key=>collapsed.has(key))} style:padding-left={`${2+node.depth*10}px`}>
   {#if node.hasChildren}<button class="branch-toggle" aria-expanded={!collapsed.has(node.key)} aria-label={`${collapsed.has(node.key)?'Expandir':'Contraer'} sección ${node.text}`} onclick={()=>toggle(node.key)}><Icon name={collapsed.has(node.key)?'chevron-right':'chevron-down'} size={12}/></button>{:else}<span class="branch-space" aria-hidden="true"></span>{/if}
   <button class="sidebar-heading title" data-heading-id={node.id} aria-current={visibleCurrent===node.id?'location':undefined} aria-label={node.text} title={node.text} onclick={()=>onselect(node)}><span>{node.text}</span></button>
  </div>
 {:else}<p class="sidebar-empty">Este documento no tiene títulos</p>{/each}
</div>
<style>
 .document-outline{flex:1;min-height:0;min-width:0;overflow:auto;padding:4px 0;scroll-behavior:auto}
 .document-outline[hidden]{display:none}
 button{font-size:11px;background:transparent;border:0;display:block;width:100%;white-space:normal;text-align:left;padding:7px 12px;line-height:1.45;color:var(--text)}
 .outline-row{display:flex;align-items:flex-start;min-width:0}
 .outline-row[hidden]{display:none}
 .branch-toggle,.branch-space{width:20px;flex:none;height:30px}
 .branch-toggle{display:flex;align-items:center;justify-content:center;padding:0}
 .title{flex:1;min-width:0;width:auto;padding:7px 6px}
 .title span{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;overflow:hidden;max-height:2.9em}
 button[aria-current=location]{color:var(--text);background:color-mix(in srgb,var(--accent) 12%,var(--bg));box-shadow:inset 2px 0 var(--accent);font-weight:600}
 button:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
</style>
