import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {t} from '../../src/shared/i18n'
import {closeElectron} from './close-electron'
import {traceElectronFailure} from './electron-trace'
import {openCsvCommands} from './panel'

let app:ElectronApplication,page:Page,folder:string,path:string,bytes:Buffer,id:string
let stopTrace:(()=>Promise<void>)|undefined
let observed:{enabledBeforeTimer:boolean|null;disabledAfterTimer:boolean|null;paletteAfterEnter:boolean|null;fillDialogsAfterRelease:number|null}
const probe=()=>app.evaluate(()=>{
 const value=Reflect.get(globalThis,'formatLoadProbe')
 return value?{armed:value.armed as boolean,optionsCalls:value.optionsCalls as number,totalPages:value.totalPages as number,sameQueryPages:value.sameQueryPages as number,firstPageReturned:value.firstPageReturned as boolean,blocked:value.blocked as boolean,released:value.released as boolean,searchBPages:value.searchBPages as number}:null
})
async function release(){
 await app?.evaluate(()=>Reflect.get(globalThis,'formatLoadProbe')?.release()).catch(()=>{})
 await page?.clock.resume().catch(()=>{})
}
test.beforeEach(async({},info)=>{
 stopTrace=undefined;observed={enabledBeforeTimer:null,disabledAfterTimer:null,paletteAfterEnter:null,fillDialogsAfterRelease:null}
 folder=await mkdtemp(join(tmpdir(),'freya-format-load-'));path=join(folder,'datos.csv')
 bytes=await readFile(resolve('tests/fixtures/empty-values.csv'));await writeFile(path,bytes)
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:info.title.endsWith('(en-XA)')?'en-XA':'es',FREYALAB_USER_DATA:join(folder,'profile')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
 stopTrace=await traceElectronFailure(app.context(),info)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);id=doc.id
 await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true}).locator('.csv-row')).toHaveCount(7)
})
test.afterEach(async({},info)=>{
 await release()
 try{
  const scalars=await probe().catch(()=>null)
  await info.attach('format-load-scalars',{body:JSON.stringify({...scalars,...observed},null,2),contentType:'application/json'})
  expect(await readFile(path)).toEqual(bytes)
 }finally{
  try{await stopTrace?.()}finally{await closeElectron(app);await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})}
 }
})

for(const language of ['es','en-XA'] as const)test(`reinterpretar conserva Enter de Vacíos y una búsqueda posterior real (${language})`,async()=>{
 const tr=(key:string,values:Record<string,string|number>={})=>t(key,values,language)
 await app.evaluate(({ipcMain},id)=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya')!
  let signature:string|undefined,resolveHold:(()=>void)|undefined
  const state={armed:false,hold:true,optionsCalls:0,totalPages:0,sameQueryPages:0,firstPageReturned:false,blocked:false,released:false,searchBPages:0,
   release:()=>{state.hold=false;state.released=true;resolveHold?.()}}
  Reflect.set(globalThis,'formatLoadProbe',state)
  handlers.set('freya',async(event,...args)=>{
   if(args[0]==='options'&&args[1]===id){state.armed=true;state.optionsCalls++}
   let samePage=0
   if(args[0]==='page'&&args[1]===id&&state.armed){
    state.totalPages++
    const {requestId:_,...query}=args[2] as {requestId:number;search?:string}
    if(query.search==='b')state.searchBPages++
    const current=JSON.stringify(query);signature??=current
    if(current===signature)samePage=++state.sameQueryPages
   }
   const result=await original(event,...args)
   if(samePage===1)state.firstPageReturned=true
   if(samePage===2&&state.hold){
    state.blocked=true
    // Solo se retrasa la entrega de la respuesta real; su contenido no cambia.
    await new Promise<void>(resolve=>{resolveHold=()=>{state.blocked=false;resolve()}})
   }
   return result
  })
 },id)
 await page.clock.install({time:0});await page.clock.pauseAt(1)
 await page.locator('footer').getByLabel(`${tr('project.source.format')}:`,{exact:false}).click()
 const encoding=page.getByRole('group',{name:tr('project.source.format'),exact:true}).getByRole('combobox',{name:tr('project.source.encoding'),exact:true})
 await encoding.selectOption('win1252')
 await expect.poll(probe).toMatchObject({optionsCalls:1,firstPageReturned:true,sameQueryPages:1})
 await expect(encoding).toBeEnabled()
 await page.getByRole('checkbox',{name:'Seleccionar columna Cantidad',exact:true}).check()
 const commands=await openCsvCommands(page,app),search=commands.getByRole('searchbox',{name:'Buscar comando CSV',exact:true})
 await search.fill('fillna')
 const command=commands.locator('.command-list button')
 await expect(command).toHaveCount(1);await expect(command).toBeEnabled()
 observed.enabledBeforeTimer=await command.isEnabled()
 await page.clock.runFor(150)
 await page.evaluate(()=>window.freya.documents())
 if((await probe())!.sameQueryPages>=2)await expect.poll(async()=>(await probe())!.blocked).toBe(true)
 observed.disabledAfterTimer=await command.isDisabled()
 await search.press('Enter');observed.paletteAfterEnter=await commands.isVisible()
 await release()
 const dialog=page.getByRole('dialog',{name:tr('empty.fillTitle',{column:'Cantidad'}),exact:true})
 observed.fillDialogsAfterRelease=await dialog.count()
 await expect(dialog.getByRole('textbox',{name:tr('empty.value'),exact:true})).toBeFocused()
 await expect(dialog).toBeVisible();await dialog.press('Escape');await expect(dialog).toHaveCount(0)
 await page.getByRole('textbox',{name:'Buscar en tabla',exact:true}).fill('b')
 await expect.poll(async()=>(await probe())!.searchBPages).toBeGreaterThan(0)
 const rows=page.getByRole('grid',{name:'Tabla de datos',exact:true}).locator('.csv-row')
 await expect(rows).toHaveCount(1)
 await expect(rows.getByRole('gridcell')).toHaveText(['b','20','2','2026-03-04','x'])
})
