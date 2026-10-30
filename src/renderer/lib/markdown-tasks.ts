import {EditorState,Compartment,type Transaction} from '@codemirror/state'
import {history,isolateHistory} from '@codemirror/commands'
import {markdownMultipleSelections} from './markdown-editing'

export type MarkdownSession={state:EditorState;ui:Compartment;receive?:(transactions:readonly Transaction[])=>void}
export type TaskReference={line:number;from:number;expectedLine:string;marker:'[ ]'|'[x]'|'[X]'}

export function createMarkdownSession(source:string):MarkdownSession{
 const ui=new Compartment()
 return{ui,state:EditorState.create({doc:source,extensions:[history(),markdownMultipleSelections,ui.of([]),...(source.includes('\r\n')?[EditorState.lineSeparator.of('\r\n')]:[])]})}
}

export function taskChange(source:string,ref:TaskReference):{from:number;to:number;insert:string}|undefined{
 if(!Number.isSafeInteger(ref.line)||ref.line<1||!Number.isSafeInteger(ref.from)||ref.from<0||ref.from+3>source.length||!['[ ]','[x]','[X]'].includes(ref.marker))return
 let start=0
 for(let line=1;line<ref.line;line++){
  const end=source.indexOf('\n',start)
  if(end<0)return
  start=end+1
 }
 const newline=source.indexOf('\n',start)
 const end=newline<0?source.length:newline-(source[newline-1]==='\r'?1:0)
 if(source.slice(start,end)!==ref.expectedLine||ref.from<start||ref.from+3>end||source.slice(ref.from,ref.from+3)!==ref.marker)return
 return{from:ref.from,to:ref.from+3,insert:ref.marker==='[ ]'?'[x]':'[ ]'}
}

export function taskTransaction(state:EditorState,source:string,ref:TaskReference):Transaction|undefined{
 if(state.readOnly)return
 const change=taskChange(source,ref)
 if(!change||state.sliceDoc()!==source)return
 // La línea física puede no coincidir con la de CM en documentos con LF/CRLF mezclados.
 const from=state.toText(source.slice(0,change.from)).length
 if(state.doc.sliceString(from,from+3)!==ref.marker)return
 const transaction=state.update({changes:{from,to:from+3,insert:change.insert},annotations:isolateHistory.of('full'),userEvent:'input.task'})
 const expected=source.slice(0,change.from)+change.insert+source.slice(change.to)
 if(transaction.state.sliceDoc()===expected)return transaction
}
