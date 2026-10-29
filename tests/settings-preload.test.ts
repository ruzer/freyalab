import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import type {FreyaAPI} from '../src/shared/types'
import {defaultSettings,type SettingsState} from '../src/shared/settings'

const mocked=vi.hoisted(()=>({invoke:vi.fn(),expose:vi.fn(),on:vi.fn(),removeListener:vi.fn()}))
vi.mock('electron',()=>({contextBridge:{exposeInMainWorld:mocked.expose},ipcRenderer:{invoke:mocked.invoke,on:mocked.on,removeListener:mocked.removeListener},webUtils:{getPathForFile:vi.fn()}}))
let api:FreyaAPI
const current=():SettingsState=>({values:defaultSettings(),readonly:false,migrationPending:false})
beforeEach(async()=>{
 vi.resetModules();vi.clearAllMocks();vi.stubGlobal('window',{addEventListener:vi.fn(),dispatchEvent:vi.fn()})
 await import('../src/preload/index')
 api=mocked.expose.mock.calls.find(([name])=>name==='freya')![1] as FreyaAPI
})
afterEach(()=>vi.unstubAllGlobals())

describe('APP-03 · puente cerrado de ajustes',()=>{
 it('obtiene ajustes con una operación fija sin rutas ni argumentos',async()=>{
  const state=current();mocked.invoke.mockResolvedValueOnce(state)
  expect(await api.settings()).toBe(state)
  expect(mocked.invoke).toHaveBeenCalledExactlyOnceWith('freya','settings:get')
 })
 it('envía el parche a main sin mutarlo ni escribir preferencias en el renderer',async()=>{
  const patch=Object.freeze({barraLateral:Object.freeze({visible:false})}),state=current();mocked.invoke.mockResolvedValueOnce(state)
  expect(await api.setSettings(patch)).toBe(state)
  expect(mocked.invoke).toHaveBeenCalledExactlyOnceWith('freya','settings:set',patch)
  expect(patch).toEqual({barraLateral:{visible:false}})
 })
 it('envía la migración por la operación específica sin exponer invoke genérico',async()=>{
  const values={'freya-theme':'dark','freya-sidebar':'false','freya-sidebar-width':'300.5','freya-sidebar-tab':'outline','freya-split':'62.5'},state=current();mocked.invoke.mockResolvedValueOnce(state)
  expect(await api.migrateSettings(values)).toBe(state)
  expect(mocked.invoke).toHaveBeenCalledExactlyOnceWith('freya','settings:migrate',values)
  expect(api).not.toHaveProperty('invoke');expect(api).not.toHaveProperty('readSettingsFile')
 })
 it('reutiliza el evento de aplicación y permite cancelar la suscripción',()=>{
  const callback=vi.fn(),event={type:'settings',settings:current()},unsubscribe=api.onEvent(callback)
  const [channel,listener]=mocked.on.mock.calls[0];expect(channel).toBe('freya:event')
  listener({},event);expect(callback).toHaveBeenCalledExactlyOnceWith(event)
  unsubscribe();expect(mocked.removeListener).toHaveBeenCalledExactlyOnceWith('freya:event',listener)
 })
 it('conserva el mensaje de main sin el prefijo técnico de Electron',async()=>{
  mocked.invoke.mockRejectedValueOnce(new Error("Error invoking remote method 'freya': Error: Los ajustes están en modo de solo lectura."))
  await expect(api.setSettings({tema:'dark'})).rejects.toThrow('Los ajustes están en modo de solo lectura.')
 })
 it('restablece sólo por la operación cerrada de confirmación de main',async()=>{
  mocked.invoke.mockResolvedValueOnce(null);expect(await api.resetSettings()).toBeNull()
  expect(mocked.invoke).toHaveBeenCalledExactlyOnceWith('freya','settings:reset')
 })
 it('borra sólo la lista de recientes mediante la confirmación de main',async()=>{
  mocked.invoke.mockResolvedValueOnce(false);expect(await api.clearRecents()).toBe(false)
  expect(mocked.invoke).toHaveBeenCalledExactlyOnceWith('freya','recents:clear')
 })
 it('solicita mostrar userData sin aceptar ni devolver rutas',async()=>{
  mocked.invoke.mockResolvedValueOnce(undefined);expect(await api.showDataFolder()).toBeUndefined()
  expect(mocked.invoke).toHaveBeenCalledExactlyOnceWith('freya','settings:showDataFolder')
 })

})
