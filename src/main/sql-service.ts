import {isTableDocument} from '../shared/types'
import {app,BrowserWindow,session,net,protocol} from 'electron'
import {z} from 'zod'
import {randomUUID} from 'node:crypto'
import {resolve,relative,isAbsolute} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {stat} from 'node:fs/promises'
import {sqlColumns} from '../shared/sql-helpers'
import type {SqlRequest,SqlSource,SqlResult,SqlProgress,CalculatedColumnPreview} from '../shared/types'
import type {CalculateColumnEdit,CalculatedValue} from '../shared/calculated-column'
import {t} from '../shared/i18n'
import type {Documents} from './documents'
import {JobQueue,type Priority} from './job-queue'

const origin='freyalab-analysis://engine',scheme='freyalab-analysis'
protocol.registerSchemesAsPrivileged([{scheme,privileges:{standard:true,secure:true,supportFetchAPI:true}}])
export interface SqlTiming {requestId:string;phases:Record<'window'|'engine'|'sourceStart'|'sourceRead'|'sourceEncode'|'sourceAppend'|'sourceLoad'|'seal'|'query'|'materialize'|'resultTransfer'|'total'|'waiting',number>;rows:number;bytes:number;returnedRows:number;complete:boolean}
interface Job {id:string;documents:string[];sources:SqlSource[];window?:BrowserWindow;timer?:NodeJS.Timeout;used:number;result?:SqlResult;error?:string;calculation?:string;disk:Map<string,{size:number;mtimeMs:number}>;timing?:SqlTiming}
// Resultados terminados que se conservan para paginarlos: el panel SQL, el gráfico y la exportación pueden tener uno cada uno.
// Peor caso del esquema (10 000 filas × 200 columnas): unos 62 MiB de memoria por resultado, ver docs/evidence/sql-job-queue-2026-10-23.md.
const retained=3
const calculationBatch=z.object({rows:z.array(z.object({
 rowId:z.string().min(1).max(100),value:z.string().max(1024*1024).nullable(),
 invalid:z.array(z.number().int().min(0).max(199)).max(200),failed:z.boolean()
}).strict()).max(2048),done:z.boolean()}).strict()
function calculationKey(id:string,{requestId:_,...edit}:CalculateColumnEdit){return JSON.stringify([id,edit])}
export class SqlService {
 private jobs=new Map<string,Job>()
 private queue:JobQueue
 private tick=0
 private preparedCalculation?:{id:string;requestId:string;key:string;values:CalculatedValue[]}
 private applyingCalculation=new Map<string,{id:string;abort:AbortController}>()
 constructor(private docs:Documents,private progress:(event:SqlProgress)=>void,private measure?:(timing:SqlTiming)=>void){
  this.queue=new JobQueue(1,requestId=>progress({requestId,phase:this.jobs.get(requestId)?.calculation?'calculate.progress.waiting':'En cola: hay otro análisis en curso',rows:0}))
  const isolated=session.fromPartition('freyalab-analysis'),root=fileURLToPath(new URL('../renderer',import.meta.url))
  isolated.protocol.handle(scheme,request=>{try{const url=new URL(request.url),target=resolve(root,'.'+decodeURIComponent(url.pathname)),path=relative(root,target);if(url.hostname!=='engine'||path.startsWith('..')||isAbsolute(path))return new Response('No autorizado',{status:403});const dev=process.env.ELECTRON_RENDERER_URL;return net.fetch(dev?new URL(url.pathname,dev).href:pathToFileURL(target).href)}catch{return new Response('Ruta no válida',{status:400})}})
  isolated.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith(origin+'/')}))
  isolated.setPermissionRequestHandler((_window,_permission,callback)=>callback(false));isolated.setPermissionCheckHandler(()=>false)
 }
 private check(job:Job){if(this.jobs.get(job.id)!==job)throw new Error('Análisis cancelado.');for(const source of job.sources)if(this.docs.get(source.id).info.revision!==source.revision)throw new Error('Una fuente cambió. Ejecuta de nuevo el análisis.')}
 private async timed<T>(job:Job,phase:keyof SqlTiming['phases'],work:()=>Promise<T>):Promise<T>{
  if(!job.timing)return work()
  const start=performance.now()
  try{return await work()}finally{job.timing.phases[phase]+=performance.now()-start}
 }
 cancel(requestId:string){if(!this.jobs.delete(requestId))return;this.queue.cancel(requestId)}
 cancelCalculation(id:string,requestId:string){
  const job=this.jobs.get(requestId),applying=this.applyingCalculation.get(requestId)
  if(job?.calculation===id){job.error=t('calculate.error.cancelled');this.cancel(requestId)}
  if(applying?.id===id)applying.abort.abort(new Error(t('calculate.error.cancelled')))
  if(this.preparedCalculation?.id===id&&this.preparedCalculation.requestId===requestId)this.preparedCalculation=undefined
 }
 stop(){this.jobs.clear();this.preparedCalculation=undefined;this.queue.clear()}
 // Al cerrar un documento se cancelan sus solicitudes (en cola, en curso o terminadas) y se suelta lo que retenían.
 forget(documentId:string){if(this.preparedCalculation?.id===documentId)this.preparedCalculation=undefined;for(const job of [...this.jobs.values()])if(job.documents.includes(documentId))this.cancel(job.id)}
 // Se descartan los menos usados (por orden de uso, no de llegada: un trabajo que acaba de terminar nunca es el más antiguo).
 private trim(){const finished=[...this.jobs.values()].filter(job=>job.result).sort((a,b)=>a.used-b.used);for(const old of finished.slice(0,Math.max(0,finished.length-retained)))this.jobs.delete(old.id)}
 async run(request:SqlRequest,priority:Priority='interactive'):Promise<SqlResult>{
  if(app.commandLine.hasSwitch('no-sandbox'))throw new Error('El análisis SQL requiere el aislamiento de Chromium. Inicia FreyaLab sin la opción --no-sandbox.')
  for(const source of request.sources){const record=this.docs.get(source.id);if(!isTableDocument(record.info)||record.info.revision!==source.revision)throw new Error('Una fuente no es CSV o cambió de revisión.')}
  this.cancel(request.requestId);const job:Job={id:request.requestId,documents:request.sources.map(source=>source.id),sources:[],used:0,disk:new Map()};this.jobs.set(job.id,job)
  const begun=performance.now()
  if(this.measure)job.timing={requestId:job.id,phases:{window:0,engine:0,sourceStart:0,sourceRead:0,sourceEncode:0,sourceAppend:0,sourceLoad:0,seal:0,query:0,materialize:0,resultTransfer:0,total:0,waiting:0},rows:0,bytes:0,returnedRows:0,complete:false}
  const start=()=>{if(job.timing)job.timing.phases.waiting=performance.now()-begun;job.timer=setTimeout(()=>{job.error='El análisis superó dos minutos. Reduce las fuentes o la consulta.';this.cancel(job.id)},120000);return this.execute(job,request)}
  const dispose=()=>{clearTimeout(job.timer);const owner=job.window;job.window=undefined;owner?.destroy()}
  try{await this.queue.run(job.id,priority,start,dispose);job.used=++this.tick;this.trim();return await this.page(job.id,0)}
  catch(error){if(this.jobs.get(job.id)===job)this.jobs.delete(job.id);throw new Error(job.error??(error as Error).message)}
  finally{if(job.timing){job.timing.phases.total=performance.now()-begun;job.timing.rows=job.sources.reduce((n,s)=>n+s.rows,0);job.timing.returnedRows=job.result?.returnedRows??0;job.timing.complete=!!job.result;this.measure?.(job.timing)}}
 }
 private async openEngine(job:Job){
  const started=performance.now()
  const owner=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,partition:'freyalab-analysis',backgroundThrottling:false}});job.window=owner
  owner.webContents.setWindowOpenHandler(()=>({action:'deny'}));owner.webContents.on('will-navigate',event=>event.preventDefault())
  owner.webContents.on('render-process-gone',()=>{if(job.window!==owner)return;job.error='El motor de análisis se cerró. Los documentos siguen intactos.';this.cancel(job.id)})
  this.progress({requestId:job.id,phase:job.calculation?'calculate.progress.engine':'Preparando motor local',rows:0})
  await owner.loadURL(origin+'/analytics.html')
  if(job.timing)job.timing.phases.window+=performance.now()-started
  await this.timed(job,'engine',()=>owner.webContents.executeJavaScript('new Promise(resolve=>{const timer=setInterval(()=>{if(globalThis.freyaSQL){clearInterval(timer);resolve(true)}},10)})'))
  if(job.timing)await owner.webContents.executeJavaScript('globalThis.freyaSQLProfile=true')
  return owner.webContents
 }
 private async execute(job:Job,request:SqlRequest):Promise<void>{
  const contents=await this.openEngine(job)
  const call=<T>(method:string,...args:unknown[])=>contents.executeJavaScript(`globalThis.freyaSQL.${method}(...${JSON.stringify(args)})`) as Promise<T>
  let cells=0
  const loadingStarted=performance.now()
  for(const [index,input] of request.sources.entries()){
   this.check(job);const record=this.docs.get(input.id);if(!isTableDocument(record.info)||record.info.revision!==input.revision)throw new Error('Una fuente no es CSV o cambió de revisión.')
   const ticket=randomUUID(),table=index===0?'datos':`tabla_${index+1}`
   try{
    const meta=await this.timed(job,'sourceStart',()=>this.docs.table.call<{headers:string[];revision:number;readonly:boolean;large?:boolean}>('analysisStart',input.id,ticket,input.revision,record.info.path,input.query,input.where))
    const source:SqlSource={id:input.id,name:record.info.name,revision:input.revision,table,columns:sqlColumns(meta.headers),rows:0,fromDisk:meta.readonly,large:meta.large,filtered:!!input.query||!!input.where?.conditions.length,...input.where?.conditions.length?{where:input.where}:{}};job.sources.push(source)
    if(meta.readonly&&record.info.path){const info=await stat(record.info.path);job.disk.set(input.id,{size:info.size,mtimeMs:info.mtimeMs})}
    await call('table',table,source.columns.map(column=>column.name))
    while(true){
     this.check(job)
     const batch=await this.timed(job,'sourceRead',()=>this.docs.table.call<{data?:Uint8Array;rows:number;done:boolean}>('analysisNext',ticket))
     if(batch.done)break
     cells+=batch.rows*source.columns.length;if(cells>8_000_000)throw new Error('El conjunto supera ocho millones de celdas. Reduce las fuentes.')
     const encodingStarted=performance.now(),encoded=Buffer.from(batch.data!).toString('base64')
     if(job.timing){job.timing.phases.sourceEncode+=performance.now()-encodingStarted;job.timing.bytes+=batch.data!.byteLength}
     await this.timed(job,'sourceAppend',()=>call('append',table,encoded))
     source.rows+=batch.rows;if(source.rows%10000===0)this.progress({requestId:job.id,phase:`Leyendo ${source.name}`,rows:source.rows})
    }
   }finally{await this.docs.table.call('analysisClose',ticket)}
  }
  if(job.timing)job.timing.phases.sourceLoad=performance.now()-loadingStarted
  this.check(job);const version=await this.timed(job,'seal',()=>call<string>('seal'));this.progress({requestId:job.id,phase:'Ejecutando consulta de solo lectura',rows:job.sources.reduce((n,s)=>n+s.rows,0)})
  let raw:unknown
  if(job.timing){
   const begun=performance.now()
   const response=await contents.executeJavaScript(`(async()=>{const started=performance.now();const value=await globalThis.freyaSQL.query(${JSON.stringify(request.sql)});return{value,timing:globalThis.freyaSQLTiming,workerMs:performance.now()-started}})()`) as {value:unknown;timing:{query:number;materialize:number};workerMs:number}
   job.timing.phases.query=response.timing.query;job.timing.phases.materialize=response.timing.materialize
   job.timing.phases.resultTransfer=Math.max(0,performance.now()-begun-response.workerMs);raw=response.value
  }else raw=await call('query',request.sql)
  const output=z.object({columns:z.array(z.object({name:z.string().max(100000),type:z.string().max(1000)})).min(1).max(200),rows:z.array(z.array(z.string().max(8*1024*1024).nullable()).max(200)).max(10000),limited:z.boolean()}).parse(raw);if(output.rows.some(row=>row.length!==output.columns.length)||output.rows.reduce((n,row)=>n+row.reduce((m,v)=>m+(v===null?0:Buffer.byteLength(v,'utf8')),0),0)>8*1024*1024)throw new Error('El motor devolvió un resultado no válido o demasiado grande.');this.check(job)
  job.result={requestId:job.id,sources:job.sources,version,columns:output.columns,rows:output.rows,returnedRows:output.rows.length,limited:output.limited,offset:0,completedAt:new Date().toISOString()}
 }
 async calculatePreview(id:string,edit:CalculateColumnEdit):Promise<CalculatedColumnPreview>{
  if(app.commandLine.hasSwitch('no-sandbox'))throw new Error(t('calculate.error.sandbox'))
  const record=this.docs.get(id)
  this.cancel(edit.requestId)
  this.preparedCalculation=undefined
  const job:Job={id:edit.requestId,documents:[id],sources:[],used:0,disk:new Map(),calculation:id}
  this.jobs.set(job.id,job)
  const assertCurrent=()=>{
   this.check(job)
   if(this.docs.get(id)!==record||record.info.revision!==edit.revision)throw new Error(t('calculate.error.changed'))
  }
  const start=async()=>{
   job.timer=setTimeout(()=>{job.error=t('calculate.error.timeout');this.cancel(job.id)},120000)
   await this.docs.calculationSource(id,edit.revision)
   assertCurrent()
   const contents=await this.openEngine(job)
   const call=async<T>(method:string,...args:unknown[])=>{
    const response=await contents.executeJavaScript(`(async()=>{try{return{ok:true,value:await globalThis.freyaSQL.${method}(...${JSON.stringify(args)})}}catch(error){return{ok:false,error:String(error?.message??error)}}})()`) as {ok:true;value:T}|{ok:false;error:string}
    if(!response.ok)throw new Error(response.error)
    return response.value
   }
   const ticket=randomUUID()
   const values:CalculatedValue[]=[]
   let bytes=0
   // Una celda Windows-1252 puede ocupar hasta tres veces más al pasar en UTF-8.
   const transportLimit=50*1024*1024*(record.info.encoding==='win1252'?3:1)
   try{
    assertCurrent()
    const meta=await this.docs.table.call<{headers:string[];revision:number;rows:number}>('calculationStart',id,ticket,edit)
    const names=sqlColumns(meta.headers)
    const columns=edit.columns.map(column=>({...column,name:names[column.index].name}))
    let rowColumn='__freya_row'
    while(names.some(column=>column.name.toLowerCase()===rowColumn))rowColumn+='_'
    await call('table','datos',[...columns.map(column=>column.name),rowColumn])
    let loaded=0
    while(true){
     assertCurrent()
     const batch=await this.docs.table.call<{data?:Uint8Array;rows:number;done:boolean}>('analysisNext',ticket)
     if(batch.done)break
     await call('append','datos',Buffer.from(batch.data!).toString('base64'))
     loaded+=batch.rows
     if(loaded%10000===0)this.progress({requestId:job.id,phase:t('calculate.progress.loading'),rows:loaded})
    }
    await call('seal')
    this.progress({requestId:job.id,phase:t('calculate.progress.evaluating'),rows:0})
    await call('calculateStart',edit.expression,columns,rowColumn)
    while(true){
     assertCurrent()
     const {data:batch}=calculationBatch.safeParse(await call('calculateNext'))
     if(!batch)throw new Error(t('calculate.error.result'))
     if(!batch.done&&!batch.rows.length)throw new Error(t('calculate.error.result'))
     for(const value of batch.rows){
      bytes+=value.value===null?0:Buffer.byteLength(value.value,'utf8')
      if(bytes>transportLimit||values.length>=meta.rows)throw new Error(t('calculate.error.result'))
      values.push(value)
     }
     this.progress({requestId:job.id,phase:t('calculate.progress.evaluating'),rows:values.length})
     if(batch.done)break
    }
   }finally{await this.docs.table.call('analysisClose',ticket)}
   const expectedSource=await this.docs.calculationSource(id,edit.revision)
   assertCurrent()
   const preview=await this.docs.table.call<CalculatedColumnPreview>('calculationPreview',id,edit,values,expectedSource)
   assertCurrent()
   return{preview,values}
  }
  const dispose=()=>{clearTimeout(job.timer);const owner=job.window;job.window=undefined;owner?.destroy()}
  try{
   const {preview,values}=await this.queue.run(job.id,'interactive',start,dispose)
   assertCurrent()
   this.preparedCalculation={id,requestId:edit.requestId,key:calculationKey(id,edit),values}
   return preview
  }catch(error){throw new Error(job.error??(error as Error).message)}
  finally{if(this.jobs.get(job.id)===job)this.jobs.delete(job.id)}
 }
 async calculateApply(id:string,edit:CalculateColumnEdit){
  const prepared=this.preparedCalculation
  if(!prepared||prepared.key!==calculationKey(id,edit))throw new Error(t('calculate.error.preview'))
  this.preparedCalculation=undefined
  const abort=new AbortController()
  this.applyingCalculation.set(edit.requestId,{id,abort})
  try{return await this.docs.calculationApply(id,edit,prepared.values,abort.signal)}
  finally{this.applyingCalculation.delete(edit.requestId)}
 }
 async page(requestId:string,offset:number):Promise<SqlResult>{
  const job=this.jobs.get(requestId);if(!job?.result)throw new Error('El resultado ya no está disponible. Ejecuta de nuevo la consulta.');this.check(job)
  job.used=++this.tick
  for(const [id,expected] of job.disk){const path=this.docs.get(id).info.path;if(!path)throw new Error('La fuente ya no existe.');const current=await stat(path);if(current.size!==expected.size||current.mtimeMs!==expected.mtimeMs)throw new Error('El archivo cambió en disco. Ejecuta de nuevo el análisis.')}
  return{...job.result,offset,rows:job.result.rows.slice(offset,offset+100)}
 }
}
