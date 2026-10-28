type Node={type:string;value?:string;alt?:string;identifier?:string;label?:string;url?:string;children?:Node[];position?:{start:{offset?:number};end:{offset?:number}};data?:{hName?:string;hProperties?:Record<string,unknown>}}
export interface NumberedItem {key:string;id:string;number:number;label:string;caption:string}
export interface Numbering {figures:NumberedItem[];tables:NumberedItem[];warnings:string[];targets:Map<string,{tag:string;properties:Record<string,unknown>}>;labels:{fig:string;tbl:string}}
export function numberingFor(frontMatter?:string):Numbering {
 const language=/^lang[ \t]*:[ \t]*["']?([a-z]{2})(?:[-_\s"']|$)/im.exec(frontMatter??'')?.[1].toLowerCase()??'es'
 const labels:Record<string,[string,string]>={es:['Figura','Tabla'],en:['Figure','Table'],fr:['Figure','Tableau'],pt:['Figura','Tabela'],de:['Abbildung','Tabelle'],it:['Figura','Tabella']}
 const [fig,tbl]=labels[language]??labels.es
 return{figures:[],tables:[],warnings:[],targets:new Map(),labels:{fig,tbl}}
}
const keyPattern='[\\p{L}\\p{N}][\\p{L}\\p{N}_.:-]*'
const imageId=new RegExp(`^\\s*\\{#(fig:${keyPattern})\\}\\s*$`,'u')
const tableId=new RegExp(`\\s*\\{#(tbl:${keyPattern})\\}\\s*$`,'u')
const reference=new RegExp(`\\[@((?:fig|tbl):${keyPattern})\\]`,'gu')
const textOf=(node:Node):string=>node.value??node.alt??(node.children??[]).map(textOf).join('')
export default function remarkNumbering(this:{parse:(source:string)=>Node},numbering:Numbering){
 const parse=(value:string)=>this.parse(value)
 return(tree:Node,file:{value?:unknown})=>{
  const source=typeof file.value==='string'?file.value:'',known=new Map<string,NumberedItem>()
  const inline=(value:string)=>{
   const children=parse('x '+value).children?.[0]?.children??[{type:'text',value:'x '+value}]
   if(children[0]?.type==='text')children[0].value=children[0].value?.slice(2)
   return children
  }
  const raw=(node:Node)=>source.slice(node.position?.start.offset??0,node.position?.end.offset??0)
  function wrap(kind:'fig'|'tbl',key:string,content:Node,caption:Node[]):Node {
   const items=kind==='fig'?numbering.figures:numbering.tables,number=items.length+1,id=`${kind==='fig'?'figure':'table'}-${number}`,label=`${numbering.labels[kind]} ${number}`
   const item={key,id,number,label,caption:caption.map(textOf).join('')};items.push(item)
   if(known.has(key))numbering.warnings.push(`El identificador «${key}» está repetido. La referencia lleva a su primera aparición.`)
   else known.set(key,item)
   numbering.targets.set(`user-content-freya-${id}`,{tag:'figure',properties:{id,className:[kind==='fig'?'academic-figure':'academic-table']}})
   numbering.targets.set(`user-content-freya-caption-${id}`,{tag:'figcaption',properties:{}})
   return{type:'academicFigure',data:{hName:'div',hProperties:{id:`freya-${id}`}},children:[content,{type:'paragraph',data:{hProperties:{id:`freya-caption-${id}`}},children:[{type:'text',value:`${label}. `},...caption]}]}
  }
  function blocks(parent:Node){
   const children=parent.children;if(!children)return
   for(let index=0;index<children.length;index++){
    const node=children[index],image=node.children?.[0],tail=node.children?.[1]
    if(node.type==='paragraph'&&node.children?.length===2&&['image','imageReference'].includes(image?.type??'')&&tail?.type==='text'){
     const key=imageId.exec(tail.value??'')?.[1]
     if(key&&image){
      // Convertir la imagen a enlace deja que remark conserve el formato de su etiqueta.
      const context=image.type==='imageReference'?`\n\n[${image.label??image.identifier}]: #`:''
      const parsed=parse(raw(image).slice(1)+context).children?.[0]?.children?.[0]
      const caption=parsed?.children??[{type:'text',value:image.alt??''}]
      children[index]=wrap('fig',key,image,caption);continue
     }
    }
    if(node.type==='table'){
     const following=children[index+1],last=node.children?.at(-1)
     const candidate=following?.type==='paragraph'?following:(node.children?.length??0)>1&&last?.type==='tableRow'&&/^:[ \t]+/.test(raw(last))?last:undefined
     const value=candidate&&raw(candidate),match=value&&/^:[ \t]+/.test(value)&&tableId.exec(value)
     if(match){
      if(candidate===following)children.splice(index+1,1);else node.children!.pop()
      children[index]=wrap('tbl',match[1],node,inline(value.slice(0,match.index).replace(/^:[ \t]+/,'')));continue
     }
    }
    if(!['code','inlineCode','html','definition','footnoteDefinition'].includes(node.type))blocks(node)
   }
  }
  blocks(tree)
  function references(parent:Node){
   if(!parent.children||['link','linkReference','code','inlineCode','html','definition','footnoteDefinition'].includes(parent.type))return
   parent.children=parent.children.flatMap(node=>{
    if(node.type!=='text'){references(node);return[node]}
    const value=node.value??'',nodes:Node[]=[];let start=0
    for(const match of value.matchAll(reference)){
     if(match.index>start)nodes.push({type:'text',value:value.slice(start,match.index)})
     const item=known.get(match[1])
     nodes.push(item?{type:'link',url:`#${item.id}`,children:[{type:'text',value:item.label}]}:{type:'academicReference',data:{hName:'span'},children:[{type:'text',value:match[0]}]})
     if(!item){
      const id=`freya-missing-${numbering.targets.size}`
      nodes.at(-1)!.data!.hProperties={id}
      numbering.targets.set(`user-content-${id}`,{tag:'span',properties:{className:['enlace-roto'],dataSeccionFaltante:match[1]}})
     }
     start=match.index+match[0].length
    }
    if(!nodes.length)return[node]
    if(start<value.length)nodes.push({type:'text',value:value.slice(start)})
    return nodes
   })
  }
  references(tree)
 }
}
