import * as chokidar from 'chokidar'
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {createHash} from 'node:crypto'
import fs,{mkdtemp,mkdir,readFile,rm,stat,symlink,utimes,writeFile} from 'node:fs/promises'
import {syncBuiltinESMExports} from 'node:module'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {ProjectStore} from '../src/main/projects'
import {ProjectSourceRegistry} from '../src/main/project-source-registry'
import {ProjectExports} from '../src/main/project-exports'
import {runRecipe} from '../src/main/recipe-operation'
import {projectFile,type ProjectRecipeStep,type ProjectResult} from '../src/shared/project'
import type {RecipeOperationSource} from '../src/shared/recipe-operation'
import type {DocumentInfo} from '../src/shared/types'
import {t} from '../src/shared/i18n'

vi.mock('chokidar',async importOriginal=>{const actual=await importOriginal<typeof import('chokidar')>();return{...actual,watch:vi.fn(actual.watch)}})
vi.mock('electron',()=>({BrowserWindow:{getFocusedWindow:()=>undefined,getAllWindows:()=>[]},dialog:{showSaveDialog:vi.fn()}}))
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex')
const canonical=(value:unknown)=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item)
const expected=Buffer.from('ID,Edad,Nota\n00128,61\n00126,52,ok\n00123,34,"línea 1\nlínea 2"\n')
let root:string,folder:string,nativeFolder:string,file:string,input:string,original:Buffer,id:string,recipeId:string,store:ProjectStore,sources:ProjectSourceRegistry,service:ProjectExports
let initialService:ProjectExports,watcherOffset:number
let choose:ReturnType<typeof vi.fn<(name:string,folder:string)=>Promise<string|null>>>,worker:{call:ReturnType<typeof vi.fn<(method:string,...args:unknown[])=>Promise<unknown>> >}
let docs:{records:Map<string,{info:DocumentInfo}>;assertWritableDestination:ReturnType<typeof vi.fn>;writeProjectDestination:ReturnType<typeof vi.fn>;open:ReturnType<typeof vi.fn>;get:ReturnType<typeof vi.fn>;info:ReturnType<typeof vi.fn>}
beforeEach(async()=>{
 watcherOffset=vi.mocked(chokidar.watch).mock.results.length
 root=await mkdtemp(join(tmpdir(),'freya-project-exports-'));folder=join(root,'Proyecto');await mkdir(folder)
 const profile=join(root,'profile');await mkdir(profile);store=new ProjectStore(profile);nativeFolder=folder;const project=await store.create(folder,'Censo',true);id=project.id;folder=project.path;file=join(folder,projectFile)
 input=join(folder,'01_raw','censo.csv');original=await readFile(new URL('./fixtures/prj02-censo.csv',import.meta.url));await writeFile(input,original)
 sources=new ProjectSourceRegistry(store,async()=>false,()=>{})
 const draft=await sources.prepare(input,{},true);await sources.register(id,draft.id,{},undefined,undefined,async()=>true)
 const columns=store.sources[0].schema.columns
 await store.saveRecipe(id,{name:'Oaxaca, adultos',sourceId:store.sources[0].id,steps:[{op:'filter',mode:'all',conditions:[{column:columns[1],op:'equals',value:'Oaxaca',caseSensitive:true},{column:columns[2],op:'greaterEqual',value:'18',caseSensitive:true}]},{op:'order',by:[{column:columns[2],numeric:true,descending:true}]},{op:'select',columns:[columns[0],columns[2],columns[4]]}]},async()=>true);recipeId=store.recipes[0].id
 const cancelled=new Set<string>()
 worker={call:vi.fn(async(method:string,...args:unknown[])=>{
  if(method==='recipeCancel'){cancelled.add(String(args[0]));return}
  if(method!=='recipeExtract')throw new Error('unexpected worker method: '+method)
  const [request,source,steps,output,projectRoot]=args as [string,RecipeOperationSource,ProjectRecipeStep[],string,string?]
  return runRecipe(source,steps,{cancelled:()=>cancelled.has(request)},{operation:'recipe_extract',output,...projectRoot?{projectRoot}:{}})
 })}
 const records=new Map<string,{info:DocumentInfo}>()
 docs={records,assertWritableDestination:vi.fn(),writeProjectDestination:vi.fn(async(_path:string,write:()=>Promise<unknown>)=>write()),
  open:vi.fn(async(path:string)=>{const info={id:'opened',name:path.split(/[\\/]/).at(-1)!,path,kind:'csv',dirty:false,readonly:false,revision:0,encoding:'utf8',delimiter:',',hasHeader:true} as DocumentInfo;records.set(info.id,{info});return info}),
  get:vi.fn((key:string)=>records.get(key)!),info:vi.fn((key:string)=>records.get(key)!.info)}
 choose=vi.fn(async()=>join(folder,'02_datasets','adultos.csv'))
 service=new ProjectExports(store,sources,worker,docs as unknown as ConstructorParameters<typeof ProjectExports>[3],choose);initialService=service
})
afterEach(async()=>{
 try{
  await Promise.all([service.close(),initialService===service?Promise.resolve():initialService.close()])
  const watchers=vi.mocked(chokidar.watch).mock.results.slice(watcherOffset).filter(item=>item.type==='return').map(item=>item.value)
  expect(watchers.every(watcher=>watcher.closed),'todos los watchers del caso deben cerrarse desde sus instancias').toBe(true)
  if(input&&original)expect(await readFile(input)).toEqual(original)
 }finally{await rm(root,{recursive:true,force:true})}
})
async function manifest(){return JSON.parse(await readFile(file,'utf8'))}
async function exportOne(request='request'){
 const outcome=await service.export(id,recipeId,request,async()=>true)
 expect(outcome?.status).toBe('registered')
 if(outcome?.status!=='registered')throw new Error('expected registered export')
 return outcome.result
}
async function unregistered(){
 await writeFile(file,JSON.stringify({...await manifest(),name:'Cambio externo'}))
 const outcome=await service.export(id,recipeId,'request',async()=>false)
 expect(outcome?.status).toBe('unregistered')
 if(outcome?.status!=='unregistered')throw new Error('expected unregistered export')
 return outcome.result
}

describe('PRJ-03 · coordinador de exportaciones con I/O real',()=>{
 it('exporta los bytes del fixture y persiste huellas e instantánea canónica de ejecución',async()=>{
  const recipe=structuredClone(store.recipes[0]),result=await exportOne(),path=join(folder,result.path)
  expect(choose).toHaveBeenCalledWith('Oaxaca, adultos.csv',join(folder,'02_datasets'))
  expect(await readFile(path)).toEqual(expected)
  expect(result).toMatchObject({path:'02_datasets/adultos.csv',bytes:expected.length,sha256:sha(expected),mtimeMs:(await stat(path)).mtimeMs,status:'verified',isSource:false,
   provenance:{sourceSha256:sha(original),coverage:{kind:'filtered',matched:3,scanned:7,total:7,complete:true},fidelity:{level:'values'},chain:[recipeId],recipeSha256:{[recipeId]:sha(canonical(recipe))},snapshot:{sourceName:'censo.csv',columns:['ID','Edad','Nota'],recipes:[recipe]}}})
  expect(result.createdAt).toBe(result.provenance.executedAt)
  expect((await manifest()).results).toEqual(store.results);expect(store.results).toHaveLength(1)
  expect(worker.call).toHaveBeenCalledWith('recipeExtract','request',expect.objectContaining({path:input,sha256:sha(original)}),recipe.steps,path,folder)
 })
 it('acepta la ruta nativa equivalente del selector dentro del proyecto',async()=>{
  expect(await fs.realpath(join(nativeFolder,'02_datasets'))).toBe(join(folder,'02_datasets'))
  choose.mockResolvedValueOnce(join(nativeFolder,'02_datasets','native.csv'))
  const result=await exportOne()
  expect(result.path).toBe('02_datasets/native.csv');expect(await readFile(join(folder,result.path))).toEqual(expected)
 })
 it('conserva archivo y contexto pendiente tras un conflicto de registro rechazado',async()=>{
  const result=await unregistered()
  expect(store.results).toEqual([]);expect((await manifest()).name).toBe('Cambio externo')
  expect(await readFile(join(folder,result.path))).toEqual(expected)
  expect(await service.path(id,result.id)).toBe(join(folder,result.path))
  const retried=await service.register(id,result.id,async()=>true)
  expect(retried.status).toBe('registered');expect(store.results).toHaveLength(1)
  expect(store.results[0].provenance.snapshot).toEqual(result.provenance.snapshot)
 })
 it('rechaza registrar de nuevo si los bytes del archivo cambiaron',async()=>{
  const result=await unregistered(),before=await readFile(file),path=join(folder,result.path)
  const changed=Buffer.from(expected.toString().replace('00128','99128'));expect(changed.length).toBe(expected.length);await writeFile(path,changed)
  await expect(service.register(id,result.id,async()=>true)).rejects.toThrow(t('project.export.changed'))
  expect(store.results).toEqual([]);expect(await readFile(file)).toEqual(before);expect(await readFile(path)).toEqual(changed)
 })
 it('un cambio solo de mtime permite el reintento con fecha real y ejecución original',async()=>{
  const result=await unregistered(),path=join(folder,result.path),previous=await stat(path),newTime=new Date(previous.mtimeMs+2000)
  await utimes(path,newTime,newTime);const changed=await stat(path);expect(changed.mtimeMs).not.toBe(result.mtimeMs)
  const retried=await service.register(id,result.id,async()=>true)
  expect(retried.status).toBe('registered')
  expect(store.results[0]).toMatchObject({mtimeMs:changed.mtimeMs,createdAt:result.createdAt,provenance:result.provenance})
  expect(await readFile(path)).toEqual(expected)
 })
 it('dos exportaciones concurrentes registran ambos archivos sin perder resultados',async()=>{
  choose.mockImplementationOnce(async()=>join(folder,'02_datasets','uno.csv')).mockImplementationOnce(async()=>join(folder,'02_datasets','dos.csv'))
  const results=await Promise.all([service.export(id,recipeId,'one',async()=>true),service.export(id,recipeId,'two',async()=>true)])
  expect(results.map(item=>item?.status)).toEqual(['registered','registered'])
  expect(store.results.map(item=>item.path).sort()).toEqual(['02_datasets/dos.csv','02_datasets/uno.csv'])
  for(const result of store.results)expect(await readFile(join(folder,result.path))).toEqual(expected)
 })
 it('cancela el selector y una solicitud propia antes de publicar sin crear resultados',async()=>{
  choose.mockResolvedValueOnce(null);expect(await service.export(id,recipeId,'cancel-dialog',async()=>true)).toBeNull()
  let release!:(path:string)=>void;choose.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve}))
  const pending=service.export(id,recipeId,'cancel-job',async()=>true)
  await vi.waitFor(()=>expect(choose).toHaveBeenCalledTimes(2));await service.cancel('foreign');expect(worker.call).not.toHaveBeenCalled()
  await service.cancel('cancel-job');release(join(folder,'02_datasets','cancel.csv'))
  expect(await pending).toEqual({status:'cancelled'});expect(worker.call).toHaveBeenCalledWith('recipeCancel','cancel-job')
  expect(store.results).toEqual([])
 })
 it('abrir conserva procedencia, añadir como fuente reutiliza formato y quitar no borra el archivo',async()=>{
  const result=await exportOne(),path=join(folder,result.path),document=await service.open(id,result.id)
  expect(docs.open).toHaveBeenCalledWith(path);expect(document).toMatchObject({projectResult:{projectId:id,id:result.id,provenance:result.provenance}})
  const prepared=await service.prepareSource(id,result.id)
  expect(prepared).toMatchObject({path,format:{encoding:'utf8',delimiter:',',header:true,eol:'\n'},columns:[{position:1,name:'ID'},{position:2,name:'Edad'},{position:3,name:'Nota'}]})
  await sources.register(id,prepared.id,{},undefined,undefined,async()=>true)
  expect((await service.list())[0].isSource).toBe(true)
  await expect(service.prepareSource(id,result.id)).rejects.toThrow(t('project.export.isSource'))
  expect(await service.forget(id,result.id,async()=>true)).toBe(true)
  expect(store.results).toEqual([]);expect(await readFile(path)).toEqual(expected)
 })
 it.each(['absolute','parent','drive','unc','linked-parent'])('confina una ruta de manifiesto %s antes de leer o abrir su archivo',async variant=>{
  const exported=await exportOne(),outside=join(root,'outside');await mkdir(outside);await writeFile(join(outside,'adultos.csv'),expected)
  const paths={absolute:join(outside,'adultos.csv'),parent:'../outside/adultos.csv',drive:'C:\\outside\\adultos.csv',unc:'\\\\server\\share\\adultos.csv','linked-parent':'linked/adultos.csv'}
  if(variant==='linked-parent')await symlink(outside,join(folder,'linked'),process.platform==='win32'?'junction':'dir')
  await writeFile(file,JSON.stringify({...await manifest(),results:[{...store.results[0],path:paths[variant as keyof typeof paths]}]}));await store.open(folder)
  docs.open.mockClear();const opened=vi.spyOn(fs,'open');syncBuiltinESMExports()
  try{
   await expect(service.path(id,exported.id)).rejects.toThrow(t('project.export.inside'))
   await expect(service.open(id,exported.id)).rejects.toThrow(t('project.export.inside'))
   await expect(service.prepareSource(id,exported.id)).rejects.toThrow(t('project.export.inside'))
   expect((await service.list())[0].status).toBe('changed');expect(opened).not.toHaveBeenCalled();expect(docs.open).not.toHaveBeenCalled()
  }finally{opened.mockRestore();syncBuiltinESMExports()}
 })
 it.each(['outside','protected','open','symlink','extension'])('rechaza el destino %s antes de llamar al motor',async variant=>{
  let path=join(folder,'02_datasets','reject.csv')
  if(variant==='outside')path=join(root,'reject.csv')
  if(variant==='protected')path=input
  if(variant==='open'){await writeFile(path,'ID\nold\n');docs.records.set('open',{info:{id:'open',path} as DocumentInfo})}
  if(variant==='symlink')await symlink(input,path,'file')
  if(variant==='extension')path=join(folder,'02_datasets','reject.xlsx')
  choose.mockResolvedValueOnce(path)
  const key={outside:'project.export.inside',protected:'project.export.protected',open:'extract.error.open',symlink:'extract.error.symlink',extension:'extract.error.extension'}[variant]!
  await expect(service.export(id,recipeId,'reject',async()=>true)).rejects.toThrow(t(key))
  expect(worker.call).not.toHaveBeenCalled();expect(docs.writeProjectDestination).not.toHaveBeenCalled();expect(store.results).toEqual([])
  if(variant==='open')expect(await readFile(path,'utf8')).toBe('ID\nold\n')
 })
 it('olvida el contexto del documento solo cuando el registro se quita de verdad',async()=>{
  const result=await exportOne(),document=await service.open(id,result.id),path=join(folder,result.path)
  const context=structuredClone((document as DocumentInfo&{projectResult?:unknown}).projectResult)
  expect(context).toBeTruthy()
  await writeFile(file,JSON.stringify({...await manifest(),name:'Cambio externo'}))
  expect(await service.forget(id,result.id,async()=>false)).toBe(false)
  expect((document as DocumentInfo&{projectResult?:unknown}).projectResult).toEqual(context)
  expect(await service.forget(id,result.id,async()=>true)).toBe(true)
  expect(store.results).toEqual([]);expect(await readFile(path)).toEqual(expected)
  expect(document).not.toHaveProperty('projectResult')
 })
 it('un fallo de la versión vieja no marca cambiada una fuente ya registrada de nuevo',async()=>{
  const oldSha=sha(original),sourceId=store.sources[0].id,run=worker.call.getMockImplementation()!
  const updated=Buffer.from(original.toString().replace('00128,Oaxaca,61,5000','00128,Oaxaca,62,5000'))
  expect(updated).not.toEqual(original)
  worker.call.mockImplementationOnce(async(method:string,...args:unknown[])=>{
   await writeFile(input,updated);original=updated
   try{return await run(method,...args)}catch(error){
    expect(error).toHaveProperty('code','changed')
    await sources.reregister(id,sourceId,undefined,undefined,async()=>true)
    throw error
   }
  })
  await expect(service.export(id,recipeId,'old-version',async()=>true)).rejects.toThrow(t('project.source.changed'))
  expect(store.sources[0]).toMatchObject({sha256:sha(updated),history:[oldSha]})
  expect((await sources.list())[0].status).toBe('verified')
 })
 it('no registra en otra carpeta con los mismos ids abierta al terminar el motor',async()=>{
  const clone=join(root,'Clon');await mkdir(join(clone,'01_raw'),{recursive:true})
  await writeFile(join(clone,projectFile),await readFile(file));await writeFile(join(clone,'01_raw','censo.csv'),original)
  const run=worker.call.getMockImplementation()!
  worker.call.mockImplementationOnce(async(method:string,...args:unknown[])=>{
   const produced=await run(method,...args)
   await store.open(clone)
   return produced
  })
  const outcome=await service.export(id,recipeId,'switched-project',async()=>true)
  expect(store.active).toMatchObject({id,path:await fs.realpath(clone)})
  expect(outcome?.status).toBe('unregistered')
  expect(store.results).toEqual([]);expect(JSON.parse(await readFile(join(clone,projectFile),'utf8')).results).toEqual([])
  expect(await readFile(join(folder,'02_datasets','adultos.csv'))).toEqual(expected)
 })
 it('anuncia cambios y borrado del archivo exportado sin abrirlo como documento',async()=>{
  const changed=vi.fn(),offset=vi.mocked(chokidar.watch).mock.calls.length
  service=new ProjectExports(store,sources,worker,docs as unknown as ConstructorParameters<typeof ProjectExports>[3],choose,changed)
  const result=await exportOne(),path=join(folder,result.path)
  await service.list()
  const watchers=vi.mocked(chokidar.watch).mock.results.slice(offset).filter(item=>item.type==='return').map(item=>item.value)
  await Promise.all(watchers.filter(watcher=>!watcher.closed).map(watcher=>watcher.readyEmitted?Promise.resolve():new Promise<void>(resolve=>watcher.once('ready',()=>resolve()))))
  changed.mockClear();await writeFile(path,Buffer.concat([expected,Buffer.from('00199,19,ok\n')]))
  await vi.waitFor(()=>expect(changed).toHaveBeenCalled())
  expect((await service.list())[0].status).toBe('changed');expect(docs.open).not.toHaveBeenCalled()
  changed.mockClear();await rm(path)
  await vi.waitFor(()=>expect(changed).toHaveBeenCalled())
  expect((await service.list())[0].status).toBe('missing');expect(docs.open).not.toHaveBeenCalled()
 })
 it('vigila solo rutas confinadas y cancelCurrent cierra la vigilancia sin callbacks tardíos',async()=>{
  const changed=vi.fn(),offset=vi.mocked(chokidar.watch).mock.calls.length
  service=new ProjectExports(store,sources,worker,docs as unknown as ConstructorParameters<typeof ProjectExports>[3],choose,changed)
  const result=await exportOne(),path=join(folder,result.path),outside=join(root,'outside')
  await mkdir(outside);await writeFile(join(outside,'export.csv'),expected)
  await symlink(outside,join(folder,'linked'),process.platform==='win32'?'junction':'dir')
  const saved=await manifest(),record=store.results[0]
  await writeFile(file,JSON.stringify({...saved,results:[record,{...record,id:'parent-escape',path:'../outside/export.csv'},{...record,id:'linked-escape',path:'linked/export.csv'}]}));await store.open(folder)
  const views=await service.list();expect(views.slice(1).map(view=>view.status)).toEqual(['changed','changed'])
  const watchers=vi.mocked(chokidar.watch).mock.results.slice(offset).filter(item=>item.type==='return').map(item=>item.value)
  await Promise.all(watchers.filter(watcher=>!watcher.closed).map(watcher=>watcher.readyEmitted?Promise.resolve():new Promise<void>(resolve=>watcher.once('ready',()=>resolve()))))
  expect(watchers.length).toBeGreaterThan(0)
  expect(vi.mocked(chokidar.watch).mock.calls.slice(offset).flatMap(([paths])=>typeof paths==='string'?[paths]:paths)).toEqual([path])
  const actual=await vi.importActual<typeof import('chokidar')>('chokidar'),control=actual.watch(path,{ignoreInitial:true})
  let controlError:unknown,rejectControl:((error:unknown)=>void)|undefined
  control.on('error',error=>{controlError=error;rejectControl?.(error)})
  const waitControl=(event:'ready'|'change')=>new Promise<void>((resolve,reject)=>{
   if(controlError){reject(controlError);return}
   const done=()=>{rejectControl=undefined;resolve()}
   rejectControl=error=>{control.off(event,done);rejectControl=undefined;reject(error)}
   control.once(event,done)
  })
  try{
   if(!control.readyEmitted)await waitControl('ready')
   await service.cancelCurrent();expect(watchers.every(watcher=>watcher.closed)).toBe(true);changed.mockClear()
   await Promise.all([waitControl('change'),writeFile(path,Buffer.concat([expected,Buffer.from('00199,19,ok\n')]))])
   expect(changed).not.toHaveBeenCalled();expect(docs.open).not.toHaveBeenCalled()
  }finally{await control.close();expect(control.closed).toBe(true);if(controlError)throw controlError}
 })
 it('conserva contexto pendiente si fallan los metadatos tras rename real y registra al reintentar',async()=>{
  const output=join(folder,'02_datasets','adultos.csv'),recipe=structuredClone(store.recipes[0])
  const realRename=fs.rename,realStat=fs.stat,realLstat=fs.lstat,realReadFile=fs.readFile
  let published=false,pending:Extract<Awaited<ReturnType<ProjectExports['export']>>,{status:'unregistered'}>|undefined
  const denied=(syscall:string)=>Object.assign(new Error('controlled metadata denial'),{code:'EACCES',syscall})
  const renameSpy=vi.spyOn(fs,'rename').mockImplementation(async(from,to)=>{await realRename(from,to);if(String(to)===output)published=true})
  const statSpy=vi.spyOn(fs,'stat').mockImplementation(((...args:Parameters<typeof fs.stat>)=>published&&String(args[0])===output?Promise.reject(denied('stat')):realStat(...args)) as typeof fs.stat)
  const lstatSpy=vi.spyOn(fs,'lstat').mockImplementation(((...args:Parameters<typeof fs.lstat>)=>published&&String(args[0])===output?Promise.reject(denied('lstat')):realLstat(...args)) as typeof fs.lstat)
  syncBuiltinESMExports()
  try{
   let outcome:Awaited<ReturnType<ProjectExports['export']>>|undefined,failure:unknown
   try{outcome=await service.export(id,recipeId,'metadata-error',async()=>true)}catch(error){failure=error}
   expect(published).toBe(true);expect(await realReadFile(output)).toEqual(expected)
   expect(sha(await realReadFile(input))).toBe(sha(original));expect(store.results).toEqual([])
   expect(failure,'el archivo ya publicado debe conservar una acción para registrar de nuevo').toBeUndefined()
   expect(outcome?.status).toBe('unregistered')
   if(outcome?.status==='unregistered')pending=outcome
   expect(pending?.result).toMatchObject({sha256:sha(expected),provenance:{sourceSha256:sha(original),snapshot:{sourceName:'censo.csv',columns:['ID','Edad','Nota'],recipes:[recipe]}}})
  }finally{renameSpy.mockRestore();statSpy.mockRestore();lstatSpy.mockRestore();syncBuiltinESMExports()}
  if(!pending)throw new Error('expected pending registration context')
  const retried=await service.register(id,pending.result.id,async()=>true)
  expect(retried).toMatchObject({status:'registered',result:{id:pending.result.id,sha256:sha(expected),createdAt:pending.result.createdAt,provenance:pending.result.provenance}})
  expect(await realReadFile(output)).toEqual(expected)
 })
 it('rechaza un directorio padre sustituido antes del motor sin escribir fuera del proyecto',async()=>{
  const parent=join(folder,'02_datasets'),backup=join(folder,'02_datasets-original'),outside=join(root,'outside-swap')
  await mkdir(outside);let moved=false,linked=false
  docs.writeProjectDestination.mockImplementationOnce(async(_path:string,run:()=>Promise<unknown>)=>{
   await fs.rename(parent,backup);moved=true
   await symlink(outside,parent,process.platform==='win32'?'junction':'dir');linked=true
   return run()
  })
  try{
   let failure:unknown
   try{await service.export(id,recipeId,'parent-swapped',async()=>true)}catch(error){failure=error}
   expect(await fs.readdir(outside),'ni archivo exportado ni temporal deben escribirse fuera del proyecto').toEqual([])
   expect(failure).toBeInstanceOf(Error);expect((failure as Error).message).toBe(t('project.export.inside'))
   expect(await fs.readdir(backup)).toEqual([]);expect(store.results).toEqual([])
   expect(sha(await readFile(input))).toBe(sha(original))
  }finally{
   if(linked)await rm(parent,{force:true})
   if(moved)await fs.rename(backup,parent)
  }
 })
 it.each([1,2])('preparar una exportación de A no reemplaza el borrador de B al cambiar de proyecto en checkpoint %s',async(checkpoint)=>{
  const result=await exportOne(),otherFolder=join(root,'Otro proyecto');await mkdir(otherFolder)
  const other=await store.create(otherFolder,'Otro proyecto',true),otherInput=join(other.path,'01_raw','otro.csv'),otherBytes=Buffer.from('B,Valor\n1,b\n')
  await writeFile(otherInput,otherBytes);const otherManifest=await readFile(join(other.path,projectFile));await store.open(folder)
  const originalProtected=sources.protectedPaths.bind(sources)
  let calls=0,switched=false,draftB:Awaited<ReturnType<ProjectSourceRegistry['prepare']>>|undefined
  const protectedSpy=vi.spyOn(sources,'protectedPaths').mockImplementation(async()=>{
   const current=++calls,paths=await originalProtected()
   if(!switched&&current===checkpoint){switched=true;await store.open(other.path);draftB=await sources.prepare(otherInput,{},true)}
   return paths
  })
  try{
   let failure:unknown
   try{await service.prepareSource(id,result.id)}catch(error){failure=error}
   expect(switched).toBe(true);expect(store.active).toMatchObject({id:other.id,path:other.path})
   expect(failure,'la petición de A debe rechazarse al cambiar el proyecto, antes de sustituir el borrador').toBeInstanceOf(Error)
   expect((failure as Error).message).toBe(t('project.error.changed'))
   expect(draftB).toBeDefined();expect(sources.registrationTarget(draftB!.id)).toBe(otherInput)
   expect(await sources.inspectDraft(draftB!.id,{})).toMatchObject({id:draftB!.id,path:otherInput,columns:[{position:1,name:'B'},{position:2,name:'Valor'}]})
   expect(await readFile(join(other.path,projectFile))).toEqual(otherManifest);expect(store.sources).toEqual([])
   expect(await readFile(otherInput)).toEqual(otherBytes);expect(await readFile(join(folder,result.path))).toEqual(expected)
  }finally{protectedSpy.mockRestore()}
 })
 it('rechaza reemplazar una exportación registrada y conserva sus bytes',async()=>{
  const exported=await exportOne(),before=await readFile(file)
  await expect(service.export(id,recipeId,'another',async()=>true)).rejects.toThrow(t('project.export.previous'))
  expect(worker.call).toHaveBeenCalledTimes(1);expect(await readFile(file)).toEqual(before);expect(await readFile(join(folder,exported.path))).toEqual(expected)
 })
})
