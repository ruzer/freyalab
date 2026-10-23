import {app,BrowserWindow,session,net,protocol} from 'electron'
import {z} from 'zod'
import {randomUUID} from 'node:crypto'
import {resolve,relative,isAbsolute} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {stat} from 'node:fs/promises'
import {sqlColumns} from '../shared/sql-helpers'
import type {SqlRequest,SqlSource,SqlResult,SqlProgress} from '../shared/types'
import type {Documents} from './documents'
import {JobQueue,type Priority} from './job-queue'

const origin='freyalab-analysis://engine',scheme='freyalab-analysis'
protocol.registerSchemesAsPrivileged([{scheme,privileges:{standard:true,secure:true,supportFetchAPI:true}}])
interface Job {id:string;sources:SqlSource[];window?:BrowserWindow;timer?:NodeJS.Timeout;result?:SqlResult;error?:string;disk:Map<string,{size:number;mtimeMs:number}>}
// Resultados terminados que se conservan para paginarlos: el panel SQL, el gráfico y la exportación pueden tener uno cada uno.
// Peor caso del esquema (10 000 filas × 200 columnas): unos 62 MiB de memoria por resultado, ver docs/evidence/sql-job-queue-2026-10-23.md.
const retained=3
export class SqlService {
 private jobs=new Map<string,Job>()
 private queue:JobQueue
 constructor(private docs:Documents,private progress:(event:SqlProgress)=>void){
  this.queue=new JobQueue(1,requestId=>progress({requestId,phase:'En cola: hay otro análisis en curso',rows:0}))
  const isolated=session.fromPartition('freyalab-analysis'),root=fileURLToPath(new URL('../renderer',import.meta.url))
  isolated.protocol.handle(scheme,request=>{try{const url=new URL(request.url),target=resolve(root,'.'+decodeURIComponent(url.pathname)),path=relative(root,target);if(url.hostname!=='engine'||path.startsWith('..')||isAbsolute(path))return new Response('No autorizado',{status:403});const dev=process.env.ELECTRON_RENDERER_URL;return net.fetch(dev?new URL(url.pathname,dev).href:pathToFileURL(target).href)}catch{return new Response('Ruta no válida',{status:400})}})
  isolated.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith(origin+'/')}))
  isolated.setPermissionRequestHandler((_window,_permission,callback)=>callback(false));isolated.setPermissionCheckHandler(()=>false)
 }
 private check(job:Job){if(this.jobs.get(job.id)!==job)throw new Error('Análisis cancelado.');for(const source of job.sources)if(this.docs.get(source.id).info.revision!==source.revision)throw new Error('Una fuente cambió. Ejecuta de nuevo el análisis.')}
 cancel(requestId:string){if(!this.jobs.delete(requestId))return;this.queue.cancel(requestId)}
 stop(){this.jobs.clear();this.queue.clear()}
 private trim(){const finished=[...this.jobs.values()].filter(job=>job.result);for(const old of finished.slice(0,Math.max(0,finished.length-retained)))this.jobs.delete(old.id)}
 async run(request:SqlRequest,priority:Priority='interactive'):Promise<SqlResult>{
  if(app.commandLine.hasSwitch('no-sandbox'))throw new Error('El análisis SQL requiere el aislamiento de Chromium. Inicia FreyaLab sin la opción --no-sandbox.')
  for(const source of request.sources){const record=this.docs.get(source.id);if(record.info.kind!=='csv'||record.info.revision!==source.revision)throw new Error('Una fuente no es CSV o cambió de revisión.')}
  this.cancel(request.requestId);const job:Job={id:request.requestId,sources:[],disk:new Map()};this.jobs.set(job.id,job)
  const start=()=>{job.timer=setTimeout(()=>{job.error='El análisis superó dos minutos. Reduce las fuentes o la consulta.';this.cancel(job.id)},120000);return this.execute(job,request)}
  const dispose=()=>{clearTimeout(job.timer);const owner=job.window;job.window=undefined;owner?.destroy()}
  try{await this.queue.run(job.id,priority,start,dispose);this.trim();return await this.page(job.id,0)}
  catch(error){if(this.jobs.get(job.id)===job)this.jobs.delete(job.id);throw new Error(job.error??(error as Error).message)}
 }
 private async execute(job:Job,request:SqlRequest):Promise<void>{
  const owner=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,partition:'freyalab-analysis',backgroundThrottling:false}});job.window=owner
  owner.webContents.setWindowOpenHandler(()=>({action:'deny'}));owner.webContents.on('will-navigate',event=>event.preventDefault())
  owner.webContents.on('render-process-gone',()=>{if(job.window!==owner)return;job.error='El motor de análisis se cerró. Los documentos siguen intactos.';this.cancel(job.id)})
  const call=<T>(method:string,...args:unknown[])=>owner.webContents.executeJavaScript(`globalThis.freyaSQL.${method}(...${JSON.stringify(args)})`) as Promise<T>
  this.progress({requestId:job.id,phase:'Preparando motor local',rows:0})
  await owner.loadURL(origin+'/analytics.html')
  await owner.webContents.executeJavaScript('new Promise(resolve=>{const timer=setInterval(()=>{if(globalThis.freyaSQL){clearInterval(timer);resolve(true)}},10)})')
  let cells=0
  for(const [index,input] of request.sources.entries()){
   this.check(job);const record=this.docs.get(input.id);if(record.info.kind!=='csv'||record.info.revision!==input.revision)throw new Error('Una fuente no es CSV o cambió de revisión.')
   const ticket=randomUUID(),table=index===0?'datos':`tabla_${index+1}`
   try{
    const meta=await this.docs.table.call<{headers:string[];revision:number;readonly:boolean}>('analysisStart',input.id,ticket,input.revision,record.info.path,input.query,input.where)
    const source:SqlSource={id:input.id,name:record.info.name,revision:input.revision,table,columns:sqlColumns(meta.headers),rows:0,fromDisk:meta.readonly,filtered:!!input.query||!!input.where?.conditions.length,...input.where?.conditions.length?{where:input.where}:{}};job.sources.push(source)
    if(meta.readonly&&record.info.path){const info=await stat(record.info.path);job.disk.set(input.id,{size:info.size,mtimeMs:info.mtimeMs})}
    await call('table',table,source.columns.map(column=>column.name))
    while(true){this.check(job);const batch=await this.docs.table.call<{data?:Uint8Array;rows:number;done:boolean}>('analysisNext',ticket);if(batch.done)break;cells+=batch.rows*source.columns.length;if(cells>8_000_000)throw new Error('El conjunto supera ocho millones de celdas. Reduce las fuentes.');await call('append',table,Buffer.from(batch.data!).toString('base64'));source.rows+=batch.rows;if(source.rows%10000===0)this.progress({requestId:job.id,phase:`Leyendo ${source.name}`,rows:source.rows})}
   }finally{await this.docs.table.call('analysisClose',ticket)}
  }
  this.check(job);const version=await call<string>('seal');this.progress({requestId:job.id,phase:'Ejecutando consulta de solo lectura',rows:job.sources.reduce((n,s)=>n+s.rows,0)})
  const output=z.object({columns:z.array(z.object({name:z.string().max(100000),type:z.string().max(1000)})).min(1).max(200),rows:z.array(z.array(z.string().max(8*1024*1024).nullable()).max(200)).max(10000),limited:z.boolean()}).parse(await call('query',request.sql));if(output.rows.some(row=>row.length!==output.columns.length)||output.rows.reduce((n,row)=>n+row.reduce((m,v)=>m+(v===null?0:Buffer.byteLength(v,'utf8')),0),0)>8*1024*1024)throw new Error('El motor devolvió un resultado no válido o demasiado grande.');this.check(job)
  job.result={requestId:job.id,sources:job.sources,version,columns:output.columns,rows:output.rows,returnedRows:output.rows.length,limited:output.limited,offset:0,completedAt:new Date().toISOString()}
 }
 async page(requestId:string,offset:number):Promise<SqlResult>{
  const job=this.jobs.get(requestId);if(!job?.result)throw new Error('El resultado ya no está disponible. Ejecuta de nuevo la consulta.');this.check(job)
  this.jobs.delete(requestId);this.jobs.set(requestId,job) // el más reciente es el último en descartarse
  for(const [id,expected] of job.disk){const path=this.docs.get(id).info.path;if(!path)throw new Error('La fuente ya no existe.');const current=await stat(path);if(current.size!==expected.size||current.mtimeMs!==expected.mtimeMs)throw new Error('El archivo cambió en disco. Ejecuta de nuevo el análisis.')}
  return{...job.result,offset,rows:job.result.rows.slice(offset,offset+100)}
 }
}
