import type {EditorState} from '@codemirror/state'
import {syntaxTree,syntaxTreeAvailable} from '@codemirror/language'
import {frontMatterOf} from '../../shared/front-matter'

export interface DiagramBlock {source:string;lines:number[];from:number;to:number}
type MarkdownNode=ReturnType<typeof syntaxTree>['topNode']

const column=(text:string)=>{let result=0;for(const character of text)result=character==='\t'?result+4-result%4:result+1;return result}

// Lezer ya separa los prefijos de lista/cita de CodeText. Solo queda quitar
// la sangría (0–3 espacios) de la cerca dentro de su contenedor Markdown.
function fenceIndent(state:EditorState,node:MarkdownNode):number|undefined {
 const opening=state.doc.lineAt(node.from)
 let base=0
 for(let parent=node.parent;parent;parent=parent.parent){
  if(parent.name==='ListItem'){
   const marker=parent.firstChild
   if(marker?.name==='ListMark'){
    const line=state.doc.lineAt(marker.from),rest=state.doc.sliceString(marker.to,line.to),padding=/^[ \t]*/.exec(rest)![0]
    base=Math.max(base,column(state.doc.sliceString(line.from,marker.to)+padding))
   }
  }
  if(parent.name==='Blockquote')for(let child=parent.childBefore(node.from);child&&child.from>=opening.from;child=child.prevSibling){
   if(child.name!=='QuoteMark')continue
   const after=state.doc.sliceString(child.to,opening.to),space=/^[ \t]/.test(after)?after[0]:''
   base=Math.max(base,column(state.doc.sliceString(opening.from,child.to)+space))
  }
 }
 const indent=column(state.doc.sliceString(opening.from,node.from))-base
 return indent>=0&&indent<=3?indent:undefined
}

export function markdownDiagramBlocks(state:EditorState):{complete:boolean;blocks:DiagramBlock[]} {
 if(!syntaxTreeAvailable(state,state.doc.length))return{complete:false,blocks:[]}
 const source=state.sliceDoc(),body=frontMatterOf(source).body
 const bodyFrom=state.toText(source.slice(0,source.length-body.length)).length
 const blocks:DiagramBlock[]=[]
 syntaxTree(state).iterate({enter:cursor=>{
  // shortcut: no posiciona diagramas en HTML opaco; ampliar cuando exista un AST compartido para esos bloques.
  if(cursor.name==='HTMLBlock'||cursor.name==='CodeBlock')return false
  if(cursor.name!=='FencedCode')return
  const node=cursor.node
  if(node.from<bodyFrom)return false
  const children:MarkdownNode[]=[]
  for(let child=node.firstChild;child;child=child.nextSibling)children.push(child)
  const info=children.find(child=>child.name==='CodeInfo')
  if(!info||state.doc.sliceString(info.from,info.to).split(/\s+/)[0]!=='mermaid')return false
  const indent=fenceIndent(state,node)
  if(indent===undefined)return false
  const marks=children.filter(child=>child.name==='CodeMark'),opening=state.doc.lineAt(node.from)
  const closing=marks.length>1?state.doc.lineAt(marks.at(-1)!.from):undefined
  let last=closing?closing.number-1:state.doc.lineAt(node.to).number
  // Un salto al EOF termina la línea anterior; no crea contenido Mermaid adicional.
  if(!closing&&state.doc.lineAt(node.to).from===node.to)last--
  const text=children.filter(child=>child.name==='CodeText'),lines:number[]=[],values:string[]=[]
  let firstPart=0
  for(let number=opening.number+1;number<=last;number++){
   const line=state.doc.line(number)
   let value=''
   while(firstPart<text.length&&text[firstPart].to<=line.from)firstPart++
   for(let index=firstPart;index<text.length&&text[index].from<line.to;index++){
    const part=text[index],from=Math.max(line.from,part.from),to=Math.min(line.to,part.to)
    if(from<to)value+=state.doc.sliceString(from,to)
   }
   let removed=0
   while(removed<indent&&value[removed]===' ')removed++
   // No aproximar la expansión de un tab que cruza la sangría de la cerca.
   if(removed<indent&&value[removed]==='\t')return false
   values.push(value.slice(removed));lines.push(number)
  }
  blocks.push({source:values.join('\n'),lines,from:node.from,to:node.to})
  return false
 }})
 return{complete:true,blocks}
}

export function diagramDocumentLine(block:DiagramBlock,relative?:number):number|undefined {
 if(relative===undefined||!Number.isInteger(relative)||relative<1||!block.lines.length)return
 return block.lines[Math.min(relative,block.lines.length)-1]
}

export function matchDiagramBlocks(rendered:readonly string[],candidates:readonly DiagramBlock[]):(DiagramBlock|undefined)[] {
 // mdast-util-to-hast añade una LF a todo Code.value no vacío; no pertenece a la fuente.
 const sources=rendered.map(source=>source.endsWith('\n')?source.slice(0,-1):source)
 const targets=new Map<string,number[]>(),available=new Map<string,DiagramBlock[]>()
 for(const [index,source] of sources.entries()){const group=targets.get(source)??[];group.push(index);targets.set(source,group)}
 for(const block of candidates){const group=available.get(block.source)??[];group.push(block);available.set(block.source,group)}
 const matches:(DiagramBlock|undefined)[]=sources.map(()=>undefined)
 for(const [source,indices] of targets){const group=available.get(source);if(group?.length===indices.length)for(const [position,index] of indices.entries())matches[index]=group[position]}
 let previous=-1
 for(const block of matches)if(block){if(block.from<=previous)return sources.map(()=>undefined);previous=block.from}
 return matches
}
