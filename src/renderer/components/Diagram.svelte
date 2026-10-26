<script lang="ts">
 import {onDestroy,tick} from 'svelte'
 import Icon from './Icon.svelte'
 import {diagramSVG,standaloneHTML} from '../lib/render'
 import {explainDiagramError,type DiagramError} from '../lib/diagram-errors'
 let {text,dark,onerror}:{text:string;dark:boolean;onerror:(message:string)=>void}=$props()
 let svg=$state(''),failure=$state<DiagramError|null>(null),busy=$state(false),zoom=$state(1),host:HTMLDivElement,generation=0,completion:Promise<void>=Promise.resolve()
 let disposed=false,validSource:string|undefined,validTheme:boolean|undefined
 $effect(()=>{
  const source=text,theme=dark,token=++generation;busy=true
  let finish:()=>void=()=>{};completion=new Promise<void>(resolve=>finish=resolve)
  const timer=setTimeout(async()=>{
   try{const result=await diagramSVG(source,theme);if(token!==generation)return;svg=result;validSource=source;validTheme=theme;failure=null}
   catch(error){if(token===generation)failure=explainDiagramError(error instanceof Error?error.message:String(error),source)}
   finally{if(token===generation)busy=false;finish()}
  },150)
  return()=>{clearTimeout(timer);finish()}
 })
 onDestroy(()=>{disposed=true;generation++})
 export async function exportSVG(){await tick();while(busy&&!disposed)await completion;if(disposed||failure||!svg||validSource!==text||validTheme!==dark)throw new Error('Corrige el diagrama antes de exportar.');return svg}
 export async function exportHTML(){return standaloneHTML(await exportSVG(),'Diagrama Mermaid')}
 let dragging=false,x=0,y=0,left=0,top=0
 function dragStart(event:PointerEvent){if(failure||event.button!==0)return;dragging=true;x=event.clientX;y=event.clientY;left=host.scrollLeft;top=host.scrollTop;host.setPointerCapture(event.pointerId)}
 function dragMove(event:PointerEvent){if(dragging&&!failure){host.scrollLeft=left-event.clientX+x;host.scrollTop=top-event.clientY+y}}
</script>
<div class="diagram-panel">
 <div class="diagram-toolbar"><span class="tag">MERMAID</span><span class="spacer"></span><button disabled={!!failure} onclick={()=>zoom=Math.max(.2,zoom-.1)} aria-label="Alejar"><Icon name="zoom-out" size={14}/></button><span>{Math.round(zoom*100)}%</span><button disabled={!!failure} onclick={()=>zoom=Math.min(5,zoom+.1)} aria-label="Acercar"><Icon name="zoom-in" size={14}/></button><button disabled={!!failure} onclick={()=>{zoom=1;host.scrollTo({top:0,left:0})}}><Icon name="maximize-2" size={14}/> Ajustar</button></div>
 <div class="diagram-view">
  <div class="diagram-feedback" class:diagram-notice={!!failure} class:diagram-error={!!failure}>
   <div role="status" aria-live="polite" aria-atomic="true">{#if failure}{#if svg}<p>Mostrando la última versión válida.</p>{/if}<strong>{failure.title}</strong><p>{failure.hint}</p>{#if failure.line}<p>Ubicación: línea {failure.line}{failure.column?`, columna ${failure.column}`:''}.</p>{/if}{/if}</div>
   {#if failure}
    <details><summary>Ver detalle técnico</summary><pre>{failure.detail}</pre></details>
    {#if !svg}<label class="diagram-example">Ejemplo mínimo para copiar<textarea aria-label="Ejemplo mínimo Mermaid" readonly rows="2" value={'flowchart LR\n  A --> B'}></textarea></label>{/if}
   {/if}
  </div>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (El área desplazable recibe foco para usar el desplazamiento nativo con teclado.) -->
  <div class="diagram-canvas" role="region" aria-label="Área de desplazamiento del diagrama" tabindex="0" bind:this={host} onpointerdown={dragStart} onpointermove={dragMove} onpointerup={()=>dragging=false} onpointercancel={()=>dragging=false}>
   {#if svg}<div class="diagram-svg" class:stale={!!failure} inert={!!failure} aria-hidden={failure?'true':undefined} role="img" aria-label="Vista previa del diagrama Mermaid" style:width={`${zoom*100}%`} style:min-width={`${zoom*100}%`}>{@html svg}</div>{:else if !failure}<p class="muted">{busy?'Preparando diagrama…':'Escribe una definición Mermaid para empezar.'}</p>{/if}
   {#if busy&&svg}<span class="render-progress">Actualizando…</span>{/if}
  </div>
 </div>
</div>
<style>
 .diagram-view{position:relative;display:flex;flex:1;min-height:0}
 .diagram-canvas{width:100%}
 .diagram-feedback{position:absolute;left:12px;right:12px;top:12px;z-index:10;max-height:70%;overflow:auto;pointer-events:none}
 .diagram-feedback.diagram-notice{pointer-events:auto}
 .diagram-svg.stale{opacity:.45;pointer-events:none;user-select:none}
 .diagram-example{display:flex;flex-direction:column;gap:6px;margin-top:12px;font-size:11px}
 .diagram-example textarea{width:100%;resize:none;font:12px/1.6 'JetBrains Mono',monospace;padding:8px}
</style>
