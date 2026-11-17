import {randomUUID} from 'node:crypto'
import type {ProjectStore} from './projects'
import type {ProjectSourceRegistry} from './project-source-registry'
import type {Documents} from './documents'
import type {ProjectRecipe} from '../shared/project'
import type {ProjectRecipeDraft} from '../shared/project-recipes'
import type {RecipeOperationResult,RecipeOperationErrorCode,RecipeAnalysisPrepared,RecipeAnalysisContext} from '../shared/recipe-operation'
import {ANALYSIS_LIMITS} from './analysis-source'
import {t} from '../shared/i18n'

const sameHash=(left:string|undefined,right:string)=>typeof left==='string'&&left.toLowerCase()===right.toLowerCase()

export class ProjectSubsets{
 private running:{id:string;cancelled:boolean}|undefined
 constructor(private projects:ProjectStore,private sources:ProjectSourceRegistry,private worker:{call:(method:string,...args:unknown[])=>Promise<unknown>},private docs?:Pick<Documents,'installSubset'|'close'>){}
 private fail(error:unknown,project:ProjectStore['active'],sourceId?:string):never{
  const failure=error as {code?:RecipeOperationErrorCode;data?:Record<string,unknown>}
  if(failure.code==='changed'&&sourceId&&this.projects.active===project)this.sources.markRecipeChanged(sourceId)
  if(failure.code==='analysis-limit')throw new Error(t('project.recipe.analysis.limit.'+(['bytes','rows','cells','columns'].includes(String(failure.data?.kind))?String(failure.data?.kind):'bytes')))
  if(failure.code==='analysis-structure')throw new Error(t('project.recipe.analysis.structure'))
  if(failure.code==='schema'&&failure.data?.expectedColumns!==undefined)throw new Error(t('project.recipe.engine.schemaWidth',{expected:String(failure.data.expectedColumns),actual:String(failure.data.actualColumns)}))
  if(failure.code==='plan'&&failure.data?.constraint==='unbounded-order')throw new Error(t('project.recipe.engine.orderSample'))
  const keys:Partial<Record<RecipeOperationErrorCode,string>>={schema:'project.recipe.engine.schema',columns:'project.recipe.engine.columns',plan:'project.recipe.engine.plan',changed:'project.source.changed',csv:'project.recipe.engine.csv',encoding:'project.recipe.engine.encoding',counter:'project.recipe.engine.counter',unavailable:'project.source.missing'}
  const key=failure.code&&keys[failure.code]
  if(key)throw new Error(t(key,{position:String(failure.data?.position??'—'),name:String(failure.data?.name??'—')}))
  throw error
 }
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
   if(!sameHash(current.source.sha256,source.sha256)||JSON.stringify(current.steps)!==JSON.stringify(resolved.steps))throw new Error(t('project.source.changed'))
   return{...result,sourceVersionDifferent:resolved.chain.some(item=>item.id!==recipe.id&&!sameHash(item.sourceSha256,source.sha256))||!!draft.id&&this.projects.recipes.some(item=>item.id===draft.id&&!sameHash(item.sourceSha256,source.sha256))}
  }catch(error){this.fail(error,project,sourceId)}finally{if(this.running===control)this.running=undefined}
 }
 async analyze(projectId:string,recipeId:string,requestId:string){
  const project=this.projects.active,recipe=this.projects.recipes.find(recipe=>recipe.id===recipeId)
  if(!project||project.id!==projectId)throw new Error(t('project.error.readonly'))
  if(!recipe)throw new Error(t('project.error.reference'))
  if(recipe.semantics!==1)throw new Error(t('project.recipe.error.semantics'))
  if(!this.docs)throw new Error(t('project.error.reference'))
  if(this.running)throw new Error(t('project.source.busy'))
  const control={id:requestId,cancelled:false},snapshotId=randomUUID();this.running=control
  let sourceId:string|undefined,started=false,published:{id:string}|undefined,success=false
  try{
   const resolved=this.projects.resolveRecipe(recipeId),chain=JSON.stringify(resolved.chain);sourceId=resolved.source.id
   const source=await this.sources.recipeSource(projectId,sourceId)
   const assertCurrent=()=>{
    if(this.projects.active!==project)throw new Error(t('project.error.changed'))
    const current=this.projects.resolveRecipe(recipeId)
    if(!sameHash(current.source.sha256,source.sha256)||JSON.stringify(current.chain)!==chain)throw new Error(t('project.source.changed'))
   }
   for(const kind of ['bytes','columns'] as const){const value=kind==='bytes'?source.bytes:source.schema.columns.length;if(value>ANALYSIS_LIMITS[kind])throw{code:'analysis-limit',data:{kind}}}
   if(control.cancelled)throw new Error(t('project.recipe.cancelled'))
   started=true
   const prepared=await this.worker.call('recipeAnalysis',requestId,snapshotId,source,resolved.steps) as RecipeAnalysisPrepared
   if(control.cancelled||prepared.coverage.cancelled)throw new Error(t('project.recipe.cancelled'))
   if(!prepared.coverage.complete||!sameHash(prepared.coverage.sha256,source.sha256))throw new Error(t('project.source.changed'))
   assertCurrent()
   await this.sources.recipeSource(projectId,sourceId)
   if(control.cancelled||this.projects.active!==project)throw new Error(t('project.recipe.cancelled'))
   assertCurrent()
   const context:RecipeAnalysisContext={projectId,recipeId,sourceId,name:recipe.name,sourceName:resolved.source.path.split(/[\\/]/).at(-1)??resolved.source.path,steps:resolved.steps,stepOwners:resolved.chain.flatMap(item=>item.steps.map(()=>item.name)),coverage:{...prepared.coverage,...resolved.chain.some(item=>!sameHash(item.sourceSha256,source.sha256))?{sourceVersionDifferent:true}:{}}}
   const document=await this.docs.installSubset(snapshotId,context);published=document
   if(control.cancelled||this.projects.active!==project)throw new Error(t('project.recipe.cancelled'))
   assertCurrent()
   success=true;return document
  }catch(error){this.fail(error,project,sourceId)}finally{
   if(!success){if(published)await this.docs.close(published.id).catch(()=>{});if(started)await this.worker.call('close',snapshotId).catch(()=>{})}
   if(this.running===control)this.running=undefined
  }
 }
 async cancel(requestId:string){if(this.running?.id===requestId){this.running.cancelled=true;await this.worker.call('recipeCancel',requestId)}}
 async cancelCurrent(){if(this.running)await this.cancel(this.running.id)}
}
