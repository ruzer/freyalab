import {afterEach,beforeEach,describe,expect,it} from 'vitest'
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {SettingsStore} from '../src/main/settings'
import {defaultSettings,settingsPatchSchema} from '../src/shared/settings'

let folder:string,path:string,store:SettingsStore
beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-analysis-decimals-'))
 path=join(folder,'settings.json')
 store=new SettingsStore(path)
})
afterEach(async()=>{await rm(folder,{recursive:true,force:true})})

// Perfil v1 anterior: todas las preferencias tienen valores no iniciales.
function previousSettings():Record<string,unknown>{
 const values:Record<string,unknown>={
  ...defaultSettings(),
  idioma:'en',tema:'light',
  barraLateral:{visible:false,ancho:311.5,pestana:'outline'},
  markdown:{modoInicial:'preview'},
  editor:{tabIndents:true,indent:'tab',csvColumnColors:false},
  division:61.25,
  actualizaciones:{buscarAlIniciar:true,ultimaComprobacion:'2026-11-20T12:34:56.000Z',versionesOmitidas:['0.1.0-alpha.10','0.1.0-beta.1']},
  avanzado:{herramientasDeDesarrollo:true},
 }
 delete values['decimalesAnalisis']
 return values
}
const disk=async():Promise<unknown>=>JSON.parse(await readFile(path,'utf8'))
async function seed(values:Record<string,unknown>):Promise<string>{
 const content=JSON.stringify(values,null,2)+'\n'
 await writeFile(path,content)
 return content
}

describe('SIM-3d · preferencia persistente de decimales analíticos',()=>{
 it('DSET-01 · comparte el valor inicial Automático y no crea un archivo al consultar un perfil nuevo',async()=>{
  expect(defaultSettings()).toMatchObject({decimalesAnalisis:'auto'})
  const state=await store.get()
  expect(state).toMatchObject({readonly:false,migrationPending:true,values:{decimalesAnalisis:'auto'}})
  expect(state.values).toEqual(defaultSettings())
  expect(await readdir(folder)).toEqual([])
 })

 it('DSET-02 · lee v1 sin el campo con Automático y conserva todas las preferencias y los bytes originales',async()=>{
  const previous=previousSettings(),content=await seed(previous)
  const state=await store.get()
  expect(state).toMatchObject({readonly:false,migrationPending:false})
  expect(state.notice).toBeUndefined()
  expect(state.values).toEqual({...previous,decimalesAnalisis:'auto'})
  expect(await readFile(path,'utf8')).toBe(content)
  expect(await readdir(folder)).toEqual(['settings.json'])
 })

 it.each(['auto','all'] as const)('DSET-03 · guarda %j y lo conserva al reabrir sin modificar las demás preferencias',async mode=>{
  const previous=previousSettings()
  await seed(previous)
  const expected={...previous,decimalesAnalisis:mode}
  expect((await store.set({decimalesAnalisis:mode})).values).toEqual(expected)
  expect(await disk()).toEqual(expected)
  expect((await new SettingsStore(path).get()).values).toEqual(expected)
  expect(await readdir(folder)).toEqual(['settings.json'])
 })

 it('DSET-04 · los parches ausentes y de Tema no inyectan un valor inicial de decimales',()=>{
  expect(settingsPatchSchema.parse({})).toEqual({})
  const patch=settingsPatchSchema.parse({tema:'dark'})
  expect(patch).toEqual({tema:'dark'})
  expect(patch).not.toHaveProperty('decimalesAnalisis')
 })

 it('DSET-05 · cambiar Tema conserva Más precisión, el resto del perfil y el valor después de reabrir',async()=>{
  const previous={...previousSettings(),decimalesAnalisis:'all'}
  await seed(previous)
  const expected={...previous,tema:'dark'}
  expect((await store.set({tema:'dark'})).values).toEqual(expected)
  expect(await disk()).toEqual(expected)
  expect((await new SettingsStore(path).get()).values).toEqual(expected)
  expect(await readdir(folder)).toEqual(['settings.json'])
 })

 it.each([0,2,4,'2',true])('DSET-06 · rechaza %j sin escribir ni recuperar un perfil válido',async mode=>{
  const content=await seed({...previousSettings(),decimalesAnalisis:'all'})
  expect(settingsPatchSchema.safeParse({decimalesAnalisis:mode}).success).toBe(false)
  await expect(store.set({decimalesAnalisis:mode})).rejects.toThrow(/ajustes|settings/i)
  expect(await readFile(path,'utf8')).toBe(content)
  expect(await readdir(folder)).toEqual(['settings.json'])
 })

 it('DSET-07 · restablecer sólo esta preferencia a su valor inicial conserva las demás',async()=>{
  const previous={...previousSettings(),decimalesAnalisis:'all'}
  await seed(previous)
  const initial=(defaultSettings() as unknown as Record<string,unknown>)['decimalesAnalisis']
  expect(initial).toBe('auto')
  const expected={...previous,decimalesAnalisis:'auto'}
  expect((await store.set({decimalesAnalisis:initial})).values).toEqual(expected)
  expect(await disk()).toEqual(expected)
  expect((await new SettingsStore(path).get()).values).toEqual(expected)
 })

 it('DSET-08 · una versión futura sigue en sólo lectura y conserva el original sin copia ni migración',async()=>{
  const content=await seed({...previousSettings(),version:99,decimalesAnalisis:'all',futuro:{preservar:true}})
  const state=await store.get()
  expect(state).toMatchObject({readonly:true,migrationPending:false,values:defaultSettings()})
  expect(state.notice).toMatch(/versi[oó]n|version/i)
  expect(await store.migrate({'freya-theme':'dark'})).toMatchObject({readonly:true,migrationPending:false})
  await expect(store.set({tema:'dark'})).rejects.toThrow(/lectura|read.only/i)
  await expect(store.set({decimalesAnalisis:'auto'})).rejects.toThrow(/lectura|read.only/i)
  expect(await readFile(path,'utf8')).toBe(content)
  expect(await readdir(folder)).toEqual(['settings.json'])
 })
})
