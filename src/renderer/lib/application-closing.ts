import {t} from '../../shared/i18n'
import {isTableDocument,type DocumentInfo} from '../../shared/types'
export type ClosingNotice={kind:'progress'|'error'|'notice';message:string}
type ClosingDocument=Pick<DocumentInfo,'id'|'name'|'kind'|'csvView'|'text'|'readonly'>
export interface ClosingSnapshot {documents:ClosingDocument[];activeId:string;busy:boolean;modal:boolean;composing:boolean}
interface ClosingOptions {snapshot:()=>ClosingSnapshot;prepare:(id:string)=>Promise<void>;locked:(value:boolean)=>void;notice:(value:ClosingNotice|null)=>void}

// El texto y el motivo permanecen en la interfaz. El ACK sólo devuelve booleano.
export class ApplicationClosing {
 private generation=0
 private timer?:ReturnType<typeof setTimeout>
 constructor(private options:ClosingOptions){}
 abort(){this.generation++;clearTimeout(this.timer);this.options.locked(false)}
 async prepare():Promise<boolean>{
  const generation=++this.generation,live=this.options.snapshot(),snapshot={...live,documents:[...live.documents]},ids=snapshot.documents.map(document=>document.id)
  clearTimeout(this.timer);this.options.notice(null)
  const reject=(key:string,name?:string)=>{if(generation===this.generation){clearTimeout(this.timer);this.options.locked(false);this.options.notice({kind:'error',message:t(key,{name:name??''})})}return false}
  if(snapshot.modal)return reject('menu.close.modal')
  if(snapshot.composing)return reject('menu.close.ime')
  if(snapshot.busy)return reject('menu.close.busy')
  for(const document of snapshot.documents)if(!document.readonly&&!isTableDocument(document)&&new TextEncoder().encode(document.text??'').byteLength>10*1024*1024)return reject('menu.close.textTooLarge',document.name)
  this.options.locked(true)
  this.timer=setTimeout(()=>{if(generation===this.generation)this.options.notice({kind:'progress',message:t('menu.close.preparing')})},1000)
  let preparing:ClosingDocument|undefined
  try{
   for(const document of snapshot.documents){preparing=document;await this.options.prepare(document.id);if(generation!==this.generation)return false}
   const current=this.options.snapshot()
   if(current.activeId!==snapshot.activeId||current.documents.length!==ids.length||ids.some((id,index)=>current.documents[index]?.id!==id))return reject('menu.close.changed')
   return generation===this.generation
  }catch{return reject('menu.close.updateFailed',preparing?.name)}
 }
}
