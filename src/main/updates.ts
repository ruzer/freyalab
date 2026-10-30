import {request as httpRequest} from 'node:http'
import {request as httpsRequest} from 'node:https'
import {z} from 'zod'
import type {SettingsStore} from './settings'
import type {UpdateRelease,UpdateResult} from '../shared/updates'
import {t} from '../shared/i18n'

const endpoint='https://api.github.com/repos/ruzer/freyalab/releases?per_page=10',maximumBytes=1024*1024,day=86400000
const versionPattern=/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/
const releaseSchema=z.object({tag_name:z.string().max(256),name:z.string().max(1024).nullable(),draft:z.boolean(),prerelease:z.boolean(),published_at:z.iso.datetime().nullable(),html_url:z.string().max(2048),assets:z.array(z.object({name:z.string().max(1024)})).max(100)})
const releasesSchema=z.array(releaseSchema).max(100)
function parsedVersion(value:string){
 if(value.length>256||!versionPattern.test(value))return null
 const dash=value.indexOf('-'),core=dash<0?value:value.slice(0,dash),pre=dash<0?undefined:value.slice(dash+1),parts=core.split('.').map(BigInt),prerelease=pre?.split('.')
 if(prerelease?.some(part=>/^\d+$/.test(part)&&part.length>1&&part.startsWith('0')))return null
 return{parts,prerelease}
}
export function compareVersions(left:string,right:string):number{
 const a=parsedVersion(left),b=parsedVersion(right)
 if(!a||!b)throw new Error(t('updates.error.invalid'))
 for(let i=0;i<3;i++)if(a.parts[i]!==b.parts[i])return a.parts[i]>b.parts[i]?1:-1
 if(!a.prerelease||!b.prerelease)return a.prerelease?-1:b.prerelease?1:0
 for(let i=0;i<Math.max(a.prerelease.length,b.prerelease.length);i++){
  const x=a.prerelease[i],y=b.prerelease[i]
  if(x===y)continue
  if(x===undefined||y===undefined)return x===undefined?-1:1
  const nx=/^\d+$/.test(x),ny=/^\d+$/.test(y)
  if(nx&&ny)return BigInt(x)>BigInt(y)?1:-1
  if(nx!==ny)return nx?-1:1
  return x>y?1:-1
 }
 return 0
}
export function releaseUrl(value:string):boolean{
 try{const url=new URL(value);return value.startsWith('https://github.com/ruzer/freyalab/releases/')&&url.href===value&&url.protocol==='https:'&&url.hostname==='github.com'&&!url.port&&!url.username&&!url.password&&url.pathname.length>'/ruzer/freyalab/releases/'.length&&!url.search&&!url.hash&&!/%(?:2f|5c|2e)/i.test(url.pathname)}catch{return false}
}
export function selectRelease(input:unknown,installed:string):UpdateRelease|null{
 const releases=releasesSchema.parse(input),current=parsedVersion(installed)
 if(!current)throw new Error(t('updates.error.invalid'))
 let latest:UpdateRelease|null=null
 for(const release of releases){
  if(release.draft)continue
  const version=release.tag_name.replace(/^v/,''),parsed=parsedVersion(version)
  if(!parsed)continue
  if(!releaseUrl(release.html_url))throw new Error(t('updates.error.invalid'))
  if(!current.prerelease&&(release.prerelease||parsed.prerelease))continue
  if(compareVersions(version,installed)<=0||latest&&compareVersions(version,latest.version)<=0)continue
  latest={version,name:release.name??release.tag_name,publishedAt:release.published_at,url:release.html_url,assets:release.assets.map(asset=>asset.name)}
 }
 return latest
}
export function updatesEndpoint(env:NodeJS.ProcessEnv):string{
 if(env.FREYALAB_TEST==='1'&&env.FREYALAB_TEST_UPDATES_URL)try{
  const url=new URL(env.FREYALAB_TEST_UPDATES_URL)
  if(url.protocol==='http:'&&url.hostname==='127.0.0.1'&&!url.username&&!url.password)return url.href
 }catch{}
 return endpoint
}
export function checkUpdates(version:string,signal:AbortSignal,env:NodeJS.ProcessEnv=process.env):Promise<UpdateResult>{
 return new Promise(resolve=>{
  if(signal.aborted){resolve({status:'cancelled'});return}
  const url=new URL(updatesEndpoint(env));let done=false,bytes=0;const chunks:Buffer[]=[]
  const finish=(result:UpdateResult)=>{if(done)return;done=true;clearTimeout(timer);signal.removeEventListener('abort',cancel);resolve(result)}
  const request=(url.protocol==='http:'?httpRequest:httpsRequest)(url,{method:'GET',headers:{Accept:'application/vnd.github+json','User-Agent':`FreyaLab/${version}`}},response=>{
   if(response.statusCode!==200){finish({status:'error',code:response.statusCode===403||response.statusCode===429?'rateLimit':'service'});response.destroy();request.destroy();return}
   if(Number(response.headers['content-length'])>maximumBytes){finish({status:'error',code:'size'});response.destroy();request.destroy();return}
   response.on('data',(chunk:Buffer)=>{
    bytes+=chunk.length
    if(bytes>maximumBytes){finish({status:'error',code:'size'});response.destroy();request.destroy()}else chunks.push(chunk)
   })
   response.on('error',()=>finish({status:'error',code:'offline'}))
   response.on('end',()=>{
    if(done)return
    try{const release=selectRelease(JSON.parse(Buffer.concat(chunks).toString('utf8')),version);finish(release?{status:'available',currentVersion:version,release}:{status:'current',currentVersion:version})}
    catch{finish({status:'error',code:'invalid'})}
   })
  })
  const cancel=()=>{finish({status:'cancelled'});request.destroy()}
  const timer=setTimeout(()=>{finish({status:'error',code:'timeout'});request.destroy()},10000)
  signal.addEventListener('abort',cancel,{once:true})
  request.on('error',()=>finish({status:'error',code:'offline'}));request.end()
 })
}
export class UpdatesService {
 private controller?:AbortController
 private pending?:Promise<UpdateResult>
 constructor(private settings:Pick<SettingsStore,'get'|'set'>,private version:string,private env:NodeJS.ProcessEnv=process.env,private now=()=>Date.now()){}
 cancel(){this.controller?.abort();this.controller=undefined;this.pending=undefined}
 async check():Promise<UpdateResult>{
  if(this.pending)return this.pending
  const controller=new AbortController(),signal=controller.signal
  this.controller=controller
  const pending=(async()=>{
   try{await this.settings.set({actualizaciones:{ultimaComprobacion:new Date(this.now()).toISOString()}})}catch{return{status:'error',code:'service'} as UpdateResult}
   return checkUpdates(this.version,signal,this.env)
  })()
  this.pending=pending
  try{return await pending}finally{if(this.pending===pending){this.pending=undefined;this.controller=undefined}}
 }
 async startup():Promise<UpdateResult|null>{
  const state=await this.settings.get(),updates=state.values.actualizaciones,last=updates.ultimaComprobacion?Date.parse(updates.ultimaComprobacion):null
  if(state.readonly||!updates.buscarAlIniciar||last!==null&&this.now()-last<day)return null
  const result=await this.check()
  if(result.status!=='available'||(await this.settings.get()).values.actualizaciones.versionesOmitidas.includes(result.release.version))return null
  return result
 }
 async skip(version:string){
  if(!parsedVersion(version))throw new Error(t('updates.error.invalid'))
  const state=await this.settings.get(),versions=state.values.actualizaciones.versionesOmitidas
  return this.settings.set({actualizaciones:{versionesOmitidas:[...new Set([...versions,version])]}})
 }
 remind(){return this.settings.set({actualizaciones:{ultimaComprobacion:new Date(this.now()).toISOString()}})}
}
