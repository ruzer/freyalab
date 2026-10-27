type Point={line?:number;column?:number;offset?:number}
type Node={type:string;value?:string;identifier?:string;children?:Node[];data?:{hName?:unknown;hProperties?:unknown};position?:{start:Point;end:Point}}
type Tag={tag:'details'|'summary';close:boolean;open:boolean}
type Frame=Tag&{children:Node[];broken?:boolean}

export default function remarkDetails(this:{parse:(value:string)=>Node}) {
 const definitions=new Map<string,string>()
 let source='',lineStarts=[0],lastLine=false
 function sourceLine(number:number){
  while(lineStarts.length<=number&&!lastLine){const end=source.indexOf('\n',lineStarts.at(-1)!);if(end<0)lastLine=true;else lineStarts.push(end+1)}
  const from=lineStarts[number-1];if(from===undefined)return
  const next=lineStarts[number],end=next===undefined?source.length:next-1
  return{from,end:end>from&&source[end-1]==='\r'?end-1:end}
 }
 function originOf(node:Node,value:string){
  const origin=node.position?.start,limit=node.position?.end.offset
  if(origin?.line===undefined||origin.offset===undefined||limit===undefined)return()=>undefined
  const lines:{local:number;localEnd:number;line:number;start:number;from:number;end:number}[]=[]
  let start=0,number=origin.line
  while(start<=value.length){
   const next=value.indexOf('\n',start),end=next<0?value.length:next,content=value.slice(start,end).replace(/\r$/,'')
   const row=sourceLine(number);if(!row)break
   const stop=Math.min(row.end,limit),raw=source.slice(Math.max(row.from,number===origin.line?origin.offset:row.from),stop).replace(/\0/g,'\ufffd')
   const plain=content.replace(/^[ \t]*/,''),whole=raw.endsWith(content)
   // Containers remove quote/list prefixes; partially consumed tabs can leave virtual spaces.
   if(whole||plain&&raw.endsWith(plain))lines.push({local:start,localEnd:end,line:number,start:row.from,from:stop-content.length,end:stop})
   if(next<0)break
   start=next+1;number++
  }
  return(offset:number):Point|undefined=>{
   let low=0,high=lines.length
   while(low<high){const middle=(low+high)>>>1;if(lines[middle].local<=offset)low=middle+1;else high=middle}
   const line=lines[low-1];if(!line||offset>line.localEnd)return
   const absolute=Math.max(line.start,Math.min(line.end,line.from+offset-line.local))
   return{line:line.line,column:absolute-line.start+1,offset:absolute}
  }
 }
 // CommonMark aplica este plegado para que también coincidan rótulos como ß/SS.
 const label=(value:string)=>value.replace(/[\t\n\r ]+/g,' ').replace(/^ | $/g,'').toLowerCase().toUpperCase()
 const parse=(value:string)=>{
  if(!definitions.size||!value.includes('['))return this.parse(value).children??[]
  const selected=new Set<string>()
  for(const match of value.matchAll(/\[((?:\\.|[^\[\]\\])*)\]/g)){const definition=definitions.get(label(match[1]));if(definition)selected.add(definition)}
  if(!selected.size)return this.parse(value).children??[]
  const context='\n\n'+[...selected].join('\n\n')
  const nodes=(this.parse(value+context).children??[]).filter(node=>(node.position?.start.offset??0)<value.length)
  if(!nodes.some(node=>(node.position?.end.offset??0)>value.length))return nodes
  // An unclosed code/raw block must not absorb the appended reference definitions.
  const original=this.parse(value).children??[]
  return nodes.map(node=>(node.position?.end.offset??0)>value.length?original.find(candidate=>candidate.position?.start.offset===node.position?.start.offset):node).filter((node):node is Node=>node!==undefined)
 }
 function children(nodes:Node[]):Node[] {
  const output:Node[]=[],stack:Frame[]=[]
  function add(node:Node){
   const frame=stack.at(-1),target=frame?.children??output
   if(frame?.tag==='summary'&&node.type==='paragraph')target.push(...node.children??[])
   else target.push(node)
  }
  function unwrap(frame:Frame){for(const node of frame.children){if(node.data?.hName==='summary')for(const child of node.children??[])add(child);else add(node)}}
  function tag(token:Tag){
   if(!token.close){stack.push({...token,children:[]});return}
   if(token.tag==='details'&&stack.at(-1)?.tag==='summary'){
    unwrap(stack.pop()!)
    if(stack.length)stack.at(-1)!.broken=true
   }
   if(stack.at(-1)?.tag!==token.tag)return
   const frame=stack.pop()!
   if(frame.broken||(frame.tag==='summary'&&stack.at(-1)?.tag!=='details')){unwrap(frame);return}
   add({type:'freyaDetails',data:{hName:frame.tag,hProperties:frame.open?{open:true}:{}},children:frame.children})
  }
  function html(original:Node){
   const value=original.value??'',origin=originOf(original,value)
   function markdown(from:number,to:number){
    const valuePart=value.slice(from,to);if(!valuePart.trim())return
    function rebase(node:Node){
     if(node.position)for(const key of ['start','end'] as const){const offset=node.position[key].offset,point=offset===undefined?undefined:origin(from+offset);node.position[key]=point??{...node.position[key],offset:undefined}}
     for(const child of node.children??[])rebase(child)
    }
    for(const node of parse(valuePart)){rebase(node);add(node)}
   }
   let start=0,index=0
   const lastTicks=new Map<number,number>()
   for(const run of value.matchAll(/`+/g))lastTicks.set(run[0].length,run.index)
   while(index<value.length){
    // CommonMark already protects code nodes; raw HTML blocks can also contain fences.
    if(index===0||value[index-1]==='\n'){
     if(/^(?: {4}|\t)/.test(value.slice(index))){const end=value.indexOf('\n',index);index=end<0?value.length:end+1;continue}
     const fence=/^[ \t]{0,3}(`{3,}|~{3,})[^\n]*(?:\n|$)/.exec(value.slice(index))
     if(fence){
      const end=new RegExp(`^[ \\t]{0,3}${fence[1][0]}{${fence[1].length},}[ \\t]*(?:\\r?\\n|$)`,'gm')
      end.lastIndex=index+fence[0].length
      const match=end.exec(value);index=match?end.lastIndex:value.length;continue
     }
    }
    if(value.startsWith('<!--',index)){
     const end=value.indexOf('-->',index+4),stop=end<0?value.length:end+3
     markdown(start,index);add({type:'html',value:value.slice(index,stop)});index=stop;start=index;continue
    }
    if(value[index]==='`'){
     const run=/^`+/.exec(value.slice(index))![0]
     if((lastTicks.get(run.length)??-1)<=index){index+=run.length;continue}
     let end=index+run.length
     while((end=value.indexOf(run,end))>=0){if(value[end-1]!=='`'&&value[end+run.length]!=='`')break;end+=run.length}
     if(end>=0){index=end+run.length;continue}
     index+=run.length;continue
    }
    if(value[index]==='<'){
     let escapes=0;for(let i=index-1;i>=0&&value[i]==='\\';i--)escapes++
     if(escapes%2){index++;continue}
     const raw=/^<(code|script|style|pre|textarea|xmp|iframe|title|noembed|noframes|plaintext)\b[^>]*>/i.exec(value.slice(index))
     if(raw){
      const end=new RegExp(`</${raw[1]}\\s*>`,'gi');end.lastIndex=index+raw[0].length
      const stop=end.exec(value)?end.lastIndex:value.length
      markdown(start,index);add({type:'html',value:value.slice(index,stop)});index=stop;start=index;continue
     }
     const token=/^<\/?(?:details|summary)\b[^>]*>/i.exec(value.slice(index))
     if(token){
      markdown(start,index)
      const safe=/^<(\/)?(details|summary)(?:\s+(open))?\s*>$/i.exec(token[0])
      if(safe&&(!safe[1]||!safe[3])&&(safe[2].toLowerCase()==='details'||!safe[3]))tag({tag:safe[2].toLowerCase() as Tag['tag'],close:!!safe[1],open:!!safe[3]})
      index+=token[0].length;start=index;continue
     }
    }
    index++
   }
   markdown(start,value.length)
  }
  for(const node of nodes){
   if(node.type==='html'&&/^\s*<\/?(?:details|summary)\b/i.test(node.value??'')){html(node);continue}
   // Inline HTML keeps its text; only flow siblings become collapsible blocks.
   if(node.children&&!['paragraph','heading','tableCell'].includes(node.type))node.children=children(node.children)
   add(node)
  }
  const pending=stack.splice(0)
  for(const frame of pending)unwrap(frame)
  return output
 }
 return(tree:Node,file?:{value?:unknown})=>{
  source=typeof file?.value==='string'?file.value:'';lineStarts=[0];lastLine=false
  definitions.clear()
  function collect(node:Node){
   const start=node.position?.start.offset,end=node.position?.end.offset
   if((node.type==='definition'||node.type==='footnoteDefinition')&&node.identifier!==undefined&&start!==undefined&&end!==undefined){const key=label((node.type==='footnoteDefinition'?'^':'')+node.identifier);if(!definitions.has(key))definitions.set(key,source.slice(start,end))}
   for(const child of node.children??[])collect(child)
  }
  if(source)collect(tree)
  if(tree.children)tree.children=children(tree.children)
 }
}
