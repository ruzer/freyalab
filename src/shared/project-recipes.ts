import {t} from './i18n'
import {projectRecipe,type ProjectColumn,type ProjectManifest,type ProjectRecipe,type ProjectRecipeStep,type ProjectSourceView} from './project'

export {projectRecipeDraft} from './project'
export type {ProjectRecipeDraft} from './project'
export type ProjectRecipeView=ProjectRecipe&{rootSourceId:string;depth:number;columns?:ProjectColumn[];editable:boolean;bounded:boolean;dependents:string[];executable:boolean;reason?:string;sourceVersionDifferent?:boolean;sourceStatus?:ProjectSourceView['status']}
export function resolveProjectRecipe(manifest:ProjectManifest,recipe:string|ProjectRecipe){
 const chain:ProjectRecipe[]=[],seen=new Set<string>()
 let current=typeof recipe==='string'?manifest.recipes.find(item=>item.id===recipe):recipe
 while(current){
  if(seen.has(current.id)||chain.length===8)throw new Error(t('project.error.reference'))
  current=projectRecipe.parse(current)
  if(current.semantics!==1)throw new Error(t('project.recipe.error.semantics'))
  seen.add(current.id);chain.unshift(current)
  if('sourceId' in current)break
  const baseId=current.baseRecipeId
  current=manifest.recipes.find(item=>item.id===baseId)
 }
 const first=chain[0],source=first&&'sourceId' in first?manifest.sources.find(source=>source.id===first.sourceId):undefined
 if(!current||!source)throw new Error(t('project.error.reference'))
 const steps=chain.flatMap(recipe=>recipe.steps)
 let columns=source.schema.columns
 for(const step of steps){
  const referenced=step.op==='filter'?step.conditions.map(rule=>rule.column):step.op==='order'?step.by.map(rule=>rule.column):step.op==='select'?step.columns:[]
  for(const column of referenced){
   const actual=source.schema.columns.find(item=>item.position===column.position)
   if(!actual||actual.name!==column.name)throw new Error(t('project.recipe.error.column',{source:source.path.split(/[\\/]/).at(-1)??source.path,position:column.position,expected:column.name,actual:actual?.name??'—'}))
   if(!columns.some(item=>item.position===column.position&&item.name===column.name))throw new Error(t('project.recipe.error.unavailableColumn',{position:column.position,name:column.name}))
  }
  if(step.op==='select')columns=step.columns
 }
 return{source,chain,steps,columns}
}
export function projectRecipeDependents(manifest:Pick<ProjectManifest,'recipes'>,id:string){
 const found=new Set([id])
 for(let size=0;size!==found.size;){
  size=found.size
  for(const recipe of manifest.recipes)if('baseRecipeId' in recipe&&found.has(recipe.baseRecipeId))found.add(recipe.id)
 }
 return manifest.recipes.filter(recipe=>recipe.id!==id&&found.has(recipe.id))
}
export function projectRecipeEditorCompatible(steps:ProjectRecipeStep[]){
 const rank={filter:0,order:1,sample:2,select:3}
 let previous=-1
 for(const step of steps){
  if(rank[step.op]<=previous)return false
  previous=rank[step.op]
  if(step.op==='filter'&&!step.conditions.length||step.op==='order'&&!step.by.length)return false
  if(step.op==='select'&&(!step.columns.length||step.columns.some((column,index)=>index>0&&column.position<=step.columns[index-1].position)))return false
 }
 return true
}

export function projectRecipeBounded(steps:ProjectRecipeStep[]){return steps.some(step=>step.op==='sample'&&'rows' in step)}
