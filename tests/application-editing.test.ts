import {afterEach,describe,expect,it,vi} from 'vitest'
import {EditorSelection,EditorState,Transaction,type TransactionSpec} from '@codemirror/state'
import {EditorView} from '@codemirror/view'
import {history} from '@codemirror/commands'
import {applicationEditingState,codeMirrorEditingState,routeApplicationEdit,runCodeMirrorEdit} from '../src/renderer/lib/application-editing'

const element=(tagName='DIV',isConnected=true,properties:Record<string,unknown>={})=>({tagName,isConnected,closest:()=>null,matches:()=>false,getAttribute:()=>null,...properties}) as unknown as HTMLElement
function editor(doc='Texto á🐶',options:{readonly?:boolean;editable?:boolean;history?:boolean}={}){
 const target=element()
 let state=EditorState.create({doc,extensions:[...(options.history===false?[]:[history()]),EditorState.allowMultipleSelections.of(true),EditorState.readOnly.of(!!options.readonly),EditorView.editable.of(options.editable!==false)]})
 const view={get state(){return state},contentDOM:{contains:(node:HTMLElement)=>node===target},focus:vi.fn(),dispatch:vi.fn((transaction:Transaction|TransactionSpec)=>{state=transaction instanceof Transaction?transaction.state:state.update(transaction).state})}
 const find=vi.spyOn(EditorView,'findFromDOM').mockReturnValue(view as unknown as EditorView)
 return{target,view,find}
}
afterEach(()=>vi.restoreAllMocks())

describe('APP-01 M5 · adaptador de CodeMirror',()=>{
 it('no actúa sin elemento ni con un elemento desconectado',()=>{
  const {find}=editor()
  for(const target of [null,element('DIV',false)]){expect(codeMirrorEditingState(target)).toBeNull();expect(runCodeMirrorEdit('edit.undo',target)).toBeNull()}
  expect(find).not.toHaveBeenCalled()
 })
 it.each(['INPUT','TEXTAREA','SELECT','BUTTON'])('delega %s al control nativo, incluido Buscar dentro del editor',tag=>{
  const {find}=editor(),target=element(tag)
  expect(codeMirrorEditingState(target)).toBeNull();expect(runCodeMirrorEdit('edit.undo',target)).toBeNull();expect(find).not.toHaveBeenCalled()
 })
 it('delega un elemento que no pertenece a CodeMirror',()=>{
  vi.spyOn(EditorView,'findFromDOM').mockReturnValue(null)
  expect(codeMirrorEditingState(element())).toBeNull();expect(runCodeMirrorEdit('edit.undo',element())).toBeNull()
 })
 it('no confunde paneles o gutters con el contenido editable',()=>{
  const {find}=editor(),panel=element()
  expect(codeMirrorEditingState(panel)).toBeNull();expect(runCodeMirrorEdit('edit.undo',panel)).toBeNull();expect(find).toHaveBeenCalledWith(panel)
 })
 it.each(['edit.copy','edit.cut','edit.paste','edit.pastePlain','constructor','__proto__','file.save'])('no captura el ID %s ni introduce una vía de portapapeles',id=>{
  const {target,view}=editor()
  expect(runCodeMirrorEdit(id,target)).toBeNull();expect(view.dispatch).not.toHaveBeenCalled();expect(view.focus).not.toHaveBeenCalled()
 })
 it('informa capacidades sin alterar texto, selección ni foco',()=>{
  const {target,view}=editor(),before=view.state
  expect(codeMirrorEditingState(target)).toEqual({editable:true,canUndo:false,canRedo:false,hasSelection:false});expect(view.state).toBe(before);expect(view.focus).not.toHaveBeenCalled();expect(view.dispatch).not.toHaveBeenCalled()
 })
 it('false significa editor reconocido sin historial: no delegar a undo nativo',()=>{
  const {target,view}=editor()
  expect(runCodeMirrorEdit('edit.undo',target)).toBe(false);expect(runCodeMirrorEdit('edit.redo',target)).toBe(false);expect(view.dispatch).not.toHaveBeenCalled();expect(view.focus).not.toHaveBeenCalled()
 })
 it.each([
  ['Markdown','# Título\nTexto á🐶'],['Mermaid','flowchart LR\n A --> B'],['SQL','SELECT ciudad, COUNT(*) FROM datos;'],
 ])('%s usa el historial real, un cambio reversible y devuelve el foco',(_kind,source)=>{
  const {target,view}=editor(source)
  view.dispatch({changes:{from:source.length,insert:'!'},userEvent:'input.type'});view.dispatch.mockClear()
  expect(codeMirrorEditingState(target)).toMatchObject({canUndo:true,canRedo:false})
  expect(runCodeMirrorEdit('edit.undo',target)).toBe(true);expect(view.state.sliceDoc()).toBe(source);expect(view.dispatch).toHaveBeenCalledTimes(1);expect(view.focus).toHaveBeenCalledTimes(1)
  expect(codeMirrorEditingState(target)).toMatchObject({canUndo:false,canRedo:true})
  expect(runCodeMirrorEdit('edit.redo',target)).toBe(true);expect(view.state.sliceDoc()).toBe(source+'!');expect(view.dispatch).toHaveBeenCalledTimes(2);expect(view.focus).toHaveBeenCalledTimes(2)
 })
 it('Seleccionar todo usa el comando existente sin modificar contenido ni historial',()=>{
  const {target,view}=editor()
  expect(runCodeMirrorEdit('edit.selectAll',target)).toBe(true);expect(view.state.selection.main.from).toBe(0);expect(view.state.selection.main.to).toBe(view.state.doc.length);expect(view.state.sliceDoc()).toBe('Texto á🐶');expect(view.dispatch).toHaveBeenCalledTimes(1);expect(view.focus).toHaveBeenCalledTimes(1);expect(codeMirrorEditingState(target)).toEqual({editable:true,canUndo:false,canRedo:false,hasSelection:true})
 })
 it.each([{readonly:true},{editable:false}])('bloquea mutaciones con %j y conserva selección/copia posible',options=>{
  const {target,view}=editor('Conservar',options)
  view.dispatch({changes:{from:0,insert:'!'}});view.dispatch.mockClear()
  expect(codeMirrorEditingState(target)).toMatchObject({editable:false,canUndo:false,canRedo:false})
  expect(runCodeMirrorEdit('edit.undo',target)).toBe(false);expect(runCodeMirrorEdit('edit.redo',target)).toBe(false);expect(view.dispatch).not.toHaveBeenCalled();expect(view.state.sliceDoc()).toBe('!Conservar')
  expect(runCodeMirrorEdit('edit.selectAll',target)).toBe(true);expect(view.state.selection.main.to).toBe(view.state.doc.length);expect(view.state.sliceDoc()).toBe('!Conservar')
 })
 it('detecta selección secundaria aunque el cursor principal esté vacío',()=>{
  const {target,view}=editor('abcdef')
  view.dispatch({selection:EditorSelection.create([EditorSelection.cursor(0),EditorSelection.range(2,4)],0)})
  expect(view.state.selection.main.empty).toBe(true);expect(codeMirrorEditingState(target)?.hasSelection).toBe(true)
 })
 it('no presupone que todo CodeMirror instala history()',()=>{
  const {target,view}=editor('Sin historial',{history:false})
  expect(codeMirrorEditingState(target)).toMatchObject({canUndo:false,canRedo:false});expect(runCodeMirrorEdit('edit.undo',target)).toBe(false);expect(runCodeMirrorEdit('edit.redo',target)).toBe(false);expect(view.state.sliceDoc()).toBe('Sin historial')
 })
 it('permite seleccionar un documento vacío sin inventar contenido',()=>{
  const {target,view}=editor('')
  expect(runCodeMirrorEdit('edit.selectAll',target)).toBe(true);expect(view.state.sliceDoc()).toBe('');expect(codeMirrorEditingState(target)?.hasSelection).toBe(false)
 })
})

describe('APP-01 M5 · ruta cerrada por foco',()=>{
 const hooks=()=>({grid:vi.fn(),delegate:vi.fn()})
 const field=(properties:Record<string,unknown>={})=>element('INPUT',true,{type:'text',readOnly:false,disabled:false,selectionStart:1,selectionEnd:3,...properties})
 it('distingue Markdown/Mermaid de SQL con el DOM de su contenedor',()=>{
  const {target}=editor()
  expect(applicationEditingState(target)).toMatchObject({focus:'editor',editable:true,canUndo:false,canRedo:false})
  target.closest=vi.fn().mockReturnValue(element())
  expect(applicationEditingState(target).focus).toBe('sql');expect(target.closest).toHaveBeenCalledWith('.sql-editor')
 })
 it('clasifica campo y celda por sus elementos reales, no por el documento activo',()=>{
  editor()
  expect(applicationEditingState(field())).toEqual({focus:'field',editable:true,hasSelection:true})
  const cell=field({matches:(selector:string)=>selector==='.cell-input',closest:(selector:string)=>selector==='.csv-scroll[role="grid"]'?element():null})
  expect(applicationEditingState(cell)).toEqual({focus:'cell',editable:true,hasSelection:true})
 })
 it('grilla conserva capacidades desconocidas hasta que su propietario las combine',()=>{
  vi.spyOn(EditorView,'findFromDOM').mockReturnValue(null)
  const grid=element(),target=element('DIV',true,{closest:()=>grid})
  expect(applicationEditingState(target)).toEqual({focus:'grid'})
 })
 it('sin campo ni grilla no ejecuta un comando de edición',()=>{
  vi.spyOn(EditorView,'findFromDOM').mockReturnValue(null);const h=hooks()
  expect(applicationEditingState(null)).toEqual({focus:'none'});expect(routeApplicationEdit('edit.undo',null,h)).toBe(false);expect(routeApplicationEdit('edit.selectAll',element('BUTTON'),h)).toBe(false);expect(h.grid).not.toHaveBeenCalled();expect(h.delegate).not.toHaveBeenCalled()
 })
 it.each(['edit.undo','edit.redo'])('%s reconocido por CM sin historial termina sin fallback nativo',id=>{
  const {target}=editor(),h=hooks()
  expect(routeApplicationEdit(id,target,h)).toBe(false);expect(h.grid).not.toHaveBeenCalled();expect(h.delegate).not.toHaveBeenCalled()
 })
 it('la ruta CM deshace/rehace/selecciona sin derivar y conserva el texto',()=>{
  const {target,view}=editor('Original'),h=hooks();view.dispatch({changes:{from:8,insert:'!'}})
  expect(routeApplicationEdit('edit.undo',target,h)).toBe(true);expect(view.state.sliceDoc()).toBe('Original');expect(routeApplicationEdit('edit.redo',target,h)).toBe(true);expect(view.state.sliceDoc()).toBe('Original!');expect(routeApplicationEdit('edit.selectAll',target,h)).toBe(true);expect(view.state.selection.main.to).toBe(9);expect(h.delegate).not.toHaveBeenCalled();expect(h.grid).not.toHaveBeenCalled()
 })
 it.each(['edit.undo','edit.redo','edit.copy','edit.cut','edit.paste','edit.pastePlain','edit.selectAll'])('%s en un campo sólo delega una vez sin verbo, texto ni argumentos',id=>{
  const h=hooks();expect(routeApplicationEdit(id,field(),h)).toBe(true);expect(h.delegate).toHaveBeenCalledExactlyOnceWith();expect(h.grid).not.toHaveBeenCalled()
 })
 it.each(['edit.copy','edit.cut','edit.paste','edit.pastePlain'])('%s de CM usa sólo el delegado acotado al comando',id=>{
  const {target}=editor(),h=hooks();expect(routeApplicationEdit(id,target,h)).toBe(true);expect(h.delegate).toHaveBeenCalledExactlyOnceWith();expect(h.grid).not.toHaveBeenCalled()
 })
 it.each([{readOnly:true},{disabled:true},{matches:(selector:string)=>selector===':disabled'}])('readonly/disabled nativo %j bloquea mutaciones y conserva copiar/seleccionar',properties=>{
  const target=field(properties),h=hooks();expect(applicationEditingState(target)).toMatchObject({editable:false})
  for(const id of ['edit.undo','edit.redo','edit.cut','edit.paste','edit.pastePlain'])expect(routeApplicationEdit(id,target,h)).toBe(false)
  expect(h.delegate).not.toHaveBeenCalled();expect(routeApplicationEdit('edit.copy',target,h)).toBe(true);expect(routeApplicationEdit('edit.selectAll',target,h)).toBe(true);expect(h.delegate).toHaveBeenCalledTimes(2)
 })
 it('CM de lectura impide pegar/cortar pero mantiene copia y selección',()=>{
  const {target,view}=editor('Conservar',{readonly:true}),h=hooks()
  for(const id of ['edit.cut','edit.paste','edit.pastePlain'])expect(routeApplicationEdit(id,target,h)).toBe(false)
  expect(h.delegate).not.toHaveBeenCalled();expect(routeApplicationEdit('edit.copy',target,h)).toBe(true);expect(routeApplicationEdit('edit.selectAll',target,h)).toBe(true);expect(view.state.sliceDoc()).toBe('Conservar');expect(h.delegate).toHaveBeenCalledTimes(1)
 })
 it.each(['checkbox','radio','range','file','button','submit','reset','image','color'])('un input %s no es un campo de texto ni toma el historial del documento',type=>{
  const target=field({type}),h=hooks();expect(applicationEditingState(target)).toEqual({focus:'none'});expect(routeApplicationEdit('edit.undo',target,h)).toBe(false);expect(h.delegate).not.toHaveBeenCalled();expect(h.grid).not.toHaveBeenCalled()
 })
 it.each(['edit.undo','edit.redo','edit.copy','edit.cut','edit.paste','edit.selectAll'])('%s sobre grilla usa exclusivamente el hook existente con ese ID',id=>{
  vi.spyOn(EditorView,'findFromDOM').mockReturnValue(null);const grid=element(),target=element('DIV',true,{closest:()=>grid}),h=hooks()
  expect(routeApplicationEdit(id,target,h)).toBe(true);expect(h.grid).toHaveBeenCalledExactlyOnceWith(id);expect(h.delegate).not.toHaveBeenCalled()
 })
 it('aria-readonly de grilla bloquea mutaciones sin bloquear copiar o seleccionar',()=>{
  vi.spyOn(EditorView,'findFromDOM').mockReturnValue(null);const grid=element('DIV',true,{getAttribute:(name:string)=>name==='aria-readonly'?'true':null}),target=element('DIV',true,{closest:()=>grid}),h=hooks()
  expect(applicationEditingState(target)).toEqual({focus:'grid',editable:false});expect(routeApplicationEdit('edit.cut',target,h)).toBe(false);expect(routeApplicationEdit('edit.copy',target,h)).toBe(true);expect(routeApplicationEdit('edit.selectAll',target,h)).toBe(true);expect(h.grid).toHaveBeenCalledTimes(2);expect(h.delegate).not.toHaveBeenCalled()
 })
 it('Pegar sin formato no inventa una operación de grilla',()=>{
  vi.spyOn(EditorView,'findFromDOM').mockReturnValue(null);const grid=element(),target=element('DIV',true,{closest:()=>grid}),h=hooks()
  expect(routeApplicationEdit('edit.pastePlain',target,h)).toBe(false);expect(h.grid).not.toHaveBeenCalled();expect(h.delegate).not.toHaveBeenCalled()
 })
 it.each(['constructor','edit.arbitrary','file.save'])('no deriva un ID fuera de la lista cerrada: %s',id=>{
  const h=hooks();expect(routeApplicationEdit(id,field(),h)).toBe(false);expect(h.delegate).not.toHaveBeenCalled();expect(h.grid).not.toHaveBeenCalled()
 })
})
