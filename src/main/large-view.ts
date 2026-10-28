import {open} from 'node:fs/promises'
import {availableParallelism} from 'node:os'
import iconv from 'iconv-lite'
import {compileTableQuery} from './table-query'
import {splitFields,indexUnchanged,type LargeIndex} from './large-table'
import {MatchList,MATCH_LIMIT,MATCH_BYTES} from './large-matches'
import {SearchPool} from './large-search-pool'
import type {SearchChunk} from './large-search-scan'
import type {LargeViewRequest,LargeViewState,TableRow} from '../shared/types'

interface Source {index:LargeIndex;delimiter:string;header:boolean;width:number;revision:number;alive:()=>boolean}
interface RangeState {list:MatchList;from:number;to:number;first:number;scanned:number;position:number;stop:SharedArrayBuffer;done:boolean}
interface Job {source:Source;state:LargeViewState;key:string;started:number;cancel:SharedArrayBuffer;ranges:RangeState[];pending:number;done:Promise<void>;resolve:()=>void;finishing:boolean}
export interface ViewOptions {workers?:number;workerPath?:URL|string;batchRecords?:number;chunk?:number;delayMs?:number;limit?:number;bytes?:number}
export class LargeViews {
 private jobs=new Map<string,Job>()
 private generation=new Map<string,number>()
 private task=0
 private workers:number
 private pool:SearchPool
 constructor(private options:ViewOptions={}){this.workers=Math.max(1,Math.min(8,options.workers??Math.min(4,Math.max(1,availableParallelism()-2))));this.pool=new SearchPool(this.workers,options.workerPath)}
 private snapshot(job:Job):LargeViewState{return {...job.state,query:structuredClone(job.state.query),elapsedMs:job.state.status==='running'?Math.round(performance.now()-job.started):job.state.elapsedMs,fraction:job.state.status==='complete'?1:Math.min(1,job.ranges.reduce((n,range)=>n+Math.max(0,range.position-range.from),0)/Math.max(1,job.source.index.size-job.source.index.bomLength))}}
 private async unchanged(job:Job){return await indexUnchanged(job.source.index)&&job.source.alive()}
 private invalidate(job:Job){job.state.status='invalidated';job.state.error='El archivo cambió desde la búsqueda. Vuelve a abrirlo antes de buscar otra vez.';this.pool.cancel(job.cancel);for(const range of job.ranges)range.list.truncate(0);job.state.matched=0}
 private allocated(){let bytes=0;for(const job of this.jobs.values())for(const range of job.ranges)bytes+=range.list.bytes;return bytes}
 private lastRange(job:Job){for(let i=job.ranges.length-1;i>=0;i--)if(job.ranges[i].list.count)return i;return -1}
 private cutoff(job:Job){
  if(job.state.matched<(this.options.limit??MATCH_LIMIT)||job.state.status!=='running'&&job.state.status!=='cancelled')return
  const last=this.lastRange(job)
  for(let i=last;i<job.ranges.length;i++)if(i>=0)this.pool.stopRange(job.ranges[i].stop)
  for(let i=0;i<last;i++)if(!job.ranges[i].done)return
  job.state.status='limit';job.state.limitReason='matches';job.state.elapsedMs=Math.round(performance.now()-job.started);this.pool.cancel(job.cancel)
 }
 private async finish(id:string,job:Job){
  if(job.pending||job.finishing)return
  job.finishing=true
  if(this.jobs.get(id)===job&&!await this.unchanged(job))this.invalidate(job)
  else if(job.state.status==='running')job.state.status=Atomics.load(new Int32Array(job.cancel),0)?'cancelled':'complete'
  job.state.elapsedMs=Math.round(performance.now()-job.started);job.resolve()
 }
 private progress(job:Job,range:RangeState,data:{scanned:number;position:number}){range.scanned=data.scanned;range.position=data.position;job.state.scanned=job.ranges.reduce((n,item)=>n+item.scanned,0)}
 async start(id:string,source:Source,request:LargeViewRequest){
  compileTableQuery({...request,offset:0,limit:1,requestId:0},source.width)
  if(!request.search&&!request.conditions?.length)throw new Error('Introduce una búsqueda o una condición.')
  const ticket=(this.generation.get(id)??0)+1;this.generation.set(id,ticket)
  const key=JSON.stringify([source.revision,(request.search??'').toLocaleLowerCase(),request.conditions??[],request.filterMode??'all']),previous=this.jobs.get(id)
  if(previous?.state.status==='complete'&&previous.key===key&&previous.source.alive()&&await this.unchanged(previous)){
   if(this.generation.get(id)!==ticket||this.jobs.get(id)!==previous)throw new Error('Consulta cancelada por una solicitud más reciente.')
   previous.state.requestId=request.requestId;previous.state.query={search:request.search,conditions:structuredClone(request.conditions),filterMode:request.filterMode};return this.snapshot(previous)
  }
  if(previous){this.pool.cancel(previous.cancel);await previous.done}
  if(this.generation.get(id)!==ticket||!source.alive())throw new Error('Consulta cancelada por una solicitud más reciente.')
  let resolve!:()=>void
  const job:Job={source,key,started:performance.now(),cancel:new SharedArrayBuffer(4),ranges:[],pending:0,done:new Promise<void>(done=>{resolve=done}),resolve:()=>resolve(),finishing:false,state:{requestId:request.requestId,revision:source.revision,query:{search:request.search,conditions:structuredClone(request.conditions),filterMode:request.filterMode},status:'running',total:Math.max(0,source.index.records-(source.header?1:0)),scanned:0,matched:0,fraction:0,elapsedMs:0}}
  this.jobs.set(id,job)
  if(!await this.unchanged(job)){this.invalidate(job);await this.finish(id,job);return this.snapshot(job)}
  if(this.generation.get(id)!==ticket||Atomics.load(new Int32Array(job.cancel),0)){job.state.status='cancelled';await this.finish(id,job);return this.snapshot(job)}
  const index=source.index,count=Math.min(this.workers,index.offsets.length)
  for(let i=0;i<count;i++){
   const from=Math.floor(i*index.offsets.length/count),to=Math.floor((i+1)*index.offsets.length/count)
   job.ranges.push({from:index.offsets[from],to:to===index.offsets.length?index.size:index.offsets[to],first:from*index.every,scanned:0,position:index.offsets[from],stop:new SharedArrayBuffer(4),done:false,list:new MatchList(()=>(this.options.bytes??MATCH_BYTES)-this.allocated())})
  }
  job.pending=job.ranges.length
  for(const range of job.ranges)this.pool.submit({task:{taskId:++this.task,index,range:{from:range.from,to:range.to,first:range.first},query:job.state.query,delimiter:source.delimiter,header:source.header,width:source.width,cancel:job.cancel,stop:range.stop,batchRecords:this.options.batchRecords,chunk:this.options.chunk,delayMs:this.options.delayMs},chunk:(data:SearchChunk)=>{
   if(this.jobs.get(id)!==job)return
   this.progress(job,range,data)
   if(job.state.status!=='running'&&job.state.status!=='cancelled')return
   try{
    const current=job.ranges.indexOf(range)
    for(let i=0;i<data.rows.length;i++){
     let displaced:MatchList|undefined,oldRow=0,oldPosition=0,oldLength=0
     if(job.state.matched>=(this.options.limit??MATCH_LIMIT)){
      const last=this.lastRange(job)
      if(current>=last)break
      displaced=job.ranges[last].list;oldRow=displaced.tailRow;oldPosition=displaced.tailPosition;oldLength=displaced.tailLength;displaced.truncate(displaced.count-1);job.state.matched--
     }
     if(!range.list.append(data.rows[i],data.positions[i],data.lengths[i])){if(displaced){displaced.append(oldRow,oldPosition,oldLength);job.state.matched++}job.state.status='limit';job.state.limitReason='memory';job.state.elapsedMs=Math.round(performance.now()-job.started);this.pool.cancel(job.cancel);break}
     job.state.matched++
    }
    this.cutoff(job)
   }catch(error){job.state.status='error';job.state.error=(error as Error).message;this.pool.cancel(job.cancel)}
  },done:result=>{
   if('error'in result){if(job.state.status==='running'){job.state.status='error';job.state.error=result.error;this.pool.cancel(job.cancel)}}else this.progress(job,range,result)
   range.done=true;job.pending--;this.cutoff(job);void this.finish(id,job)
  }})
  if(!job.pending)void this.finish(id,job)
  return this.snapshot(job)
 }
 async state(id:string):Promise<LargeViewState|null>{const job=this.jobs.get(id);if(!job)return null;if(job.state.status!=='invalidated'&&!await this.unchanged(job))this.invalidate(job);if(this.jobs.get(id)!==job)return this.state(id);return this.snapshot(job)}
 async cancel(id:string,requestId:string){const job=this.jobs.get(id);if(!job||job.state.requestId!==requestId)return this.state(id);if(job.state.status==='running')job.state.status='cancelled';this.pool.cancel(job.cancel);await job.done;return this.snapshot(job)}
 async clear(id:string){this.generation.set(id,(this.generation.get(id)??0)+1);const job=this.jobs.get(id);this.jobs.delete(id);if(job){this.pool.cancel(job.cancel);await job.done}}
 async page(id:string,requestId:string,offset:number,limit:number):Promise<{rows:TableRow[];view:LargeViewState}>{
  const job=this.jobs.get(id);if(!job||job.state.requestId!==requestId)throw new Error('La búsqueda cambió por una solicitud más reciente.')
  if(job.state.status==='invalidated')return {rows:[],view:this.snapshot(job)}
  if(!await this.unchanged(job)){this.invalidate(job);return {rows:[],view:this.snapshot(job)}}
  const entries=[];let skip=offset
  for(const range of job.ranges){if(skip>=range.list.count){skip-=range.list.count;continue}entries.push(...range.list.page(skip,limit-entries.length));skip=0;if(entries.length>=limit)break}
  const handle=await open(job.source.index.path,'r'),rows:TableRow[]=[]
  try{
   for(const entry of entries){const bytes=Buffer.alloc(entry.length);let read=0;while(read<bytes.length){const result=await handle.read(bytes,read,bytes.length-read,entry.position+read);if(!result.bytesRead)throw new Error('El archivo cambió mientras se leía la página.');read+=result.bytesRead}const text=(job.source.index.encoding==='utf8'?bytes.toString('utf8'):iconv.decode(bytes,job.source.index.encoding)).replace(/(\r\n|\n|\r)$/,'');rows.push({id:String(entry.row),cells:splitFields(text,job.source.delimiter)})}
  }finally{await handle.close()}
  if(this.jobs.get(id)!==job)throw new Error('La búsqueda cambió por una solicitud más reciente.')
  if(!await this.unchanged(job)){this.invalidate(job);return {rows:[],view:this.snapshot(job)}}
  return {rows,view:this.snapshot(job)}
 }
 async stop(){for(const id of [...this.jobs.keys()])await this.clear(id);await this.pool.stop()}
}
