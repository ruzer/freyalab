import {undo,redo,selectAll,undoDepth,redoDepth} from '@codemirror/commands'
import {EditorView} from '@codemirror/view'

export interface CodeMirrorEditingCapabilities {
 editable:boolean;canUndo:boolean;canRedo:boolean;hasSelection:boolean
}

function editor(target:HTMLElement|null):EditorView|null{
 if(!target?.isConnected||['INPUT','TEXTAREA','SELECT','BUTTON'].includes(target.tagName))return null
 const view=EditorView.findFromDOM(target)
 return view?.contentDOM.contains(target)?view:null
}
const editable=(view:EditorView)=>!view.state.readOnly&&view.state.facet(EditorView.editable)

export function codeMirrorEditingState(target:HTMLElement|null):CodeMirrorEditingCapabilities|null{
 const view=editor(target);if(!view)return null
 const allowed=editable(view)
 return{editable:allowed,canUndo:allowed&&undoDepth(view.state)>0,canRedo:allowed&&redoDepth(view.state)>0,hasSelection:view.state.selection.ranges.some(range=>!range.empty)}
}

// null delega; false reconoce el editor y evita caer al historial nativo.
export function runCodeMirrorEdit(id:string,target:HTMLElement|null):boolean|null{
 const run=id==='edit.undo'?undo:id==='edit.redo'?redo:id==='edit.selectAll'?selectAll:null
 if(!run)return null
 const view=editor(target);if(!view)return null
 if(id!=='edit.selectAll'&&!editable(view))return false
 const handled=run(view)
 if(handled)view.focus()
 return handled
}

export interface ApplicationEditingCapabilities {
 focus:'none'|'editor'|'sql'|'field'|'cell'|'grid'
 editable?:boolean;canUndo?:boolean;canRedo?:boolean;hasSelection?:boolean
}
export type ApplicationEditCommand='edit.undo'|'edit.redo'|'edit.copy'|'edit.cut'|'edit.paste'|'edit.pastePlain'|'edit.selectAll'
const commands=new Set<string>(['edit.undo','edit.redo','edit.copy','edit.cut','edit.paste','edit.pastePlain','edit.selectAll'])
const mutation=(id:string)=>!['edit.copy','edit.selectAll'].includes(id)

export function applicationEditingState(target:HTMLElement|null):ApplicationEditingCapabilities{
 if(!target?.isConnected)return{focus:'none'}
 if(target.tagName==='INPUT'||target.tagName==='TEXTAREA'){
  if(target.tagName==='INPUT'&&['checkbox','radio','range','file','button','submit','reset','image','color'].includes((target as HTMLInputElement).type))return{focus:'none'}
  const field=target as HTMLInputElement|HTMLTextAreaElement,start=field.selectionStart,end=field.selectionEnd
  return{focus:target.matches('.cell-input')&&target.closest('.csv-scroll[role="grid"]')?'cell':'field',editable:!field.readOnly&&!field.disabled&&!target.matches(':disabled'),...(typeof start==='number'&&typeof end==='number'?{hasSelection:start!==end}:{})}
 }
 const cm=codeMirrorEditingState(target)
 if(cm)return{focus:target.closest('.sql-editor')?'sql':'editor',...cm}
 const grid=target.closest('.csv-scroll[role="grid"]')
 if(grid)return{focus:'grid',...(grid.getAttribute('aria-readonly')==='true'||grid.getAttribute('aria-disabled')==='true'?{editable:false}:{})}
 return{focus:'none'}
}

export function routeApplicationEdit(id:string,target:HTMLElement|null,hooks:{grid:(id:ApplicationEditCommand)=>void;delegate:()=>void}):boolean{
 if(!commands.has(id))return false
 const state=applicationEditingState(target)
 if(state.focus==='none'||mutation(id)&&state.editable===false)return false
 if(state.focus==='grid'){
  if(id==='edit.pastePlain')return false
  hooks.grid(id as ApplicationEditCommand);return true
 }
 if(state.focus==='editor'||state.focus==='sql'){
  const result=runCodeMirrorEdit(id,target)
  if(result!==null)return result
 }
 hooks.delegate();return true
}
