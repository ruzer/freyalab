import {it,expect,beforeAll,afterAll} from 'vitest'
import {mkdtemp,writeFile,readFile,rm,symlink} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {build} from 'rolldown'
import {parse} from 'csv-parse/sync'
import iconv from 'iconv-lite'
import {TableEngine} from '../src/main/table-engine'
import type {LargeViewRequest} from '../src/shared/types'
let workerFolder:string,workerPath:string
beforeAll(async()=>{
 workerFolder=await mkdtemp(join(tmpdir(),'freya-view-worker-'));workerPath=join(workerFolder,'worker.mjs')
 await symlink(resolve('node_modules'),join(workerFolder,'node_modules'),'junction')
 await build({input:'src/main/large-search-worker.ts',platform:'node',external:id=>!id.startsWith('.')&&!id.startsWith('/'),output:{file:workerPath,format:'esm'}})
})
afterAll(async()=>{await rm(workerFolder,{recursive:true,force:true})})
async function finished(engine:TableEngine,id='a'){for(let i=0;i<300;i++){const state=await engine.viewState(id);if(state?.status!=='running')return state;await new Promise(resolve=>setTimeout(resolve,5))}throw new Error('La búsqueda no terminó')}
async function scanned(engine:TableEngine,id='a'){for(let i=0;i<300;i++){const state=await engine.viewState(id);if(state?.scanned)return state;await new Promise(resolve=>setTimeout(resolve,5))}throw new Error('No avanzó la búsqueda')}
const request=(search:string,extra:Partial<LargeViewRequest>={})=>({requestId:crypto.randomUUID(),revision:0,search,...extra})
const table=(count:number)=>'id,text\n'+Array.from({length:count},(_,i)=>`${String(i+1).padStart(6,'0')},grupo ${i%2?'b':'a'}`).join('\n')+'\n'

it('buscar en grande devuelve las mismas filas y números originales',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-view-'))
 try{
  const path=join(folder,'data.csv');await writeFile(path,'id,text\n0001,otro\n0002,Objetivo\n0003,fin\n')
  const engine=new TableEngine(()=>{},{largeBytes:1,viewWorkers:1,viewWorkerPath:workerPath});await engine.open('a',path)
  try{
   const requestId=crypto.randomUUID();await engine.viewStart('a',{search:'objetivo',requestId,revision:0});expect(await finished(engine)).toMatchObject({status:'complete',matched:1,scanned:3})
   const page=await engine.page('a',{viewId:requestId,offset:0,limit:200,requestId:1})
   expect(page.rows).toEqual([{id:'2',cells:['0002','Objetivo']}]);expect(page.matched).toBe(1);expect(await readFile(path,'utf8')).toBe('id,text\n0001,otro\n0002,Objetivo\n0003,fin\n')
   const again=await engine.viewStart('a',{search:'objetivo',requestId:crypto.randomUUID(),revision:0});expect(again.status).toBe('complete');expect(again.elapsedMs).toBe(page.view!.elapsedMs)
  }finally{await engine.close('a')}
 }finally{await rm(folder,{recursive:true,force:true})}
})
it('cancelar conserva parciales, detiene el hilo en menos de un segundo y no modifica el archivo',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-view-cancel-')),path=join(folder,'data.csv'),text=table(4000),engine=new TableEngine(()=>{},{largeBytes:1,viewWorkerPath:workerPath,viewWorkers:1,viewBatch:10,viewDelayMs:2})
 try{
  await writeFile(path,text);await engine.open('a',path);const q=request('grupo');await engine.viewStart('a',q);await scanned(engine)
  const start=performance.now(),state=await engine.viewCancel('a',q.requestId);expect(performance.now()-start).toBeLessThan(1000);expect(state).toMatchObject({status:'cancelled'});expect(state!.matched).toBeGreaterThan(0);expect(state!.scanned).toBeLessThan(4000);expect(state!.fraction).toBeLessThan(1)
  const page=await engine.page('a',{viewId:q.requestId,offset:0,limit:200,requestId:1});expect(page.rows.length).toBeGreaterThan(0);await new Promise(resolve=>setTimeout(resolve,10));expect((await engine.viewState('a'))?.matched).toBe(state!.matched);expect(await readFile(path,'utf8')).toBe(text)
 }finally{await engine.close('a');await rm(folder,{recursive:true,force:true})}
})
it('cancelar detiene también un hilo que no cede el control dentro de una evaluación larga',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-view-unresponsive-')),path=join(folder,'data.csv'),slow=join(folder,'slow.mjs')
 await writeFile(slow,`import {parentPort} from 'node:worker_threads';parentPort.on('message',task=>{if(task.ack)return;parentPort.postMessage({taskId:task.taskId,chunk:{rows:new Float64Array([1]),positions:new Float64Array([8]),lengths:new Uint32Array([9]),scanned:1,position:17}});const end=performance.now()+1200;while(performance.now()<end){}parentPort.postMessage({taskId:task.taskId,done:{scanned:1,position:17,cancelled:true}})})`)
 const engine=new TableEngine(()=>{},{largeBytes:1,viewWorkerPath:slow,viewWorkers:1})
 try{await writeFile(path,'id,text\n'+'x,target\n'.repeat(100));await engine.open('a',path);const q=request('target');await engine.viewStart('a',q);await scanned(engine);const start=performance.now();expect(await engine.viewCancel('a',q.requestId)).toMatchObject({status:'cancelled',matched:1,scanned:1});expect(performance.now()-start).toBeLessThan(1000)}finally{await engine.close('a');await rm(folder,{recursive:true,force:true})}
})
it('el tope de coincidencias es parcial y conserva exactamente el límite',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-view-limit-')),path=join(folder,'data.csv'),engine=new TableEngine(()=>{},{largeBytes:1,viewWorkerPath:workerPath,viewWorkers:1,viewLimit:3})
 try{await writeFile(path,table(100));await engine.open('a',path);const q=request('grupo');await engine.viewStart('a',q);const state=await finished(engine);expect(state).toMatchObject({status:'limit',limitReason:'matches',matched:3});expect((await engine.page('a',{viewId:q.requestId,offset:0,limit:200,requestId:1})).rows.map(row=>row.id)).toEqual(['1','2','3'])}finally{await engine.close('a');await rm(folder,{recursive:true,force:true})}
})
it('el presupuesto de lista se detiene antes de reservar memoria fuera del límite',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-view-memory-')),path=join(folder,'data.csv'),engine=new TableEngine(()=>{},{largeBytes:1,viewWorkerPath:workerPath,viewWorkers:1,viewBytes:1})
 try{await writeFile(path,table(100));await engine.open('a',path);await engine.viewStart('a',request('grupo'));expect(await finished(engine)).toMatchObject({status:'limit',limitReason:'memory',matched:0})}finally{await engine.close('a');await rm(folder,{recursive:true,force:true})}
})
it('invalida la vista antes de mostrar páginas de una versión distinta',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-view-change-')),path=join(folder,'data.csv'),engine=new TableEngine(()=>{},{largeBytes:1,viewWorkerPath:workerPath,viewWorkers:1})
 try{await writeFile(path,table(50));await engine.open('a',path);const q=request('grupo');await engine.viewStart('a',q);await finished(engine);await writeFile(path,table(51));expect(await engine.viewState('a')).toMatchObject({status:'invalidated'});const page=await engine.page('a',{viewId:q.requestId,offset:0,limit:200,requestId:1});expect(page.rows).toEqual([]);expect(page.view?.status).toBe('invalidated');await engine.viewClear('a');await expect(engine.page('a',{offset:0,limit:200,requestId:2})).rejects.toThrow('cambió')}finally{await engine.close('a');await rm(folder,{recursive:true,force:true})}
})
it('dos reaplicaciones en caché conservan únicamente el UUID de la solicitud más reciente',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-view-cache-race-')),path=join(folder,'data.csv'),engine=new TableEngine(()=>{},{largeBytes:1,viewWorkerPath:workerPath,viewWorkers:1})
 try{
  await writeFile(path,table(10));await engine.open('a',path);await engine.viewStart('a',request('grupo'));await finished(engine)
  const first=request('grupo'),second=request('grupo'),results=await Promise.allSettled([engine.viewStart('a',first),engine.viewStart('a',second)])
  expect(results[0].status).toBe('rejected');expect(results[1].status).toBe('fulfilled');expect((await engine.viewState('a'))?.requestId).toBe(second.requestId)
 }finally{await engine.close('a');await rm(folder,{recursive:true,force:true})}
})
it('una solicitud nueva cancela la anterior y sus páginas viejas no aparecen',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-view-replace-')),path=join(folder,'data.csv'),engine=new TableEngine(()=>{},{largeBytes:1,viewWorkerPath:workerPath,viewWorkers:1,viewBatch:10,viewDelayMs:1})
 try{
  await writeFile(path,table(200));await engine.open('a',path);const first=request('grupo a'),second=request('grupo b');await engine.viewStart('a',first);await scanned(engine);await engine.viewStart('a',second);expect(await finished(engine)).toMatchObject({status:'complete',matched:100,requestId:second.requestId})
  await expect(engine.page('a',{viewId:first.requestId,offset:0,limit:200,requestId:1})).rejects.toThrow('reciente');expect((await engine.page('a',{viewId:second.requestId,offset:0,limit:200,requestId:2})).rows.every(row=>row.cells[1]==='grupo b')).toBe(true)
 }finally{await engine.close('a');await rm(folder,{recursive:true,force:true})}
})
it('validaciones de condición ocurren antes de recorrer y un error de registro nunca queda completo',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-view-error-')),path=join(folder,'data.csv'),engine=new TableEngine(()=>{},{largeBytes:1,viewWorkerPath:workerPath,viewWorkers:1,viewBatch:1})
 try{
  await writeFile(path,'id,text\n1,grupo\n2,"bad"x\n');await engine.open('a',path)
  await expect(engine.viewStart('a',request('grupo',{conditions:[{column:1,op:'regex',value:'['}]}))).rejects.toThrow('regular');expect(await engine.viewState('a')).toBeNull()
  await engine.viewStart('a',request('zzq99'));expect(await finished(engine)).toMatchObject({status:'error',matched:0});expect((await engine.viewState('a'))?.error).toContain('registro 3')
 }finally{await engine.close('a');await rm(folder,{recursive:true,force:true})}
})
it('los errores de condición conservan la vista anterior y el límite regex de campo detiene el recorrido',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-filter-errors-')),path=join(folder,'data.csv'),engine=new TableEngine(()=>{},{largeBytes:1,viewWorkerPath:workerPath,viewWorkers:1})
 try{
  await writeFile(path,'id,text\n1,valid\n2,'+'a'.repeat(65537)+'\n');await engine.open('a',path);const q=request('valid');await engine.viewStart('a',q);await finished(engine)
  for(const rule of [{column:1,op:'greater',value:'1,5'},{column:1,op:'dateOn',value:'2026-02-30'},{column:1,op:'regex',value:'a'.repeat(257)},{column:1,op:'regex',value:'a{999}'},{column:1,op:'regex',value:'(?=a)'},{column:2,op:'empty'}] as import('../src/shared/types').TableFilter[]){await expect(engine.viewStart('a',{requestId:crypto.randomUUID(),revision:0,conditions:[rule]})).rejects.toThrow();expect((await engine.viewState('a'))?.requestId).toBe(q.requestId)}
  await engine.viewStart('a',{requestId:crypto.randomUUID(),revision:0,conditions:[{column:1,op:'regex',value:'a'}]});expect(await finished(engine)).toMatchObject({status:'error'});expect((await engine.viewState('a'))?.error).toContain('64 KiB')
 }finally{await engine.close('a');await rm(folder,{recursive:true,force:true})}
})
for(const [encoding,bom] of [['utf8',false],['utf8',true],['utf16le',true],['win1252',false]] as const)it(`${encoding}/${bom}: diferencial de más de 200 búsquedas entre editable, hilo grande y analizador estricto`,async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-view-parity-')),path=join(folder,'data.csv'),small=new TableEngine(),large=new TableEngine(()=>{},{largeBytes:1,viewWorkerPath:workerPath,viewWorkers:1})
 try{
  const source=[['id','name','text','extra'],['000123','José, grande','dice "hola"',''],['9007199254740993','Kelvin','İSTANBUL','  borde  '],['4',''],['5','ñ','primera\rsegunda\ntercera\r\nfin','final'],['6','LARGA','x','y','extra']],quote=(value:string)=>/[",\r\n]/.test(value)?`"${value.replaceAll('"','""')}"`:value
  const data=Buffer.concat([bom?(encoding==='utf16le'?Buffer.from([255,254]):Buffer.from([239,187,191])):Buffer.alloc(0),iconv.encode(source.map((row,i)=>row.map(quote).join(',')+(i<source.length-1?['\r\n','\n','\r'][i%3]:'')).join(''),encoding)])
  await writeFile(path,data);await small.open('a',path,{encoding});await large.open('a',path,{encoding})
  const expected=parse(iconv.decode(data,encoding).replace(/^\uFEFF/,''),{record_delimiter:['\r\n','\n','\r'],relax_column_count:true}) as string[][]
  const needles=['k','i','i\u0307','K','İ','ñ',' ','  ','"','\r','\n',',','zzq99',...Array.from({length:220},(_,i)=>{const row=expected[1+i%(expected.length-1)],cell=row[(i*7)%row.length]??'';return cell.slice(i%Math.max(1,cell.length),i%Math.max(1,cell.length)+1+i%6)||`missing-${i}`})]
  for(let i=0;i<needles.length;i++){
   const needle=needles[i],q=request(needle),query={search:needle,offset:0,limit:1000,requestId:i},oracle=expected.slice(1).flatMap((cells,index)=>cells.some(value=>value.toLocaleLowerCase().includes(needle.toLocaleLowerCase()))?[{id:String(index+1),cells}]:[])
   await large.viewStart('a',q);expect(await finished(large)).toMatchObject({status:'complete',matched:oracle.length})
   expect((await large.page('a',{viewId:q.requestId,offset:0,limit:1000,requestId:i})).rows).toEqual(oracle);expect((await small.page('a',query)).rows).toEqual(oracle)
  }
  expect(needles.length).toBeGreaterThanOrEqual(200);expect(await readFile(path)).toEqual(data)
 }finally{await large.close('a');await small.close('a');await rm(folder,{recursive:true,force:true})}
})

for(const encoding of ['utf8','utf16le'] as const)it(`${encoding}: paridad de 330 consultas de filtros por operador y grupos de 2 a 20 condiciones`,async()=>{
 const {compileTableQuery}=await import('../src/main/table-query'),{LargeViews}=await import('../src/main/large-view'),{buildIndex}=await import('../src/main/large-table')
 const folder=await mkdtemp(join(tmpdir(),'freya-filter-parity-')),path=join(folder,'data.csv'),small=new TableEngine(),views=new LargeViews({workerPath,workers:1,batchRecords:3})
 try{
  const source=[['id','name','num','date','extra'],['000123','José Kelvin','9007199254740993','2026-10-28',''],['2','İSTANBUL','-1.5','2026-10-27','a\r\nb'],['3','ñ Á','+2.50','2026-10-29','"'],['4','   ','no-number','2026-02-30',''],['5','a,b','1e3','','line\ninside'],['6',''],['7','ascii K','0','2020-02-29',''],['8','lowercase','1,5','2021-02-29','x']]
  const quote=(value:string)=>/[",\r\n]/.test(value)?`"${value.replaceAll('"','""')}"`:value,text=source.map((row,i)=>row.map(quote).join(',')+(i<source.length-1?['\r\n','\r','\n'][i%3]:'')).join(''),data=Buffer.concat([encoding==='utf16le'?Buffer.from([255,254]):Buffer.from([239,187,191]),iconv.encode(text,encoding)])
  await writeFile(path,data);await small.open('a',path,{encoding});const index=await buildIndex(path,{encoding,bomLength:encoding==='utf16le'?2:3,maxRecord:1048576,delimiter:','}),expected=parse(iconv.decode(data,encoding).replace(/^\uFEFF/,''),{record_delimiter:['\r\n','\n','\r'],relax_column_count:true}) as string[][]
  const sourceInfo={index,delimiter:',',header:true,width:5,revision:0,alive:()=>true},ops=['contains','equals','notEquals','starts','ends','empty','notEmpty','greater','greaterEqual','less','lessEqual','dateBefore','dateOn','dateAfter','regex'] as const
  for(let i=0;i<330;i++){
   const conditions=Array.from({length:i<30?1:2+(i-30)%19},(_,j)=>{const op=ops[(i+j)%ops.length],column=op.startsWith('date')?3:['greater','greaterEqual','less','lessEqual'].includes(op)?2:1,value=op.startsWith('date')?'2026-10-28':['greater','greaterEqual','less','lessEqual'].includes(op)?(i%2?'9007199254740992':'0'):op==='regex'?(i%2?'^[A-Z]':'[ñKİ]'):[op==='equals'||op==='notEquals'?'José Kelvin':'k','i',' ','ñ','zzq99'][i%5];return {column,op,value,caseSensitive:!!(i%3)}}),search=i%4===0?['k','i','ñ',' '][i%4]:undefined,query={search,conditions,filterMode:i%2?'any' as const:'all' as const,offset:0,limit:1000,requestId:i},compiled=compileTableQuery(query,5),oracle=expected.slice(1).flatMap((cells,n)=>compiled.matches(cells)?[{id:String(n+1),cells}]:[]),requestId=crypto.randomUUID()
   await views.start('a',sourceInfo,{...query,revision:0,requestId});for(let wait=0;(await views.state('a'))?.status==='running';wait++){if(wait>300)throw new Error('No terminó');await new Promise(resolve=>setTimeout(resolve,2))}
   expect(await views.state('a')).toMatchObject({status:'complete',matched:oracle.length});expect((await views.page('a',requestId,0,1000)).rows).toEqual(oracle);expect((await small.page('a',query)).rows).toEqual(oracle)
  }
  expect(await readFile(path)).toEqual(data)
 }finally{await views.stop();await small.close('a');await rm(folder,{recursive:true,force:true})}
})

it('cancelar o cerrar un documento no cancela la búsqueda de otro; reinterpretar elimina la vista antigua',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-view-lifecycle-')),path=join(folder,'data.csv'),text=table(4000),engine=new TableEngine(()=>{},{largeBytes:1,viewWorkerPath:workerPath,viewWorkers:2,viewBatch:10,viewDelayMs:1})
 try{
  await writeFile(path,text);await engine.open('a',path);await engine.open('b',path);const a=request('grupo'),b=request('grupo b');await engine.viewStart('a',a);await engine.viewStart('b',b);await scanned(engine,'a');const start=performance.now();await engine.close('a');expect(performance.now()-start).toBeLessThan(1000);expect(await finished(engine,'b')).toMatchObject({status:'complete',matched:2000});expect((await engine.page('b',{viewId:b.requestId,offset:0,limit:200,requestId:1})).rows[0].id).toBe('2')
  const next=request('grupo');await engine.viewStart('b',next);await scanned(engine,'b');const reinterpreted=await engine.open('b',path,{header:false});expect(reinterpreted.rowCount).toBe(4001);expect(await engine.viewState('b')).toBeNull();await expect(engine.page('b',{viewId:next.requestId,offset:0,limit:200,requestId:2})).rejects.toThrow('más reciente');expect(await readFile(path,'utf8')).toBe(text)
 }finally{await engine.close('a');await engine.close('b');await rm(folder,{recursive:true,force:true})}
})
