import {test,expect,_electron as electron,type ElectronApplication,type Page,type TestInfo} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {t,type Language} from '../../src/shared/i18n'
import type {DocumentInfo} from '../../src/shared/types'
import {closeElectron} from './close-electron'
import {traceElectronFailure} from './electron-trace'

let app:ElectronApplication,page:Page,folder:string,language:Language
let opened:{path:string;bytes:Buffer;doc:DocumentInfo}|undefined,stopTrace:(()=>Promise<void>)|undefined
const fixture=resolve('tests/fixtures/sim-3-students.csv')
const baseline=process.env.FREYALAB_SIM3A_BASELINE==='1'
const baselineEntry=resolve('..','sim3-baseline','out/main/index.js')
const asc=['9','18','18','20','25','35','40','55','70','100','100','']
const desc=['100','100','70','55','40','35','25','20','18','18','9','']
const lexicalAsc=['','100','100','18','18','20','25','35','40','55','70','9']
const lexicalDesc=['9','70','55','40','35','25','20','18','18','100','100','']
const initial=['100','18','9','18','25','40','70','55','20','100','35','']
const ids=['001','002','003','004','005','006','007','008','009','010','011','012']
const sizes=[{width:1440,height:900},{width:1280,height:720}] as const
const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex')
const tr=(key:string,parameters:Record<string,string|number>={})=>t(key,parameters,language)
const values=(name:string)=>page.getByRole('gridcell',{name:new RegExp('^Fila \\d+, '+name+'$')}).allTextContents()
const header=()=>page.getByRole('button',{name:'Edad',exact:true})
const profiles=()=>app.evaluate(()=>Reflect.get(globalThis,'sim3EvidenceRequests').profiles as [string,{column:number;profileOnly?:boolean;query?:unknown;revision:number}][])

test.beforeEach(async({},info)=>{
 language=(info.title.match(/\((es|en-XA)\)$/)?.[1]??'es') as Language
 opened=undefined;stopTrace=undefined;folder=await mkdtemp(join(tmpdir(),'freya-sim3a-evidence-'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 const executable=baseline?electronPath as unknown as string:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string
 const args=baseline?[baselineEntry]:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')]
 app=await electron.launch({chromiumSandbox:true,executablePath:executable,args,env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:language,FREYALAB_USER_DATA:join(folder,'profile')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize(sizes[0])
 stopTrace=await traceElectronFailure(app.context(),info)
 // Same observer as sim3a-sorting: forwards the real IPC handler unchanged.
 if(!baseline)await app.evaluate(({ipcMain})=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya')!
  const state={profiles:[] as unknown[],pages:[] as unknown[]};Reflect.set(globalThis,'sim3EvidenceRequests',state)
  handlers.set('freya',async(event,...args)=>{if(args[0]==='analyzeColumn')state.profiles.push(structuredClone(args.slice(1)));if(args[0]==='page')state.pages.push(structuredClone(args.slice(1)));return original(event,...args)})
 })
})

test.afterEach(async()=>{
 try{
  if(opened){
   expect(digest(await readFile(opened.path))).toBe(digest(opened.bytes))
   expect((await page.evaluate(()=>window.freya.documents())).find(doc=>doc.id===opened!.doc.id)).toEqual(opened.doc)
  }
 }finally{try{await stopTrace?.()}finally{try{if(app)await closeElectron(app)}finally{await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})}}}
})

async function open(){
 const bytes=await readFile(fixture),path=join(folder,'estudiantes.csv');await writeFile(path,bytes)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);opened={bytes,path,doc}
 await expect(page.getByRole('gridcell',{name:'Fila 1, ID',exact:true})).toBeVisible()
 await expect.poll(()=>values('Edad')).toEqual(initial)
 if(!baseline)expect(await profiles()).toEqual([])
}
async function clearOrder(){
 await page.locator('.csv-toolbar .filter-chip').click()
 await expect.poll(()=>values('Edad')).toEqual(initial)
 if(!baseline)await expect(header()).toHaveAttribute('aria-busy','false')
}
async function capture(info:TestInfo,name:string){
 if(process.env.FREYALAB_SIM3A_EVIDENCE!=='1')return
 const path=info.outputPath(name+'.png');await page.screenshot({path,animations:'disabled'})
 await info.attach(name,{path,contentType:'image/png'})
}
async function switchLiveLanguage(value:'es'|'en'){
 await page.evaluate(value=>window.freya.setLanguage(value),value);language=value
 await expect(page.locator('html')).toHaveAttribute('lang',value)
 await expect(header()).toHaveText('Edad')
 await expect(header()).toHaveAttribute('title',baseline?'Ordenar columna':tr('csv.sort.help'))
}
async function numericMessage(){
 await expect(page.locator('#dock-announcement')).toHaveText(tr('csv.sort.completeNumber',{column:'Edad'}))
}
async function queryControls(){
 const toolbar=page.getByRole('toolbar',{name:'Herramientas de la tabla',exact:true})
 await toolbar.getByLabel(tr('charts.toolbar.filter'),{exact:true}).click()
 await expect(page.getByRole('checkbox',{name:'Orden numérico',exact:true})).toHaveCount(baseline?1:0)
 await page.getByRole('button',{name:'Consulta avanzada',exact:true}).click()
 const tools=page.getByRole('region',{name:'Consulta avanzada',exact:true})
 await tools.getByRole('button',{name:tr('csvFields.order.add'),exact:true}).click()
 const numeric=tools.getByLabel(tr('csvFields.order.numeric',{n:1}),{exact:true})
 await expect(numeric).toBeVisible()
 await expect(numeric.locator('..')).toHaveText(tr('csvFields.order.exact'))
 if(language==='en-XA'){
  expect(tr('csvFields.order.numeric',{n:1})).not.toBe(t('csvFields.order.numeric',{n:1},'es'))
  expect(tr('csvFields.order.exact')).not.toBe(t('csvFields.order.exact',{},'es'))
 }
 await page.keyboard.press('Escape');await expect(tools).toHaveCount(0)
}

for(const locale of ['es','en-XA'] as const)test(`SIM-3a evidencia: idioma, ayuda y orden por teclado conservan el fixture (${locale})`,async({},info)=>{
 await open();await expect(page.locator('html')).toHaveAttribute('lang',locale)
 await expect(header()).toHaveAttribute('title',baseline?'Ordenar columna':tr('csv.sort.help'))
 if(locale==='es'){
  // en-XA is test-only startup state; the public API deliberately accepts es/en/sistema.
  await switchLiveLanguage('en');await header().click();await expect.poll(()=>values('Edad')).toEqual(baseline?lexicalAsc:asc)
  if(!baseline){await numericMessage();expect(await page.locator('#dock-announcement').textContent()).toBe('“Edad” was sorted as numbers.')}
  await clearOrder();await switchLiveLanguage('es')
 }
 const evidence:{language:Language;theme:string;width:number;height:number;initial:string[];ordered:string[];headerHelp:string|null;menuHelp:string|null;announcement:string|null}[]=[]
 for(const size of sizes)for(const theme of ['light','dark'] as const){
  await page.setViewportSize(size)
  await page.getByLabel('Tema',{exact:true}).selectOption(theme)
  await expect.poll(()=>page.locator('html').evaluate(node=>node.classList.contains('dark'))).toBe(theme==='dark')
  await expect.poll(()=>values('Edad')).toEqual(initial)
  await expect(header()).toHaveText('Edad');await expect(header()).toHaveAttribute('title',baseline?'Ordenar columna':tr('csv.sort.help'))
  const beforeCount=baseline?0:(await profiles()).length
  await page.getByLabel('Seleccionar columna Edad',{exact:true}).focus();await page.keyboard.press('Shift+F10')
  const menu=page.getByRole('menu',{name:tr('csv.columnMenu.label'),exact:true}),ascending=menu.getByRole('menuitem',{name:tr('csv.columnMenu.sortAscending'),exact:true})
  await expect(menu).toBeVisible();await expect(ascending).toBeFocused()
  await expect(ascending).toHaveAttribute('title',baseline?'Orden textual; no cambia el orden del archivo':tr('csv.sort.help'))
  const menuHelp=await ascending.getAttribute('title')
  const name=`sim3a-${locale}-${theme}-${size.width}x${size.height}`
  await ascending.press('Enter');await expect.poll(()=>values('Edad')).toEqual(baseline?lexicalAsc:asc)
  if(!baseline){
   await numericMessage();await expect.poll(profiles).toHaveLength(beforeCount+1)
   const calls=await profiles(),last=calls[calls.length-1]
   expect(last).toEqual([opened!.doc.id,expect.objectContaining({column:2,revision:opened!.doc.revision,profileOnly:true})]);expect(last[1]).not.toHaveProperty('query')
  }
  await page.mouse.move(0,0);await capture(info,name+(baseline?'-before':'-after'))
  evidence.push({language,theme,...size,initial:[...initial],ordered:await values('Edad'),headerHelp:await header().getAttribute('title'),menuHelp,announcement:await page.locator('#dock-announcement').textContent()})
  await header().click();await expect.poll(()=>values('Edad')).toEqual(baseline?lexicalDesc:desc)
  if(!baseline)await numericMessage()
  await clearOrder()
 }
 // Same student source: ID stays text; no replacement fixture or numeric conversion.
 await page.getByRole('button',{name:'ID',exact:true}).click();await expect.poll(()=>values('ID')).toEqual(ids)
 if(!baseline){
  await expect(page.locator('#dock-announcement')).toHaveText(tr('csv.sort.completeText',{column:'ID'}))
  await expect.poll(()=>app.evaluate(()=>Reflect.get(globalThis,'sim3EvidenceRequests').pages.filter((entry:unknown[])=>!!(entry[1] as {sort?:unknown}).sort).at(-1)?.[1]?.sort?.numeric)).toBe(false)
 }
 await clearOrder();await queryControls()
 if(process.env.FREYALAB_SIM3A_EVIDENCE==='1')await info.attach('sim3a-capture-state',{body:Buffer.from(JSON.stringify({comparison:'Same source and ascending keyboard action: preserved baseline product (before) versus SIM3a product (after).',mode:baseline?'before-baseline':'after-sim3a',entry:baseline?baselineEntry:process.env.FREYALAB_EXECUTABLE??resolve('out/main/index.js'),fixture:'tests/fixtures/sim-3-students.csv',fixtureSHA256:digest(opened!.bytes),evidence})),contentType:'application/json'})
})
