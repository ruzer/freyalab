import {strict as assert} from 'node:assert'
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
import {formatNumber,t} from '../../src/shared/i18n'
import type {RecipeOperationProgress,RecipeOperationResult} from '../../src/shared/recipe-operation'
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
 await mkdir(join(folder,'02_datasets'))
 manifestBytes=await readFile(join(folder,'proyecto.freyalab'));filesBefore=(await readdir(folder,{recursive:true})).sort()
})
test.afterAll(async()=>{if(root)await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
test.beforeEach(async({},info)=>{
 const {ELECTRON_RUN_AS_NODE:_,...environment}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,
  args:process.env.FREYALAB_EXECUTABLE?[]:[resolve(process.env.FREYALAB_TEST_PROJECT_ENTRY??'out/main/index.js')],
  env:{...environment as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(root,'profile-'+info.testId),FREYALAB_TEST_OPEN:JSON.stringify([join(folder,'proyecto.freyalab')]),FREYALAB_TEST_EXTRACT_DIR:join(folder,'02_datasets')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
 await expect.poll(async()=>(await page.evaluate(()=>window.freya.projectState())).project?.id).toBe(projectId)
 // Abrir el proyecto no abre ni indexa el CSV como documento.
 expect(await page.evaluate(()=>window.freya.documents())).toEqual([])
 await startMemory()
})
test.afterEach(async()=>{await closeElectron(app)})

async function startMemory(){
 await app.evaluate(({app})=>{
  const previous=Reflect.get(globalThis,'subsetPerfMemory');if(previous?.timer)clearInterval(previous.timer)
  const state={samples:0,peakAppSumWorkingSetKiB:0,peakUtilitySumWorkingSetKiB:0,processes:new Map<number,{pid:number;name:string;peakObservedWorkingSetKiB:number;reportedPeakWorkingSetKiB:number}>(),timer:undefined as ReturnType<typeof setInterval>|undefined}
  const sample=()=>{
   const all=app.getAppMetrics(),metrics=all.filter(metric=>metric.type==='Utility');state.samples++
   state.peakAppSumWorkingSetKiB=Math.max(state.peakAppSumWorkingSetKiB,all.reduce((sum,item)=>sum+item.memory.workingSetSize,0))
   state.peakUtilitySumWorkingSetKiB=Math.max(state.peakUtilitySumWorkingSetKiB,metrics.reduce((sum,item)=>sum+item.memory.workingSetSize,0))
   for(const metric of metrics){const old=state.processes.get(metric.pid);state.processes.set(metric.pid,{pid:metric.pid,name:metric.name??'',peakObservedWorkingSetKiB:Math.max(old?.peakObservedWorkingSetKiB??0,metric.memory.workingSetSize),reportedPeakWorkingSetKiB:Math.max(old?.reportedPeakWorkingSetKiB??0,metric.memory.peakWorkingSetSize)})}
  }
  Reflect.set(state,'sample',sample);sample();state.timer=setInterval(sample,50);Reflect.set(globalThis,'subsetPerfMemory',state)
 })
}
async function stopMemory(){return app.evaluate(()=>{const state=Reflect.get(globalThis,'subsetPerfMemory');state.sample();clearInterval(state.timer);return{sampleIntervalMs:50,samples:state.samples,peakAppSumWorkingSetKiB:state.peakAppSumWorkingSetKiB,peakUtilitySumWorkingSetKiB:state.peakUtilitySumWorkingSetKiB,processes:[...state.processes.values()]}})}

async function recordResult(label:string,started:number,result:RecipeOperationResult,extra:Record<string,unknown>={}){
 const durationMs=performance.now()-started
 const memory=await stopMemory()
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
 if(process.platform==='darwin'&&process.arch==='x64')test.setTimeout(180_000)
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
  await expect(analyze).toHaveAccessibleDescription(t('subset.analysis.limit'))
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


test('PRJ-03 1 GB: exportar ID mayor que 500000 conserva medio millón de registros y sus bytes',{tag:'@perf'},async()=>{
 if(process.platform==='darwin'&&process.arch==='x64')test.setTimeout(180_000)
 const name='P3 mitad',output=join(folder,'02_datasets',name+'.csv')
 const existed=await stat(output).then(()=>true,error=>{if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error})
 try{
  expect(existed).toBe(false)
  const definition={...draft([{op:'filter',mode:'all',conditions:[{column:columns[0],op:'greater',value:'500000',caseSensitive:true}]}]),name}
  expect(await page.evaluate(input=>window.freya.projectSaveRecipe(input.id,input.draft),{id:projectId,draft:definition})).toBe(true)
  const recipeId=await page.evaluate(async name=>(await window.freya.projectState()).recipes.find(recipe=>recipe.name===name)!.id,name)
  await startMemory();const started=performance.now()
  const response=await page.evaluate(async input=>{
   let progress:RecipeOperationProgress|undefined
   const unsubscribe=window.freya.onEvent(event=>{if(event.type==='project-recipe-progress'&&event.recipeProgress?.requestId===input.request)progress=event.recipeProgress})
   try{const outcome=await window.freya.projectRecipeExport(input.id,input.recipe,input.request);return{outcome,progress}}
   finally{unsubscribe()}
  },{id:projectId,recipe:recipeId,request:randomUUID()})
  const durationMs=performance.now()-started,memory=await stopMemory()
  expect(response.outcome?.status).toBe('registered');if(response.outcome?.status!=='registered')throw new Error('La exportación no quedó registrada.')
  const result=response.outcome.result,info=await stat(output),outputSha=await fileSha(output),expectedHash=createHash('sha256').update('ID,Nota\n')
  for(let first=500_001;first<=records;first+=1_000)expectedHash.update(Array.from({length:Math.min(1_000,records-first+1)},(_,offset)=>`${String(first+offset).padStart(7,'0')},${payload}\n`).join(''))
  const expectedSha=expectedHash.digest('hex')
  expect(info.size).toBe(500_000_008);expect(outputSha).toBe(expectedSha)
  expect(result).toMatchObject({path:'02_datasets/'+name+'.csv',bytes:500_000_008,sha256:outputSha,provenance:{sourceSha256:source.sha256,coverage:{kind:'filtered',matched:500_000,scanned:records,total:records,complete:true},fidelity:{level:'bytes'}}})
  expect(response.progress).toMatchObject({bytesRead:source.bytes,scanned:records,totalBytes:source.bytes})
  const saved=JSON.parse(await readFile(join(folder,'proyecto.freyalab'),'utf8')) as ProjectManifest
  expect(saved.results).toHaveLength(1);expect(saved.results[0]).toMatchObject({id:result.id,path:result.path,bytes:info.size,sha256:outputSha,provenance:result.provenance})
  expect(memory.processes.some((item:{name:string})=>item.name==='FreyaLab CSV')).toBe(true)
  expect(await page.evaluate(()=>window.freya.documents())).toEqual([])
  expect((await stat(path)).mtimeMs).toBe(source.quick.mtimeMs);const sourceShaAfter=await fileSha(path);expect(sourceShaAfter).toBe(source.sha256)
  const report={recordedAt:new Date().toISOString(),label:'export-filter',...codeVersion(),application:await page.evaluate(()=>window.freya.appInfo()),machine:{platform:process.platform,architecture:process.arch,os:release(),cpu:cpus()[0]?.model,logicalCpus:cpus().length,totalMemoryBytes:totalmem(),node:process.versions.node,electron:await app.evaluate(()=>process.versions.electron)},source:{bytes:source.bytes,records,lineBytes,sha256:source.sha256,sha256After:sourceShaAfter},execution:{freshApp:true,sourceOpenedAsDocument:false,prewarmedByFixtureHash:true,integrityChecksOutsideDuration:true,durationMs,memory},output:{path:result.path,bytes:info.size,sha256:outputSha,expectedSha256:expectedSha},coverage:result.provenance.coverage,progress:response.progress,onePassEvidence:'El progreso público bytesRead coincide con el tamaño; no es una traza de syscalls de todo Electron.'}
  await writeFile(test.info().outputPath('prj03-export-filter.json'),JSON.stringify(report,null,2)+'\n')
 }finally{
  try{await page.evaluate(id=>window.freya.projectClose(id),projectId)}finally{await writeFile(join(folder,'proyecto.freyalab'),manifestBytes);if(!existed)await rm(output,{force:true})}
 }
})

test('PRJ-03 1 GB: exportar muestra de diez mil con semilla 7 conserva orden, datos y procedencia',{tag:'@perf'},async()=>{
 if(process.platform==='darwin'&&process.arch==='x64')test.setTimeout(180_000)
 const name='P3 muestra',output=join(folder,'02_datasets',name+'.csv')
 const existed=await stat(output).then(()=>true,error=>{if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error})
 try{
  expect(existed).toBe(false)
  const definition={...draft([{op:'sample',method:'random',rows:10_000,seed:7}]),name}
  expect(await page.evaluate(input=>window.freya.projectSaveRecipe(input.id,input.draft),{id:projectId,draft:definition})).toBe(true)
  const recipeId=await page.evaluate(async name=>(await window.freya.projectState()).recipes.find(recipe=>recipe.name===name)!.id,name)
  const recipeRow=projectTreeRow(page,name),resultRow=projectTreeRow(page,name+'.csv').and(page.locator('[data-project-node^="result:"]'))
  const menu=await openProjectRowMenu(recipeRow),analyze=menu.getByRole('menuitem',{name:t('analysis.tab.open'),exact:true})
  await expect(analyze).toBeDisabled();await expect(analyze).toHaveAccessibleDescription(t('subset.analysis.limit'));await menu.press('Escape')
  await expect(recipeRow.getByText(t('subset.analysis.limit'),{exact:true})).toBeVisible()
  const exportButton=recipeRow.getByRole('button',{name:t('project.export.action'),exact:true});await expect(exportButton).toBeEnabled()
  // Solo observa el evento público; la UI genera y envía su propio requestId.
  await page.evaluate(recipeId=>{
   let registered!:()=>void
   const state={progress:undefined as (RecipeOperationProgress&{requestId:string})|undefined,requestIds:[] as string[],registered:new Promise<void>(resolve=>{registered=resolve}),unsubscribe:()=>{}}
   state.unsubscribe=window.freya.onEvent(event=>{
    if(event.type==='project-recipe-progress'&&event.recipeProgress){state.progress=event.recipeProgress;if(!state.requestIds.includes(event.recipeProgress.requestId))state.requestIds.push(event.recipeProgress.requestId)}
    if(event.type==='project'&&event.projectResults?.some(result=>result.recipeId===recipeId))registered()
   })
   Reflect.set(window,'p3SampleProgress',state)
  },recipeId)
  await startMemory();const started=performance.now()
  await exportButton.press('Enter')
  // La operación de 1 GB termina con el registro público, no con el plazo visual de una fila.
  await page.evaluate(()=>Reflect.get(window,'p3SampleProgress').registered)
  await expect(resultRow).toBeVisible()
  const response=await page.evaluate(async recipe=>{
   const state=await window.freya.projectState(),probe=Reflect.get(window,'p3SampleProgress')
   probe.unsubscribe();Reflect.deleteProperty(window,'p3SampleProgress')
   return{result:state.results.find(result=>result.recipeId===recipe),progress:probe.progress as (RecipeOperationProgress&{requestId:string})|undefined,requestIds:probe.requestIds as string[]}
  },recipeId)
  const durationMs=performance.now()-started,memory=await stopMemory()
  expect(response.result).toBeDefined();if(!response.result)throw new Error('La exportación no quedó registrada.')
  const result=response.result,info=await stat(output),outputSha=await fileSha(output),lines=(await readFile(output,'utf8')).split('\n')
  expect(info.size).toBe(10_000_008);expect(lines.pop()).toBe('');expect(lines.shift()).toBe('ID,Nota');expect(lines).toHaveLength(10_000)
  const ids=lines.map(line=>Number(line.slice(0,7)))
  expect(new Set(ids).size).toBe(10_000);expect(ids).toEqual([...ids].sort((a,b)=>a-b))
  // Conserva los tres oráculos por fila sin generar 30.000 eventos de traza.
  for(const [index,line] of lines.entries()){assert.ok(ids[index]>=1);assert.ok(ids[index]<=records);assert.equal(line,`${String(ids[index]).padStart(7,'0')},${payload}`)}
  expect(result).toMatchObject({path:'02_datasets/'+name+'.csv',bytes:10_000_008,sha256:outputSha,provenance:{sourceSha256:source.sha256,coverage:{kind:'sample',matched:10_000,scanned:records,total:records,complete:true},fidelity:{level:'bytes'}}})
  expect(result.provenance.coverage.samplingStages).toEqual([{step:0,method:'random',requestedRows:10_000,seed:7,eligible:records,selected:10_000}])
  expect(response.progress).toMatchObject({bytesRead:source.bytes,scanned:records,totalBytes:source.bytes})
  expect(response.requestIds).toEqual([response.progress?.requestId])
  const saved=JSON.parse(await readFile(join(folder,'proyecto.freyalab'),'utf8')) as ProjectManifest
  expect(saved.results).toHaveLength(1);expect(saved.results[0]).toMatchObject({id:result.id,path:result.path,bytes:info.size,sha256:outputSha,provenance:result.provenance})
  expect(memory.processes.some((item:{name:string})=>item.name==='FreyaLab CSV')).toBe(true)
  expect(await page.evaluate(()=>window.freya.documents())).toEqual([])
  expect((await stat(path)).mtimeMs).toBe(source.quick.mtimeMs);const sourceShaAfter=await fileSha(path);expect(sourceShaAfter).toBe(source.sha256)
  const report={recordedAt:new Date().toISOString(),label:'export-random',...codeVersion(),application:await page.evaluate(()=>window.freya.appInfo()),machine:{platform:process.platform,architecture:process.arch,os:release(),cpu:cpus()[0]?.model,logicalCpus:cpus().length,totalMemoryBytes:totalmem(),node:process.versions.node,electron:await app.evaluate(()=>process.versions.electron)},source:{bytes:source.bytes,records,lineBytes,sha256:source.sha256,sha256After:sourceShaAfter},execution:{freshApp:true,sourceOpenedAsDocument:false,prewarmedByFixtureHash:true,integrityChecksOutsideDuration:true,trigger:'C15 visible Exportar button',completion:'registered result tree row and canonical projectState',durationMs,memory},output:{path:result.path,bytes:info.size,sha256:outputSha,records:lines.length,uniqueIds:new Set(ids).size,minId:ids[0],maxId:ids.at(-1),idsSha256:sha(ids.join(','))},coverage:result.provenance.coverage,progress:response.progress,onePassEvidence:'El progreso público bytesRead coincide con el tamaño; no es una traza de syscalls de todo Electron.'}
  await writeFile(test.info().outputPath('prj03-export-random.json'),JSON.stringify(report,null,2)+'\n')
  // El alta y el análisis posteriores quedan fuera de la medición de exportación.
  const handoffStarted=performance.now(),resultMenu=await openProjectRowMenu(resultRow)
  await resultMenu.getByRole('menuitem',{name:t('project.result.addSource'),exact:true}).press('Enter')
  const registration=page.getByRole('dialog',{name:t('project.source.add'),exact:true})
  await expect(registration.getByRole('listitem')).toHaveText(['ID','Nota'])
  await registration.getByRole('button',{name:t('project.source.register'),exact:true}).press('Enter');await expect(registration).toHaveCount(0)
  await expect(resultRow).toContainText(t('project.result.alsoSource'))
  const registered=JSON.parse(await readFile(join(folder,'proyecto.freyalab'),'utf8')) as ProjectManifest,added=registered.sources.find(item=>item.path===result.path)
  expect(registered.sources).toHaveLength(2);expect(added).toMatchObject({path:result.path,bytes:10_000_008,sha256:outputSha,external:false,protection:'readonly',schema:{columns}})
  if(!added)throw new Error('El resultado no quedó registrado como fuente.')
  const sourceRow=projectTreeRow(page,name+'.csv').and(page.locator('[data-project-node^="source:"]')),sourceMenu=await openProjectRowMenu(sourceRow)
  await sourceMenu.getByRole('menuitem',{name:t('analysis.tab.open'),exact:true}).press('Enter')
  await expect(page.getByRole('tab',{name:t('analysis.tab.label',{name:name+'.csv'}),exact:true})).toHaveAttribute('aria-selected','true')
  const workspace=page.locator('.analysis-workspace:not([hidden])'),information=workspace.getByRole('region',{name:t('info.title'),exact:true})
  await expect(information.getByRole('status')).toHaveText(t('info.complete'));await expect(information.locator('tbody tr')).toHaveCount(2)
  await expect(workspace).toContainText(t('analysis.tab.source',{name:name+'.csv',rows:formatNumber(10_000)}))
  const handoffDurationMs=performance.now()-handoffStarted,documents=await page.evaluate(()=>window.freya.documents())
  expect(documents).toHaveLength(1);expect(documents[0]).toMatchObject({name:name+'.csv',rowCount:10_000,headers:['ID','Nota'],readonly:true,dirty:false,projectSource:'protected'})
  expect(documents[0].analysisSubset).toBeUndefined()
  const after=JSON.parse(await readFile(join(folder,'proyecto.freyalab'),'utf8')) as ProjectManifest,stateAfter=await page.evaluate(()=>window.freya.projectState())
  expect(after.results).toEqual(saved.results);expect(after.recipes).toEqual(saved.recipes);expect(after.sources.find(item=>item.id===sourceId)).toEqual(source)
  expect(stateAfter.results.find(item=>item.id===result.id)).toMatchObject({isSource:true,provenance:result.provenance})
  expect(stateAfter.sources.find(item=>item.id===added.id)).toMatchObject({bytes:10_000_008,status:'verified',overAnalysis:false})
  const sourceShaAfterAnalysis=await fileSha(path),outputShaAfterAnalysis=await fileSha(output)
  expect(sourceShaAfterAnalysis).toBe(source.sha256);expect(outputShaAfterAnalysis).toBe(outputSha);expect((await stat(path)).mtimeMs).toBe(source.quick.mtimeMs)
  await writeFile(test.info().outputPath('prj03-export-random-c15.json'),JSON.stringify({criterion:'PRJ-03 C15',kind:'end-to-end, separate from export measurement',handoff:{from:'Añadir como fuente',to:'Información completa',durationMs:handoffDurationMs},source:{bytes:source.bytes,sha256:source.sha256,sha256After:sourceShaAfterAnalysis},result:{id:result.id,bytes:info.size,sha256:outputSha,sha256After:outputShaAfterAnalysis,provenanceUnchanged:true},registeredSourceId:added.id,analysis:{rows:documents[0].rowCount,columns:documents[0].headers,informationComplete:true}},null,2)+'\n')
 }finally{
  try{await page.evaluate(()=>{Reflect.get(window,'p3SampleProgress')?.unsubscribe();Reflect.deleteProperty(window,'p3SampleProgress')});await page.evaluate(id=>window.freya.projectClose(id),projectId)}finally{await writeFile(join(folder,'proyecto.freyalab'),manifestBytes);if(!existed)await rm(output,{force:true})}
 }
})

test('PRJ-03 1 GB: cancelar una exportación a mitad no deja archivo, temporal ni resultado',{tag:'@perf'},async()=>{
 const name='P3 cancelada',output=join(folder,'02_datasets',name+'.csv')
 const existed=await stat(output).then(()=>true,error=>{if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error})
 try{
  expect(existed).toBe(false)
  const definition={...draft([{op:'sample',method:'random',rows:10_000,seed:7}]),name}
  expect(await page.evaluate(input=>window.freya.projectSaveRecipe(input.id,input.draft),{id:projectId,draft:definition})).toBe(true)
  const manifestBeforeExport=await readFile(join(folder,'proyecto.freyalab'))
  const recipeId=await page.evaluate(async name=>(await window.freya.projectState()).recipes.find(recipe=>recipe.name===name)!.id,name)
  await startMemory();const started=performance.now()
  const response=await page.evaluate(async input=>{
   let cancel:Promise<void>|undefined,progressAtCancel:RecipeOperationProgress|undefined
   const unsubscribe=window.freya.onEvent(event=>{
    if(event.type==='project-recipe-progress'&&event.recipeProgress?.requestId===input.request&&event.recipeProgress.bytesRead>=input.half&&!cancel){progressAtCancel=event.recipeProgress;cancel=window.freya.projectRecipeCancel(input.request)}
   })
   try{const outcome=await window.freya.projectRecipeExport(input.id,input.recipe,input.request);await cancel;return{outcome,requested:!!cancel,progressAtCancel}}
   finally{unsubscribe()}
  },{id:projectId,recipe:recipeId,request:randomUUID(),half:source.bytes/2})
  const durationMs=performance.now()-started,memory=await stopMemory()
  expect(response.requested).toBe(true);expect(response.outcome).toEqual({status:'cancelled'})
  expect(response.progressAtCancel?.bytesRead).toBeGreaterThanOrEqual(source.bytes/2);expect(response.progressAtCancel?.bytesRead).toBeLessThan(source.bytes)
  expect((await page.evaluate(()=>window.freya.projectState())).results).toEqual([])
  expect((JSON.parse(await readFile(join(folder,'proyecto.freyalab'),'utf8')) as ProjectManifest).results).toEqual([])
  expect(await readFile(join(folder,'proyecto.freyalab'))).toEqual(manifestBeforeExport)
  expect((await readdir(folder,{recursive:true})).sort()).toEqual(filesBefore)
  expect(await stat(output).then(()=>true,error=>{if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error})).toBe(false)
  expect(memory.processes.some((item:{name:string})=>item.name==='FreyaLab CSV')).toBe(true)
  expect(await page.evaluate(()=>window.freya.documents())).toEqual([])
  expect((await stat(path)).mtimeMs).toBe(source.quick.mtimeMs);const sourceShaAfter=await fileSha(path);expect(sourceShaAfter).toBe(source.sha256)
  const report={recordedAt:new Date().toISOString(),label:'export-cancel',...codeVersion(),application:await page.evaluate(()=>window.freya.appInfo()),machine:{platform:process.platform,architecture:process.arch,os:release(),cpu:cpus()[0]?.model,logicalCpus:cpus().length,totalMemoryBytes:totalmem(),node:process.versions.node,electron:await app.evaluate(()=>process.versions.electron)},source:{bytes:source.bytes,records,lineBytes,sha256:source.sha256,sha256After:sourceShaAfter},execution:{freshApp:true,sourceOpenedAsDocument:false,prewarmedByFixtureHash:true,integrityChecksOutsideDuration:true,durationMs,memory},result:response,output:{exists:false,bytes:0,sha256:null},manifestResults:[]}
  await writeFile(test.info().outputPath('prj03-export-cancel.json'),JSON.stringify(report,null,2)+'\n')
 }finally{
  try{await page.evaluate(id=>window.freya.projectClose(id),projectId)}finally{await writeFile(join(folder,'proyecto.freyalab'),manifestBytes);if(!existed)await rm(output,{force:true})}
 }
})
