import {randomUUID} from 'node:crypto'
import type {ProjectStore} from './projects'
import type {ProjectSourceRegistry} from './project-source-registry'
import type {ProjectRecipe} from '../shared/project'
import type {ProjectRecipeDraft} from '../shared/project-recipes'
import type {RecipeOperationResult,RecipeOperationErrorCode} from '../shared/recipe-operation'
import {t} from '../shared/i18n'

export class ProjectSubsets{
 private running:{id:string;cancelled:boolean}|undefined
 constructor(private projects:ProjectStore,private sources:ProjectSourceRegistry,private worker:{call:(method:string,...args:unknown[])=>Promise<unknown>}){}
 async try(projectId:string,draft:ProjectRecipeDraft,requestId:string){
  const project=this.projects.active
  if(!project||project.id!==projectId)throw new Error(t('project.error.readonly'))
  const existing=draft.id?this.projects.recipes.find(recipe=>recipe.id===draft.id):undefined
  if(draft.id&&!existing)throw new Error(t('project.error.reference'))
  if(existing&&existing.semantics!==1)throw new Error(t('project.recipe.error.semantics'))
  const definition=(recipe:ProjectRecipe|ProjectRecipeDraft)=>JSON.stringify({...('sourceId'in recipe?{sourceId:recipe.sourceId}:{baseRecipeId:recipe.baseRecipeId}),steps:recipe.steps})
  if(project.readonly&&(!existing||definition(existing)!==definition(draft)))throw new Error(t('project.error.readonly'))
  if(this.running)throw new Error(t('project.source.busy'))
  const control={id:requestId,cancelled:false};this.running=control
  let sourceId:string|undefined
  try{
   const recipe:ProjectRecipe={...draft,id:draft.id??randomUUID(),createdAt:new Date().toISOString(),sourceSha256:'0'.repeat(64),semantics:1}
   const resolved=this.projects.resolveRecipe(recipe)
   sourceId=resolved.source.id
   const source=await this.sources.recipeSource(projectId,resolved.source.id)
   if(control.cancelled)throw new Error(t('project.recipe.cancelled'))
   let result=await this.worker.call('recipePreview',requestId,source,resolved.steps) as RecipeOperationResult
   if(this.projects.active!==project)throw new Error(t('project.error.changed'))
   if(control.cancelled&&!result.cancelled){const {sha256:_,...partial}=result;result={...partial,rows:[],resultCount:0,complete:false,cancelled:true}}
   const current=this.projects.resolveRecipe(recipe)
   if(current.source.sha256!==source.sha256||JSON.stringify(current.steps)!==JSON.stringify(resolved.steps))throw new Error(t('project.source.changed'))
   return{...result,sourceVersionDifferent:resolved.chain.some(item=>item.id!==recipe.id&&item.sourceSha256!==source.sha256)||!!draft.id&&this.projects.recipes.some(item=>item.id===draft.id&&item.sourceSha256!==source.sha256)}
  }catch(error){
   const failure=error as {code?:RecipeOperationErrorCode;data?:Record<string,unknown>}
   if(failure.code==='changed'&&sourceId&&this.projects.active===project)this.sources.markRecipeChanged(sourceId)
   if(failure.code==='schema'&&failure.data?.expectedColumns!==undefined)throw new Error(t('project.recipe.engine.schemaWidth',{expected:String(failure.data.expectedColumns),actual:String(failure.data.actualColumns)}))
   if(failure.code==='plan'&&failure.data?.constraint==='unbounded-order')throw new Error(t('project.recipe.engine.orderSample'))
   const keys={schema:'project.recipe.engine.schema',columns:'project.recipe.engine.columns',plan:'project.recipe.engine.plan',changed:'project.source.changed',csv:'project.recipe.engine.csv',encoding:'project.recipe.engine.encoding',counter:'project.recipe.engine.counter',unavailable:'project.source.missing'}
   if(failure.code&&Object.hasOwn(keys,failure.code))throw new Error(t(keys[failure.code],{position:String(failure.data?.position??'—'),name:String(failure.data?.name??'—')}))
   throw error
  }finally{if(this.running===control)this.running=undefined}
 }
 async cancel(requestId:string){if(this.running?.id===requestId){this.running.cancelled=true;await this.worker.call('recipeCancel',requestId)}}
 async cancelCurrent(){if(this.running)await this.cancel(this.running.id)}
}
