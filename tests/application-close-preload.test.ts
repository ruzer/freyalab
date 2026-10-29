import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import type {FreyaAPI} from '../src/shared/types'
const mocked=vi.hoisted(()=>({invoke:vi.fn(),send:vi.fn(),expose:vi.fn(),on:vi.fn(),removeListener:vi.fn()}))
vi.mock('electron',()=>({contextBridge:{exposeInMainWorld:mocked.expose},ipcRenderer:{invoke:mocked.invoke,send:mocked.send,on:mocked.on,removeListener:mocked.removeListener},webUtils:{getPathForFile:vi.fn()}}))
let api:FreyaAPI
const nonce='12345678-1234-4234-8234-123456789abc',next='22345678-1234-4234-8234-123456789abc'
beforeEach(async()=>{vi.resetModules();vi.clearAllMocks();vi.stubGlobal('window',{addEventListener:vi.fn(),dispatchEvent:vi.fn()});await import('../src/preload/index');api=mocked.expose.mock.calls[0][1]})
afterEach(()=>vi.unstubAllGlobals())
const deliver=(event:unknown)=>{for(const[name,listener]of mocked.on.mock.calls)if(name==='freya:command')listener({},event)}
const deferred=()=>{let resolve!:(value:boolean)=>void;const promise=new Promise<boolean>(done=>resolve=done);return{promise,resolve}}

describe('cierre · preload específico, sin retorno asíncrono de comandos ordinarios',()=>{
 for(const value of [false,true])it(`espera únicamente prepare y envía UUID+${value}`,async()=>{
  const wait=deferred(),prepare=vi.fn(()=>wait.promise),aborted=vi.fn();api.onPrepareClose({prepare,aborted})
  deliver({id:'app.prepareClose',nonce});expect(prepare).toHaveBeenCalledWith();expect(mocked.send).not.toHaveBeenCalled()
  wait.resolve(value);await vi.waitFor(()=>expect(mocked.send).toHaveBeenCalledExactlyOnceWith('freya:close-prepared',nonce,value));expect(aborted).not.toHaveBeenCalled()
 })
 it('los comandos ordinarios conservan su finalización síncrona y no reciben órdenes internas',()=>{
  const normal=vi.fn(()=>new Promise<void>(()=>{}));api.onCommand(normal)
  deliver({id:'edit.undo',nonce});expect(mocked.send).toHaveBeenCalledExactlyOnceWith('freya:menu-native-done',nonce)
  deliver({id:'app.prepareClose',nonce});deliver({id:'app.closeAborted',nonce});expect(normal).toHaveBeenCalledOnce()
 })
 it('el callback sólo recibe prepare/aborted, sin UUID, ruta, texto ni delegado',async()=>{
  const prepare=vi.fn(async(...args:unknown[])=>{expect(args).toEqual([]);return true});api.onPrepareClose({prepare,aborted:vi.fn()})
  deliver({id:'app.prepareClose',nonce});await vi.waitFor(()=>expect(mocked.send).toHaveBeenCalledExactlyOnceWith('freya:close-prepared',nonce,true))
 })
 for(const value of [1,'sí',{},undefined])it(`no acepta un retorno truthy o ausente: ${String(value)}`,async()=>{
  api.onPrepareClose({prepare:async()=>value as unknown as boolean,aborted:vi.fn()});deliver({id:'app.prepareClose',nonce})
  await vi.waitFor(()=>expect(mocked.send).toHaveBeenCalledExactlyOnceWith('freya:close-prepared',nonce,false))
 })
 it('un rechazo del callback se convierte en false sin transmitir el error',async()=>{
  api.onPrepareClose({prepare:async()=>{throw new Error('contenido privado')},aborted:vi.fn()});deliver({id:'app.prepareClose',nonce})
  await vi.waitFor(()=>expect(mocked.send).toHaveBeenCalledExactlyOnceWith('freya:close-prepared',nonce,false))
 })
 it('una repetición del mismo UUID no prepara dos veces ni duplica ACK',async()=>{
  const wait=deferred(),prepare=vi.fn(()=>wait.promise);api.onPrepareClose({prepare,aborted:vi.fn()})
  deliver({id:'app.prepareClose',nonce});deliver({id:'app.prepareClose',nonce});expect(prepare).toHaveBeenCalledOnce()
  wait.resolve(true);await vi.waitFor(()=>expect(mocked.send).toHaveBeenCalledTimes(1))
 })
 it('el aborto viejo y el ACK tardío no afectan la preparación nueva',async()=>{
  const first=deferred(),second=deferred(),prepare=vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise),aborted=vi.fn()
  api.onPrepareClose({prepare,aborted});deliver({id:'app.prepareClose',nonce});deliver({id:'app.prepareClose',nonce:next});deliver({id:'app.closeAborted',nonce});expect(aborted).not.toHaveBeenCalled()
  first.resolve(true);await Promise.resolve();await Promise.resolve();expect(mocked.send).not.toHaveBeenCalled()
  second.resolve(true);await vi.waitFor(()=>expect(mocked.send).toHaveBeenCalledExactlyOnceWith('freya:close-prepared',next,true))
  deliver({id:'app.closeAborted',nonce:next});deliver({id:'app.closeAborted',nonce:next});expect(aborted).toHaveBeenCalledOnce()
 })
 for(const event of [{id:'app.prepareClose'},{id:'app.prepareClose',nonce:'inválido'},{id:'app.prepareClose',nonce,argument:'ruta'}])it(`ignora transporte interno malformado: ${JSON.stringify(event)}`,()=>{
  const prepare=vi.fn(async()=>true);api.onPrepareClose({prepare,aborted:vi.fn()});deliver(event);expect(prepare).not.toHaveBeenCalled();expect(mocked.send).not.toHaveBeenCalled()
 })
 it('dar de baja el listener invalida una respuesta pendiente',async()=>{
  const wait=deferred(),unsubscribe=api.onPrepareClose({prepare:()=>wait.promise,aborted:vi.fn()});deliver({id:'app.prepareClose',nonce});unsubscribe();wait.resolve(true);await Promise.resolve();await Promise.resolve()
  expect(mocked.send).not.toHaveBeenCalled();expect(mocked.removeListener).toHaveBeenCalledWith('freya:command',expect.any(Function))
 })
})
