import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {chartSQL,type ChartOptions} from '../../src/shared/charts'
import type {ColumnAnalysis,DocumentInfo,SqlRequest} from '../../src/shared/types'
import {closeElectron} from './close-electron'
import {openAnalysis,chartPanel,chartAssign,chartType,openChartSettings,openChartData,waitChartResult} from './panel'

let app:ElectronApplication,page:Page,folder:string,errors:string[]
let original:{path:string;content:string;doc:DocumentInfo}|undefined
type Profile=Pick<ColumnAnalysis,'column'|'numeric'|'excluded'>&Pick<ColumnAnalysis['profile'],'kind'|'dates'|'invalidDates'|'identifierZeros'|'unsafeIntegers'>
const panel=()=>chartPanel(page)
const profiles=()=>app.evaluate(()=>Reflect.get(globalThis,'compatibilityProfiles') as Profile[])
const queries=()=>app.evaluate(()=>Reflect.get(globalThis,'compatibilitySql') as string[])
const options:ChartOptions={kind:'bar',x:0,y:2,bins:10,aggregate:'sum',descending:false,measureType:'number',series:-1,time:'none'}
// Mismos bytes que las fixtures históricas de charts.spec.ts; no se sustituyen por presets.
const identifiers='Grupo,X,Y,Z\r\nA,1,1,U\r\nA,2,2,V\r\nA,3,3,U\r\nA,4,4,V\r\nA,5,100,U\r\nB,6,,V\r\nB,7,0005,U\r\nB,8,9007199254740993,U\r\nB,bad,7,V\r\nC,9,5,U\r\n'
const mixedDates='Fecha,Total,Tipo\r\n2026-01-01,10,A\r\n2026-01-15,20,B\r\n2026-03-01,30,A\r\n2026-02-30,99,B\r\n'

test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-chart-compatibility-'));errors=[];original=undefined
 const {ELECTRON_RUN_AS_NODE:_,...environment}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,
  args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],
  env:{...environment as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(folder,'profile')}})
 page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));await page.waitForFunction(()=>!!window.freya)
 await page.setViewportSize({width:1440,height:900});await page.emulateMedia({reducedMotion:'reduce'})
 await app.evaluate(({ipcMain})=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,handler=handlers.get('freya')!
  const observed:Profile[]=[],sql:string[]=[]
  Reflect.set(globalThis,'compatibilityProfiles',observed);Reflect.set(globalThis,'compatibilitySql',sql)
  handlers.set('freya',async(event,...args)=>{
   const operation=String(args[0]);if(operation==='sqlRun')sql.push((args[1] as SqlRequest).sql)
   const result=await handler(event,...args)
   if(operation==='analyzeColumn'){
    const value=result as ColumnAnalysis
    observed.push({column:value.column,numeric:value.numeric,excluded:value.excluded,kind:value.profile.kind,dates:value.profile.dates,invalidDates:value.profile.invalidDates,identifierZeros:value.profile.identifierZeros,unsafeIntegers:value.profile.unsafeIntegers})
   }
   return result
  })
 })
})
test.afterEach(async()=>{
 try{
  expect(errors).toEqual([])
  if(original){
   expect(await readFile(original.path,'utf8')).toBe(original.content)
   expect((await page.evaluate(()=>window.freya.documents())).find(doc=>doc.id===original!.doc.id)).toMatchObject({revision:original.doc.revision,dirty:false,rowCount:original.doc.rowCount})
  }
 }finally{try{await closeElectron(app)}finally{await rm(folder,{recursive:true,force:true})}}
})

async function open(content:string,name:string){
 const path=join(folder,name);await writeFile(path,content)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);original={path,content,doc}
 await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true})).toBeVisible()
 await openAnalysis(page,'Gráficos');return doc
}

test('SIM-2b compatibilidad: Ajustes conserva Texto/Número explícito con perfil identificador y valores excluidos',async()=>{
 const doc=await open(identifiers,'identifier-controls.csv')
 await chartAssign(page,'Grupo','rows');await chartAssign(page,'Y','values');await chartType(page,'bar');await waitChartResult(page)
 expect((await profiles()).find(profile=>profile.column===2)).toMatchObject({kind:'identifier',numeric:8,excluded:1,identifierZeros:1,unsafeIntegers:1})
 const scanned=(await profiles()).length,settings=await openChartSettings(page),measure=settings.getByLabel('Tipo de medida del gráfico',{exact:true})
 await expect(measure).toBeVisible();await expect(panel().getByLabel('Tipo de medida del gráfico',{exact:true})).toHaveCount(1)
 await expect(measure).toHaveValue('text');await expect(measure.locator('option')).toHaveText(['Nombres o códigos','Números para resumir'])
 const aggregate=panel().getByLabel('Resumir Y por',{exact:true})
 await expect(aggregate.locator('option[value=sum]')).toBeDisabled()
 await measure.selectOption('number');await expect(aggregate.locator('option[value=sum]')).toBeEnabled();await aggregate.selectOption('sum')
 const data=await openChartData(page);await expect(data.locator('tbody tr')).toHaveText(['C5','B12','A110'])
 expect(await queries()).toContain(chartSQL(doc.headers!,options))
 await measure.selectOption('text');await expect(aggregate).toHaveValue('count');await expect(aggregate.locator('option[value=sum]')).toBeDisabled()
 await expect(data.locator('tbody tr')).toHaveText(['C1','B4','A5'])
 expect(await queries()).toContain(chartSQL(doc.headers!,{...options,measureType:'text',aggregate:'count'}))
 await page.evaluate(()=>window.freya.documents());expect((await profiles()).length).toBe(scanned)
})

test('SIM-2b compatibilidad: Ajustes conserva Mes/Año con perfil mixto y descarta la fecha inválida sin cambiar datos',async()=>{
 const doc=await open(mixedDates,'mixed-date-controls.csv')
 await chartAssign(page,'Fecha','rows');await chartAssign(page,'Total','values');await chartType(page,'bar');await waitChartResult(page)
 expect((await profiles()).find(profile=>profile.column===0)).toMatchObject({kind:'mixed',dates:3,invalidDates:1})
 const scanned=(await profiles()).length,settings=await openChartSettings(page),time=settings.getByLabel('Agrupación temporal del gráfico',{exact:true})
 await expect(time).toBeVisible();await expect(panel().getByLabel('Agrupación temporal del gráfico',{exact:true})).toHaveCount(1)
 await expect(time.locator('option')).toHaveText(['Sin agrupar fechas','Día','Mes','Año'])
 const expected={...options,y:1,time:'month' as const}
 await time.selectOption('month');const data=await openChartData(page)
 await expect(data.locator('tbody tr')).toHaveText(['2026-0130','2026-0330'])
 await expect(panel().locator('.chart-info .scope').first()).toContainText('Fechas no válidas/vacías/ausentes: 1')
 expect(await queries()).toContain(chartSQL(doc.headers!,expected))
 await time.selectOption('year');await expect(data.locator('tbody tr')).toHaveText(['202660'])
 await expect(panel().locator('.chart-info .scope').first()).toContainText('Fechas no válidas/vacías/ausentes: 1')
 expect(await queries()).toContain(chartSQL(doc.headers!,{...expected,time:'year'}))
 await time.selectOption('none');await expect(time).toHaveValue('none');await waitChartResult(page)
 await expect(data.locator('tbody tr')).toHaveText(['2026-01-0110','2026-01-1520','2026-03-0130','2026-02-3099'])
 await page.evaluate(()=>window.freya.documents());expect((await profiles()).length).toBe(scanned)
})
