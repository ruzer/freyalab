import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import type {FreyaAPI} from '../src/shared/types'
const native=vi.hoisted(()=>({invoke:vi.fn(),expose:vi.fn()}))
vi.mock('electron',()=>({contextBridge:{exposeInMainWorld:native.expose},ipcRenderer:{invoke:native.invoke,on:vi.fn(),removeListener:vi.fn()},webUtils:{getPathForFile:vi.fn()}}))
let api:FreyaAPI
beforeEach(async()=>{vi.resetModules();vi.clearAllMocks();vi.stubGlobal('window',{addEventListener:vi.fn()});await import('../src/preload/index');api=native.expose.mock.calls.find(([name])=>name==='freya')![1] as FreyaAPI})
afterEach(()=>vi.unstubAllGlobals())

it('PRJ-01c · revela el proyecto por una operación fija con su id, sin exponer rutas',async()=>{
 native.invoke.mockResolvedValueOnce(undefined)
 expect(await api.projectShow('future')).toBeUndefined()
 expect(native.invoke).toHaveBeenCalledExactlyOnceWith('freya','project:show','future')
 for(const key of ['invoke','showItemInFolder','projectShowPath'])expect(api).not.toHaveProperty(key)
})
it('PRJ-01c · conserva el error del proceso principal sin el prefijo de Electron',async()=>{
 native.invoke.mockRejectedValueOnce(new Error("Error invoking remote method 'freya': Error: Referencia de proyecto inválida."))
 await expect(api.projectShow('future')).rejects.toThrow('Referencia de proyecto inválida.')
})
