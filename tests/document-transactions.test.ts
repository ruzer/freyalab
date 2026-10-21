import {it,expect,vi} from 'vitest'
import {mkdtemp,writeFile,readFile,rm,realpath,open} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const state=vi.hoisted(()=>({folder:'',target:'',large:'',release:()=>{},started:false}))
vi.mock('electron',()=>({app:{getPath:()=>state.folder},dialog:{},BrowserWindow:{getFocusedWindow:()=>undefined,getAllWindows:()=>[]}}))
vi.mock('chokidar',()=>({watch:()=>{const watcher={on:()=>watcher,close:async()=>{}};return watcher}}))
vi.mock('../src/main/table-client',()=>({TableClient:class {async call(method:string){return method==='info'?{readonly:true,dirty:false,revision:0,headers:['A'],rowCount:200}:undefined}stop(){}}}))
vi.mock('../src/main/files',async original=>{const actual=await original<typeof import('../src/main/files')>();return{...actual,digest:async(path:string)=>{if(path===state.large)throw new Error('No se debe calcular un hash completo de la muestra.');return actual.digest(path)},atomicWrite:async(path:string,data:string|Uint8Array,hash?:string)=>{if(path===state.target&&!state.started){state.started=true;await new Promise<void>(resolve=>{state.release=resolve})}return actual.atomicWrite(path,data,hash)}}})
import {Documents} from '../src/main/documents'
it('serializa guardados y ediciones para que el último contenido quede en disco',async()=>{
 state.folder=await realpath(await mkdtemp(join(tmpdir(),'freya-transactions-')));state.target=join(state.folder,'doc.md');state.started=false
 const docs=new Documents(()=>{});await writeFile(state.target,'base');const doc=await docs.open(state.target)
 try{
  await docs.update(doc.id,'primero');const first=docs.save(doc.id)
  await vi.waitFor(()=>expect(state.started).toBe(true))
  const edit=docs.update(doc.id,'segundo'),second=docs.save(doc.id)
  expect(await readFile(state.target,'utf8')).toBe('base')
  state.release();await Promise.all([first,edit,second])
  expect(await readFile(state.target,'utf8')).toBe('segundo');expect(docs.info(doc.id).dirty).toBe(false)
  await docs.close(doc.id)
 }finally{state.release();await docs.shutdown();await rm(state.folder,{recursive:true,force:true})}
})

it('reinterpreta muestras de un GiB sin leerlas completas para calcular hashes',async()=>{
 state.folder=await realpath(await mkdtemp(join(tmpdir(),'freya-sample-')));state.large=join(state.folder,'grande.csv')
 const handle=await open(state.large,'w');await handle.writeFile('A\n1\n');await handle.truncate(1024**3);await handle.close()
 const docs=new Documents(()=>{})
 try{const doc=await docs.open(state.large);expect(doc.readonly).toBe(true);expect((await docs.tableOptions(doc.id,{header:false})).readonly).toBe(true);await docs.close(doc.id)}finally{await docs.shutdown();await rm(state.folder,{recursive:true,force:true});state.large=''}
})
