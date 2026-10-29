import type {Documents} from './documents'
import {WindowClosePreparation} from './application-close'
import {closeAbortCommand} from '../shared/application'
import {t} from '../shared/i18n'
interface ClosingWindow {webContents:{id:number;send:(channel:string,event:unknown)=>void};isDestroyed:()=>boolean}
export interface ApplicationWindowCloseOptions {
 owner:ClosingWindow|undefined;currentWindow:()=>ClosingWindow|undefined
 documents:Pick<Documents,'records'|'info'|'holdForApplicationClose'>;settings:{flush:()=>Promise<void>}
 started:()=>void;ended:()=>void;finish:(ids:string[])=>Promise<void>;failed:(message:string)=>void;cancelled:(saved:string[])=>void
}

// Coordina una sola ventana. Las mutaciones se bloquean en Documents, no en SQL/RPC.
export class ApplicationWindowClose {
 private job?:Promise<boolean>
 constructor(private preparation:WindowClosePreparation){}
 get isClosing(){return !!this.job}
 close(options:ApplicationWindowCloseOptions):Promise<boolean>{
  if(this.job)return this.job
  const task=Promise.resolve().then(()=>this.run(options));this.job=task
  void task.finally(()=>{if(this.job===task)this.job=undefined}).catch(()=>{})
  return task
 }
 private async run(options:ApplicationWindowCloseOptions):Promise<boolean>{
  const{owner,documents}=options,deadline=performance.now()+30000,ownerIsCurrent=()=>options.currentWindow()===owner&&(!owner||!owner.isDestroyed())
  let preparation:ReturnType<WindowClosePreparation['request']>|undefined,lease:ReturnType<Documents['holdForApplicationClose']>|undefined,confirmationStarted=false,sendFailed=false
  try{
   options.started()
   if(owner){preparation=this.preparation.request(owner.webContents.id,command=>{try{owner.webContents.send('freya:command',command)}catch(error){sendFailed=true;throw error}});if(!await preparation.promise){if(sendFailed)options.failed(t('menu.close.unavailable'));return false}}
   if(!ownerIsCurrent()){options.failed(t('menu.close.changed'));return false}
   lease=documents.holdForApplicationClose()
   await this.withinDeadline(Promise.all([lease.ready,options.settings.flush()]),deadline)
   if(!ownerIsCurrent()){options.failed(t('menu.close.changed'));return false}
   const ids=[...documents.records.keys()];confirmationStarted=true
   const result=await lease.closeAll(ownerIsCurrent)
   if(!result.closed){options.cancelled(result.saved);return false}
   if(!ownerIsCurrent()){options.failed(t('menu.close.changed'));return false}
   await options.finish(ids)
   return true
  }catch(error){options.failed(error instanceof Error?error.message:t('menu.close.unavailable'));return false}
  finally{
   try{
    try{lease?.release()}finally{
     if(confirmationStarted&&owner&&!owner.isDestroyed())for(const id of documents.records.keys()){try{owner.webContents.send('freya:event',{type:'changed',document:documents.info(id)})}catch{}}
     if(owner&&!owner.isDestroyed()&&preparation){try{owner.webContents.send('freya:command',{id:closeAbortCommand,nonce:preparation.nonce})}catch{}}
    }
   }finally{options.ended()}
  }
 }
 private async withinDeadline(pending:Promise<unknown>,deadline:number){
  const remaining=deadline-performance.now();if(remaining<=0)throw new Error(t('menu.close.timeout'))
  let timer:ReturnType<typeof setTimeout>|undefined
  try{await Promise.race([pending,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error(t('menu.close.timeout'))),remaining)})])}finally{clearTimeout(timer)}
 }
}
