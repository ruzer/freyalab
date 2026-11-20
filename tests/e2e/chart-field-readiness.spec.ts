import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import type {DocumentInfo,TablePage,TableQuery} from '../../src/shared/types'
import {requestAnalysis,selectAnalysis,chartPanel} from './panel'
import {closeElectron} from './close-electron'

test('SIM-2c: antes de recibir la primera página real los campos esperan; después Enter usa el perfil numérico',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-field-readiness-')),path=join(folder,'encuesta.csv'),fixture=await readFile(resolve('tests/fixtures/analysis-auto-info.csv'))
 const headers=['ID','Ciudad','Edad','Ingreso','Fecha','Opcional'],errors:string[]=[]
 let app:ElectronApplication|undefined,page:Page,doc:DocumentInfo|undefined
 const state=()=>app!.evaluate(()=>{
  const s=Reflect.get(globalThis,'fieldReadinessProbe')
  return{held:s.held,delivered:s.delivered,id:s.id,query:s.query,result:s.result,analyzedColumns:s.analyzedColumns}
 })
 const release=()=>app!.evaluate(()=>Reflect.get(globalThis,'fieldReadinessProbe')?.release?.())
 try{
  await writeFile(path,fixture)
  const {ELECTRON_RUN_AS_NODE:_,...environment}=process.env
  app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...environment as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(folder,'profile')}})
  page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));await page.waitForFunction(()=>!!window.freya)
  await page.setViewportSize({width:1440,height:900});await page.emulateMedia({reducedMotion:'reduce'})
  await app.evaluate(({ipcMain})=>{
   type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
   const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya')!
   const probe={held:false,delivered:0,id:'',query:null as TableQuery|null,result:null as null|Pick<TablePage,'requestId'|'revision'|'total'|'matched'|'sample'> & {rows:number},release:undefined as undefined|(()=>void),analyzedColumns:[] as number[]}
   Reflect.set(globalThis,'fieldReadinessProbe',probe)
   handlers.set('freya',async(event,...args)=>{
    const operation=String(args[0]);if(operation==='analyzeColumn')probe.analyzedColumns.push((args[2] as {column:number}).column)
    const result=await original(event,...args)
    if(operation==='page'){
     if(!probe.held){
      const page=result as TablePage;probe.held=true;probe.id=String(args[1]);probe.query=args[2] as TableQuery
      probe.result={requestId:page.requestId,revision:page.revision,total:page.total,matched:page.matched,sample:page.sample,rows:page.rows.length}
      // Motor terminado: solo se retiene la entrega de su respuesta, sin sustituirla.
      await new Promise<void>(resolve=>{probe.release=()=>{probe.release=undefined;resolve()}})
     }
     probe.delivered++
    }
    return result
   })
  })
  ;[doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
  expect(doc.headers).toEqual(headers);expect(doc.rowCount).toBe(4)
  await expect.poll(async()=>(await state()).held).toBe(true)
  const held=await state();expect(held.id).toBe(doc.id)
  expect(held.result).toMatchObject({revision:doc.revision,total:4,matched:4,sample:false,rows:4})
  expect(held.result?.requestId).toBe(held.query?.requestId);expect(held.delivered).toBe(0)
  await requestAnalysis(page);await selectAnalysis(page,'Gráficos')
  const panel=chartPanel(page),fields=panel.getByRole('complementary',{name:'Campos y zonas',exact:true}),entry=fields.locator('[data-chart-field="3"]')
  const zones=()=>fields.locator('.zone .chip-name').allTextContents()
  await expect(entry).toBeVisible();await expect(fields.getByText('Leyendo los tipos de campo…',{exact:true})).toHaveCount(0)
  await expect(panel.locator('.result-status')).toHaveAttribute('title','Alcance por confirmar')
  const before={main:await state(),moreDisabled:await entry.locator('.field-more').getAttribute('aria-disabled'),zones:await zones()}
  expect(before.main.delivered).toBe(0);expect(before.main.analyzedColumns).toEqual([]);expect(before.zones).toEqual([])
  await entry.focus();await entry.press('Enter');await page.evaluate(()=>window.freya.documents())
  const after={main:await state(),zones:await zones(),announcement:await panel.locator('.analysis-announcement').textContent()}
  await test.info().attach('primera-pagina-real-campos-pendientes',{body:JSON.stringify({before,after},null,2),contentType:'application/json'})
  expect(before.moreDisabled).toBe('true');expect(after.main.delivered).toBe(0)
  expect(after.zones).toEqual(before.zones);expect(after.announcement).toBe('Espera a que termine la operación.')
  await expect(panel.getByRole('menu')).toHaveCount(0)
  await release();await expect.poll(async()=>(await state()).delivered).toBeGreaterThan(0)
  await expect(entry.locator('.field-badge')).toHaveAttribute('title','Número')
  await expect(entry.locator('.field-badge')).toHaveAccessibleName('Número')
  await expect(entry.locator('.field-more')).toHaveAttribute('aria-disabled','false')
  await entry.focus();await entry.press('Enter')
  await expect(fields.getByRole('region',{name:'Valores',exact:true}).locator('.chip-name')).toHaveText('Ingreso')
  await expect(fields.getByRole('region',{name:'Filas',exact:true}).locator('.chip-name')).toHaveCount(0)
  await expect(panel.locator('.analysis-announcement')).toHaveText('Ingreso añadido a Valores')
  expect(errors).toEqual([]);expect(await readFile(path)).toEqual(fixture)
  expect((await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc!.id)).toMatchObject({dirty:false,revision:doc.revision,rowCount:4,headers})
 }finally{try{if(app){await release().catch(()=>{});await closeElectron(app)}}finally{await rm(folder,{recursive:true,force:true})}}
})
