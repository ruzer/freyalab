import {expect,test,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {createHash} from 'node:crypto'
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {closeElectron} from './close-electron'
import {openCsvCommands} from './panel'
import {projectTreeRow,openProjectRowMenu} from './project-panel'
import {t,plural,type Language} from '../../src/shared/i18n'
import type {ProjectExportOutcome} from '../../src/shared/project-exports'

let app:ElectronApplication,page:Page,root:string,folder:string,source:string,output:string,original:Buffer,pageErrors:string[]=[],locale:Language='es'
const tr=(key:string)=>t(key,{},locale)
const panel=()=>page.getByRole('tabpanel',{name:tr('project.tab'),exact:true})
const row=(name:string)=>projectTreeRow(page,name,locale)
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex')

test.beforeEach(async({},info)=>{
 locale=info.title.endsWith('[en-XA]')?'en-XA':info.title.endsWith('[en]')?'en':'es'
 root=await mkdtemp(join(tmpdir(),'freya-project-exports-'));folder=join(root,'Censo');await mkdir(join(folder,'02_datasets'),{recursive:true})
 source=join(folder,'censo.csv');output=join(folder,'02_datasets','Oaxaca, adultos.csv')
 original=await readFile(resolve('tests/fixtures/prj02-censo.csv'));await writeFile(source,original)
 const {ELECTRON_RUN_AS_NODE:_,...environment}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,
  args:process.env.FREYALAB_EXECUTABLE?[]:[resolve(process.env.FREYALAB_TEST_PROJECT_ENTRY??'out/main/index.js')],
  env:{...environment as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:locale,FREYALAB_USER_DATA:join(root,'profile'),FREYALAB_TEST_FOLDER:folder,FREYALAB_TEST_PROJECT_SOURCE_PATH:source,FREYALAB_TEST_EXTRACT_DIR:join(folder,'02_datasets')}})
 page=await app.firstWindow();pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));await page.waitForFunction(()=>!!window.freya)
 await page.setViewportSize({width:1440,height:900})
 await page.getByRole('button',{name:tr('project.create'),exact:true}).press('Enter')
 const create=page.getByRole('dialog',{name:tr('project.new'),exact:true})
 await create.getByRole('button',{name:tr('project.pickFolder'),exact:true}).press('Enter');await create.getByRole('button',{name:tr('project.create'),exact:true}).press('Enter')
 await panel().getByRole('button',{name:tr('project.source.add'),exact:true}).press('Enter')
 const add=page.getByRole('dialog',{name:tr('project.source.add'),exact:true})
 await expect(add.getByRole('listitem')).toHaveText(['ID','Entidad','Edad','Ingreso','Nota'])
 await add.getByRole('button',{name:tr('project.source.register'),exact:true}).press('Enter');await expect(add).toHaveCount(0)
 await page.evaluate(async()=>{
  const {project,sources}=await window.freya.projectState(),source=sources[0]
  await window.freya.projectSaveRecipe(project!.id,{name:'Oaxaca, adultos',sourceId:source.id,steps:[
   {op:'filter',mode:'all',conditions:[{column:{position:2,name:'Entidad'},op:'equals',value:'Oaxaca',caseSensitive:false},{column:{position:3,name:'Edad'},op:'greaterEqual',value:'18',caseSensitive:false}]},
   {op:'order',by:[{column:{position:3,name:'Edad'},descending:true,numeric:true}]},
   {op:'select',columns:[{position:1,name:'ID'},{position:3,name:'Edad'},{position:5,name:'Nota'}]}
  ]})
 })
 await expect(row('Oaxaca, adultos')).toBeVisible()
})
test.afterEach(async()=>{try{expect(pageErrors).toEqual([]);expect(await readFile(source)).toEqual(original)}finally{try{if(app)await closeElectron(app)}finally{await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:200})}}})

test('PRJ-03: el menú exporta todas las filas, registra procedencia y abre el resultado editable',async()=>{
 const menu=await openProjectRowMenu(row('Oaxaca, adultos'),locale)
 const action=menu.getByRole('menuitem',{name:'Exportar…',exact:true})
 await expect(action).toBeVisible();await expect(action).not.toHaveAttribute('aria-disabled','true');await action.press('Enter')
 await expect(row('Oaxaca, adultos.csv')).toBeVisible()
 const bytes=Buffer.from('ID,Edad,Nota\n00128,61\n00126,52,ok\n00123,34,"línea 1\nlínea 2"\n')
 expect(await readFile(output)).toEqual(bytes)
 const manifest=JSON.parse(await readFile(join(folder,'proyecto.freyalab'),'utf8'))
 expect(manifest.results).toHaveLength(1)
 const result=manifest.results[0]
 expect(result).toMatchObject({kind:'extract',recipeId:manifest.recipes[0].id,path:'02_datasets/Oaxaca, adultos.csv',bytes:bytes.length,sha256:sha(bytes),createdAt:result.provenance.executedAt,
  provenance:{sourceSha256:sha(original),coverage:{kind:'filtered',matched:3,scanned:7,total:7,complete:true},fidelity:{level:'values'},chain:[manifest.recipes[0].id]}})
 expect(result.provenance.recipeSha256[manifest.recipes[0].id]).toMatch(/^[a-f\d]{64}$/)
 await expect(row('Oaxaca, adultos.csv')).toHaveAttribute('aria-level','3')
 await expect(row('Oaxaca, adultos.csv')).toHaveAttribute('title',/3 de 7/)
 await row('Oaxaca, adultos.csv').press('Enter')
 await expect(page.getByRole('tab',{name:'Oaxaca, adultos.csv',exact:true})).toHaveAttribute('aria-selected','true')
 await expect(page.locator('.project-result-origin')).toContainText('3 de 7')
 const document=await page.evaluate(async()=> (await window.freya.documents()).find(doc=>doc.name==='Oaxaca, adultos.csv'))
 expect(document).toMatchObject({kind:'csv',readonly:false,dirty:false,rowCount:3})
 expect(await readFile(source)).toEqual(original)
})

async function exportSaved(name='Oaxaca, adultos'){
 const menu=await openProjectRowMenu(row(name),locale)
 await menu.getByRole('menuitem',{name:tr('project.export.action'),exact:true}).press('Enter')
 await expect(row(name+'.csv')).toBeVisible()
}
const resultRow=(name='Oaxaca, adultos.csv')=>row(name).and(panel().locator('[data-project-node^="result:"]'))
async function screenshotPair(stage:string,info:import('@playwright/test').TestInfo){
 if(!process.env.FREYALAB_PRJ03_EVIDENCE)return
 for(const theme of ['light','dark']as const){
  await page.evaluate(theme=>window.freya.setSettings({tema:theme}),theme)
  await expect.poll(()=>page.locator('html').evaluate(element=>element.classList.contains('dark'))).toBe(theme==='dark')
  for(const [width,height]of [[1440,900],[1280,720]]){
   await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'})
   await expect(panel()).toBeVisible()
   await page.screenshot({path:info.outputPath(`prj03-${locale}-${theme}-${width}x${height}-${stage}.png`)})
  }
 }
}

for(const language of ['es','en','en-XA']as const)test(`PRJ-03: panel, cobertura histórica y procedencia accesible [${language}]`,async({},info)=>{
 await row('Oaxaca, adultos').press('Enter')
 const dialog=page.getByRole('dialog',{name:t('subset.projectDialog',{source:'censo.csv'},locale),exact:true}),subset=dialog.locator('.subset-tools')
 await expect(subset.locator('.coverage')).toBeVisible()
 const coverage=await subset.locator('.coverage p').nth(1).innerText()
 await expect(subset.getByRole('button',{name:tr('project.export.action'),exact:true})).toBeEnabled()
 await subset.getByRole('button',{name:tr('project.export.action'),exact:true}).press('Enter')
 await expect(subset.locator('.project-export-status')).toContainText(plural('project.export.finished',3,{name:'Oaxaca, adultos.csv'},locale))
 await expect(dialog.getByRole('status').filter({hasText:plural('project.export.finished',3,{name:'Oaxaca, adultos.csv'},locale)})).toHaveCount(1)
 await subset.locator('footer').getByRole('button',{name:tr('subset.close'),exact:true}).press('Enter');await expect(dialog).toHaveCount(0)
 expect(await resultRow().getAttribute('title')).toContain(coverage)
 await expect(resultRow()).toHaveAttribute('aria-level','3')
 if(language!=='en')await screenshotPair('tree',info)
 await resultRow().press('Enter')
 await expect(page.locator('.project-result-origin')).toContainText(coverage)
 await expect(page.locator('.project-result-origin')).toHaveAccessibleName(tr('project.result.origin'))
 if(language!=='en')await screenshotPair('origin',info)
 const doc=await page.evaluate(async()=>(await window.freya.documents()).find(doc=>doc.name==='Oaxaca, adultos.csv'))
 expect(doc).toMatchObject({readonly:false,dirty:false,rowCount:3})
 expect(await readFile(output,'utf8')).toBe('ID,Edad,Nota\n00128,61\n00126,52,ok\n00123,34,"línea 1\nlínea 2"\n')
})

test('PRJ-03: cambios sin guardar del conjunto bloquean exportar sin cambiar la receta ni el archivo',async()=>{
 await row('Oaxaca, adultos').press('Enter')
 const subset=page.locator('.subset-tools'),button=subset.getByRole('button',{name:tr('project.export.action'),exact:true})
 await expect(subset.locator('.coverage')).toBeVisible();await expect(button).toBeEnabled()
 const before=await readFile(join(folder,'proyecto.freyalab'))
 await subset.getByLabel(tr('subset.name'),{exact:true}).fill('Sin guardar')
 await expect(button).toBeDisabled();await expect(button).toHaveAccessibleDescription(tr('project.export.unsaved'))
 expect(await readFile(join(folder,'proyecto.freyalab'))).toEqual(before)
 expect(await readFile(output).catch(()=>null)).toBeNull()
 await subset.locator('footer').getByRole('button',{name:tr('subset.close'),exact:true}).press('Enter')
 const discard=page.getByRole('dialog',{name:tr('subset.discardTitle'),exact:true});await discard.getByRole('button',{name:tr('subset.discard'),exact:true}).press('Enter')
})

test('PRJ-03: un archivo exportado cambia o falta aunque nunca se haya abierto',async()=>{
 await exportSaved();expect(await page.evaluate(()=>window.freya.documents())).toEqual([])
 await writeFile(output,'ID,Edad,Nota\nmodificado,99,nuevo\n')
 await expect(resultRow()).toContainText(tr('project.export.changed'))
 await resultRow().press('Enter');await expect(page.locator('.project-result-origin')).toContainText(tr('project.export.changed'))
 const doc=await page.evaluate(async()=>(await window.freya.documents()).find(doc=>doc.name==='Oaxaca, adultos.csv'))
 await page.evaluate(id=>window.freya.close(id),doc!.id)
 await rm(output);await expect(resultRow()).toContainText(tr('project.export.missing'))
 const menu=await openProjectRowMenu(resultRow(),locale)
 await expect(menu.getByRole('menuitem',{name:tr('dialog.open.button'),exact:true})).toHaveAttribute('aria-disabled','true')
 await page.keyboard.press('Escape')
})

test('PRJ-03: editar y guardar un resultado conserva su advertencia y su huella histórica',async()=>{
 await exportSaved();await resultRow().press('Enter')
 await expect(page.locator('.project-result-origin')).toBeVisible()
 const stored=JSON.parse(await readFile(join(folder,'proyecto.freyalab'),'utf8')).results[0]
 const cell=page.getByRole('gridcell',{name:'Fila 1, Edad',exact:true})
 await cell.dblclick();await page.getByLabel('Editar celda',{exact:true}).fill('62');await page.getByLabel('Editar celda',{exact:true}).press('Enter')
 await expect(cell).toContainText('62')
 await expect(page.locator('.project-result-origin')).toContainText(tr('project.result.modifiedWarning'))
 await page.getByRole('button',{name:tr('toolbar.save'),exact:true}).press('Enter')
 await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents())).find(doc=>doc.name==='Oaxaca, adultos.csv')?.dirty).toBe(false)
 await expect(resultRow()).toContainText(tr('project.export.changed'));await expect(page.locator('.project-result-origin')).toContainText(tr('project.export.changed'))
 expect(JSON.parse(await readFile(join(folder,'proyecto.freyalab'),'utf8')).results[0]).toEqual(stored)
 expect(sha(await readFile(output))).not.toBe(stored.sha256)
})

test('PRJ-03: añadir como fuente reutiliza el registro y quitar olvida solo la procedencia',async()=>{
 await exportSaved();let menu=await openProjectRowMenu(row('Oaxaca, adultos'),locale)
 await expect(menu.getByRole('menuitem',{name:tr('subset.remove'),exact:true})).toHaveAttribute('aria-disabled','true');await page.keyboard.press('Escape')
 menu=await openProjectRowMenu(resultRow(),locale);await menu.getByRole('menuitem',{name:tr('project.result.addSource'),exact:true}).press('Enter')
 const dialog=page.getByRole('dialog',{name:tr('project.source.add'),exact:true});await expect(dialog.getByRole('listitem')).toHaveText(['ID','Edad','Nota'])
 await dialog.getByRole('button',{name:tr('project.source.register'),exact:true}).press('Enter');await expect(dialog).toHaveCount(0)
 await expect(resultRow()).toContainText(tr('project.result.alsoSource'))
 menu=await openProjectRowMenu(resultRow(),locale);await expect(menu.getByRole('menuitem',{name:tr('project.result.addSource'),exact:true})).toHaveAttribute('aria-disabled','true')
 await menu.getByRole('menuitem',{name:tr('project.source.forget'),exact:true}).press('Enter')
 const forget=page.getByRole('dialog',{name:tr('project.result.forgetTitle'),exact:true});await expect(forget).toContainText(t('project.result.forgetQuestion',{name:'Oaxaca, adultos.csv'},locale))
 const bytes=await readFile(output);await forget.getByRole('button',{name:tr('project.source.forget'),exact:true}).press('Enter')
 await expect(resultRow()).toHaveCount(0);expect(await readFile(output)).toEqual(bytes)
 const state=await page.evaluate(()=>window.freya.projectState());expect(state.results).toEqual([]);expect(state.sources).toHaveLength(2)
 menu=await openProjectRowMenu(row('Oaxaca, adultos'),locale);await expect(menu.getByRole('menuitem',{name:tr('subset.remove'),exact:true})).not.toHaveAttribute('aria-disabled','true');await page.keyboard.press('Escape')
})


test('PRJ-03: una segunda exportación conserva ambas instantáneas y rechaza reemplazar la primera',async()=>{
 await exportSaved();const first=await readFile(output),before=await page.evaluate(()=>window.freya.projectState())
 await page.evaluate(async()=>{const state=await window.freya.projectState();await window.freya.projectRenameRecipe(state.project!.id,state.recipes[0].id,'Otra copia')})
 await expect(row('Otra copia')).toBeVisible();await exportSaved('Otra copia')
 const state=await page.evaluate(()=>window.freya.projectState());expect(state.results).toHaveLength(2)
 expect(await readFile(output)).toEqual(first);expect(await readFile(join(folder,'02_datasets','Otra copia.csv'))).toEqual(first)
 expect(state.results.find(result=>result.id===before.results[0].id)?.provenance.snapshot?.recipes.at(-1)?.name).toBe('Oaxaca, adultos')
 const names=await panel().locator('[data-project-node^="result:"] .node-name').allTextContents();expect(names).toEqual(['Otra copia.csv','Oaxaca, adultos.csv'])
 await app.evaluate((_electron,path)=>{process.env.FREYALAB_TEST_EXTRACT_PATH=path},output)
 const menu=await openProjectRowMenu(row('Otra copia'),locale);await menu.getByRole('menuitem',{name:tr('project.export.action'),exact:true}).press('Enter')
 await expect(panel().locator('.export-error')).toContainText(tr('project.export.previous'))
 expect((await page.evaluate(()=>window.freya.projectState())).results).toHaveLength(2);expect(await readFile(output)).toEqual(first)
})

test('PRJ-03: un proyecto futuro conserva las recetas v1 pero bloquea exportar con su motivo',async()=>{
 const manifestFile=join(folder,'proyecto.freyalab'),manifest=JSON.parse(await readFile(manifestFile,'utf8'))
 await page.evaluate(async()=>{const state=await window.freya.projectState();await window.freya.projectClose(state.project!.id)})
 const originalProject=JSON.stringify({...manifest,version:2,unknown:'preservar'});await writeFile(manifestFile,originalProject)
 await page.evaluate(path=>window.freya.openPaths([path]),manifestFile)
 await expect(row('Oaxaca, adultos')).toBeVisible();const menu=await openProjectRowMenu(row('Oaxaca, adultos'),locale)
 const action=menu.getByRole('menuitem',{name:tr('project.export.action'),exact:true});await expect(action).toHaveAttribute('aria-disabled','true');await expect(action).toHaveAccessibleDescription(t('project.future',{version:'2'},locale))
 await action.press('Enter');expect(await readFile(output).catch(()=>null)).toBeNull();expect(await readFile(manifestFile,'utf8')).toBe(originalProject);await page.keyboard.press('Escape')
})


test('PRJ-03: la paleta encuentra el conjunto por exportar, extraer, guardar como archivo, export, extract y csv',async()=>{
 await row('censo.csv').press('Enter');await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true})).toBeVisible()
 for(const term of ['exportar','extraer','guardar como archivo','export','extract','csv']){
  const dialog=await openCsvCommands(page,app)
  await dialog.getByRole('searchbox',{name:'Buscar comando CSV',exact:true}).fill(term)
  const action=dialog.getByRole('button',{name:/^Exportar conjunto «Oaxaca, adultos»/});await expect(action).toBeEnabled()
  if(term==='csv'){await action.press('Enter');await expect(dialog).toHaveCount(0);await expect(resultRow()).toBeVisible()}
  else await page.keyboard.press('Escape')
 }
 expect(await readFile(output,'utf8')).toContain('00128,61\n');expect(await readFile(source)).toEqual(original)
})


test('PRJ-03 frontend: doble Enter en Registrar de nuevo envía una petición y conserva el éxito',async()=>{
 const projectId=(await page.evaluate(()=>window.freya.projectState())).project!.id
 await app.evaluate(({ipcMain})=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  type Registered=Extract<ProjectExportOutcome,{status:'registered'}>
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya')
  if(!original)throw new Error('Falta el handler IPC de la prueba.')
  const probe:{requests:unknown[][];registered?:Registered;resolveFirst?:()=>void;rejectDuplicate?:()=>void;cleanup:()=>void}={
   requests:[],cleanup:()=>{probe.resolveFirst?.();probe.rejectDuplicate?.();handlers.set('freya',original)}
  }
  Reflect.set(globalThis,'prj03RegisterProbe',probe)
  handlers.set('freya',async(event,...args)=>{
   if(args[0]==='project:recipeExport'){
    // El backend crea y registra el archivo REAL. Solo degradamos la respuesta a la UI;
    // este caso comprueba single-flight frontend, no una avería real del manifiesto.
    const outcome=await original(event,...args) as ProjectExportOutcome|null
    if(outcome?.status!=='registered')throw new Error('La exportación real debe quedar registrada antes del oráculo frontend.')
    probe.registered=outcome
    return{status:'unregistered',result:outcome.result,error:'Registro pendiente simulado por el oráculo frontend.'}
   }
   if(args[0]==='project:registerResult'){
    probe.requests.push(structuredClone(args.slice(1)))
    const registered=probe.registered
    if(!registered)throw new Error('Falta la exportación real del fixture.')
    if(probe.requests.length===1)return new Promise<Registered>(resolve=>{probe.resolveFirst=()=>resolve(registered)})
    return new Promise<never>((_resolve,reject)=>{probe.rejectDuplicate=()=>reject(new Error('duplicate frontend registration'))})
   }
   return original(event,...args)
  })
 })
 try{
  await exportSaved()
  const manifest=await readFile(join(folder,'proyecto.freyalab')),stored=JSON.parse(manifest.toString())
  expect(stored.results).toHaveLength(1)
  const resultId=stored.results[0].id,exported=await readFile(output),retry=panel().getByRole('button',{name:tr('project.result.retry'),exact:true})
  await expect(retry).toHaveCount(1)
  await retry.press('Enter');await retry.press('Enter')
  // El mismo canal IPC ordena la barrera después de ambos Enter, sin sleeps
  // y antes de resolver la primera solicitud.
  await page.evaluate(()=>window.freya.projectState())
  const requests=await app.evaluate(()=>Reflect.get(globalThis,'prj03RegisterProbe').requests as unknown[][])
  expect(requests[0]).toEqual([projectId,resultId])
  await app.evaluate(()=>Reflect.get(globalThis,'prj03RegisterProbe').resolveFirst?.())
  await expect(retry).toHaveCount(0);await expect(panel().locator('.export-error')).toHaveCount(0)
  // Si hubo otra solicitud, rechazarla DESPUÉS del éxito visible expone el
  // outcome unregistered que el frontend anterior había capturado.
  await app.evaluate(()=>Reflect.get(globalThis,'prj03RegisterProbe').rejectDuplicate?.())
  await page.evaluate(()=>window.freya.projectState())
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())))
  expect({requests,retry:await retry.count(),errors:await panel().locator('.export-error').allTextContents()})
   .toEqual({requests:[[projectId,resultId]],retry:0,errors:[]})
  expect(await readFile(join(folder,'proyecto.freyalab'))).toEqual(manifest)
  expect(await readFile(output)).toEqual(exported)
 }finally{
  await app.evaluate(()=>{Reflect.get(globalThis,'prj03RegisterProbe')?.cleanup();Reflect.deleteProperty(globalThis,'prj03RegisterProbe')})
 }
})


test('PRJ-03: los ids de proyecto v1 válidos sin UUID conservan exportación, apertura y alta como fuente',async()=>{
 const file=join(folder,'proyecto.freyalab'),manifest=JSON.parse(await readFile(file,'utf8'))
 await page.evaluate(async()=>{const state=await window.freya.projectState();await window.freya.projectClose(state.project!.id)})
 manifest.id='gb-project';manifest.sources[0].id='gb-source';manifest.recipes[0].id='oaxaca-adultos';manifest.recipes[0].sourceId='gb-source'
 await writeFile(file,JSON.stringify(manifest));await page.evaluate(path=>window.freya.openPaths([path]),file)
 const state=await page.evaluate(()=>window.freya.projectState())
 expect(state.project).toMatchObject({id:'gb-project',readonly:false});expect(state.recipes[0]).toMatchObject({id:'oaxaca-adultos',executable:true});expect(state.sources[0]).toMatchObject({id:'gb-source',status:'verified'})
 const outcome=await page.evaluate(()=>window.freya.projectRecipeExport('gb-project','oaxaca-adultos',crypto.randomUUID()))
 expect(outcome?.status).toBe('registered');if(outcome?.status!=='registered')throw new Error('No se registró el resultado del proyecto válido')
 await expect(resultRow()).toBeVisible()
 const reopened=await page.evaluate(async result=>window.freya.projectOpenResult('gb-project',result),outcome.result.id)
 expect(reopened).toMatchObject({kind:'csv',readonly:false,rowCount:3})
 await page.evaluate(async result=>{
  const draft=await window.freya.projectResultSource('gb-project',result)
  await window.freya.projectRegisterSource('gb-project',draft.id,{encoding:'utf8',delimiter:',',header:true},crypto.randomUUID())
 },outcome.result.id)
 expect((await page.evaluate(()=>window.freya.projectState())).sources).toHaveLength(2)
 const originalSource=await page.evaluate(()=>window.freya.projectOpenSource('gb-source'));expect(originalSource?.projectSource).toBe('protected')
 await page.evaluate(()=>window.freya.projectReregisterSource('gb-project','gb-source',crypto.randomUUID()))
 expect(await readFile(source)).toEqual(original)
})

test('PRJ-03 C3: Nota antes de ID conserva el ausente y muestra la misma advertencia en resultado y origen',async()=>{
 expect(await page.evaluate(async()=>{
  const {project,recipes}=await window.freya.projectState(),recipe=recipes.find(recipe=>recipe.name==='Oaxaca, adultos')!
  return window.freya.projectSaveRecipe(project!.id,{id:recipe.id,name:recipe.name,sourceId:recipe.rootSourceId,steps:recipe.steps.map(step=>step.op==='select'?{op:'select',columns:[{position:5,name:'Nota'},{position:1,name:'ID'}]}:step)})
 })).toBe(true)
 const before=JSON.parse(await readFile(join(folder,'proyecto.freyalab'),'utf8'))
 await exportSaved()
 const bytes=Buffer.from('Nota,ID\n,00128\nok,00126\n"línea 1\nlínea 2",00123\n'),warning='1 campo ausente se escribió vacío porque va antes de otro campo'
 expect(await readFile(output)).toEqual(bytes)
 await expect(panel().locator('.project-export-status').getByText(warning,{exact:true})).toBeVisible()
 await expect(resultRow().getByText(warning,{exact:true})).toBeVisible()
 const saved=JSON.parse(await readFile(join(folder,'proyecto.freyalab'),'utf8'))
 expect(saved.sources).toEqual(before.sources);expect(saved.recipes).toEqual(before.recipes);expect(saved.results).toHaveLength(1)
 expect(saved.results[0]).toMatchObject({bytes:bytes.length,sha256:sha(bytes),provenance:{sourceSha256:sha(original),fidelity:{level:'values',normalization:[
  'Solo las columnas elegidas, en el orden elegido.',
  'Comillado mínimo: solo se entrecomillan los campos que lo necesitan.',
  'Se conserva el fin de línea de la fuente en todos los registros.',
  'Se conservan la codificación y el BOM de la fuente.',
  warning
 ]},warnings:[warning]}})
 await resultRow().press('Enter')
 await expect(page.locator('.project-result-origin').getByText(warning,{exact:true})).toBeVisible()
 expect(await readFile(output)).toEqual(bytes);expect(await readFile(source)).toEqual(original)
})

for(const status of ['changed','missing']as const)test('PRJ-03 C16: fuente '+status+' bloquea Exportar en panel y menú sin cambiar el proyecto',async()=>{
 const manifestPath=join(folder,'proyecto.freyalab'),before=await readFile(manifestPath)
 const context=await page.evaluate(async()=>{
  const {project,recipes}=await window.freya.projectState(),recipe=recipes.find(recipe=>recipe.name==='Oaxaca, adultos')!
  return{projectId:project!.id,sourceId:recipe.rootSourceId,draft:{id:recipe.id,name:recipe.name,sourceId:recipe.rootSourceId,steps:recipe.steps}}
 })
 await row('Oaxaca, adultos').press('Enter')
 const dialog=page.getByRole('dialog',{name:t('subset.projectDialog',{source:'censo.csv'},locale),exact:true}),subset=dialog.locator('.subset-tools'),button=subset.getByRole('button',{name:tr('project.export.action'),exact:true})
 await expect(subset.locator('.coverage')).toBeVisible();await expect(button).toBeEnabled()
 const changed=Buffer.concat([original,Buffer.from('00199,Oaxaca,22,40,cambio externo\n')])
 try{
  if(status==='changed')await writeFile(source,changed);else await rm(source)
  // La validación real publica el estado de las fuentes incluso al rechazar Probar.
  const failure=await page.evaluate(async input=>{
   try{await window.freya.projectRecipeTry(input.projectId,input.draft,crypto.randomUUID());return null}catch(error){return String(error)}
  },context)
  expect(failure).toContain(tr('project.source.'+status))
  expect((await page.evaluate(()=>window.freya.projectState())).sources.find(source=>source.id===context.sourceId)?.status).toBe(status)
  const panelReason=t('subset.sourceUnavailable',{reason:tr('project.source.status.'+status)},locale)
  await expect(button).toBeDisabled();await expect(button).toHaveAccessibleDescription(panelReason)
  await expect(subset.getByText(panelReason,{exact:true})).toBeVisible()
  await subset.locator('footer').getByRole('button',{name:tr('subset.close'),exact:true}).press('Enter');await expect(dialog).toHaveCount(0)
  const menu=await openProjectRowMenu(row('Oaxaca, adultos'),locale),action=menu.getByRole('menuitem',{name:tr('project.export.action'),exact:true}),reason=tr('project.source.'+status)
  await expect(action).toBeDisabled();await expect(action).toHaveAccessibleDescription(reason)
  const reasonId=await action.getAttribute('aria-describedby');expect(reasonId).toBeTruthy();await expect(menu.locator('[id='+JSON.stringify(reasonId)+']')).toBeVisible()
  await menu.press('Escape')
  expect(await readFile(manifestPath)).toEqual(before);expect(await readFile(output).catch(()=>null)).toBeNull()
  if(status==='changed')expect(await readFile(source)).toEqual(changed);else expect(await readFile(source).catch(()=>null)).toBeNull()
 }finally{await writeFile(source,original)}
})
