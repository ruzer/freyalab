<script lang="ts">
 import {onMount} from 'svelte'
 import {EditorState,Compartment} from '@codemirror/state'
 import {EditorView,keymap,lineNumbers,highlightActiveLine,drawSelection} from '@codemirror/view'
 import {defaultKeymap,history,historyKeymap,undo,redo} from '@codemirror/commands'
 import {searchKeymap,highlightSelectionMatches,openSearchPanel} from '@codemirror/search'
 import {markdown} from '@codemirror/lang-markdown'
 import {syntaxHighlighting,defaultHighlightStyle} from '@codemirror/language'
 let {text='',readonly=false,kind='markdown',onchange,onscroll}: {text:string;readonly?:boolean;kind?:string;onchange:(text:string)=>void;onscroll?:(ratio:number)=>void}=$props()
 let host:HTMLDivElement
 let view:EditorView|undefined
 let applying=false
 const permission=new Compartment()
 export function undoEdit(){if(view) undo(view)}
 export function redoEdit(){if(view) redo(view)}
 export function search(){if(view) openSearchPanel(view)}
 onMount(()=>{
  view=new EditorView({parent:host,state:EditorState.create({doc:text,extensions:[lineNumbers(),highlightActiveLine(),drawSelection(),history(),highlightSelectionMatches(),keymap.of([...defaultKeymap,...historyKeymap,...searchKeymap]),syntaxHighlighting(defaultHighlightStyle),...(kind==='markdown'?[markdown()]:[]),EditorView.lineWrapping,permission.of([EditorState.readOnly.of(readonly),EditorView.editable.of(!readonly)]),EditorView.theme({'&':{height:'100%',fontSize:'13px'},'.cm-scroller':{fontFamily:'"JetBrains Mono", monospace',lineHeight:'1.8'},'.cm-content':{padding:'20px 0'},'.cm-gutters':{backgroundColor:'transparent',color:'var(--muted)',borderRight:'1px solid var(--border)'},'.cm-activeLine':{backgroundColor:'var(--hover)'},'.cm-activeLineGutter':{backgroundColor:'var(--hover)'},'.cm-cursor':{borderLeftColor:'var(--text)'},'.cm-selectionBackground, &.cm-focused .cm-selectionBackground':{backgroundColor:'#007aff35'},'.cm-panels':{backgroundColor:'var(--panel)',color:'var(--text)'},'.cm-search input':{color:'var(--text)'}}),EditorView.updateListener.of(update=>{if(update.docChanged&&!applying) onchange(update.state.doc.toString())}),EditorView.domEventHandlers({scroll:()=>{const el=view!.scrollDOM;onscroll?.(el.scrollTop/Math.max(1,el.scrollHeight-el.clientHeight))}})]})})
  return()=>view?.destroy()
 })
 $effect(()=>{const locked=readonly;if(view)view.dispatch({effects:permission.reconfigure([EditorState.readOnly.of(locked),EditorView.editable.of(!locked)])})})
 $effect(()=>{const value=text;if(view&&value!==view.state.doc.toString()){applying=true;view.dispatch({changes:{from:0,to:view.state.doc.length,insert:value}});applying=false}})
</script>
<div class="code-editor" bind:this={host} aria-label="Editor de texto"></div>
