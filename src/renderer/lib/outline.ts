import type {Heading} from './render'

export type HeadingMetric={id:string;top:number}
export type OutlineNode=Heading&{key:string;depth:number;ancestors:string[];hasChildren:boolean}

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
