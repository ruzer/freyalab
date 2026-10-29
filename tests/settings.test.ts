import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {mkdtemp,readFile,writeFile,rm,readdir,copyFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
vi.mock('../src/main/files',async original=>{const actual=await original<typeof import('../src/main/files')>();return{...actual,atomicWrite:vi.fn(actual.atomicWrite)}})
vi.mock('node:fs/promises',async original=>{const actual=await original<typeof import('node:fs/promises')>();return{...actual,readFile:vi.fn(actual.readFile),copyFile:vi.fn(actual.copyFile)}})
import {atomicWrite} from '../src/main/files'
import {SettingsStore} from '../src/main/settings'
import {defaultSettings,settingsSchema,legacySettingsInputSchema} from '../src/shared/settings'
let folder:string,path:string,store:SettingsStore
beforeEach(async()=>{folder=await mkdtemp(join(tmpdir(),'freya-settings-'));path=join(folder,'settings.json');store=new SettingsStore(path)})
afterEach(async()=>{await rm(folder,{recursive:true,force:true});vi.clearAllMocks()})
const disk=async()=>JSON.parse(await readFile(path,'utf8'))
const legacy={'freya-theme':'dark','freya-sidebar':'false','freya-sidebar-width':'320','freya-sidebar-tab':'outline','freya-split':'65'}
describe('APP-03 · modelo y persistencia de ajustes',()=>{
 it('S1 · comparte los valores por omisión y no escribe antes del intento único de migración',async()=>{
  const state=await store.get()
  expect(state).toMatchObject({readonly:false,migrationPending:true,values:{version:1,idioma:'sistema',tema:'system',barraLateral:{visible:true,ancho:240,pestana:'files'},markdown:{modoInicial:'split'},division:50,actualizaciones:{buscarAlIniciar:false,ultimaComprobacion:null,versionesOmitidas:[]},avanzado:{herramientasDeDesarrollo:false}}})
  expect(state.values).toEqual(defaultSettings());expect(await readdir(folder)).toEqual([])
 })
 it('S4 · migra las cinco claves una vez y conserva preferencias posteriores',async()=>{
  const first=await store.migrate(legacy)
  expect(first).toMatchObject({migrationPending:false,values:{tema:'dark',barraLateral:{visible:false,ancho:320,pestana:'outline'},division:65}})
  expect(await disk()).toEqual(first.values)
  await store.set({tema:'light'});await store.migrate({...legacy,'freya-theme':'dark'})
  expect((await store.get()).values.tema).toBe('light')
  expect((await new SettingsStore(path).migrate(legacy)).values.tema).toBe('light')
 })
 it.each([undefined,null,{},'localStorage bloqueado'])('S4 · %j usa defaults y finaliza la migración sin inventar preferencias',async value=>{
  const state=await store.migrate(value);expect(state.values).toEqual(defaultSettings());expect(state.migrationPending).toBe(false);expect(await disk()).toEqual(defaultSettings())
 })
 it('S4 · descarta sólo valores inválidos y no copia claves ajenas',async()=>{
  const state=await store.migrate({...legacy,'freya-sidebar-width':'900','freya-sidebar':'perhaps','freya-split':'Infinity',privatePath:'/CANARIO_PRIVADO/documento.md'})
  expect(state.values).toMatchObject({tema:'dark',barraLateral:{visible:true,ancho:240,pestana:'outline'},division:50})
  expect(JSON.stringify(state.values)).not.toContain('CANARIO_PRIVADO')
 })
 it.each([
  {tema:'purple'}, {idioma:'fr'}, {barraLateral:{ancho:179}}, {barraLateral:{ancho:421}},
  {barraLateral:{visible:'true'}}, {barraLateral:{pestana:'other'}}, {markdown:{modoInicial:'write'}},
  {division:19}, {division:81}, {division:NaN}, {version:2}, {ruta:'/privada'},
  {actualizaciones:{ultimaComprobacion:'mañana'}}, {actualizaciones:{versionesOmitidas:['/Users/CANARIO_PRIVADO']}},
 ])('S2/S13 · rechaza el parche inválido %j sin escribir',async patch=>{
  await store.migrate({});const before=await readFile(path)
  await expect(store.set(patch)).rejects.toThrow(/ajustes|settings/i)
  expect(await readFile(path)).toEqual(before)
 })
 it('S1/S2 · valida objetos anidados estrictos y no admite contenido de documentos',async()=>{
  expect(settingsSchema.safeParse({...defaultSettings(),barraLateral:{...defaultSettings().barraLateral,documento:'CANARIO'}}).success).toBe(false)
  expect(settingsSchema.safeParse({...defaultSettings(),actualizaciones:{...defaultSettings().actualizaciones,url:'https://other.invalid'}}).success).toBe(false)
 })
 it('S3 · un fallo de escritura conserva el archivo y el estado anterior; la cola se recupera',async()=>{
  await store.migrate({});const before=await readFile(path)
  vi.mocked(atomicWrite).mockRejectedValueOnce(Object.assign(new Error('/CANARIO_PRIVADO/disco lleno'),{code:'ENOSPC'}))
  await expect(store.set({tema:'dark'})).rejects.toThrow(/ajustes|settings/i)
  expect(await readFile(path)).toEqual(before);expect((await store.get()).values.tema).toBe('system')
  expect((await store.set({tema:'light'})).values.tema).toBe('light');expect(await readdir(folder)).toEqual(['settings.json'])
 })
 it('S3 · cambios concurrentes del mismo almacén conservan ambos parches',async()=>{
  await store.migrate({});await Promise.all([store.set({tema:'dark'}),store.set({barraLateral:{ancho:300}})])
  expect(await disk()).toMatchObject({tema:'dark',barraLateral:{ancho:300,visible:true,pestana:'files'}})
 })
 it('S3 · dos almacenes escriben JSON válido y prevalece el último cambio',async()=>{
  await store.migrate({});const other=new SettingsStore(path)
  await store.set({tema:'dark'});await other.set({idioma:'en'})
  expect(await disk()).toMatchObject({tema:'dark',idioma:'en'})
  expect(settingsSchema.safeParse(await disk()).success).toBe(true)
 })
 it.each(['{no es JSON','null','{"version":1,"tema":"desconocido"}'])('S5 · conserva %s byte por byte en .bak y recupera defaults con aviso',async content=>{
  await writeFile(path,content);const state=await store.get()
  expect(await readFile(path+'.bak','utf8')).toBe(content);expect(await disk()).toEqual(defaultSettings())
  expect(state.readonly).toBe(false);expect(state.notice).toMatch(/ajustes|settings/i);expect(state.values).toEqual(defaultSettings())
 })
 it('S5 · una copia previa nunca se sobrescribe: conserva original y .bak en modo de sólo lectura',async()=>{
  const content='{datos dañados',backup='COPIA_PREVIA_INTACTA';await writeFile(path,content);await writeFile(path+'.bak',backup)
  const state=await store.get();expect(state.readonly).toBe(true);expect(state.notice).toMatch(/ajustes|settings/i)
  await expect(store.set({tema:'dark'})).rejects.toThrow(/lectura|read.only/i)
  expect(await readFile(path,'utf8')).toBe(content);expect(await readFile(path+'.bak','utf8')).toBe(backup)
 })
 it('S5 · si restaurar defaults falla, conserva el original y su copia',async()=>{
  const content='{no se puede perder';await writeFile(path,content)
  vi.mocked(atomicWrite).mockRejectedValueOnce(Object.assign(new Error('EPERM'),{code:'EPERM'}))
  const state=await store.get();expect(state.readonly).toBe(true)
  expect(await readFile(path,'utf8')).toBe(content);expect(await readFile(path+'.bak','utf8')).toBe(content)
 })
 it('S5 · permisos insuficientes dejan defaults de sólo lectura sin sobrescribir el original ni exponer rutas',async()=>{
  const content=JSON.stringify({...defaultSettings(),tema:'dark'});await writeFile(path,content)
  vi.mocked(readFile).mockRejectedValueOnce(Object.assign(new Error('/CANARIO_PRIVADO/settings.json'),{code:'EACCES'}))
  vi.mocked(copyFile).mockRejectedValueOnce(Object.assign(new Error('/CANARIO_PRIVADO/settings.json.bak'),{code:'EACCES'}))
  const state=await store.get();expect(state).toMatchObject({readonly:true,values:defaultSettings()});expect(state.notice).not.toContain('CANARIO_PRIVADO')
  expect(await readFile(path,'utf8')).toBe(content);expect(await readdir(folder)).toEqual(['settings.json'])
 })
 it('S5 · una versión futura nunca se migra, copia ni sobrescribe',async()=>{
  const content=JSON.stringify({version:2,nuevo:{ruta:'CANARIO_PRIVADO'},tema:'dark'})
  await writeFile(path,content);const state=await store.get()
  expect(state).toMatchObject({readonly:true,migrationPending:false,values:defaultSettings()});expect(state.notice).toMatch(/versi[oó]n|version/i)
  expect(await store.migrate(legacy)).toMatchObject({readonly:true});await expect(store.set({tema:'light'})).rejects.toThrow(/lectura|read.only/i)
  expect(await readFile(path,'utf8')).toBe(content);expect(await readdir(folder)).toEqual(['settings.json'])
 })
 it('S5 · detecta una versión futura escrita por otra copia después de cargar',async()=>{
  await store.migrate({});const content='{"version":99,"preservar":true}';await writeFile(path,content)
  await expect(store.set({tema:'dark'})).rejects.toThrow(/lectura|read.only/i);expect(await readFile(path,'utf8')).toBe(content)
 })
 it('S13 · almacena sólo campos propios y devuelve copias que no alteran la fuente de verdad',async()=>{
  await store.migrate(legacy);await store.set({actualizaciones:{ultimaComprobacion:'2026-10-28T00:00:00.000Z',versionesOmitidas:['0.1.0-alpha.10','0.1.0-beta.1']}})
  const state=await store.get();state.values.barraLateral.ancho=190;state.values.actualizaciones.versionesOmitidas.push('9.9.9')
  expect(Object.keys(state).sort()).toEqual(['migrationPending','readonly','values'])
  const persisted=await disk();expect(persisted.barraLateral.ancho).toBe(320);expect(persisted.actualizaciones.versionesOmitidas).toHaveLength(2)
  expect(JSON.stringify(persisted)).not.toMatch(/CANARIO|Users|\/private\/|documento\.md/)
 })
})
it('S4/S8 · conserva anchos y divisiones fraccionarios que el explorador actual admite',async()=>{
 const state=await store.migrate({'freya-sidebar-width':'240.5','freya-split':'48.25'})
 expect(state.values.barraLateral.ancho).toBe(240.5);expect(state.values.division).toBe(48.25)
})
it('S3/S5 · no sustituye una versión futura que aparece entre la lectura y el guardado',async()=>{
 await store.migrate({});const future='{"version":99,"preservar":"VERSION_FUTURA"}'
 const actual=await vi.importActual<typeof import('../src/main/files')>('../src/main/files')
 vi.mocked(atomicWrite).mockImplementationOnce(async(path,data,expected)=>{await writeFile(path,future);return actual.atomicWrite(path,data,expected)})
 await expect(store.set({tema:'dark'})).rejects.toThrow(/ajustes|settings/i)
 expect(await readFile(path,'utf8')).toBe(future)
})
it('S5 · no restaura defaults sobre una versión futura escrita después del respaldo',async()=>{
 const broken='{ARCHIVO_DAÑADO',future='{"version":99,"preservar":"FUTURO_DURANTE_RECUPERACION"}'
 await writeFile(path,broken)
 const actual=await vi.importActual<typeof import('../src/main/files')>('../src/main/files')
 vi.mocked(atomicWrite).mockImplementationOnce(async(path,data,expected)=>{await writeFile(path,future);return actual.atomicWrite(path,data,expected)})
 const state=await store.get()
 expect(state.readonly).toBe(true);expect(await readFile(path,'utf8')).toBe(future);expect(await readFile(path+'.bak','utf8')).toBe(broken)
})
it('S5 · conserva una versión futura que sustituye el archivo dañado antes de copiarlo',async()=>{
 const broken='{ANTES_DE_LA_COPIA',future='{"version":99,"preservar":"FUTURO_ANTES_DE_COPIAR"}'
 await writeFile(path,broken)
 const actual=await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
 vi.mocked(copyFile).mockImplementationOnce(async(source,destination,flags)=>{await writeFile(source,future);return actual.copyFile(source,destination,flags)})
 const state=await store.get()
 expect(state.readonly).toBe(true);expect(await readFile(path,'utf8')).toBe(future);expect(await readFile(path+'.bak','utf8')).toBe(future)
})
it('S5 · una lectura sin bytes fiables nunca autoriza restaurar defaults aunque copiar funcione',async()=>{
 const future='{"version":99,"preservar":"NO_SE_PUDO_LEER"}';await writeFile(path,future)
 vi.mocked(readFile).mockRejectedValueOnce(Object.assign(new Error('EACCES'),{code:'EACCES'}))
 const state=await store.get()
 expect(state.readonly).toBe(true);expect(await readFile(path,'utf8')).toBe(future);expect(await readFile(path+'.bak','utf8')).toBe(future)
})
it('S3/S5 · tras recuperar usa el digest nuevo al guardar un parche dentro de la misma operación',async()=>{
 const broken='{RESTABLECER_Y_APLICAR';await writeFile(path,broken)
 const state=await store.set({tema:'dark'})
 expect(state.values.tema).toBe('dark');expect((await disk()).tema).toBe('dark');expect(await readFile(path+'.bak','utf8')).toBe(broken);expect(state.notice).toMatch(/ajustes|settings/i)
})

it('S4 · contrato de migración acepta sólo las cinco claves crudas sin reinterpretarlas',()=>{
 expect(legacySettingsInputSchema.parse(legacy)).toEqual(legacy)
 expect(legacySettingsInputSchema.parse({})).toEqual({})
 expect(legacySettingsInputSchema.parse({'freya-theme':'VALOR_ANTERIOR_INVALIDO'})).toEqual({'freya-theme':'VALOR_ANTERIOR_INVALIDO'})
})
it('S4/S13 · contrato de migración rechaza claves ajenas y valores que no vienen de localStorage',()=>{
 expect(legacySettingsInputSchema.safeParse({...legacy,ruta:'/CANARIO_PRIVADO'}).success).toBe(false)
 for(const value of[null,[],{'freya-theme':true},{'freya-sidebar-width':300}])expect(legacySettingsInputSchema.safeParse(value).success).toBe(false)
})

it('S3/S8 · el cierre espera los ajustes pendientes antes de terminar',async()=>{
 await store.migrate({})
 const actual=await vi.importActual<typeof import('../src/main/files')>('../src/main/files')
 let release!:()=>void,started!:()=>void
 const gate=new Promise<void>(resolve=>{release=resolve}),entered=new Promise<void>(resolve=>{started=resolve})
 vi.mocked(atomicWrite).mockImplementationOnce(async(path,data,expected)=>{started();await gate;return actual.atomicWrite(path,data,expected)})
 const writing=store.set({tema:'dark'});await entered
 try{let finished=false;const flushing=store.flush().then(()=>{finished=true});await Promise.resolve();expect(finished).toBe(false);release();await flushing;expect(finished).toBe(true)}finally{release();await writing}
 expect((await disk()).tema).toBe('dark')
})
