import {EditorState,type Extension} from '@codemirror/state'
import {EditorView,keymap} from '@codemirror/view'
import {addCursorAbove,addCursorBelow,indentMore,temporarilySetTabFocusMode,toggleComment} from '@codemirror/commands'
import {closeBrackets} from '@codemirror/autocomplete'
import {bracketMatching,indentUnit} from '@codemirror/language'
import {markdown} from '@codemirror/lang-markdown'
import type {Settings} from '../../shared/settings'
import {markdownEditingExtensions} from './markdown-editing'

const mouseSelection=EditorView.clickAddsSelectionRange.of(event=>event.altKey)
const csvMouseSelection=EditorView.clickAddsSelectionRange.of(event=>event.altKey||(event.view?.navigator.platform.includes('Mac')?event.metaKey:event.ctrlKey))
const multipleSelections=EditorState.allowMultipleSelections.of(true)
const mermaidComments=EditorState.languageData.of(()=>[{commentTokens:{line:'%%'}}])
const editingKeys=keymap.of([
 {key:'Mod-/',run:view=>{
  if(!view.compositionStarted)toggleComment(view)
  return true
 }},
 {mac:'Ctrl-Alt-ArrowUp',run:addCursorAbove},
 {mac:'Ctrl-Alt-ArrowDown',run:addCursorBelow}
])
const indentOnTab=[
 keymap.of([{key:'Tab',run:view=>!view.compositionStarted&&indentMore(view)}]),
 // Esc también puede simplificar una selección antes de llegar al manejador nativo.
 EditorView.domEventObservers({keydown(event,view){
  if(event.key==='Escape'&&!view.compositionStarted)temporarilySetTabFocusMode(view)
 }})
]

export function editorEditingExtensions(kind:string,source:string,markdownSession=false):Extension {
 const plain=kind==='text',mermaid=kind==='mermaid'
 if(kind!=='markdown'&&!plain&&!mermaid&&kind!=='csv-text')return []
 const crlf=!markdownSession&&kind!=='csv-text'&&source.includes('\r\n')
 // Una separación CRLF fija solo es segura en texto plano con finales uniformes.
 const preserveCRLF=crlf&&(!plain||!/(?<!\r)\n|\r(?!\n)/.test(source))
 return [
  kind==='csv-text'?csvMouseSelection:mouseSelection,closeBrackets(),bracketMatching(),editingKeys,
  ...(preserveCRLF?[EditorState.lineSeparator.of('\r\n')]:[]),
  ...(plain||mermaid?[multipleSelections]:[]),
  ...(mermaid?[mermaidComments]:[]),
  ...(kind==='markdown'?[markdown({pasteURLAsLink:false,addKeymap:false}),markdownEditingExtensions]:[])
 ]
}

export function editorIndentation(editing?:Settings['editor']):Extension {
 if(!editing)return []
 // Solo Tab sangra. CodeMirror deja salir con Mayús+Tab o con Esc seguido de Tab.
 return [indentUnit.of(editing.indent==='tab'?'\t':' '.repeat(editing.indent)),editing.tabIndents?indentOnTab:[]]
}
