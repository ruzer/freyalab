import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {closeElectron} from './close-electron'
import {openAnalysis,requestAnalysis,selectAnalysis,showTable} from './panel'

type Call={operation:string;id:string;column?:number;requestId?:string}
let app:ElectronApplication,page:Page,folder:string,fixture:Buffer,errors:string[],files:Map<string,Buffer>
const workspace=()=>page.locator('.analysis-workspace:not([hidden])')
const information=(id:string)=>page.locator('[id='+JSON.stringify('workspace-panel-analysis:'+id)+']').getByRole('region',{name:'Vista general de columnas',exact:true,includeHidden:true})
const report=(id:string)=>information(id).getByRole('button',{name:'Abrir informe de columnas Markdown',exact:true,includeHidden:true})
const calls=()=>app.evaluate(()=>Reflect.get(globalThis,'autoInfoProbe').calls as Call[])
const columns=async(id:string)=>(await calls()).filter(call=>call.operation==='analyzeColumn'&&call.id===id).map(call=>call.column)
const finished=async(id:string)=>{await expect(information(id).getByRole('status')).toHaveText('Exploración de columnas completa.');await expect(information(id).getByRole('button',{name:'Actualizar información',exact:true})).toBeEnabled()}
const barrier=(id:string)=>page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id),id)
const release=()=>app.evaluate(()=>Reflect.get(globalThis,'autoInfoProbe')?.release?.())

async function probe(holdNext=false){
 await app.evaluate(({ipcMain},holdNext)=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya')!
  const state={calls:[] as {operation:string;id:string;column?:number;requestId?:string}[],holdNext,held:false,release:undefined as (()=>void)|undefined}
  Reflect.set(globalThis,'autoInfoProbe',state)
  handlers.set('freya',async(event,...args)=>{
   const operation=String(args[0]),options=args[2]
   if(['analyzeColumn','stats','sqlRun','cancelAnalysis'].includes(operation))state.calls.push({operation,id:String(args[1]),column:options&&typeof options==='object'?Reflect.get(options,'column'):undefined,requestId:typeof options==='string'?options:options&&typeof options==='object'?Reflect.get(options,'requestId'):undefined})
   if(operation==='cancelAnalysis')state.release?.()
   const result=await original(event,...args)
   if(operation==='analyzeColumn'&&state.holdNext){
    state.holdNext=false;state.held=true
    await new Promise<void>(resolve=>{state.release=()=>{state.held=false;state.release=undefined;resolve()}})
   }
   return result
  })
 },holdNext)
}
async function open(name='encuesta.csv',source:Buffer|string=fixture){
 const path=join(folder,name),bytes=Buffer.isBuffer(source)?source:Buffer.from(source);files.set(path,bytes);await writeFile(path,bytes)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true})).toBeVisible();return{doc,path}
}
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-auto-info-'));fixture=await readFile(resolve('tests/fixtures/analysis-auto-info.csv'));files=new Map();errors=[]
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(folder,'profile')}})
 page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
})
test.afterEach(async()=>{
 try{expect(errors).toEqual([]);for(const[path,bytes]of files)expect(await readFile(path)).toEqual(bytes)}
 finally{try{if(app){await release().catch(()=>{});await closeElectron(app)}}finally{await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})}}
})

test('SIM-1c: abrir no analiza y Analizar solicita una sola tanda con los seis oráculos de Información',async()=>{
 await probe();const {doc}=await open();await barrier(doc.id);expect(await calls()).toEqual([])
 await requestAnalysis(page);await finished(doc.id)
 expect(await columns(doc.id)).toEqual([0,1,2,3,4,5]);expect((await calls()).some(call=>['stats','sqlRun'].includes(call.operation))).toBe(false)
 const rows=information(doc.id).locator('tbody tr');await expect(rows).toHaveCount(6)
 await expect(rows.getByRole('rowheader')).toHaveText(['ID','Ciudad','Edad','Ingreso','Fecha','Opcional'])
 await expect(rows.locator('.type-explanation>summary')).toHaveText(['Posible identificador','Categórico','Numérico','Numérico','Fecha ISO','Categórico'])
 await expect(rows.locator('.non-empty')).toHaveText(['4','4','4','3','4','2'])
 await expect(rows.locator('.distinct-detail>summary')).toHaveText(['4','2','4','3','4','1'])
 await rows.nth(5).locator('.quality-breakdown>summary').click();await expect(rows.nth(5).locator('.quality-breakdown dd')).toHaveText(['0','1','1'])
 await expect(information(doc.id).getByRole('status')).not.toContainText('Datos o alcance actualizados')
 await expect(information(doc.id).locator('.pagination')).toHaveCount(0)
 expect((await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)).toMatchObject({dirty:false,revision:doc.revision,rowCount:4})
})

test('SIM-1c: la paleta inicia una vez y el cálculo continúa oculto al paginar la misma vista',async()=>{
 await probe(true)
 const [header,...records]=fixture.toString().trimEnd().split('\n'),source=[header,...Array.from({length:100},()=>records).flat()].join('\n')+'\n',{doc}=await open('larga.csv',source)
 await requestAnalysis(page,app);const panel=information(doc.id);await expect(panel.getByRole('status')).toHaveText('Explorando columna 1 de 6…');await expect.poll(()=>app.evaluate(()=>Reflect.get(globalThis,'autoInfoProbe').held)).toBe(true)
 await showTable(page)
 const grid=page.getByRole('grid',{name:'Tabla de datos',exact:true});await grid.evaluate(grid=>grid.scrollTop=grid.scrollHeight)
 await expect(page.getByRole('gridcell',{name:'Fila 400, ID',exact:true})).toHaveText('00008')
 await expect(panel.getByRole('status',{includeHidden:true})).toHaveText('Explorando columna 1 de 6…');expect(await columns(doc.id)).toEqual([0])
 await release();await expect(panel.getByRole('status',{includeHidden:true})).toHaveText('Exploración de columnas completa.')
 await openAnalysis(page,'Información');await finished(doc.id);await barrier(doc.id);expect(await columns(doc.id)).toEqual([0,1,2,3,4,5])
 await showTable(page);await openAnalysis(page,'Información');await finished(doc.id);await barrier(doc.id);expect(await columns(doc.id)).toEqual([0,1,2,3,4,5])
 await expect(page.locator('.tabs[role=tablist]').getByRole('tab',{name:'Análisis de larga.csv',exact:true})).toHaveCount(1)
})

test('SIM-1c: editar datos o cambiar alcance avisa sin recalcular hasta Actualizar información',async()=>{
 await probe();const {doc}=await open();await requestAnalysis(page);await finished(doc.id)
 await showTable(page);const cell=page.getByRole('gridcell',{name:'Fila 1, Ingreso',exact:true});await cell.dblclick();await page.getByRole('textbox',{name:'Editar celda',exact:true}).fill('150');await page.getByRole('textbox',{name:'Editar celda',exact:true}).press('Enter');await expect(cell).toHaveText('150')
 await openAnalysis(page,'Información');const panel=information(doc.id),update=panel.getByRole('button',{name:'Actualizar información',exact:true})
 await expect(panel.getByRole('status')).toContainText('Datos o alcance actualizados');await expect(panel.locator('tbody tr')).toHaveCount(0);await expect(update).toBeEnabled();await barrier(doc.id);expect(await columns(doc.id)).toHaveLength(6)
 await update.click();await finished(doc.id);expect(await columns(doc.id)).toHaveLength(12)
 await panel.getByRole('combobox',{name:'Alcance de la vista general',exact:true}).selectOption('view')
 await expect(panel.getByRole('status')).toContainText('Datos o alcance actualizados');await expect(update).toBeEnabled();await barrier(doc.id);expect(await columns(doc.id)).toHaveLength(12)
 await update.click();await finished(doc.id);expect(await columns(doc.id)).toHaveLength(18);await expect(panel.locator('.scope')).toContainText('Vista filtrada');await expect(panel.locator('.scope')).toContainText('4 filas por columna')
 expect((await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)).toMatchObject({dirty:true,revision:doc.revision+1})
})

test('SIM-1c: cancelar no reintenta y el traspaso a Gráficos no inicia un gráfico ni revive una tanda',async()=>{
 await probe(true);const {doc}=await open();await requestAnalysis(page);await expect(information(doc.id).getByRole('status')).toHaveText('Explorando columna 1 de 6…');await expect.poll(()=>app.evaluate(()=>Reflect.get(globalThis,'autoInfoProbe').held)).toBe(true)
 await information(doc.id).getByRole('button',{name:'Cancelar exploración de columnas',exact:true}).click()
 await expect(information(doc.id).getByRole('status')).toHaveText('Exploración de columnas cancelada.');await showTable(page);await openAnalysis(page,'Información');await barrier(doc.id);expect(await columns(doc.id)).toEqual([0])
 await selectAnalysis(page,'Estadísticas');await expect(workspace().getByRole('button',{name:'Calcular',exact:true})).toBeVisible();await selectAnalysis(page,'SQL');await expect(workspace().getByRole('button',{name:'Ejecutar consulta',exact:true})).toBeVisible();expect((await calls()).some(call=>['stats','sqlRun'].includes(call.operation))).toBe(false)
 await showTable(page);const next=await open('traspaso.csv');await app.evaluate(()=>{Reflect.get(globalThis,'autoInfoProbe').holdNext=true});await requestAnalysis(page);await expect.poll(()=>app.evaluate(()=>Reflect.get(globalThis,'autoInfoProbe').held)).toBe(true)
 const initial=(await calls()).find(call=>call.operation==='analyzeColumn'&&call.id===next.doc.id)!;expect(initial.requestId).toBeTruthy()
 await selectAnalysis(page,'Gráficos');const charts=workspace().locator('.charts-panel');await expect(charts.getByRole('button',{name:/^Crear:/})).toBeEnabled();await expect(charts.locator('.pivot-result')).toHaveCount(0)
 await release();await expect(information(next.doc.id).getByRole('status',{includeHidden:true})).toHaveText('Exploración de columnas cancelada.');await expect(information(next.doc.id).locator('tbody tr')).toHaveCount(0)
 expect((await calls()).some(call=>call.operation==='cancelAnalysis'&&call.id===next.doc.id&&call.requestId===initial.requestId)).toBe(true);expect(await columns(next.doc.id)).toEqual([0,0,1,2,3,4,5]);expect((await calls()).some(call=>call.operation==='sqlRun')).toBe(false)
 await openAnalysis(page,'Información');await expect(information(next.doc.id).getByRole('status')).toHaveText('Exploración de columnas cancelada.');await barrier(next.doc.id);expect(await columns(next.doc.id)).toEqual([0,0,1,2,3,4,5])
})

test('SIM-1c: informe solo con resultado, paginación solo si hace falta y límite sin modificar la fuente',async()=>{
 await probe(true);const {doc}=await open();await requestAnalysis(page)
 await expect(report(doc.id)).toHaveCount(0);await expect.poll(()=>app.evaluate(()=>Reflect.get(globalThis,'autoInfoProbe').held)).toBe(true);await release();await finished(doc.id);await expect(report(doc.id)).toBeEnabled();await expect(information(doc.id).locator('.pagination')).toHaveCount(0)
 await showTable(page);const headers=Array.from({length:62},(_,index)=>'Campo '+(index+1)),text=[headers.join(','),headers.map((_,index)=>String(index)).join(','),headers.map((_,index)=>String(index+1)).join(',')].join('\n')+'\n',wide=await open('ancha.csv',text)
 await requestAnalysis(page);await finished(wide.doc.id);const panel=information(wide.doc.id);await expect(panel.locator('tbody tr')).toHaveCount(50);await expect(panel.locator('.pagination')).toContainText('1–50 de 62');await panel.getByRole('button',{name:'Columnas siguientes',exact:true}).click();await expect(panel.locator('tbody tr')).toHaveCount(12);await expect(panel.locator('tbody tr').first().getByRole('rowheader')).toHaveText('Campo 51')
 await panel.getByRole('searchbox',{name:'Buscar nombres de columnas',exact:true}).fill('Campo 62');await expect(panel.locator('tbody tr')).toHaveCount(1);await expect(panel.locator('.pagination')).toHaveCount(0)
 await report(wide.doc.id).click();await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents())).find(value=>value.kind==='markdown')?.text).toContain('Columnas solicitadas: 62. Analizadas: 62. No disponibles: 0.')
 const capped=await open('limite.csv',Array.from({length:2001},(_,index)=>'C'+index).join(',')+'\n1\n');await requestAnalysis(page);await expect(information(capped.doc.id).getByRole('status')).toContainText('hasta 2 000 columnas');await expect(report(capped.doc.id)).toHaveCount(0);expect(await columns(capped.doc.id)).toEqual([])
 await showTable(page);await openAnalysis(page,'Información');await barrier(capped.doc.id);expect(await columns(capped.doc.id)).toEqual([]);await expect(information(capped.doc.id).getByRole('status')).toContainText('hasta 2 000 columnas')
})

test('SIM-1c: alternar Tabla y Texto no repite Información sin actualizar',async()=>{
 await probe();const {doc}=await open();await requestAnalysis(page);await finished(doc.id);expect(await columns(doc.id)).toEqual([0,1,2,3,4,5])
 await showTable(page);await app.evaluate(()=>{Reflect.get(globalThis,'autoInfoProbe').holdNext=true})
 await page.getByRole('button',{name:'Texto',exact:true}).click();await expect(page.locator('.cm-content')).toBeVisible();expect(await columns(doc.id)).toHaveLength(6)
 await page.getByRole('button',{name:'Tabla',exact:true}).click();await expect(page.getByRole('gridcell',{name:'Fila 1, ID',exact:true})).toHaveText('00123')
 const tab=page.getByRole('tab',{name:'Análisis de encuesta.csv',exact:true});await expect(tab).toHaveCount(1);await tab.click();const panel=information(doc.id),update=panel.getByRole('button',{name:'Actualizar información',exact:true})
 try{
  await expect(update).toBeEnabled();await expect(panel.getByRole('status')).toContainText('Datos o alcance actualizados');expect(await columns(doc.id)).toHaveLength(6)
 }finally{await writeFile(test.info().outputPath('mode-probe-calls.json'),JSON.stringify(await calls(),null,2)+'\n')}
 await app.evaluate(()=>{Reflect.get(globalThis,'autoInfoProbe').holdNext=false})
 await update.click();await finished(doc.id);expect(await columns(doc.id)).toHaveLength(12)
})
