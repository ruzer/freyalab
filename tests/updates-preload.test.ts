import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import type {FreyaAPI} from '../src/shared/types'
const mocked=vi.hoisted(()=>({invoke:vi.fn(),expose:vi.fn()}))
vi.mock('electron',()=>({contextBridge:{exposeInMainWorld:mocked.expose},ipcRenderer:{invoke:mocked.invoke,on:vi.fn(),removeListener:vi.fn()},webUtils:{getPathForFile:vi.fn()}}))
let api:FreyaAPI
beforeEach(async()=>{vi.resetModules();vi.clearAllMocks();vi.stubGlobal('window',{addEventListener:vi.fn()});await import('../src/preload/index');api=mocked.expose.mock.calls.find(([name])=>name==='freya')![1] as FreyaAPI})
afterEach(()=>vi.unstubAllGlobals())
it('APP-04 · el puente sólo expone acciones cerradas, sin URL para comprobar ni descarga',async()=>{
 await api.checkUpdates();expect(mocked.invoke).toHaveBeenLastCalledWith('freya','updates:check')
 await api.cancelUpdates();expect(mocked.invoke).toHaveBeenLastCalledWith('freya','updates:cancel')
 await api.skipUpdate('0.1.0-alpha.10');expect(mocked.invoke).toHaveBeenLastCalledWith('freya','updates:skip','0.1.0-alpha.10')
 await api.remindUpdate();expect(mocked.invoke).toHaveBeenLastCalledWith('freya','updates:remind')
 await api.openUpdate('https://github.com/ruzer/freyalab/releases/tag/v1.0.0');expect(mocked.invoke).toHaveBeenLastCalledWith('freya','updates:open','https://github.com/ruzer/freyalab/releases/tag/v1.0.0')
 expect(api).not.toHaveProperty('download');expect(api).not.toHaveProperty('install');expect(api).not.toHaveProperty('fetch');expect(api).not.toHaveProperty('invoke')
})
