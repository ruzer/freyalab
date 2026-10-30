import {randomUUID} from 'node:crypto'
import {z} from 'zod'

const methods={
 'edit.undo':'undo','edit.redo':'redo','edit.cut':'cut','edit.copy':'copy',
 'edit.paste':'paste','edit.pastePlain':'pasteAndMatchStyle','edit.selectAll':'selectAll',
} as const
type NativeEdit=typeof methods[keyof typeof methods]
export const nativeEditArguments=z.tuple([z.uuid()])

// Sólo el callback de un comando del menú puede delegar su propia edición nativa.
export class MenuNativeEdits {
 private pending=new Map<string,{contents:number;method:NativeEdit}>()
 issue(contents:number,id:string,editable:boolean):string|undefined{
  if(!Number.isSafeInteger(contents)||contents<1||!Object.hasOwn(methods,id))return
  const method=methods[id as keyof typeof methods]
  if(!editable&&method!=='copy'&&method!=='selectAll')return
  if(this.pending.size>=64)this.pending.delete(this.pending.keys().next().value!)
  const nonce=randomUUID();this.pending.set(nonce,{contents,method});return nonce
 }
 take(contents:number,nonce:string):NativeEdit|undefined{
  const pending=this.pending.get(nonce);if(pending?.contents!==contents)return
  this.pending.delete(nonce);return pending.method
 }
 finish(contents:number,nonce:string):void{if(this.pending.get(nonce)?.contents===contents)this.pending.delete(nonce)}
 clear(contents:number):void{for(const[nonce,pending]of this.pending)if(pending.contents===contents)this.pending.delete(nonce)}
}
