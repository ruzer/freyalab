import {parentPort} from 'node:worker_threads'
import {scanSearch,type SearchTask} from './large-search-scan'
if(!parentPort)throw new Error('La búsqueda necesita un hilo del proceso de tablas.')
const pending=new Map<number,()=>void>()
parentPort.on('message',async(message:SearchTask|{taskId:number;ack:true})=>{
 if('ack'in message){pending.get(message.taskId)?.();pending.delete(message.taskId);return}
 const task=message
 try{
  const result=await scanSearch(task,chunk=>new Promise<void>(resolve=>{pending.set(task.taskId,resolve);parentPort!.postMessage({taskId:task.taskId,chunk},[chunk.rows.buffer,chunk.positions.buffer,chunk.lengths.buffer])}))
  parentPort!.postMessage({taskId:task.taskId,done:result})
 }catch(error){parentPort!.postMessage({taskId:task.taskId,error:(error as Error).message})}finally{pending.delete(task.taskId)}
})
