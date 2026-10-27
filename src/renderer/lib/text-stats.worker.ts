import {prepareTextStats,countSelectedWords,type PreparedTextStats,type TextSelection} from './text-stats'

export interface TextStatsRequest {request:number;text?:string;markdown?:boolean;selection:TextSelection|null}
export interface TextStatsValue {words:number;selected:number|null;reading:string;language:string}
export type TextStatsReply={request:number;value:TextStatsValue}|{request:number;error:string}
let latest=0,prepared:Promise<PreparedTextStats|undefined>|undefined

async function drain<T>(work:Generator<void,T>,obsolete=()=>false):Promise<T|undefined>{
 let deadline=performance.now()+8
 for(;;){
  if(obsolete())return
  const step=work.next();if(step.done)return step.value
  if(performance.now()>=deadline){await new Promise<void>(resolve=>setTimeout(resolve,0));deadline=performance.now()+8}
 }
}

// Cada worker recibe una sola fuente; cambiar la selección reutiliza su preparación.
self.onmessage=async(event:MessageEvent<TextStatsRequest>)=>{
 const {request,text,markdown,selection}=event.data;latest=request
 try{
  if(text!==undefined)prepared=drain(prepareTextStats(text,markdown))
  const stats=await prepared
  if(!stats)throw new Error('Falta la fuente del documento.')
  if(request!==latest)return
  const selected=selection?await drain(countSelectedWords(stats,selection),()=>request!==latest):null
  if(request!==latest||selected===undefined)return
  const reply:TextStatsReply={request,value:{words:stats.words,selected,reading:stats.reading,language:stats.language}}
  self.postMessage(reply)
 }catch{
  if(request===latest){const reply:TextStatsReply={request,error:'No pude contar las palabras de este documento.'};self.postMessage(reply)}
 }
}
