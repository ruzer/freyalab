import {Worker} from 'node:worker_threads'
import type {SearchTask,SearchChunk} from './large-search-scan'
interface Work {task:SearchTask;chunk:(data:SearchChunk)=>void;done:(result:{scanned:number;position:number;cancelled:boolean}|{error:string})=>void}
interface Slot {worker:Worker;work?:Work;timer?:ReturnType<typeof setTimeout>;stopping?:boolean}
export class SearchPool {
 private queue:Work[]=[]
 private workers:Slot[]=[]
 constructor(private count:number,private path:URL|string=new URL('./large-search-worker.js',import.meta.url)){}
 submit(work:Work){this.queue.push(work);this.dispatch()}
 cancel(flag:SharedArrayBuffer){
  Atomics.store(new Int32Array(flag),0,1)
  const queued=this.queue.filter(work=>work.task.cancel===flag);this.queue=this.queue.filter(work=>work.task.cancel!==flag)
  for(const work of queued)work.done({scanned:0,position:work.task.range.from,cancelled:true})
  for(const slot of this.workers)if(slot.work?.task.cancel===flag)this.interrupt(slot)
 }
 stopRange(flag:SharedArrayBuffer){Atomics.store(new Int32Array(flag),0,1);const queued=this.queue.filter(work=>work.task.stop===flag);this.queue=this.queue.filter(work=>work.task.stop!==flag);for(const work of queued)work.done({scanned:0,position:work.task.range.from,cancelled:true});for(const slot of this.workers)if(slot.work?.task.stop===flag)this.interrupt(slot)}
 private interrupt(slot:Slot){
  if(slot.timer||slot.stopping||!slot.work)return
  const work=slot.work
  // A regex evaluation cannot observe Atomics until it returns; read-only workers may be terminated safely.
  slot.timer=setTimeout(()=>{
   slot.timer=undefined;if(slot.work!==work||!this.workers.includes(slot))return
   slot.stopping=true
   void slot.worker.terminate().then(()=>{this.workers=this.workers.filter(item=>item!==slot);slot.work=undefined;work.done({scanned:0,position:work.task.range.from,cancelled:true});this.dispatch()}).catch(error=>{this.workers=this.workers.filter(item=>item!==slot);slot.work=undefined;work.done({error:String(error)});this.dispatch()})
  },200)
 }
 private dispatch(){
  while(this.queue.length){
   let slot=this.workers.find(slot=>!slot.work&&!slot.stopping)
   if(!slot){
    if(this.workers.length>=this.count)return
    const worker=new Worker(this.path);slot={worker};this.workers.push(slot)
    const current=slot
    worker.on('message',message=>{
     const work=current.work;if(current.stopping||!work||work.task.taskId!==message.taskId)return
     if(message.chunk){work.chunk(message.chunk);current.worker.postMessage({taskId:message.taskId,ack:true})}
     else{clearTimeout(current.timer);current.timer=undefined;current.work=undefined;work.done(message.error?{error:message.error}:message.done);this.dispatch()}
    })
    worker.on('error',error=>{if(current.stopping)return;clearTimeout(current.timer);const work=current.work;current.work=undefined;this.workers=this.workers.filter(slot=>slot!==current);work?.done({error:error instanceof Error?error.message:String(error)});this.dispatch()})
    worker.on('exit',()=>{if(current.stopping||!this.workers.includes(current))return;clearTimeout(current.timer);this.workers=this.workers.filter(slot=>slot!==current);const work=current.work;current.work=undefined;work?.done({error:'El hilo de búsqueda se cerró. Vuelve a buscar.'});this.dispatch()})
   }
   slot.work=this.queue.shift()!;slot.worker.postMessage(slot.work.task)
  }
 }
 async stop(){const queued=this.queue.splice(0);for(const work of queued)work.done({scanned:0,position:work.task.range.from,cancelled:true});const workers=this.workers.splice(0);await Promise.all(workers.map(async slot=>{clearTimeout(slot.timer);await slot.worker.terminate();slot.work?.done({scanned:0,position:slot.work.task.range.from,cancelled:true})}))}
}
