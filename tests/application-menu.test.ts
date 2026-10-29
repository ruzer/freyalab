import {describe,it,expect,afterEach} from 'vitest'
import {setLanguage} from '../src/shared/i18n'
import {applicationMenu,applicationCommands,type ApplicationMenuContext} from '../src/main/application-menu'

const base:ApplicationMenuContext={documents:[],recents:[],activeId:null,mode:'split',theme:'system',sidebar:true,focus:'none',locked:false,development:false}
function flatten(items:ReturnType<typeof applicationMenu>):ReturnType<typeof applicationMenu>{return items.flatMap(item=>[item,...(Array.isArray(item.submenu)?flatten(item.submenu):[])])}
afterEach(()=>setLanguage('es'))
describe('APP-01 · un menú propio desde una sola tabla',()=>{
 it.each(['darwin','win32','linux'] as const)('ofrece Archivo, Edición, Ver, Ir, Ventana y Ayuda en %s',platform=>{
  const items=applicationMenu(base,()=>{},platform)
  expect(items.map(item=>item.label)).toEqual(platform==='darwin'?['FreyaLab','Archivo','Edición','Ver','Ir','Ventana','Ayuda']:['Archivo','Edición','Ver','Ir','Ventana','Ayuda'])
 })
 it('el paquete no expone recarga ni herramientas de desarrollo por omisión',()=>{
  const items=flatten(applicationMenu(base,()=>{},'darwin'))
  expect(items.some(item=>['reload','forceReload','toggleDevTools'].includes(String(item.role)))).toBe(false)
  expect(items.some(item=>/Reload|Developer Tools|Recargar|desarrollo/i.test(item.label??''))).toBe(false)
 })
 it('deshacer y rehacer no usan roles del sistema',()=>{
  const items=flatten(applicationMenu({...base,focus:'field'},()=>{},'darwin'))
  expect(items.find(item=>item.id==='edit.undo')).toMatchObject({label:'Deshacer'})
  expect(items.find(item=>item.id==='edit.redo')).toMatchObject({label:'Rehacer'})
  expect(items.filter(item=>['edit.undo','edit.redo'].includes(item.id??'')).every(item=>item.role===undefined)).toBe(true)
 })
 it('las etiquetas cambian a inglés sin alterar los identificadores de comandos',()=>{
  const spanish=flatten(applicationMenu(base,()=>{},'darwin')).map(item=>item.id).filter(Boolean)
  setLanguage('en')
  const items=applicationMenu(base,()=>{},'darwin')
  expect(items.map(item=>item.label)).toEqual(['FreyaLab','File','Edit','View','Go','Window','Help'])
  expect(flatten(items).map(item=>item.id).filter(Boolean)).toEqual(spanish)
 })
 it('los identificadores y atajos de la tabla no se duplican',()=>{
  expect(new Set(applicationCommands.map(command=>command.id)).size).toBe(applicationCommands.length)
  const shortcuts=applicationCommands.map(command=>command.accelerator).filter(Boolean)
  expect(new Set(shortcuts).size).toBe(shortcuts.length)
 })
})

describe('APP-01 · decisión M6 y estado seguro por contexto',()=>{
 it('los modos Markdown conservan sus opciones sin ocupar 1, 2 o 3',()=>{
  const commands=applicationCommands.filter(command=>command.id.startsWith('view.mode.'))
  expect(commands).toHaveLength(3)
  expect(commands.every(command=>!command.accelerator)).toBe(true)
 })
 it('no registra el atajo de barra lateral mientras pertenece a negrita en Markdown',()=>{
  const context={...base,activeId:'a',documents:[{id:'a',name:'nota.md',kind:'markdown' as const,readonly:false,dirty:false}],focus:'editor' as const}
  expect(flatten(applicationMenu(context,()=>{},'darwin')).find(item=>item.id==='view.sidebar')?.accelerator).toBeUndefined()
  expect(flatten(applicationMenu({...context,focus:'none'},()=>{},'darwin')).find(item=>item.id==='view.sidebar')?.accelerator).toBe('CommandOrControl+B')
 })
 it('guardar, exportar y cerrar distinguen ausencia, muestra y documento editable',()=>{
  const item=(context:ApplicationMenuContext,id:string)=>flatten(applicationMenu(context,()=>{},'linux')).find(item=>item.id===id)
  expect(item(base,'file.save')?.enabled).toBe(false)
  const doc={id:'a',name:'nota.md',kind:'markdown' as const,readonly:true,dirty:false},context={...base,activeId:'a',documents:[doc]}
  expect(item(context,'file.save')?.enabled).toBe(false);expect(item(context,'file.close')?.enabled).toBe(true);expect(item(context,'file.exports')?.enabled).toBe(false)
  expect(item({...context,documents:[{...doc,readonly:false}]},'file.save')?.enabled).toBe(true)
 })
 it.each(['markdown','mermaid','csv','text'] as const)('los formatos del menú corresponden a %s',kind=>{
  const context={...base,activeId:'a',documents:[{id:'a',name:'archivo',kind,readonly:false,dirty:false}]}
  const menu=flatten(applicationMenu(context,()=>{},'linux')),parent=menu.find(item=>item.id==='file.exports')
  const formats=Array.isArray(parent?.submenu)?parent.submenu.map(item=>item.id):[]
  expect(formats).toEqual(kind==='markdown'?['export.pdf','export.html']:kind==='mermaid'?['export.svg','export.png','export.pdf']:kind==='csv'?['export.csv','export.tsv']:[])
 })
 it('no registra Ir a la fila en Markdown ni ofrece edición tabular a CSV Texto',()=>{
  for(const doc of [{id:'a',name:'nota.md',kind:'markdown' as const,readonly:false,dirty:false},{id:'a',name:'tabla.csv',kind:'csv' as const,csvView:'text' as const,readonly:false,dirty:false}]){
   const menu=flatten(applicationMenu({...base,activeId:'a',documents:[doc]},()=>{},'linux'))
   expect(menu.find(item=>item.id==='go.row')?.enabled).toBe(false);expect(menu.find(item=>item.id==='go.row')?.accelerator).toBeUndefined()
  }
 })
 it.each([{kind:'text' as const},{kind:'csv' as const,csvView:'text' as const}])('sin formatos disponibles, Exportar está deshabilitado: %j',document=>{
  const context={...base,activeId:'a',documents:[{id:'a',name:'documento',readonly:false,dirty:false,...document}]}
  const item=flatten(applicationMenu(context,()=>{},'linux')).find(item=>item.id==='file.exports');expect(item?.submenu).toEqual([]);expect(item?.enabled).toBe(false)
 })
 it('conserva Mod-G de la búsqueda CodeMirror en SQL y en su campo de búsqueda',()=>{
  const document={id:'a',name:'tabla.csv',kind:'csv' as const,readonly:false,dirty:false}
  for(const focus of ['sql','field'] as const){const context={...base,activeId:'a',documents:[document],focus,inCodeMirror:true},item=flatten(applicationMenu(context,()=>{},'darwin')).find(item=>item.id==='go.row');expect(item?.enabled).toBe(true);expect(item?.accelerator).toBeUndefined()}
 })
 it('la vista previa Markdown conserva deshacer de tareas y copia sin ofrecer pegar o cortar',()=>{
  const context={...base,activeId:'a',documents:[{id:'a',name:'nota.md',kind:'markdown' as const,readonly:false,dirty:false}],mode:'preview' as const,focus:'editor' as const,canEdit:true,canUndo:true}
  const items=flatten(applicationMenu(context,()=>{},'linux'))
  for(const id of ['edit.cut','edit.paste','edit.pastePlain'])expect(items.find(item=>item.id===id)?.enabled).toBe(false)
  for(const id of ['edit.undo','edit.copy','edit.selectAll'])expect(items.find(item=>item.id===id)?.enabled).toBe(true)
 })
 it('un modal conserva edición del campo y bloquea acciones del documento y apertura',()=>{
  const context={...base,activeId:'a',documents:[{id:'a',name:'nota.mmd',kind:'mermaid' as const,readonly:false,dirty:false}],focus:'field' as const,canEdit:true,canUndo:true,modal:true}
  const items=flatten(applicationMenu(context,()=>{},'darwin'))
  for(const id of ['file.close','file.newMarkdown','file.open','file.save','view.sidebar','app.settings'])expect(items.find(item=>item.id===id)?.enabled).toBe(false)
  for(const id of ['edit.undo','edit.copy','edit.cut','edit.paste','edit.selectAll','app.quit'])expect(items.find(item=>item.id===id)?.enabled).toBe(true)
 })
 it('la rejilla editable ofrece su historial existente aunque no publique profundidades',()=>{
  for(const readonly of [false,true]){
   const context={...base,activeId:'a',documents:[{id:'a',name:'datos.csv',kind:'csv' as const,readonly,dirty:false}],focus:'grid' as const,canEdit:!readonly}
   const items=flatten(applicationMenu(context,()=>{},'linux'))
   for(const id of ['edit.undo','edit.redo'])expect(items.find(item=>item.id===id)?.enabled).toBe(!readonly)
  }
 })
 it('recientes y documentos sólo despachan un ID cerrado y un argumento acotado',()=>{
  const calls:unknown[][]=[],documents=[{id:'a',name:'A.md',kind:'markdown' as const,readonly:false,dirty:false}]
  const menu=flatten(applicationMenu({...base,activeId:'a',documents,recents:Array.from({length:12},(_,i)=>`/carpeta/${i}.md`)},(id,arg)=>calls.push([id,arg]),'linux'))
  const recents=menu.filter(item=>item.id?.startsWith('recent.'));expect(recents).toHaveLength(10)
  recents[0].click?.({} as never,undefined,{} as never)
  menu.find(item=>item.id==='document.a')?.click?.({} as never,undefined,{} as never)
  expect(calls).toEqual([['file.openRecent',0],['window.document','a']])
 })
 it('desarrollo sólo aparece cuando está autorizado en el contexto',()=>{
  for(const context of [{...base,development:true},{...base,showDevTools:true}]){
   const menu=flatten(applicationMenu(context,()=>{},'linux'))
   expect(menu.find(item=>item.id==='view.reload')).toBeTruthy();expect(menu.find(item=>item.id==='view.devTools')).toBeTruthy()
  }
 })
})

it('APP-01 · conserva la paleta CSV por el mismo comando y no captura Mod+K en otros editores',()=>{
 const csv={...base,activeId:'a',focus:'grid' as const,documents:[{id:'a',name:'datos.csv',kind:'csv' as const,readonly:false,dirty:false}]}
 const palette=flatten(applicationMenu(csv,()=>{},'linux')).find(item=>item.id==='edit.commandPalette')
 expect(palette).toMatchObject({enabled:true,accelerator:'CommandOrControl+K'})
 const markdown={...base,activeId:'a',focus:'editor' as const,documents:[{id:'a',name:'nota.md',kind:'markdown' as const,readonly:false,dirty:false}]}
 const other=flatten(applicationMenu(markdown,()=>{},'linux')).find(item=>item.id==='edit.commandPalette')
 expect(other).toMatchObject({enabled:false});expect(other?.accelerator).toBeUndefined()
})

it('APP-01 · Rehacer conserva el atajo nativo de cada plataforma',()=>{
 const key=(platform:NodeJS.Platform)=>flatten(applicationMenu({...base,focus:'field'},()=>{},platform)).find(item=>item.id==='edit.redo')?.accelerator
 expect(key('win32')).toBe('Control+Y')
 expect(key('darwin')).toBe('CommandOrControl+Shift+Z')
 expect(key('linux')).toBe('CommandOrControl+Shift+Z')
})

it('APP-01 M5 · un foco de sólo lectura permite copiar/seleccionar y bloquea mutaciones',()=>{
 for(const focus of ['field','cell','sql'] as const){
  const context={...base,focus,canEdit:false,canUndo:true,canRedo:true}
  const items=flatten(applicationMenu(context,()=>{},'linux'))
  for(const id of ['edit.cut','edit.paste','edit.pastePlain','edit.undo','edit.redo'])expect(items.find(item=>item.id===id)?.enabled,id).toBe(false)
  for(const id of ['edit.copy','edit.selectAll'])expect(items.find(item=>item.id===id)?.enabled,id).toBe(true)
 }
})
it('APP-01 M5 · un buscador editable mantiene edición aunque el documento sea de sólo lectura',()=>{
 const context={...base,activeId:'a',focus:'field' as const,canEdit:true,documents:[{id:'a',name:'vista.md',kind:'markdown' as const,readonly:true,dirty:false}]}
 const items=flatten(applicationMenu(context,()=>{},'linux'))
 expect(items.find(item=>item.id==='edit.cut')?.enabled).toBe(true);expect(items.find(item=>item.id==='file.save')?.enabled).toBe(false)
})
it.each(['win32','linux'] as const)('APP-01 M8 · Zoom despacha una acción de ventana compatible con %s',platform=>{
 const calls:string[]=[],item=flatten(applicationMenu(base,id=>calls.push(id),platform)).find(item=>item.id==='window.zoom')!
 expect(item.role).toBeUndefined();expect(item.click).toBeTypeOf('function');item.click?.({} as never,undefined,{} as never)
 expect(calls).toEqual(['window.zoom'])
})
it('APP-01 M8 · macOS conserva el rol Zoom del sistema',()=>{
 expect(flatten(applicationMenu(base,()=>{},'darwin')).find(item=>item.id==='window.zoom')?.role).toBe('zoom')
})
