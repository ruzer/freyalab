import {createHash,randomUUID} from 'node:crypto'
import {lstat,realpath} from 'node:fs/promises'
import {basename,dirname,extname,isAbsolute,join,relative,resolve,sep} from 'node:path'
import {version} from '../../package.json'
import {watch,type FSWatcher} from 'chokidar'
import type {ProjectStore} from './projects'
import type {ProjectSourceRegistry} from './project-source-registry'
import type {Documents} from './documents'
import {chooseExtractDestination,validateExtractDestination} from './extract'
import {fingerprintCsvSource} from './project-sources'
import {projectResult,type ProjectInfo,type ProjectResult,type ProjectSource} from '../shared/project'
import type {ProjectExportOutcome,ProjectResultView} from '../shared/project-exports'
import type {RecipeExtractResult} from '../shared/recipe-operation'
import {t} from '../shared/i18n'

type ExportDocuments=Pick<Documents,'records'|'assertWritableDestination'|'writeProjectDestination'|'open'|'get'|'info'>
type Chooser=(name:string,folder:string)=>Promise<string|null>
type Pending={project:ProjectInfo;result:ProjectResult;path:string}
const inside=(root:string,path:string)=>{const part=relative(root,path);return part!==''&&part!=='..'&&!part.startsWith('../')&&!part.startsWith('..\\')&&!isAbsolute(part)}
const missing=(error:unknown)=>['ENOENT','ENOTDIR'].includes((error as NodeJS.ErrnoException).code??'')
const sameProject=(left:ProjectInfo|undefined|null,right:ProjectInfo)=>!!left&&left.id===right.id&&left.path===right.path
export function canonicalRecipeJSON(value:unknown):string{
 return JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item)
}
const digestRecipe=(value:unknown)=>createHash('sha256').update(canonicalRecipeJSON(value)).digest('hex')

export class ProjectExports{
 private jobs=new Map<string,{project:ProjectInfo;cancelled:boolean;output?:string}>()
 private pending=new Map<string,Pending>()
 private watcher:FSWatcher|undefined
 private watchKey='';private watchGeneration=0;private watchError:Error|undefined
 private watchReady:Promise<void>=Promise.resolve();private settleWatch:(()=>void)|undefined
 constructor(private projects:ProjectStore,private sources:ProjectSourceRegistry,private worker:{call:(method:string,...args:unknown[])=>Promise<unknown>},private docs:ExportDocuments,
  private choose:Chooser=(name,folder)=>chooseExtractDestination(name,join(folder,name),t('project.export.dialog')),private changed?:(error?:Error)=>void){}
 private project(id?:string,readonly=false){
  const project=this.projects.active
  if(!project||id!==undefined&&project.id!==id||project.readonly&&!readonly)throw new Error(t('project.error.readonly'))
  return project
 }
 private result(projectId:string,resultId:string){
  const project=this.project(projectId,true),pending=this.pending.get(resultId)
  const result=this.projects.results.find(value=>value.id===resultId)??(pending&&sameProject(pending.project,project)?pending.result:undefined)
  if(!result||result.kind!=='extract')throw new Error(t('project.error.reference'))
  return{project,result}
 }
 private async confined(project:ProjectInfo,path:string,existing:boolean){
  if(!path||isAbsolute(path)||/^[a-z]:|^[\\/]/i.test(path)||path.split(/[\\/]/).includes('..'))throw new Error(t('project.export.inside'))
  const root=await realpath(project.path),chosen=resolve(root,...path.split(/[\\/]/))
  if(root!==resolve(project.path))throw new Error(t('project.export.inside'))
  if(!inside(root,chosen))throw new Error(t('project.export.inside'))
  const info=await lstat(chosen).catch(error=>{if(missing(error))return null;throw error})
  if(info?.isSymbolicLink())throw new Error(t('extract.error.symlink'))
  const target=info?await realpath(chosen):join(await realpath(dirname(chosen)),basename(chosen))
  if(!inside(root,target))throw new Error(t('project.export.inside'))
  if(existing&&(!info||!info.isFile()))throw Object.assign(new Error(t('project.export.missing')),{code:'ENOENT'})
  return target
 }
 private async view(project:ProjectInfo,result:ProjectResult):Promise<ProjectResultView>{
  let status:ProjectResultView['status']='unknown',reason:string|undefined,path:string|undefined
  try{
   path=await this.confined(project,result.path,true)
   const current=await lstat(path)
   status=current.size!==result.bytes||result.mtimeMs!==undefined&&current.mtimeMs!==result.mtimeMs?'changed':result.mtimeMs===undefined?'unknown':'verified'
  }catch(error){status=missing(error)?'missing':'changed';reason=(error as Error).message}
  if(status==='verified'&&this.watchError){status='unknown';reason=this.watchError.message}
  const isSource=!!path&&(await this.sources.protectedPaths()).has(path)
  const document=path?[...this.docs.records.values()].find(record=>record.info.path===path):undefined
  return{...result,name:basename(result.path),status,isSource,...document?{documentId:document.info.id}:{},...reason?{reason}:{}}
 }
 private async closeWatch(){
  this.watchGeneration++;this.watchKey='';const watcher=this.watcher;this.watcher=undefined;this.settleWatch?.();this.settleWatch=undefined;this.watchError=undefined
  await watcher?.close()
 }
 private async watchResults(project:ProjectInfo,results:ProjectResult[]){
  const paths=[...new Set((await Promise.all(results.map(result=>this.confined(project,result.path,false).catch(()=>undefined)))).filter((path):path is string=>!!path))].sort()
  const key=project.id+'\0'+project.path+'\0'+paths.join('\0')
  if(key===this.watchKey&&this.watcher)return this.watchReady
  const generation=++this.watchGeneration,previous=this.watcher;this.watcher=undefined;this.watchKey=key;this.watchError=undefined;this.settleWatch?.();this.settleWatch=undefined
  await previous?.close()
  if(generation!==this.watchGeneration||!sameProject(this.projects.active,project)||!paths.length)return
  const watcher=watch(paths,{ignoreInitial:true,followSymlinks:false});this.watcher=watcher
  this.watchReady=new Promise<void>(resolve=>{const finish=()=>{if(this.watcher===watcher)this.settleWatch=undefined;resolve()};this.settleWatch=finish;watcher.once('ready',finish)})
  watcher.on('all',()=>{if(this.watcher===watcher)this.changed?.()})
  watcher.on('error',error=>{if(this.watcher===watcher){this.watchError=error instanceof Error?error:new Error(String(error));this.settleWatch?.();this.changed?.(this.watchError)}})
  return this.watchReady
 }
 async list(){
  const project=this.projects.active
  if(!project){await this.closeWatch();return[]}
  const results=this.projects.results.filter(result=>result.kind==='extract')
  await this.watchResults(project,results)
  return Promise.all(results.map(result=>this.view(project,result)))
 }
 private failure(error:unknown,project:ProjectInfo,source:ProjectSource):never{
  const item=error as {code?:string;data?:Record<string,unknown>}
  if(item.code==='changed'&&sameProject(this.projects.active,project)&&canonicalRecipeJSON(this.projects.sources.find(current=>current.id===source.id))===canonicalRecipeJSON(source))this.sources.markRecipeChanged(source.id)
  if(item.code==='schema'&&item.data?.expectedColumns!==undefined)throw new Error(t('project.recipe.engine.schemaWidth',{expected:String(item.data.expectedColumns),actual:String(item.data.actualColumns)}))
  if(item.code==='plan'&&item.data?.constraint==='unbounded-order')throw new Error(t('project.recipe.engine.orderSample'))
  const keys:Record<string,string>={changed:'project.source.changed',unavailable:'project.source.missing','export-limit':'project.export.orderLimit','destination-changed':'project.export.destinationChanged',schema:'project.recipe.engine.schema',columns:'project.recipe.engine.columns',plan:'project.recipe.engine.plan',encoding:'project.recipe.engine.encoding',counter:'project.recipe.engine.counter',csv:'project.recipe.engine.csv'}
  if(item.code&&keys[item.code])throw new Error(t(keys[item.code],{position:String(item.data?.position??'—'),name:String(item.data?.name??'—')}))
  throw error
 }
 private async destination(project:ProjectInfo,path:string,expected?:string){
  if(!sameProject(this.project(project.id),project))throw new Error(t('project.error.changed'))
  const output=await this.confined(project,path,false)
  if(expected&&output!==expected)throw new Error(t('project.export.destinationChanged'))
  if((await this.sources.protectedPaths()).has(output))throw new Error(t('project.export.protected'))
  for(const result of this.projects.results){if(resolve(project.path,result.path)===output||await this.confined(project,result.path,true).catch(()=>undefined)===output)throw new Error(t('project.export.previous'))}
  await validateExtractDestination(this.docs,output)
  return output
 }
 async export(projectId:string,recipeId:string,requestId:string,keepLocal:()=>Promise<boolean>):Promise<ProjectExportOutcome|null>{
  const project=this.project(projectId),resolved=this.projects.resolveRecipe(recipeId)
  if(resolved.chain.some(recipe=>recipe.semantics!==1))throw new Error(t('project.recipe.error.semantics'))
  if(this.jobs.has(requestId))throw new Error(t('project.source.busy'))
  const job={project,cancelled:false,output:undefined as string|undefined};this.jobs.set(requestId,job)
  const recipes=structuredClone(resolved.chain),steps=structuredClone(resolved.steps),recipe=recipes.at(-1)!
  try{
   const source=await this.sources.recipeSource(projectId,resolved.source.id)
   const extension=extname(resolved.source.path).toLowerCase()==='.tsv'?'.tsv':'.csv'
   const name=(recipe.name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/[. ]+$/g,'')||t('project.export.fallbackName'))+extension
   const dataset=join(project.path,'02_datasets'),folder=await lstat(dataset).then(info=>info.isDirectory()?dataset:project.path,()=>project.path)
   const selected=await this.choose(name,folder)
   if(!selected)return null
   if(job.cancelled||!sameProject(this.projects.active,project))return{status:'cancelled'}
   if((await lstat(selected).catch(error=>{if(missing(error))return null;throw error}))?.isSymbolicLink())throw new Error(t('extract.error.symlink'))
   const selectedTarget=join(await realpath(dirname(selected)),basename(selected))
   const relativePath=relative(project.path,selectedTarget).split(sep).join('/'),output=await this.destination(project,relativePath)
   if([...this.jobs.values()].some(other=>other!==job&&other.output===output))throw new Error(t('project.source.busy'))
   job.output=output
   const executedAt=new Date().toISOString(),id=randomUUID()
   const produced=await this.docs.writeProjectDestination(output,async()=>{await this.destination(project,relativePath,output);return this.worker.call('recipeExtract',requestId,source,steps,output,project.path)}) as RecipeExtractResult
   if(produced.sourceSha256.toLowerCase()!==source.sha256.toLowerCase())throw Object.assign(new Error(t('project.source.changed')),{code:'changed'})
   const metadata=produced.coverage,sample=metadata.sampling.at(-1)
   const sampling=sample?{method:sample.method,...sample.requestedRows!==undefined?{rows:sample.requestedRows}:{percent:sample.percent!},...sample.seed!==undefined?{seed:sample.seed}:{}}:undefined
   const coverage={matched:metadata.resultCount,scanned:metadata.scanned,...metadata.complete?{kind:sample?'sample':steps.some(step=>step.op==='filter')?'filtered':'full',complete:true,total:metadata.scanned,...sampling?{sampling}:{}}:{kind:'sample',complete:false},...metadata.sampling.length?{samplingStages:metadata.sampling}:{}}
   const result=projectResult.parse({id,kind:'extract',recipeId,path:relative(project.path,output).split(sep).join('/'),bytes:produced.bytes,sha256:produced.sha256,mtimeMs:produced.mtimeMs,createdAt:executedAt,
    provenance:{sourceSha256:produced.sourceSha256,executedAt,engine:{app:version,contract:'recipe_extract/1',semantics:1},coverage,fidelity:produced.fidelity,warnings:produced.warnings,
     chain:recipes.map(recipe=>recipe.id),recipeSha256:Object.fromEntries(recipes.map(recipe=>[recipe.id,digestRecipe(recipe)])),snapshot:{sourceName:basename(resolved.source.path),columns:metadata.headers,recipes}}})
   this.pending.set(id,{project,result,path:output})
   try{return await this.register(projectId,id,keepLocal)}catch(error){return{status:'unregistered',result:await this.view(project,result),error:(error as Error).message}}
  }catch(error){if(job.cancelled&&(error as {code?:string}).code==='cancelled')return{status:'cancelled'};this.failure(error,project,resolved.source)}
  finally{this.jobs.delete(requestId)}
 }
 async register(projectId:string,resultId:string,keepLocal:()=>Promise<boolean>):Promise<ProjectExportOutcome>{
  const project=this.project(projectId),pending=this.pending.get(resultId)
  if(!pending||!sameProject(pending.project,project))throw new Error(t('project.error.reference'))
  const path=await this.confined(project,pending.result.path,true),current=await fingerprintCsvSource(path)
  if(current.sha256!==pending.result.sha256.toLowerCase()||current.bytes!==pending.result.bytes)throw new Error(t('project.export.changed'))
  return this.commit(project,{...pending.result,mtimeMs:current.quick.mtimeMs},keepLocal)
 }
 private async commit(project:ProjectInfo,result:ProjectResult,keepLocal:()=>Promise<boolean>):Promise<ProjectExportOutcome>{
  if(!sameProject(this.project(project.id),project))throw new Error(t('project.error.changed'))
  if(!await this.projects.registerResult(project.id,result,keepLocal))return{status:'unregistered',result:await this.view(project,result),error:t('project.error.changed')}
  this.pending.delete(result.id)
  return{status:'registered',result:await this.view(project,result)}
 }
 async cancel(requestId:string){const job=this.jobs.get(requestId);if(job){job.cancelled=true;await this.worker.call('recipeCancel',requestId)}}
 async cancelCurrent(){try{await Promise.all([...this.jobs.keys()].map(id=>this.cancel(id)))}finally{await this.closeWatch()}}
 async close(){await this.cancelCurrent()}
 async path(projectId:string,resultId:string){const{project,result}=this.result(projectId,resultId);return this.confined(project,result.path,true)}
 async open(projectId:string,resultId:string){
  const{project,result}=this.result(projectId,resultId),document=await this.docs.open(await this.path(projectId,resultId))
  Object.assign(this.docs.get(document.id).info,{projectResult:{projectId,...await this.view(project,result)}})
  return this.docs.info(document.id)
 }
 async prepareSource(projectId:string,resultId:string){
  const{project,result}=this.result(projectId,resultId);this.project(projectId)
  const path=await this.confined(project,result.path,true),current=await fingerprintCsvSource(path)
  if(current.sha256!==result.sha256.toLowerCase()||current.bytes!==result.bytes)throw new Error(t('project.export.changed'))
  if((await this.sources.protectedPaths()).has(path))throw new Error(t('project.export.isSource'))
  if(!sameProject(this.projects.active,project))throw new Error(t('project.error.changed'))
  return this.sources.prepare(path,{},true)
 }
 async forget(projectId:string,resultId:string,keepLocal:()=>Promise<boolean>){
  this.result(projectId,resultId)
  const saved=await this.projects.forgetResult(projectId,resultId,keepLocal)
  if(saved)for(const record of this.docs.records.values())if(record.info.projectResult?.projectId===projectId&&record.info.projectResult.id===resultId)delete record.info.projectResult
  return saved
 }
}
