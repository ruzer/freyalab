import { utilityProcess, type UtilityProcess } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {SqlProgress} from '../shared/types'
export class TableClient {
 constructor(private progress:(event:SqlProgress)=>void=()=>{}){}
 private process:UtilityProcess|undefined
 private next=0
 private pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void}>()
 private start(){
  if(this.process)return
  this.process=utilityProcess.fork(join(fileURLToPath(new URL('.',import.meta.url)),'table-worker.js'),[],{serviceName:'FreyaLab CSV'})
  this.process.on('message',(message:{requestId:number;result:unknown;error?:string}|{progress:SqlProgress})=>{if('progress' in message){this.progress(message.progress);return}const p=this.pending.get(message.requestId);if(!p)return;this.pending.delete(message.requestId);message.error?p.reject(new Error(message.error)):p.resolve(message.result)})
  this.process.on('exit',()=>{this.process=undefined;for(const p of this.pending.values())p.reject(new Error('El proceso de tablas se cerró. Conserva la ventana abierta y usa la recuperación.'));this.pending.clear()})
 }
 call<T=any>(method:string,...args:unknown[]):Promise<T>{this.start();const requestId=++this.next;return new Promise((resolve,reject)=>{this.pending.set(requestId,{resolve,reject});this.process!.postMessage({requestId,method,args})})}
 stop(){this.process?.kill()}
}
