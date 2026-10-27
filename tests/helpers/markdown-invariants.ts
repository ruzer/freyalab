import sanitize from 'sanitize-html'

export function localAnchorStats(html:string){
 const ids:string[]=[],targets:string[]=[]
 sanitize(html,{allowedTags:false,allowedAttributes:false,allowVulnerableTags:true,transformTags:{'*':(tag,attributes)=>{
  if(attributes.id)ids.push(attributes.id)
  if(attributes.href?.startsWith('#')&&attributes.href.length>1)targets.push(attributes.href.slice(1))
  return{tagName:tag,attribs:attributes}
 }}})
 const present=new Set(ids)
 return{ids,targets,duplicates:ids.filter((id,index)=>ids.indexOf(id)!==index),missing:targets.filter(target=>!present.has(target))}
}
