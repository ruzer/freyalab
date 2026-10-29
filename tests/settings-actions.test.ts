import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const native=vi.hoisted(()=>({folder:'',confirm:vi.fn(),open:vi.fn()}))
vi.mock('electron',()=>({app:{getPath:(name:string)=>{if(name!=='userData')throw new Error('Ruta fuera del contrato.');return native.folder}},dialog:{showMessageBox:native.confirm},shell:{openPath:native.open}}))
vi.mock('../src/main/files',async original=>{const actual=await original<typeof import('../src/main/files')>();return{...actual,atomicWrite:vi.fn(actual.atomicWrite)}})
import {atomicWrite} from '../src/main/files'
import {SettingsStore} from '../src/main/settings'
import {defaultSettings} from '../src/shared/settings'
import {setLanguage} from '../src/shared/i18n'
import {resetSettings,clearRecents,showDataFolder} from '../src/main/settings-actions'

let store:SettingsStore,path:string
beforeEach(async()=>{
 native.folder=await mkdtemp(join(tmpdir(),'freya-settings-actions-'));path=join(native.folder,'settings.json')
 native.confirm.mockReset().mockResolvedValue({response:1,checkboxChecked:false});native.open.mockReset().mockResolvedValue('')
 const actual=await vi.importActual<typeof import('../src/main/files')>('../src/main/files');vi.mocked(atomicWrite).mockReset().mockImplementation(actual.atomicWrite)
 setLanguage('es');store=new SettingsStore(path);await store.migrate({})
})
afterEach(async()=>{setLanguage('es');await rm(native.folder,{recursive:true,force:true});vi.clearAllMocks()})

describe('APP-03 · acciones acotadas de Ajustes',()=>{
 it('S10 · cancelar el restablecimiento no altera el JSON',async()=>{
  await store.set({tema:'dark'});const before=await readFile(path)
  expect(await resetSettings(store)).toBeNull();expect(await readFile(path)).toEqual(before)
  expect(native.confirm).toHaveBeenCalledOnce()
 })
 it('S10 · restablece la tabla de defaults sin tocar recientes ni gráficos ni documentos',async()=>{
  const recent=join(native.folder,'recents.json'),charts=join(native.folder,'chart-presets.json'),document=join(native.folder,'FUENTE_CANARIO.md')
  await writeFile(recent,'["FUENTE_CANARIO.md"]');await writeFile(charts,'[{"name":"CANARIO"}]');await writeFile(document,'# FUENTE_INTACTA\n')
  await store.set({idioma:'en',tema:'dark',barraLateral:{visible:false,ancho:350},markdown:{modoInicial:'preview'},avanzado:{herramientasDeDesarrollo:true}})
  native.confirm.mockResolvedValueOnce({response:0})
  expect((await resetSettings(store))?.values).toEqual(defaultSettings())
  expect(JSON.parse(await readFile(path,'utf8'))).toEqual(defaultSettings())
  expect(await readFile(recent,'utf8')).toBe('["FUENTE_CANARIO.md"]');expect(await readFile(charts,'utf8')).toBe('[{"name":"CANARIO"}]');expect(await readFile(document,'utf8')).toBe('# FUENTE_INTACTA\n')
 })
 it('S5/S10 · ni una confirmación permite sobrescribir ajustes de versión futura',async()=>{
  const future='{"version":99,"conservar":"CANARIO"}';await writeFile(path,future);native.confirm.mockResolvedValueOnce({response:0})
  await expect(resetSettings(store)).rejects.toThrow(/lectura|read.only/i)
  expect(await readFile(path,'utf8')).toBe(future)
 })
 it('S10 · conserva la configuración anterior cuando falla el restablecimiento',async()=>{
  await store.set({tema:'dark'});const before=await readFile(path);native.confirm.mockResolvedValueOnce({response:0})
  vi.mocked(atomicWrite).mockRejectedValueOnce(new Error('/CANARIO_PRIVADO/EACCES'))
  await expect(resetSettings(store)).rejects.toThrow(/ajustes|settings/i);expect(await readFile(path)).toEqual(before)
 })
 it('S9 · cancelar Borrar recientes conserva la lista byte por byte',async()=>{
  const recent=join(native.folder,'recents.json'),source='["CANARIO_ANTERIOR.csv"]\n';await writeFile(recent,source)
  expect(await clearRecents()).toBe(false);expect(await readFile(recent,'utf8')).toBe(source)
 })
 it('S9 · confirmar vacía sólo la lista y no altera los archivos referidos',async()=>{
  const document=join(native.folder,'CANARIO.csv'),recent=join(native.folder,'recents.json');await writeFile(document,'ID\n00123\n');await writeFile(recent,JSON.stringify([document]));const before=await readFile(path)
  native.confirm.mockResolvedValueOnce({response:0});expect(await clearRecents()).toBe(true)
  expect(JSON.parse(await readFile(recent,'utf8'))).toEqual([]);expect(await readFile(document,'utf8')).toBe('ID\n00123\n');expect(await readFile(path)).toEqual(before)
 })
 it('S9 · un fallo al vaciar recientes conserva la lista y no expone rutas',async()=>{
  const recent=join(native.folder,'recents.json'),source='["CANARIO.csv"]';await writeFile(recent,source);native.confirm.mockResolvedValueOnce({response:0});vi.mocked(atomicWrite).mockRejectedValueOnce(new Error('/CANARIO_PRIVADO/ENOSPC'))
  await expect(clearRecents()).rejects.toThrow(/recientes|recent/i);expect(await readFile(recent,'utf8')).toBe(source)
 })
 it('S10 · Mostrar carpeta abre sólo userData y no devuelve una ruta a la interfaz',async()=>{
  expect(await showDataFolder()).toBeUndefined();expect(native.open).toHaveBeenCalledExactlyOnceWith(native.folder)
 })
 it.each(['error nativo: /CANARIO_PRIVADO',new Error('/CANARIO_PRIVADO')])('S10 · un fallo al mostrar carpeta se explica sin incluir el detalle privado %j',async failure=>{
  if(typeof failure==='string')native.open.mockResolvedValueOnce(failure);else native.open.mockRejectedValueOnce(failure)
  try{await showDataFolder();throw new Error('Se ocultó el fallo.')}catch(error){expect(String(error)).toMatch(/carpeta|folder/i);expect(String(error)).not.toContain('CANARIO_PRIVADO')}
 })
 it('S9/S10 · las confirmaciones salen del catálogo y cancelan por omisión',async()=>{
  setLanguage('en');await resetSettings(store);await clearRecents()
  for(const call of native.confirm.mock.calls){const options=call.at(-1);expect(options.cancelId).toBe(1);expect(options.defaultId).toBe(1);expect(options.buttons[1]).toBe('Cancel');expect(options.message).not.toMatch(/Restablecer|Borrar/)}
 })
})
