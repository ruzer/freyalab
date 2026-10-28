import type {EditorState} from '@codemirror/state'
import {syntaxTree,syntaxTreeAvailable} from '@codemirror/language'
import {frontMatterOf} from '../../shared/front-matter'
import type {Heading} from './render'

export type HeadingMetric={id:string;top:number}
export type OutlineNode=Heading&{key:string;depth:number;ancestors:string[];hasChildren:boolean}
export type EditorHeading={text:string;level:number;from:number}

export function currentHeading(metrics:readonly HeadingMetric[],scrollTop:number,viewportHeight:number,scrollHeight:number):string|undefined{
 if(!metrics.length)return
 if(scrollHeight>viewportHeight&&scrollTop+viewportHeight>=scrollHeight-1)return metrics.at(-1)!.id
 const threshold=scrollTop+0.3*viewportHeight
 let from=0,to=metrics.length
 while(from<to){
  const middle=Math.floor((from+to)/2)
  if(metrics[middle].top<=threshold)from=middle+1
  else to=middle
 }
 return metrics[from-1]?.id
}

export function outlineTree(headings:readonly Heading[]):OutlineNode[]{
 const nodes:OutlineNode[]=[],roots=new Map<string,number>()
 const stack:{node:OutlineNode;path:[string,number][];children:Map<string,number>}[]=[]
 for(const heading of headings){
  while(stack.length&&stack.at(-1)!.node.level>=heading.level)stack.pop()
  const parent=stack.at(-1),siblings=parent?.children??roots,occurrence=(siblings.get(heading.text)??0)+1
  siblings.set(heading.text,occurrence)
  const path:[string,number][]=[...(parent?.path??[]),[heading.text,occurrence]]
  const node:OutlineNode={...heading,key:JSON.stringify(path),depth:stack.length,ancestors:stack.map(item=>item.node.key),hasChildren:false}
  if(parent)parent.node.hasChildren=true
  nodes.push(node);stack.push({node,path,children:new Map()})
 }
 return nodes
}

export function visibleHeading(nodes:readonly OutlineNode[],currentId:string|undefined,collapsed:ReadonlySet<string>):string|undefined{
 const node=nodes.find(item=>item.id===currentId)
 if(!node)return
 const ancestor=node.ancestors.find(key=>collapsed.has(key))
 return ancestor?nodes.find(item=>item.key===ancestor)?.id:node.id
}

const headingLabel=(text:string)=>text.replace(/\s+/g,' ').trim()

export function editorHeadings(state:EditorState):{complete:boolean;headings:EditorHeading[]}{
 const headings:EditorHeading[]=[]
 if(!syntaxTreeAvailable(state,state.doc.length))return{complete:false,headings}
 const tree=syntaxTree(state),source=state.sliceDoc(),body=frontMatterOf(source).body
 const bodyFrom=state.toText(source.slice(0,source.length-body.length)).length
 function textOf(node:typeof tree.topNode):string|undefined{
  const value=state.doc.sliceString(node.from,node.to)
  if(/^(?:HeaderMark|EmphasisMark|LinkMark|HTMLTag|Image)$/.test(node.name))return''
  if(node.name==='Escape')return value.slice(1)
  if(node.name==='URL')return value
  if(node.name==='InlineCode'){
   const first=node.firstChild,last=node.lastChild
   if(!first||!last)return
   const code=state.doc.sliceString(first.to,last.from).replace(/\n/g,' ')
   return code.startsWith(' ')&&code.endsWith(' ')&&/[^ ]/.test(code)?code.slice(1,-1):code
  }
  if(!/^(?:ATXHeading[1-6]|SetextHeading[12]|StrongEmphasis|Emphasis|Autolink|Link)$/.test(node.name))return
  let end=node.to
  if(node.name==='Link'){
   let destination=false
   for(let child=node.firstChild;child;child=child.nextSibling){
    if(child.name==='URL')destination=true
    if(child.name==='LinkMark'&&state.doc.sliceString(child.from,child.to)===']')end=Math.min(end,child.from)
   }
   // Los enlaces por referencia no demuestran su destino solo por tener un nodo Link.
   if(!destination||end===node.to)return
  }
  let result='',from=node.from
  for(let child=node.firstChild;child&&child.from<end;child=child.nextSibling){
   result+=state.doc.sliceString(from,child.from)
   const text=textOf(child)
   if(text===undefined)return
   result+=text;from=child.to
  }
  return result+state.doc.sliceString(from,end)
 }
 tree.iterate({enter:node=>{
  if(/^(?:FencedCode|CodeBlock|HTMLBlock)$/.test(node.name))return false
  if(!/^(?:ATXHeading[1-6]|SetextHeading[12])$/.test(node.name))return
  if(node.from>=bodyFrom){const text=textOf(node.node);if(text!==undefined)headings.push({text:headingLabel(text),level:Number(node.name.at(-1)),from:node.from})}
  return false
 }})
 return{complete:true,headings}
}

export function matchHeadings(rendered:readonly Heading[],candidates:readonly EditorHeading[]):Map<string,number>{
 const targets=new Map<string,Heading[]>(),sources=new Map<string,EditorHeading[]>()
 for(const heading of rendered){const key=headingLabel(heading.text),group=targets.get(key)??[];group.push(heading);targets.set(key,group)}
 for(const heading of candidates){const key=headingLabel(heading.text),group=sources.get(key)??[];group.push(heading);sources.set(key,group)}
 const eligible=new Set<string>()
 for(const [key,group] of targets){const source=sources.get(key);if(source?.length===group.length&&group.every((heading,index)=>heading.level===source[index].level))eligible.add(key)}
 const matches=new Map<string,number>(),used=new Map<string,number>()
 let previous=-1
 for(const heading of rendered){
  const key=headingLabel(heading.text)
  if(!eligible.has(key))continue
  const index=used.get(key)??0,candidate=sources.get(key)![index]
  if(candidate.from<=previous)return new Map()
  matches.set(heading.id,candidate.from);used.set(key,index+1);previous=candidate.from
 }
 return matches
}
