import {it,expect,vi,beforeEach,afterEach} from 'vitest'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
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
