import type {BibliographyEntry} from '../../shared/bibliography'
import {t} from '../../shared/i18n'

type Node={type:string;value?:string;url?:string;children?:Node[];position?:{start:{offset?:number};end:{offset?:number}};data?:{hName?:string;hProperties?:Record<string,unknown>}}
export interface CitationGroup {id:string;raw:string;narrative:boolean;items:{key:string;locator:string}[];from?:number;to?:number}
export interface CitationPresentation {groups:{id:string;text:string;missing:boolean;href?:string}[];references:{id:string;text:string}[];warnings:string[]}
export const citationCSS='.citation-missing{text-decoration:underline dotted}.document-bibliography{margin-top:32px;border-top:1px solid #aaa;padding-top:12px}.document-bibliography p{overflow-wrap:anywhere}'
export function presentCitations(groups:CitationGroup[],entries:readonly BibliographyEntry[]):CitationPresentation {
 const known=new Map(entries.map(entry=>[String(entry.id),entry])),cited=new Map<string,{id:string;text:string}>(),warnings=new Set<string>()
 function author(entry:BibliographyEntry){const names=(entry.author??[]).map(name=>name.literal??name.family??name.given??'').filter(Boolean);return names.length>2?`${names[0]} et al.`:names.join(' & ')||t('citations.noAuthor')}
 function year(entry:BibliographyEntry){return String(entry.issued?.['date-parts']?.[0]?.[0]??entry.issued?.literal??entry.issued?.raw??t('citations.noDate'))}
 const rendered=groups.map(group=>{
  let missing=false,href:string|undefined
  const labels=group.items.map(({key,locator})=>{
   const entry=known.get(key)
   if(!entry){missing=true;warnings.add(t('citations.missing',{key}));return `@${key}${locator}`}
   let reference=cited.get(key)
   if(!reference){reference={id:`bibliography-${cited.size+1}`,text:`${author(entry)} (${year(entry)}). ${entry.title??''}`.trim()};cited.set(key,reference)}
   href??=`#${reference.id}`
   return `${author(entry)}${group.narrative?' (':', '}${year(entry)}${group.narrative?')':''}${locator}`
  })
  return{id:group.id,text:group.narrative?labels.join('; '):`(${labels.join('; ')})`,missing,...(!missing&&href?{href}:{})}
 })
 return{groups:rendered,references:[...cited.values()],warnings:[...warnings]}
}
export interface CitationContext {enabled:boolean;entries?:readonly BibliographyEntry[];groups:CitationGroup[];targets:Map<string,{tag:string;properties:Record<string,unknown>}>;warnings:string[]}
export default function remarkCitations(context:CitationContext){
 return(tree:Node,file:{value?:unknown})=>{
  if(!context.enabled)return
  const pattern=/\[@([^\]\r\n]+)\]|(?<![\p{L}\p{N}_@\[])@([\p{L}\p{N}_](?:[\p{L}\p{N}_.:/-]*[\p{L}\p{N}_/-])?)/gu
  function visit(parent:Node){
   if(!parent.children||['link','linkReference','code','inlineCode','html','definition'].includes(parent.type))return
   parent.children=parent.children.flatMap(node=>{
    if(node.type!=='text'){visit(node);return[node]}
    const value=node.value??'',nodes:Node[]=[],matches=[...value.matchAll(pattern)];let start=0
    const raw=typeof file.value==='string'&&node.position?file.value.slice(node.position.start.offset,node.position.end.offset):undefined
    const originals=raw===undefined?matches:[...raw.matchAll(pattern)]
    // shortcut: entidades que cambian una clave quedan como texto; no se adivina otra referencia.
    if(originals.length!==matches.length||originals.some((match,index)=>match[0]!==matches[index][0]))return[node]
    for(const [index,match] of matches.entries()){
     let slash=originals[index].index-1;while(raw?.[slash]==='\\')slash--
     if(raw!==undefined&&(originals[index].index-slash-1)%2)continue
     const parts=(match[1]??match[2]).split(/;\s*@/),items=parts.map(part=>/^([\p{L}\p{N}_][\p{L}\p{N}_.:/-]*)(.*)$/u.exec(part))
     if(items.some(item=>!item||/^(?:fig|tbl):/.test(item[1])))continue
     if(match.index>start)nodes.push({type:'text',value:value.slice(start,match.index)})
     const group:CitationGroup={id:`citation-${context.groups.length+1}`,raw:match[0],narrative:!match[1],items:items.map(item=>({key:item![1],locator:item![2]}))}
     if(node.position?.start.offset!==undefined){group.from=node.position.start.offset+originals[index].index;group.to=group.from+match[0].length}
     context.groups.push(group)
     const marker=`freya-${group.id}`
     nodes.push({type:'citation',data:{hName:'span',hProperties:{id:marker}},children:[{type:'text',value:match[0]}]})
     start=match.index+match[0].length
    }
    if(!nodes.length)return[node]
    if(start<value.length)nodes.push({type:'text',value:value.slice(start)})
    return nodes
   })
  }
  visit(tree)
  const presentation=context.entries?presentCitations(context.groups,context.entries):undefined
  for(const [index,group] of context.groups.entries()){
   const shown=presentation?.groups[index]
   context.targets.set(`user-content-freya-${group.id}`,{tag:shown?.href?'a':'span',properties:{id:group.id,className:[shown?.missing?'citation-missing':'document-citation'],...(shown?.href?{href:shown.href}:{})}})
  }
  function labels(node:Node){
   const id=node.data?.hProperties?.id
   if(typeof id==='string'&&id.startsWith('freya-citation-')){const shown=presentation?.groups[Number(id.slice('freya-citation-'.length))-1];if(shown)node.children=[{type:'text',value:shown.text}]}
   for(const child of node.children??[])labels(child)
  }
  labels(tree)
  if(!context.groups.length)return
  context.warnings.push(...(presentation?.warnings??[]))
  context.targets.set('user-content-freya-bibliography',{tag:'section',properties:{id:'document-bibliography',className:['document-bibliography']}})
  const children:Node[]=[]
  if(presentation?.references.length){
   children.push({type:'paragraph',children:[{type:'strong',children:[{type:'text',value:t('citations.references')}]}]})
   for(const reference of presentation.references){
    context.targets.set(`user-content-freya-${reference.id}`,{tag:'p',properties:{id:reference.id}})
    children.push({type:'paragraph',data:{hProperties:{id:`freya-${reference.id}`}},children:[{type:'text',value:reference.text}]})
   }
  }
  tree.children!.push({type:'bibliography',data:{hName:'div',hProperties:{id:'freya-bibliography'}},children})
 }
}
