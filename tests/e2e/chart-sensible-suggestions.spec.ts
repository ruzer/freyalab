import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {parse} from 'csv-parse/sync'
import {closeElectron} from './close-electron'
import {openAnalysis,chartPanel,chartSuggestion,createSuggestedChart} from './panel'

type Call={operation:string;id:string;sql?:string}
let app:ElectronApplication,page:Page,folder:string,path:string,original:Buffer,id:string,revision:number,errors:string[]
const panel=()=>chartPanel(page)
const calls=()=>app.evaluate(()=>Reflect.get(globalThis,'sim1dCalls') as Call[])
const lastSQL=async()=>(await calls()).filter(call=>call.operation==='sqlRun').at(-1)?.sql??''
const values=()=>panel().getByRole('region',{name:'Valores',exact:true})
const summary=()=>panel().getByLabel('Configuración del gráfico',{exact:true})
async function results(){
 return panel().locator('.pivot-result tbody tr').evaluateAll(rows=>Object.fromEntries(rows.map(row=>[row.querySelector('th')!.textContent!.trim(),row.querySelector('td')!.textContent!.trim()])))
}
async function add(field:string,zone:'Filas'|'Valores'){
 await panel().locator('.field-list').getByRole('button',{name:new RegExp(`^(Añadir|Mover) a… ${field}$`)}).click()
 await panel().getByRole('menuitem',{name:new RegExp(`^Añadir a ${zone}(?: |$)`)}).click()
}
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-sim1d-'));path=join(folder,'encuesta.csv');errors=[]
 original=await readFile(resolve('tests/fixtures/chart-suggestions-survey.csv'));await writeFile(path,original)
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(folder,'profile')}})
 page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
 await app.evaluate(({ipcMain})=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya')!
  const calls:{operation:string;id:string;sql?:string}[]=[];Reflect.set(globalThis,'sim1dCalls',calls)
  handlers.set('freya',async(event,...args)=>{
   const operation=String(args[0])
   const request=operation==='sqlRun'?args[1] as {sql:string;sources:{id:string}[]}:undefined
   if(['analyzeColumn','stats','sqlRun'].includes(operation))calls.push({operation,id:request?request.sources[0].id:String(args[1]),sql:request?.sql})
   return original(event,...args)
  })
 })
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);id=doc.id;revision=doc.revision
 await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true})).toBeVisible()
})
test.afterEach(async()=>{
 try{
  expect(errors).toEqual([]);expect(await readFile(path)).toEqual(original)
  expect((await page.evaluate(()=>window.freya.documents())).find(doc=>doc.id===id)).toMatchObject({dirty:false,revision,rowCount:5})
 }finally{await closeElectron(app);await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})}
})

test('SIM-1d: abrir no analiza y Crear propone contar Ciudad sin elegir un número',async()=>{
 expect(await calls()).toEqual([])
 await openAnalysis(page,'Gráficos');await expect(chartSuggestion(page)).toBeEnabled()
 await expect(chartSuggestion(page)).toHaveText('Crear: Número de filas por Ciudad')
 await expect(values().locator('.chip')).toHaveCount(0)
 await expect(panel().locator('.pivot-result')).toHaveCount(0)
 expect((await calls()).filter(call=>['stats','sqlRun'].includes(call.operation))).toEqual([])
 await createSuggestedChart(page)
 await expect.poll(results).toEqual({Puebla:'2',Oaxaca:'3'})
 await expect(values().locator('.chip-name')).toHaveText('Filas del archivo')
 await expect(values().getByRole('combobox')).toHaveValue('count')
 await expect(values()).not.toContainText('Ingreso');await expect(values()).not.toContainText('Edad');await expect(values()).not.toContainText('ID')
 await expect.poll(lastSQL).toContain('COUNT(*)')
})

test('SIM-1d: Ciudad e Ingreso usan Promedio independiente y permiten Suma explícita',async()=>{
 const [, ...records]=parse(original.toString('utf8')) as string[][]
 const mean=Object.fromEntries(['Oaxaca','Puebla'].map(city=>{
  const values=records.filter(row=>row[1]===city&&row[3].trim()!=='').map(row=>Number(row[3]))
  return[city,values.reduce((sum,value)=>sum+value,0)/values.length]
 }))
 expect(mean).toEqual({Oaxaca:200.5,Puebla:600})
 await openAnalysis(page,'Gráficos');await expect(chartSuggestion(page)).toBeEnabled()
 await add('Ciudad','Filas');await add('Ingreso','Valores')
 const aggregate=values().getByRole('combobox',{name:'Resumir Ingreso por',exact:true})
 await expect(aggregate).toHaveValue('average')
 await expect(summary()).toHaveText('Promedio de Ingreso por Ciudad')
 await expect.poll(results).toEqual(Object.fromEntries(Object.entries(mean).map(([city,value])=>[city,String(value)])))
 await expect.poll(lastSQL).toContain('AVG(ny)')
 await aggregate.selectOption('sum')
 await expect(summary()).toHaveText('Suma de Ingreso por Ciudad')
 await expect.poll(results).toEqual({Oaxaca:'401',Puebla:'1,200'})
 await expect.poll(lastSQL).toContain('SUM(ny)')
})

test('SIM-1d: Ingreso antes de Ciudad propone Promedio y cambiar Filas conserva Suma explícita',async()=>{
 await openAnalysis(page,'Gráficos');await expect(chartSuggestion(page)).toBeEnabled()
 await add('Ingreso','Valores')
 await expect(panel().locator('.chart-types button[aria-pressed=true]')).toHaveText('Histograma')
 await add('Ciudad','Filas')
 const aggregate=values().getByRole('combobox',{name:'Resumir Ingreso por',exact:true})
 await expect(aggregate).toHaveValue('average')
 await expect(summary()).toHaveText('Promedio de Ingreso por Ciudad')
 await expect.poll(results).toEqual({Oaxaca:'200.5',Puebla:'600'})
 await expect.poll(lastSQL).toContain('AVG(ny)')
 await aggregate.selectOption('sum');await add('Opcional','Filas')
 await expect(aggregate).toHaveValue('sum');await expect(summary()).toHaveText('Suma de Ingreso por Opcional')
 await add('Ciudad','Filas')
 await expect(aggregate).toHaveValue('sum');await expect(summary()).toHaveText('Suma de Ingreso por Ciudad')
 await expect.poll(results).toEqual({Oaxaca:'401',Puebla:'1,200'})
 await expect.poll(lastSQL).toContain('SUM(ny)')
})
