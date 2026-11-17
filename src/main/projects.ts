import {createHash,randomUUID} from 'node:crypto'
import {constants} from 'node:fs'
import {lstat,mkdir,open,readFile,realpath,rmdir} from 'node:fs/promises'
import {basename,isAbsolute,join} from 'node:path'
import {z} from 'zod'
import {atomicWrite} from './files'
import {resolveProjectRecipe,projectRecipeDependents,projectRecipeDraft,projectRecipeEditorCompatible,projectRecipeBounded,type ProjectRecipeDraft,type ProjectRecipeView} from '../shared/project-recipes'
import {t} from '../shared/i18n'
import {projectEnvelope,projectFile,projectFolders,projectManifest,projectName,projectRecipe,projectSource,type ProjectInfo,type ProjectManifest,type ProjectRecipe,type ProjectSource} from '../shared/project'

const maxManifest=4*1024*1024
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex')
const missing=(error:unknown)=>['ENOENT','ENOTDIR'].includes((error as NodeJS.ErrnoException).code??'')
const sortedJSON=(value:unknown):string=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item,2)+'\n'
type Snapshot={info:ProjectInfo;digest:string;manifest?:ProjectManifest}

function futureProjection(value:Record<string,unknown>):ProjectManifest|undefined{
 const base=projectManifest.safeParse({format:value.format,version:1,id:value.id,name:value.name,createdAt:value.createdAt,sources:[],recipes:[],results:[]})
 if(!base.success)return undefined
 const records=(value:unknown):Record<string,unknown>[]=>Array.isArray(value)?value.filter((item):item is Record<string,unknown>=>!!item&&typeof item==='object'&&!Array.isArray(item)):[]
 const unique=(items:Record<string,unknown>[])=>items.filter(item=>typeof item.id==='string'&&items.filter(other=>other.id===item.id).length===1)
 const sources=unique(records(value.sources)).flatMap(item=>{
  const parsed=projectSource.safeParse(item)
  return parsed.success&&projectManifest.safeParse({...base.data,sources:[parsed.data]}).success?[parsed.data]:[]
 })
 const recipes=unique(records(value.recipes)).flatMap(item=>{const parsed=projectRecipe.safeParse(item);return parsed.success?[parsed.data]:[]})
 // This is a read-only projection: each selected chain is fully validated before execution.
 return{...base.data,sources,recipes}
}

async function readProject(folder:string):Promise<Snapshot>{
 const file=join(folder,projectFile),before=await lstat(file)
 if(!before.isFile()||before.size>maxManifest)throw new Error(t('project.error.file'))
 const flags=process.platform==='win32'?'r':constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK
 const handle=await open(file,flags)
 try{
  const stat=await handle.stat()
  if(!stat.isFile()||stat.ino!==before.ino||stat.dev!==before.dev||stat.size!==before.size||stat.mtimeMs!==before.mtimeMs)throw new Error(t('project.error.changed'))
  const bytes=Buffer.alloc(stat.size+1)
  let total=0
  while(total<bytes.length){const {bytesRead}=await handle.read(bytes,total,bytes.length-total,total);if(!bytesRead)break;total+=bytesRead}
  const after=await lstat(file)
  if(total!==stat.size||!after.isFile()||after.ino!==stat.ino||after.dev!==stat.dev||after.size!==stat.size||after.mtimeMs!==stat.mtimeMs)throw new Error(t('project.error.changed'))
  const content=bytes.subarray(0,total)
  let value:unknown
  try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(content))}catch{throw new Error(t('project.error.json'))}
  const envelope=projectEnvelope.safeParse(value)
  if(!envelope.success)throw new Error(t('project.error.schema'))
  const {version,id,name}=envelope.data
  if(version>1){
   const manifest=futureProjection(envelope.data)
   return{info:{id:typeof id==='string'&&id&&id.length<=100?id:folder,name:typeof name==='string'&&name?name.slice(0,200):basename(folder),path:folder,version,readonly:true,sourceCount:manifest?.sources.length??0},digest:hash(content),manifest}
  }
  const result=projectManifest.safeParse(value)
  if(!result.success)throw new Error(t('project.error.schema'))
  return{info:{id:result.data.id,name:result.data.name,path:folder,version,readonly:false,sourceCount:result.data.sources.length},digest:hash(content),manifest:result.data}
 }finally{await handle.close()}
}

export class ProjectStore{
 private current:Snapshot|undefined
 private recentFailure=false
 private queue:Promise<unknown>=Promise.resolve()
 constructor(private profile:string){}
 get active(){return this.current?.info??null}
 get sources(){return this.current?.manifest?.sources??[]}
 get recipes():ProjectRecipe[]{return this.current?.manifest?.recipes??[]}
 get recentWriteFailed(){return this.recentFailure}
 resolveRecipe(recipe:string|ProjectRecipe){
  if(!this.current?.manifest)throw new Error(t('project.error.reference'))
  return resolveProjectRecipe(this.current.manifest,recipe)
 }
 recipeViews():ProjectRecipeView[]{
  const manifest=this.current?.manifest
  if(!manifest)return []
  return manifest.recipes.map(recipe=>{
   const chain:ProjectRecipe[]=[],seen=new Set<string>();let current:ProjectRecipe|undefined=recipe
   while(current&&!seen.has(current.id)&&chain.length<8){
    seen.add(current.id);chain.unshift(current)
    const baseId:string|undefined='baseRecipeId' in current?current.baseRecipeId:undefined
    current=baseId?manifest.recipes.find(item=>item.id===baseId):undefined
   }
   const first=chain[0],source=first&&'sourceId' in first?manifest.sources.find(source=>source.id===first.sourceId):undefined
   const view:ProjectRecipeView={...recipe,rootSourceId:source?.id??'',depth:chain.length,editable:!this.current!.info.readonly&&recipe.semantics===1&&projectRecipeEditorCompatible(recipe.steps),bounded:projectRecipeBounded(chain.flatMap(item=>item.steps)),dependents:projectRecipeDependents(manifest,recipe.id).map(item=>item.id),executable:false,...(source?{sourceVersionDifferent:chain.some(item=>item.sourceSha256!==source.sha256)}:{})}
   try{
    const resolved=this.resolveRecipe(recipe),root=resolved.source.schema.columns
    // The renderer already has the root schema; repeat only an actual projection.
    const inherited=resolved.columns===root||resolved.columns.length===root.length&&resolved.columns.every((column,index)=>column.position===root[index].position&&column.name===root[index].name)
    return{...view,rootSourceId:resolved.source.id,depth:resolved.chain.length,...(!inherited?{columns:resolved.columns}:{}),executable:true}
   }
   catch(error){return{...view,reason:(error as Error).message}}
  })
 }
 private serial<T>(action:()=>Promise<T>){
  const task=this.queue.then(action,action);this.queue=task;return task
 }
 private get recentPath(){return join(this.profile,'recent-projects.json')}
 private async recentPaths(){
  try{return z.array(z.string().refine(isAbsolute)).max(10).parse(JSON.parse(await readFile(this.recentPath,'utf8')))}
  catch(error){if(missing(error))return [];throw error}
 }
 private async activate(snapshot:Snapshot){
  const path=snapshot.info.path
  this.current=snapshot
  try{
   await atomicWrite(this.recentPath,sortedJSON([path,...(await this.recentPaths()).filter(recent=>recent!==path)].slice(0,10)))
   this.recentFailure=false
  }catch{this.recentFailure=true}
  return snapshot.info
 }
 open(folder:string){return this.serial(async()=>this.activate(await readProject(await realpath(folder))))}
 async maybeOpen(folder:string){
  return this.serial(async()=>{
   const root=await realpath(folder)
   try{await lstat(join(root,projectFile))}catch(error){if(missing(error))return null;throw error}
   return this.activate(await readProject(root))
  })
 }
 create(folder:string,name:string,suggested:boolean){
  return this.serial(async()=>{
   const validName=projectName.parse(name)
   await mkdir(folder,{recursive:true})
   const root=await realpath(folder),path=join(root,projectFile)
   try{await lstat(path);return this.activate(await readProject(root))}catch(error){if(!missing(error))throw error}
   const created:string[]=[]
   const manifest:ProjectManifest={format:'freyalab-project',version:1,id:randomUUID(),name:validName,createdAt:new Date().toISOString(),sources:[],recipes:[],results:[]}
   try{
    if(suggested)for(const directory of projectFolders){
     const added=await mkdir(join(root,directory),{recursive:true});if(added)created.push(added)
    }
    try{await atomicWrite(path,sortedJSON(manifest),null)}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error}
   }catch(error){
    if(await lstat(path).then(()=>false,missing))await Promise.allSettled(created.map(directory=>rmdir(directory)))
    const code=(error as NodeJS.ErrnoException).code??''
    if(['EACCES','EPERM','EXDEV','ENOTSUP','EOPNOTSUPP','ENOSYS'].includes(code))throw new Error(t('project.error.atomicCreate'),{cause:error})
    throw error
   }
   return this.activate(await readProject(root))
  })
 }
 rename(id:string,name:string,keepLocal:()=>Promise<boolean>){
  return this.serial(async()=>{
   const original=this.current,validName=projectName.parse(name)
   if(!original?.manifest||original.info.readonly||original.info.id!==id)throw new Error(t('project.error.readonly'))
   const latest=await readProject(original.info.path)
   if(latest.info.readonly||!latest.manifest||latest.info.id!==id){this.current=latest;return latest.info}
   if(original.digest!==latest.digest&&!await keepLocal()){this.current=latest;return latest.info}
   const file=join(latest.info.path,projectFile)
   await atomicWrite(file,sortedJSON({...latest.manifest,name:validName}),latest.digest)
   this.current=await readProject(latest.info.path)
   return this.current.info
  })
 }
 changeSources(project:ProjectInfo,update:(sources:ProjectSource[])=>ProjectSource[],keepLocal:()=>Promise<boolean>){
  return this.serial(async()=>{
   const before=this.current
   if(!before?.manifest||before.info.readonly||before.info.id!==project.id||before.info.path!==project.path)throw new Error(t('project.error.readonly'))
   const latest=await readProject(project.path)
   if(latest.info.readonly||!latest.manifest||latest.info.id!==project.id){this.current=latest;throw new Error(t('project.error.changed'))}
   if(before.digest!==latest.digest&&!await keepLocal()){this.current=latest;return false}
   const sources=update(latest.manifest.sources),removed=new Set(latest.manifest.sources.filter(source=>!sources.some(next=>next.id===source.id)).map(source=>source.id))
   const roots=latest.manifest.recipes.filter(recipe=>'sourceId' in recipe&&removed.has(recipe.sourceId))
   if(roots.length){
    const used=new Set(roots.flatMap(recipe=>[recipe,...projectRecipeDependents(latest.manifest!,recipe.id)]).map(recipe=>recipe.id))
    throw new Error(t('project.recipe.error.sourceInUse',{names:latest.manifest.recipes.filter(recipe=>used.has(recipe.id)).map(recipe=>recipe.name).join(', ')}))
   }
   const manifest=projectManifest.parse({...latest.manifest,sources})
   const content=sortedJSON(manifest)
   if(Buffer.byteLength(content)>maxManifest)throw new Error(t('project.error.file'))
   await atomicWrite(join(project.path,projectFile),content,latest.digest)
   this.current=await readProject(project.path);return true
  })
 }
 private changeRecipes(id:string,keepLocal:()=>Promise<boolean>,update:(manifest:ProjectManifest)=>ProjectRecipe[]){
  return this.serial(async()=>{
   const before=this.current
   if(!before?.manifest||before.info.readonly||before.info.id!==id)throw new Error(t('project.error.readonly'))
   const latest=await readProject(before.info.path)
   if(latest.info.readonly||!latest.manifest||latest.info.id!==id){this.current=latest;throw new Error(t('project.error.changed'))}
   if(before.digest!==latest.digest&&!await keepLocal()){this.current=latest;return false}
   const manifest=projectManifest.parse({...latest.manifest,recipes:update(latest.manifest)})
   const content=sortedJSON(manifest)
   if(Buffer.byteLength(content)>maxManifest)throw new Error(t('project.error.file'))
   await atomicWrite(join(latest.info.path,projectFile),content,latest.digest)
   this.current=await readProject(latest.info.path);return true
  })
 }
 saveRecipe(projectId:string,draft:ProjectRecipeDraft,keepLocal:()=>Promise<boolean>){
  return this.changeRecipes(projectId,keepLocal,manifest=>{
   draft=projectRecipeDraft.parse(draft)
   const existing=draft.id?manifest.recipes.find(recipe=>recipe.id===draft.id):undefined
   if(draft.id&&!existing)throw new Error(t('project.error.reference'))
   if(existing&&existing.semantics!==1)throw new Error(t('project.recipe.error.semantics'))
   const recipe=projectRecipe.parse({...draft,name:projectName.parse(draft.name),id:existing?.id??randomUUID(),createdAt:existing?.createdAt??new Date().toISOString(),sourceSha256:existing?.sourceSha256??'0'.repeat(64),semantics:1})
   if(manifest.recipes.some(item=>item.id!==recipe.id&&item.name.trim().toLowerCase()===recipe.name.toLowerCase()))throw new Error(t('project.recipe.error.name'))
   const recipes=[...manifest.recipes.filter(item=>item.id!==recipe.id),recipe]
   recipe.sourceSha256=resolveProjectRecipe({...manifest,recipes},recipe).source.sha256
   return existing?manifest.recipes.map(item=>item.id===recipe.id?recipe:item):recipes
  })
 }
 renameRecipe(projectId:string,id:string,name:string,keepLocal:()=>Promise<boolean>){
  return this.changeRecipes(projectId,keepLocal,manifest=>{
   if(!manifest.recipes.some(recipe=>recipe.id===id))throw new Error(t('project.error.reference'))
   const validName=projectName.parse(name)
   if(manifest.recipes.some(recipe=>recipe.id!==id&&recipe.name.trim().toLowerCase()===validName.toLowerCase()))throw new Error(t('project.recipe.error.name'))
   return manifest.recipes.map(recipe=>recipe.id===id?{...recipe,name:validName}:recipe)
  })
 }
 removeRecipe(projectId:string,id:string,keepLocal:()=>Promise<boolean>){
  return this.changeRecipes(projectId,keepLocal,manifest=>{
   if(!manifest.recipes.some(recipe=>recipe.id===id))throw new Error(t('project.error.reference'))
   const dependents=projectRecipeDependents(manifest,id)
   if(dependents.length)throw new Error(t('project.recipe.error.dependents',{names:dependents.map(recipe=>recipe.name).join(', ')}))
   return manifest.recipes.filter(recipe=>recipe.id!==id)
  })
 }
 close(id:string){return this.serial(async()=>{if(this.current?.info.id===id)this.current=undefined})}
 async recents(){
  const paths=await this.recentPaths().catch(()=>[])
  return Promise.all(paths.map(async path=>({path,name:basename(path),missing:await lstat(join(path,projectFile)).then(()=>false,missing)})))
 }
 openRecent(path:string){
  return this.serial(async()=>{
   if(!(await this.recentPaths()).includes(path))throw new Error(t('project.error.recent'))
   return this.activate(await readProject(await realpath(path)))
  })
 }
 forgetRecent(path:string){
  return this.serial(async()=>{
   const paths=await this.recentPaths()
   if(paths.includes(path))await atomicWrite(this.recentPath,sortedJSON(paths.filter(value=>value!==path)))
  })
 }
}
