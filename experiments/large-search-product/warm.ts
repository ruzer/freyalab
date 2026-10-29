import assert from 'node:assert/strict'
import {stat} from 'node:fs/promises'
import {TableEngine} from '../../src/main/table-engine'
import type {LargeViewQuery,LargeViewState} from '../../src/shared/types'
interface Request {path:string;query:LargeViewQuery;workers:number;prefilter:boolean;partial:boolean;expected:number;productWorker?:boolean}
export async function task(request:Request){
 const engine=new TableEngine(()=>{},{largeBytes:1,viewWorkers:request.workers,viewPrefilter:request.prefilter,viewPartial:request.partial,viewWorkerPath:new URL(request.productWorker?'./product-main/large-search-worker.js':'./worker.mjs',import.meta.url)}),id='warm-comparison',start=performance.now();await engine.open(id,request.path,{encoding:'utf8',delimiter:','});const indexMs=performance.now()-start,size=(await stat(request.path)).size,samples=[];let state:LargeViewState|null=null,peak=process.memoryUsage().rss
 try{
  for(let repeat=0;repeat<4;repeat++){
   // Clear the view, retaining the actual pool. Reapplying without clear would measure O4 cache instead of scanning.
   if(repeat)await engine.viewClear(id)
   const requestId=crypto.randomUUID(),began=performance.now();await engine.viewStart(id,{...request.query,requestId,revision:0})
   do{await new Promise(resolve=>setTimeout(resolve,2));state=await engine.viewState(id);peak=Math.max(peak,process.memoryUsage().rss);assert.ok(performance.now()-began<60000)}while(state?.status==='running')
   assert.equal(state?.status,'complete');assert.equal(state!.matched,request.expected);assert.ok(state!.scanned>0)
   samples.push({pool:repeat===0?'cold':'warm',repeat,elapsedMs:state!.elapsedMs,wallMs:performance.now()-began,throughputMiBs:size/1048576/(state!.elapsedMs/1000),matched:state!.matched,scanned:state!.scanned})
  }
  const maxRss=Math.max(peak,process.resourceUsage().maxRSS*1024);assert.ok(maxRss<1024**3)
  return {state,size,indexMs,samples,maxRss,method:'fresh utility/open; first scan cold; next three clear view and scan again with persistent real pool; no cache reuse'}
 }finally{await engine.close(id)}
}
const port=(process as any).parentPort
if(port)port.on('message',async({data}:any)=>{try{port.postMessage({result:await task(data),runtime:{electron:process.versions.electron,node:process.versions.node,arch:process.arch,platform:process.platform}})}catch(error){port.postMessage({error:String(error),stack:(error as Error).stack})}})
