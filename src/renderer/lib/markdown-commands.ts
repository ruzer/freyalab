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
function inline(kind:'bold'|'italic'|'strike'|'inline'):Command{return(text,original)=>{
 const value=selection(text,original),from=Math.min(value.anchor,value.head),to=Math.max(value.anchor,value.head),selected=text.slice(from,to)
 let marker=kind==='bold'?'**':kind==='italic'?'*':kind==='strike'?'~~':'`'
 if(kind==='inline'){
  const whole=codeSpans(selected).find(span=>span.from===0&&span.to===selected.length)
  if(whole)return replace(text,value,from,to,selected.slice(whole.start,whole.end),from+whole.start,whole.end-whole.start)
  for(const run of selected.matchAll(/`+/g))if(run[0].length>=marker.length)marker='`'.repeat(run[0].length+1)
 }
 const size=marker.length
 if(selected.length>=size*2&&selected.startsWith(marker)&&selected.endsWith(marker)&&(kind!=='italic'||(/^\*+/.exec(selected)![0].length%2===1&&/\*+$/.exec(selected)![0].length%2===1)))return replace(text,value,from,to,selected.slice(size,-size),from+size,selected.length-size*2)
 const lineFrom=text.lastIndexOf('\n',from-1)+1,lineTo=text.indexOf('\n',from),line=text.slice(lineFrom,lineTo<0?text.length:lineTo)
 const span=(kind==='inline'?codeSpans(line):markerSpans(line,kind)).find(span=>within(span,from-lineFrom,to-lineFrom)||from-lineFrom===span.from&&to-lineFrom===span.to)
 if(span){const inner=text.slice(lineFrom+span.start,lineFrom+span.end);return replace(text,value,lineFrom+span.from,lineFrom+span.to,inner,lineFrom+span.start,inner.length)}
 if(from>=size&&text.slice(from-size,from)===marker&&text.slice(to,to+size)===marker&&(kind!=='italic'||!selected||text[from-size-1]!=='*'&&text[to+size]!=='*'))return replace(text,value,from-size,to+size,selected,from,selected.length)
 return{changes:[{from,to,insert:marker+selected+marker}],selection:{anchor:from+size+(value.anchor-from),head:from+size+(value.head-from)}}
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
