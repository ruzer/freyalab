import {unified} from 'unified'
import {win32} from 'node:path'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkDetails from '../renderer/lib/remark-details'
import remarkNumbering,{numberingFor} from '../renderer/lib/remark-numbering'
import {frontMatterOf} from '../shared/front-matter'
import {markdownImageReferences} from './document-assets'
import {t} from '../shared/i18n'
import remarkCitations,{type CitationContext} from '../renderer/lib/remark-citations'
import {bibliographyPath} from '../shared/bibliography-source'

type Change={from:number;to:number;insert:string}
type Node={type:string;lang?:string;children?:Node[];position?:{start:{offset?:number};end:{offset?:number}}}
function applyChanges(source:string,changes:Change[]):string {
 let end=source.length,result=source
 for(const change of [...changes].sort((a,b)=>b.from-a.from||b.to-a.to)){
  if(!Number.isSafeInteger(change.from)||!Number.isSafeInteger(change.to)||change.from<0||change.to<change.from||change.to>end)throw new Error(t('report.invalidPositions'))
  result=result.slice(0,change.from)+change.insert+result.slice(change.to);end=change.from
 }
 return result
}
function reportSource(source:string){
 const{body,frontMatter}=frontMatterOf(source),input=body.charCodeAt(0)===0xfeff?body.slice(1):body,numbering=numberingFor(frontMatter)
 numbering.changes=[]
 const citations:CitationContext={enabled:!!bibliographyPath(frontMatter),groups:[],targets:new Map(),warnings:[]}
 const parser=unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkDetails).use(remarkNumbering,numbering).use(remarkCitations,citations)
 const tree=parser.runSync(parser.parse(input),{value:input}) as Node,diagrams:Node[]=[]
 function visit(node:Node){if(node.type==='code'&&node.lang==='mermaid')diagrams.push(node);for(const child of node.children??[])visit(child)}
 visit(tree)
 for(const citation of citations.groups){
  if(citation.from===undefined||citation.to===undefined)throw new Error(t('report.invalidPositions'))
  numbering.changes.push({from:citation.from,to:citation.to,insert:`[${citation.raw}]{#freya-export-${citation.id} .freya-export-citation}`})
 }
 return{input,changes:numbering.changes,diagrams,citations:citations.groups}
}
// El YAML ya se apartó: una frontera inicial del cuerpo no es un segundo metadato.
function pandocBody(body:string){return /^---[ \t]*\r?\n/.test(body)?'\n'+body:body}
export function reportCitationGroups(source:string){return reportSource(source).citations}
export function citationMarkdown(source:string):string {const report=reportSource(source);return pandocBody(applyChanges(report.input,report.changes))}
export async function prepareReportMarkdown(source:string,resources:{image:(url:string)=>Promise<string|null>;diagrams:string[]}):Promise<string>{
 const{input,changes:resolved,diagrams}=reportSource(source)
 if(diagrams.length!==resources.diagrams.length)throw new Error(t('report.diagramPending'))
 for(const[index,node]of diagrams.entries()){
  const image=resources.diagrams[index]
  if(!image?.startsWith('data:image/'))throw new Error(t('report.diagramPending'))
  resolved.push({from:node.position?.start.offset??-1,to:node.position?.end.offset??-1,insert:`![](${image})`})
 }
 let result=applyChanges(input,resolved)
 const changes:Change[]=[],loaded=new Map<string,string>()
 for(const reference of markdownImageReferences(result)){
  let image=loaded.get(reference.url)
  if(!image){
   const data=reference.url.startsWith('data:image/')?reference.url:await resources.image(reference.url)
   if(!data?.startsWith('data:image/')){
    let name=reference.url.split(/[?#]/,1)[0]
    if(/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(name))try{name=new URL(name,'file:///').pathname}catch{name=''}
    name=name.replace(/%(?:2f|5c)/gi,'/');try{name=decodeURIComponent(name)}catch{}
    // Las referencias pueden usar ambos separadores, independientemente del SO.
    name=win32.basename(name)
    throw new Error(name?t('report.imageUnavailable',{nombre:name}):t('report.imageUnavailableUnnamed'))
   }
   image=data.replace(/[()<>\s"\\]/g,encodeURIComponent);loaded.set(reference.url,image)
  }
  changes.push({...reference,insert:image})
 }
 result=applyChanges(result,changes)
 return pandocBody(result)
}
