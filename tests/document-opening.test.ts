import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {mkdtemp,realpath,rm,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
// El motor real corre en el mismo proceso; `hold` retiene una llamada para que el test decida cuándo avanza la apertura.
const state=vi.hoisted(()=>({folder:'',hold:undefined as undefined|{method:string;until:Promise<void>;reached:boolean}}))
vi.mock('electron',()=>({app:{getPath:()=>state.folder},dialog:{},BrowserWindow:{getFocusedWindow:()=>undefined,getAllWindows:()=>[]}}))
vi.mock('chokidar',()=>({watch:()=>{const watcher={on:()=>watcher,close:async()=>{}};return watcher}}))
vi.mock('../src/main/table-client',async()=>{const {TableEngine}=await import('../src/main/table-engine');return{TableClient:class{
 engine=new TableEngine()
 async call(method:string,...args:unknown[]){const hold=state.hold;if(hold?.method===method){hold.reached=true;await hold.until};if(method==='checkpoint')return'{}';return(this.engine as unknown as Record<string,(...values:unknown[])=>unknown>)[method](...args)}
 stop(){}
}}})
import {Documents} from '../src/main/documents'
let docs:Documents,path:string,release:()=>void
beforeEach(async()=>{state.folder=await realpath(await mkdtemp(join(tmpdir(),'freya-opening-')));path=join(state.folder,'datos.csv');await writeFile(path,'A,B\n1,"x\ny"\n2,z\n');docs=new Documents(()=>{})})
afterEach(async()=>{release?.();state.hold=undefined;await docs.shutdown();await rm(state.folder,{recursive:true,force:true})})
function hold(method:string){state.hold={method,reached:false,until:new Promise(resolve=>{release=resolve})};return vi.waitFor(()=>expect(state.hold?.reached).toBe(true))}
// Lo que hace la interfaz al montarse: pide `documents` y lee la primera página de cada tabla.
async function interfaz(){const ids=[...docs.records.keys()];try{for(const id of ids)await docs.table.call('page',id,{offset:0,limit:10,requestId:1});return{ids}}catch(error){return{ids,error:(error as Error).message}}}

it('no ofrece a la interfaz un CSV cuya tabla aún se está abriendo',async()=>{
 const reached=hold('open'),opening=docs.open(path);await reached
 expect(await interfaz()).toEqual({ids:[]})
 release();const opened=await opening
 expect(await interfaz()).toEqual({ids:[opened.id]})
})

it('una segunda apertura del mismo archivo espera a la primera en lugar de devolver el CSV a medias',async()=>{
 const reached=hold('open'),first=docs.open(path);await reached
 const second=docs.open(path);let early=false;void second.then(()=>{early=true},()=>{early=true})
 await new Promise(resolve=>setTimeout(resolve,50));expect(early).toBe(false)
 release();const [a,b]=await Promise.all([first,second])
 expect(b).toEqual(a);expect(a.rowCount).toBe(2);expect(docs.records.size).toBe(1)
})

it('no ofrece a la interfaz un CSV nuevo hasta que su tabla existe',async()=>{
 const reached=hold('create'),creating=docs.create('csv');await reached
 expect(await interfaz()).toEqual({ids:[]})
 release();const created=await creating
 expect(await interfaz()).toEqual({ids:[created.id]})
})
