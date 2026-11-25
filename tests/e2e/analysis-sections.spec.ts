import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {createHash} from 'node:crypto'
import {mkdtemp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {parse} from 'csv-parse/sync'
import type {DocumentInfo} from '../../src/shared/types'
import {t} from '../../src/shared/i18n'
import {closeElectron} from './close-electron'
import {requestAnalysis,chartAssign} from './panel'

let app:ElectronApplication,page:Page,folder:string,path:string,doc:DocumentInfo,errors:string[]
// La misma encuesta sintética de 240 × 7 usada por table-toolbar conserva sus campos y valores originales.
const headers=['ID','Ciudad','Ingreso','Edad','Grupo','Fecha','Respuesta']
const records=Array.from({length:240},(_,index)=>[
 index===1?'9007199254740993':String(index+1).padStart(5,'0'),
 ['  OaXaCa  ','  Mérida  ','  Puebla  '][index%3],
 index===1?'':String(100+index),String(18+index%35),index%2?'B':'A','2026-01-05',index%2?'sí':'no'
])
const source=[headers.join(','),...records.map(row=>row.join(','))].join('\n')+'\n'
const sectionNames=['Información','Estadísticas','Gráficos','SQL'] as const
type Section=typeof sectionNames[number]
const workspace=()=>page.locator('.analysis-workspace:not([hidden])')
const sections=()=>workspace().getByRole('tablist',{name:'Secciones de análisis',exact:true})
const exportButton=()=>workspace().locator('header').getByRole('button',{name:'Exportar',exact:true})
const menu=()=>page.getByRole('menu',{name:'Exportar',exact:true})
const calls=()=>app.evaluate(()=>Reflect.get(globalThis,'sim2aCalls') as string[])
const sourceDocument=async()=>(await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)

test.beforeEach(async({},info)=>{
 folder=await mkdtemp(join(tmpdir(),'freya-sim2a-'));path=join(folder,'encuesta.csv');errors=[]
 await mkdir(join(folder,'exports'));await writeFile(path,source)
 const {ELECTRON_RUN_AS_NODE:_,...environment}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,
  args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],
  env:{...environment as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports'),...info.title.endsWith('[grande]')?{FREYALAB_LARGE_BYTES:'2048'}:{}}})
 page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));await page.waitForFunction(()=>!!window.freya)
 await page.setViewportSize({width:1440,height:900});await page.emulateMedia({reducedMotion:'reduce'})
 await app.evaluate(({ipcMain})=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya')!
  const observed:string[]=[];Reflect.set(globalThis,'sim2aCalls',observed)
  handlers.set('freya',async(event,...args)=>{
   const operation=String(args[0]);if(['analyzeColumn','stats','sqlRun','sqlPage','exportGraphic','exportChartResult'].includes(operation))observed.push(operation)
   return original(event,...args)
  })
 })
 ;[doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true})).toBeVisible()
 expect(doc.headers).toEqual(headers);expect(doc.rowCount).toBe(240)
})
test.afterEach(async()=>{
 try{
  expect(errors).toEqual([]);expect(await readFile(path,'utf8')).toBe(source)
  expect(await sourceDocument()).toMatchObject({dirty:false,revision:doc.revision,rowCount:240})
 }finally{try{await closeElectron(app)}finally{await rm(folder,{recursive:true,force:true})}}
})

async function openAnalysis(){
 await requestAnalysis(page);await expect(workspace()).toBeVisible()
 if(!doc.large)await expect(workspace().getByRole('region',{name:'Vista general de columnas',exact:true}).getByRole('status')).toHaveText(t('info.complete'))
}
async function selectSection(name:Section){
 // Este selector compartido por la disposición vieja y nueva permite que el rojo sea la conducta comprobada.
 await workspace().locator('.analysis-sections').getByText(name,{exact:true}).click()
}
async function openExport(){await exportButton().click();await expect(menu()).toBeVisible();return menu()}
async function reopenAnalysis(){await page.locator('.tabs').getByRole('tab',{name:'Análisis de encuesta.csv',exact:true}).click();await expect(workspace()).toBeVisible()}
async function report(name:string,title:string){
 const before=(await page.evaluate(()=>window.freya.documents())).filter(value=>value.kind==='markdown').map(value=>value.id)
 await (await openExport()).getByRole('menuitem',{name,exact:true}).click()
 await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents())).filter(value=>value.kind==='markdown'&&!before.includes(value.id)).at(-1)?.text).toContain('# '+title)
 const result=(await page.evaluate(()=>window.freya.documents())).filter(value=>value.kind==='markdown'&&!before.includes(value.id)).at(-1)!
 expect(result.dirty).toBe(true);await reopenAnalysis();return result.text!
}
async function explore(){
 const explorer=workspace().getByRole('region',{name:'Exploración de columna',exact:true})
 await explorer.getByRole('button',{name:'Explorar columna',exact:true}).click();await expect(explorer.getByRole('status')).toHaveText('Exploración completa.');return explorer
}
async function addField(field:string,zone:'Filas'|'Valores'){
 await chartAssign(page,field,({Filas:'rows',Valores:'values'} as const)[zone])
}

test('SIM-2a: pestañas APG tienen relaciones propias y un único punto de tabulación con flechas, Inicio y Fin',async()=>{
 await openAnalysis()
 const tabs=sections().getByRole('tab');await expect(tabs).toHaveText([...sectionNames])
 await expect(sections().locator('[tabindex="0"]')).toHaveCount(1)
 const panelIds:string[]=[]
 for(const name of sectionNames){
  const tab=sections().getByRole('tab',{name,exact:true}),id=await tab.getAttribute('id'),panelId=await tab.getAttribute('aria-controls')
  expect(id).toBeTruthy();expect(panelId).toBeTruthy();panelIds.push(panelId!)
  await expect(workspace().locator('[id='+JSON.stringify(panelId)+']')).toHaveAttribute('role','tabpanel')
  await expect(workspace().locator('[id='+JSON.stringify(panelId)+']')).toHaveAttribute('aria-labelledby',id!)
 }
 expect(new Set(panelIds).size).toBe(4)
 const info=sections().getByRole('tab',{name:'Información',exact:true});await info.focus()
 for(const [key,name] of [['ArrowRight','Estadísticas'],['End','SQL'],['ArrowRight','Información'],['ArrowLeft','SQL'],['Home','Información']] as const){
  await page.keyboard.press(key);const selected=sections().getByRole('tab',{name,exact:true})
  await expect(selected).toBeFocused();await expect(selected).toHaveAttribute('aria-selected','true')
  await expect(sections().getByRole('tab',{selected:true})).toHaveCount(1);await expect(sections().locator('[tabindex="0"]')).toHaveCount(1)
 }
 for(const theme of ['light','dark']as const){
  await page.evaluate(theme=>window.freya.setSettings({tema:theme}),theme)
  await expect.poll(()=>page.locator('html').evaluate(element=>element.classList.contains('dark'))).toBe(theme==='dark')
  const accent=await page.getByRole('tab',{name:'Archivos',exact:true}).evaluate(element=>getComputedStyle(element).borderBottomColor)
  await expect.poll(()=>tabs.evaluateAll(tabs=>tabs.map(tab=>({selected:tab.getAttribute('aria-selected')==='true',line:getComputedStyle(tab).borderBottomColor})))).toEqual(sectionNames.map(name=>({selected:name==='Información',line:name==='Información'?accent:'rgba(0, 0, 0, 0)'})))
 }
 await page.keyboard.press('Tab');expect(await sections().evaluate(element=>element.contains(document.activeElement))).toBe(false)
 await page.keyboard.press('Shift+Tab');await expect(info).toBeFocused()
 await workspace().getByRole('button',{name:'Ir al CSV',exact:true}).click();await expect(page.locator('.tabs').getByRole('tab',{name:'encuesta.csv',exact:true})).toBeFocused()
 const other=join(folder,'otra.csv');await writeFile(other,source);await page.evaluate(path=>window.freya.openPaths([path]),other);await requestAnalysis(page)
 const ids=await page.locator('.analysis-workspace .analysis-sections [role=tab]').evaluateAll(tabs=>tabs.map(tab=>tab.id))
 expect(ids).toHaveLength(8);expect(new Set(ids).size).toBe(8)
})

test('SIM-2a: origen único y Exportar ocupan la misma cabecera en las cuatro secciones',async()=>{
 await openAnalysis()
 await expect(workspace().locator('header h2')).toHaveText('Datos de encuesta.csv · 240 filas · El archivo no se modifica')
 await expect(workspace().locator('header h2')).toBeFocused()
 const boxes:{x:number;y:number;width:number;height:number}[]=[]
 const labels:Record<Section,string[]>={Información:['Informe de columnas (Markdown)'],Estadísticas:['Informe (Markdown)','Datos CSV…','Datos JSON','Informe detallado','Estadísticas detalladas CSV…','Estadísticas detalladas JSON…'],Gráficos:['Imagen PNG','Imagen SVG','Imagen PDF','Datos JSON','Datos CSV…','Datos Markdown'],SQL:['Informe (Markdown)']}
 for(const section of sectionNames){
  await selectSection(section);await expect(exportButton()).toBeVisible();boxes.push((await exportButton().boundingBox())!)
  const precisionSlot=workspace().locator('.number-format')
  if(section==='SQL'){
   await expect(precisionSlot).not.toBeVisible();await expect(precisionSlot).toHaveJSProperty('inert',true)
   await expect(precisionSlot).toHaveAttribute('aria-hidden','true');await expect(precisionSlot.locator('select')).toBeDisabled()
  }else await expect(precisionSlot).toBeVisible()
  await expect(workspace().getByText('El archivo no se modifica',{exact:false})).toHaveCount(1)
  await expect(workspace().getByRole('button',{name:/^Abrir informe/})).toHaveCount(0)
  await expect((await openExport()).getByRole('menuitem')).toHaveText(labels[section])
  if(section==='Gráficos')await expect(menu().getByRole('separator')).toHaveCount(1)
  await page.keyboard.press('Escape');await expect(exportButton()).toBeFocused()
 }
 for(const box of boxes.slice(1))for(const axis of ['x','y','width','height'] as const)expect(Math.abs(box[axis]-boxes[0][axis])).toBeLessThanOrEqual(1)
})

test('SIM-2a: exportaciones sin resultado siguen enfocables, explican el motivo y no calculan al abrir ni activar',async()=>{
 await openAnalysis();await selectSection('Estadísticas')
 const before=await calls(),documents=await page.evaluate(()=>window.freya.documents())
 await openExport();const items=menu().getByRole('menuitem');await expect(items).toHaveCount(6)
 for(const item of await items.all()){
  await item.focus();await expect(item).toBeFocused();await expect(item).toHaveAttribute('aria-disabled','true')
  await expect(item).toHaveAccessibleDescription(t('ui.reason.result'));await item.press('Enter')
  await expect(menu()).toBeVisible()
 }
 await page.keyboard.press('Home');await expect(items.first()).toBeFocused();await page.keyboard.press('End');await expect(items.last()).toBeFocused()
 expect(await calls()).toEqual(before);expect(await page.evaluate(()=>window.freya.documents())).toEqual(documents);expect(await readdir(join(folder,'exports'))).toEqual([])
 await page.keyboard.press('Escape');await expect(exportButton()).toBeFocused()
 await selectSection('SQL');await openExport();await expect(menu().getByRole('menuitem')).toHaveAttribute('aria-disabled','true');await page.keyboard.press('Escape')
})

test('SIM-2a: informes de columnas, resumen y detalle conservan sus datos y precisión desde Exportar',async()=>{
 await openAnalysis()
 const information=await report('Informe de columnas (Markdown)','Vista general de columnas CSV')
 expect(information).toContain('Columnas solicitadas: 7. Analizadas: 7. No disponibles: 0.');expect(information).toContain('"3. Ingreso"')
 await selectSection('Estadísticas');const describe=workspace().locator('.describe-panel')
 await describe.getByRole('button',{name:'Calcular',exact:true}).click();await expect(describe.getByRole('status')).toHaveText(t('describe.complete'))
 const income=records.filter(row=>row[2]!=='').map(row=>Number(row[2])),mean=income.reduce((sum,value)=>sum+value,0)/income.length,ageMean=records.reduce((sum,row)=>sum+Number(row[3]),0)/records.length
 const summary=await report('Informe (Markdown)','Resumen estadístico CSV')
 expect(summary).toContain(`| Media (mean) | ${mean} | ${ageMean} |`);expect(summary).not.toContain('MUESTRA LIMITADA')
 await workspace().locator('.advanced-statistics>summary').click()
 const statistics=workspace().getByRole('region',{name:'Estadísticas por columna',exact:true})
 await statistics.getByRole('button',{name:'Analizar',exact:true}).click();await expect(statistics.getByRole('status')).toHaveText('Análisis completo.')
 const detailed=await report('Informe detallado','Informe de estadísticas CSV')
 expect(detailed).toContain('## Columna 3');expect(detailed).toContain(`| Media | ${mean} |`);expect(detailed).toContain('Varianza muestral (n−1)')
})

test('SIM-2a: el informe contextual conserva Perfil, Frecuencias paginadas, Distribución y Correlación',async()=>{
 await openAnalysis();await selectSection('Estadísticas');await workspace().locator('.advanced-statistics>summary').click()
 await workspace().getByText('Explorar una columna: frecuencias, calidad y distribución',{exact:true}).click()
 let explorer=workspace().getByRole('region',{name:'Exploración de columna',exact:true})
 await explorer.getByLabel('Columna para explorar',{exact:true}).selectOption('2');await explore()
 const profile=await report('Informe (Markdown)','Perfil de columna');expect(profile).toContain('Columna 3:');expect(profile).toContain('| Numéricos utilizables | 239 |')
 await explorer.getByLabel('Columna para explorar',{exact:true}).selectOption('0');await explorer.getByRole('button',{name:'Frecuencias',exact:true}).click();await explore()
 await explorer.getByRole('button',{name:'Valores siguientes',exact:true}).click();await expect(explorer.locator('.pagination')).toContainText('51–100 de 240')
 const frequencies=await report('Informe (Markdown)','Frecuencias de columna');expect(frequencies).toContain('VISTA PARCIAL');expect(frequencies).toContain('51–100 de 240');expect(frequencies).toContain('"00051"');expect(frequencies).not.toContain('"00101"')
 await explorer.getByLabel('Columna para explorar',{exact:true}).selectOption('2');await explorer.getByRole('button',{name:'Distribución',exact:true}).click();await explore()
 const distribution=await report('Informe (Markdown)','Distribución de columna');expect(distribution).toContain('sobre 239 valores numéricos utilizables')
 await explorer.getByRole('button',{name:'Correlación',exact:true}).click();await openExport()
 await expect(menu().getByRole('menuitem',{name:'Informe (Markdown)',exact:true})).toHaveAttribute('aria-disabled','true')
 await expect(menu().getByRole('menuitem',{name:'Informe (Markdown)',exact:true})).toHaveAccessibleDescription(t('ui.reason.correlation'));await page.keyboard.press('Escape')
 await explorer.getByLabel('Columna para correlación',{exact:true}).selectOption('3');await explore()
 const correlation=await report('Informe (Markdown)','Correlación de Pearson');expect(correlation).toContain('"Edad"');expect(correlation).toContain('| Pares numéricos de la misma fila | 239 |')
})

test('SIM-2a: informe SQL reúne todas las páginas y conserva identificadores y revisión',async()=>{
 await openAnalysis();await selectSection('SQL');const sql=workspace().locator('.sql-panel')
 await sql.getByRole('textbox',{name:'Consulta SQL',exact:true}).fill('SELECT "ID", "Ingreso", "Edad" FROM datos;')
 await sql.getByRole('button',{name:'Ejecutar consulta',exact:true}).click();await expect(sql.getByRole('status')).toContainText('Consulta completa')
 await sql.getByRole('button',{name:'Página siguiente SQL',exact:true}).click();await expect(sql.locator('.actions').last()).toContainText('101–200 de 240')
 const output=await report('Informe (Markdown)','Informe de resultado SQL')
 expect(output).toContain('Filas conservadas | 240');expect(output).toContain('"9007199254740993"');expect(output).toContain('"00001"');expect(output).toContain('"00240"');expect(output).toContain('| 240 | 0 |');expect(output).not.toContain('RESULTADO PARCIAL')
 expect((await calls()).filter(operation=>operation==='sqlRun')).toHaveLength(1)
})

test('SIM-2a: el menú exporta datos exactos, opciones CSV e imágenes reales con los handlers actuales',async()=>{
 await openAnalysis();await selectSection('Gráficos');const chart=workspace().locator('.charts-panel')
 await expect(chart.getByRole('button',{name:/^Crear:/})).toBeEnabled();await addField('Ciudad','Filas');await addField('Ingreso','Valores')
 await expect(chart.locator('.pivot-result tbody tr')).toHaveCount(3);await expect(chart.getByLabel('Configuración del gráfico',{exact:true})).toHaveText('Promedio de Ingreso por Ciudad')
 await (await openExport()).getByRole('menuitem',{name:'Datos JSON',exact:true}).click()
 await expect(chart.locator('.chart-result>.result-announcement')).toContainText('encuesta.analisis.json')
 const result=JSON.parse(await readFile(join(folder,'exports','encuesta.analisis.json'),'utf8'))
 expect(result.metadata).toMatchObject({source:'encuesta.csv',revision:doc.revision,analyzedRows:240,exportedElements:3,totalElements:3,partial:false,dirty:false})
 expect(result.rows).toHaveLength(3)
 for(const row of result.rows){const values=records.filter(record=>record[1]===row[0]&&record[2]!=='').map(record=>Number(record[2]));expect(Number(row[1])).toBe(values.reduce((sum,value)=>sum+value,0)/values.length)}
 await (await openExport()).getByRole('menuitem',{name:'Datos CSV…',exact:true}).click()
 const options=workspace().locator('.result-export-options');await expect(options.getByRole('checkbox',{name:'Proteger fórmulas para hojas de cálculo',exact:true})).toBeChecked()
 await expect(options).toContainText(t('charts.ui.protectHelp'));expect(await readdir(join(folder,'exports'))).toEqual(['encuesta.analisis.json'])
 await options.getByRole('button',{name:'Exportar resultados',exact:true}).click();await expect(chart.locator('.chart-result>.result-announcement')).toContainText('y su contexto JSON')
 const csv=await readFile(join(folder,'exports','encuesta.analisis.csv'),'utf8'),context=JSON.parse(await readFile(join(folder,'exports','encuesta.analisis.csv.contexto.json'),'utf8'))
 expect(parse(csv)).toHaveLength(4);expect(context.rows).toEqual(result.rows);expect(context.csv.sha256).toBe(createHash('sha256').update(csv).digest('hex'))
 await (await openExport()).getByRole('menuitem',{name:'Datos Markdown',exact:true}).click();await expect(chart.locator('.chart-result>.result-announcement')).toContainText('encuesta.analisis.md')
 expect(await readFile(join(folder,'exports','encuesta.analisis.md'),'utf8')).toContain('Promedio de Ingreso por Ciudad')
 for(const format of ['PNG','SVG','PDF'] as const){
  await (await openExport()).getByRole('menuitem',{name:'Imagen '+format,exact:true}).click();await expect(chart.locator('.chart-result>.result-announcement')).toContainText('encuesta.'+format.toLowerCase())
  const image=await readFile(join(folder,'exports','encuesta.'+format.toLowerCase()))
  if(format==='PNG')expect(image.subarray(0,8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]))
  else if(format==='PDF')expect(image.subarray(0,4).toString()).toBe('%PDF')
  else{expect(image.toString()).toContain('<svg');expect(image.toString()).toContain('Promedio de Ingreso por Ciudad');expect(image.toString()).not.toContain('<script')}
 }
})

test('SIM-2a: pestañas grandes conservan el motivo y las flechas omiten Información y Estadísticas [grande]',async()=>{
 expect(doc.large).toBe(true);await openAnalysis()
 const info=sections().getByRole('tab',{name:'Información',exact:true}),statistics=sections().getByRole('tab',{name:'Estadísticas',exact:true}),charts=sections().getByRole('tab',{name:'Gráficos',exact:true}),sql=sections().getByRole('tab',{name:'SQL',exact:true})
 for(const tab of [info,statistics]){await expect(tab).toBeDisabled();await expect(tab).toHaveAccessibleDescription(t('analysis.tab.large'))}
 await charts.focus();await page.keyboard.press('ArrowLeft');await expect(sql).toBeFocused();await expect(sql).toHaveAttribute('aria-selected','true')
 await page.keyboard.press('Home');await expect(charts).toBeFocused();await expect(charts).toHaveAttribute('aria-selected','true')
 await page.keyboard.press('End');await expect(sql).toBeFocused();await expect(sections().locator('[tabindex="0"]')).toHaveCount(1)
})

test('SIM-2a: explorar una columna después de elegir un rango conserva habilitado su informe contextual',async()=>{
 const first=page.getByRole('gridcell',{name:'Fila 1, Ingreso',exact:true})
 await first.click();await page.keyboard.press('Shift+ArrowDown')
 await openAnalysis();await selectSection('Estadísticas');await workspace().locator('.advanced-statistics>summary').click()
 const statistics=workspace().getByRole('region',{name:'Estadísticas por columna',exact:true})
 await statistics.getByLabel('Columnas para estadísticas',{exact:true}).selectOption('range')
 await expect(statistics.getByLabel('Columnas para estadísticas',{exact:true})).toHaveValue('range')
 await statistics.getByText('Explorar una columna: frecuencias, calidad y distribución',{exact:true}).click()
 const explorer=workspace().getByRole('region',{name:'Exploración de columna',exact:true})
 await explorer.getByLabel('Columna para explorar',{exact:true}).selectOption('2');await explore()
 await openExport();await expect(menu().getByRole('menuitem',{name:'Informe (Markdown)',exact:true})).toHaveAttribute('aria-disabled','false')
 await page.keyboard.press('Escape')
 const output=await report('Informe (Markdown)','Perfil de columna'),income=records.filter(row=>row[2]!=='').map(row=>Number(row[2]))
 expect(output).toContain('Columna 3:');expect(output).toContain('| Filas | 240 |');expect(output).toContain('| Numéricos utilizables | 239 |')
 expect(output).toContain(`| Media | ${income.reduce((sum,value)=>sum+value,0)/income.length} |`)
 expect(output).not.toContain('Celdas del rango');expect(await readFile(path,'utf8')).toBe(source)
})
