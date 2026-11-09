import {unified} from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import {frontMatterOf} from '../../shared/front-matter'

export type MarkdownAction='bold'|'italic'|'strike'|'inline'|'task'|'table'|'mermaid'|'code'|'paragraph'|'heading1'|'heading2'|'heading3'|'heading'|'list'|'ordered'|'quote'|'rule'|'link'|'date'|'datetime'
export type MarkdownSelection={anchor:number;head:number}
export type MarkdownChange={changes:{from:number;to:number;insert:string}[];selection:MarkdownSelection}
export const codeLanguages=['text','bash','python','javascript','typescript','json','yaml','sql','go'] as const
export type CodeLanguage=typeof codeLanguages[number]
export type MarkdownFormatState={bold:boolean;italic:boolean;strike:boolean;inline:boolean;block:'paragraph'|'heading1'|'heading2'|'heading3'}
type Command=(text:string,selection:MarkdownSelection,language?:CodeLanguage,now?:Date)=>MarkdownChange
type Line={from:number;to:number;end:number;text:string}
type Span={from:number;to:number;start:number;end:number}
const unchanged=(selection:MarkdownSelection):MarkdownChange=>({changes:[],selection})
const escaped=(text:string,at:number)=>{let count=0;while(at>0&&text[--at]==='\\')count++;return count%2===1}
const within=(span:Span,from:number,to=from)=>from>=span.start&&to<=span.end
function selection(text:string,value:MarkdownSelection):MarkdownSelection{
 const boundary=(position:number,forward=false)=>{
  position=Math.max(0,Math.min(text.length,position))
  if(position>0&&position<text.length&&(/[\uD800-\uDBFF]/.test(text[position-1])&&/[\uDC00-\uDFFF]/.test(text[position])||text[position-1]==='\r'&&text[position]==='\n'))position+=forward?1:-1
  return position
 }
 const empty=value.anchor===value.head,reverse=value.anchor>value.head
 const from=boundary(Math.min(value.anchor,value.head)),to=empty?from:boundary(Math.max(value.anchor,value.head),true)
 return{anchor:reverse?to:from,head:reverse?from:to}
}
function lines(text:string):Line[]{
 const result:Line[]=[];let from=0
 while(true){const newline=text.indexOf('\n',from),end=newline<0?text.length:newline,to=end>from&&text[end-1]==='\r'?end-1:end;result.push({from,to,end:newline<0?end:end+1,text:text.slice(from,to)});if(newline<0)break;from=newline+1}
 return result
}
type Container='quote'|number
const columns=(text:string)=>{let width=0;for(const character of text)width+=character==='\t'?4-width%4:1;return width}
function openingLine(line:string){
 const containers:Container[]=[];let content=line
 while(true){
  const quote=/^ {0,3}>[ \t]?/.exec(content),list=/^ {0,3}(?:[-+*]|\d+[.)])[ \t]+/.exec(content)
  const prefix=quote?.[0]??list?.[0];if(!prefix)break
  containers.push(quote?'quote':columns(prefix));content=content.slice(prefix.length)
 }
 return{content,containers}
}
function continuationLine(line:string,containers:Container[]){
 let content=line
 for(const container of containers){
  if(container==='quote'){const prefix=/^ {0,3}>[ \t]?/.exec(content);if(!prefix)return;content=content.slice(prefix[0].length)}
  else{let at=0,width=0;while(at<content.length&&width<container&&/[ \t]/.test(content[at])){width+=content[at++]==='\t'?4-width%4:1}if(width<container)return;content=' '.repeat(width-container)+content.slice(at)}
 }
 return content
}
function fences(text:string,rows=lines(text)){
 const result:(Span&{bodyFrom:number;bodyTo:number;language:string;container:boolean})[]=[]
 let open:{line:Line;marker:string;language:string;containers:Container[]}|undefined
 for(const line of rows){
  if(open){
   const content=continuationLine(line.text,open.containers),match=content===undefined?null:/^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(content)
   if(!match||match[1][0]!==open.marker[0]||match[1].length<open.marker.length)continue
   let bodyTo=line.from;if(bodyTo>open.line.end&&text[bodyTo-1]==='\n'){bodyTo--;if(text[bodyTo-1]==='\r')bodyTo--}
   result.push({from:open.line.from,to:line.to,start:open.line.from,end:line.to,bodyFrom:open.line.end,bodyTo,language:open.language,container:open.containers.length>0});open=undefined
  }else{
   const {content,containers}=openingLine(line.text),match=/^ {0,3}(`{3,}|~{3,})(.*)$/.exec(content)
   if(match&&(match[1][0]!=='`'||!match[2].includes('`')))open={line,marker:match[1],language:match[2].trim(),containers}
  }
 }
 if(open)result.push({from:open.line.from,to:text.length,start:open.line.from,end:text.length,bodyFrom:open.line.end,bodyTo:text.length,language:open.language,container:open.containers.length>0})
 return result
}
function codeSpans(line:string):Span[]{
 const runs=[...line.matchAll(/`+/g)].filter(run=>!escaped(line,run.index)),next:number[]=[],last=new Map<number,number>(),result:Span[]=[]
 for(let i=runs.length-1;i>=0;i--){next[i]=last.get(runs[i][0].length)??-1;last.set(runs[i][0].length,i)}
 for(let i=0;i<runs.length;i++){const j=next[i];if(j<0)continue;const open=runs[i],close=runs[j];result.push({from:open.index,to:close.index+close[0].length,start:open.index+open[0].length,end:close.index});i=j}
 return result
}
function markerSpans(line:string,kind:'bold'|'italic'|'strike'):Span[]{
 const code=codeSpans(line),result:Span[]=[],opens=new Map<string,{at:number;size:number}>();let codeIndex=0
 for(const run of line.matchAll(/\*+|_+|~+/g)){
  const at=run.index,n=run[0].length,character=run[0][0]
  while(codeIndex<code.length&&at>=code[codeIndex].to)codeIndex++
  if(escaped(line,at)||codeIndex<code.length&&at>=code[codeIndex].from||character==='~'&&kind!=='strike'||character!=='~'&&kind==='strike')continue
  const size=kind==='italic'?1:2
  if(kind==='italic'&&n!==1&&n!==3||kind!=='italic'&&n<2)continue
  const before=line[at-1]??'',after=line[at+n]??'',canOpen=!!after&&!/\s/.test(after),canClose=!!before&&!/\s/.test(before)
  if(character==='_'&&/\p{L}|\p{N}/u.test(before)&&/\p{L}|\p{N}/u.test(after))continue
  const previous=opens.get(character)
  if(previous&&canClose){const close=at+(kind==='bold'&&n===3?1:0);result.push({from:previous.at,to:close+size,start:previous.at+size,end:close});opens.delete(character)}
  else if(canOpen)opens.set(character,{at:at+(kind==='italic'&&n===3?2:0),size})
 }
 return result
}
function emptyMarker(line:string,position:number,marker:string){
 const from=position-marker.length,to=position+marker.length
 return from>=0&&line.slice(from,position)===marker&&line.slice(position,to)===marker&&line[from-1]!==marker[0]&&line[to]!==marker[0]&&!escaped(line,from)
}
export function lineFormatState(line:string,position:number):MarkdownFormatState{
 const inline=emptyMarker(line,position,'`')||codeSpans(line).some(span=>within(span,position)),heading=/^ {0,3}(#{1,3})(?:[ \t]+|$)/.exec(line)
 return{bold:!inline&&(emptyMarker(line,position,'**')||markerSpans(line,'bold').some(span=>within(span,position))),italic:!inline&&(emptyMarker(line,position,'*')||markerSpans(line,'italic').some(span=>within(span,position))),strike:!inline&&(emptyMarker(line,position,'~~')||markerSpans(line,'strike').some(span=>within(span,position))),inline,block:heading?`heading${heading[1].length}` as MarkdownFormatState['block']:'paragraph'}
}
function replace(text:string,value:MarkdownSelection,from:number,to:number,insert:string,contentFrom:number,contentLength:number):MarkdownChange{
 const map=(at:number)=>from+Math.max(0,Math.min(contentLength,at-contentFrom))
 return{changes:[{from,to,insert}],selection:{anchor:map(value.anchor),head:map(value.head)}}
}
type InlineKind='bold'|'italic'|'strike'|'inline'
type Range={from:number;to:number}
type ParsedNode={
 type:string
 position?:{start:{offset?:number};end:{offset?:number}}
 children?:ParsedNode[]
}
const inlineMarkers={bold:'**',italic:'*',strike:'~~',inline:'`'} as const
const inlineNodes={bold:'strong',italic:'emphasis',strike:'delete',inline:'inlineCode'} as const
const inlineParser=unified().use(remarkParse).use(remarkGfm).use(remarkMath)
const overlaps=(first:Range,second:Range)=>first.from===first.to
 ?first.from>=second.from&&first.from<=second.to
 :first.from<second.to&&first.to>second.from

function inlineSyntax(text:string,range:Range,kind:InlineKind){
 const {body}=frontMatterOf(text)
 let source=body.charCodeAt(0)===0xfeff?body.slice(1):body
 const bodyStart=text.length-source.length
 let origin=bodyStart
 // Una separación en blanco basta si no hay cercas, HTML, referencias,
 // citas, matemáticas ni continuaciones indentadas que crucen el límite.
 if(!/```|~~~|[<>$]|\[|^[ \t]+\S/m.test(source)){
  let start=0,end=source.length
  for(const blank of source.matchAll(/\n[ \t]*\r?\n/g)){
   const after=blank.index+blank[0].length
   if(after<=range.from-origin)start=after
   else if(blank.index>=range.to-origin){end=blank.index;break}
  }
  source=source.slice(start,end)
  origin+=start
 }
 const blocks:(Range&{quotes:number})[]=[],tables:Range[]=[],cells:Range[]=[],protectedRanges:(Range&{inline:boolean})[]=[],spans:Span[]=[],literal:Range[]=[]
 function bounds(node:ParsedNode):Range|undefined{
  const from=node.position?.start.offset,to=node.position?.end.offset
  if(from!==undefined&&to!==undefined)return{from:from+origin,to:to+origin}
 }
 function visit(node:ParsedNode,quotes:number,insideFormat=false){
  const position=bounds(node)
  if(!position||!overlaps(range,position))return
  const {from,to}=position
  if(node.type==='text')literal.push(position)
  if(node.type==='code'||node.type==='inlineMath'||node.type==='math'||node.type==='definition'){
   protectedRanges.push({...position,inline:node.type==='inlineMath'})
   return
  }
  if(node.type==='table')tables.push(position)
  if(node.type==='tableCell'){
   // GFM incluye las barras exteriores en la posición de la celda.
   cells.push({from:from+Number(text[from]==='|'),to:to-Number(text[to-1]==='|'&&!escaped(text,to-1))})
  }
  if(node.type==='paragraph'||node.type==='heading'||node.type==='tableCell'){
   const first=node.children?.[0],last=node.children?.at(-1)
   if(first&&last)blocks.push({from:bounds(first)!.from,to:bounds(last)!.to,quotes})
  }
  if(node.type==='inlineCode'&&kind!=='inline')protectedRanges.push({...position,inline:true})
  const matching=node.type===inlineNodes[kind]
  if(node.type==='inlineCode'||matching&&!insideFormat){
   const marker=node.type==='inlineCode'?/^`+/.exec(text.slice(from,to))![0]:kind==='strike'&&text[from+1]!=='~'?'~':inlineMarkers[kind]
   let start=from+marker.length,end=to-marker.length
   if(node.type==='inlineCode'&&text[start]===' '&&text[end-1]===' '&&/[^ \r\n]/.test(text.slice(start,end))){start++;end--}
   if(node.type==='inlineCode')literal.push({from:start,to:end})
   if(matching&&!insideFormat)spans.push({from,to,start,end})
  }
  for(const child of node.children??[])visit(child,quotes+Number(node.type==='blockquote'),insideFormat||matching)
 }
 visit(inlineParser.parse(source),0)
 return{bodyStart,blocks,tables,cells,protectedRanges,spans,literal}
}

function trimRange(text:string,{from,to}:Range):Range{
 const value=text.slice(from,to)
 return{from:from+value.length-value.trimStart().length,to:from+value.trimEnd().length}
}

function inline(kind:InlineKind):Command{return(text,original)=>{
 const value=selection(text,original),range={from:Math.min(value.anchor,value.head),to:Math.max(value.anchor,value.head)}
 const caret=range.from===range.to,marker=inlineMarkers[kind]
 const syntax=inlineSyntax(text,range,kind)
 if(range.from<syntax.bodyStart||syntax.tables.length&&!syntax.cells.some(cell=>range.from>=cell.from&&range.to<=cell.to))return unchanged(original)
 const rows=lines(text)
 if(caret){
  const row=rows.find(row=>range.from>=row.from&&range.from<=row.to)!
  const offset=range.from-row.from
  const placeholder=emptyMarker(row.text,offset,marker)
  if(syntax.protectedRanges.some(span=>overlaps(range,span)&&!(placeholder&&span.from===row.from+row.text.search(/\S/)&&span.to===row.to)))return unchanged(original)
  if(placeholder){
   return{changes:[{from:range.from-marker.length,to:range.from+marker.length,insert:''}],selection:{anchor:range.from-marker.length,head:range.from-marker.length}}
  }
  // En un límite de palabra se conserva el desplazamiento del cursor dentro de ella.
  if(original.anchor===value.anchor&&!syntax.spans.some(span=>within(span,range.from))){
   for(const word of row.text.matchAll(/[\p{L}\p{N}\p{M}_]+/gu)){
    const from=row.from+word.index,to=from+word[0].length
    if(range.from>=from&&range.from<=to&&syntax.blocks.some(block=>from>=block.from&&to<=block.to)){
     range.from=from;range.to=to
     break
    }
   }
  }
  if(range.from===range.to&&!syntax.spans.some(span=>within(span,range.from))){
   const anchor=range.from+marker.length
   return{changes:[{...range,insert:marker+marker}],selection:{anchor,head:anchor}}
  }
 }

 const present=new Set<Span>(),missing:Range[]=[],content:Range[]=[]
 let blockIndex=0,protectedIndex=0,formatIndex=0
 for(const row of rows){
  if(!overlaps(range,row))continue
  while(blockIndex<syntax.blocks.length&&syntax.blocks[blockIndex].to<row.from)blockIndex++
  const block=syntax.blocks[blockIndex]
  if(!block||block.from>row.to)continue
  let prefix=row.from
  for(let quote=0;quote<block.quotes;quote++){
   const next=/^[ \t]*>[ \t]?/.exec(text.slice(prefix,row.to))
   if(!next)break
   prefix+=next[0].length
  }
  const segment=trimRange(text,{from:Math.max(range.from,block.from,prefix),to:Math.min(range.to,block.to,row.to)})
  if(segment.from>=segment.to&&!caret)continue
  while(syntax.protectedRanges[protectedIndex]?.to<segment.from)protectedIndex++
  let blocked=false
  for(let index=protectedIndex;syntax.protectedRanges[index]?.from<=segment.to;index++){
   const span=syntax.protectedRanges[index]
   if(overlaps(segment,span)&&!(span.inline&&segment.from<=span.from&&segment.to>=span.to)){blocked=true;break}
  }
  if(blocked)continue
  while(syntax.spans[formatIndex]?.end<segment.from)formatIndex++
  const formatted:Span[]=[]
  for(let index=formatIndex;syntax.spans[index]?.start<=segment.to;index++){
   const span=syntax.spans[index]
   if(overlaps(segment,{from:span.start,to:span.end}))formatted.push(span)
  }
  let from=segment.from
  for(const span of formatted){
   const gap=trimRange(text,{from,to:Math.max(from,span.from)})
   if(gap.from<gap.to&&!/^[*_~]+$/.test(text.slice(gap.from,gap.to))){missing.push(gap);content.push(gap)}
   present.add(span)
   content.push({from:Math.max(segment.from,span.start),to:Math.min(segment.to,span.end)})
   from=Math.max(from,span.to)
  }
  const tail=trimRange(text,{from,to:Math.max(from,segment.to)})
  if(tail.from<tail.to&&(!formatted.length||!/^[*_~]+$/.test(text.slice(tail.from,tail.to)))){missing.push(tail);content.push(tail)}
 }
 if(!content.length)return unchanged(original)

 const changes:MarkdownChange['changes']=[]
 const additions:{range:Range;opening:string;closing:string;length:number}[]=[]
 if(missing.length){
  // Dos pares pegados pueden convertirse en delimitadores literales. Extiende
  // el tramo existente cuando toca el nuevo y conserva ambos contenidos.
  const starts=new Map<number,Span>(),ends=new Map<number,Span>()
  for(const span of present){
   if(text.slice(span.from,span.to).includes('\n'))continue
   starts.set(span.from,span);ends.set(span.to,span)
  }
  const groups:(Range&{absorbed:Set<Span>})[]=[]
  for(const gap of missing){
   const left=ends.get(gap.from),right=starts.get(gap.to)
   const from=left?.from??gap.from,to=right?.to??gap.to
   const previous=groups.at(-1)
   const group=previous&&from<previous.to?previous:{from,to,absorbed:new Set<Span>()}
   if(group!==previous)groups.push(group)
   group.to=Math.max(group.to,to)
   if(left)group.absorbed.add(left)
   if(right)group.absorbed.add(right)
  }
  for(const group of groups){
   const removed=[...group.absorbed].flatMap(span=>[
    {from:span.from,to:span.start,insert:''},{from:span.end,to:span.to,insert:''}
   ])
   const pieces:string[]=[]
   let offset=group.from
   for(const change of removed){pieces.push(text.slice(offset,change.from));offset=change.to}
   pieces.push(text.slice(offset,group.to))
   const selected=pieces.join('')
   let opening:string=marker,closing:string=marker
   if(kind==='inline'){
    let length=1
    for(const run of selected.matchAll(/`+/g))length=Math.max(length,run[0].length+1)
    const delimiter='`'.repeat(length),padding=/^`|`$/.test(selected)?' ':''
    opening=delimiter+padding;closing=padding+delimiter
   }
   const first=removed[0],last=removed.at(-1)
   if(first?.from===group.from)first.insert=opening
   else changes.push({from:group.from,to:group.from,insert:opening})
   if(last?.to===group.to)last.insert=closing
   else changes.push({from:group.to,to:group.to,insert:closing})
   for(const change of removed)changes.push(change)
   additions.push({range:group,opening,closing,length:selected.length})
  }
 }else{
  for(const span of present)changes.push({from:span.from,to:span.start,insert:''},{from:span.end,to:span.to,insert:''})
 }
 changes.sort((a,b)=>a.from-b.from)
 const map=(offset:number,side:1|-1)=>{
  let shift=0
  for(const change of changes){
   if(offset<change.from||offset===change.from&&side<0)break
   if(offset<change.to)return change.from+shift+change.insert.length
   shift+=change.insert.length-(change.to-change.from)
  }
  return offset+shift
 }
 if(additions.length){
  // Los delimitadores junto a puntuación pueden quedar literales en CommonMark.
  const pieces:string[]=[];let offset=0
  for(const change of changes){pieces.push(text.slice(offset,change.from),change.insert);offset=change.to}
  pieces.push(text.slice(offset))
  const formatted=pieces.join('')
  const parsed=inlineSyntax(formatted,{from:map(range.from,-1),to:map(range.to,1)},kind)
  let shift=0,index=0,literalIndex=0
  const hasLiteral=(from:number,to:number)=>{
   while(parsed.literal[literalIndex]?.to<=from)literalIndex++
   return parsed.literal[literalIndex]?.from<to
  }
  for(const {range,opening,closing,length} of additions){
   const from=range.from+shift+opening.length,to=from+length
   while(parsed.spans[index]?.to<to+closing.length)index++
   const span=parsed.spans[index]
   if(!span||span.from>from-opening.length||!within(span,from,to))return unchanged(original)
   if(hasLiteral(from-opening.length,from)||hasLiteral(to,to+closing.length))return unchanged(original)
   shift+=opening.length+length+closing.length-(range.to-range.from)
  }
 }
 if(caret){
  const anchor=map(value.anchor,value.anchor===range.to&&range.from!==range.to?-1:1)
  return{changes,selection:{anchor,head:anchor}}
 }
 const from=map(content[0].from,1),to=map(content.at(-1)!.to,-1)
 return{changes,selection:value.anchor>value.head?{anchor:to,head:from}:{anchor:from,head:to}}
}}
function block(action:'paragraph'|'heading1'|'heading2'|'heading3'|'list'|'ordered'|'task'|'quote'):Command{return(text,original)=>{
 const value=selection(text,original),from=Math.min(value.anchor,value.head),to=Math.max(value.anchor,value.head),rows=lines(text)
 const selected=rows.filter(line=>line.from<=to&&line.to>=from&&(from===to||line.from<to))
 if(fences(text,rows).some(span=>from===to?from>=span.from&&from<=span.to:from<span.to&&to>span.from))return unchanged(original)
 const heading=/^(#{1,6})(?:[ \t]+|$)/,list=/^(?:[-+*][ \t]+(?:\[[ xX]\][ \t]+)?|\d+[.)][ \t]+)/
 const parts=selected.map(line=>{const indent=/^[ \t]*/.exec(line.text)![0],body=line.text.slice(indent.length);return{line,indent,body}})
 if(action==='task'&&from===to&&parts.length===1&&!parts[0].body){const at=parts[0].line.from+parts[0].indent.length;return{changes:[{from:at,to:at,insert:'- [ ] Nueva tarea'}],selection:{anchor:at+6,head:at+6}}}
 const target=(body:string)=>action.startsWith('heading')?new RegExp(`^#{${action.at(-1)}}(?:[ \\t]+|$)`).test(body):action==='list'?/^[-+*][ \t]+(?!\[[ xX]\][ \t])/.test(body):action==='ordered'?/^\d+[.)][ \t]+/.test(body):action==='task'?/^[-+*][ \t]+\[[ xX]\][ \t]+/.test(body):action==='quote'?/^>[ \t]?/.test(body):false
 const nonempty=parts.filter(part=>part.body),remove=nonempty.length>0&&nonempty.every(part=>target(part.body))
 let number=0
 const changes:MarkdownChange['changes']=[]
 for(const {line,indent,body} of parts){
  const previous=action==='paragraph'||action.startsWith('heading')?heading.exec(body)?.[0]??'':action==='quote'?/^>[ \t]?/.exec(body)?.[0]??'':list.exec(body)?.[0]??''
  const insert=remove||action==='paragraph'?'':action.startsWith('heading')?'#'.repeat(Number(action.at(-1)))+' ':action==='list'?'- ':action==='ordered'?`${++number}. `:action==='task'?'- [ ] ': '> '
  if(previous!==insert)changes.push({from:line.from+indent.length,to:line.from+indent.length+previous.length,insert})
 }
 const map=(position:number)=>{let shift=0;for(const change of changes){if(position<change.from)break;if(position<=change.to)return change.from+shift+change.insert.length;shift+=change.insert.length-(change.to-change.from)}return position+shift}
 return{changes,selection:{anchor:map(value.anchor),head:map(value.head)}}
}}
function inserted(text:string,value:MarkdownSelection,body:string,cursor:number):MarkdownChange{
 const from=Math.min(value.anchor,value.head),to=Math.max(value.anchor,value.head),before=text.slice(0,from),after=text.slice(to),eol=text.includes('\r\n')?'\r\n':'\n'
 const prefix=!before?'':before.endsWith(eol+eol)?'':before.endsWith(eol)?eol:eol+eol
 const suffix=!after?'':after.startsWith(eol+eol)?'':after.startsWith(eol)?eol:eol+eol
 return{changes:[{from,to,insert:prefix+body+suffix}],selection:{anchor:from+prefix.length+cursor,head:from+prefix.length+cursor}}
}
const code:Command=(text,original,language='text')=>{
 const value=selection(text,original),from=Math.min(value.anchor,value.head),to=Math.max(value.anchor,value.head)
 const existing=fences(text).find(span=>from>=span.from&&to<=span.to)
// shortcut: los bloques en citas/listas se preservan; ampliar al editar sus contenedores.
 if(existing?.container)return unchanged(original)
 if(existing){const body=text.slice(existing.bodyFrom,existing.bodyTo);return replace(text,value,existing.from,existing.to,body,existing.bodyFrom,body.length)}
 const selected=text.slice(from,to),body=selected||'Escribe tu código aquí',eol=text.includes('\r\n')?'\r\n':'\n';let fence='```'
 for(const run of body.matchAll(/`+/g))if(run[0].length>=fence.length)fence='`'.repeat(run[0].length+1)
 return inserted(text,value,fence+language+eol+body+eol+fence,fence.length+language.length+eol.length)
}
const link:Command=(text,original)=>{
 const value=selection(text,original),from=Math.min(value.anchor,value.head),to=Math.max(value.anchor,value.head),lineFrom=text.lastIndexOf('\n',from-1)+1,lineEnd=text.indexOf('\n',from),line=text.slice(lineFrom,lineEnd<0?text.length:lineEnd)
 const match=[...line.matchAll(/\[([^\]\n]*)\]\(([^)\n]*)\)/g)].find(match=>from>=lineFrom+match.index&&to<=lineFrom+match.index+match[0].length)
 if(match)return replace(text,value,lineFrom+match.index,lineFrom+match.index+match[0].length,match[1],lineFrom+match.index+1,match[1].length)
 const body=text.slice(from,to)||'Texto del enlace',insert=`[${body}](https://ejemplo.com)`
 return{changes:[{from,to,insert}],selection:{anchor:from+1,head:from+1+body.length}}
}
const rule:Command=(text,original)=>{
 const value=selection(text,original),position=value.head,line=lines(text).find(line=>position>=line.from&&position<=line.to)
 if(line&&/^ {0,3}---[ \t]*$/.test(line.text))return{changes:[{from:line.from,to:line.to,insert:''}],selection:{anchor:line.from,head:line.from}}
 return inserted(text,{anchor:Math.max(value.anchor,value.head),head:Math.max(value.anchor,value.head)},'---',3)
}
const date=(withTime:boolean):Command=>(text,original,_language,now)=>{
 if(!now||!Number.isFinite(now.getTime()))return unchanged(original)
 const value=selection(text,original),pad=(part:number)=>String(part).padStart(2,'0')
 const day=`${String(now.getFullYear()).padStart(4,'0')}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`
 const insert=day+(withTime?` ${pad(now.getHours())}:${pad(now.getMinutes())}`:'')
 const from=Math.min(value.anchor,value.head),to=Math.max(value.anchor,value.head),end=from+insert.length
 return{changes:[{from,to,insert}],selection:{anchor:end,head:end}}
}
export const markdownCommands:Record<MarkdownAction,Command>={
 bold:inline('bold'),italic:inline('italic'),strike:inline('strike'),inline:inline('inline'),
 paragraph:block('paragraph'),heading1:block('heading1'),heading2:block('heading2'),heading3:block('heading3'),heading:block('heading2'),list:block('list'),ordered:block('ordered'),task:block('task'),quote:block('quote'),code,link,rule,date:date(false),datetime:date(true),
 table:(text,value)=>inserted(text,selection(text,value),'| Columna 1 | Columna 2 |\n| --- | --- |\n| Dato 1 | Dato 2 |',2),
 mermaid:(text,value)=>inserted(text,selection(text,value),'```mermaid\nflowchart LR\n  A[Inicio] --> B[Proceso]\n  B --> C[Fin]\n```',11)
}

// Sonda temporal de CI-1b.
