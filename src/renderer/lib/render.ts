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

export interface Heading { id:string; text:string; level:number }
export function decodeFragment(value:string):string {try{return decodeURIComponent(value)}catch{return value}}
const fold=(value:string)=>value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase()
const slug=(value:string)=>fold(value).replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'')||'seccion'
export const documentCSS = `body{font:15px/1.75 Inter,Arial,sans-serif;color:#202024;margin:0;padding:32px;background:white}article{max-width:880px;margin:auto}h1,h2,h3,h4{line-height:1.3;break-after:avoid}h1{font-size:30px}h2{font-size:23px;border-bottom:1px solid #ddd;padding-bottom:8px}a{color:#007aff}pre{background:#f4f4f6;padding:16px;overflow-wrap:anywhere;white-space:pre-wrap;border-radius:7px}code{font:13px/1.6 'JetBrains Mono',monospace}p code{background:#f0f0f3;padding:2px 4px;border-radius:4px}table{border-collapse:collapse;width:100%;font-size:13px}td,th{overflow-wrap:anywhere;border:1px solid #ddd;padding:8px 12px;text-align:left}th{background:#f6f6f8}blockquote{border-left:3px solid #ccc;padding-left:16px;color:#666}img,svg{max-width:100%;height:auto}.mermaid-render{overflow:auto;text-align:center}input[type=checkbox]{accent-color:#007aff}.hljs-keyword,.hljs-selector-tag{color:#b33ca5}.hljs-string,.hljs-attr{color:#288342}.hljs-number,.hljs-literal{color:#8055bb}.hljs-comment{color:#787880}.diagram-error{background:#fff0f0;color:#a3192c;padding:12px;white-space:pre-wrap}.enlace-roto{color:#666;text-decoration:underline dotted}.katex-display{overflow-x:auto;overflow-y:hidden}@page{size:A4;margin:16mm}@media print{body{padding:0}pre,blockquote,tr,.mermaid-render{break-inside:avoid}a{color:inherit;text-decoration:none}}`

function frontMatterOf(source:string):{body:string;frontMatter?:string} {
 const start=source.charCodeAt(0)===0xfeff?1:0
 if(source.slice(start,start+3)!=='---')return{body:source}
 const first=source.indexOf('\n',start)
 if(first<0||source.slice(start,first).replace(/\r$/,'')!=='---')return{body:source}
 let cursor=first+1
 for(let line=2;line<=100;line++){
  const end=source.indexOf('\n',cursor),text=source.slice(cursor,end<0?source.length:end).replace(/\r$/,'')
  if(text==='---'||text==='...')return{body:end<0?'':source.slice(end+1),frontMatter:source.slice(first+1,cursor)}
  if(!/^(?:\s*$|\s*#|[ \t]+|-[ \t]|(?:[\p{L}\p{N}_-]+|"[^"\r\n]+"|'[^'\r\n]+')[ \t]*:)/u.test(text)||end<0)break
  cursor=end+1
 }
 return{body:source}
}

export async function markdownHTML(source:string):Promise<{html:string;headings:Heading[];frontMatter?:string}> {
 const {body,frontMatter}=frontMatterOf(source)
 const headings:Heading[] = []
 const counts = new Map<string,number>()
 const used=new Set<string>(),aliases=new Map<string,string>(),ids=new Map<string,string>()
 const result = await unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkRehype)
 .use(rehypeSanitize)
 .use(() => (tree:any) => {
   function text(node:any):string { return node.value ?? (node.children ?? []).map(text).join('') }
   function visit(node:any) {
    if (/^h[1-6]$/.test(node.tagName ?? '')) {
     const label=text(node),base=slug(label)
     let count=counts.get(base)??0,id:string
     do{id=`heading-${base}${count?`-${count}`:''}`;count++}while(used.has(id))
     counts.set(base,count);used.add(id)
     node.properties={...node.properties,id}; headings.push({id,text:label,level:Number(node.tagName[1])})
     for(const alias of [base,id.slice('heading-'.length)])if(!aliases.has(alias))aliases.set(alias,id)
    }
    if(typeof node.properties?.id==='string')ids.set(fold(decodeFragment(node.properties.id)),node.properties.id)
    for (const child of node.children ?? []) visit(child)
   }
   visit(tree)
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
 .use(rehypeKatex,{strict:'warn',trust:false}).use(rehypeHighlight,{detect:false,ignoreMissing:true}).use(rehypeStringify).process(body)
 return {html:String(result),headings,...(frontMatter!==undefined?{frontMatter}:{})}
}

export function standaloneHTML(body:string,title:string):string {
 const safeTitle=title.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
 return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${safeTitle}</title><style>${documentCSS}\n${katexCSS}</style></head><body><article>${body}</article></body></html>`
}

let mermaidModule:Promise<typeof import('mermaid')>|undefined
const diagramCache=new Map<string,string>()
let diagramNumber=0
export async function diagramSVG(source:string,dark:boolean):Promise<string> {
 const key=`${dark}:${source}`
 const cached=diagramCache.get(key); if(cached) return cached
 const [{default:mermaid},{default:purify}] = await Promise.all([mermaidModule ??= import('mermaid'),import('dompurify')])
 mermaid.initialize({startOnLoad:false,securityLevel:'strict',htmlLabels:false,flowchart:{htmlLabels:false},theme:dark?'dark':'default',suppressErrorRendering:true,fontFamily:'Inter, Arial, sans-serif'})
 // shortcut: cuenta comentarios en el límite de Mermaid; afinar si el motor expone un preprocesamiento público.
 const maxTextSize=mermaid.mermaidAPI.getConfig().maxTextSize
 if(maxTextSize!==undefined&&source.length>maxTextSize)throw new Error('Maximum text size in diagram exceeded')
 const {svg}=await mermaid.render(`freya-diagram-${++diagramNumber}`,source)
 const safe=purify.sanitize(svg,{USE_PROFILES:{svg:true,svgFilters:true},ADD_TAGS:['foreignObject'],ADD_ATTR:['xmlns']})
 if(diagramCache.size>=64) diagramCache.delete(diagramCache.keys().next().value!)
 diagramCache.set(key,safe)
 return safe
}
