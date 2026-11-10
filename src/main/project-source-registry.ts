import {createHash,randomUUID} from 'node:crypto'
import {realpath} from 'node:fs/promises'
import {basename,isAbsolute,relative,resolve,sep} from 'node:path'
import type {ProjectStore} from './projects'
import {fingerprintCsvSource,findSourceByFingerprint,prepareCsvSource,quickCsvSource} from './project-sources'
import {projectSource,type ProjectInfo,type ProjectSource,type ProjectSourceDraft,type ProjectSourceView} from '../shared/project'
import {t} from '../shared/i18n'
import {ANALYSIS_LIMITS} from './analysis-source'
import type {DocumentInfo,TableOptions} from '../shared/types'

type Options=Parameters<typeof fingerprintCsvSource>[1]
type Progress=NonNullable<Options>['progress']
type SourceOptions=TableOptions&{eol?:'\n'|'\r'|'\r\n'}
type FileStamp={bytes:number;mtimeMs:number;dev:number;ino:number}
const matches=(a:FileStamp,b:FileStamp)=>a.bytes===b.bytes&&a.mtimeMs===b.mtimeMs&&a.dev===b.dev&&a.ino===b.ino
const inside=(root:string,path:string)=>{const name=relative(root,path);return name!==''&&name!=='..'&&!name.startsWith('../')&&!name.startsWith('..\\')&&!isAbsolute(name)}
const sourcePath=(root:string,source:ProjectSource)=>resolve(root,source.path)
const relativePath=(root:string,path:string)=>relative(root,path).split(sep).join('/')

export class ProjectSourceRegistry{
 private draft:{id:string;project:ProjectInfo;path:string;target:string;stamp:FileStamp}|undefined
 private external=new Map<string,string>()
 constructor(private projects:ProjectStore,private allowed:(path:string)=>Promise<boolean>,private assertClean:(path:string)=>void,private opened:(path:string)=>Pick<DocumentInfo,'rowCount'|'headers'>|undefined=()=>undefined){}
 private project(id?:string){
  const project=this.projects.active
  if(!project||project.readonly||id!==undefined&&project.id!==id)throw new Error(t('project.error.readonly'))
  return project
 }
 private source(id:string){
  const source=this.projects.sources.find(source=>source.id===id)
  if(!source)throw new Error(t('project.source.missing'))
  return source
 }
 private async target(project:ProjectInfo,source:ProjectSource){
  const path=sourcePath(project.path,source),approved=this.external.get(path)??(this.opened(path)?path:undefined)
  if(source.external&&!approved)return {status:'external' as const,path}
  const target=await realpath(path).catch(()=>null)
  if(!target)return {status:'missing' as const,path}
  if(source.external?target!==approved:!inside(project.path,target))return {status:'external' as const,path}
  return {status:'verified' as const,path,target}
 }
 async list():Promise<ProjectSourceView[]>{
  const project=this.projects.active
  if(!project||project.readonly)return []
  const results:ProjectSourceView[]=[]
  for(const source of this.projects.sources){
   const state=await this.target(project,source)
   let status:ProjectSourceView['status']=state.status
   if(state.target){
    const info=await quickCsvSource(state.target).catch(()=>null)
    status=!info?'missing':info.bytes===source.bytes&&info.quick.mtimeMs===source.quick.mtimeMs&&info.quick.headSha256===source.quick.headSha256&&info.quick.tailSha256===source.quick.tailSha256?'verified':'changed'
   }
   const table=state.target?this.opened(state.target):undefined,columns=source.schema.columns.length
   const overAnalysis=source.bytes>ANALYSIS_LIMITS.bytes||columns>ANALYSIS_LIMITS.columns||!!table&&((table.rowCount??0)>ANALYSIS_LIMITS.rows||(table.rowCount??0)*(table.headers?.length??columns)>ANALYSIS_LIMITS.cells)
   results.push({id:source.id,name:basename(source.path),path:source.path,external:source.external,bytes:source.bytes,format:source.format,columnCount:columns,status,overAnalysis})
  }
  return results
 }
 async protectedPaths(){
  const project=this.projects.active,paths=new Map<string,{sha256:string;format:TableOptions}>()
  if(!project||project.readonly)return paths
  for(const source of this.projects.sources){
   const state=await this.target(project,source)
   if(state.target)paths.set(state.target,source)
   if(!source.external&&inside(project.path,state.path))paths.set(state.path,source)
  }
  return paths
 }
 async openPath(id:string){
  const state=await this.target(this.project(),this.source(id))
  if(!state.target)throw new Error(t(state.status==='external'?'project.source.authorize':'project.source.missing'))
  return state.target
 }
 async authorizeExternal(id:string,selected:string){
  const source=this.source(id),project=this.project(),expected=sourcePath(project.path,source)
  if(!source.external||resolve(selected)!==expected)throw new Error(t('project.source.chooseSame'))
  this.external.set(expected,await realpath(selected))
 }
 async prepare(path:string,options:SourceOptions={},nativeChoice=false):Promise<ProjectSourceDraft>{
  const project=this.project()
  if(!nativeChoice&&!await this.allowed(path))throw new Error(t('project.source.authorize'))
  const chosen=resolve(path),target=await realpath(chosen)
  this.assertClean(target)
  if((await this.protectedPaths()).has(target))throw new Error(t('project.source.duplicate'))
  const info=await prepareCsvSource(target,options),id=randomUUID()
  this.draft={id,project,path:chosen,target,stamp:info}
  return this.describeDraft(this.draft,info)
 }
 async inspectDraft(id:string,options:SourceOptions){
  const draft=this.getDraft(id),info=await prepareCsvSource(draft.target,options)
  if(!matches(draft.stamp,info))throw new Error(t('project.source.changed'))
  return this.describeDraft(draft,info)
 }
 cancelDraft(){this.draft=undefined}
 registrationTarget(id:string){return this.getDraft(id).target}
 private getDraft(id:string){
  const draft=this.draft,project=this.project()
  if(!draft||draft.id!==id||draft.project.id!==project.id||draft.project.path!==project.path)throw new Error(t('project.source.choose'))
  return draft
 }
 private describeDraft(draft:NonNullable<ProjectSourceRegistry['draft']>,info:Awaited<ReturnType<typeof prepareCsvSource>>):ProjectSourceDraft{
  return {id:draft.id,path:draft.path,bytes:info.bytes,external:!inside(draft.project.path,draft.target),
   format:projectSource.shape.format.parse(info.format),columns:info.columns}
 }
 private storedPath(project:ProjectInfo,chosen:string,target:string){
  const external=!inside(project.path,target)
  return {external,path:external?chosen:relativePath(project.path,inside(project.path,chosen)?chosen:target)}
 }
 private async sourceRecord(project:ProjectInfo,chosen:string,target:string,id:string,options:SourceOptions,expected:FileStamp|undefined,signal?:AbortSignal,progress?:Progress){
  this.assertClean(target)
  const info=await prepareCsvSource(target,options)
  if(expected&&!matches(expected,info))throw new Error(t('project.source.changed'))
  const full=await fingerprintCsvSource(target,{signal,progress})
  if(!matches(info,full)||await realpath(chosen)!==target)throw new Error(t('project.source.changed'))
  signal?.throwIfAborted()
  return projectSource.parse({id,...this.storedPath(project,chosen,target),protection:'readonly',registeredAt:new Date().toISOString(),
   bytes:full.bytes,sha256:full.sha256,quick:full.quick,format:info.format,schema:{
    columns:info.columns,sha256:createHash('sha256').update(JSON.stringify(info.columns)).digest('hex')
   }})
 }
 async register(projectId:string,draftId:string,options:SourceOptions,signal:AbortSignal|undefined,progress:Progress,keepLocal:()=>Promise<boolean>){
  const project=this.project(projectId),draft=this.getDraft(draftId)
  const source=await this.sourceRecord(project,draft.path,draft.target,randomUUID(),options,draft.stamp,signal,progress)
  const saved=await this.projects.changeSources(project,entries=>{
   signal?.throwIfAborted();this.assertClean(draft.target)
   if(entries.some(entry=>sourcePath(project.path,entry)===sourcePath(project.path,source)))throw new Error(t('project.source.duplicate'))
   return [...entries,source]
  },keepLocal)
  if(saved&&source.external)this.external.set(source.path,draft.target)
  if(saved)this.cancelDraft()
  return saved
 }
 async reregister(projectId:string,id:string,signal:AbortSignal|undefined,progress:Progress,keepLocal:()=>Promise<boolean>){
  const project=this.project(projectId),before=this.source(id),target=await this.openPath(id)
  const source=await this.sourceRecord(project,sourcePath(project.path,before),target,id,before.format,undefined,signal,progress)
  return this.projects.changeSources(project,entries=>{
   signal?.throwIfAborted();this.assertClean(target)
   const current=entries.find(entry=>entry.id===id)
   if(!current||current.sha256!==before.sha256||current.path!==before.path)throw new Error(t('project.source.changed'))
   return entries.map(entry=>entry===current?{...source,history:[...(current.history??[]),current.sha256]}:entry)
  },keepLocal)
 }
 async forget(projectId:string,id:string,keepLocal:()=>Promise<boolean>){
  return this.projects.changeSources(this.project(projectId),entries=>entries.filter(entry=>entry.id!==id),keepLocal)
 }
 async find(id:string,signal?:AbortSignal){const source=this.source(id);return findSourceByFingerprint(this.project().path,source.bytes,source.sha256,signal)}
 async relink(projectId:string,id:string,candidate:string,signal:AbortSignal|undefined,keepLocal:()=>Promise<boolean>){
  const project=this.project(projectId),before=this.source(id),target=await realpath(candidate)
  if(!inside(project.path,target))throw new Error(t('project.source.authorize'))
  this.assertClean(target)
  const found=await fingerprintCsvSource(target,{signal})
  if(found.bytes!==before.bytes||found.sha256!==before.sha256)throw new Error(t('project.source.changed'))
  return this.projects.changeSources(project,entries=>{
   signal?.throwIfAborted();this.assertClean(target)
   const current=entries.find(entry=>entry.id===id)
   if(!current||current.path!==before.path||current.sha256!==before.sha256)throw new Error(t('project.source.changed'))
   if(entries.some(entry=>entry!==current&&sourcePath(project.path,entry)===target))throw new Error(t('project.source.duplicate'))
   return entries.map(entry=>entry===current?{...entry,path:relativePath(project.path,target),external:false,quick:found.quick}:entry)
  },keepLocal)
 }
}
