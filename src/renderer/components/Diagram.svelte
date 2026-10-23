<script lang="ts">
 import Icon from './Icon.svelte'
 import {diagramSVG,standaloneHTML} from '../lib/render'
 let {text,dark,onerror}:{text:string;dark:boolean;onerror:(message:string)=>void}=$props()
 let svg=$state(''),error=$state(''),busy=$state(false),zoom=$state(1),host:HTMLDivElement,generation=0,completion:Promise<void>=Promise.resolve()
 $effect(()=>{const source=text,theme=dark,token=++generation;busy=true;let finish:()=>void=()=>{};completion=new Promise<void>(resolve=>finish=resolve);const timer=setTimeout(async()=>{try{const result=await diagramSVG(source,theme);if(token!==generation)return;svg=result;error=''}catch(e){if(token===generation){error=e instanceof Error?e.message:String(e);svg=''}}finally{if(token===generation)busy=false;finish()}},150);return()=>{clearTimeout(timer);finish()}})
 export async function exportSVG(){while(busy)await completion;if(error||!svg)throw new Error('Corrige el diagrama antes de exportar.');return svg}
 export async function exportHTML(){return standaloneHTML(await exportSVG(),'Diagrama Mermaid')}
 let dragging=false,x=0,y=0,left=0,top=0
 function dragStart(event:PointerEvent){if(event.button!==0)return;dragging=true;x=event.clientX;y=event.clientY;left=host.scrollLeft;top=host.scrollTop;host.setPointerCapture(event.pointerId)}
 function dragMove(event:PointerEvent){if(dragging){host.scrollLeft=left-event.clientX+x;host.scrollTop=top-event.clientY+y}}
</script>
<div class="diagram-panel"><div class="diagram-toolbar"><span class="tag">MERMAID</span><span class="spacer"></span><button onclick={()=>zoom=Math.max(.2,zoom-.1)} aria-label="Alejar"><Icon name="zoom-out" size={14}/></button><span>{Math.round(zoom*100)}%</span><button onclick={()=>zoom=Math.min(5,zoom+.1)} aria-label="Acercar"><Icon name="zoom-in" size={14}/></button><button onclick={()=>{zoom=1;host.scrollTo({top:0,left:0})}}><Icon name="maximize-2" size={14}/> Ajustar</button></div><div class="diagram-canvas" bind:this={host} onpointerdown={dragStart} onpointermove={dragMove} onpointerup={()=>dragging=false} onpointercancel={()=>dragging=false} role="img" aria-label="Vista previa del diagrama Mermaid">{#if error}<div class="diagram-error"><strong>Revisa la definición del diagrama</strong><pre>{error}</pre></div>{:else if svg}<div class="diagram-svg" style:width={`${zoom*100}%`} style:min-width={`${zoom*100}%`}>{@html svg}</div>{:else}<p class="muted">{busy?'Preparando diagrama…':'Escribe una definición Mermaid para empezar.'}</p>{/if}{#if busy&&svg}<span class="render-progress">Actualizando…</span>{/if}</div></div>
