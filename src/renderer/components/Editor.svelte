<script lang="ts">
 import {onMount} from 'svelte'
 import {EditorState,EditorSelection,Compartment,Text,Transaction} from '@codemirror/state'
 import {EditorView,keymap,lineNumbers,highlightActiveLine,drawSelection,scrollPastEnd,highlightWhitespace} from '@codemirror/view'
 import {defaultKeymap,history,historyKeymap,undo,redo,isolateHistory} from '@codemirror/commands'
 import {searchKeymap,highlightSelectionMatches,openSearchPanel,gotoLine} from '@codemirror/search'
 import {csvTextDocument,csvTextValue,csvTextRange,replaceCsvText,insertCsvText} from '../lib/csv-text-model'
 import {t} from '../lib/i18n.svelte'
 import {markdown} from '@codemirror/lang-markdown'
 import {syntaxHighlighting,defaultHighlightStyle,syntaxTree,syntaxTreeAvailable,forceParsing} from '@codemirror/language'
 import {editorHeadings,type EditorHeading} from '../lib/outline'
 import {markdownDiagramBlocks,type DiagramBlock} from '../lib/diagram-diagnostics'
 import {diagramMarkExtensions,setDiagramMarks,type DiagramDiagnostics} from '../lib/diagram-marks'
 import type {MarkdownSession} from '../lib/markdown-tasks'
 import {markdownCommands,lineFormatState,type MarkdownAction,type CodeLanguage} from '../lib/markdown-commands'
 import type {TextSelection} from '../lib/text-stats'
 import {markdownLinkOnPaste} from '../lib/markdown-paste'
 let {text='',readonly=false,kind='markdown',label='Editor de texto',wrapLines=true,showWhitespace=false,onchange,onscroll,onformatstate,onselection,session,ontransactions,outlineEnabled=false,onoutline,oncurrentline,onblocks}: {onblocks?:(blocks:DiagramBlock[],source:string,complete:boolean)=>void;outlineEnabled?:boolean;onoutline?:(headings:EditorHeading[],source:string)=>void;oncurrentline?:(from:number)=>void;session?:MarkdownSession;ontransactions?:(transactions:readonly Transaction[])=>void;text:string;label?:string;readonly?:boolean;kind?:string;wrapLines?:boolean;showWhitespace?:boolean;onchange:(text:string)=>void;onscroll?:(ratio:number)=>void;onformatstate?:(state:ReturnType<typeof lineFormatState>)=>void;onselection?:(selection:TextSelection|null)=>void}=$props()
 let host:HTMLDivElement
 let view:EditorView|undefined
 let mountedSession:MarkdownSession|undefined
 let applying=false
 let plainPaste=false,diagnosticSummary=$state(''),generalDiagramError=$state(false)
 const permission=new Compartment()
 const textDisplay=new Compartment()
 function displayExtensions(wrap:boolean,spaces:boolean){return[
  ...(wrap?[EditorView.lineWrapping]:[]),...(spaces?[highlightWhitespace()]:[]),
  ...(kind==='csv-text'?[EditorState.phrases.of({
   'Find':t('csvText.cm.find'),'Replace':t('csvText.cm.replaceField'),'next':t('csvText.cm.next'),'previous':t('csvText.cm.previous'),'all':t('csvText.cm.all'),
   'match case':t('csvText.cm.case'),'regexp':t('csvText.cm.regexp'),'by word':t('csvText.cm.word'),'replace':t('csvText.cm.replace'),'replace all':t('csvText.cm.replaceAll'),'close':t('csvText.cm.close'),
   'Go to line':t('csvText.goto'),'go':t('csvText.cm.go'),'replaced match on line $':t('csvText.cm.replacedLine'),'replaced $ matches':t('csvText.cm.replacedCount'),'current match':t('csvText.cm.current'),'on line':t('csvText.cm.onLine')
  })]:[])
 ]}
 // El margen del documento también necesita espacio para alinear su última línea.
 const outlinePadding=new Compartment()
 let outlineIdle=0,lastOutlineTree:ReturnType<typeof syntaxTree>|undefined,lastOutlineDoc:EditorState['doc']|undefined,lastVisibleLine=-1
 const lineMeasureKey={}
 function publishVisibleLine(){
  if(!view||!outlineEnabled)return
  const owner=view,doc=owner.state.doc
  owner.requestMeasure({key:lineMeasureKey,read:()=>{
   if(!outlineEnabled||owner!==view||!owner.scrollDOM.clientHeight)return
   const top=owner.scrollDOM.getBoundingClientRect().top+owner.scrollDOM.clientTop
   return owner.state.doc.lineAt(owner.lineBlockAtHeight(Math.max(0,top-owner.documentTop)).from).from
  },write:from=>{if(from!==undefined&&outlineEnabled&&owner===view&&doc===owner.state.doc&&from!==lastVisibleLine){lastVisibleLine=from;oncurrentline?.(from)}}})
 }
 function cancelOutline(){cancelIdleCallback(outlineIdle);outlineIdle=0}
 function publishOutline(){
  if(!view||kind!=='markdown'||(!outlineEnabled&&!onblocks))return
  const tree=syntaxTree(view.state),doc=view.state.doc
  if(tree!==lastOutlineTree||doc!==lastOutlineDoc){
   lastOutlineTree=tree;lastOutlineDoc=doc
   const state=view.state
   if(outlineEnabled){const result=editorHeadings(state);onoutline?.(result.headings.map(heading=>({...heading,from:state.doc.lineAt(heading.from).from})),result.complete?state.sliceDoc():'')}
   const diagrams=markdownDiagramBlocks(state);onblocks?.(diagrams.blocks,state.sliceDoc(),diagrams.complete)
  }
  if(!syntaxTreeAvailable(view.state,doc.length)&&!outlineIdle&&!isComposing())outlineIdle=requestIdleCallback(()=>{
   outlineIdle=0
   if(!view||(!outlineEnabled&&!onblocks)||isComposing())return
   // shortcut: presupuesto cooperativo; revisar si un paso indivisible bloquea documentos grandes.
   forceParsing(view,view.state.doc.length,10);publishOutline()
  })
 }
 export function setDiagnostics(value:DiagramDiagnostics){if(!view||value.source!==view.state.sliceDoc())return;view.dispatch({effects:setDiagramMarks.of(value),annotations:Transaction.addToHistory.of(false)});generalDiagramError=(value.errors??[]).some(error=>!value.marks.some(mark=>mark.error===error));diagnosticSummary=(value.errors??[]).map(error=>{const mark=value.marks.find(mark=>mark.error===error);return `${mark?`Línea ${mark.line}. `:''}${error.title} ${error.hint}`}).join(' ')}
 export function isComposing(){return !!view&&(view.composing||view.compositionStarted)}
 export function goToHeading(from:number,source:string){
  if(!view||isComposing()||!Number.isInteger(from)||from<0||from>view.state.doc.length||view.state.sliceDoc()!==source||!syntaxTreeAvailable(view.state,view.state.doc.length))return false
  const position=view.state.doc.lineAt(from).from
  view.dispatch({selection:EditorSelection.cursor(position),effects:EditorView.scrollIntoView(position,{y:'start',yMargin:0}),annotations:Transaction.addToHistory.of(false)});view.focus();return true
 }
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
  const now=action==='date'||action==='datetime'?new Date():undefined
  const result=markdownCommands[action](view.state.doc.toString(),view.state.selection.main,language,now)
  view.dispatch({changes:result.changes.map(change=>({...change,insert:Text.of(change.insert.split('\n'))})),selection:EditorSelection.range(result.selection.anchor,result.selection.head),annotations:isolateHistory.of('full'),scrollIntoView:true,userEvent:'input'})
  view.focus()
 }
 function shortcut(action:MarkdownAction){return()=>{if(kind!=='markdown'||!view)return false;if(!view.composing&&!view.compositionStarted)format(action);return true}}
 export function undoEdit(){if(view) undo(view)}
 export function redoEdit(){if(view) redo(view)}
 export function focus(){view?.focus()}
 export function search(){if(view) openSearchPanel(view)}
 export function goToLine(){if(view)gotoLine(view)}
 export function goToPhysicalLine(line:number){
  if(!view||!Number.isSafeInteger(line)||line<1||line>view.state.doc.lines||isComposing())return false
  const position=view.state.doc.line(line).from
  view.dispatch({selection:EditorSelection.cursor(position),effects:EditorView.scrollIntoView(position,{y:'center'}),annotations:Transaction.addToHistory.of(false)});view.focus();return true
 }
 function clipboard(event:ClipboardEvent,cut=false){
  if(kind!=='csv-text'||!view||!event.clipboardData)return false
  const state=view.state,ranges=state.selection.ranges.filter(range=>!range.empty)
  if(!ranges.length)return false
  event.clipboardData.setData('text/plain',ranges.map(range=>csvTextRange(state,range.from,range.to)).join('\n'));event.preventDefault()
  if(cut&&!readonly&&!state.readOnly)view.dispatch({...state.changeByRange(range=>({changes:{from:range.from,to:range.to},range:EditorSelection.cursor(range.from)})),annotations:isolateHistory.of('full'),userEvent:'delete.cut'})
  return true
 }
 function paste(event:ClipboardEvent,view:EditorView){
  const plain=plainPaste;plainPaste=false
  if(kind==='csv-text'&&!readonly&&!view.state.readOnly&&event.clipboardData){view.dispatch({...insertCsvText(view.state,event.clipboardData.getData('text/plain')),annotations:isolateHistory.of('full'),scrollIntoView:true});return true}
  if(kind!=='markdown'||readonly||view.state.readOnly||plain||view.composing||view.compositionStarted)return false
  const result=markdownLinkOnPaste(view.state,event.clipboardData?.getData('text/plain')??'')
  if(!result)return false
  view.dispatch({changes:result.changes,selection:EditorSelection.range(result.selection.anchor,result.selection.head),annotations:isolateHistory.of('full'),scrollIntoView:true,userEvent:'input.paste'})
  return true
 }
 onMount(()=>{
  const sessionAtMount=session,dispatch=ontransactions;mountedSession=sessionAtMount
  const csv=kind==='csv-text'?csvTextDocument(text):undefined
  const extensions=[...(csv?.extensions??[]),textDisplay.of(displayExtensions(wrapLines,showWhitespace)),...((kind==='markdown'||kind==='mermaid')&&text.includes('\r\n')&&!sessionAtMount?[EditorState.lineSeparator.of('\r\n')]:[]),EditorView.contentAttributes.of({'aria-label':label}),lineNumbers(),(['markdown','mermaid'].includes(kind)?diagramMarkExtensions:[]),outlinePadding.of(outlineEnabled?[scrollPastEnd(),EditorView.theme({'.cm-scroller':{paddingBottom:'1lh'}})]:[]),highlightActiveLine(),drawSelection(),...(!sessionAtMount?[history()]:[]),highlightSelectionMatches(),keymap.of([{key:'Mod-b',run:shortcut('bold')},{key:'Mod-i',run:shortcut('italic')},{key:'Mod-Shift-x',run:shortcut('strike')},...(['paragraph','heading1','heading2','heading3'] as const).map((action,index)=>({key:`Mod-Alt-${index}`,run:shortcut(action)})),...defaultKeymap,...historyKeymap,...searchKeymap]),syntaxHighlighting(defaultHighlightStyle),...(kind==='markdown'?[markdown({pasteURLAsLink:false})]:[]),permission.of([EditorState.readOnly.of(readonly),EditorView.editable.of(!readonly)]),EditorView.theme({'&':{height:'100%',fontSize:'13px'},'.cm-scroller':{fontFamily:'"JetBrains Mono", monospace',lineHeight:'1.8'},'.cm-content':{padding:'20px 0'},'.cm-gutters':{backgroundColor:'transparent',color:'var(--muted)',borderRight:'1px solid var(--border)'},'.cm-activeLine':{backgroundColor:'var(--hover)'},'.cm-activeLineGutter':{backgroundColor:'var(--hover)'},'.cm-cursor':{borderLeftColor:'var(--text)'},'.cm-selectionBackground, &.cm-focused .cm-selectionBackground':{backgroundColor:'#007aff35'},'.cm-panels':{backgroundColor:'var(--panel)',color:'var(--text)'},'.cm-search input':{color:'var(--text)'}}),EditorView.updateListener.of(update=>{if(update.docChanged){diagnosticSummary='';generalDiagramError=false;cancelOutline();if(!applying&&!sessionAtMount)onchange(csv?csvTextValue(update.state):update.state.sliceDoc())}publishFormat(update.state);if(update.docChanged||update.selectionSet)publishSelection(update.state);if(update.docChanged||syntaxTree(update.startState)!==syntaxTree(update.state))publishOutline();if(update.geometryChanged||update.viewportChanged)publishVisibleLine()}),EditorView.domEventHandlers({paste,copy:event=>clipboard(event),cut:event=>clipboard(event,true),keydown:()=>{plainPaste=false},blur:()=>{plainPaste=false},scroll:()=>{const el=view!.scrollDOM;onscroll?.(el.scrollTop/Math.max(1,el.scrollHeight-el.clientHeight));publishVisibleLine()},compositionstart:()=>{cancelOutline()},compositionend:()=>{queueMicrotask(publishOutline)}})]
  if(sessionAtMount&&dispatch)dispatch([sessionAtMount.state.update({effects:sessionAtMount.ui.reconfigure(extensions)})])
  view=new EditorView({parent:host,state:sessionAtMount?.state??EditorState.create({doc:csv?.doc??text,extensions}),...(sessionAtMount&&dispatch?{dispatchTransactions:dispatch}:{})})
  if(sessionAtMount)sessionAtMount.receive=transactions=>view?.update(transactions)
  const plain=()=>{plainPaste=!!view?.hasFocus}
  window.addEventListener('freya-paste-plain',plain)
  publishFormat(view.state);publishSelection(view.state);publishOutline();publishVisibleLine()
  return()=>{cancelOutline();window.removeEventListener('freya-paste-plain',plain);if(sessionAtMount){sessionAtMount.receive=undefined;dispatch?.([sessionAtMount.state.update({effects:sessionAtMount.ui.reconfigure([])})])}view?.destroy();view=undefined}
 })
 $effect(()=>{const enabled=outlineEnabled;cancelOutline();lastOutlineTree=undefined;lastOutlineDoc=undefined;lastVisibleLine=-1;if(view)view.dispatch({effects:outlinePadding.reconfigure(enabled?[scrollPastEnd(),EditorView.theme({'.cm-scroller':{paddingBottom:'1lh'}})]:[])});publishOutline();if(enabled)publishVisibleLine()})
 $effect(()=>{const locked=readonly;if(view)view.dispatch({effects:permission.reconfigure([EditorState.readOnly.of(locked),EditorView.editable.of(!locked)])})})
 $effect(()=>{const value=text;if(view&&!mountedSession&&value!==(kind==='csv-text'?csvTextValue(view.state):view.state.sliceDoc())){applying=true;view.dispatch(kind==='csv-text'?replaceCsvText(view.state,0,view.state.doc.length,value):{changes:{from:0,to:view.state.doc.length,insert:value}});applying=false}})
 $effect(()=>{const wrap=wrapLines,spaces=showWhitespace;if(view)view.dispatch({effects:textDisplay.reconfigure(displayExtensions(wrap,spaces))})})
</script>
{#if kind==='markdown'||kind==='mermaid'}<span class:sr-only={!generalDiagramError} class="diagram-editor-notice" role="status" aria-label="Diagnósticos de diagramas" aria-live="polite">{diagnosticSummary}</span>{/if}
<div class="code-editor" bind:this={host} aria-label="Editor de texto"></div>

<style>
 .diagram-editor-notice:not(.sr-only){padding:6px 10px;font-size:12px;background:var(--panel);color:var(--text);border-bottom:1px solid var(--border)}
 .code-editor{--diagram-error-bg:#fff0eb;--diagram-error-ink:#8a240b}
 :global(.dark) .code-editor{--diagram-error-bg:#44251e;--diagram-error-ink:#ffd0c1}
</style>
