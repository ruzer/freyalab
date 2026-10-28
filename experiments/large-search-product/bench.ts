import assert from 'node:assert/strict'
import {open} from 'node:fs/promises'
import {LargeViews} from '../../src/main/large-view'
import {buildIndex,readRecords} from '../../src/main/large-table'
import type {LargeViewQuery,LargeViewState} from '../../src/shared/types'
interface Request {path:string;query:LargeViewQuery;workers:number;prefilter:boolean;partial:boolean;kind?:'scan'|'page'|'cache'|'cancel'|'cap';cancelAfterMs?:number;expected?:number}
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))
export async function task(request:Request){
 const started=performance.now(),index=await buildIndex(request.path,{encoding:'utf8',bomLength:0,maxRecord:1048576,delimiter:','}),indexMs=performance.now()-started,headers=(await readRecords(index,0,1))[0].split(','),views=new LargeViews({workers:request.workers,prefilter:request.prefilter,partial:request.partial,workerPath:new URL('./worker.mjs',import.meta.url)}),id='measured',requestId=crypto.randomUUID(),source={index,delimiter:',',header:true,width:index.width??headers.length,revision:0,alive:()=>true}
 let cancellation:ReturnType<typeof setTimeout>|undefined,cancelled:Promise<LargeViewState|null>|undefined,cancelMs:number|undefined
 try{
  const began=performance.now();await views.start(id,source,{...request.query,requestId,revision:0})
  if(request.kind==='cancel')cancellation=setTimeout(()=>{const start=performance.now();cancelled=views.cancel(id,requestId).then(result=>{cancelMs=performance.now()-start;return result})},request.cancelAfterMs??350)
  let state:LargeViewState|null=null,peakRss=process.memoryUsage().rss
  do{await pause(2);state=await views.state(id);peakRss=Math.max(peakRss,process.memoryUsage().rss);assert.ok(performance.now()-began<180000,'Timed out');assert.ok(peakRss<1024**3,`RSS limit exceeded: ${peakRss}`)}while(state?.status==='running'||request.kind==='cancel'&&cancellation&&!cancelled)
  if(cancelled)state=await cancelled
  assert.ok(state)
  const wallMs=performance.now()-began
  if(request.kind==='cancel'){assert.equal(state.status,'cancelled');assert.ok(cancelMs!==undefined&&cancelMs<1000,`Cancellation exceeded 1s: ${cancelMs}`)}
  else if(request.kind==='cap'){assert.equal(state.status,'limit');assert.equal(state.limitReason,'matches');assert.equal(state.matched,10000000)}
  else{assert.equal(state.status,'complete',JSON.stringify(state));assert.equal(state.scanned,index.records-1)}
  if(request.expected!==undefined)assert.equal(state.matched,request.expected)
  let page:unknown,cache:unknown
  if(request.kind==='page'){
   assert.ok(state.matched>=1000000)
   const probe=await open(index.path,'r'),prototype=Object.getPrototypeOf(probe),original=prototype.read;await probe.close()
   const samples=[];let bytes=0,reads=0
   prototype.read=async function(...args:any[]){const result=await original.apply(this,args);bytes+=result.bytesRead;reads++;return result}
   try{for(let i=0;i<9;i++){const offset=Math.floor((state.matched-200)*i/8);bytes=0;reads=0;const start=performance.now(),result=await views.page(id,requestId,offset,200),ms=performance.now()-start;assert.equal(result.rows.length,200);assert.equal(reads,200);samples.push({offset,ms,bytes,reads,firstRow:result.rows[0].id,lastRow:result.rows.at(-1)!.id})}}
   finally{prototype.read=original}
   const sorted=samples.map(sample=>sample.ms).sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)];assert.ok(median<=50,`Page median exceeded 50ms: ${median}`);page={samples,medianMs:median}
  }
  if(request.kind==='cache'){
   const start=performance.now(),reused=await views.start(id,source,{...request.query,requestId:crypto.randomUUID(),revision:0});assert.equal(reused.status,'complete');assert.equal(reused.elapsedMs,state.elapsedMs);assert.equal(reused.matched,state.matched);cache={ms:performance.now()-start,previousElapsedMs:state.elapsedMs,reusedElapsedMs:reused.elapsedMs}
  }
  const retainedBytes=(views as unknown as {allocated:()=>number}).allocated();assert.ok(retainedBytes<=128*1024*1024,`List budget exceeded: ${retainedBytes}`)
  const maxRss=Math.max(peakRss,process.resourceUsage().maxRSS*1024);assert.ok(maxRss<1024**3,`RSS limit exceeded: ${maxRss}`)
  return {indexMs,size:index.size,records:index.records-1,effectiveRanges:Math.min(request.workers,index.offsets.length),state,wallMs,throughputMiBs:index.size/1048576/(state.elapsedMs/1000),maxRss,retainedBytes,cancelMs,page,cache}
 }finally{if(cancellation)clearTimeout(cancellation);await views.stop()}
}
const port=(process as any).parentPort
if(port)port.on('message',async({data}:any)=>{try{port.postMessage({result:await task(data),runtime:{electron:process.versions.electron,node:process.versions.node,arch:process.arch,platform:process.platform}})}catch(error){port.postMessage({error:String(error),stack:(error as Error).stack})}})
