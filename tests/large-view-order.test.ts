import {afterAll,beforeAll,expect,it} from 'vitest'
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {TableEngine} from '../src/main/table-engine'
import type {LargeViewState} from '../src/shared/types'

let workerFolder:string,workerPath:string
const count=12000,source='id,text\n'+'x,target\n'.repeat(count)
const wait=()=>new Promise(resolve=>setTimeout(resolve,5))
beforeAll(async()=>{
 workerFolder=await mkdtemp(join(tmpdir(),'freya-view-order-worker-'))
 workerPath=join(workerFolder,'worker.mjs')
 // Un solo mensaje por rango: esta prueba controla el orden de llegada sin
 // reemplazar ni emular el coordinador, el índice, las listas o la paginación.
 await writeFile(workerPath,`
import {parentPort} from 'node:worker_threads'
import {access,rename,writeFile} from 'node:fs/promises'
import {dirname,join} from 'node:path'
parentPort.on('message',async task=>{
 if(task.ack)return
 const {taskId,index,range}=task,flag=new Int32Array(task.cancel),cancelled=()=>Atomics.load(flag,0)!==0
 let scanned=0,position=range.from
 try{
  const folder=dirname(index.path)
  const observed=join(folder,'range-'+range.first+'.json')
  await writeFile(observed+'.tmp',JSON.stringify({range,every:index.every,checkpoints:index.offsets.length,records:index.records}));await rename(observed+'.tmp',observed)
  if(range.first===0){
   while(!cancelled()){
    try{await access(join(folder,'release-first'));break}catch{}
    await new Promise(resolve=>setTimeout(resolve,5))
   }
  }
  if(!cancelled()){
   const first=Math.max(1,range.first),end=Math.min(index.records,Math.round((range.to-8)/9)+1),length=Math.max(0,end-first)
   const rows=Float64Array.from({length},(_,i)=>first+i),positions=Float64Array.from(rows,row=>8+(row-1)*9),lengths=new Uint32Array(length).fill(9)
   scanned=length;position=range.to
   parentPort.postMessage({taskId,chunk:{rows,positions,lengths,scanned,position}},[rows.buffer,positions.buffer,lengths.buffer])
  }
  parentPort.postMessage({taskId,done:{scanned,position,cancelled:cancelled()}})
 }catch(error){parentPort.postMessage({taskId,error:error.message})}
})
`)
})
afterAll(async()=>{if(workerFolder)await rm(workerFolder,{recursive:true,force:true})})

async function until(engine:TableEngine,accept:(state:LargeViewState)=>boolean){
 const deadline=performance.now()+5000
 while(performance.now()<deadline){const state=await engine.viewState('a');if(state&&accept(state))return state;await wait()}
 throw new Error('La vista no alcanzó el estado esperado; el primer rango sigue controlado por release-first.')
}
async function assignedRanges(folder:string,workers:number){
 const deadline=performance.now()+5000
 while(performance.now()<deadline){
  const names=(await readdir(folder)).filter(name=>/^range-\d+\.json$/.test(name))
  if(names.length===workers)return Promise.all(names.map(async name=>JSON.parse(await readFile(join(folder,name),'utf8'))))
  await wait()
 }
 throw new Error(`No se asignaron los ${workers} rangos configurados.`)
}

for(const workers of [1,2,4,8])for(const limit of [3,7])it(`${workers} hilos, tope ${limit}: conserva el prefijo global aunque lleguen primero los rangos finales`,async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-view-order-')),path=join(folder,'data.csv'),release=join(folder,'release-first')
 const engine=new TableEngine(()=>{},{largeBytes:1,viewWorkerPath:workerPath,viewWorkers:workers,viewLimit:limit})
 try{
  await writeFile(path,source)
  if(workers===1)await writeFile(release,'')
  const opened=await engine.open('a',path);expect(opened.large).toBe(true)
  const requestId=crypto.randomUUID();await engine.viewStart('a',{requestId,revision:0,search:'target'})
  const assigned=await assignedRanges(folder,workers)
  // Hay doce checkpoints: las ocho configuraciones deben usar sus rangos
  // reales, sin convertir silenciosamente el caso paralelo en uno serial.
  expect(assigned).toHaveLength(workers)
  expect(assigned.every(item=>item.checkpoints===12&&item.every===1024&&item.records===count+1)).toBe(true)
  expect(assigned.map(item=>item.range.first).sort((a,b)=>a-b)).toEqual(Array.from({length:workers},(_,i)=>Math.floor(i*12/workers)*1024))
  if(workers>1){
   // Si el coordinador termina al llenarse con rangos tardíos, observar ese
   // terminal también despierta la prueba: el rojo no depende de un timeout.
   const late=await until(engine,state=>state.matched>=limit||state.status!=='running')
   expect(late.matched).toBeLessThanOrEqual(limit)
   const page=await engine.page('a',{viewId:requestId,offset:0,limit:200,requestId:1})
   expect(page.rows).toHaveLength(limit);expect(Number(page.rows[0].id)).toBeGreaterThan(1)
   expect(late.status,'Llenarse con coincidencias tardías no permite cancelar el prefijo pendiente.').toBe('running')
   await writeFile(release,'')
  }
  const terminal=await until(engine,state=>state.status!=='running')
  expect(terminal).toMatchObject({status:'limit',limitReason:'matches',matched:limit})
  const page=await engine.page('a',{viewId:requestId,offset:0,limit:200,requestId:2})
  expect(page.rows.map(row=>row.id)).toEqual(Array.from({length:limit},(_,i)=>String(i+1)))
  expect(page.rows.every(row=>row.cells.join(',')==='x,target')).toBe(true)
  expect((await engine.page('a',{viewId:requestId,offset:limit,limit:200,requestId:3})).rows).toEqual([])
  expect(await readFile(path,'utf8')).toBe(source)
 }finally{
  await writeFile(release,'');await engine.close('a');await rm(folder,{recursive:true,force:true})
 }
})
