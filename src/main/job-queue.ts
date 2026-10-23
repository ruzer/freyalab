export type Priority='interactive'|'export'
const rank:Record<Priority,number>={interactive:0,export:1}
interface Entry{id:string;priority:Priority;order:number;start:()=>Promise<unknown>;dispose:()=>void;resolve:(value:any)=>void;reject:(error:Error)=>void}
// Cola con un número limitado de huecos (por defecto uno: un motor de análisis a la vez). Lo interactivo pasa por delante de lo que exporta;
// dentro de cada prioridad manda el orden de llegada. Cancelar una tarea en curso la libera sin esperar a que responda.
export class JobQueue{
 private waiting:Entry[]=[];private active=new Set<Entry>();private arrivals=0
 constructor(private limit=1,private onWait:(id:string)=>void=()=>{}){}
 run<T>(id:string,priority:Priority,start:()=>Promise<T>,dispose:()=>void){
  return new Promise<T>((resolve,reject)=>{
   if(this.active.size>=this.limit)this.onWait(id)
   this.waiting.push({id,priority,order:this.arrivals++,start,dispose,resolve,reject});this.pump()
  })
 }
 cancel(id:string,error=new Error('Análisis cancelado.')){
  const queued=this.waiting.find(entry=>entry.id===id)
  if(queued){this.waiting=this.waiting.filter(entry=>entry!==queued);queued.reject(error);return true}
  const running=[...this.active].find(entry=>entry.id===id);if(!running)return false
  running.reject(error);this.release(running);return true
 }
 // Cancela todo sin que la liberación de lo que corre arranque lo que espera (cierre de la aplicación).
 clear(error=new Error('Análisis cancelado.')){for(const entry of this.waiting.splice(0))entry.reject(error);for(const entry of [...this.active])this.cancel(entry.id,error)}
 private pump(){
  while(this.active.size<this.limit&&this.waiting.length){
   this.waiting.sort((a,b)=>rank[a.priority]-rank[b.priority]||a.order-b.order)
   const entry=this.waiting.shift()!;this.active.add(entry)
   new Promise(resolve=>resolve(entry.start())).then(value=>this.settle(entry,()=>entry.resolve(value)),error=>this.settle(entry,()=>entry.reject(error)))
  }
 }
 // Una tarea cancelada ya no está activa: su respuesta tardía se ignora y su recurso no se libera dos veces.
 private settle(entry:Entry,answer:()=>void){if(!this.active.has(entry))return;answer();this.release(entry)}
 private release(entry:Entry){this.active.delete(entry);entry.dispose();this.pump()}
}
