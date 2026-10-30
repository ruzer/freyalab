import {randomUUID} from 'node:crypto'
import {z} from 'zod'
import {closePrepareCommand} from '../shared/application'
import {t} from '../shared/i18n'
export const closePreparedArguments=z.tuple([z.uuid(),z.boolean()])

// Un único cierre de la única ventana; sin verbo, texto ni ruta elegibles.
export class WindowClosePreparation {
 private pending?:{contents:number;nonce:string;promise:Promise<boolean>;finish:(ready:boolean)=>void;fail:(reason:Error)=>void;timer:ReturnType<typeof setTimeout>}
 request(contents:number,send:(command:{id:typeof closePrepareCommand;nonce:string})=>void){
  if(!Number.isSafeInteger(contents)||contents<1)throw new Error(t('menu.close.busy'))
  if(this.pending){if(this.pending.contents!==contents)throw new Error(t('menu.close.busy'));return{nonce:this.pending.nonce,promise:this.pending.promise}}
  const nonce=randomUUID();let finish!:(ready:boolean)=>void,fail!:(reason:Error)=>void
  const promise=new Promise<boolean>((resolve,reject)=>{finish=resolve;fail=reject}),timer=setTimeout(()=>{const pending=this.pending;if(pending?.nonce===nonce){this.pending=undefined;pending.fail(new Error(t('menu.close.timeout')))}},30000)
  this.pending={contents,nonce,promise,finish,fail,timer}
  try{send({id:closePrepareCommand,nonce})}catch{this.complete(contents,nonce,false)}
  return{nonce,promise}
 }
 complete(contents:number,nonce:string,ready:boolean):boolean{const pending=this.pending;if(!pending||pending.contents!==contents||pending.nonce!==nonce||typeof ready!=='boolean')return false;this.pending=undefined;clearTimeout(pending.timer);pending.finish(ready);return true}
 clear(contents:number){const pending=this.pending;if(pending?.contents===contents)this.complete(contents,pending.nonce,false)}
}
