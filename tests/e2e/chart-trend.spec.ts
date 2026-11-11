import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,rm,stat,copyFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {linearRegression,linearRegressionLine,rSquared} from 'simple-statistics'
import {t,type Language} from '../../src/shared/i18n'
import type {SqlRequest,GraphicExportRequest} from '../../src/shared/types'
import {closeElectron} from './close-electron'
import {openAnalysis,chartPanel,chartGenerate,analysisResultExport,showTable,menuItem} from './panel'

let app:ElectronApplication,page:Page,folder:string
const five='X,Y\n1,2\n2,4\n3,5\n4,4\n5,5\n'
const panel=()=>chartPanel(page),trend=()=>panel().locator('.trend-result')
async function launch(language:Language='es'){
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:language,FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')},timeout:60000})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
}
test.beforeEach(async()=>{folder=await mkdtemp(join(tmpdir(),'freya-trend-'));await mkdir(join(folder,'exports'));await launch()})
test.afterEach(async()=>{await closeElectron(app);await rm(folder,{recursive:true,force:true})})
async function open(content:string|Uint8Array=five,name='trend.csv'){
 const path=join(folder,name);await writeFile(path,content)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(page.getByRole('tab',{name:doc.name,exact:true})).toHaveAttribute('aria-selected','true')
 return{doc,path}
}
async function configure(language:Language='es'){
 await openAnalysis(page,'Gráficos')
 await panel().locator('.more-options>summary').click()
 await panel().getByLabel(t('charts.ui.typeLabel',{},language),{exact:true}).selectOption('scatter')
 await panel().getByLabel(t('charts.ui.xLabel',{},language),{exact:true}).selectOption('0')
 await panel().getByLabel(t('charts.ui.yLabel',{},language),{exact:true}).selectOption('1')
 return panel().getByRole('checkbox',{name:t('charts.trend.option',{},language),exact:true})
}
async function generate(language:Language='es'){
 await chartGenerate(page).click()
 await expect(trend()).toContainText(t('charts.trend.cause',{},language),{timeout:30000})
}
async function spy(hold=false){
 await app.evaluate(({ipcMain},hold)=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya')!
  const queries:string[]=[],images:GraphicExportRequest[]=[];Reflect.set(globalThis,'trendQueries',queries);Reflect.set(globalThis,'trendImages',images)
  let holdNext=hold
  handlers.set('freya',async(event,...args)=>{
   const isTrend=args[0]==='sqlRun'&&(args[1] as SqlRequest).sql.includes('regr_slope')
   if(isTrend)queries.push((args[1] as SqlRequest).sql)
   if(args[0]==='exportGraphic')images.push(args[2] as GraphicExportRequest)
   const response=await original(event,...args)
   if(isTrend&&holdNext){holdNext=false;await new Promise<void>(resolve=>Reflect.set(globalThis,'trendRelease',resolve))}
   return response
  })
 },hold)
}
const queries=()=>app.evaluate(()=>Reflect.get(globalThis,'trendQueries') as string[])

test('TEN-1 cinco pares: petición, teclado, exportaciones completas y preset',async()=>{
 await spy();const {path}=await open(),checkbox=await configure()
 await expect(checkbox).not.toBeChecked();expect(await queries()).toEqual([])
 await checkbox.focus();await page.keyboard.press('Space');await expect(checkbox).toBeChecked()
 expect(await queries()).toEqual([])
 await generate()
 await expect(trend()).toContainText('y = 0.6·x + 2.2');await expect(trend()).toContainText('R² = 0.6 · r = 0.7746 · 5 puntos')
 await expect(trend()).toHaveAttribute('title',/0\.774596669241483/);await expect(trend()).toHaveAttribute('aria-live','polite')
 expect(await queries()).toHaveLength(1)
 await expect(panel().locator('.plot')).toHaveAttribute('aria-label',/Relación no es causa/)
 await expect(panel().locator('.plot svg text').filter({hasText:/^Tendencia$/})).toHaveCount(1)
 for(const format of ['SVG','PNG']){
  await panel().getByRole('button',{name:`Exportar gráfico ${format}`,exact:true}).click()
  await expect(panel().locator('.chart-result>.result-announcement')).toContainText(`trend.${format.toLowerCase()}`)
  expect((await stat(join(folder,'exports','trend.'+format.toLowerCase()))).size).toBeGreaterThan(1000)
 }
 const svg=await readFile(join(folder,'exports','trend.svg'),'utf8');expect(svg).toContain('y = 0.6·x + 2.2');expect(svg).toContain('stroke-dasharray')
 const images=await app.evaluate(()=>Reflect.get(globalThis,'trendImages') as GraphicExportRequest[])
 expect(images.map(image=>image.format)).toEqual(['svg','png']);expect(images.every(image=>image.svg.includes('y = 0.6·x + 2.2'))).toBe(true)
 for(const format of ['svg','png'])await copyFile(join(folder,'exports','trend.'+format),test.info().outputPath('trend-export.'+format))
 await analysisResultExport(page).locator('summary').click()
 for(const format of ['json','csv','md']){
  await analysisResultExport(page).getByLabel('Formato de resultados del gráfico',{exact:true}).selectOption(format)
  await analysisResultExport(page).getByRole('button',{name:'Exportar resultados',exact:true}).click()
  await expect(panel().locator('.chart-result>.result-announcement')).toContainText(`trend.analisis.${format}`)
 }
 const json=JSON.parse(await readFile(join(folder,'exports','trend.analisis.json'),'utf8')),context=JSON.parse(await readFile(join(folder,'exports','trend.analisis.csv.contexto.json'),'utf8'))
 expect(json.trend).toMatchObject({slope:expect.closeTo(.6,12),intercept:expect.closeTo(2.2,12),r2:expect.closeTo(.6,12),r:expect.closeTo(Math.sqrt(.6),12),n:5});expect(context.trend).toEqual(json.trend)
 const {parse}=await import('csv-parse/sync');expect(parse(await readFile(join(folder,'exports','trend.analisis.csv'),'utf8'))).toHaveLength(6)
 const markdown=await readFile(join(folder,'exports','trend.analisis.md'),'utf8');expect(markdown).toContain(String(json.trend.r2));expect(markdown).toContain('Relación no es causa.')
 await analysisResultExport(page).locator('summary').click()
 await panel().getByText('Configuraciones guardadas',{exact:true}).click();await panel().getByLabel('Nombre de configuración del gráfico').fill('Recta')
 await panel().getByRole('button',{name:'Guardar configuración',exact:true}).click()
 await expect.poll(()=>page.evaluate(()=>window.freya.chartPresets())).toHaveLength(1)
 expect((await page.evaluate(()=>window.freya.chartPresets()))[0].configuration.options.trend).toBe(true)
 expect(await readFile(path,'utf8')).toBe(five)
})

test('TEN-1 degenerados explican la ausencia y conservan marcada la opción',async()=>{
 for(const [name,content,message] of [
  ['constant-x','X,Y\n2,1\n2,2\n2,3\n','Todas las X son iguales'],
  ['constant-y','X,Y\n1,7\n2,7\n3,7\n','Y no varía: R² no aplica'],
  ['two','X,Y\n1,3\n2,5\n','Hacen falta al menos 3 puntos'],
  ['zero','X,Y\na,b\nc,d\n','Hacen falta al menos 3 puntos'],
 ] as const){
  await open(content,name+'.csv');const checkbox=await configure();await checkbox.check();await generate()
  await expect(trend()).toContainText(message);await expect(checkbox).toBeChecked()
  expect(await panel().locator('.plot svg text').filter({hasText:/^Tendencia$/}).count()).toBe(name==='constant-y'?1:0)
  if(name==='constant-y'){await expect(trend()).toContainText('y = 0·x + 7');await expect(trend()).not.toContainText('100%')}
 }
})

test('TEN-1 filtros de gráfico y vista usan el mismo subconjunto y Separar por bloquea la tendencia',async()=>{
 const content='X,Y,Grupo\n1,2,A\n2,4,A\n3,5,A\n4,4,A\n5,5,A\n1,8,B\n2,6,B\n3,4,B\n4,2,B\n5,0,B\n'
 await open(content);await menuItem(page,'Filtrar','Filtros por columna');await page.getByLabel('Filtrar Grupo',{exact:true}).fill('A')
 await expect(page.getByRole('grid')).toHaveAttribute('aria-rowcount','6')
 const checkbox=await configure();await panel().getByLabel('Alcance del gráfico',{exact:true}).selectOption('filtered');await checkbox.check();await generate()
 await expect(trend()).toContainText('5 puntos');await expect(trend()).toContainText('y = 0.6·x + 2.2');await expect(trend()).toContainText('Vista filtrada actual')
 await expect(trend()).toContainText('Fuente: documento en memoria');await expect(trend()).not.toContainText('Calculada sobre')
 await panel().getByLabel('Alcance del gráfico',{exact:true}).selectOption('all')
 await panel().getByRole('button',{name:'Filtros del gráfico',exact:true}).click()
 const filter=panel().getByRole('region',{name:'Filtros del gráfico',exact:true})
 await filter.getByRole('button',{name:'Añadir condición',exact:true}).click();await filter.getByLabel('Columna de condición 1',{exact:true}).selectOption('2');await filter.getByLabel('Operador de condición 1',{exact:true}).selectOption('equals');await filter.getByLabel('Valor de condición 1',{exact:true}).fill('B')
 await filter.getByRole('button',{name:'Aplicar filtros del gráfico',exact:true}).click();await generate()
 await expect(trend()).toContainText('5 puntos');await expect(trend()).toContainText('A más X, menos Y.')
 await expect(panel().getByRole('button',{name:'Filtros del gráfico',exact:true})).toContainText('(1)')
 await panel().getByLabel('Series del gráfico',{exact:true}).selectOption('2');await expect(checkbox).toBeDisabled();await expect(checkbox).toHaveAccessibleDescription('La tendencia se calcula sin “Separar por” en esta versión')
 await chartGenerate(page).click();await expect(panel().locator('.chart-result>.result-announcement')).toContainText('Resultado actualizado');await expect(trend()).toHaveCount(0)
})

test('TEN-1 cancelar descarta la respuesta tardía y editar exige actualizar la revisión',async()=>{
 await spy(true);const {path}=await open(),checkbox=await configure();await checkbox.check();await chartGenerate(page).click()
 await expect.poll(()=>app.evaluate(()=>typeof Reflect.get(globalThis,'trendRelease'))).toBe('function')
 await panel().getByRole('button',{name:'Cancelar gráfico',exact:true}).click();await expect(panel().locator('.chart-result>.result-announcement')).toContainText('cancelado')
 await app.evaluate(()=>Reflect.get(globalThis,'trendRelease')());await expect(trend()).toHaveCount(0);await expect(panel().locator('.plot svg path')).toHaveCount(0)
 await generate();await showTable(page)
 const cell=page.getByRole('gridcell',{name:'Fila 1, Y',exact:true});await cell.dblclick();await cell.getByRole('textbox').fill('12');await cell.getByRole('textbox').press('Enter')
 await openAnalysis(page,'Gráficos');await expect(trend()).toHaveCount(0);await expect(panel().locator('.manual')).toContainText(t('charts.ui.changed'))
 await generate();await expect(trend()).toContainText('y = -1.4·x + 10.2')
 expect(await readFile(path,'utf8')).toBe(five)
})

test('TEN-1 300 000 filas: oráculo completo y procedencia real cuando el editor solo muestra una muestra',async()=>{
 const pairs=Array.from({length:300000},(_,i)=>[i%1000-500,3*(i%1000-500)+1+((i*17)%23-11)/100])
 // La última celda supera 1 MiB en el índice UTF-16, pero cabe en el análisis UTF-8: muestra real con original válido.
 const content='X,Y,A,B,C,D,E\r\n'+pairs.map((pair,index)=>pair.join(',')+','+(index===pairs.length-1?'a'.repeat(600000):'a')+',b,c,d,e\r\n').join(''),bytes=Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(content,'utf16le')]),{doc,path}=await open(bytes,'many.csv')
 expect(doc.readonly).toBe(true);expect(doc.large).not.toBe(true);expect(doc.rowCount).toBe(200)
 const checkbox=await configure();await checkbox.check();await generate()
 await expect(trend()).toContainText('Dibujados 2,000 de 300,000 puntos; la tendencia usa todos');await expect(trend()).toContainText('archivo completo desde disco');await expect(trend()).not.toContainText('muestra')
 await expect(panel().locator('.result-status')).toContainText(t('charts.fields.sample'))
 await analysisResultExport(page).locator('summary').click();await analysisResultExport(page).getByRole('button',{name:'Exportar resultados',exact:true}).click()
 await expect(panel().locator('.chart-result>.result-announcement')).toContainText('many.analisis.json',{timeout:30000})
 const output=JSON.parse(await readFile(join(folder,'exports','many.analisis.json'),'utf8')),regression=linearRegression(pairs)
 expect(output.trend.n).toBe(300000);expect(output.trend.slope).toBeCloseTo(regression.m,12);expect(output.trend.r2).toBeCloseTo(rSquared(pairs,linearRegressionLine(regression)),12);expect(output.metadata.origin).toContain('completo desde disco')
 expect(output.rows).toHaveLength(10000);expect(await readFile(path)).toEqual(bytes)
})

for(const language of ['es','en-XA'] as const)test(`TEN-1 capturas, teclado y bloque legible en ${language}`,async()=>{
 if(language!=='es'){await closeElectron(app);await launch(language)}
 await open();const checkbox=await configure(language);await checkbox.focus();await page.keyboard.press('Space');await generate(language)
 await panel().locator('.more-options>summary').click()
 for(const theme of ['light','dark']){
  await page.getByLabel('Tema',{exact:true}).selectOption(theme)
  await expect(trend()).toBeInViewport({ratio:1});await expect(panel().locator('.plot-scroll')).toBeInViewport({ratio:1})
  expect((await panel().locator('.plot-scroll').boundingBox())!.height).toBeGreaterThanOrEqual(170)
  await page.screenshot({path:test.info().outputPath(`ten1-${language}-${theme}-1440x900.png`)})
 }
 if(language==='es'){
  await page.setViewportSize({width:1280,height:720});await expect(trend()).toBeInViewport({ratio:1});await expect(panel().locator('.plot-scroll')).toBeInViewport({ratio:1})
  await page.screenshot({path:test.info().outputPath('ten1-es-dark-1280x720.png')})
 }
})
