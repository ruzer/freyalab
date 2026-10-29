import {describe,expect,it,vi} from 'vitest'
import {loadSettings} from '../src/renderer/lib/settings-client'
import {defaultSettings} from '../src/shared/settings'
import type {SettingsState} from '../src/shared/settings'

const keys=['freya-theme','freya-sidebar','freya-sidebar-width','freya-sidebar-tab','freya-split']
const previous={'freya-theme':'dark','freya-sidebar':'false','freya-sidebar-width':'300.5','freya-sidebar-tab':'outline','freya-split':'62.5'}
function state(migrationPending=false):SettingsState{return{values:defaultSettings(),readonly:false,migrationPending}}
function fixture(current=state(true)){
 const items=new Map<string,string>(Object.entries({...previous,ajeno:'NO_LEER'}))
 const storage={getItem:vi.fn((key:string)=>items.get(key)??null),removeItem:vi.fn((key:string)=>{items.delete(key)})}
 const migrated=state();migrated.values.tema='dark'
 const bridge={settings:vi.fn(async()=>current),migrateSettings:vi.fn(async(_values:Record<string,string|null>)=>migrated)}
 return{bridge,storage,items,migrated}
}

describe('APP-03 · cliente de migración de ajustes',()=>{
 it('S4 · un perfil ya migrado no vuelve a leer localStorage',async()=>{
  const current=state();current.values.tema='light';const {bridge,storage}=fixture(current)
  expect(await loadSettings(bridge,storage)).toBe(current)
  expect(bridge.settings).toHaveBeenCalledOnce();expect(bridge.migrateSettings).not.toHaveBeenCalled()
  expect(storage.getItem).not.toHaveBeenCalled();expect(storage.removeItem).not.toHaveBeenCalled()
 })
 it('S4 · envía exclusivamente las cinco claves antiguas, sin transformarlas en la interfaz',async()=>{
  const {bridge,storage,migrated}=fixture()
  expect(await loadSettings(bridge,storage)).toBe(migrated)
  expect(storage.getItem.mock.calls.map(([key])=>key)).toEqual(keys)
  expect(bridge.migrateSettings).toHaveBeenCalledExactlyOnceWith(previous)
  expect(storage.removeItem.mock.calls.map(([key])=>key)).toEqual(keys)
  expect(storage.getItem).not.toHaveBeenCalledWith('ajeno')
 })
 it('S4 · borra las claves sólo después de la confirmación del proceso principal',async()=>{
  const {bridge,storage,migrated}=fixture();let finish!:(value:SettingsState)=>void
  bridge.migrateSettings.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
  const pending=loadSettings(bridge,storage);await Promise.resolve()
  expect(storage.removeItem).not.toHaveBeenCalled()
  finish(migrated);await pending
  expect(storage.removeItem).toHaveBeenCalledTimes(5)
 })
 it('S4 · un fallo al persistir no borra los valores que se podrán reintentar',async()=>{
  const {bridge,storage,items}=fixture();bridge.migrateSettings.mockRejectedValueOnce(new Error('No se pudieron guardar los ajustes.'))
  await expect(loadSettings(bridge,storage)).rejects.toThrow('No se pudieron guardar los ajustes.')
  expect(storage.removeItem).not.toHaveBeenCalled();expect(Object.fromEntries(items)).toMatchObject(previous)
 })
 it('S5 · una versión futura no lee, migra ni borra preferencias del navegador',async()=>{
  const current={...state(),readonly:true,notice:'Una versión más nueva guardó estos ajustes.'}
  const {bridge,storage}=fixture(current)
  expect(await loadSettings(bridge,storage)).toBe(current)
  expect(bridge.migrateSettings).not.toHaveBeenCalled();expect(storage.getItem).not.toHaveBeenCalled();expect(storage.removeItem).not.toHaveBeenCalled()
 })
 it('S4/S5 · si aparece una versión futura durante la migración, conserva las cinco claves',async()=>{
  const {bridge,storage}=fixture();const future={...state(),readonly:true,notice:'Sólo lectura.'}
  bridge.migrateSettings.mockResolvedValueOnce(future)
  expect(await loadSettings(bridge,storage)).toBe(future);expect(storage.removeItem).not.toHaveBeenCalled()
 })
 it('S4 · no borra si main todavía informa de migración pendiente',async()=>{
  const {bridge,storage}=fixture();bridge.migrateSettings.mockResolvedValueOnce(state(true))
  expect((await loadSettings(bridge,storage)).migrationPending).toBe(true)
  expect(storage.removeItem).not.toHaveBeenCalled()
 })
 it('S4 · sin almacenamiento disponible completa el intento único con un objeto vacío',async()=>{
  const {bridge,migrated}=fixture()
  expect(await loadSettings(bridge)).toBe(migrated)
  expect(bridge.migrateSettings).toHaveBeenCalledExactlyOnceWith({})
 })
 it('S4 · localStorage bloqueado no interrumpe la carga ni inventa valores',async()=>{
  const {bridge,storage,migrated}=fixture()
  storage.getItem.mockImplementation(()=>{throw new Error('SecurityError')})
  storage.removeItem.mockImplementation(()=>{throw new Error('SecurityError')})
  expect(await loadSettings(bridge,storage)).toBe(migrated)
  expect(bridge.migrateSettings).toHaveBeenCalledExactlyOnceWith({})
 })
 it('S4 · claves ausentes siguen ausentes para que main aplique sus valores por omisión',async()=>{
  const {bridge,storage,items}=fixture();items.clear()
  await loadSettings(bridge,storage)
  expect(bridge.migrateSettings).toHaveBeenCalledExactlyOnceWith({})
 })
 it('S4 · una clave que no se pudo borrar no se vuelve a leer tras completar la migración',async()=>{
  const {bridge,storage,migrated}=fixture()
  storage.removeItem.mockImplementation(()=>{throw new Error('SecurityError')})
  await loadSettings(bridge,storage);bridge.settings.mockResolvedValueOnce(migrated)
  storage.getItem.mockClear();bridge.migrateSettings.mockClear()
  expect(await loadSettings(bridge,storage)).toBe(migrated)
  expect(storage.getItem).not.toHaveBeenCalled();expect(bridge.migrateSettings).not.toHaveBeenCalled()
 })
})
