import {EditorState,EditorSelection,Prec,Text,type Extension} from '@codemirror/state'
import {EditorView,keymap} from '@codemirror/view'
import {foldGutter,foldKeymap} from '@codemirror/language'
import {markdownKeymap,insertNewlineContinueMarkupCommand} from '@codemirror/lang-markdown'
import type {MarkdownChange} from './markdown-commands'

export const markdownMultipleSelections=EditorState.allowMultipleSelections.of(true)
const continueMarkup=insertNewlineContinueMarkupCommand({nonTightLists:false})
export const markdownEditingExtensions:Extension=[
 markdownMultipleSelections,
 EditorView.contentAttributes.of({tabindex:'0'}),
 EditorView.clickAddsSelectionRange.of(event=>event.altKey),
 foldGutter(),keymap.of(foldKeymap),
 Prec.high(keymap.of(markdownKeymap.map(binding=>{
  const run=binding.key==='Enter'?continueMarkup:binding.run
  return{...binding,run:(view:EditorView)=>!view.state.readOnly&&!!run?.(view)}
 })))
]
export function markdownFormatChange(state:EditorState,result:MarkdownChange){
 const replacements=result.changes.flatMap(change=>{
  const before=state.doc.sliceString(change.from,change.to)
  if(before===change.insert)return[]
  // Conserva el contenido literal sólo si la envoltura tiene una ubicación inequívoca.
  const retained=change.insert?before.indexOf(change.insert):-1
  if(retained>=0&&retained===before.lastIndexOf(change.insert))return[{from:change.from,to:change.from+retained,insert:''},{from:change.from+retained+change.insert.length,to:change.to,insert:''}]
  const wrapped=before?change.insert.indexOf(before):-1
  if(wrapped>=0&&wrapped===change.insert.lastIndexOf(before))return[{from:change.from,to:change.from,insert:change.insert.slice(0,wrapped)},{from:change.to,to:change.to,insert:change.insert.slice(wrapped+before.length)}]
  return[change]
 })
 const changes=state.changes(replacements.map(change=>({...change,insert:Text.of(change.insert.split('\n'))})))
 const ranges=state.selection.ranges.map((range,index)=>index===state.selection.mainIndex?EditorSelection.range(result.selection.anchor,result.selection.head):range.map(changes))
 return{changes,selection:EditorSelection.create(ranges,state.selection.mainIndex)}
}
