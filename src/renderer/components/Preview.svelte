<script lang="ts">
 import {tick,onMount} from 'svelte'
 import {markdownHTML,diagramSVG,standaloneHTML,type Heading} from '../lib/render'
 let {text,id,dark=false,onheadings,onerror}:{text:string;id:string;dark?:boolean;onheadings:(headings:Heading[])=>void;onerror:(message:string)=>void}=$props()
 let html=$state(''),busy=$state(false),container:HTMLElement
 let generation=0,completion:Promise<void>=Promise.resolve(),renderError='',missing=0
 export function scrollToHeading(anchor:string){container?.querySelector(`[id="${CSS.escape(anchor)}"]`)?.scrollIntoView({behavior:'smooth',block:'start'})}
 export function scrollRatio(ratio:number){if(container) container.scrollTop=ratio*Math.max(0,container.scrollHeight-container.clientHeight)}
 export function missingImages(){return missing}
 export async function exportHTML(){while(busy)await completion;if(renderError)throw new Error(renderError);return standaloneHTML(container?.querySelector('article')?.innerHTML??html,'Documento FreyaLab')}
 $effect(()=>{
  const source=text,docId=id,theme=dark,token=++generation
  busy=true;renderError='';missing=0
  let finish:()=>void=()=>{};completion=new Promise<void>(resolve=>finish=resolve)
  const timer=setTimeout(async()=>{
   try{
    const result=await markdownHTML(source)
    if(token!==generation)return
    html=result.html;onheadings(result.headings);await tick()
    for(const image of container.querySelectorAll('img')){
     const src=image.getAttribute('src')??''
     const data=await window.freya.image(docId,src).catch(()=>null)
     if(token!==generation)return
     if(data)image.src=data;else{image.removeAttribute('src');image.alt=`Imagen no disponible: ${image.alt||src}`;missing++}
    }
    for(const code of container.querySelectorAll('code.language-mermaid')){
     try{const svg=await diagramSVG(code.textContent??'',theme);if(token!==generation)return;const block=document.createElement('div');block.className='mermaid-render';block.innerHTML=svg;code.parentElement?.replaceWith(block)}
     catch(error){const message=error instanceof Error?error.message:String(error);const block=document.createElement('pre');block.className='diagram-error';block.textContent=`Diagrama Mermaid: ${message}`;code.parentElement?.replaceWith(block)}
    }
   }catch(error){if(token===generation){renderError=error instanceof Error?error.message:String(error);onerror(renderError)}}
   finally{if(token===generation)busy=false;finish()}
  },150)
  return()=>{clearTimeout(timer);finish()}
 })
 onMount(()=>{container.addEventListener('click',linkClick);return()=>container.removeEventListener('click',linkClick)})
 function linkClick(event:MouseEvent){const anchor=(event.target as Element).closest('a');if(!anchor)return;event.preventDefault();const href=anchor.getAttribute('href')??'';if(href.startsWith('#')){scrollToHeading(href.slice(1));return}window.freya.openLink(href).catch(error=>onerror(String(error)))}
</script>
<section class="preview" bind:this={container} aria-label="Vista previa del documento" role="document">
 {#if busy}<span class="render-progress">Actualizando vista previa…</span>{/if}
 <article class="markdown-body">{@html html}</article>
</section>
