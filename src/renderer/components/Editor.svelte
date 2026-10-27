<script lang="ts">
 import {onMount} from 'svelte'
 import {EditorState,EditorSelection,Compartment,Text} from '@codemirror/state'
 import {EditorView,keymap,lineNumbers,highlightActiveLine,drawSelection} from '@codemirror/view'
 import {defaultKeymap,history,historyKeymap,undo,redo,isolateHistory} from '@codemirror/commands'
 import {searchKeymap,highlightSelectionMatches,openSearchPanel} from '@codemirror/search'
 import {markdown} from '@codemirror/lang-markdown'
 import {syntaxHighlighting,defaultHighlightStyle,syntaxTree} from '@codemirror/language'
 import {markdownCommands,lineFormatState,type MarkdownAction,type CodeLanguage} from '../lib/markdown-commands'
 import type {TextSelection} from '../lib/text-stats'
 import {markdownLinkOnPaste} from '../lib/markdown-paste'
 let {text='',readonly=false,kind='markdown',label='Editor de texto',onchange,onscroll,onformatstate,onselection}: {text:string;label?:string;readonly?:boolean;kind?:string;onchange:(text:string)=>void;onscroll?:(ratio:number)=>void;onformatstate?:(state:ReturnType<typeof lineFormatState>)=>void;onselection?:(selection:TextSelection|null)=>void}=$props()
 let host:HTMLDivElement
 let view:EditorView|undefined
 let applying=false
 let plainPaste=false
 const permission=new Compartment()
 let lastFormat=''
 function publishSelection(state:EditorState){const selection=state.selection.main;onselection?.(selection.empty?null:{from:selection.from,to:selection.to})}
 function publishFormat(state:EditorState){
  if(kind!=='markdown'||!onformatstate)return
  const head=state.selection.main.head,line=state.doc.lineAt(head),tree=syntaxTree(state)
  const active=lineFormatState(line.text,head-line.from)
  const node=tree.resolveInner(head,head===line.from?1:-1);let fenced=false,fenceStartsHere=false
  for(let current:typeof node|null=node;current;current=current.parent){
   const inside=head>=(current.firstChild?.to??current.from)&&head<=(current.lastChild?.from??current.to)
   if(inside&&current.name==='StrongEmphasis')active.bold=true
   if(inside&&current.name==='Emphasis')active.italic=true
   if(inside&&current.name==='InlineCode')active.inline=true
   if(current.name==='FencedCode'||current.name==='CodeBlock'){fenced=true;fenceStartsHere=current.from>=line.from&&current.from<=line.to}
   if(/^ATXHeading[1-3]$/.test(current.name))active.block=`heading${current.name.at(-1)}` as typeof active.block
  }
  // Cuatro tildes también forman una cerca: su centro conserva el tachado vacío recién insertado.
  if(fenced)Object.assign(active,{bold:false,italic:false,strike:fenceStartsHere&&active.strike&&/^ {0,3}~~~~[ \t]*$/.test(line.text),inline:false,block:'paragraph'})
  const signature=JSON.stringify(active)
  if(signature!==lastFormat){lastFormat=signature;onformatstate(active)}
 }
 export function format(action:MarkdownAction,language:CodeLanguage='text'){
  if(!view||kind!=='markdown'||readonly||view.state.readOnly||view.composing||view.compositionStarted)return
  const result=markdownCommands[action](view.state.doc.toString(),view.state.selection.main,language)
  view.dispatch({changes:result.changes.map(change=>({...change,insert:Text.of(change.insert.split('\n'))})),selection:EditorSelection.range(result.selection.anchor,result.selection.head),annotations:isolateHistory.of('full'),scrollIntoView:true,userEvent:'input'})
  view.focus()
 }
 function shortcut(action:MarkdownAction){return()=>{if(kind!=='markdown'||!view)return false;if(!view.composing&&!view.compositionStarted)format(action);return true}}
 export function undoEdit(){if(view) undo(view)}
 export function redoEdit(){if(view) redo(view)}
 export function search(){if(view) openSearchPanel(view)}
 function paste(event:ClipboardEvent,view:EditorView){
  const plain=plainPaste;plainPaste=false
  if(kind!=='markdown'||readonly||view.state.readOnly||plain||view.composing||view.compositionStarted)return false
  const result=markdownLinkOnPaste(view.state,event.clipboardData?.getData('text/plain')??'')
  if(!result)return false
  view.dispatch({changes:result.changes,selection:EditorSelection.range(result.selection.anchor,result.selection.head),annotations:isolateHistory.of('full'),scrollIntoView:true,userEvent:'input.paste'})
  return true
 }
 onMount(()=>{
  view=new EditorView({parent:host,state:EditorState.create({doc:text,extensions:[...(kind==='markdown'&&text.includes('\r\n')?[EditorState.lineSeparator.of('\r\n')]:[]),EditorView.contentAttributes.of({'aria-label':label}),lineNumbers(),highlightActiveLine(),drawSelection(),history(),highlightSelectionMatches(),keymap.of([{key:'Mod-b',run:shortcut('bold')},{key:'Mod-i',run:shortcut('italic')},{key:'Mod-Shift-x',run:shortcut('strike')},...(['paragraph','heading1','heading2','heading3'] as const).map((action,index)=>({key:`Mod-Alt-${index}`,run:shortcut(action)})),...defaultKeymap,...historyKeymap,...searchKeymap]),syntaxHighlighting(defaultHighlightStyle),...(kind==='markdown'?[markdown({pasteURLAsLink:false})]:[]),EditorView.lineWrapping,permission.of([EditorState.readOnly.of(readonly),EditorView.editable.of(!readonly)]),EditorView.theme({'&':{height:'100%',fontSize:'13px'},'.cm-scroller':{fontFamily:'"JetBrains Mono", monospace',lineHeight:'1.8'},'.cm-content':{padding:'20px 0'},'.cm-gutters':{backgroundColor:'transparent',color:'var(--muted)',borderRight:'1px solid var(--border)'},'.cm-activeLine':{backgroundColor:'var(--hover)'},'.cm-activeLineGutter':{backgroundColor:'var(--hover)'},'.cm-cursor':{borderLeftColor:'var(--text)'},'.cm-selectionBackground, &.cm-focused .cm-selectionBackground':{backgroundColor:'#007aff35'},'.cm-panels':{backgroundColor:'var(--panel)',color:'var(--text)'},'.cm-search input':{color:'var(--text)'}}),EditorView.updateListener.of(update=>{if(update.docChanged&&!applying) onchange(update.state.sliceDoc());publishFormat(update.state);if(update.docChanged||update.selectionSet)publishSelection(update.state)}),EditorView.domEventHandlers({paste,keydown:()=>{plainPaste=false},blur:()=>{plainPaste=false},scroll:()=>{const el=view!.scrollDOM;onscroll?.(el.scrollTop/Math.max(1,el.scrollHeight-el.clientHeight))}})]})})
  const plain=()=>{plainPaste=!!view?.hasFocus}
  window.addEventListener('freya-paste-plain',plain)
  publishFormat(view.state);publishSelection(view.state)
  return()=>{window.removeEventListener('freya-paste-plain',plain);view?.destroy()}
 })
 $effect(()=>{const locked=readonly;if(view)view.dispatch({effects:permission.reconfigure([EditorState.readOnly.of(locked),EditorView.editable.of(!locked)])})})
 $effect(()=>{const value=text;if(view&&value!==view.state.sliceDoc()){applying=true;view.dispatch({changes:{from:0,to:view.state.doc.length,insert:value}});applying=false}})
</script>
<div class="code-editor" bind:this={host} aria-label="Editor de texto"></div>
