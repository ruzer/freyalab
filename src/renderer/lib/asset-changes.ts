import {EditorState,Transaction} from '@codemirror/state'
import {isolateHistory} from '@codemirror/commands'
import type {AssetChange} from '../../shared/types'

export function assetTransaction(state:EditorState,source:string,changes:readonly AssetChange[],expected:string,undoable:boolean):Transaction|undefined{
 if(state.sliceDoc()!==source)return
 let raw=0,position=0
 const mapped:{from:number;to:number;insert:string}[]=[]
 const splitsPair=(index:number)=>index>0&&/[\uD800-\uDBFF]/.test(source[index-1])&&/[\uDC00-\uDFFF]/.test(source[index]??'')
 for(const change of changes){
  if(!Number.isSafeInteger(change.from)||!Number.isSafeInteger(change.to)||change.from<raw||change.to<change.from||change.to>source.length||splitsPair(change.from)||splitsPair(change.to))return
  position+=state.toText(source.slice(raw,change.from)).length
  const end=position+state.toText(source.slice(change.from,change.to)).length
  mapped.push({from:position,to:end,insert:change.insert});raw=change.to;position=end
 }
 // La interfaz está bloqueada durante la copia; ese readOnly temporal no impide adoptar el resultado validado del guardado.
 const transaction=state.update({changes:mapped,annotations:undoable?isolateHistory.of('full'):Transaction.addToHistory.of(false),...(undoable?{userEvent:'input.image'}:{})})
 return transaction.state.sliceDoc()===expected?transaction:undefined
}
