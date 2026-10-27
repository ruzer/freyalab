<script lang="ts">
 import {onMount,onDestroy,tick} from 'svelte'
 import Icon from './Icon.svelte'
 import {diagramSVG,standaloneHTML} from '../lib/render'
 import {explainDiagramError,type DiagramError} from '../lib/diagram-errors'
 let {text,dark,onerror}:{text:string;dark:boolean;onerror:(message:string)=>void}=$props()
 let svg=$state(''),failure=$state<DiagramError|null>(null),busy=$state(false),zoom=$state(1),host:HTMLDivElement,generation=0,completion:Promise<void>=Promise.resolve()
 let disposed=false,validSource:string|undefined,validTheme:boolean|undefined
 let fitted=$state(true),natural=$state({width:1,height:1}),available=$state({width:1,height:1})
 const scale=$derived(fitted?Math.min(available.width/natural.width,available.height/natural.height):zoom)
 const percent=new Intl.NumberFormat('es',{maximumSignificantDigits:3})
 function measure(){
  const element=host?.querySelector('svg');if(!element)return
  let box=element.viewBox.baseVal
  if(!(box.width>0&&box.height>0)){const bounds=element.getBBox();element.setAttribute('viewBox',`${bounds.x} ${bounds.y} ${Math.max(1,bounds.width)} ${Math.max(1,bounds.height)}`);box=element.viewBox.baseVal}
  natural={width:box.width,height:box.height}
  resize()
 }
 function resize(){
  // Un píxel evita el desbordamiento fraccional al redondear clientWidth/clientHeight.
  const style=getComputedStyle(host),width=host.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-1,height=host.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)-1
  if(width>0&&height>0)available={width,height}
 }
 function adjust(){measure();fitted=true;host.scrollTo({top:0,left:0})}
 function changeZoom(value:number){fitted=false;zoom=Math.max(Number.EPSILON,value)}
 async function actualSize(){changeZoom(1);await tick();host.scrollTo({top:0,left:0})}
 function keydown(event:KeyboardEvent){
  if(event.defaultPrevented||failure||!(event.metaKey||event.ctrlKey)||event.altKey)return
  if(event.key==='0')adjust();else if(event.key==='1')void actualSize();else if(event.key==='+'||event.key==='=')changeZoom(scale*1.2);else if(event.key==='-'||event.key==='_')changeZoom(scale/1.2);else return
  event.preventDefault()
 }
 onMount(()=>{const observer=new ResizeObserver(resize);observer.observe(host);return()=>observer.disconnect()})
 $effect(()=>{const markup=svg;if(markup)void tick().then(()=>{if(!disposed&&svg===markup)measure()})})
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
<!-- svelte-ignore a11y_no_static_element_interactions (Atajos locales del lienzo enfocable y de sus botones.) -->
<div class="diagram-panel" onkeydown={keydown}>
 <div class="diagram-toolbar"><span class="tag">MERMAID</span><span class="spacer"></span><button disabled={!!failure} onclick={()=>changeZoom(scale/1.2)} aria-label="Alejar" title="Alejar · Ctrl/Cmd −"><Icon name="zoom-out" size={14}/></button><span>{percent.format(scale*100)}%</span><button disabled={!!failure} onclick={()=>changeZoom(scale*1.2)} aria-label="Acercar" title="Acercar · Ctrl/Cmd +"><Icon name="zoom-in" size={14}/></button><button disabled={!!failure} onclick={adjust} title="Ajustar · Ctrl/Cmd 0"><Icon name="maximize-2" size={14}/> Ajustar</button><button disabled={!!failure} onclick={actualSize} title="Tamaño natural · Ctrl/Cmd 1">100 %</button></div>
 <div class="diagram-view">
  <div class="diagram-feedback" class:diagram-notice={!!failure} class:diagram-error={!!failure&&failure.kind!=='vacio'} class:diagram-empty={failure?.kind==='vacio'}>
   <div role="status" aria-live="polite" aria-atomic="true">{#if failure}{#if svg}<p>Mostrando la última versión válida.</p>{/if}<strong>{failure.title}</strong><p>{failure.hint}</p>{#if failure.line}<p>Ubicación: línea {failure.line}{failure.column?`, columna ${failure.column}`:''}.</p>{/if}{/if}</div>
   {#if failure}
    {#if failure.kind!=='vacio'}<details><summary>Ver detalle técnico</summary><pre>{failure.detail}</pre></details>{/if}
    {#if !svg}<label class="diagram-example">Ejemplo mínimo para copiar<textarea aria-label="Ejemplo mínimo Mermaid" readonly rows="2" value={'flowchart LR\n  A --> B'}></textarea></label>{/if}
   {/if}
  </div>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (El área desplazable recibe foco para usar el desplazamiento nativo con teclado.) -->
  <div class="diagram-canvas" role="region" aria-label="Área de desplazamiento del diagrama" tabindex="0" bind:this={host} onpointerdown={dragStart} onpointermove={dragMove} onpointerup={()=>dragging=false} onpointercancel={()=>dragging=false}>
   {#if svg}<div class="diagram-svg" class:stale={!!failure} inert={!!failure} aria-hidden={failure?'true':undefined} role="img" aria-label="Vista previa del diagrama Mermaid" style:width={`${natural.width*scale}px`} style:height={`${natural.height*scale}px`}>{@html svg}</div>{:else if !failure}<p class="muted">{busy?'Preparando diagrama…':'Escribe una definición Mermaid para empezar.'}</p>{/if}
   {#if busy&&svg}<span class="render-progress">Actualizando…</span>{/if}
  </div>
 </div>
</div>
<style>
 .diagram-view{position:relative;display:flex;flex:1;min-height:0}
 .diagram-canvas{width:100%;display:flex}
 .diagram-svg{flex:none;min-width:0;min-height:0;margin:auto}
 .diagram-svg :global(svg){display:block;width:100%;height:100%;max-width:none!important}
 .diagram-feedback{position:absolute;left:12px;right:12px;top:12px;z-index:10;max-height:70%;overflow:auto;pointer-events:none}
 .diagram-feedback.diagram-notice{pointer-events:auto}
 .diagram-svg.stale{opacity:.45;pointer-events:none;user-select:none}
 .diagram-example{display:flex;flex-direction:column;gap:6px;margin-top:12px;font-size:11px}
 .diagram-example textarea{width:100%;resize:none;font:12px/1.6 'JetBrains Mono',monospace;padding:8px}
</style>
