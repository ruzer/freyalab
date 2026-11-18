import {expect,test,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {createHash,randomUUID} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {createReadStream} from 'node:fs'
import {mkdtemp,mkdir,open,readFile,readdir,rm,stat,writeFile} from 'node:fs/promises'
import {cpus,release,tmpdir,totalmem} from 'node:os'
import {join,resolve} from 'node:path'
import type {ProjectManifest,ProjectSource} from '../../src/shared/project'
import type {ProjectRecipeDraft} from '../../src/shared/project-recipes'
import type {RecipeOperationResult} from '../../src/shared/recipe-operation'
import {closeElectron} from './close-electron'
import {projectTreeRow,openProjectRowMenu} from './project-panel'

const records=1_000_000,lineBytes=1_000,sourceId='gb-source',projectId='gb-project'
const payload='z'.repeat(991),columns=[{position:1,name:'ID'},{position:2,name:'Nota'}]
let root:string,folder:string,path:string,source:ProjectSource,app:ElectronApplication,page:Page,manifestBytes:Buffer,filesBefore:string[]
const sha=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex')
async function fileSha(file:string){const hash=createHash('sha256');for await(const bytes of createReadStream(file))hash.update(bytes);return hash.digest('hex')}
function codeVersion(){
 try{return{sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceModified:!!execFileSync('git',['status','--porcelain','--untracked-files=all','--','src','tests','scripts','package.json','package-lock.json','electron.vite.config.ts'],{encoding:'utf8'}).trim()}}
 catch{return{sha:process.env.GITHUB_SHA??null,sourceModified:null}}
}

test.beforeAll(async()=>{
 root=await mkdtemp(join(tmpdir(),'freya-subset-gb-'));folder=join(root,'Proyecto');await mkdir(folder);path=join(folder,'gigabyte.csv')
 const handle=await open(path,'wx'),hash=createHash('sha256'),header=Buffer.from('ID,Nota\n')
 try{
  await handle.writeFile(header);hash.update(header)
  for(let first=1;first<=records;first+=1_000){
   const text=Array.from({length:1_000},(_,offset)=>`${String(first+offset).padStart(7,'0')},${payload}\n`).join(''),block=Buffer.from(text)
   if(block.length!==1_000*lineBytes)throw new Error('El fixture no tiene registros de mil bytes.')
   await handle.writeFile(block);hash.update(block)
  }
  await handle.sync()
 }finally{await handle.close()}
 const info=await stat(path),file=await open(path,'r'),head=Buffer.alloc(65_536),tail=Buffer.alloc(65_536)
 try{await file.read(head,0,head.length,0);await file.read(tail,0,tail.length,info.size-tail.length)}finally{await file.close()}
 expect(info.size).toBe(1_000_000_008)
 const date='2026-11-16T00:00:00.000Z'
 source={id:sourceId,path:'gigabyte.csv',external:false,protection:'readonly',bytes:info.size,sha256:hash.digest('hex'),registeredAt:date,
  quick:{mtimeMs:info.mtimeMs,headSha256:sha(head),tailSha256:sha(tail)},format:{encoding:'utf8',bom:false,delimiter:',',header:true,eol:'\n',finalEol:true},schema:{sha256:sha(JSON.stringify(columns)),columns}}
 // Hash del archivo ya escrito: independiente del contador y la huella devueltos por el motor.
 expect(await fileSha(path)).toBe(source.sha256)
 const manifest:ProjectManifest={format:'freyalab-project',version:1,id:projectId,name:'Un gigabyte',createdAt:date,sources:[source],recipes:[],results:[]}
 await writeFile(join(folder,'proyecto.freyalab'),JSON.stringify(manifest,null,2)+'\n')
 manifestBytes=await readFile(join(folder,'proyecto.freyalab'));filesBefore=(await readdir(folder,{recursive:true})).sort()
})
test.afterAll(async()=>{if(root)await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
test.beforeEach(async({},info)=>{
 const {ELECTRON_RUN_AS_NODE:_,...environment}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,
  args:process.env.FREYALAB_EXECUTABLE?[]:[resolve(process.env.FREYALAB_TEST_PROJECT_ENTRY??'out/main/index.js')],
  env:{...environment as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(root,'profile-'+info.testId),FREYALAB_TEST_OPEN:JSON.stringify([join(folder,'proyecto.freyalab')])}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
 await expect.poll(async()=>(await page.evaluate(()=>window.freya.projectState())).project?.id).toBe(projectId)
 // Abrir el proyecto no abre ni indexa el CSV como documento.
 expect(await page.evaluate(()=>window.freya.documents())).toEqual([])
 await app.evaluate(({app})=>{
  const state={samples:0,peakAppSumWorkingSetKiB:0,peakUtilitySumWorkingSetKiB:0,processes:new Map<number,{pid:number;name:string;peakObservedWorkingSetKiB:number;reportedPeakWorkingSetKiB:number}>(),timer:undefined as ReturnType<typeof setInterval>|undefined}
  const sample=()=>{
   const all=app.getAppMetrics(),metrics=all.filter(metric=>metric.type==='Utility');state.samples++
   state.peakAppSumWorkingSetKiB=Math.max(state.peakAppSumWorkingSetKiB,all.reduce((sum,item)=>sum+item.memory.workingSetSize,0))
   state.peakUtilitySumWorkingSetKiB=Math.max(state.peakUtilitySumWorkingSetKiB,metrics.reduce((sum,item)=>sum+item.memory.workingSetSize,0))
   for(const metric of metrics){const old=state.processes.get(metric.pid);state.processes.set(metric.pid,{pid:metric.pid,name:metric.name??'',peakObservedWorkingSetKiB:Math.max(old?.peakObservedWorkingSetKiB??0,metric.memory.workingSetSize),reportedPeakWorkingSetKiB:Math.max(old?.reportedPeakWorkingSetKiB??0,metric.memory.peakWorkingSetSize)})}
  }
  Reflect.set(state,'sample',sample);sample();state.timer=setInterval(sample,50);Reflect.set(globalThis,'subsetPerfMemory',state)
 })
})
test.afterEach(async()=>{await closeElectron(app)})

async function recordResult(label:string,started:number,result:RecipeOperationResult,extra:Record<string,unknown>={}){
 const durationMs=performance.now()-started
 const memory=await app.evaluate(()=>{const state=Reflect.get(globalThis,'subsetPerfMemory');state.sample();clearInterval(state.timer);return{sampleIntervalMs:50,samples:state.samples,peakAppSumWorkingSetKiB:state.peakAppSumWorkingSetKiB,peakUtilitySumWorkingSetKiB:state.peakUtilitySumWorkingSetKiB,processes:[...state.processes.values()]}})
 expect(memory.processes.some((item:{name:string})=>item.name==='FreyaLab CSV')).toBe(true)
 expect(await page.evaluate(()=>window.freya.documents())).toEqual([])
 expect((await readdir(folder,{recursive:true})).sort()).toEqual(filesBefore)
 expect((await readFile(join(folder,'proyecto.freyalab'))).equals(manifestBytes)).toBe(true)
 expect((await stat(path)).mtimeMs).toBe(source.quick.mtimeMs)
 expect(await fileSha(path)).toBe(source.sha256)
 const {rows,...counts}=result
 const report={recordedAt:new Date().toISOString(),label,...codeVersion(),application:await page.evaluate(()=>window.freya.appInfo()),machine:{platform:process.platform,architecture:process.arch,os:release(),cpu:cpus()[0]?.model,logicalCpus:cpus().length,totalMemoryBytes:totalmem(),node:process.versions.node,electron:await app.evaluate(()=>process.versions.electron)},source:{bytes:source.bytes,records,lineBytes,sha256:source.sha256},execution:{freshApp:true,sourceOpenedAsDocument:false,prewarmedByFixtureHash:true,integrityChecksOutsideDuration:true,durationMs,memory},result:{...counts,previewRows:rows.length,previewIds:rows.map(row=>row[0])},...extra}
 await writeFile(test.info().outputPath(`prj02-${label}.json`),JSON.stringify(report,null,2)+'\n')
}
function draft(steps:ProjectRecipeDraft['steps']):ProjectRecipeDraft{return{name:'Medición',sourceId,steps}}

test('PRJ-02a 1 GB: primeras dos filas leen solo un prefijo y no afirman identidad completa',{tag:'@perf'},async()=>{
 const started=performance.now(),result=await page.evaluate(input=>window.freya.projectRecipeTry(input.id,input.draft,input.request),{id:projectId,draft:draft([{op:'sample',method:'first',rows:2}]),request:randomUUID()})
 expect(result).toMatchObject({resultCount:2,scanned:2,complete:false,cancelled:false,sourceVersionDifferent:false})
 expect(result.rows).toEqual([['0000001',payload],['0000002',payload]])
 expect(result.bytesRead).toBeGreaterThan(0);expect(result.bytesRead).toBeLessThan(source.bytes);expect(result).not.toHaveProperty('sha256')
 await recordResult('first',started,result)
})

test('PRJ-02a 1 GB: depósito de diez mil, cien ejemplos y fuente completa verificada',{tag:'@perf'},async()=>{
 const started=performance.now(),result=await page.evaluate(input=>window.freya.projectRecipeTry(input.id,input.draft,input.request),{id:projectId,draft:draft([{op:'sample',method:'random',rows:10_000,seed:7}]),request:randomUUID()})
 expect(result).toMatchObject({resultCount:10_000,scanned:records,eligible:records,complete:true,cancelled:false,bytesRead:source.bytes,sha256:source.sha256})
 expect(result.sampling).toEqual([{step:0,method:'random',requestedRows:10_000,seed:7,eligible:records,selected:10_000}])
 expect(result.rows).toHaveLength(100)
 const ids=result.rows.map(row=>Number(row[0]));expect(new Set(ids).size).toBe(100);expect(ids).toEqual([...ids].sort((a,b)=>a-b))
 for(const [index,row] of result.rows.entries()){expect(ids[index]).toBeGreaterThanOrEqual(1);expect(ids[index]).toBeLessThanOrEqual(records);expect(row).toEqual([String(ids[index]).padStart(7,'0'),payload])}
 await recordResult('random',started,result,{onePassEvidence:'El contador público bytesRead coincide con el tamaño; fuente sin documento/indexación. No es una traza de syscalls de todo Electron.'})
})

test('PRJ-02a 1 GB: cancelar a mitad conserva cobertura parcial y no crea archivos',{tag:'@perf'},async()=>{
 const started=performance.now(),response=await page.evaluate(async input=>{
  let cancel:Promise<void>|undefined,progressAtCancel:unknown
  const unsubscribe=window.freya.onEvent(event=>{
   if(event.type==='project-recipe-progress'&&event.recipeProgress?.requestId===input.request&&event.recipeProgress.scanned>=input.half&&!cancel){progressAtCancel=event.recipeProgress;cancel=window.freya.projectRecipeCancel(input.request)}
  })
  try{const result=await window.freya.projectRecipeTry(input.id,input.draft,input.request);await cancel;return{result,requested:!!cancel,progressAtCancel}}
  finally{unsubscribe()}
 },{id:projectId,draft:draft([{op:'sample',method:'random',rows:10_000,seed:7}]),request:randomUUID(),half:records/2})
 expect(response.requested).toBe(true);expect(response.result).toMatchObject({cancelled:true,complete:false})
 expect(response.result.scanned).toBeGreaterThanOrEqual(records/2);expect(response.result.scanned).toBeLessThan(records);expect(response.result.bytesRead).toBeGreaterThan(0);expect(response.result.bytesRead).toBeLessThan(source.bytes);expect(response.result).not.toHaveProperty('sha256')
 await recordResult('cancel',started,response.result,{progressAtCancel:response.progressAtCancel})
})

test('PRJ-02b 1 GB: una muestra no permite saltar el límite analítico de la raíz',{tag:'@perf'},async()=>{
 try{
  await page.evaluate(input=>window.freya.projectSaveRecipe(input.projectId,{name:'Dos filas desde un gigabyte',sourceId:input.sourceId,steps:[{op:'sample',method:'first',rows:2}]}),{projectId,sourceId})
  const row=projectTreeRow(page,'Dos filas desde un gigabyte'),menu=await openProjectRowMenu(row)
  const analyze=menu.getByRole('menuitem',{name:'Analizar',exact:true})
  await expect(analyze).toBeDisabled()
  await expect(analyze).toHaveAccessibleDescription('La fuente supera el límite de análisis. Extrae las filas a un archivo nuevo y añádelo como fuente.')
  await menu.press('Escape')
  const response=await page.evaluate(async projectId=>{
   const state=await window.freya.projectState(),recipe=state.recipes.find(recipe=>recipe.name==='Dos filas desde un gigabyte')!
   try{await window.freya.projectRecipeAnalyze(projectId,recipe.id,crypto.randomUUID());return'NO RECHAZADO'}catch(error){return String(error)}
  },projectId)
  expect(response).toContain('256 MiB')
  expect(await page.evaluate(()=>window.freya.documents())).toEqual([])
  expect(await app.evaluate(({app})=>app.getAppMetrics().some(metric=>metric.name==='FreyaLab CSV'))).toBe(false)
  expect((await stat(path)).mtimeMs).toBe(source.quick.mtimeMs)
 }finally{await page.evaluate(id=>window.freya.projectClose(id),projectId);await writeFile(join(folder,'proyecto.freyalab'),manifestBytes)}
})
