import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {mkdtemp,readFile,writeFile,rm,realpath} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const state=vi.hoisted(()=>({folder:'',questions:vi.fn(),closed:[] as string[],active:new Set<string>(),holdPath:'',reached:false,release:()=>{},until:Promise.resolve(),createStarted:false,createHold:undefined as Promise<void>|undefined,releaseCreate:()=>{}}))
vi.mock('electron',()=>({app:{getPath:()=>state.folder},dialog:{showMessageBox:state.questions},BrowserWindow:{getFocusedWindow:()=>undefined,getAllWindows:()=>[]}}))
vi.mock('chokidar',()=>({watch:(path:string)=>{state.active.add(path);const watcher={on:()=>watcher,close:async()=>{state.closed.push(path);state.active.delete(path);if(state.holdPath===path){state.reached=true;await state.until}}};return watcher}}))
vi.mock('../src/main/table-client',()=>({TableClient:class{
 async call(method:string){if(method==='create'&&state.createHold){state.createStarted=true;await state.createHold}return method==='info'?{headers:['A'],rowCount:0,dirty:false,readonly:false,revision:0}:undefined}stop(){}
}}))
import {Documents} from '../src/main/documents'
let docs:Documents
beforeEach(async()=>{state.folder=await realpath(await mkdtemp(join(tmpdir(),'freya-close-documents-')));state.questions.mockReset().mockResolvedValue({response:1});state.closed=[];state.active.clear();state.holdPath='';state.reached=false;state.createHold=undefined;state.createStarted=false;docs=new Documents(()=>{})})
afterEach(async()=>{state.release();state.releaseCreate();state.holdPath='';await docs.shutdown();await rm(state.folder,{recursive:true,force:true})})
async function opened(name:string,text='# original\n'){const path=join(state.folder,name);await writeFile(path,text);return{...await docs.open(path),path}}
const owner=()=>true

it('A limpio y B sucio: Cancelar no dispone ningún registro, recurso ni cambio',async()=>{
 const A=await opened('A.md'),B=await opened('B.md');await docs.update(B.id,'# B pendiente\n')
 const lease=docs.holdForApplicationClose();try{
  await lease.ready;expect(await lease.closeAll(owner)).toEqual({closed:false,saved:[]})
  expect([...docs.records.keys()]).toEqual([A.id,B.id]);expect(state.closed).toEqual([]);expect(docs.info(B.id)).toMatchObject({dirty:true,text:'# B pendiente\n'})
  expect(await readFile(A.path,'utf8')).toBe('# original\n');expect(await readFile(B.path,'utf8')).toBe('# original\n')
 }finally{lease.release()}
})
it('Guardar A y Cancelar B conserva ambos, reconoce A guardado y no altera B',async()=>{
 const A=await opened('A.md'),B=await opened('B.md');await docs.update(A.id,'# A guardado\n');await docs.update(B.id,'# B pendiente\n');state.questions.mockResolvedValueOnce({response:0}).mockResolvedValueOnce({response:1})
 const lease=docs.holdForApplicationClose();try{
  await lease.ready;expect(await lease.closeAll(owner)).toEqual({closed:false,saved:['A.md']});expect([...docs.records.keys()]).toEqual([A.id,B.id]);expect([...state.active].sort()).toEqual([A.path,B.path].sort())
  expect(docs.info(A.id).dirty).toBe(false);expect(docs.info(B.id).dirty).toBe(true);expect(await readFile(A.path,'utf8')).toBe('# A guardado\n');expect(await readFile(B.path,'utf8')).toBe('# original\n')
 }finally{lease.release()}
})
it('Descartar A no se ejecuta si después se cancela B',async()=>{
 const A=await opened('A.md'),B=await opened('B.md');await docs.update(A.id,'A modificado');await docs.update(B.id,'B modificado');state.questions.mockResolvedValueOnce({response:2}).mockResolvedValueOnce({response:1})
 const lease=docs.holdForApplicationClose();try{await lease.ready;expect((await lease.closeAll(owner)).closed).toBe(false);expect(state.closed).toEqual([]);expect(docs.info(A.id)).toMatchObject({dirty:true,text:'A modificado'});expect(docs.info(B.id)).toMatchObject({dirty:true,text:'B modificado'})}finally{lease.release()}
})
it('sólo dispone después de confirmar todos y release es idempotente',async()=>{
 const A=await opened('A.md'),B=await opened('B.md');await docs.update(A.id,'A');await docs.update(B.id,'B');state.questions.mockImplementation(async()=>{expect(state.closed).toEqual([]);expect(docs.records.size).toBe(2);return{response:2}})
 const lease=docs.holdForApplicationClose();await lease.ready;try{expect(await lease.closeAll(owner)).toEqual({closed:true,saved:[]});expect(docs.records.size).toBe(0);expect(state.closed).toEqual([A.path,B.path])}finally{lease.release();lease.release()};expect(docs.isClosing).toBe(false)
})
it('un dueño cambiado antes de confirmar no pregunta ni dispone',async()=>{
 const A=await opened('A.md');await docs.update(A.id,'nuevo');const lease=docs.holdForApplicationClose();try{await lease.ready;expect((await lease.closeAll(()=>false)).closed).toBe(false);expect(state.questions).not.toHaveBeenCalled();expect(state.closed).toEqual([]);expect(docs.records.has(A.id)).toBe(true)}finally{lease.release()}
})
it('un dueño cambiado durante la confirmación conserva todos y cero disposiciones',async()=>{
 const A=await opened('A.md'),B=await opened('B.md');await docs.update(A.id,'nuevo');let current=true;state.questions.mockImplementation(async()=>{current=false;return{response:2}})
 const lease=docs.holdForApplicationClose();try{await lease.ready;expect((await lease.closeAll(()=>current)).closed).toBe(false);expect(state.closed).toEqual([]);expect([...docs.records.keys()]).toEqual([A.id,B.id])}finally{lease.release()}
})
it('una apertura o edición llegada durante el await de disposición no puede entrar tras revalidar',async()=>{
 const A=await opened('A.md'),B=await opened('B.md'),third=join(state.folder,'C.md');await writeFile(third,'# C intacto\n');state.holdPath=A.path;state.until=new Promise(resolve=>state.release=resolve)
 const lease=docs.holdForApplicationClose();await lease.ready;const closing=lease.closeAll(owner)
 try{await vi.waitFor(()=>expect(state.reached).toBe(true));await expect(docs.open(third)).rejects.toThrow();await expect(docs.create('markdown')).rejects.toThrow();await expect(docs.update(B.id,'edición tardía')).rejects.toThrow();expect(docs.info(B.id).text).toBe('# original\n');expect(await readFile(third,'utf8')).toBe('# C intacto\n');state.release();expect((await closing).closed).toBe(true)}finally{state.release();await closing.catch(()=>{});lease.release()}
})
it('espera una creación del modelo ya iniciada, sin esperar lecturas SQL ajenas',async()=>{
 state.createHold=new Promise(resolve=>state.releaseCreate=resolve);const creating=docs.create('csv');await vi.waitFor(()=>expect(state.createStarted).toBe(true));const lease=docs.holdForApplicationClose();let ready=false;void lease.ready.then(()=>ready=true)
 try{await Promise.resolve();expect(ready).toBe(false);state.releaseCreate();const document=await creating;await lease.ready;expect(docs.records.has(document.id)).toBe(true);expect(docs.info(document.id).kind).toBe('csv');expect(await lease.closeAll(owner)).toEqual({closed:true,saved:[]})}finally{state.releaseCreate();lease.release()}
})
it('al abortar libera la barrera para corregir el documento y reintentar',async()=>{
 const A=await opened('A.md');await docs.update(A.id,'pendiente');const lease=docs.holdForApplicationClose();await lease.ready;expect((await lease.closeAll(owner)).closed).toBe(false);lease.release();await docs.update(A.id,'corregido');expect(docs.info(A.id).text).toBe('corregido');expect(docs.isClosing).toBe(false)
})
