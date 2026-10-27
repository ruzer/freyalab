<script lang="ts">
 import {tick,onMount,onDestroy} from 'svelte'
 import {explainDiagramError} from '../lib/diagram-errors'
 import {markdownHTML,diagramSVG,standaloneHTML,decodeFragment,type Heading} from '../lib/render'
 let {text,id,dark=false,onheadings,onerror}:{text:string;id:string;dark?:boolean;onheadings:(headings:Heading[])=>void;onerror:(message:string)=>void}=$props()
 let busy=$state(false),announcement=$state(''),container:HTMLElement,article:HTMLElement
 let frontMatter=$state<string|undefined>(undefined)
 let diagramBlocks:{source:string;dark:boolean;node:HTMLElement}[]=[]
 let generation=0,completion:Promise<void>=Promise.resolve(),renderError='',missing=0,disposed=false
 export function scrollToHeading(anchor:string){
  if(!anchor){container?.scrollTo({top:0,behavior:'smooth'});return}
  const fragment=decodeFragment(anchor),target=article?.querySelector<HTMLElement>(`[id="${CSS.escape(fragment)}"]`)
  if(!target){onerror(`No encontré la sección “${fragment}” en este documento`);return}
  for(let parent=target.parentElement;parent&&parent!==container;parent=parent.parentElement)if(parent instanceof HTMLDetailsElement)parent.open=true
  if(target.tabIndex<0)target.tabIndex=-1
  target.scrollIntoView({behavior:'smooth',block:'start'});target.focus({preventScroll:true})
 }
 export function scrollRatio(ratio:number){if(container) container.scrollTop=ratio*Math.max(0,container.scrollHeight-container.clientHeight)}
 export function missingImages(){return missing}
 export async function exportHTML(){
  await tick();while(busy&&!disposed)await completion
  if(disposed)throw new Error('El documento se cerró antes de terminar la vista previa.')
  if(renderError)throw new Error(renderError)
  const copy=article?.cloneNode(true) as HTMLElement|undefined
  for(const details of copy?.querySelectorAll<HTMLDetailsElement>('details[data-freya-open]')??[]){details.open=details.dataset.freyaOpen==='1';details.removeAttribute('data-freya-open')}
  return standaloneHTML(copy?.innerHTML??'','Documento FreyaLab')
 }
 $effect(()=>{
  const source=text,docId=id,theme=dark,token=++generation
  busy=true;renderError='';missing=0
  let finish:()=>void=()=>{};completion=new Promise<void>(resolve=>finish=resolve)
  const timer=setTimeout(async()=>{
   try{
    const result=await markdownHTML(source)
    if(token!==generation)return
    frontMatter=result.frontMatter
    const staged=document.createElement('template');staged.innerHTML=result.html
    for(const details of staged.content.querySelectorAll('details'))details.dataset.freyaOpen=details.open?'1':'0'
    const images=Array.from(staged.content.querySelectorAll('img'),image=>{const src=image.getAttribute('src')??'';image.removeAttribute('src');return{image,src}})
    const diagrams=Array.from(staged.content.querySelectorAll('code.language-mermaid'),(code,index)=>{
     const source=code.textContent??'',previous=diagramBlocks[index]
     const node=previous?.source===source&&previous.dark===theme?previous.node:document.createElement('div')
     if(node!==previous?.node){node.className='mermaid-render';node.textContent='Preparando diagrama…'}
     code.parentElement?.replaceWith(node);return{source,dark:theme,node}
    })
    // El article tiene un único dueño DOM: publica texto saneado sin serializar otra vez imágenes base64.
    article.replaceChildren(staged.content);diagramBlocks=diagrams;onheadings(result.headings)
    const errors:string[]=[]
    const loadImages=async()=>{for(const {image,src} of images){
     const data=await window.freya.image(docId,src).catch(()=>null)
     if(token!==generation)return
     if(data)image.src=data;else{image.removeAttribute('src');image.alt=`Imagen no disponible: ${image.alt||src}`;missing++}
    }}
    const loadDiagrams=async()=>{for(const [index,diagram] of diagrams.entries()){
     try{const svg=await diagramSVG(diagram.source,theme);if(token!==generation)return;const block=document.createElement('div');block.className='mermaid-render';block.innerHTML=svg;diagram.node.replaceWith(block);diagram.node=block}
     catch(error){
      if(token!==generation)return
      const explanation=explainDiagramError(error instanceof Error?error.message:String(error),diagram.source)
      const block=document.createElement('div');block.className=explanation.kind==='vacio'?'diagram-notice diagram-empty':'diagram-error diagram-notice'
      const title=document.createElement('strong');title.textContent=explanation.title
      const hint=document.createElement('p');hint.textContent=explanation.hint
      const location=explanation.line?`Ubicación: línea ${explanation.line} del diagrama${explanation.column?`, columna ${explanation.column}`:''}.`:''
      block.append(title,hint)
      if(location){const paragraph=document.createElement('p');paragraph.textContent=location;block.append(paragraph)}
      if(explanation.kind!=='vacio'){
       const details=document.createElement('details'),summary=document.createElement('summary'),detail=document.createElement('pre')
       summary.textContent='Ver detalle técnico';detail.textContent=explanation.detail;details.append(summary,detail);block.append(details)
      }
      diagram.node.replaceWith(block);diagram.node=block
      errors.push(`Diagrama ${index+1}. ${explanation.title} ${explanation.hint} ${location}`)
     }
    };if(token===generation)announcement=errors.join(' ')}
    await Promise.all([loadImages(),loadDiagrams()])
   }catch(error){if(token===generation){renderError=error instanceof Error?error.message:String(error);onerror(renderError)}}
   finally{if(token===generation)busy=false;finish()}
  },150)
  return()=>{clearTimeout(timer);finish()}
 })
 onDestroy(()=>{disposed=true;generation++})
 onMount(()=>{container.addEventListener('click',linkClick);return()=>container.removeEventListener('click',linkClick)})
 function linkClick(event:MouseEvent){const anchor=(event.target as Element).closest('a,.enlace-roto');if(!anchor)return;event.preventDefault();if(anchor.classList.contains('enlace-roto')){onerror(`No encontré la sección “${anchor.getAttribute('data-seccion-faltante')??''}” en este documento`);return}const href=anchor.getAttribute('href')??'';if(href.startsWith('#')){scrollToHeading(href.slice(1));return}window.freya.openLink(href).catch(error=>onerror(String(error)))}
</script>
<section class="preview" bind:this={container} aria-label="Vista previa del documento" role="document">
 {#if busy}<span class="render-progress">Actualizando vista previa…</span>{/if}
 <span class="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
 {#if frontMatter!==undefined}<details class="document-properties"><summary>Propiedades del documento</summary><pre>{frontMatter}</pre></details>{/if}
 <article class="markdown-body" bind:this={article}></article>
</section>
<style>
 :global(.markdown-body .enlace-roto){color:var(--muted);text-decoration:underline dotted;cursor:help}
 .document-properties{padding:10px 14px;border-bottom:1px solid var(--border);font-size:12px;color:var(--muted)}
 .document-properties summary{cursor:pointer;width:fit-content}
 .document-properties pre{font:12px/1.6 'JetBrains Mono',monospace;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--text);padding:12px;background:var(--panel);border:1px solid var(--border);border-radius:6px}
</style>
