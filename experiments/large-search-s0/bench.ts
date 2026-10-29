import assert from 'node:assert/strict'
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads'
import {performance} from 'node:perf_hooks'
import {buildIndex,readRecords,type LargeIndex} from '../../src/main/large-table'
import {scan,directPage,type Strategy} from './scan'

async function parallel(index:LargeIndex,strategy:Strategy,needle:string,jobs:number,options:any={}){
 const started=performance.now(),cancel=new SharedArrayBuffer(4),flag=new Int32Array(cancel)
 const controls:Worker[]=[],receive:number[]=[],parts=[]
 const timer=options.cancelAfterMs?setTimeout(()=>Atomics.store(flag,0,1),options.cancelAfterMs):undefined
 try{
  for(let i=0;i<jobs;i++){
   const from=Math.floor(i*index.offsets.length/jobs),to=Math.floor((i+1)*index.offsets.length/jobs)
   if(from===to)continue
   const base=from*index.every,end=to===index.offsets.length?index.size:index.offsets[to],records=(to===index.offsets.length?index.records:to*index.every)-base
   const worker=new Worker(new URL(import.meta.url),{workerData:{index:{...index,bomLength:index.offsets[from],size:end,records},strategy,needle,options:{chunk:1024*1024,batchRecords:512,...options,ordinalBase:base},cancel}})
   controls.push(worker)
   parts.push(new Promise<any>((resolve,reject)=>{worker.on('message',message=>{receive.push(performance.timeOrigin+performance.now()-message.postedAt);message.error?reject(new Error(message.error)):resolve(message.result)});worker.on('error',reject);worker.on('exit',code=>{if(code)reject(new Error(`Worker exit ${code}`))})}))
  }
  const results=await Promise.all(parts),count=results.reduce((n,result)=>n+result.count,0),list=options.merge?new Uint32Array(count*3):undefined
  assert.equal(results.reduce((n,result)=>n+result.scanned,0),index.records-1)
  let cursor=0;for(const result of results)if(list){list.set(result.list,cursor);cursor+=result.list.length}
  return {jobs,count,scanned:results.reduce((n,result)=>n+result.scanned,0),sum:results.reduce((n,result)=>(n+result.sum)>>>0,0),xor:results.reduce((n,result)=>n^result.xor,0),ms:performance.now()-started,maxWorkerMs:Math.max(...results.map(result=>result.ms)),receiveMs:receive,payloadBytes:results.reduce((n,result)=>n+(result.list?.byteLength??0),0),rss:process.memoryUsage().rss,maxRss:process.resourceUsage().maxRSS*1024,...(list?{list}:{})}
 }finally{if(timer)clearTimeout(timer);await Promise.all(controls.map(worker=>worker.terminate()))}
}
async function task(request:any){
 const started=performance.now(),index=await buildIndex(request.path,{encoding:'utf8',bomLength:0,maxRecord:1048576}),indexMs=performance.now()-started
 if(request.kind==='page'){
  const scanResult=await scan(index,'own','',{retain:true}),all=scanResult.list!,page=new Uint32Array(600),times=[]
  for(let i=0;i<200;i++)page.set(all.subarray(Math.floor(i*(scanResult.count-1)/199)*3,Math.floor(i*(scanResult.count-1)/199)*3+3),i*3)
  for(let repetition=0;repetition<5;repetition++){
   const direct=await directPage(index,page),sparseStarted=performance.now(),rows=[]
   for(let i=0;i<page.length;i+=3)rows.push(...await readRecords(index,page[i],1))
   assert.deepEqual(rows,direct.rows);times.push({directMs:direct.ms,directBytes:direct.bytes,sparseMs:performance.now()-sparseStarted})
  }
  return {indexMs,rows:index.records-1,size:index.size,times,maxRss:process.resourceUsage().maxRSS*1024}
 }
 if(request.kind==='parallelParity'){
  const serial=await scan(index,'prefilter',request.needle,{retain:true,batchRecords:3}),variants=[]
  for(const jobs of [1,2,4,8])for(const batchRecords of [1,3,2000]){const result=await parallel(index,'prefilter',request.needle,jobs,{retain:true,merge:true,batchRecords});assert.deepEqual(result.list,serial.list);variants.push({jobs,batchRecords,count:result.count})}
  return {variants}
 }
 const before=performance.now()
 try{
  const result=request.jobs?await parallel(index,request.strategy,request.needle,request.jobs,{retain:request.retain,cancelAfterMs:request.cancelAfterMs,column:request.column}):await scan(index,request.strategy,request.needle,{retain:request.retain,column:request.column})
  if(result.maxRss>=1024**3)throw new Error(`Memory limit exceeded: ${result.maxRss}`)
  const {list,...metadata}=result
  return {...metadata,indexMs,size:index.size,rows:index.records-1,throughputMiBs:index.size/1048576/(result.ms/1000)}
 }catch(error){if(!request.cancelAfterMs)throw error;const totalMs=performance.now()-before;assert.ok(totalMs-request.cancelAfterMs<1000);return {cancelled:true,totalMs,afterRequestedMs:totalMs-request.cancelAfterMs,maxRss:process.resourceUsage().maxRSS*1024,error:String(error)}}
}
if(!isMainThread){
 const data=workerData
 try{const result=await scan(data.index,data.strategy,data.needle,{...data.options,cancelled:()=>!!Atomics.load(new Int32Array(data.cancel),0)});parentPort!.postMessage({result,postedAt:performance.timeOrigin+performance.now()},result.list?[result.list.buffer]:[])}catch(error){parentPort!.postMessage({error:String(error),postedAt:performance.timeOrigin+performance.now()})}
}else if((process as any).parentPort){
 const port=(process as any).parentPort
 port.on('message',async({data}:any)=>{try{port.postMessage({result:await task(data),runtime:{node:process.versions.node,electron:process.versions.electron,arch:process.arch,platform:process.platform}})}catch(error){port.postMessage({error:String(error),stack:(error as Error).stack})}})
}
