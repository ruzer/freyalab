import {createHash,randomUUID} from 'node:crypto'
import {constants} from 'node:fs'
import {lstat,mkdir,open,readFile,realpath} from 'node:fs/promises'
import {basename,isAbsolute,join} from 'node:path'
import {z} from 'zod'
import {atomicWrite} from './files'
import {t} from '../shared/i18n'
import {projectEnvelope,projectFile,projectFolders,projectManifest,projectName,type ProjectInfo,type ProjectManifest} from '../shared/project'

const maxManifest=4*1024*1024
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex')
const missing=(error:unknown)=>['ENOENT','ENOTDIR'].includes((error as NodeJS.ErrnoException).code??'')
const sortedJSON=(value:unknown):string=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item,2)+'\n'
type Snapshot={info:ProjectInfo;digest:string;manifest?:ProjectManifest}

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
  if(version>1)return{info:{id:typeof id==='string'&&id&&id.length<=100?id:folder,name:typeof name==='string'&&name?name.slice(0,200):basename(folder),path:folder,version,readonly:true,sourceCount:0},digest:hash(content)}
  const result=projectManifest.safeParse(value)
  if(!result.success)throw new Error(t('project.error.schema'))
  return{info:{id:result.data.id,name:result.data.name,path:folder,version,readonly:false,sourceCount:result.data.sources.length},digest:hash(content),manifest:result.data}
 }finally{await handle.close()}
}

export class ProjectStore{
 private current:Snapshot|undefined
 private queue:Promise<unknown>=Promise.resolve()
 constructor(private profile:string){}
 get active(){return this.current?.info??null}
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
  await atomicWrite(this.recentPath,sortedJSON([path,...(await this.recentPaths()).filter(recent=>recent!==path)].slice(0,10)))
  this.current=snapshot
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
   if(suggested)for(const directory of projectFolders)await mkdir(join(root,directory),{recursive:true})
   const manifest:ProjectManifest={format:'freyalab-project',version:1,id:randomUUID(),name:validName,createdAt:new Date().toISOString(),sources:[],recipes:[],results:[]}
   try{await atomicWrite(path,sortedJSON(manifest),null)}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error}
   return this.activate(await readProject(root))
  })
 }
 rename(id:string,name:string,keepLocal:()=>Promise<boolean>){
  return this.serial(async()=>{
   const original=this.current,validName=projectName.parse(name)
   if(!original?.manifest||original.info.id!==id)throw new Error(t('project.error.readonly'))
   const latest=await readProject(original.info.path)
   if(!latest.manifest||latest.info.id!==id){this.current=latest;return latest.info}
   if(original.digest!==latest.digest&&!await keepLocal()){this.current=latest;return latest.info}
   const file=join(latest.info.path,projectFile)
   await atomicWrite(file,sortedJSON({...latest.manifest,name:validName}),latest.digest)
   this.current=await readProject(latest.info.path)
   return this.current.info
  })
 }
 close(id:string){return this.serial(async()=>{if(this.current?.info.id===id)this.current=undefined})}
 async recents(){
  return Promise.all((await this.recentPaths()).map(async path=>({path,name:basename(path),missing:await lstat(join(path,projectFile)).then(()=>false,error=>missing(error))})))
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
