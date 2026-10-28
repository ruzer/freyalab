import {Worker} from 'node:worker_threads'
import type {SearchTask,SearchChunk} from './large-search-scan'
interface Work {task:SearchTask;chunk:(data:SearchChunk)=>void;done:(result:{scanned:number;position:number;cancelled:boolean}|{error:string})=>void}
export class SearchPool {
 private queue:Work[]=[]
 private workers:{worker:Worker;work?:Work}[]=[]
 constructor(private count:number,private path:URL|string=new URL('./large-search-worker.js',import.meta.url)){}
 submit(work:Work){this.queue.push(work);this.dispatch()}
 cancel(flag:SharedArrayBuffer){
  Atomics.store(new Int32Array(flag),0,1)
  const queued=this.queue.filter(work=>work.task.cancel===flag);this.queue=this.queue.filter(work=>work.task.cancel!==flag)
  for(const work of queued)work.done({scanned:0,position:work.task.range.from,cancelled:true})
 }
 stopRange(flag:SharedArrayBuffer){Atomics.store(new Int32Array(flag),0,1);const queued=this.queue.filter(work=>work.task.stop===flag);this.queue=this.queue.filter(work=>work.task.stop!==flag);for(const work of queued)work.done({scanned:0,position:work.task.range.from,cancelled:true})}
 private dispatch(){
  while(this.queue.length){
   let slot=this.workers.find(slot=>!slot.work)
   if(!slot){
    if(this.workers.length>=this.count)return
    const worker=new Worker(this.path);slot={worker};this.workers.push(slot)
    const current=slot
    worker.on('message',message=>{
     const work=current.work;if(!work||work.task.taskId!==message.taskId)return
     if(message.chunk){work.chunk(message.chunk);current.worker.postMessage({taskId:message.taskId,ack:true})}
     else{current.work=undefined;work.done(message.error?{error:message.error}:message.done);this.dispatch()}
    })
    worker.on('error',error=>{const work=current.work;current.work=undefined;this.workers=this.workers.filter(slot=>slot!==current);work?.done({error:error instanceof Error?error.message:String(error)});this.dispatch()})
    worker.on('exit',()=>{if(!this.workers.includes(current))return;this.workers=this.workers.filter(slot=>slot!==current);const work=current.work;current.work=undefined;work?.done({error:'El hilo de búsqueda se cerró. Vuelve a buscar.'});this.dispatch()})
   }
   slot.work=this.queue.shift()!;slot.worker.postMessage(slot.work.task)
  }
 }
 async stop(){const queued=this.queue.splice(0);for(const work of queued)work.done({scanned:0,position:work.task.range.from,cancelled:true});const workers=this.workers.splice(0);await Promise.all(workers.map(async slot=>{await slot.worker.terminate();slot.work?.done({scanned:0,position:slot.work.task.range.from,cancelled:true})}))}
}
