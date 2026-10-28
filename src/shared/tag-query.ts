export interface FileQueryToken {value:string;tag:boolean;from:number;to:number}
export function tokensFileQuery(query:string):FileQueryToken[] {
 return Array.from(query.matchAll(/#"(?:\\.|[^"\\])*"(?=\s|$)|\S+/gu),match=>{
  const raw=match[0],from=match.index
  let value=raw,tag=false
  if(raw.startsWith('#"')){
   try{value=JSON.parse(raw.slice(1));tag=typeof value==='string'&&value.length>0}catch{}
  }else if(raw.startsWith('#')&&raw.length>1){value=raw.slice(1);tag=true}
  return{value,tag,from,to:from+raw.length}
 })
}
export function tagQueryToken(tag:string):string {
 return`#${/[\s"\\]/u.test(tag)?JSON.stringify(tag):tag}`
}
