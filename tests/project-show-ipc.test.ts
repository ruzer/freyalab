import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import type {ProjectInfo} from '../src/shared/project'
const native=vi.hoisted(()=>({profile:'',folder:'',ready:async()=>{},handle:vi.fn(),reveal:vi.fn(),contents:{id:1,mainFrame:{},send:vi.fn(),on:vi.fn(),setWindowOpenHandler:vi.fn(),session:{setPermissionRequestHandler:vi.fn(),webRequest:{onBeforeRequest:vi.fn()}}}}))
vi.mock('electron',()=>({
 app:{on:vi.fn(),setPath:vi.fn(),setName:vi.fn(),getPath:()=>native.profile,getVersion:()=> '0.1.0-alpha.4',getPreferredSystemLanguages:()=>['es'],requestSingleInstanceLock:()=>true,isPackaged:true,whenReady:()=>({then:(ready:()=>Promise<void>)=>{native.ready=ready;return{catch:vi.fn()}}})},
 BrowserWindow:class{webContents=native.contents;on=vi.fn();isDestroyed=()=>false;setMenuBarVisibility=vi.fn();loadFile=async()=>{}},
 dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[native.folder]})},ipcMain:{handle:native.handle,on:vi.fn()},shell:{showItemInFolder:native.reveal},clipboard:{},Menu:{buildFromTemplate:vi.fn(),setApplicationMenu:vi.fn()},utilityProcess:{},
}))
vi.mock('../build/icon.png?asset',()=>({default:'icon.png'}))
vi.mock('../src/main/sql-service',()=>({SqlService:class{}}))
vi.mock('../src/main/pandoc',async original=>({...await original<typeof import('../src/main/pandoc')>(),detectPandoc:async()=>({available:false,reason:'Prueba sin Pandoc'})}))
vi.mock('../src/main/updates',async original=>({...await original<typeof import('../src/main/updates')>(),UpdatesService:class{startup=async()=>null}}))

type Handler=(event:unknown,operation:string,...args:unknown[])=>Promise<unknown>
let handler:Handler,root:string
const sender=()=>({sender:native.contents,senderFrame:native.contents.mainFrame})
const invoke=(operation:string,...args:unknown[])=>handler(sender(),operation,...args)
const active=async()=>((await invoke('project:state')) as {project:ProjectInfo|null}).project
const create=async()=>{await invoke('project:pickFolder');await invoke('project:create','Censo',false);return(await active())!}
beforeEach(async()=>{
 vi.resetModules();vi.clearAllMocks()
 root=await mkdtemp(join(tmpdir(),'freya-project-show-'));native.profile=join(root,'perfil');native.folder=join(root,'proyecto')
 vi.stubEnv('FREYALAB_TEST','1');vi.stubEnv('FREYALAB_TEST_OPEN','[]');vi.stubEnv('FREYALAB_USER_DATA',native.profile)
 await import('../src/main/index');await native.ready()
 handler=native.handle.mock.calls.find(([channel])=>channel==='freya')![1] as Handler
})
afterEach(async()=>{vi.unstubAllEnvs();await rm(root,{recursive:true,force:true})})

describe('PRJ-01c · project:show por el IPC público',()=>{
 it('revela sólo el manifiesto del proyecto activo y no devuelve una ruta ni modifica sus bytes',async()=>{
  const project=await create(),manifest=join(project.path,'proyecto.freyalab'),before=await readFile(manifest)
  expect(await invoke('project:show',project.id)).toBeUndefined()
  expect(native.reveal).toHaveBeenCalledExactlyOnceWith(manifest);expect(await readFile(manifest)).toEqual(before)
 })
 it('admite el id no UUID de una versión futura en solo lectura',async()=>{
  const project=await create(),manifest=join(project.path,'proyecto.freyalab'),bytes='{"format":"freyalab-project","version":2,"id":"future","name":"El futuro","datosDesconocidos":{"keep":true}}'
  await invoke('project:close',project.id);await writeFile(manifest,bytes)
  expect((await create()).readonly).toBe(true)
  expect(await invoke('project:show','future')).toBeUndefined()
  expect(native.reveal).toHaveBeenCalledExactlyOnceWith(manifest);expect(await readFile(manifest,'utf8')).toBe(bytes)
 })
 it('admite la ruta de respaldo mayor de cien caracteres de un proyecto futuro sin id',async()=>{
  native.folder=join(root,'proyecto-'+ 'x'.repeat(110))
  const initial=await create(),manifest=join(initial.path,'proyecto.freyalab'),bytes='{"format":"freyalab-project","version":2,"name":"El futuro","datosDesconocidos":{"keep":true}}'
  await invoke('project:close',initial.id);await writeFile(manifest,bytes)
  const project=await create()
  expect(project.readonly).toBe(true);expect(project.id).toBe(project.path);expect(project.id.length).toBeGreaterThan(100)
  expect(await invoke('project:show',project.id)).toBeUndefined()
  expect(native.reveal).toHaveBeenCalledExactlyOnceWith(manifest);expect(await readFile(manifest,'utf8')).toBe(bytes)
 })
 it('rechaza la operación sin proyecto activo',async()=>{
  await expect(invoke('project:show','future')).rejects.toThrow('Referencia de proyecto inválida.');expect(native.reveal).not.toHaveBeenCalled()
 })
 it('rechaza otro id, incluido el de un proyecto ya cerrado',async()=>{
  const project=await create()
  await expect(invoke('project:show','otro-proyecto')).rejects.toThrow('Referencia de proyecto inválida.')
  await invoke('project:close',project.id)
  await expect(invoke('project:show',project.id)).rejects.toThrow('Referencia de proyecto inválida.');expect(native.reveal).not.toHaveBeenCalled()
 })
 it.each([[],[''],['x'.repeat(32769)],[null],[{id:'future',path:'/AJENO'}],['future','/AJENO']].map(args=>({args})))('valida la tupla y rechaza argumentos arbitrarios $args',async({args})=>{
  await expect(invoke('project:show',...args)).rejects.toThrow('Datos de operación no válidos.');expect(native.reveal).not.toHaveBeenCalled()
 })
 it('mantiene la validación de origen del canal',async()=>{
  const project=await create()
  await expect(handler({sender:{},senderFrame:native.contents.mainFrame},'project:show',project.id)).rejects.toThrow('Origen no autorizado.')
  await expect(handler({sender:native.contents,senderFrame:{}},'project:show',project.id)).rejects.toThrow('Origen no autorizado.');expect(native.reveal).not.toHaveBeenCalled()
 })
})
