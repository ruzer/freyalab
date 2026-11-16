import {test,expect,_electron as electron,type ElectronApplication} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,readFile,rm,stat,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {chartSQL,chartData,type ChartOptions} from '../../src/shared/charts'
import {chartPivot} from '../../src/shared/chart-pivot'
import type {SqlRequest} from '../../src/shared/types'
import {openAnalysis,chartPanel,chartSuggestion,chartGenerate} from './panel'
import {closeElectron} from './close-electron'

let app:ElectronApplication|undefined,folder:string|undefined
test.afterEach(async()=>{if(app)await closeElectron(app);if(folder)await rm(folder,{recursive:true,force:true})})

for(const kind of ['scatter','line'] as const)test(`${kind} sin fechas carga la fuente una vez y conserva observaciones y totales nulos`,async({},info)=>{
 folder=await mkdtemp(join(tmpdir(),'freya-one-chart-load-'))
 const path=join(folder,'pares.csv'),original='X,Y\r\n1,2\r\n1,4\r\n2,3\r\n3,\r\n4,0\r\n'
 await writeFile(path,original);await mkdir(join(folder,'exports'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')}})
 const page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(page.getByRole('tab',{name:doc.name,exact:true})).toHaveAttribute('aria-selected','true')

 const options:ChartOptions={kind,x:0,y:1,bins:10,aggregate:'count',descending:false,measureType:'text',series:-1,time:'none'},sql=chartSQL(doc.headers!,options)
 const oracle=await page.evaluate(({doc,sql})=>window.freya.sqlRun({requestId:crypto.randomUUID(),sources:[{id:doc.id,revision:doc.revision}],sql}),{doc,sql})
 await page.evaluate(id=>window.freya.sqlCancel(id),oracle.requestId)
 const data=chartData(kind,oracle.columns.map(column=>column.name),oracle.rows),pivot=chartPivot(data,options,[{grand:'1',value:null}])
 const numeric=data.rows.map(row=>[Number(row[0]),row[1]===null?null:Number(row[1]),Number(row[2])])
 expect(numeric).toEqual(kind==='scatter'?[[1,2,1],[1,4,2],[2,3,3],[4,0,5]]:[[1,2,1],[1,4,2],[2,3,3],[3,null,4],[4,0,5]])
 expect(data).toMatchObject({total:5,usable:4,points:kind==='scatter'?4:5,limited:false})
 expect(chartPivot(data,options,[])).toEqual(pivot)

 await openAnalysis(page,'Gráficos');await expect(chartSuggestion(page)).toBeEnabled()
 const panel=chartPanel(page)
 await panel.locator('.more-options>summary').click()
 await panel.getByLabel('Tipo de gráfico',{exact:true}).selectOption(kind)
 await panel.getByLabel('Columna X del gráfico',{exact:true}).selectOption('0')
 await panel.getByLabel('Columna Y del gráfico',{exact:true}).selectOption('1')
 if(kind==='line')await expect(panel.getByLabel('Agrupación temporal del gráfico',{exact:true})).toHaveValue('none')
 await app.evaluate(({ipcMain})=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya')!
  const observed={requests:[] as SqlRequest[],cancelled:[] as string[]};Reflect.set(globalThis,'singleChartLoads',observed)
  handlers.set('freya',async(event,...args)=>{
   if(args[0]==='sqlRun')observed.requests.push(args[1] as SqlRequest)
   if(args[0]==='sqlCancel')observed.cancelled.push(args[1] as string)
   return original(event,...args)
  })
 })
 await chartGenerate(page).click()
 await expect(panel.locator('.pivot-result')).toBeVisible()
 const actualPivot=await panel.locator('.pivot-result tbody tr').evaluateAll(rows=>rows.map(row=>[...row.querySelectorAll('th,td')].map(cell=>cell.textContent)))
 expect(actualPivot).toEqual(pivot.rows.map(row=>[row.label,...row.values.map(value=>value===null?'—':String(Number(value)))]))
 expect(await panel.locator('.pivot-result tfoot td').allTextContents()).toEqual(pivot.totalValues.map(value=>value===null?'—':String(Number(value))))
 await expect(panel.locator('.pivot-result thead')).not.toContainText('% del total')

 const accessible=panel.locator('.more-options details').filter({has:page.locator('summary').filter({hasText:'Datos del gráfico: tabla accesible'})})
 await accessible.locator('summary').click()
 const actualRows=await accessible.locator('tbody tr').evaluateAll(rows=>rows.map(row=>[...row.querySelectorAll('td')].map(cell=>cell.textContent)))
 expect(actualRows).toEqual(data.rows.map(row=>row.map(value=>value===null?'—':value)))
 const loads=await app.evaluate(()=>Reflect.get(globalThis,'singleChartLoads') as {requests:SqlRequest[];cancelled:string[]})
 await info.attach('consultas-del-grafico',{body:JSON.stringify(loads,null,2),contentType:'application/json'})
 expect(loads.requests[0].sql).toBe(sql)
 await expect.poll(()=>app!.evaluate(()=>Reflect.get(globalThis,'singleChartLoads').cancelled as string[])).toContain(loads.requests[0].requestId)

 await panel.getByRole('button',{name:'Exportar gráfico SVG',exact:true}).click()
 await expect(panel.locator('.chart-result>.result-announcement')).toContainText('pares.svg')
 expect((await stat(join(folder,'exports','pares.svg'))).size).toBeGreaterThan(0)
 expect(await readFile(join(folder,'exports','pares.svg'),'utf8')).toContain('<svg')
 const current=(await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)!
 expect({revision:current.revision,dirty:current.dirty}).toEqual({revision:doc.revision,dirty:doc.dirty})
 expect(await readFile(path,'utf8')).toBe(original)
 expect(loads.requests,'El total nulo no necesita otra sqlRun ni otra carga de la fuente.').toHaveLength(1)
})
