<script lang="ts">
 import {onMount} from 'svelte'
 import {EditorState,EditorSelection,Compartment} from '@codemirror/state'
 import {EditorView,keymap,lineNumbers,highlightActiveLine,drawSelection} from '@codemirror/view'
 import {defaultKeymap,history,historyKeymap,undo,redo,isolateHistory} from '@codemirror/commands'
 import {searchKeymap,highlightSelectionMatches,openSearchPanel} from '@codemirror/search'
 import {markdown} from '@codemirror/lang-markdown'
 import {syntaxHighlighting,defaultHighlightStyle} from '@codemirror/language'
 let {text='',readonly=false,kind='markdown',label='Editor de texto',onchange,onscroll}: {text:string;label?:string;readonly?:boolean;kind?:string;onchange:(text:string)=>void;onscroll?:(ratio:number)=>void}=$props()
 let host:HTMLDivElement
 let view:EditorView|undefined
 let applying=false
 const permission=new Compartment()
 function toggleFormat(view:EditorView,marker:string){
  if(kind!=='markdown'||view.state.readOnly)return false
  const {from,to}=view.state.selection.main,selected=view.state.sliceDoc(from,to),size=marker.length
  let start=from,end=to,insert=marker+selected+marker,selectionFrom=from+size,selectionTo=to+size
  if(selected.length>=size*2&&selected.startsWith(marker)&&selected.endsWith(marker)){insert=selected.slice(size,-size);selectionFrom=from;selectionTo=to-size*2}
  else if(from>=size&&view.state.sliceDoc(from-size,from)===marker&&view.state.sliceDoc(to,to+size)===marker){start=from-size;end=to+size;insert=selected;selectionFrom=from-size;selectionTo=to-size}
  view.dispatch({annotations:isolateHistory.of('full'),changes:{from:start,to:end,insert},selection:EditorSelection.range(selectionFrom,selectionTo),scrollIntoView:true,userEvent:'input'})
  return true
 }
 export function format(action:'bold'|'italic'|'inline'|'task'|'table'|'mermaid'|'code'|'heading'|'list'|'quote'|'link'){
  if(!view||kind!=='markdown'||readonly||view.state.readOnly)return
  if(action==='bold'||action==='italic'||action==='inline'){
   toggleFormat(view,action==='bold'?'**':action==='italic'?'*':'`');view.focus();return
  }
  const {from,to}=view.state.selection.main,selected=view.state.sliceDoc(from,to)
  let insert='',cursor=0
  switch(action){
   case'task':insert=(selected||'Nueva tarea').split('\n').map(line=>'- [ ] '+line).join('\n');cursor=6;break
   case'table':insert='| Columna 1 | Columna 2 |\n| --- | --- |\n| Dato 1 | Dato 2 |';cursor=2;break
   case'mermaid':insert='```mermaid\nflowchart LR\n  A[Inicio] --> B[Proceso]\n  B --> C[Fin]\n```';cursor=11;break
   case'code':{let fence='```';for(const match of selected.matchAll(/`+/g))if(match[0].length>=fence.length)fence='`'.repeat(match[0].length+1);insert=fence+'text\n'+(selected||'Escribe tu código aquí')+'\n'+fence;cursor=fence.length+5;break}
   case'heading':insert='## '+(selected||'Título');cursor=3;break
   case'list':insert=(selected||'Elemento').split('\n').map(line=>'- '+line).join('\n');cursor=2;break
   case'quote':insert=(selected||'Cita').split('\n').map(line=>'> '+line).join('\n');cursor=2;break
   case'link':insert='['+(selected||'Texto del enlace')+'](https://ejemplo.com)';cursor=insert.indexOf('https://');break
  }
  const before=view.state.sliceDoc(0,from),after=view.state.sliceDoc(to)
  const prefix=action==='link'||!before?'':before.endsWith('\n\n')?'':before.endsWith('\n')?'\n':'\n\n'
  const suffix=action==='link'||!after?'':after.startsWith('\n\n')?'':after.startsWith('\n')?'\n':'\n\n'
  view.dispatch({changes:{from,to,insert:prefix+insert+suffix},selection:EditorSelection.cursor(from+prefix.length+cursor),annotations:isolateHistory.of('full'),scrollIntoView:true,userEvent:'input'})
  view.focus()
 }
 export function undoEdit(){if(view) undo(view)}
 export function redoEdit(){if(view) redo(view)}
 export function search(){if(view) openSearchPanel(view)}
 onMount(()=>{
  view=new EditorView({parent:host,state:EditorState.create({doc:text,extensions:[EditorView.contentAttributes.of({'aria-label':label}),lineNumbers(),highlightActiveLine(),drawSelection(),history(),highlightSelectionMatches(),keymap.of([{key:'Mod-b',run:view=>kind!=='sql'&&toggleFormat(view,'**')},{key:'Mod-i',run:view=>kind!=='sql'&&toggleFormat(view,'*')},...defaultKeymap,...historyKeymap,...searchKeymap]),syntaxHighlighting(defaultHighlightStyle),...(kind==='markdown'?[markdown()]:[]),EditorView.lineWrapping,permission.of([EditorState.readOnly.of(readonly),EditorView.editable.of(!readonly)]),EditorView.theme({'&':{height:'100%',fontSize:'13px'},'.cm-scroller':{fontFamily:'"JetBrains Mono", monospace',lineHeight:'1.8'},'.cm-content':{padding:'20px 0'},'.cm-gutters':{backgroundColor:'transparent',color:'var(--muted)',borderRight:'1px solid var(--border)'},'.cm-activeLine':{backgroundColor:'var(--hover)'},'.cm-activeLineGutter':{backgroundColor:'var(--hover)'},'.cm-cursor':{borderLeftColor:'var(--text)'},'.cm-selectionBackground, &.cm-focused .cm-selectionBackground':{backgroundColor:'#007aff35'},'.cm-panels':{backgroundColor:'var(--panel)',color:'var(--text)'},'.cm-search input':{color:'var(--text)'}}),EditorView.updateListener.of(update=>{if(update.docChanged&&!applying) onchange(update.state.doc.toString())}),EditorView.domEventHandlers({scroll:()=>{const el=view!.scrollDOM;onscroll?.(el.scrollTop/Math.max(1,el.scrollHeight-el.clientHeight))}})]})})
  return()=>view?.destroy()
 })
 $effect(()=>{const locked=readonly;if(view)view.dispatch({effects:permission.reconfigure([EditorState.readOnly.of(locked),EditorView.editable.of(!locked)])})})
 $effect(()=>{const value=text;if(view&&value!==view.state.doc.toString()){applying=true;view.dispatch({changes:{from:0,to:view.state.doc.length,insert:value}});applying=false}})
</script>
<div class="code-editor" bind:this={host} aria-label="Editor de texto"></div>
