import {describe,expect,it} from 'vitest'
import {applicationUiStateSchema,applicationCommandSchema,menuFingerprint} from '../src/main/application-state'
import {formatApplicationShortcut} from '../src/shared/application'
import type {ApplicationMenuContext} from '../src/main/application-menu'

const uuid='12345678-1234-4234-8234-123456789abc'
const ui={activeId:uuid,mode:'split',focus:'editor',locked:false,canUndo:true,canRedo:false,canEdit:true,hasSelection:false}
const context:ApplicationMenuContext={documents:[{id:uuid,name:'documento.md',kind:'markdown',readonly:false,dirty:false}],recents:['/carpeta/documento.md'],activeId:uuid,mode:'split',theme:'system',sidebar:true,focus:'editor',locked:false,development:false,canUndo:true,canRedo:false,canEdit:true,hasSelection:false}

describe('APP-01 M3 · mensajes de contexto y comandos',()=>{
 it('el contexto sólo contiene el estado de interfaz permitido',()=>{
  expect(applicationUiStateSchema.parse(ui)).toEqual(ui)
  for(const value of [{...ui,path:'/CANARIO'}, {...ui,documents:[]},{...ui,theme:'dark'},{...ui,showDevTools:true},{...ui,focus:'shell'},{...ui,canEdit:'true'}])expect(applicationUiStateSchema.safeParse(value).success).toBe(false)
 })
 it.each(['file.newMarkdown','app.settings','view.mode.preview','edit.undo'])('acepta el ID del catálogo %s sin argumentos libres',id=>{
  expect(applicationCommandSchema.parse({id})).toEqual({id})
  expect(applicationCommandSchema.safeParse({id,argument:'/ruta'}).success).toBe(false)
 })
 it('ventanas y recientes reciben sólo un UUID o índice acotado',()=>{
  expect(applicationCommandSchema.parse({id:'window.document',argument:uuid})).toEqual({id:'window.document',argument:uuid})
  expect(applicationCommandSchema.parse({id:'file.openRecent',argument:9})).toEqual({id:'file.openRecent',argument:9})
  for(const value of [{id:'window.document',argument:'/ruta'}, {id:'file.openRecent',argument:10},{id:'file.openRecent',argument:-1},{id:'file.openRecent',argument:1.5},{id:'executeJavaScript'},{id:'app.settings',text:'CANARIO'}])expect(applicationCommandSchema.safeParse(value).success).toBe(false)
 })
 it('la firma no incluye contenido, revisión ni dirty y no reconstruye por escribir otro carácter',()=>{
  const changed={...context,documents:[{...context.documents[0],dirty:true,revision:999,text:'CANARIO_PRIVADO'}]}
  expect(menuFingerprint(changed)).toBe(menuFingerprint(context))
  expect(menuFingerprint(changed)).not.toMatch(/CANARIO_PRIVADO|revision|dirty/)
 })
 it('nombre, foco, capacidad, tema, modo y selección sí cambian la firma',()=>{
  for(const changed of [{...context,documents:[{...context.documents[0],name:'otro.md'}]},{...context,focus:'field' as const},{...context,canUndo:false},{...context,theme:'dark' as const},{...context,mode:'preview' as const},{...context,hasSelection:true}])expect(menuFingerprint(changed)).not.toBe(menuFingerprint(context))
 })
 it.each([
  ['CommandOrControl+Shift+Z','darwin','⌘⇧Z'],['Control+Y','win32','Ctrl+Y'],['CommandOrControl+Shift+Z','linux','Ctrl+Shift+Z'],['CommandOrControl+,','darwin','⌘,'],['CommandOrControl+Plus','win32','Ctrl++'],
 ])('muestra %s en %s como %s desde el acelerador del catálogo', (accelerator,platform,expected)=>{
  expect(formatApplicationShortcut(accelerator,platform)).toBe(expected)
 })
})
