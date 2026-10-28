export function frontMatterOf(source:string):{body:string;frontMatter?:string} {
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

// shortcut: solo las tres formas de tags de MD009; YAML estructural requiere otro contrato.
export function parseTags(frontMatter?:string):string[] {
 if(!frontMatter)return[]
 const lines=frontMatter.split(/\r?\n/),index=lines.findIndex(line=>/^tags[ \t]*:/.test(line))
 if(index<0)return[]
 const first=tagParts(lines[index].replace(/^tags[ \t]*:/,''),false)
 if(!first)return[]
 const value=first[0].trim()
 let parts:string[]=[]
 if(value){
  const inline=value.startsWith('[')
  if(inline&&!value.endsWith(']'))return[]
  const parsed=tagParts(inline?value.slice(1,-1):value,true)
  if(!parsed)return[]
  parts=parsed
 }else{
  for(let cursor=index+1;cursor<lines.length;cursor++){
   const line=lines[cursor]
   if(/^[ \t]*(?:#.*)?$/.test(line))continue
   const item=/^[ \t]*-(?:[ \t]+(.*))?$/.exec(line)
   if(!item){if(/^[ \t]+/.test(line))return[];break}
   const parsed=tagParts(item[1]??'',false)
   if(!parsed)return[]
   parts.push(...parsed)
  }
 }
 const tags:string[]=[],seen=new Set<string>()
 for(const part of parts){
  let tag=part.trim()
  if(tag.startsWith('"')){
   if(!/^"(?:[^"\\]|\\["\\])*"$/.test(tag))return[]
   tag=tag.slice(1,-1).replace(/\\(["\\])/g,'$1')
  }else if(tag.startsWith("'")){
   if(!/^'(?:[^']|'')*'$/.test(tag))return[]
   tag=tag.slice(1,-1).replace(/''/g,"'")
  }else if(/^[&*!|>]|[\[\]{}]|:[ \t]|^(?:null|~|true|false)$/i.test(tag))return[]
  tag=tag.trim().replace(/^#/,'').trim()
  if(!tag||Array.from(tag).length>64)continue
  const key=tag.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase()
  if(!seen.has(key)&&tags.length<50){seen.add(key);tags.push(tag)}
 }
 return tags
}

function tagParts(text:string,split:boolean):string[]|undefined {
 const parts:string[]=[]
 let start=0,quote='',boundary=true,end=text.length
 for(let index=0;index<text.length;index++){
  const character=text[index]
  if(quote){
   if(quote==='"'&&character==='\\'){index++;continue}
   if(character===quote){
    if(quote==="'"&&text[index+1]==="'"){index++;continue}
    quote=''
   }
   continue
  }
  if((character==='"'||character==="'")&&boundary){quote=character;boundary=false;continue}
  if(character==='#'&&(!boundary||/[ \t]/.test(text[index+1]??''))&&((index>0&&/[ \t]/.test(text[index-1]))||index===0)){end=index;break}
  if(character===','){
   if(split){parts.push(text.slice(start,index));start=index+1}
   boundary=true
  }else if(character==='[')boundary=true
  else if(!/[ \t]/.test(character))boundary=false
 }
 if(quote)return undefined
 parts.push(text.slice(start,end))
 return parts
}
