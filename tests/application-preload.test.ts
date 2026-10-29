import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import type {FreyaAPI} from '../src/shared/types'
import type {ApplicationCommand} from '../src/shared/application'
const mocked=vi.hoisted(()=>({invoke:vi.fn(),send:vi.fn(),expose:vi.fn(),on:vi.fn(),removeListener:vi.fn()}))
vi.mock('electron',()=>({contextBridge:{exposeInMainWorld:mocked.expose},ipcRenderer:{invoke:mocked.invoke,send:mocked.send,on:mocked.on,removeListener:mocked.removeListener},webUtils:{getPathForFile:vi.fn()}}))
let api:FreyaAPI
const nonce='12345678-1234-4234-8234-123456789abc'
beforeEach(async()=>{vi.resetModules();vi.clearAllMocks();vi.stubGlobal('window',{addEventListener:vi.fn(),dispatchEvent:vi.fn()});await import('../src/preload/index');api=mocked.expose.mock.calls[0][1] as FreyaAPI})
afterEach(()=>vi.unstubAllGlobals())
const listener=()=>mocked.on.mock.calls.find(([name])=>name==='freya:command')![1] as (event:unknown,command:unknown)=>void

describe('APP-01 M3/M5 · único canal de comandos y delegación cerrada',()=>{
 it('publica sólo contexto y pide ayuda por dos operaciones fijas',async()=>{
  const state={activeId:null,mode:'split' as const,focus:'none' as const,locked:false}
  await api.setApplicationState(state);expect(mocked.invoke).toHaveBeenLastCalledWith('freya','application:state',state)
  await api.applicationShortcuts();expect(mocked.invoke).toHaveBeenLastCalledWith('freya','application:shortcuts')
  for(const key of ['invoke','nativeEdit','clipboard','readClipboard','executeJavaScript'])expect(api).not.toHaveProperty(key)
 })
 it('oculta el nonce al renderer y sólo delega una vez el comando original',()=>{
  let later=()=>{}
  const callback=vi.fn((command:ApplicationCommand,delegate:()=>void)=>{expect(command).toEqual({id:'edit.copy'});command.id='edit.cut';delegate();delegate();later=delegate}),unsubscribe=api.onCommand(callback)
  listener()({}, {id:'edit.copy',nonce});later()
  expect(callback).toHaveBeenCalledOnce();expect(mocked.send.mock.calls).toEqual([['freya:menu-native',nonce],['freya:menu-native-done',nonce]])
  unsubscribe();expect(mocked.removeListener).toHaveBeenCalledWith('freya:command',expect.any(Function))
 })
 it('caduca al regresar el callback aunque no se delegue',()=>{
  let later=()=>{};api.onCommand((_command,delegate)=>{later=delegate})
  listener()({}, {id:'edit.undo',nonce});later()
  expect(mocked.send.mock.calls).toEqual([['freya:menu-native-done',nonce]])
 })
 it('finaliza también cuando falla el callback',()=>{
  api.onCommand(()=>{throw new Error('fallo controlado')})
  expect(()=>listener()({}, {id:'edit.redo',nonce})).toThrow('fallo controlado')
  expect(mocked.send).toHaveBeenCalledExactlyOnceWith('freya:menu-native-done',nonce)
 })
 it('un comando sin concesión no puede activar ninguna operación nativa',()=>{
  api.onCommand((command,delegate)=>{expect(command).toEqual({id:'file.newCsv'});delegate()})
  listener()({}, {id:'file.newCsv'});expect(mocked.send).not.toHaveBeenCalled()
 })
 it('pegar sin formato conserva la señal específica de supresión del pegado enriquecido',()=>{
  api.onCommand((_command,delegate)=>delegate())
  listener()({}, {id:'edit.pastePlain',nonce})
  expect(window.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({type:'freya-paste-plain'}))
  expect(mocked.send.mock.calls).toEqual([['freya:menu-native',nonce],['freya:menu-native-done',nonce]])
 })
})
