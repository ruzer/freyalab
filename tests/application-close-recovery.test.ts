import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {mkdtemp,readFile,writeFile,rm,realpath} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const state=vi.hoisted(()=>({folder:'',questions:vi.fn(),closed:[] as string[],active:new Set<string>(),holdPath:'',held:false,reached:()=>{},until:Promise.resolve(),release:()=>{}}))
vi.mock('electron',()=>({app:{getPath:()=>state.folder},dialog:{showMessageBox:state.questions},BrowserWindow:{getFocusedWindow:()=>undefined,getAllWindows:()=>[]}}))
vi.mock('chokidar',()=>({watch:(path:string)=>{state.active.add(path);const watcher={on:()=>watcher,close:async()=>{state.closed.push(path);state.active.delete(path)}};return watcher}}))
vi.mock('../src/main/table-client',()=>({TableClient:class{async call(method:string){return method==='info'?{headers:['A'],rowCount:0,dirty:false,readonly:false,revision:0}:undefined}stop(){}}}))
vi.mock('../src/main/files',async original=>{
 const actual=await original<typeof import('../src/main/files')>()
 return{...actual,atomicWrite:vi.fn(async(...args:Parameters<typeof actual.atomicWrite>)=>{
  if(args[0]===state.holdPath&&!state.held){state.held=true;state.reached();await state.until}
  return actual.atomicWrite(...args)
 })}
})
import {Documents} from '../src/main/documents'
let docs:Documents
const emitted=vi.fn()
beforeEach(async()=>{
 state.folder=await realpath(await mkdtemp(join(tmpdir(),'freya-close-recovery-')));state.questions.mockReset().mockResolvedValue({response:2});state.closed=[];state.active.clear();state.holdPath='';state.held=false;emitted.mockClear();docs=new Documents(emitted)
 vi.useFakeTimers({toFake:['setTimeout','clearTimeout']})
})
afterEach(async()=>{state.release();vi.clearAllTimers();await docs.shutdown().catch(()=>{});vi.useRealTimers();vi.restoreAllMocks();await rm(state.folder,{recursive:true,force:true})})

it('Descartar todos espera la recuperación anterior sin registros fantasma, residuos ni temporizador tardío',async()=>{
 const APath=join(state.folder,'A.md'),BPath=join(state.folder,'B.md'),originalA='# A original\n',originalB='# B original\n'
 await writeFile(APath,originalA);await writeFile(BPath,originalB);const A=await docs.open(APath),B=await docs.open(BPath)
 await docs.update(A.id,'# A revisión 1\n')
 state.holdPath=join(state.folder,'recovery',`${A.id}.json`)
 const reached=new Promise<void>(resolve=>state.reached=resolve);state.until=new Promise<void>(resolve=>state.release=resolve)
 let recoveryError:unknown
 const recovering=docs.checkpoint(A.id).catch(error=>{recoveryError=error})
 await reached;await docs.update(A.id,'# A revisión 2\n');await docs.update(B.id,'# B pendiente\n')
 const discard=docs.discardRecovery.bind(docs)
 // Liberar en la disposición real, sin imponer si el registro se elimina antes o después.
 vi.spyOn(docs,'discardRecovery').mockImplementation(async id=>{if(id===A.id)state.release();return discard(id)})
 const lease=docs.holdForApplicationClose()
 try{
  await lease.ready
  const result=await lease.closeAll(()=>true).then(value=>({value,error:undefined as unknown}),error=>({value:undefined,error}))
  await recovering
  expect(state.questions).toHaveBeenCalledTimes(2)
  expect(await readFile(APath,'utf8')).toBe(originalA);expect(await readFile(BPath,'utf8')).toBe(originalB)
  expect(result.error).toBeUndefined();expect(recoveryError).toBeUndefined()
  expect(result.value).toEqual({closed:true,saved:[]});expect(docs.records.size).toBe(0);expect(state.active.size).toBe(0)
  expect(await docs.listRecoveries()).toEqual([]);expect(vi.getTimerCount()).toBe(0)
  await vi.advanceTimersByTimeAsync(2500)
  expect(emitted.mock.calls.filter(([event])=>event.type==='error')).toEqual([]);expect(await docs.listRecoveries()).toEqual([]);expect(vi.getTimerCount()).toBe(0)
 }finally{state.release();await recovering;lease.release()}
})
