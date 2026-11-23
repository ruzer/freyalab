import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {mkdir,mkdtemp,readFile,rm,writeFile,symlink,realpath} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import type {ProjectInfo} from '../src/shared/project'
const native=vi.hoisted(()=>({profile:'',folder:'',holdPath:'',entered:undefined as (()=>void)|undefined,release:undefined as (()=>void)|undefined,ready:async()=>{},handle:vi.fn(),reveal:vi.fn(),contents:{id:1,mainFrame:{},send:vi.fn(),on:vi.fn(),setWindowOpenHandler:vi.fn(),session:{setPermissionRequestHandler:vi.fn(),webRequest:{onBeforeRequest:vi.fn()}}}}))
vi.mock('electron',()=>({
 app:{on:vi.fn(),setPath:vi.fn(),setName:vi.fn(),getPath:()=>native.profile,getVersion:()=> '0.1.0-alpha.4',getPreferredSystemLanguages:()=>['es'],requestSingleInstanceLock:()=>true,isPackaged:true,whenReady:()=>({then:(ready:()=>Promise<void>)=>{native.ready=ready;return{catch:vi.fn()}}})},
 BrowserWindow:class{webContents=native.contents;on=vi.fn();isDestroyed=()=>false;setMenuBarVisibility=vi.fn();loadFile=async()=>{}},
 dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[native.folder]})},ipcMain:{handle:native.handle,on:vi.fn()},shell:{showItemInFolder:native.reveal},clipboard:{},Menu:{buildFromTemplate:vi.fn(),setApplicationMenu:vi.fn()},utilityProcess:{},
}))
vi.mock('../src/main/files',async original=>{
 const actual=await original<typeof import('../src/main/files')>()
 return{...actual,contained:async(root:string,path:string)=>{const allowed=await actual.contained(root,path);if(native.holdPath===path){native.holdPath='';native.entered?.();await new Promise<void>(release=>native.release=release)}return allowed}}
})
vi.mock('../build/icon.png?asset',()=>({default:'icon.png'}))
vi.mock('../src/main/sql-service',()=>({SqlService:class{forget=()=>{}}}))
vi.mock('../src/main/pandoc',async original=>({...await original<typeof import('../src/main/pandoc')>(),detectPandoc:async()=>({available:false,reason:'Prueba sin Pandoc'})}))
vi.mock('../src/main/updates',async original=>({...await original<typeof import('../src/main/updates')>(),UpdatesService:class{startup=async()=>null}}))

type Handler=(event:unknown,operation:string,...args:unknown[])=>Promise<unknown>
let handler:Handler,root:string
const sender=()=>({sender:native.contents,senderFrame:native.contents.mainFrame})
const invoke=(operation:string,...args:unknown[])=>handler(sender(),operation,...args)
const active=async()=>((await invoke('project:state')) as {project:ProjectInfo|null}).project
const create=async()=>{await invoke('project:pickFolder');await invoke('project:create','Censo',false);return(await active())!}
beforeEach(async()=>{
 vi.resetModules();vi.clearAllMocks();native.holdPath='';native.release=undefined;native.entered=undefined
 root=await mkdtemp(join(tmpdir(),'freya-context-reveal-'));native.profile=join(root,'perfil');native.folder=join(root,'proyecto');await mkdir(native.folder)
 vi.stubEnv('FREYALAB_TEST','1');vi.stubEnv('FREYALAB_TEST_OPEN','[]');vi.stubEnv('FREYALAB_USER_DATA',native.profile)
 await import('../src/main/index');await native.ready()
 handler=native.handle.mock.calls.find(([channel])=>channel==='freya')![1] as Handler
})
afterEach(async()=>{try{for(const doc of await invoke('documents') as {id:string}[])await invoke('close',doc.id)}finally{vi.unstubAllEnvs();await rm(root,{recursive:true,force:true})}})

describe('SIM-1h · revelar solo objetos autorizados por main',()=>{
 const chooseFolder=async(path:string)=>{native.folder=path;await invoke('folder')}
 const openDocument=async(path:string)=>{native.folder=path;return(await invoke('open') as {id:string;path:string}[])[0]}
 it('revela la ruta vigente del documento registrado sin cambiar bytes ni devolver rutas',async()=>{
  const path=join(root,'notas á.txt');await writeFile(path,'Texto original\n');const doc=await openDocument(path),before=await readFile(path)
  expect(await invoke('documentShow',doc.id)).toBeUndefined();expect(native.reveal).toHaveBeenCalledExactlyOnceWith(doc.path);expect(await readFile(path)).toEqual(before)
 })
 it('no revela documentos nuevos sin ruta ni acepta una ruta como identidad',async()=>{
  const doc=await invoke('new','text') as {id:string}
  await expect(invoke('documentShow',doc.id)).rejects.toThrow();await expect(invoke('documentShow','/AJENO')).rejects.toThrow();expect(native.reveal).not.toHaveBeenCalled()
 })
 it('rechaza un documento cerrado aunque su ruta siga existiendo',async()=>{
  const path=join(root,'cerrado.txt');await writeFile(path,'Conservar');const doc=await openDocument(path)
  await invoke('close',doc.id);await expect(invoke('documentShow',doc.id)).rejects.toThrow();expect(native.reveal).not.toHaveBeenCalled()
 })
 it('revela archivos y carpetas solo de la raíz actual, incluso con el bypass de pruebas activo',async()=>{
  const folder=join(root,'Carpeta á');await mkdir(folder);const path=join(folder,'notas.txt');await writeFile(path,'Conservar')
  await chooseFolder(folder);expect(await invoke('fileShow',path)).toBeUndefined();expect(await invoke('fileShow',folder)).toBeUndefined()
  expect(native.reveal.mock.calls).toEqual([[await realpath(path)],[await realpath(folder)]]);expect(await readFile(path,'utf8')).toBe('Conservar')
 })
 it('sin carpeta actual no bastan los grants de documentos abiertos',async()=>{
  const path=join(root,'externo.txt');await writeFile(path,'Conservar');await openDocument(path)
  await expect(invoke('fileShow',path)).rejects.toThrow();expect(native.reveal).not.toHaveBeenCalled()
 })
 it('cambiar de carpeta revoca la anterior aunque siga en docs.roots',async()=>{
  const a=join(root,'A'),b=join(root,'B');await mkdir(a);await mkdir(b);const path=join(a,'dato.txt');await writeFile(path,'Conservar')
  await chooseFolder(a);await chooseFolder(b);await expect(invoke('fileShow',path)).rejects.toThrow();expect(native.reveal).not.toHaveBeenCalled()
 })
 it('rechaza prefijos parecidos, traversal, un enlace que sale y destinos inexistentes',async()=>{
  const folder=join(root,'datos'),other=join(root,'datos-ajenos');await mkdir(folder);await mkdir(other);const external=join(other,'dato.txt');await writeFile(external,'Conservar')
  await symlink(other,join(folder,'enlace'),process.platform==='win32'?'junction':'dir');await chooseFolder(folder)
  for(const path of [external,join(folder,'..','datos-ajenos','dato.txt'),join(folder,'enlace','dato.txt'),join(folder,'ausente.txt')])await expect(invoke('fileShow',path)).rejects.toThrow()
  expect(native.reveal).not.toHaveBeenCalled();expect(await readFile(external,'utf8')).toBe('Conservar')
 })
 it('rechaza la raíz anterior si cambia mientras se valida la entrada',async()=>{
  const a=join(root,'A'),b=join(root,'B');await mkdir(a);await mkdir(b);const path=join(a,'dato.txt');await writeFile(path,'Conservar');await chooseFolder(a)
  native.holdPath=await realpath(path);const entered=Promise.withResolvers<void>();native.entered=entered.resolve
  const outcome=invoke('fileShow',path).then(()=>null,error=>error)
  try{await Promise.race([entered.promise,outcome.then(result=>{throw result??new Error('La solicitud no se retuvo en la validación.')})]);await chooseFolder(b)}finally{native.release?.()}
  expect(await outcome).toBeInstanceOf(Error);expect(native.reveal).not.toHaveBeenCalled()
 })
 it.each(['documentShow','fileShow'])('%s conserva la validación estricta de tupla y origen',async operation=>{
  for(const args of [[],[''],[null],[{path:'/AJENO'}],['/AJENO','extra']])await expect(invoke(operation,...args)).rejects.toThrow('Datos de operación no válidos.')
  await expect(handler({sender:{},senderFrame:native.contents.mainFrame},operation,'/AJENO')).rejects.toThrow('Origen no autorizado.')
  await expect(handler({sender:native.contents,senderFrame:{}},operation,'/AJENO')).rejects.toThrow('Origen no autorizado.');expect(native.reveal).not.toHaveBeenCalled()
 })
})
