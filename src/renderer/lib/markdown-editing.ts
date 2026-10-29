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
 const changes=state.changes(result.changes.map(change=>({...change,insert:Text.of(change.insert.split('\n'))})))
 const ranges=state.selection.ranges.map((range,index)=>index===state.selection.mainIndex?EditorSelection.range(result.selection.anchor,result.selection.head):range.map(changes))
 return{changes,selection:EditorSelection.create(ranges,state.selection.mainIndex)}
}
