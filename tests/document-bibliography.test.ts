import {it,expect,vi,beforeEach,afterEach} from 'vitest'
import {mkdtemp,writeFile,readFile,rm,mkdir,rename,symlink,realpath,stat} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const state=vi.hoisted(()=>({folder:''}))
vi.mock('electron',()=>({app:{getPath:()=>state.folder},dialog:{},BrowserWindow:{getFocusedWindow:()=>undefined,getAllWindows:()=>[]}}))
vi.mock('chokidar',()=>({watch:()=>{const watcher={on:()=>watcher,close:async()=>{}};return watcher}}))
vi.mock('../src/main/table-client',()=>({TableClient:class{async call(){return undefined}stop(){}}}))
import {Documents} from '../src/main/documents'
let documents:Documents
beforeEach(async()=>{state.folder=await mkdtemp(join(tmpdir(),'freya-doc-bib-'));documents=new Documents(()=>{})})
afterEach(async()=>{await documents.shutdown();await rm(state.folder,{recursive:true,force:true})})
it('resuelve sólo la biblioteca declarada en la fuente actual y no revela su ruta',async()=>{
 const source='---\nbibliography: refs.json\n---\n\n[@uno]',path=join(state.folder,'a.md')
 await writeFile(path,source);await writeFile(join(state.folder,'refs.json'),'[{"id":"uno","type":"book","title":"Fuente"}]')
 const document=await documents.open(path),result=await documents.bibliography(document.id,source)
 expect(result).toMatchObject({ok:true,entries:[{id:'uno',type:'book',title:'Fuente'}]});expect(result).not.toHaveProperty('path')
 expect(await readSource()).toBe(source)
 async function readSource(){return documents.info(document.id).text}
})
it('rechaza una solicitud vieja sin leer otra fuente',async()=>{
 const source='---\nbibliography: refs.json\n---\n\n[@uno]',path=join(state.folder,'a.md');await writeFile(path,source)
 const document=await documents.open(path);await documents.update(document.id,source+' nuevo')
 await expect(documents.bibliography(document.id,source)).rejects.toThrow(/cambió/)
})
it('un documento nuevo explica que hay que guardarlo sin leer rutas por omisión',async()=>{
 const document=await documents.create('markdown');await documents.update(document.id,'---\nbibliography: refs.json\n---\n')
 const result=await documents.bibliography(document.id,documents.info(document.id).text!)
 expect(result).toMatchObject({ok:false,error:{code:'invalid-path'}})
})
it('sin declaración devuelve un catálogo vacío y no cambia el documento',async()=>{
 const document=await documents.create('markdown'),result=await documents.bibliography(document.id,'')
 expect(result).toMatchObject({ok:true,entries:[]});expect(documents.info(document.id).dirty).toBe(false)
})
it('conserva la carpeta autorizada al abrir aunque su directorio se sustituya por un enlace externo',async()=>{
 const allowed=join(state.folder,'autorizado'),outside=join(state.folder,'externo'),source='---\nbibliography: refs.json\n---\n\n[@uno]'
 await mkdir(allowed);await mkdir(outside)
 for(const folder of [allowed,outside])await writeFile(join(folder,'a.md'),source)
 const original='[{"id":"uno","type":"book","title":"Fuente autorizada"}]',canary='[{"id":"uno","type":"book","title":"CANARIO EXTERNO"}]'
 await writeFile(join(allowed,'refs.json'),original);await writeFile(join(outside,'refs.json'),canary)
 const document=await documents.open(join(allowed,'a.md'))
 await rename(allowed,join(state.folder,'autorizado-anterior'));await symlink(outside,allowed,process.platform==='win32'?'junction':'dir')
 const result=await documents.bibliography(document.id,source)
 expect(result).toMatchObject({ok:false,error:{code:'outside'}})
 expect(result.ok&&result.entries[0]?.title).not.toBe('CANARIO EXTERNO')
 expect(await readFile(join(outside,'refs.json'),'utf8')).toBe(canary)
 expect(await readFile(join(state.folder,'autorizado-anterior','refs.json'),'utf8')).toBe(original)
 expect(documents.info(document.id)).toMatchObject({text:source,dirty:false})
})
it('guardar una fuente nueva conserva una autoridad canónica y permite su biblioteca local',async()=>{
 const source='---\nbibliography: refs.json\n---\n\n[@uno]',path=join(state.folder,'guardado.md')
 await writeFile(join(state.folder,'refs.json'),'[{"id":"uno","type":"book","title":"Fuente local"}]')
 const document=await documents.create('markdown');await documents.update(document.id,source)
 vi.stubEnv('FREYALAB_TEST','1');vi.stubEnv('FREYALAB_TEST_SAVE_PATH',path)
 try{
  await documents.save(document.id)
  expect(documents.get(document.id).root).toBe(await realpath(state.folder))
  expect(await documents.bibliography(document.id,source)).toMatchObject({ok:true,entries:[{title:'Fuente local'}]})
  expect(await readFile(path,'utf8')).toBe(source)
 }finally{vi.unstubAllEnvs()}
})
it('guardar normalmente no escribe ni reautoriza una carpeta sustituida por un enlace externo',async()=>{
 const allowed=join(state.folder,'autorizado'),outside=join(state.folder,'externo'),source='---\nbibliography: refs.json\n---\n\n[@uno]'
 await mkdir(allowed);await mkdir(outside)
 for(const folder of [allowed,outside])await writeFile(join(folder,'a.md'),source)
 await writeFile(join(allowed,'refs.json'),'[{"id":"uno","type":"book","title":"Autorizada"}]')
 await writeFile(join(outside,'refs.json'),'[{"id":"uno","type":"book","title":"CANARIO EXTERNO"}]')
 const document=await documents.open(join(allowed,'a.md')),root=documents.get(document.id).root,before=await stat(join(outside,'a.md'),{bigint:true})
 await rename(allowed,join(state.folder,'autorizado-anterior'));await symlink(outside,allowed,process.platform==='win32'?'junction':'dir')
 let error:unknown
 try{await documents.save(document.id)}catch(cause){error=cause}
 expect.soft(await documents.bibliography(document.id,source)).toMatchObject({ok:false,error:{code:'outside'}})
 expect.soft(error).toBeInstanceOf(Error)
 expect.soft(documents.get(document.id).root).toBe(root)
 const after=await stat(join(outside,'a.md'),{bigint:true})
 expect.soft({ino:after.ino,mtime:after.mtimeNs}).toEqual({ino:before.ino,mtime:before.mtimeNs})
 expect(await readFile(join(outside,'a.md'),'utf8')).toBe(source)
})
