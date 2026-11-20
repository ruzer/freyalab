import {test,expect,_electron as electron,type ElectronApplication,type Page,type Locator} from '@playwright/test'
import electronPath from 'electron'
import {createHash} from 'node:crypto'
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {t,type Language,type TranslationParameters} from '../../src/shared/i18n'
import type {ProjectManifest} from '../../src/shared/project'
import {icons} from '../../src/renderer/lib/icons'
import {closeElectron} from './close-electron'
import {traceElectronFailure} from './electron-trace'
import {openAnalysis} from './panel'
import {projectTreeRow,openProjectRowMenu,chooseProjectAction} from './project-panel'

let app:ElectronApplication,page:Page,root:string,folder:string,source:string,language:Language,errors:string[],stopTrace:(()=>Promise<void>)|undefined
const original=Buffer.from('ID,Ciudad,Ingreso\n00123,Oaxaca,100\n9007199254740993,Mérida,200\n','utf8')
const changed=Buffer.from('ID,Ciudad,Ingreso\n00123,Oaxaca,999\n9007199254740993,Mérida,200\n00007,Xalapa,300\n','utf8')
const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex')
const tr=(key:string,parameters:TranslationParameters={})=>t(key,parameters,language)
const toast=()=>page.locator('.toast:not(.close-notice)')
const footer=()=>page.locator('footer.statusbar')
const projectPanel=()=>page.getByRole('tabpanel',{name:tr('project.tab'),exact:true})
const manifest=async()=>JSON.parse(await readFile(join(folder,'proyecto.freyalab'),'utf8')) as ProjectManifest

async function iconFor(notice:Locator,kind:'success'|'info'|'warning'|'error'){
 const expected=(icons as Readonly<Record<string,string|undefined>>)[kind==='success'?'circle-check':kind==='info'?'info':'triangle-alert']
 expect(expected).toBeDefined();await expect(notice.locator(':scope>svg.icon')).toHaveCount(1)
 await expect(notice.locator(':scope>svg.icon')).toHaveAttribute('aria-hidden','true')
 expect(await notice.locator(':scope>svg.icon').evaluate((element,body)=>{
  const reference=document.createElementNS('http://www.w3.org/2000/svg','svg');reference.innerHTML=body!
  return element.innerHTML.replace(/\s+/g,' ').trim()===reference.innerHTML.replace(/\s+/g,' ').trim()
 },expected)).toBe(true)
 await expect(notice).toHaveAttribute('role','status');await expect(notice.getByRole('button',{name:'Cerrar aviso',exact:true})).toBeVisible()
}
async function registeredSource(){
 await page.getByRole('button',{name:tr('project.create'),exact:true}).press('Enter')
 const create=page.getByRole('dialog',{name:tr('project.new'),exact:true});await create.getByRole('button',{name:tr('project.pickFolder'),exact:true}).press('Enter');await expect(create.getByRole('textbox',{name:tr('project.name'),exact:true})).toHaveValue('Censo');await create.getByRole('button',{name:tr('project.create'),exact:true}).press('Enter')
 await projectPanel().getByRole('button',{name:tr('project.source.add'),exact:true}).press('Enter')
 const draft=page.getByRole('dialog',{name:tr('project.source.add'),exact:true});await expect(draft.getByRole('listitem')).toHaveText(['ID','Ciudad','Ingreso']);await draft.getByRole('button',{name:tr('project.source.register'),exact:true}).press('Enter');await expect(draft).toHaveCount(0)
 await expect(projectPanel().getByTitle(tr('project.source.protected'),{exact:true})).toHaveCount(1)
 await chooseProjectAction(await openProjectRowMenu(projectTreeRow(page,'encuesta.csv',language),language),'dialog.open.button',language)
 const grid=page.getByRole('grid',{name:'Tabla de datos',exact:true});await expect(grid.locator('.csv-row')).toHaveCount(2);await expect(page.getByRole('gridcell',{name:'Fila 1, Ingreso',exact:true})).toHaveText('100')
 const doc=(await page.evaluate(()=>window.freya.documents())).find(value=>value.name==='encuesta.csv')!;expect(doc).toMatchObject({projectSource:'protected',readonly:true,rowCount:2})
 await page.evaluate(id=>{
  const events:{type:string;matches:boolean}[]=[];const stop=window.freya.onEvent(event=>{if(event.type==='external')events.push({type:event.type,matches:event.id===id})})
  Reflect.set(window,'singleNoticeEvents',events);Reflect.set(window,'stopSingleNoticeEvents',stop)
 },doc.id)
 await expect(toast()).toHaveCount(0);return{doc,record:(await manifest()).sources[0]}
}
async function changeSource(){
 // Solo se pausa el renderer: la escritura y los watchers de main siguen siendo reales.
 await page.clock.install({time:0});await page.clock.pauseAt(1)
 await writeFile(source,changed)
 await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'singleNoticeEvents').filter((event:{matches:boolean})=>event.matches).length)).toBeGreaterThan(0)
 await expect(projectTreeRow(page,'encuesta.csv',language).getByText(tr('project.source.status.changed'),{exact:true})).toBeVisible()
}
async function unchangedRegistration(record:ProjectManifest['sources'][number]){
 expect((await manifest()).sources[0]).toEqual(record);expect(record.sha256).toBe(digest(original));expect(digest(changed)).not.toBe(record.sha256);expect(await readFile(source)).toEqual(changed)
 expect((await page.evaluate(()=>window.freya.documents())).find(value=>value.name==='encuesta.csv')).toMatchObject({projectSource:'protected',readonly:true,dirty:false,rowCount:2})
 await expect(page.getByRole('button',{name:tr('toolbar.save'),exact:true})).toBeDisabled()
}

test.beforeEach(async({},info)=>{
 language=info.title.endsWith('[en-XA]')?'en-XA':'es';root=await mkdtemp(join(tmpdir(),'freya-single-notice-'));folder=join(root,'Censo');source=join(folder,'encuesta.csv');errors=[];stopTrace=undefined;await mkdir(folder);await writeFile(source,original)
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:language,FREYALAB_USER_DATA:join(root,'profile'),FREYALAB_TEST_FOLDER:folder,FREYALAB_TEST_PROJECT_SOURCE_PATH:source}})
 page=await app.firstWindow();stopTrace=await traceElectronFailure(page.context(),info);page.on('pageerror',error=>errors.push(error.message));await page.waitForFunction(()=>!!window.freya);await page.setViewportSize(language==='es'?{width:1440,height:900}:{width:1280,height:720});await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption(language==='es'?'light':'dark')
})
test.afterEach(async()=>{
 try{await page?.clock.resume().catch(()=>{});await page?.evaluate(()=>Reflect.get(window,'stopSingleNoticeEvents')?.()).catch(()=>{});expect(errors).toEqual([])}
 finally{try{await stopTrace?.()}finally{await closeElectron(app);await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:200})}}
})

for(const locale of ['es','en-XA'] as const){
 test('SIM-2g: fuente protegida en Tabla muestra una franja externa sin toast ni copia al pie ['+locale+']',async()=>{
  const{record}=await registeredSource(),before=await footer().innerText();await changeSource()
  const workspace=page.locator('.document-workspace:not([hidden])');await expect(workspace.locator('.external-banner')).toHaveCount(1);await expect(workspace.locator('.external-banner')).toBeVisible();await expect(workspace.locator('.warning-banner')).toHaveCount(2)
  expect(await toast().count()).toBe(0);await expect.poll(()=>footer().innerText()).toBe(before)
  const text=await workspace.locator('.external-banner').innerText();expect(text).not.toContain('Al guardar se comprobarán')
  if(locale==='en-XA'){expect(text).toContain('Thïs fïlë chángëd öütsïdë FrëyáLáb.');expect(text).not.toContain('Este archivo cambió')}
  else expect(text).toContain('Este archivo cambió fuera de FreyaLab.')
  await expect(page.getByRole('gridcell',{name:'Fila 1, ID',exact:true})).toHaveText('00123');await expect(page.getByRole('gridcell',{name:'Fila 2, ID',exact:true})).toHaveText('9007199254740993');await unchangedRegistration(record)
 })
 test('SIM-2g: Análisis delante recibe un warning con nombre sin prometer guardar ['+locale+']',async()=>{
  const{doc,record}=await registeredSource();await openAnalysis(page,'Información');const workspace=page.locator('.analysis-workspace:not([hidden])');await expect(workspace.getByRole('region',{name:tr('info.title'),exact:true}).getByRole('button',{name:tr('info.refresh'),exact:true})).toBeEnabled()
  const before=await footer().innerText(),selected=await page.locator('.tabs[role=tablist]').getByRole('tab',{selected:true}).getAttribute('id');await changeSource()
  await expect(toast()).toHaveCount(1);await expect(toast()).toHaveClass(/\bwarning\b/);await iconFor(toast(),'warning');await expect(toast()).toContainText(doc.name)
  if(locale==='es')await expect(toast().locator(':scope>span')).toHaveText('encuesta.csv cambió fuera de FreyaLab.')
  else{await expect(toast()).toContainText('chángëd öütsïdë FrëyáLáb.');await expect(toast()).not.toContainText('cambió fuera')}
  await expect(toast()).not.toContainText('Al guardar se comprobarán');await expect(toast()).not.toContainText(/when saving|ön sávïng|whën sávïng/i);await expect.poll(()=>footer().innerText()).toBe(before)
  await expect(page.locator('.document-workspace .external-banner')).toHaveCount(1);await expect(page.locator('.document-workspace .external-banner')).not.toBeVisible();await expect(page.locator('.tabs[role=tablist]').getByRole('tab',{selected:true})).toHaveAttribute('id',selected!)
  await toast().getByRole('button',{name:'Cerrar aviso',exact:true}).press('Enter');await expect(toast()).toHaveCount(0);await unchangedRegistration(record)
 })
}

test('SIM-2g: éxito, información y error conservan iconos, teclado y duraciones sin copiarse al pie',async()=>{
 const path=join(root,'editable.csv');await writeFile(path,original);const[doc]=await page.evaluate(path=>window.freya.openPaths([path]),path),grid=page.getByRole('grid',{name:'Tabla de datos',exact:true});await expect(grid.locator('.csv-row')).toHaveCount(2)
 await app.evaluate(({ipcMain},fixtureRoot)=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya')!
  const calls:{operation:string;id?:string;args:unknown[];beginMs:number;endMs?:number;error?:string}[]=[];Reflect.set(globalThis,'singleNoticeIpc',calls)
  const safe=(value:unknown):unknown=>{
   if(typeof value==='string')return ['text','table','save','discard',''].includes(value)||/^[0-9a-f-]{36}$/i.test(value)?value:'[string]'
   if(Array.isArray(value))return value.map(safe)
   if(value&&typeof value==='object')return Object.fromEntries(['requestId','revision','offset','limit','column','rowId','type','operation'].filter(key=>Reflect.has(value,key)).map(key=>[key,Reflect.get(value,key)]))
   return value
  }
  handlers.set('freya',async(event,...args)=>{
   const call={operation:String(args[0]),id:typeof args[1]==='string'?safe(args[1]) as string:undefined,args:args.slice(2).map(safe),beginMs:performance.now(),endMs:undefined as number|undefined,error:undefined as string|undefined};calls.push(call)
   try{return await original(event,...args)}
   catch(error){call.error=String(error).replaceAll('/private'+fixtureRoot,'[fixture]').replaceAll(fixtureRoot,'[fixture]');throw error}
   finally{call.endMs=performance.now()}
  })
 },root)
 try{
 const cell=page.getByRole('gridcell',{name:'Fila 1, Ingreso',exact:true});await cell.dblclick();await page.getByRole('textbox',{name:'Editar celda',exact:true}).fill('150');await page.getByRole('textbox',{name:'Editar celda',exact:true}).press('Enter');await expect(cell).toHaveText('150');await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)?.dirty).toBe(true)
 await page.clock.install({time:0});await page.clock.pauseAt(1)
 await page.getByRole('button',{name:'Guardar',exact:true}).press('Enter');await expect(toast()).toHaveClass(/\bsuccess\b/);await expect(toast()).toContainText('Archivo guardado');await iconFor(toast(),'success');await expect(footer().locator(':scope>.truncate')).not.toContainText('Archivo guardado')
 const saved=Buffer.from(original.toString().replace('Oaxaca,100','Oaxaca,150'));expect(await readFile(path)).toEqual(saved);await page.clock.runFor(3499);await expect(toast()).toBeVisible();await page.clock.runFor(1);await expect(toast()).toHaveCount(0)
 await page.getByRole('button',{name:tr('csvText.text'),exact:true}).press('Enter');await expect(page.locator('.cm-content')).toBeVisible();await expect(toast()).toHaveClass(/\binfo\b/);await expect(toast()).toContainText(tr('csvText.viewAnnouncement',{view:tr('csvText.text')}));await iconFor(toast(),'info');await expect(footer().locator(':scope>.truncate')).not.toHaveText(tr('csvText.viewAnnouncement',{view:tr('csvText.text')}))
 await toast().getByRole('button',{name:'Cerrar aviso',exact:true}).press('Enter');await expect(toast()).toHaveCount(0)
 await page.getByRole('button',{name:tr('csvText.table'),exact:true}).press('Enter');await expect(grid).toBeVisible();await page.clock.runFor(150);await expect(grid.locator('.csv-row')).toHaveCount(2);await toast().getByRole('button',{name:'Cerrar aviso',exact:true}).press('Enter')
 await cell.dblclick();await page.getByRole('textbox',{name:'Editar celda',exact:true}).fill('175');await page.getByRole('textbox',{name:'Editar celda',exact:true}).press('Enter');await expect(cell).toHaveText('175');await page.clock.runFor(150)
 await footer().getByLabel('Formato del archivo:',{exact:false}).press('Enter');const format=footer().getByRole('group',{name:'Formato del archivo',exact:true}),separator=format.getByRole('combobox',{name:tr('csv.format.separator'),exact:true});await expect(separator).toBeDisabled();const state=await footer().locator(':scope>.truncate').innerText()
 // Mismo intento de frontera del caso SIM-1f: no habilita el control bloqueado.
 await separator.evaluate(select=>{(select as HTMLSelectElement).value=';';select.dispatchEvent(new Event('change',{bubbles:true}))})
 await expect(toast()).toHaveClass(/\berror\b/);await expect(toast()).toContainText('Guarda los cambios antes de cambiar cómo se interpreta el archivo.');await iconFor(toast(),'error');await expect(footer().locator(':scope>.truncate')).toHaveText(state);await expect(cell).toHaveText('175');expect(await readFile(path)).toEqual(saved)
 await page.clock.runFor(6999);await expect(toast()).toBeVisible();await page.clock.runFor(1);await expect(toast()).toHaveCount(0);await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)).toMatchObject({dirty:true,delimiter:','});expect((await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)?.projectSource).toBeUndefined()
 expect(await readFile(source)).toEqual(original)
 }finally{await test.info().attach('notice-mode-ipc',{body:JSON.stringify(await app.evaluate(()=>Reflect.get(globalThis,'singleNoticeIpc')),null,2),contentType:'application/json'})}
})
