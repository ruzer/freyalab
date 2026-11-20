import {t} from '../../src/shared/i18n'
import {test,expect,_electron as electron,type ElectronApplication,type Page,type Locator} from '@playwright/test'
import electronPath from 'electron'
import {createHash} from 'node:crypto'
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {parse} from 'csv-parse/sync'
import type {DocumentInfo,GraphicExportRequest,SqlRequest} from '../../src/shared/types'
import {closeElectron} from './close-electron'
import {openAnalysis,chartPanel,exportAnalysis,analysisResultExport,showTable,menuItem,chartAssign,chartType,chartTypeButton} from './panel'

let app:ElectronApplication,page:Page,folder:string,errors:string[]
let originals:Map<string,{content:string;doc:DocumentInfo}>
const headers=['Ciudad','Ingreso','Fecha','ID','Grupo','Edad']
const cities=['Oaxaca','Mérida','Puebla','Toluca','Colima']
const rows=(count=50,names=cities)=>Array.from({length:count},(_,index)=>[
 names[index%names.length],String(100+index),`2026-01-${String(index%5+1).padStart(2,'0')}`,
 String(index+1).padStart(6,'0'),index%2?'Sur':'Norte',String(18+index%20)
])
const panel=()=>chartPanel(page)
const fields=()=>panel().getByRole('complementary',{name:'Campos y zonas',exact:true})
const title=()=>panel().getByLabel('Configuración del gráfico',{exact:true})
const changeTitle=()=>panel().getByRole('button',{name:'Cambiar título',exact:true})
const titleInput=()=>panel().getByRole('textbox',{name:'Título del gráfico',exact:true})
const settings=()=>panel().locator('details').filter({has:page.locator(':scope > summary').filter({hasText:/^Ajustes del gráfico$/})})
const details=()=>panel().locator('.chart-info')
const calls=()=>app.evaluate(()=>Reflect.get(globalThis,'chartClarityCalls') as string[])
const images=()=>app.evaluate(()=>Reflect.get(globalThis,'chartClarityImages') as GraphicExportRequest[])
const queries=()=>app.evaluate(()=>Reflect.get(globalThis,'chartClaritySql') as string[])

test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-chart-clarity-'));await mkdir(join(folder,'exports'));errors=[];originals=new Map()
 const {ELECTRON_RUN_AS_NODE:_,...environment}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,
  args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],
  env:{...environment as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')}})
 page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));await page.waitForFunction(()=>!!window.freya)
 await page.setViewportSize({width:1440,height:900});await page.emulateMedia({reducedMotion:'reduce'})
 await app.evaluate(({ipcMain})=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya')!
  const observed:string[]=[],exports:GraphicExportRequest[]=[],sql:string[]=[]
  Reflect.set(globalThis,'chartClarityCalls',observed);Reflect.set(globalThis,'chartClarityImages',exports);Reflect.set(globalThis,'chartClaritySql',sql)
  handlers.set('freya',async(event,...args)=>{
   const operation=String(args[0]);if(['analyzeColumn','stats','sqlRun','sqlPage','sqlCancel'].includes(operation))observed.push(operation)
   if(operation==='sqlRun')sql.push((args[1] as SqlRequest).sql)
   if(operation==='exportGraphic')exports.push(args[2] as GraphicExportRequest)
   return original(event,...args)
  })
 })
})
test.afterEach(async()=>{
 try{
  expect(errors).toEqual([])
  const documents=await page.evaluate(()=>window.freya.documents())
  for(const [path,{content,doc}] of originals){
   expect(await readFile(path,'utf8')).toBe(content)
   expect(documents.find(value=>value.id===doc.id)).toMatchObject({revision:doc.revision,dirty:false,rowCount:doc.rowCount})
  }
 }finally{try{await closeElectron(app)}finally{await rm(folder,{recursive:true,force:true})}}
})

async function open(name='encuesta.csv',records=rows()){
 const path=join(folder,name),content=[headers.join(','),...records.map(row=>row.join(','))].join('\r\n')+'\r\n'
 await writeFile(path,content);const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 originals.set(path,{content,doc});expect(doc.headers).toEqual(headers);expect(doc.rowCount).toBe(records.length)
 await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true})).toBeVisible();return{doc,records}
}
async function assign(field:string,zone:'Filas'|'Columnas'|'Valores'|'Filtros'){
 await chartAssign(page,field,({Filas:'rows',Columnas:'columns',Valores:'values',Filtros:'filters'} as const)[zone])
}
async function ready(){await expect(panel().locator('.chart-result>.result-announcement')).toContainText('Resultado actualizado');await expect(panel().locator('.plot svg')).toBeVisible()}
async function meanCity(){
 await openAnalysis(page,'Gráficos');await assign('Ciudad','Filas');await assign('Ingreso','Valores')
 await panel().getByLabel('Resumir Ingreso por',{exact:true}).selectOption('average');await ready()
 await expect(panel().locator('.pivot-result tbody tr')).toHaveCount(5)
}
async function editTitle(value:string){await expect(changeTitle()).toBeVisible();await changeTitle().click();await expect(titleInput()).toBeFocused();await titleInput().fill(value);await titleInput().press('Enter');await expect(titleInput()).toHaveCount(0)}
async function expand(container:Locator){await expect(container).toHaveCount(1);if(await container.getAttribute('open')===null)await container.locator(':scope > summary').click()}
async function savePreset(name:string){
 await expand(settings());await expand(settings().locator('.presets'))
 await settings().getByLabel('Nombre de configuración del gráfico',{exact:true}).fill(name)
 await settings().getByRole('button',{name:'Guardar configuración',exact:true}).click()
 await expect(settings().getByLabel('Estado de configuraciones',{exact:true})).toContainText('Configuración guardada')
 return(await page.evaluate(()=>window.freya.chartPresets())).find(preset=>preset.name===name)!
}
async function exportFile(key:string,filename:string,parameters:Record<string,string>={}){
 await exportAnalysis(page,key,parameters)
 if(key==='analysis.export.csv')await analysisResultExport(page).getByRole('button',{name:'Exportar resultados',exact:true}).click()
 await expect(panel().locator('.chart-result>.result-announcement')).toContainText(filename)
 return readFile(join(folder,'exports',filename))
}

test('SIM-2b: lápiz, Intro, Escape y vacío conservan el resultado sin recalcular al cambiar el título',async()=>{
 await open();await meanCity();await page.evaluate(()=>window.freya.documents())
 const automatic=await title().innerText(),before=await calls(),beforeSql=await queries()
 expect(automatic).toBe('Promedio de Ingreso por Ciudad')
 // Solo este caso controla el reloj del renderer, después de obtener el resultado real.
 // runFor(301) agota el debounce actual de 300 ms; no mide latencia ni cambia plazos del producto.
 await page.clock.install()
 await panel().evaluate(root=>{
  const state={lost:false,observer:new MutationObserver(()=>{if(!root.querySelector('.pivot-result')||!root.querySelector('.plot svg path'))state.lost=true})}
  state.observer.observe(root,{childList:true,subtree:true});Reflect.set(window,'chartClarityPresentation',state)
 })
 async function unchanged(){
  await page.clock.runFor(301);await page.evaluate(()=>window.freya.documents()) // Barrera FIFO del mismo puente tras cualquier emisión diferida.
  expect(await calls()).toEqual(before);expect(await queries()).toEqual(beforeSql)
  expect(await panel().locator('.pivot-result').count()).toBe(1);expect(await panel().locator('.plot svg path').count()).toBeGreaterThan(0)
  expect(await page.evaluate(()=>Reflect.get(window,'chartClarityPresentation').lost)).toBe(false)
 }
 try{
  await expect(changeTitle()).toBeVisible();await changeTitle().click();await expect(titleInput()).toBeFocused();await expect(titleInput()).toHaveAttribute('placeholder',automatic)
  await titleInput().fill('  Ingreso medio por ciudad, 2026  ');await titleInput().press('Enter')
  await expect(title()).toHaveText('Ingreso medio por ciudad, 2026');await expect(changeTitle()).toBeFocused();await unchanged()
  await changeTitle().click();await titleInput().fill('No se guarda');await titleInput().press('Escape')
  await expect(titleInput()).toHaveCount(0);await expect(title()).toHaveText('Ingreso medio por ciudad, 2026');await expect(changeTitle()).toBeFocused();await unchanged()
  await editTitle('   ');await expect(title()).toHaveText(automatic);await expect(changeTitle()).toBeFocused();await unchanged()
 }finally{await page.evaluate(()=>Reflect.get(window,'chartClarityPresentation').observer.disconnect())}
})

test('SIM-2b: título propio sobrevive campos y preset y acompaña SVG, PNG, JSON y contexto CSV con ceros y hash exactos',async()=>{
 const {doc,records}=await open();await meanCity();const custom='Ingreso medio por ciudad, 2026'
 await editTitle(custom);await assign('Edad','Valores');await ready();await expect(title()).toHaveText(custom)
 await assign('Ingreso','Valores');await panel().getByLabel('Resumir Ingreso por',{exact:true}).selectOption('average');await ready()
 const saved=await savePreset('Ingreso con título');expect(saved.configuration.options.title).toBe(custom)
 await editTitle('Temporal');await settings().getByLabel('Configuración guardada del gráfico',{exact:true}).selectOption(saved.id)
 await settings().getByRole('button',{name:'Aplicar configuración',exact:true}).click();await ready();await expect(title()).toHaveText(custom)
 await assign('ID','Filas');await ready();await expect(title()).toHaveText(custom)
 const svg=(await exportFile('charts.ui.exportImage','encuesta.svg',{format:'SVG'})).toString('utf8')
 const png=await exportFile('charts.ui.exportImage','encuesta.png',{format:'PNG'})
 expect(svg).toContain(custom);expect(svg).not.toMatch(/<script\b/i);expect(png.byteLength).toBeGreaterThan(1000)
 expect((await images()).map(image=>image.format)).toEqual(['svg','png']);expect((await images()).every(image=>image.svg.includes(custom))).toBe(true)
 const json=JSON.parse((await exportFile('analysis.export.json','encuesta.analisis.json')).toString('utf8'))
 const csv=(await exportFile('analysis.export.csv','encuesta.analisis.csv')).toString('utf8')
 const context=JSON.parse(await readFile(join(folder,'exports','encuesta.analisis.csv.contexto.json'),'utf8'))
 const expected=records.map(row=>[row[3],row[1]+'.0'])
 expect(json.metadata).toMatchObject({description:custom,source:doc.name,revision:doc.revision,dirty:false,analyzedRows:50,totalElements:50,exportedElements:50,partial:false})
 expect(json.metadata.configuration.options).toMatchObject({title:custom,x:3,y:1,aggregate:'average'})
 expect(json.rows).toEqual(expected);expect(context.rows).toEqual(expected)
 const {completedAt:jsonCompleted,...jsonMetadata}=json.metadata,{completedAt:csvCompleted,...csvMetadata}=context.metadata
 expect(csvMetadata).toEqual(jsonMetadata);expect(Number.isFinite(Date.parse(jsonCompleted))).toBe(true);expect(Number.isFinite(Date.parse(csvCompleted))).toBe(true)
 expect(parse(csv)).toEqual([json.columns.map((column:{index:number;label:string})=>`${column.index+1}. ${column.label}`),...expected])
 expect(context.csv.sha256).toBe(createHash('sha256').update(csv).digest('hex'));expect(csv).not.toContain(custom)
})

test('SIM-2b: Ajustes empieza cerrado al final de Campos y conserva controles únicos y los detalles de tabla, consulta y filtros',async()=>{
 await open();await meanCity()
 await expect(settings().locator(':scope > summary')).toBeVisible();expect(await settings().getAttribute('open')).toBeNull()
 await expect(fields().locator('details').filter({has:page.locator(':scope > summary').filter({hasText:/^Ajustes del gráfico$/})})).toHaveCount(1)
 expect(await fields().evaluate(root=>{const settings=[...root.querySelectorAll('details')].find(node=>node.querySelector(':scope > summary')?.textContent?.trim()==='Ajustes del gráfico');return !!settings&&!!(root.querySelector('.zones')!.compareDocumentPosition(settings)&Node.DOCUMENT_POSITION_FOLLOWING)})).toBe(true)
 await expect(panel().getByText('Más opciones',{exact:true})).toHaveCount(0);await expand(settings())
 for(const label of ['Alcance del gráfico','Orden del gráfico','Nombre de configuración del gráfico','Configuración guardada del gráfico'])await expect(panel().getByLabel(label,{exact:true})).toHaveCount(1)
 for(const label of ['Columna X del gráfico','Columna Y del gráfico','Resumen del gráfico','Series del gráfico','Tipo de gráfico'])await expect(panel().getByLabel(label,{exact:true})).toHaveCount(0)
 await expect(settings().getByLabel('Tipo de medida del gráfico',{exact:true})).toHaveCount(1);await expect(panel().getByLabel('Tipo de medida del gráfico',{exact:true})).toHaveCount(1)
 for(const name of ['Reducir gráfico','Ampliar gráfico','Ajustar gráfico']){await expect(settings().getByRole('button',{name,exact:true})).toHaveCount(1);await expect(panel().getByRole('button',{name,exact:true})).toHaveCount(1)}
 await expand(settings().locator('.presets'));for(const name of ['Guardar configuración','Aplicar configuración','Eliminar configuración elegida','Actualizar biblioteca']){await expect(settings().getByRole('button',{name,exact:true})).toHaveCount(1);await expect(panel().getByRole('button',{name,exact:true})).toHaveCount(1)}
 await expect(panel().getByLabel('Agrupación temporal del gráfico',{exact:true})).toHaveCount(0);await expect(panel().getByLabel('Intervalos del gráfico',{exact:true})).toHaveCount(0)
 await expect(panel().getByLabel('Resumir Ingreso por',{exact:true})).toHaveCount(1)
 for(const kind of ['bar','line','scatter','histogram','heatmap','box'] as const)await expect(await chartTypeButton(page,kind)).toHaveCount(1)
 await assign('Grupo','Columnas');await ready();await settings().getByText('Series visibles · controles de teclado',{exact:true}).click()
 for(const name of ['Norte','Sur']){await expect(settings().getByRole('checkbox',{name,exact:true})).toHaveCount(1);await expect(panel().getByRole('checkbox',{name,exact:true})).toHaveCount(1)}
 await panel().getByRole('button',{name:'Quitar Grupo de Columnas',exact:true}).click()
 await assign('Fecha','Filas');await ready();await expect(settings().getByLabel('Agrupación temporal del gráfico',{exact:true})).toHaveCount(1)
 await expect(panel().getByRole('combobox').filter({has:page.locator('option[value=month]')})).toHaveCount(1)
 await expect(settings().getByLabel('Agrupación temporal del gráfico',{exact:true}).locator('option[value=none]')).toBeEnabled()
 await expect(panel().getByLabel('Agrupación temporal del gráfico',{exact:true})).toHaveCount(1);await expect(panel().getByLabel('Intervalos del gráfico',{exact:true})).toHaveCount(0)
 await chartType(page,'histogram');await expect(settings().getByLabel('Intervalos del gráfico',{exact:true})).toBeVisible()
 await expect(panel().getByLabel('Intervalos del gráfico',{exact:true})).toHaveCount(1);await expect(panel().getByLabel('Agrupación temporal del gráfico',{exact:true})).toHaveCount(0)
 await assign('Edad','Filas');await chartType(page,'scatter')
 await expect(panel().getByRole('checkbox',{name:'Línea de tendencia',exact:true})).toBeVisible();await expect(settings().getByRole('checkbox',{name:'Línea de tendencia',exact:true})).toHaveCount(0)
 for(const kind of ['scatter','line','heatmap','box'] as const){
  await chartType(page,kind)
  await expect(panel().getByLabel('Agrupación temporal del gráfico',{exact:true})).toHaveCount(0);await expect(panel().getByLabel('Intervalos del gráfico',{exact:true})).toHaveCount(0)
 }
 await assign('Ciudad','Filas');await assign('Ingreso','Valores');await panel().getByLabel('Resumir Ingreso por',{exact:true}).selectOption('average');await ready()
 await assign('Ciudad','Filtros');const filter=panel().getByRole('region',{name:'Filtros del gráfico',exact:true})
 await filter.getByLabel('Operador de condición 1',{exact:true}).selectOption('equals');await filter.getByLabel('Valor de condición 1',{exact:true}).fill('Oaxaca');await filter.getByRole('button',{name:'Aplicar filtros del gráfico',exact:true}).click();await ready()
 await expect(panel().getByRole('button',{name:'Quitar filtros del gráfico',exact:true})).toHaveCount(1)
 await expand(details());await details().getByText('Datos del gráfico: tabla accesible',{exact:true}).click();await expect(details().locator('.table-scroll tbody tr')).toHaveText(['Oaxaca122.5'])
 await details().getByText('Ver consulta',{exact:true}).click();await expect(details().locator('pre').filter({hasText:'SELECT'})).toHaveCount(1)
 await details().getByText('Filtros aplicados al gráfico',{exact:true}).click();await expect(details()).toContainText('Oaxaca')
 await showTable(page);await menuItem(page,'Filtrar','Filtros por columna');await page.getByLabel('Filtrar Ciudad',{exact:true}).fill('Oaxaca');await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true})).toHaveAttribute('aria-rowcount','11')
 await openAnalysis(page,'Gráficos');await settings().getByLabel('Alcance del gráfico',{exact:true}).selectOption('filtered');await ready();const saved=await savePreset('Vista Oaxaca')
 expect(saved.configuration.view?.filters).toEqual({0:'Oaxaca'})
 await showTable(page);await page.getByLabel('Filtrar Ciudad',{exact:true}).fill('Mérida');await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true})).toHaveAttribute('aria-rowcount','11')
 await openAnalysis(page,'Gráficos');await settings().getByLabel('Configuración guardada del gráfico',{exact:true}).selectOption(saved.id);await settings().getByRole('button',{name:'Aplicar configuración',exact:true}).click();await ready()
 await expect(settings().getByLabel('Alcance del gráfico',{exact:true})).toHaveValue('saved');await expand(details());await details().getByText('Filtros de tabla recuperados',{exact:true}).click();await expect(details()).toContainText('Oaxaca')
 await expect(details().locator('select,input:not([type=hidden]),button')).toHaveCount(2) // Solo la paginación anterior/siguiente de la tabla informativa.
})

test('SIM-2b: manual sin perfil conserva medida, ejes y agrupación explícitos sin nuevos barridos ni conversión de ID',async()=>{
 const {records}=await open('manual.csv',rows(3001)),before=(await calls()).filter(operation=>operation==='analyzeColumn')
 await openAnalysis(page,'Gráficos');await assign('Ciudad','Filas');await assign('Ingreso','Valores')
 await expect(panel().locator('.field-entry').filter({has:page.locator('.field-name').filter({hasText:/^ID$/})}).locator('.field-badge')).toHaveAccessibleName(t('charts.fields.text'))
 await expect(panel().getByLabel('Resumir Ingreso por',{exact:true})).toHaveValue('count')
 await expect(panel().getByLabel('Resumir Ingreso por',{exact:true}).locator('option[value=sum]')).toBeDisabled()
 await expand(settings());for(const label of ['Columna X del gráfico','Columna Y del gráfico','Tipo de medida del gráfico','Agrupación temporal del gráfico'])await expect(settings().getByLabel(label,{exact:true})).toHaveCount(1)
 await settings().getByLabel('Tipo de medida del gráfico',{exact:true}).selectOption('number')
 await panel().getByLabel('Resumir Ingreso por',{exact:true}).selectOption('sum')
 const generate=panel().getByRole('button',{name:'Generar gráfico',exact:true});await expect(generate).toHaveCount(1);await generate.click();await ready()
 const total=records.reduce((sum,row)=>sum+Number(row[1]),0);await expect(panel().locator('.pivot-result tfoot td').first()).toHaveText(total.toLocaleString('es-MX'))
 await settings().getByLabel('Columna X del gráfico',{exact:true}).selectOption('2');await settings().getByLabel('Agrupación temporal del gráfico',{exact:true}).selectOption('month');await generate.click();await ready()
 await expect(panel().locator('.pivot-result tbody tr')).toHaveText([`2026-01${total.toLocaleString('es-MX')}100%`])
 await settings().getByLabel('Agrupación temporal del gráfico',{exact:true}).selectOption('none');await generate.click();await ready();await expect(panel().locator('.pivot-result tbody tr')).toHaveCount(5)
 const json=JSON.parse((await exportFile('analysis.export.json','manual.analisis.json')).toString('utf8'))
 expect(json.metadata.configuration.options).toMatchObject({x:2,y:1,measureType:'number',aggregate:'sum',time:'none'})
 const sums=Array.from({length:5},(_,index)=>[`2026-01-${String(index+1).padStart(2,'0')}`,records.filter(row=>row[2]===`2026-01-${String(index+1).padStart(2,'0')}`).reduce((sum,row)=>sum+Number(row[1]),0)])
 expect(json.rows.map((row:string[]):[string,number]=>[row[0],Number(row[1])]).sort((a:[string,number],b:[string,number])=>a[0].localeCompare(b[0]))).toEqual(sums)
 expect((await calls()).filter(operation=>operation==='analyzeColumn')).toEqual(before)
 expect(records[0][3]).toBe('000001');expect(records.at(-1)![3]).toBe('003001')
})

async function categoryAngles(names:string[],svg?:string){
 return page.evaluate(({names,svg})=>{
  const root=svg?new DOMParser().parseFromString(svg,'image/svg+xml').documentElement:document.querySelector('.analysis-workspace:not([hidden]) .plot svg')!
  return[...root.querySelectorAll('text')].filter(text=>names.includes(text.textContent??'')).map(text=>{
   let matrix=new DOMMatrix();const chain:SVGGraphicsElement[]=[]
   for(let node:Element|null=text;node&&node!==root;node=node.parentElement)if(node instanceof SVGGraphicsElement)chain.unshift(node)
   for(const node of chain){const transform=node.transform.baseVal.consolidate()?.matrix;if(transform)matrix=matrix.multiply(new DOMMatrix([transform.a,transform.b,transform.c,transform.d,transform.e,transform.f]))}
   return{text:text.textContent!,degrees:Math.atan2(matrix.b,matrix.a)*180/Math.PI}
  })
 },{names,svg})
}
async function expectRotation(names:string[],degrees:number,filename:string,allLabels=false){
 for(const width of [1440,1280]){
  await page.setViewportSize({width,height:900});await expect.poll(async()=>{
   const labels=await categoryAngles(names),present=allLabels?labels.length===names.length&&names.every(name=>labels.filter(label=>label.text===name).length===1):labels.length>=Math.min(names.length,2)
   return present&&labels.every(label=>Math.abs(Math.abs(label.degrees)-degrees)<.05)
  }).toBe(true)
  await test.info().attach(`rotacion-pantalla-${width}`,{body:JSON.stringify({width,plot:await panel().locator('.plot').boundingBox(),labels:await categoryAngles(names)}),contentType:'application/json'})
 }
 const svg=(await exportFile('charts.ui.exportImage',filename,{format:'SVG'})).toString('utf8'),labels=await categoryAngles(names,svg)
 if(allLabels)expect(labels.map(label=>label.text).sort()).toEqual([...names].sort());else expect(labels.length).toBeGreaterThanOrEqual(Math.min(names.length,2))
 for(const label of labels)expect(Math.abs(label.degrees)).toBeCloseTo(degrees,1)
 await test.info().attach('svg-exportado',{body:svg,contentType:'image/svg+xml'})
}
test('SIM-2b: cinco ciudades que caben conservan etiquetas rectas en SVG de pantalla y exportación',async()=>{
 await open();await meanCity();await expectRotation(cities,0,'encuesta.svg',true)
})
test('SIM-2b: treinta nombres de 25 caracteres giran 25 grados en Caja sin cambiar el ranking existente',async()=>{
 const names=Array.from({length:30},(_,index)=>`Ciudad ${String(index+1).padStart(2,'0')} del Valle Verde`)
 expect(names.every(name=>name.length===25)).toBe(true);await open('treinta.csv',rows(60,names))
 await openAnalysis(page,'Gráficos');await assign('Ciudad','Filas');await assign('Ingreso','Valores');await chartType(page,'box');await ready()
 await panel().getByLabel('Grupos por página',{exact:true}).selectOption('50');await expect(panel().locator('.pivot-result tbody tr')).toHaveCount(30)
 await expect(panel().locator('.top-notice')).toHaveCount(0);await expectRotation(names,25,'treinta.svg')
})
