import {expect,test,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {copyFile,mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {closeElectron} from './close-electron'
import {t,type Language} from '../../src/shared/i18n'

let app:ElectronApplication,page:Page,root:string,folder:string,source:string,original:Buffer,locale:Language='es'
let pageErrors:string[]=[]
const panel=()=>page.getByRole('tabpanel',{name:t('project.tab',{},locale),exact:true})
const tr=(key:string)=>t(key,{},locale)
const subsetRow=(name:string)=>panel().getByText(name,{exact:true}).locator('..')
test.beforeEach(async({},info)=>{
 locale=info.title.endsWith('[en-XA]')?'en-XA':info.title.endsWith('[en]')?'en':'es'
 root=await mkdtemp(join(tmpdir(),'freya-subset-analysis-'));folder=join(root,'Censo');await mkdir(folder)
 source=join(folder,'censo.csv');original=await readFile(resolve('tests/fixtures/prj02-censo.csv'));await writeFile(source,original)
 const {ELECTRON_RUN_AS_NODE:_,...environment}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,
  args:process.env.FREYALAB_EXECUTABLE?[]:[resolve(process.env.FREYALAB_TEST_PROJECT_ENTRY??'out/main/index.js')],
  env:{...environment as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:locale,FREYALAB_USER_DATA:join(root,'profile'),FREYALAB_TEST_FOLDER:folder,FREYALAB_TEST_PROJECT_SOURCE_PATH:source}})
 page=await app.firstWindow();pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));await page.waitForFunction(()=>!!window.freya)
 await page.setViewportSize({width:1440,height:900})
})
test.afterEach(async()=>{try{expect(pageErrors).toEqual([])}finally{try{if(app)await closeElectron(app)}finally{await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:200})}}})

async function registeredSubset(){
 await page.getByRole('button',{name:tr('project.create'),exact:true}).press('Enter')
 const create=page.getByRole('dialog',{name:tr('project.new'),exact:true})
 await create.getByRole('button',{name:tr('project.pickFolder'),exact:true}).press('Enter')
 await create.getByRole('button',{name:tr('project.create'),exact:true}).press('Enter')
 const add=panel().getByRole('button',{name:tr('project.source.add'),exact:true});await expect(add).toBeEnabled();await add.press('Enter')
 const registration=page.getByRole('dialog',{name:tr('project.source.add'),exact:true})
 await expect(registration.getByRole('listitem')).toHaveText(['ID','Entidad','Edad','Ingreso','Nota'])
 await registration.getByRole('button',{name:tr('project.source.register'),exact:true}).press('Enter')
 await expect(registration).toHaveCount(0)
 await page.evaluate(async()=>{
  const {project,sources}=await window.freya.projectState(),source=sources[0]
  if(!project||!source)throw new Error('Falta la fuente del fixture')
  await window.freya.projectSaveRecipe(project.id,{name:'Oaxaca, adultos',sourceId:source.id,steps:[
   {op:'filter',mode:'all',conditions:[{column:{position:2,name:'Entidad'},op:'equals',value:'Oaxaca',caseSensitive:false},{column:{position:3,name:'Edad'},op:'greaterEqual',value:'18',caseSensitive:false}]},
   {op:'order',by:[{column:{position:3,name:'Edad'},descending:true,numeric:true}]},
   {op:'select',columns:[{position:1,name:'ID'},{position:3,name:'Edad'},{position:5,name:'Nota'}]}
  ]})
 })
 await expect(subsetRow('Oaxaca, adultos')).toBeVisible()
}

test('PRJ-02b: analizar usa las tres filas y columnas del conjunto, sin abrir ni modificar la fuente',async()=>{
 await registeredSubset()
 const before=await readFile(join(folder,'proyecto.freyalab'))
 await subsetRow('Oaxaca, adultos').locator(':scope > .actions').getByRole('button',{name:tr('analysis.tab.open'),exact:true}).press('Enter')
 const analysis=page.getByRole('tab',{name:t('analysis.tab.label',{name:'Oaxaca, adultos'},locale),exact:true})
 await expect(analysis).toHaveAttribute('aria-selected','true')
 const workspace=page.locator('.analysis-workspace:not([hidden])')
 await expect(workspace).toContainText('Datos del conjunto Oaxaca, adultos · 3 filas · La fuente no se modifica')
 await workspace.getByRole('button',{name:tr('info.calculate'),exact:true}).press('Enter')
 await expect(workspace.getByRole('region',{name:tr('info.title'),exact:true}).getByRole('status')).toContainText(tr('info.complete'))
 await expect(workspace.locator('.file-summary')).toContainText('3 filas × 3 columnas')
 const documents=await page.evaluate(()=>window.freya.documents())
 expect(documents).toHaveLength(1)
 expect(documents[0]).toMatchObject({name:'Oaxaca, adultos',readonly:true,dirty:false,path:null,rowCount:3,headers:['ID','Edad','Nota']})
 expect((await readFile(source)).equals(original)).toBe(true)
 expect(await readFile(join(folder,'proyecto.freyalab'))).toEqual(before)
})

test('PRJ-02b: Gráficos identifica el conjunto completo y conserva su cobertura',async()=>{
 await registeredSubset()
 await subsetRow('Oaxaca, adultos').locator(':scope > .actions').getByRole('button',{name:tr('analysis.tab.open'),exact:true}).press('Enter')
 const workspace=page.locator('.analysis-workspace:not([hidden])')
 await workspace.getByRole('button',{name:tr('analysis.tab.section.charts'),exact:true}).press('Enter')
 await expect(workspace.locator('.result-status')).toHaveAttribute('title','Conjunto completo')
 await expect(workspace.locator('.subset-chart-coverage')).toContainText('3 de 7 registros')
})

test('PRJ-02b: SQL conserva valores y ausentes del conjunto sin afirmar que incluye cambios pendientes',async()=>{
 await registeredSubset()
 await subsetRow('Oaxaca, adultos').locator(':scope > .actions').getByRole('button',{name:tr('analysis.tab.open'),exact:true}).press('Enter')
 const workspace=page.locator('.analysis-workspace:not([hidden])')
 await workspace.getByRole('button',{name:tr('analysis.tab.section.sql'),exact:true}).press('Enter')
 await expect(workspace.locator('.sql-panel > p').first()).not.toContainText('incluidos los cambios pendientes')
 await workspace.getByRole('textbox',{name:'Consulta SQL',exact:true}).fill('SELECT "ID", "Edad", "Nota" FROM datos ORDER BY CAST("Edad" AS INTEGER)')
 await workspace.getByRole('button',{name:'Ejecutar consulta',exact:true}).press('Enter')
 await expect(workspace.locator('.sql-results tbody tr')).toHaveCount(3)
 await expect(workspace.locator('.sql-results tbody tr').nth(0).locator('td')).toHaveText(['00123','34','línea 1\nlínea 2'])
 await expect(workspace.locator('.sql-results tbody tr').nth(1).locator('td')).toHaveText(['00126','52','ok'])
 await expect(workspace.locator('.sql-results tbody tr').nth(2).locator('td')).toHaveText(['00128','61','NULL'])
 expect((await readFile(source)).equals(original)).toBe(true)
})

test('PRJ-02b: reabrir una versión futura del mismo proyecto libera sus pestañas analíticas',async()=>{
 await registeredSubset()
 await subsetRow('Oaxaca, adultos').locator(':scope > .actions').getByRole('button',{name:tr('analysis.tab.open'),exact:true}).press('Enter')
 const analysis=page.getByRole('tab',{name:t('analysis.tab.label',{name:'Oaxaca, adultos'},locale),exact:true})
 await expect(analysis).toBeVisible()
 const path=(await page.evaluate(()=>window.freya.projectState())).project!.path
 const file=join(folder,'proyecto.freyalab'),manifest=JSON.parse(await readFile(file,'utf8'))
 await writeFile(file,JSON.stringify({...manifest,version:2})+'\n')
 await page.evaluate(path=>window.freya.projectOpenRecent(path),path)
 await expect(analysis).toHaveCount(0)
 expect((await page.evaluate(()=>window.freya.documents())).filter(doc=>doc.analysisSubset)).toEqual([])
 expect((await page.evaluate(()=>window.freya.projectState())).project).toMatchObject({id:manifest.id,version:2,readonly:true})
 const future=await readFile(file)
 await subsetRow('Oaxaca, adultos').locator(':scope > .actions').getByRole('button',{name:tr('analysis.tab.open'),exact:true}).press('Enter')
 await expect(analysis).toBeVisible()
 expect(await readFile(file)).toEqual(future)
})

test('PRJ-02b: el análisis usa más de cien filas, no la vista previa del conjunto',async()=>{
 original=Buffer.from('ID,Entidad,Edad,Ingreso,Nota\n'+Array.from({length:150},(_,index)=>`${String(index+1).padStart(5,'0')},Oaxaca,${20+index},10,nota`).join('\n')+'\n')
 await writeFile(source,original)
 await registeredSubset()
 await subsetRow('Oaxaca, adultos').locator(':scope > .actions').getByRole('button',{name:tr('analysis.tab.open'),exact:true}).press('Enter')
 const workspace=page.locator('.analysis-workspace:not([hidden])')
 await workspace.getByRole('button',{name:tr('info.calculate'),exact:true}).press('Enter')
 await expect(workspace.locator('.file-summary')).toContainText('150 filas × 3 columnas')
 const [document]=await page.evaluate(()=>window.freya.documents())
 const stats=await page.evaluate(id=>window.freya.stats(id,null,[1]),document.id)
 expect(stats).toMatchObject({cells:150,numeric:150,min:20,max:169,sum:14175,sample:false})
 expect((await readFile(source)).equals(original)).toBe(true)
})

test('PRJ-02b: una muestra se guarda y otro conjunto la ordena por edad sin cambiar las filas elegidas',async()=>{
 await registeredSubset()
 await page.evaluate(async()=>{
  const state=await window.freya.projectState(),project=state.project!,source=state.sources[0]
  await window.freya.projectSaveRecipe(project.id,{name:'Muestra, semilla 7',sourceId:source.id,steps:[{op:'sample',method:'random',rows:3,seed:7}]})
  const sample=(await window.freya.projectState()).recipes.find(recipe=>recipe.name==='Muestra, semilla 7')!
  await window.freya.projectSaveRecipe(project.id,{name:'Muestra ordenada',baseRecipeId:sample.id,steps:[{op:'order',by:[{column:{position:3,name:'Edad'},descending:true,numeric:true}]}]})
 })
 await subsetRow('Muestra ordenada').locator(':scope > .actions').getByRole('button',{name:tr('dialog.open.button'),exact:true}).press('Enter')
 const subset=page.getByRole('region',{name:tr('subset.title'),exact:true})
 await expect(subset.getByRole('table',{name:tr('subset.preview'),exact:true}).locator('tbody th')).toHaveText(['00128','9007199254740993','00124'])
 await expect(subset.locator('.coverage')).not.toContainText(/Paso \d|Step \d/)
 await expect(subset.locator('.coverage')).not.toContainText('bytes leídos')
 await expect(subset.locator('.coverage')).toContainText('Fuente verificada por completo')
 expect((await readFile(source)).equals(original)).toBe(true)
})

async function ageHistogram(){
 const workspace=page.locator('.analysis-workspace:not([hidden])')
 await workspace.getByRole('button',{name:tr('analysis.tab.section.charts'),exact:true}).press('Enter')
 const create=workspace.locator('.empty-result button');await expect(create).toBeEnabled();await create.press('Enter')
 await expect.poll(()=>workspace.locator('.more-options .table-scroll tbody tr').count()).toBeGreaterThan(0)
 await workspace.getByRole('button',{name:tr('charts.kind.histogram'),exact:true}).press('Enter')
 const more=workspace.locator('.more-options')
 await more.locator(':scope > summary').press('Enter')
 await more.getByLabel(tr('charts.ui.yLabel'),{exact:true}).selectOption('1')
 await more.getByRole('spinbutton',{name:tr('charts.ui.binsLabel'),exact:true}).fill('3')
 const generate=workspace.getByRole('button',{name:tr('charts.ui.generate'),exact:true})
 await expect(generate).toBeEnabled();await generate.press('Enter')
 await more.getByText(tr('charts.ui.table'),{exact:true}).press('Enter')
 const rows=more.locator('.table-scroll tbody tr');await expect(rows).toHaveCount(3)
 expect(await rows.evaluateAll(rows=>rows.map(row=>Array.from(row.querySelectorAll('td'),cell=>Number(cell.textContent))))).toEqual([[34,1,43],[43,0,52],[52,2,61]])
 await more.locator(':scope > summary').press('Enter')
 await expect(workspace.locator('.plot svg')).toBeVisible()
 return workspace
}

test('PRJ-02b: el histograma de Edad representa 34, 52 y 61 y las estadísticas coinciden',async()=>{
 await registeredSubset()
 await subsetRow('Oaxaca, adultos').locator(':scope > .actions').getByRole('button',{name:tr('analysis.tab.open'),exact:true}).press('Enter')
 await ageHistogram()
 const [document]=await page.evaluate(()=>window.freya.documents())
 const result=await page.evaluate(id=>window.freya.stats(id,null,[1]),document.id)
 expect(result).toMatchObject({cells:3,numeric:3,min:34,max:61,sum:147,median:52,sample:false})
 expect((await readFile(source)).equals(original)).toBe(true)
})

for(const language of ['es','en-XA'] as const)test(`PRJ-02b: teclado y capturas de análisis y cadena de tres niveles [${language}]`,async({},info)=>{
 await registeredSubset()
 await page.evaluate(async()=>{
  const {project,sources}=await window.freya.projectState()
  await window.freya.projectSaveRecipe(project!.id,{name:'Muestra, semilla 7',sourceId:sources[0].id,steps:[{op:'sample',method:'random',rows:3,seed:7}]})
  const sample=(await window.freya.projectState()).recipes.find(recipe=>recipe.name==='Muestra, semilla 7')!
  await window.freya.projectSaveRecipe(project!.id,{name:'Muestra ordenada',baseRecipeId:sample.id,steps:[{op:'order',by:[{column:{position:3,name:'Edad'},descending:true,numeric:true}]}]})
  const ordered=(await window.freya.projectState()).recipes.find(recipe=>recipe.name==='Muestra ordenada')!
  await window.freya.projectSaveRecipe(project!.id,{name:'Dos mayores de muestra',baseRecipeId:ordered.id,steps:[{op:'sample',method:'first',rows:2}]})
  await window.freya.setSettings({barraLateral:{visible:true,ancho:420}})
 })
 async function captures(kind:string){
  for(const [width,height] of [[1440,900],[1280,720]])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height});await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption(theme)
   await expect.poll(()=>page.locator('html').evaluate(element=>element.classList.contains('dark'))).toBe(theme==='dark')
   await page.evaluate(()=>document.fonts.ready)
   if(kind==='conjunto-cadena')await page.locator('.subset-tools .coverage').scrollIntoViewIfNeeded()
   if(kind==='proyecto-cadena'){
    await panel().getByText('Muestra, semilla 7',{exact:true}).evaluate(element=>element.scrollIntoView({block:'start'}))
    const bounds=await panel().boundingBox()
    for(const name of ['Muestra, semilla 7','Muestra ordenada','Dos mayores de muestra']){
     const box=await panel().getByText(name,{exact:true}).boundingBox()
     expect(box).not.toBeNull();expect(bounds).not.toBeNull()
     expect(box!.y).toBeGreaterThanOrEqual(bounds!.y);expect(box!.y+box!.height).toBeLessThanOrEqual(bounds!.y+bounds!.height)
    }
   }
   await expect(page.locator('.external-banner')).toHaveCount(0)
   const name=`prj02b-${kind}-${language}-${theme}-${width}x${height}.png`,path=info.outputPath(name)
   await page.screenshot({path,animations:'disabled'})
   if(process.env.FREYALAB_PRJ02B_EVIDENCE){await mkdir(process.env.FREYALAB_PRJ02B_EVIDENCE,{recursive:true});await copyFile(path,join(process.env.FREYALAB_PRJ02B_EVIDENCE,name))}
  }
 }
 await subsetRow('Oaxaca, adultos').locator(':scope > .actions').getByRole('button',{name:tr('analysis.tab.open'),exact:true}).press('Enter')
 const workspace=page.locator('.analysis-workspace:not([hidden])')
 await expect(workspace.locator('h2')).toBeFocused()
 await workspace.getByRole('button',{name:tr('info.calculate'),exact:true}).press('Enter')
 await expect(workspace.locator('.file-summary')).toContainText('3')
 await captures('informacion')
 await ageHistogram();await captures('histograma')
 await workspace.getByRole('button',{name:tr('subset.analysis.return'),exact:true}).press('Enter')
 await expect(page.getByRole('tab',{name:tr('project.tab'),exact:true})).toBeFocused()
 await subsetRow('Dos mayores de muestra').locator(':scope > .actions').getByRole('button',{name:tr('dialog.open.button'),exact:true}).press('Enter')
 const subset=page.getByRole('region',{name:tr('subset.title'),exact:true})
 await expect(subset.getByRole('table',{name:tr('subset.preview'),exact:true}).locator('tbody th')).toHaveText(['00128','9007199254740993'])
 await expect(subset.locator('.coverage')).not.toContainText(/Paso \d|Step \d/)
 await expect(subset.locator('.coverage')).toContainText('Muestra, semilla 7')
 await expect(subset.locator('.coverage')).toContainText('Dos mayores de muestra')
 await captures('conjunto-cadena')
 await subset.locator('footer').getByRole('button',{name:tr('subset.close'),exact:true}).press('Enter')
 await captures('proyecto-cadena')
 await page.getByRole('button',{name:t('analysis.tab.close',{name:'Oaxaca, adultos'},locale),exact:true}).press('Enter')
 await expect(page.locator('.analysis-workspace')).toHaveCount(0)
 expect(await page.evaluate(()=>window.freya.documents())).toEqual([])
 expect((await readFile(source)).equals(original)).toBe(true)
})

test('PRJ-02b: cancelar la preparación no publica un análisis parcial ni escribe el proyecto',async()=>{
 original=Buffer.from('ID,Entidad,Edad,Ingreso,Nota\n'+Array.from({length:100000},(_,index)=>`${String(index+1).padStart(6,'0')},Oaxaca,34,1200,${'x'.repeat(400)}`).join('\n')+'\n')
 await writeFile(source,original);await registeredSubset()
 const before=await readFile(join(folder,'proyecto.freyalab'))
 await subsetRow('Oaxaca, adultos').locator(':scope > .actions').getByRole('button',{name:tr('analysis.tab.open'),exact:true}).press('Enter')
 const preparation=panel().locator('.subset-analysis-progress')
 await preparation.getByRole('button',{name:tr('dialog.cancel'),exact:true}).press('Enter')
 await expect(preparation).toHaveCount(0)
 await expect(page.locator('.analysis-workspace')).toHaveCount(0)
 expect(await page.evaluate(()=>window.freya.documents())).toEqual([])
 expect((await readFile(source)).equals(original)).toBe(true)
 expect(await readFile(join(folder,'proyecto.freyalab'))).toEqual(before)
})

test('PRJ-02b: dos reaperturas superpuestas liberan el snapshot una vez y publican el último proyecto',async()=>{
 // Fronteras nativas de prueba: se retiene solo close(snapshot A). No cambia IPC ni producto.
 await app.evaluate(({utilityProcess})=>{
  const fs=process.getBuiltinModule('node:fs').promises,module=process.getBuiltinModule('node:module')
  const fork=utilityProcess.fork,lstat=fs.lstat,children:{restore:()=>void}[]=[]
  const probe={hold:false,target:'',queued:[] as (()=>void)[],queuedCloseCount:0,wrappedChildren:0,
   watchRecents:false,sawB:false,secondRecentsComplete:false,paths:{a:'',b:'',c:''},
   lastB:Promise.resolve(undefined) as Promise<unknown>,lastC:Promise.resolve(undefined) as Promise<unknown>,
   release(){this.hold=false;for(const send of this.queued.splice(0))send()},restore(){}}
  probe.restore=()=>{try{probe.release()}finally{probe.watchRecents=false;utilityProcess.fork=fork;for(const child of children)child.restore();fs.lstat=lstat;module.syncBuiltinESMExports()}}
  Reflect.set(globalThis,'prj02LifecycleCloseProbe',probe)
  utilityProcess.fork=(...args:Parameters<typeof fork>)=>{
   const child=Reflect.apply(fork,utilityProcess,args) as ReturnType<typeof fork>
   if(String(args[0]).endsWith('table-worker.js')){
    const send=child.postMessage;probe.wrappedChildren++
    child.postMessage=(message,transfer)=>{
     const request=message as {method?:string;args?:unknown[]}
     if(probe.hold&&request.method==='close'&&request.args?.[0]===probe.target){probe.queuedCloseCount++;probe.queued.push(()=>send.call(child,message,transfer));return}
     send.call(child,message,transfer)
    }
    children.push({restore:()=>{child.postMessage=send}})
   }
   return child
  }
  // Tras B bloqueado, solo recents() de la publicación C consulta B/A. Se deja
  // terminar su grupo C/B/A; el siguiente app.evaluate ocurre después de esas microtareas.
  const io=fs as unknown as {lstat:(...args:unknown[])=>Promise<unknown>}
  io.lstat=(...args)=>{
   const pending=Reflect.apply(lstat,fs,args) as Promise<unknown>,path=String(args[0])
   if(!probe.watchRecents)return pending
   if(path===probe.paths.c)probe.lastC=pending
   else if(path===probe.paths.b){probe.lastB=pending;probe.sawB=true}
   else if(path===probe.paths.a&&probe.sawB){probe.sawB=false;return Promise.all([pending,probe.lastB,probe.lastC]).then(([value])=>{probe.secondRecentsComplete=true;return value})}
   return pending
  }
  module.syncBuiltinESMExports()
 })
 try{
  await registeredSubset()
  const a=(await page.evaluate(()=>window.freya.projectState())).project!.path
  const aFile=join(folder,'proyecto.freyalab'),aBefore=await readFile(aFile),fixtures=[] as {path:string;bytes:string}[]
  for(const name of ['B','C']){
   const dir=join(folder,'Proyecto '+name);await mkdir(dir)
   const path=join(dir,'proyecto.freyalab'),bytes=JSON.stringify({format:'freyalab-project',version:1,id:'lifecycle-'+name,name:'Proyecto '+name,createdAt:'2026-11-17T00:00:00.000Z',sources:[],recipes:[],results:[]})+'\n'
   await writeFile(path,bytes);fixtures.push({path,bytes})
  }
  // Las rutas se autorizan por la carpeta de prueba y entran en recientes por la API pública.
  const paths=await page.evaluate(async({files,a})=>{
   const opened:string[]=[]
   for(const path of files){await window.freya.openPaths([path]);opened.push((await window.freya.projectState()).project!.path)}
   await window.freya.projectOpenRecent(a);return{a,b:opened[0],c:opened[1]}
  },{files:fixtures.map(value=>value.path),a})
  await expect(subsetRow('Oaxaca, adultos')).toBeVisible()
  await subsetRow('Oaxaca, adultos').locator(':scope > .actions').getByRole('button',{name:tr('analysis.tab.open'),exact:true}).press('Enter')
  const analysis=page.getByRole('tab',{name:t('analysis.tab.label',{name:'Oaxaca, adultos'},locale),exact:true})
  await expect(analysis).toBeVisible()
  const snapshot=(await page.evaluate(()=>window.freya.documents())).find(doc=>doc.analysisSubset)!
  expect(snapshot).toBeDefined()
  await app.evaluate((_electron,{id,paths})=>{
   const state=Reflect.get(globalThis,'prj02LifecycleCloseProbe')
   if(!state.wrappedChildren)throw new Error('La frontera utilityProcess no capturó el motor CSV.')
   state.target=id;state.hold=true;state.paths=Object.fromEntries(Object.entries(paths).map(([key,path])=>[key,process.getBuiltinModule('node:path').join(path,'proyecto.freyalab')]))
  },{id:snapshot.id,paths})
  await page.evaluate(path=>{
   const state={results:{} as Record<string,{status:string;message?:string}>,pending:{} as Record<string,Promise<void>>}
   Reflect.set(window,'prj02LifecycleOpens',state);state.results.B={status:'pending'}
   state.pending.B=window.freya.projectOpenRecent(path).then(()=>{state.results.B={status:'fulfilled'}},error=>{state.results.B={status:'rejected',message:String(error)}})
  },paths.b)
  await expect.poll(()=>app.evaluate(()=>Reflect.get(globalThis,'prj02LifecycleCloseProbe').queuedCloseCount)).toBe(1)
  await app.evaluate(()=>{Reflect.get(globalThis,'prj02LifecycleCloseProbe').watchRecents=true})
  await page.evaluate(path=>{
   const state=Reflect.get(window,'prj02LifecycleOpens');state.results.C={status:'pending'}
   state.pending.C=window.freya.projectOpenRecent(path).then(()=>{state.results.C={status:'fulfilled'}},error=>{state.results.C={status:'rejected',message:String(error)}})
  },paths.c)
  await expect.poll(()=>app.evaluate(()=>Reflect.get(globalThis,'prj02LifecycleCloseProbe').secondRecentsComplete)).toBe(true)
  await app.evaluate(()=>Reflect.get(globalThis,'prj02LifecycleCloseProbe').release())
  const outcomes=await page.evaluate(async()=>{const state=Reflect.get(window,'prj02LifecycleOpens');await Promise.all(Object.values(state.pending));return state.results})
  expect(outcomes).toEqual({B:{status:'fulfilled'},C:{status:'fulfilled'}})
  expect((await page.evaluate(()=>window.freya.projectState())).project).toMatchObject({id:'lifecycle-C',name:'Proyecto C',path:paths.c})
  await expect(panel()).toBeVisible();await expect(panel()).toContainText('Proyecto C')
  await expect(analysis).toHaveCount(0);await expect(page.locator('.analysis-workspace')).toHaveCount(0)
  expect((await page.evaluate(()=>window.freya.documents())).filter(doc=>doc.analysisSubset)).toEqual([])
  expect(pageErrors).toEqual([])
  expect(await readFile(source)).toEqual(original);expect(await readFile(aFile)).toEqual(aBefore)
  for(const fixture of fixtures)expect(await readFile(fixture.path,'utf8')).toBe(fixture.bytes)
 }finally{
  await app.evaluate(()=>{const state=Reflect.get(globalThis,'prj02LifecycleCloseProbe');try{state?.restore()}finally{Reflect.deleteProperty(globalThis,'prj02LifecycleCloseProbe')}})
 }
})
