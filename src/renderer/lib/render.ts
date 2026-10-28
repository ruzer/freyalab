import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeSanitize from 'rehype-sanitize'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import rehypeStringify from 'rehype-stringify'
import katexCSS from 'katex/dist/katex.min.css?inline'
import remarkDetails from './remark-details'
import {frontMatterOf} from '../../shared/front-matter'
import type {TaskReference} from './markdown-tasks'

export interface Heading { id:string; text:string; level:number }
export function decodeFragment(value:string):string {try{return decodeURIComponent(value)}catch{return value}}
const fold=(value:string)=>value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase()
const slug=(value:string)=>fold(value).replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'')||'seccion'
export const documentCSS = `body{font:15px/1.75 Inter,Arial,sans-serif;color:#202024;margin:0;padding:32px;background:white}article{max-width:880px;margin:auto}h1,h2,h3,h4{line-height:1.3;break-after:avoid}h1{font-size:30px}h2{font-size:23px;border-bottom:1px solid #ddd;padding-bottom:8px}a{color:#007aff}pre{background:#f4f4f6;padding:16px;overflow-wrap:anywhere;white-space:pre-wrap;border-radius:7px}code{font:13px/1.6 'JetBrains Mono',monospace}p code{background:#f0f0f3;padding:2px 4px;border-radius:4px}table{border-collapse:collapse;width:100%;font-size:13px}td,th{overflow-wrap:anywhere;border:1px solid #ddd;padding:8px 12px;text-align:left}th{background:#f6f6f8}blockquote{border-left:3px solid #ccc;padding-left:16px;color:#666}img,svg{max-width:100%;height:auto}.mermaid-render{overflow:auto;text-align:center}input[type=checkbox]{accent-color:#007aff}.hljs-keyword,.hljs-selector-tag{color:#b33ca5}.hljs-string,.hljs-attr{color:#288342}.hljs-number,.hljs-literal{color:#8055bb}.hljs-comment{color:#787880}.diagram-error{background:#fff0f0;color:#a3192c;padding:12px;white-space:pre-wrap}.enlace-roto{color:#666;text-decoration:underline dotted}.katex-display{overflow-x:auto;overflow-y:hidden}@page{size:A4;margin:16mm}@media print{body{padding:0}pre,blockquote,tr,.mermaid-render{break-inside:avoid}a{color:inherit;text-decoration:none}}`

export async function markdownHTML(source:string):Promise<{html:string;headings:Heading[];frontMatter?:string;tasks:TaskReference[]}> {
 const {body,frontMatter}=frontMatterOf(source)
 // micromark omits an initial BOM in positions; make that origin explicit for raw offsets.
 const parsedBody=body.charCodeAt(0)===0xfeff?body.slice(1):body,bodyOffset=source.length-parsedBody.length
 const lineOffset=source.slice(0,bodyOffset).split('\n').length-1,tasks:TaskReference[]=[]
 const lineStarts=[0],rows=new Map<number,{from:number;end:number;text:string}>();let lastLine=false
 function rowAt(number:number){
  const known=rows.get(number);if(known)return known
  while(lineStarts.length<=number&&!lastLine){const end=source.indexOf('\n',lineStarts.at(-1)!);if(end<0)lastLine=true;else lineStarts.push(end+1)}
  const from=lineStarts[number-1];if(from===undefined)return
  const next=lineStarts[number],stop=next===undefined?source.length:next-1,end=source[stop-1]==='\r'?stop-1:stop
  const row={from,end,text:source.slice(from,end)};rows.set(number,row);return row
 }
 const taskMarker=/((?:[-+*]|\d{1,9}[.)])[ \t]+)(\[[ xX]\])/y
 const headings:Heading[] = []
 const counts = new Map<string,number>()
 const used=new Set<string>(),aliases=new Map<string,string>(),ids=new Map<string,string>()
 const result = await unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkDetails).use(remarkRehype,{clobberPrefix:'',footnoteLabel:'Notas al pie',footnoteLabelProperties:{},footnoteBackLabel:(index:number,reuse:number)=>`Volver a la referencia ${index+1}${reuse>1?` (${reuse})`:''}`})
 .use(rehypeSanitize)
 .use(() => (tree:any) => {
   const references:{node:any;key:string}[]=[],notes=new Map<string,{node:any;id:string;references:string[]}>()
   function text(node:any):string { return node.value ?? (node.children ?? []).map(text).join('') }
   function visit(node:any,footnotes=false) {
    const properties=node.properties??{},inNotes=footnotes||'dataFootnotes' in properties
    if(node.tagName==='li'&&properties.className?.includes('task-list-item')){
     const point=node.position?.start,line=point?.line+lineOffset,offset=point?.offset+bodyOffset
     if(Number.isSafeInteger(line)&&line>0&&Number.isSafeInteger(offset)&&offset>=0){
      const row=rowAt(line);taskMarker.lastIndex=offset;const match=taskMarker.exec(source)
      if(row&&offset>=row.from&&match&&offset+match[0].length<=row.end){
       const from=offset+match[1].length,marker=match[2] as TaskReference['marker']
       node.properties={...properties,dataLine:line};tasks.push({line,from,expectedLine:row.text,marker})
      }
     }
    }
    if(inNotes&&node.tagName==='li'&&typeof properties.id==='string'){
     const id=`user-content-fn-${notes.size+1}`
     notes.set(properties.id,{node,id,references:[]});properties.id=id
    }
    if('dataFootnoteRef' in properties){
     const key=`user-content-${String(properties.href).slice(1)}`
     properties.id=`user-content-fnref-${references.length+1}`;references.push({node,key})
    }
    if (/^h[1-6]$/.test(node.tagName ?? '')&&!(inNotes&&properties.id==='user-content-footnote-label')) {
     const label=text(node),base=slug(label)
     let count=counts.get(base)??0,id:string
     do{id=`heading-${base}${count?`-${count}`:''}`;count++}while(used.has(id))
     counts.set(base,count);used.add(id)
     node.properties={...node.properties,id};if(!inNotes)headings.push({id,text:label,level:Number(node.tagName[1])})
     for(const alias of [base,id.slice('heading-'.length)])if(!aliases.has(alias))aliases.set(alias,id)
    }
    if(typeof node.properties?.id==='string')ids.set(fold(decodeFragment(node.properties.id)),node.properties.id)
    for (const child of node.children ?? []) visit(child,inNotes)
   }
   visit(tree)
   for(const {node,key} of references){const note=notes.get(key);if(note){node.properties.href=`#${note.id}`;note.references.push(node.properties.id)}}
   for(const note of notes.values()){
    let index=0
    function back(node:any){if(node.properties&&'dataFootnoteBackref' in node.properties)node.properties.href=`#${note.references[index++]}`;for(const child of node.children??[])back(child)}
    back(note.node)
   }
   function links(node:any){
    const href=node.properties?.href
    if(node.tagName==='a'&&typeof href==='string'&&href.startsWith('#')&&href.length>1){
     let fragment=href.slice(1),target:string|undefined
     try{fragment=decodeURIComponent(fragment);target=ids.get(fold(fragment))??aliases.get(slug(fragment))}catch{}
     if(target)node.properties.href=`#${target}`
     else{node.tagName='span';node.properties={className:['enlace-roto'],dataSeccionFaltante:fragment}}
    }
    for(const child of node.children??[])links(child)
   }
   links(tree)
 })
 .use(rehypeKatex,{strict:'warn',trust:false}).use(rehypeHighlight,{detect:false,ignoreMissing:true}).use(rehypeStringify).process(parsedBody)
 return {html:String(result),headings,tasks,...(frontMatter!==undefined?{frontMatter}:{})}
}

export function standaloneHTML(body:string,title:string):string {
 const safeTitle=title.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
 return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${safeTitle}</title><style>${documentCSS}\n${katexCSS}</style></head><body><article>${body}</article></body></html>`
}

let mermaidModule:Promise<typeof import('mermaid')>|undefined
const diagramCache=new Map<string,string>()
let diagramNumber=0
// La cola interna de Mermaid no incluye initialize, que cambia su configuración global.
let diagramQueue:Promise<void>=Promise.resolve()
function diagramOperation<T>(run:()=>Promise<T>):Promise<T>{
 const pending=diagramQueue.then(run)
 diagramQueue=pending.then(()=>{},()=>{})
 return pending
}
function diagramEngine(mermaid:(typeof import('mermaid'))['default'],source:string,dark:boolean){
 mermaid.initialize({startOnLoad:false,securityLevel:'strict',htmlLabels:false,flowchart:{htmlLabels:false},theme:dark?'dark':'default',suppressErrorRendering:true,fontFamily:'Inter, Arial, sans-serif'})
 // shortcut: cuenta comentarios en el límite de Mermaid; afinar si el motor expone un preprocesamiento público.
 const maxTextSize=mermaid.mermaidAPI.getConfig().maxTextSize
 if(maxTextSize!==undefined&&source.length>maxTextSize)throw new Error('Maximum text size in diagram exceeded')
 return mermaid
}
export async function validateDiagram(source:string,dark:boolean){
 const {default:mermaid}=await(mermaidModule ??= import('mermaid'))
 await diagramOperation(async()=>{diagramEngine(mermaid,source,dark);await mermaid.parse(source)})
}
export async function diagramSVG(source:string,dark:boolean):Promise<string> {
 const key=`${dark}:${source}`
 const cached=diagramCache.get(key);if(cached)return cached
 const [{default:mermaid},{default:purify}]=await Promise.all([mermaidModule ??= import('mermaid'),import('dompurify')])
 return diagramOperation(async()=>{
  diagramEngine(mermaid,source,dark)
  const {svg}=await mermaid.render(`freya-diagram-${++diagramNumber}`,source)
  const safe=purify.sanitize(svg,{USE_PROFILES:{svg:true,svgFilters:true},ADD_TAGS:['foreignObject'],ADD_ATTR:['xmlns']})
  if(diagramCache.size>=64) diagramCache.delete(diagramCache.keys().next().value!)
  diagramCache.set(key,safe)
  return safe
 })
}
