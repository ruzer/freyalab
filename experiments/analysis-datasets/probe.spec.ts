import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises'
import {tmpdir,cpus,totalmem,release} from 'node:os'
import {join,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {createServer,type Server} from 'node:http'
import {stringify} from 'csv-stringify/sync'
import {arrowBatches} from '../../src/main/analysis-source'
import {sqlColumns} from '../../src/shared/sql-helpers'
import type {DocumentInfo} from '../../src/shared/types'

type Output={columns:{name:string;type:string}[];rows:(string|null)[][];limited:boolean}
let app:ElectronApplication,page:Page,folder:string,server:Server|undefined
const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex')
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-dataset-probe-'));await mkdir(join(folder,'saved'));await mkdir(join(folder,'exports'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:electronPath as unknown as string,args:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_SAVE_DIR:join(folder,'saved'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')},timeout:60_000})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});if(server)await new Promise<void>(done=>server!.close(()=>done()));server=undefined;await rm(folder,{recursive:true,force:true})})
async function open(name:string,text:string){const path=join(folder,name);await writeFile(path,text);const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);return{doc,path}}
async function current(id:string){const doc=(await page.evaluate(()=>window.freya.documents())).find(doc=>doc.id===id);expect(doc).toBeDefined();return doc!}
async function closeEngine(id:number){await app.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id)?.destroy(),id)}
async function engineCall<T>(id:number,method:'table'|'append'|'seal'|'query',...args:unknown[]):Promise<T>{return app.evaluate(async({BrowserWindow},{id,method,args})=>{
 const owner=BrowserWindow.fromId(id);if(!owner)throw new Error('Motor experimental cerrado')
 // Like SqlService's cancellation race, window destruction must settle the caller explicitly.
 let rejectClosed:()=>void=()=>{};const closed=new Promise<never>((_,reject)=>{rejectClosed=()=>reject(new Error('Motor experimental cancelado'))});owner.once('closed',rejectClosed)
 try{return await Promise.race([owner.webContents.executeJavaScript(`globalThis.freyaSQL.${method}(...${JSON.stringify(args)})`),closed])}finally{owner.removeListener('closed',rejectClosed)}
},{id,method,args})}
async function startEngine(){
 const started=performance.now()
 const id=await app.evaluate(async({app,BrowserWindow})=>{
  if(app.commandLine.hasSwitch('no-sandbox'))throw new Error('Esta prueba requiere sandbox')
  // The application registers this partition's protocol, network and permission restrictions.
  const owner=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,partition:'freyalab-analysis',backgroundThrottling:false}})
  owner.webContents.setWindowOpenHandler(()=>({action:'deny'}));owner.webContents.on('will-navigate',event=>event.preventDefault())
  try{await owner.loadURL('freyalab-analysis://engine/analytics.html');await owner.webContents.executeJavaScript('new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{clearInterval(timer);reject(new Error("Motor no disponible"))},50000);const timer=setInterval(()=>{if(globalThis.freyaSQL){clearTimeout(timeout);clearInterval(timer);resolve(true)}},10)})');return owner.id}catch(error){owner.destroy();throw error}
 })
 return{id,bootMs:performance.now()-started}
}
async function capture(doc:DocumentInfo){
 expect(doc.readonly).toBe(false);expect(doc.kind).toBe('csv')
 const started=performance.now(),rows:string[][]=[]
 for(let offset=0;offset<(doc.rowCount??0);offset+=1000){
  const chunk=await page.evaluate(({id,offset})=>window.freya.tablePage(id,{offset,limit:1000,requestId:offset+1}),{id:doc.id,offset})
  expect(chunk).toMatchObject({revision:doc.revision,total:doc.rowCount,matched:doc.rowCount,sample:false});expect(chunk.rows).toHaveLength(Math.min(1000,doc.rowCount!-offset));rows.push(...chunk.rows.map(row=>row.cells))
 }
 expect(await current(doc.id)).toEqual(doc)
 return{rows,captureMs:performance.now()-started,revision:doc.revision,headers:doc.headers!,rowHash:hash(JSON.stringify(rows))}
}
async function freeze(doc:DocumentInfo){
 const started=performance.now(),snapshot=await capture(doc),engine=await startEngine(),beginImport=performance.now()
 try{
  await engineCall(engine.id,'table','datos',sqlColumns(snapshot.headers).map(column=>column.name))
  let batches=0,rows=0,bytes=0
  for await(const batch of arrowBatches(snapshot.rows,snapshot.headers.length,()=>{})){await engineCall(engine.id,'append','datos',batch.data.toString('base64'));batches++;rows+=batch.rows;bytes+=batch.data.length}
  const version=await engineCall<string>(engine.id,'seal')
  return{...engine,captureMs:snapshot.captureMs,importMs:performance.now()-beginImport,setupMs:performance.now()-started,revision:snapshot.revision,rowHash:snapshot.rowHash,batches,rows,arrowBytes:bytes,version}
 }catch(error){await closeEngine(engine.id);throw error}
}
async function baseline(doc:DocumentInfo,sql:string){
 return page.evaluate(async({doc,sql})=>{
  const started=performance.now(),requestId=crypto.randomUUID(),events:{ms:number;phase:string;rows:number}[]=[]
  const off=window.freya.onEvent(event=>{if(event.type==='analysis'&&event.progress?.requestId===requestId)events.push({ms:performance.now()-started,phase:event.progress.phase,rows:event.progress.rows})})
  try{const result=await window.freya.sqlRun({requestId,sources:[{id:doc.id,revision:doc.revision}],sql});return{result,ms:performance.now()-started,events}}finally{off();await window.freya.sqlCancel(requestId)}
 },{doc,sql})
}
async function memoryStart(){await app.evaluate(({app,BrowserWindow})=>{
 const state={samples:0,maxObservedSumWorkingSetKiB:0,maxObservedEngineWorkingSetKiB:0,timer:undefined as ReturnType<typeof setInterval>|undefined}
 const sample=()=>{const metrics=app.getAppMetrics(),pids=BrowserWindow.getAllWindows().filter(window=>window.webContents.getURL().startsWith('freyalab-analysis://engine/')).map(window=>window.webContents.getOSProcessId());state.samples++;state.maxObservedSumWorkingSetKiB=Math.max(state.maxObservedSumWorkingSetKiB,metrics.reduce((sum,item)=>sum+item.memory.workingSetSize,0));state.maxObservedEngineWorkingSetKiB=Math.max(state.maxObservedEngineWorkingSetKiB,...metrics.filter(item=>pids.includes(item.pid)).map(item=>item.memory.workingSetSize))};sample();state.timer=setInterval(sample,25);Reflect.set(globalThis,'datasetProbeMemory',state)
})}
async function memoryStop(){return app.evaluate(()=>{const state=Reflect.get(globalThis,'datasetProbeMemory') as {samples:number;maxObservedSumWorkingSetKiB:number;maxObservedEngineWorkingSetKiB:number;timer:ReturnType<typeof setInterval>};clearInterval(state.timer);const {timer:_,...output}=state;return{intervalMs:25,...output}})}
const money=(cents:bigint)=>`${cents/100n}.${String(cents%100n).padStart(2,'0')}`
const prepared=(city:string)=>`WITH preparada AS (SELECT * FROM datos WHERE "Ciudad" = '${city}' AND TRY_CAST("Total" AS DECIMAL(38,2)) >= 50)`
const queries=[
 `${prepared('Oaxaca')} SELECT COUNT(*) AS filas,SUM(CAST("Total" AS DECIMAL(38,2))) AS total,COUNT(DISTINCT "Código") AS distintos,COUNT(*) FILTER(WHERE "Opcional" IS NULL) AS ausentes,COUNT(*) FILTER(WHERE "Opcional" = '') AS vacios FROM preparada`,
 `${prepared('Oaxaca')} SELECT "Ciudad",SUM(CAST("Total" AS DECIMAL(38,2))) AS total FROM preparada GROUP BY "Ciudad" ORDER BY "Ciudad"`,
 `${prepared('Puebla')} SELECT "Ciudad",SUM(CAST("Total" AS DECIMAL(38,2))) AS total FROM preparada GROUP BY "Ciudad" ORDER BY "Ciudad"`
]

test('comparación aislada: cargas actuales frente a una base congelada, 3 000 y 100 000 filas',async()=>{
 const measurements:unknown[]=[]
 for(const count of [3000,100000]){
  const rows=Array.from({length:count},(_,i)=>{
   const row=[i===1?'9007199254740993':String(i).padStart(8,'0'),i%2?'Puebla':'Oaxaca',money(BigInt(i%10000*10+5)),i%19?'México 😀':'dos\nlíneas "citadas"']
   if(i%3)row.push(i%3===1?'':'ñ');return row
  }),text='\uFEFF'+stringify([['Código','Ciudad','Total','Nota','Opcional'],...rows],{record_delimiter:'\r\n'}),fileHash=hash(text),begin=performance.now(),{doc,path}=await open(`ventas-${count}.csv`,text),openMs=performance.now()-begin
  expect(doc).toMatchObject({readonly:false,rowCount:count,dirty:false,encoding:'utf8',delimiter:','})
  const oracle=(city:string)=>{const selected=rows.filter((row,i)=>row[1]===city&&i%10000*10+5>=5000),sum=selected.reduce((sum,row)=>sum+BigInt(row[2].replace('.','')),0n);return{selected,sum}}
  const a=oracle('Oaxaca'),b=oracle('Puebla'),expected=[[[String(a.selected.length),money(a.sum),String(new Set(a.selected.map(row=>row[0])).size),String(a.selected.filter(row=>row.length===4).length),String(a.selected.filter(row=>row[4]==='').length)]],[['Oaxaca',money(a.sum)]],[['Puebla',money(b.sum)]]]
  for(let repetition=0;repetition<2;repetition++)for(const variant of repetition===0?['baseline','frozen']:['frozen','baseline']){
   expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(window=>window.webContents.getURL().startsWith('freyalab-analysis://')).length)).toBe(0)
   const hostBefore=process.memoryUsage();await memoryStart();const started=performance.now(),times:unknown[]=[];let setup:Awaited<ReturnType<typeof freeze>>|undefined
   try{
    if(variant==='frozen')setup=await freeze(doc)
    for(const [index,sql] of queries.entries()){
     const begin=performance.now()
     if(setup){const result=await engineCall<Output>(setup.id,'query',sql);expect(result.rows).toEqual(expected[index]);expect(result.limited).toBe(false);times.push({query:index,ms:performance.now()-begin})}
     else{const {result,ms,events}=await baseline(doc,sql);expect(result.rows).toEqual(expected[index]);expect(result.sources[0]).toMatchObject({rows:count,fromDisk:false,revision:doc.revision});expect(result.limited).toBe(false);times.push({query:index,ms,events})}
    }
    const totalMs=performance.now()-started,memory=await memoryStop(),hostAfter=process.memoryUsage()
    measurements.push({rows:count,bytes:Buffer.byteLength(text),openMs,repetition,variant,setup,times,totalMs,memory,hostBefore,hostAfter});console.log(JSON.stringify({rows:count,repetition,variant,totalMs}))
   }finally{await memoryStop();if(setup)await closeEngine(setup.id)}
   expect(await current(doc.id)).toEqual(doc);expect(hash(await readFile(path))).toBe(fileHash)
  }
  await page.evaluate(id=>window.freya.close(id),doc.id)
 }
 await writeFile(test.info().outputPath('measurements.json'),JSON.stringify({recordedAt:new Date().toISOString(),productionCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),platform:process.platform,arch:process.arch,os:release(),cpu:cpus()[0]?.model,logicalCpus:cpus().length,totalMemoryBytes:totalmem(),node:process.versions.node,electron:await app.evaluate(()=>process.versions.electron),method:{repetitions:2,order:['baseline-frozen','frozen-baseline'],queries:3,memory:'25 ms observations of summed Electron working sets; shared pages may be counted twice; host process separately observed before/after; not exclusive RSS or guaranteed peak',querySQL:queries},measurements},null,2)+'\n')
})

test('base V1 congelada: valores, cambios explícitos, aislamiento, rechazo y cancelación',async()=>{
 const text='\uFEFFCódigo,Importe,Final\r\n00123,10.25,\r\n9007199254740993,20.75\r\n',{doc,path}=await open('integridad.csv',text),originalHash=hash(await readFile(path)),before=await current(doc.id),v1=await freeze(doc)
 try{
  const exact='SELECT "Código","Final" FROM datos ORDER BY "Código"',total='SELECT COUNT(*),SUM(CAST("Importe" AS DECIMAL(38,2))) FROM datos'
  expect((await engineCall<Output>(v1.id,'query',exact)).rows).toEqual([['00123',''],['9007199254740993',null]])
  expect((await engineCall<Output>(v1.id,'query',`${total} WHERE FALSE`)).rows).toEqual([['0',null]])
  expect((await engineCall<Output>(v1.id,'query',total)).rows).toEqual([['2','31.00']]);expect(await current(doc.id)).toEqual(before)
  const edited=await page.evaluate(id=>window.freya.tableEdit(id,{type:'cell',rowId:'1',column:1,value:'100.25'}),doc.id)
  expect(edited.revision).toBeGreaterThan(v1.revision);expect(edited.dirty).toBe(true)
  expect((await engineCall<Output>(v1.id,'query',total)).rows).toEqual([['2','31.00']]);expect((await baseline(edited,total)).result.rows).toEqual([['2','121.00']]);expect(hash(await readFile(path))).toBe(originalHash)
  // A refresh is an explicit new capture, never a silent mutation of V1.
  const v2=await freeze(edited)
  try{expect(v2.rowHash).not.toBe(v1.rowHash);expect((await engineCall<Output>(v2.id,'query',total)).rows).toEqual([['2','121.00']])}finally{await closeEngine(v2.id)}
  const external='Código,Importe,Final\r\n00123,7.00,\r\n';await writeFile(path,external)
  expect((await engineCall<Output>(v1.id,'query',total)).rows).toEqual([['2','31.00']]);expect(await readFile(path,'utf8')).toBe(external)
  for(const sql of ['UPDATE _datos SET c2=\'0\'','DELETE FROM _datos',`COPY datos TO '${join(folder,'forbidden.csv').replaceAll("'","''")}'`,'SET enable_external_access=true','INSTALL httpfs',`SELECT * FROM read_csv('https://example.invalid/private.csv')`,`SELECT * FROM read_text('${path.replaceAll("'","''")}')`]){
   await expect(engineCall(v1.id,'query',sql)).rejects.toThrow();expect((await engineCall<Output>(v1.id,'query',total)).rows).toEqual([['2','31.00']])
  }
  let hits=0;server=createServer((_request,response)=>{hits++;response.end('forbidden')});await new Promise<void>(done=>server!.listen(0,'127.0.0.1',done));const address=server.address();if(!address||typeof address==='string')throw new Error('Sin puerto')
  const isolation=await app.evaluate(async({app,BrowserWindow},{id,path,port})=>{const window=BrowserWindow.fromId(id)!;const context=await window.webContents.executeJavaScript('({process:typeof process,require:typeof require,api:typeof freya})'),blocked=await window.webContents.executeJavaScript(`Promise.all(${JSON.stringify([`http://127.0.0.1:${port}/canary`,'file://'+path])}.map(url=>fetch(url).then(()=>false,()=>true)))`);return{context,blocked,sandboxed:app.getAppMetrics().find(metric=>metric.pid===window.webContents.getOSProcessId())?.sandboxed}},{id:v1.id,path,port:address.port})
  expect(isolation.context).toEqual({process:'undefined',require:'undefined',api:'undefined'});expect(isolation.blocked).toEqual([true,true]);expect(isolation.sandboxed).toBe(true);expect(hits).toBe(0)
  // This checks a pending request, not proof that DuckDB has begun its expensive scan.
  const pending=engineCall(v1.id,'query','SELECT SUM(sin(i)) FROM range(1000000000000) t(i)').then(()=>({rejected:false}),()=>({rejected:true}))
  await closeEngine(v1.id);expect((await pending).rejected).toBe(true);expect((await current(doc.id)).dirty).toBe(true);expect(await readFile(path,'utf8')).toBe(external)
  const engine=await startEngine();try{expect((await engineCall<Output>(engine.id,'query','SELECT 1')).rows).toEqual([['1']])}finally{await closeEngine(engine.id)}
 }finally{await closeEngine(v1.id)}
})
