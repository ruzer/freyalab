<script lang="ts">
 import {tick,onMount,onDestroy} from 'svelte'
 import {explainDiagramError} from '../lib/diagram-errors'
 import {markdownHTML,diagramSVG,standaloneHTML,type Heading} from '../lib/render'
 let {text,id,dark=false,onheadings,onerror}:{text:string;id:string;dark?:boolean;onheadings:(headings:Heading[])=>void;onerror:(message:string)=>void}=$props()
 let html=$state(''),busy=$state(false),announcement=$state(''),container:HTMLElement
 let generation=0,completion:Promise<void>=Promise.resolve(),renderError='',missing=0,disposed=false
 export function scrollToHeading(anchor:string){container?.querySelector(`[id="${CSS.escape(anchor)}"]`)?.scrollIntoView({behavior:'smooth',block:'start'})}
 export function scrollRatio(ratio:number){if(container) container.scrollTop=ratio*Math.max(0,container.scrollHeight-container.clientHeight)}
 export function missingImages(){return missing}
 export async function exportHTML(){await tick();while(busy&&!disposed)await completion;if(disposed)throw new Error('El documento se cerró antes de terminar la vista previa.');if(renderError)throw new Error(renderError);return standaloneHTML(container?.querySelector('article')?.innerHTML??html,'Documento FreyaLab')}
 $effect(()=>{
  const source=text,docId=id,theme=dark,token=++generation
  busy=true;renderError='';missing=0
  let finish:()=>void=()=>{};completion=new Promise<void>(resolve=>finish=resolve)
  const timer=setTimeout(async()=>{
   try{
    const result=await markdownHTML(source)
    if(token!==generation)return
    const article=document.createElement('article');article.innerHTML=result.html
    const errors:string[]=[]
    for(const image of article.querySelectorAll('img')){
     const src=image.getAttribute('src')??''
     const data=await window.freya.image(docId,src).catch(()=>null)
     if(token!==generation)return
     if(data)image.src=data;else{image.removeAttribute('src');image.alt=`Imagen no disponible: ${image.alt||src}`;missing++}
    }
    let diagram=0
    for(const code of article.querySelectorAll('code.language-mermaid')){
     diagram++
     try{const svg=await diagramSVG(code.textContent??'',theme);if(token!==generation)return;const block=document.createElement('div');block.className='mermaid-render';block.innerHTML=svg;code.parentElement?.replaceWith(block)}
     catch(error){
      if(token!==generation)return
      const explanation=explainDiagramError(error instanceof Error?error.message:String(error),code.textContent??'')
      const block=document.createElement('div');block.className='diagram-error diagram-notice'
      const title=document.createElement('strong');title.textContent=explanation.title
      const hint=document.createElement('p');hint.textContent=explanation.hint
      const location=document.createElement('p');location.textContent=explanation.line?`Ubicación: línea ${explanation.line} del diagrama${explanation.column?`, columna ${explanation.column}`:''}.`:''
      const details=document.createElement('details'),summary=document.createElement('summary'),detail=document.createElement('pre')
      summary.textContent='Ver detalle técnico';detail.textContent=explanation.detail;details.append(summary,detail)
      block.append(title,hint,location,details);code.parentElement?.replaceWith(block)
      errors.push(`Diagrama ${diagram}. ${explanation.title} ${explanation.hint} ${location.textContent}`)
     }
    }
    if(token!==generation)return
    html=article.innerHTML;onheadings(result.headings);await tick()
    if(token!==generation)return
    announcement=errors.join(' ')
   }catch(error){if(token===generation){renderError=error instanceof Error?error.message:String(error);onerror(renderError)}}
   finally{if(token===generation)busy=false;finish()}
  },150)
  return()=>{clearTimeout(timer);finish()}
 })
 onDestroy(()=>{disposed=true;generation++})
 onMount(()=>{container.addEventListener('click',linkClick);return()=>container.removeEventListener('click',linkClick)})
 function linkClick(event:MouseEvent){const anchor=(event.target as Element).closest('a');if(!anchor)return;event.preventDefault();const href=anchor.getAttribute('href')??'';if(href.startsWith('#')){scrollToHeading(href.slice(1));return}window.freya.openLink(href).catch(error=>onerror(String(error)))}
</script>
<section class="preview" bind:this={container} aria-label="Vista previa del documento" role="document">
 {#if busy}<span class="render-progress">Actualizando vista previa…</span>{/if}
 <span class="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
 <article class="markdown-body">{@html html}</article>
</section>
