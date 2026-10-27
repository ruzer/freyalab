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
